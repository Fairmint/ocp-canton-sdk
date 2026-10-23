/**
 * The switch to a rebuilt book: its readiness before the old book's teardown, each condition holding and failing; the
 * old book's stops re-placed on the new book, through securities the replayed source derives from a replaced one; the
 * two books' stops reconciled; and the old book's purge batches.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import { buildPlaceHoldsCommand } from '../../src/functions/OpenCapTable/capTable/holds';
import { resolveInputs } from '../../src/register/inputs';
import { registerEventFormat } from '../../src/register/reader';
import { RegisterIndex } from '../../src/register/registerIndex';
import { replayOcf } from '../../src/register/replay/replay';
import {
  checkTeardownReady,
  planPurge,
  planStopReplacement,
  readTeardownBook,
  reconcileStops,
  stopPlacementWrite,
} from '../../src/register/replication/teardown';
import type { TeardownCondition, TeardownReadiness, TeardownStop } from '../../src/register/replication/types';
import type { OcfStockHold } from '../../src/types/native';
import type {
  CapTableStatus,
  OpenHold,
  RecordedSplit,
  RegisterContext,
  ReplayResult,
  StockSecurityState,
} from '../../src/types/register';
import { ANCHOR_TEMPLATE_ID, decodeChoice, exerciseOf } from '../capTable/capTableFixtures';
import { deliverMessages, queueWebSocketScript, resetWebSocketMock, webSocketConnections } from '../mocks/canton-deep';
import {
  stakeholder,
  stockAcceptance,
  stockClass,
  stockClassSplit,
  stockIssuance,
  stockState,
  TestBook,
} from './bookFixtures';
import { CONTEXT, split } from './registerFixtures';
import { acsItem, anchorEvent, anchorItems, bookEvents } from './registerLedgerFixtures';
import {
  cancellation,
  consolidation,
  D2024,
  derived,
  issuance,
  manifestOf,
  out,
  stakeholder as sourceStakeholder,
  stockClass as sourceStockClass,
  transfer,
  type OcfJson,
} from './replayFixtures';

/** The book being torn down. */
const OLD: RegisterContext = CONTEXT;
/** Its rebuild, under an incoming TA. */
const NEW: RegisterContext = { ...CONTEXT, cap_table_id: 'test-2', transfer_agent: 'incoming-transfer-agent::1220' };
const DRAIN = 10;
const AS_OF = '2026-10-23';

function anchored(index: RegisterIndex, status: CapTableStatus): RegisterIndex {
  index.add({
    kind: 'anchor',
    context: index.context,
    contract: {
      contractId: `anchor-${index.context.cap_table_id}`,
      templateId: ANCHOR_TEMPLATE_ID,
      createdOffset: 1,
      status,
    },
  });
  return index;
}

interface BookOptions {
  /** The anchor's status; `null` for none (default Active) */
  status?: CapTableStatus | null;
  /** The offset the index is read at (default 20) */
  offset?: number;
  /** The splits recorded on CLS-A's epoch */
  splits?: RecordedSplit[];
}

/** A book of `context`: stakeholders SH-A and SH-B, class CLS-A with its epoch, and ISS-A1, the issuance of S-A1. */
function book(context: RegisterContext, build: (book: TestBook) => void = () => {}, options: BookOptions = {}) {
  const testBook = new TestBook(context, options.offset ?? 20)
    .record('stakeholder', stakeholder('SH-A'))
    .record('stakeholder', stakeholder('SH-B'))
    .record('stockClass', stockClass('CLS-A'))
    .epoch('CLS-A', { splits: options.splits ?? [] })
    .record('stockIssuance', stockIssuance());
  build(testBook);
  const index = testBook.index();
  return options.status === null ? index : anchored(index, options.status ?? 'ACTIVE');
}

function stopHold(reference: string, holdId = derived(`S-${reference}`, 0, 'hold')): OpenHold {
  return { hold_id: holdId, hold_type: 'STOP_TRANSFER', reference, split_epoch: 0, quantity: null };
}

function settlementHold(reference: string, holdId: string): OpenHold {
  return { hold_id: holdId, hold_type: 'REGISTER_SETTLEMENT', reference, split_epoch: 0, quantity: '100' };
}

function holdRecord(hold: OpenHold, securityId: string, reasonText = `Court order ${hold.reference}`): OcfStockHold {
  return {
    object_type: 'TX_STOCK_HOLD',
    id: hold.hold_id,
    date: '2026-01-01',
    security_id: securityId,
    hold_type: 'STOP_TRANSFER',
    reference: hold.reference,
    reason_text: reasonText,
  };
}

/** A lot in CLS-A with these holds. */
function lot(securityId: string, holds: OpenHold[] = [], overrides: Partial<StockSecurityState> = {}) {
  return stockState({ security_id: securityId, holds, ...overrides });
}

/** A stopped lot of the old book, with its stop's hold record. */
function stopped(testBook: TestBook, securityId: string, hold: OpenHold, reasonText?: string): TestBook {
  return testBook
    .state(lot(securityId, [hold], { seq: 1 }))
    .record('stockHold', holdRecord(hold, securityId, reasonText), `cid-${hold.hold_id}`, 15);
}

function teardownStop(securityId: string, hold: OpenHold, reasonText: string | null = `Court order ${hold.reference}`) {
  return {
    securityId,
    holdId: hold.hold_id,
    reference: hold.reference,
    reasonText,
    stakeholderId: 'SH-A',
    stockClassId: 'CLS-A',
  } satisfies TeardownStop;
}

function conditions(readiness: TeardownReadiness): TeardownCondition[] {
  return readiness.issues.map((issue) => issue.condition);
}

function expectThrowsClassified(action: () => unknown, classification: string): void {
  let caught: unknown = null;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ classification });
}

describe('checkTeardownReady', () => {
  /** An old book with a stop (which the teardown does not wait for) and a record its acceptance choice derived. */
  const acceptanceId = derived('S-A1', 1, 'event');
  const ORDER = stopHold('ORDER-1', derived('S-A1', 0, 'hold'));

  function oldBook(build: (book: TestBook) => void = () => {}, options: BookOptions = {}): RegisterIndex {
    return book(
      OLD,
      (b) => {
        b.record('stockAcceptance', stockAcceptance(acceptanceId, 'S-A1'), `cid-${acceptanceId}`, 8);
        b.record('stockHold', holdRecord(ORDER, 'S-A1'), 'cid-hold', 15);
        build(b);
      },
      options
    );
  }

  function rebuilt(build: (book: TestBook) => void = () => {}, options: BookOptions = {}): RegisterIndex {
    return book(
      NEW,
      (b) => {
        b.record('stockAcceptance', stockAcceptance(acceptanceId, 'S-A1'));
        build(b);
      },
      options
    );
  }

  const ready = (oldIndex: RegisterIndex, newIndex: RegisterIndex, drainOffset = DRAIN): TeardownReadiness =>
    checkTeardownReady({ oldIndex, newIndex, drainOffset, asOf: AS_OF });

  it('is ready when the new book holds every record but the hold pair, under another TA, stops open', () => {
    const readiness = ready(
      oldBook((b) => b.state(lot('S-A1', [ORDER], { seq: 2 }))),
      rebuilt((b) => b.state(lot('S-A1')))
    );

    expect(readiness).toEqual({
      ready: true,
      oldCapTableId: 'test-1',
      newCapTableId: 'test-2',
      drainOffset: DRAIN,
      issues: [],
      differences: [],
      recordsChecked: 5,
    });
  });

  it('refuses while the old book carries a settlement hold, current or voided', () => {
    const current = ready(
      oldBook((b) => b.state(lot('S-A1', [settlementHold('trade-1', 'HOLD-T1')]))),
      rebuilt((b) => b.state(lot('S-A1')))
    );
    expect(current.ready).toBe(false);
    expect(current.issues).toEqual([
      {
        condition: 'settlement_hold',
        message:
          'Security S-A1 carries the settlement hold HOLD-T1 of settlement trade-1: release its trade before the teardown',
        recordIds: ['HOLD-T1'],
        securityIds: ['S-A1'],
      },
    ]);

    const voided = ready(
      oldBook((b) => b.state(lot('S-A1', [settlementHold('trade-1', 'HOLD-T1')])), {
        splits: [split('SPLIT-1', '2025-06-01', '2', '1')],
      }),
      rebuilt((b) => b.state(lot('S-A1')))
    );
    expect(voided.issues).toEqual([
      expect.objectContaining({
        condition: 'settlement_hold',
        message:
          'Security S-A1 carries the voided settlement hold HOLD-T1 of settlement trade-1: cancel it before the teardown',
      }),
    ]);
  });

  it('refuses while the new book lacks a record of the old book, and reports it', () => {
    const newIndex = new TestBook(NEW, 20)
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance())
      .state(lot('S-A1'))
      .index();
    const readiness = ready(oldBook(), anchored(newIndex, 'ACTIVE'));

    expect(conditions(readiness)).toEqual(['missing_record', 'missing_record']);
    expect(readiness.issues).toEqual([
      {
        condition: 'missing_record',
        message: 'STAKEHOLDER SH-B of the old book is not on the new book test-2',
        recordIds: ['SH-B'],
        securityIds: [],
      },
      {
        condition: 'missing_record',
        message: `TX_STOCK_ACCEPTANCE ${acceptanceId} of the old book is not on the new book test-2`,
        recordIds: [acceptanceId],
        securityIds: ['S-A1'],
      },
    ]);
  });

  it('refuses a record written to the old book after the drain, even one the new book holds', () => {
    const readiness = ready(
      oldBook((b) => b.record('stakeholder', stakeholder('SH-C'), 'cid-SH-C', DRAIN + 2)),
      rebuilt((b) => b.record('stakeholder', stakeholder('SH-C')))
    );

    expect(readiness.issues).toEqual([
      {
        condition: 'written_after_drain',
        message: 'STAKEHOLDER SH-C was written to the old book at offset 12, after the drain finished at 10',
        recordIds: ['SH-C'],
        securityIds: [],
      },
    ]);
  });

  it('refuses an old book read before the drain finished', () => {
    const readiness = ready(
      oldBook(() => {}, { offset: 8 }),
      rebuilt(),
      DRAIN
    );

    expect(readiness.issues).toEqual([
      {
        condition: 'index_behind',
        message: 'The old book test-1 was read at offset 8, before the drain finished at 10: read it again',
        recordIds: [],
        securityIds: [],
      },
    ]);
  });

  it('refuses unless both books are Active', () => {
    const readiness = ready(
      oldBook(() => {}, { status: 'TEARING_DOWN' }),
      rebuilt(() => {}, { status: null })
    );

    expect(readiness.issues).toEqual([
      expect.objectContaining({
        condition: 'old_book_status',
        message: 'The old book test-1 is tearing down, not Active',
      }),
      expect.objectContaining({
        condition: 'new_book_status',
        message: 'The new book test-2 has no anchor in the index',
      }),
    ]);
    expect(
      conditions(
        ready(
          oldBook(),
          rebuilt(() => {}, { status: 'CLOSED' })
        )
      )
    ).toEqual(['new_book_status']);
  });

  it('refuses a book that reads incomplete', () => {
    const newIndex = rebuilt();
    newIndex.addUnreadable({
      contractId: 'cid-later-upgrade',
      templateId: 'later:Fairmint.OpenCapTable.OCF.Stakeholder:Stakeholder',
      packageName: 'OpenCapTable-v35',
      capTableId: 'test-2',
      reason: 'invalid_payload',
      message: 'the payload does not decode',
    });
    const readiness = ready(oldBook(), newIndex);

    expect(readiness.issues).toEqual([
      {
        condition: 'incomplete_read',
        message:
          'The new book test-2 reads incomplete (unreadable_contract): read it again, with an SDK that reads every ' +
          'contract it holds',
        recordIds: [],
        securityIds: [],
      },
    ]);

    const duplicated = oldBook();
    const original = duplicated.record('SH-B');
    if (original === null) throw new Error('no SH-B');
    duplicated.add({ kind: 'record', context: OLD, contract: { ...original, contractId: 'cid-SH-B-again' } });
    expect(ready(duplicated, rebuilt()).issues).toEqual([
      expect.objectContaining({ condition: 'incomplete_read', recordIds: ['SH-B'] }),
    ]);
  });

  it('reports the records the rebuild corrected, without refusing the switch', () => {
    const corrected = { ...stakeholder('SH-B'), name: { legal_name: 'Holder SH-B (corrected)' } };
    const newIndex = new TestBook(NEW, 20)
      .record('stakeholder', stakeholder('SH-A'))
      .record('stakeholder', corrected)
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance({ quantity: '900' }))
      .record('stockAcceptance', stockAcceptance(acceptanceId, 'S-A1'))
      .state(lot('S-A1', [], { quantity: '900' }))
      .index();
    const readiness = ready(oldBook(), anchored(newIndex, 'ACTIVE'));

    expect(readiness.ready).toBe(true);
    expect(readiness.differences).toEqual([
      expect.objectContaining({ objectId: 'SH-B', entityType: 'stakeholder', newEntityType: 'stakeholder' }),
      expect.objectContaining({ objectId: 'ISS-A1', entityType: 'stockIssuance', newEntityType: 'stockIssuance' }),
    ]);
    expect(readiness.differences[0]?.differences.join('\n')).toContain('name.legal_name');
    expect(readiness.differences[1]?.differences.join('\n')).toContain('quantity');
  });

  it('reports the records the correction removes, such as a split recorded in error, without refusing the switch', () => {
    // The old book recorded a 2:1 split of CLS-A in error; no restatement corrects a split, so the book was rebuilt
    // from a source without it. A stakeholder the old book wrote is missing from the rebuild too.
    const oldIndex = oldBook(
      (b) => {
        b.record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2024-06-01'));
        b.record('stakeholder', stakeholder('SH-C'));
      },
      { splits: [split('SPLIT-1', '2024-06-01', '2', '1')] }
    );
    const newIndex = rebuilt();
    expect(conditions(ready(oldIndex, newIndex))).toEqual(['missing_record', 'missing_record']);

    const readiness = checkTeardownReady({
      oldIndex,
      newIndex,
      drainOffset: DRAIN,
      asOf: AS_OF,
      removedByCorrection: ['SPLIT-1', 'SH-A'],
    });
    expect(readiness.ready).toBe(false);
    // Only the record the correction names, and the new book lacks, is a removal; SH-C is still missing, and SH-A,
    // which the new book holds, is compared as usual.
    expect(readiness.issues).toEqual([expect.objectContaining({ condition: 'missing_record', recordIds: ['SH-C'] })]);
    expect(readiness.differences).toEqual([
      { kind: 'removed', objectId: 'SPLIT-1', entityType: 'stockClassSplit', newEntityType: null, differences: [] },
    ]);

    const removed = checkTeardownReady({
      oldIndex,
      newIndex,
      drainOffset: DRAIN,
      asOf: AS_OF,
      removedByCorrection: ['SPLIT-1', 'SH-C'],
    });
    expect(removed).toMatchObject({ ready: true, issues: [], recordsChecked: 7 });
    expect(removed.differences.map((difference) => [difference.kind, difference.objectId])).toEqual([
      ['removed', 'SPLIT-1'],
      ['removed', 'SH-C'],
    ]);
    expect(() =>
      checkTeardownReady({
        oldIndex,
        newIndex,
        drainOffset: DRAIN,
        removedByCorrection: [''] as readonly string[],
      })
    ).toThrow("Validation error at 'removedByCorrection'");
  });

  it('never takes a record a register choice wrote, or one such a record names, as removed by the correction', () => {
    // CapTable_Settle sold S-A1 to a new buyer, whose stakeholder it wrote under a claimed ID; apiv2 has not read the
    // trade back, so the rebuild's source holds neither the buyer nor its issuance. No correction removes them.
    const buyerIssuance = derived('S-A1', 1, 'resulting_issuance');
    const oldIndex = oldBook((b) => {
      b.record('stakeholder', stakeholder('SH-BUYER'));
      b.record(
        'stockIssuance',
        stockIssuance({
          id: buyerIssuance,
          security_id: derived('S-A1', 1, 'resulting_security'),
          custom_id: 'CS-BUYER',
          stakeholder_id: 'SH-BUYER',
        })
      );
      b.record('stakeholder', stakeholder('SH-C'));
    });
    const readiness = checkTeardownReady({
      oldIndex,
      newIndex: rebuilt(),
      drainOffset: DRAIN,
      asOf: AS_OF,
      removedByCorrection: ['SH-BUYER', buyerIssuance, 'SH-C'],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toEqual([
      {
        condition: 'missing_record',
        message:
          'STAKEHOLDER SH-BUYER of the old book is not on the new book test-2, and no correction removes it: ' +
          `TX_STOCK_ISSUANCE ${buyerIssuance}, which a register choice wrote, names it; replicate the old book's ` +
          'trades to the new book first',
        recordIds: ['SH-BUYER'],
        securityIds: [],
      },
      {
        condition: 'missing_record',
        message:
          `TX_STOCK_ISSUANCE ${buyerIssuance} of the old book is not on the new book test-2, and no correction ` +
          "removes it: a register choice wrote it; replicate the old book's trades to the new book first",
        recordIds: [buyerIssuance],
        securityIds: [derived('S-A1', 1, 'resulting_security')],
      },
    ]);
    // A record no register choice wrote or names is a removal.
    expect(readiness.differences).toEqual([
      { kind: 'removed', objectId: 'SH-C', entityType: 'stakeholder', newEntityType: null, differences: [] },
    ]);
  });

  it('refuses one cap table as both books, and a malformed drain offset or date', () => {
    const index = oldBook();
    expectThrowsClassified(() => ready(index, oldBook()), 'same_book');
    expect(() => ready(index, rebuilt(), -1)).toThrow("Validation error at 'drainOffset'");
    expect(() =>
      checkTeardownReady({ oldIndex: index, newIndex: rebuilt(), drainOffset: DRAIN, asOf: '2026-1-1' })
    ).toThrow("'asOf'");
  });

  it('reports voided holds as of today by default', () => {
    const readiness = checkTeardownReady({
      oldIndex: oldBook((b) => b.state(lot('S-A1', [settlementHold('trade-1', 'HOLD-T1')])), {
        splits: [split('SPLIT-1', '2025-06-01', '2', '1')],
      }),
      newIndex: rebuilt((b) => b.state(lot('S-A1'))),
      drainOffset: DRAIN,
    });
    expect(readiness.issues[0]?.message).toContain('voided settlement hold');
  });
});

describe('readTeardownBook', () => {
  function ledgerClient(): LedgerJsonApiClient {
    return { getLedgerEnd: jest.fn().mockResolvedValue({ offset: 42 }) } as unknown as LedgerJsonApiClient;
  }

  beforeEach(() => {
    resetWebSocketMock();
  });

  it("reads the new book as its issuer, which the outgoing TA's tooling can", async () => {
    queueWebSocketScript(async (connection) =>
      deliverMessages(connection, anchorItems(anchorEvent('cid-anchor', NEW)))
    );
    queueWebSocketScript(async (connection) => deliverMessages(connection, bookEvents(NEW).map(acsItem)));

    const index = await readTeardownBook(ledgerClient(), { capTableId: NEW.cap_table_id, readAs: NEW.issuer });

    expect(index.context).toEqual(NEW);
    expect(index.offset).toBe(42);
    expect(index.anchor?.status).toBe('ACTIVE');
    expect(index.flags()).toEqual([]);
    expect(webSocketConnections[1]?.request).toEqual({
      verbose: false,
      activeAtOffset: 42,
      eventFormat: registerEventFormat(NEW.issuer),
    });
  });

  it('refuses a cap table the party reads no book of', async () => {
    queueWebSocketScript(async (connection) => deliverMessages(connection, []));
    queueWebSocketScript(async (connection) => deliverMessages(connection, []));

    await expect(
      readTeardownBook(ledgerClient(), {
        capTableId: 'test-9',
        readAs: NEW.system_operator,
        activeAtOffset: 7,
        retainPayloads: false,
        idleTimeoutMs: 0,
      })
    ).rejects.toMatchObject({
      code: OcpErrorCodes.CONTRACT_NOT_FOUND,
      classification: 'register_book_not_found',
      message: `${NEW.system_operator} reads no book for cap table test-9 at offset 7`,
    });
  });
});

/** The replay of the new book's source: the standard book with these records. */
function replayOf(...records: OcfJson[]): ReplayResult {
  const replay = replayOcf(
    manifestOf([
      sourceStakeholder('SH-A'),
      sourceStakeholder('SH-B'),
      sourceStockClass('CLS-A'),
      issuance('S-A1', 'SH-A', 'CLS-A', '600', D2024),
      issuance('S-A2', 'SH-A', 'CLS-A', '400', D2024),
      ...records,
    ]),
    { capTableId: NEW.cap_table_id }
  );
  expect(replay.violations).toEqual([]);
  return replay;
}

describe('planStopReplacement', () => {
  const ORDER = stopHold('ORDER-1', derived('S-A1', 0, 'hold'));
  const tornDown = (build: (book: TestBook) => void): RegisterIndex => book(OLD, build, { status: 'TEARING_DOWN' });

  it('re-places a stop on the security with the same ID, as a write the new book takes', () => {
    const oldIndex = tornDown((b) => stopped(b, 'S-A1', ORDER));
    const newIndex = book(NEW, (b) => b.state(lot('S-A1')));

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex });

    expect(plan).toEqual({
      oldCapTableId: 'test-1',
      newCapTableId: 'test-2',
      stops: [teardownStop('S-A1', ORDER)],
      placements: [
        {
          reference: 'ORDER-1',
          reasonText: 'Court order ORDER-1',
          lots: [{ security_id: 'S-A1' }],
          stops: [[teardownStop('S-A1', ORDER)]],
        },
      ],
      placed: [],
      unmapped: [],
    });

    const [placement] = plan.placements;
    if (placement === undefined) throw new Error('no placement');
    const write = stopPlacementWrite(placement, AS_OF);
    expect(write).toEqual({
      kind: 'placeHolds',
      holdType: 'STOP_TRANSFER',
      reference: 'ORDER-1',
      date: AS_OF,
      reasonText: 'Court order ORDER-1',
      lots: [{ security_id: 'S-A1' }],
    });
    const { inputs } = resolveInputs(newIndex, write);
    expect(inputs).toEqual({ states: ['state-S-A1'], epochs: ['epoch-CLS-A'], shards: [], records: [] });
    const command = buildPlaceHoldsCommand({
      capTableContractId: 'anchor-test-2',
      transferAgent: NEW.transfer_agent,
      inputs,
      holdType: write.holdType,
      reference: write.reference,
      date: write.date,
      reasonText: write.reasonText,
      lots: [...write.lots],
    });
    expect(command.actAs).toEqual([NEW.transfer_agent]);
    expect(
      decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_PlaceHolds, exerciseOf(command).choiceArgument).lots
    ).toEqual([{ security_id: 'S-A1', quantity: null, origin_issuance: null }]);
    expect(() => stopPlacementWrite(placement, '23-10-2026')).toThrow("'date'");
  });

  /**
   * The corrected source transfers 200 of S-A1 to S-B1, leaving S-A3 with 400, and then S-B1 on to S-C1; the new book
   * holds S-A3 and S-C1, and no S-A1.
   */
  const replaced = (): ReplayResult =>
    replayOf(
      transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A3'),
      out('S-B1', 'SH-B', '200'),
      out('S-A3', 'SH-A', '400'),
      transfer('TR-2', 'S-B1', '200', ['S-C1'], null, '2024-04-01'),
      out('S-C1', 'SH-B', '200', '2024-04-01')
    );

  it('re-places a stop on each security the replayed source derives from a replaced one', () => {
    const replay = replaced();
    const oldIndex = tornDown((b) => stopped(b, 'S-A1', ORDER));
    const newIndex = book(NEW, (b) => b.state(lot('S-A3')).state(lot('S-C1')).state(lot('S-A2')));

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex, replay });

    expect(plan.unmapped).toEqual([]);
    expect(plan.placements).toEqual([
      {
        reference: 'ORDER-1',
        reasonText: 'Court order ORDER-1',
        lots: [{ security_id: 'S-A3' }, { security_id: 'S-C1' }],
        stops: [[teardownStop('S-A1', ORDER)], [teardownStop('S-A1', ORDER)]],
      },
    ]);

    // Without the replay, the replaced security maps to nothing.
    expect(planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex }).unmapped).toEqual([
      {
        stop: teardownStop('S-A1', ORDER),
        reason: 'not_on_new_book',
        message: 'Security S-A1 has no active state on the new book test-2',
        securityIds: ['S-A1'],
      },
    ]);

    // A derived security the new book does not hold yet.
    const behind = book(NEW, (b) => b.state(lot('S-A3')));
    expect(planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex: behind, replay }).unmapped).toEqual([
      {
        stop: teardownStop('S-A1', ORDER),
        reason: 'not_on_new_book',
        message:
          'The securities the replayed source derives from S-A1 (S-A3, S-C1) are not all on the new book test-2: S-C1 ' +
          'has no active state',
        securityIds: ['S-C1'],
      },
    ]);
  });

  it('places one lot for the stops of one reference that a consolidation merges', () => {
    const replay = replayOf(consolidation('CO-1', ['S-A1', 'S-A2'], 'S-K'), out('S-K', 'SH-A', '1000'));
    const second = stopHold('ORDER-1', derived('S-A2', 0, 'hold'));
    const oldIndex = tornDown((b) => stopped(stopped(b, 'S-A1', ORDER), 'S-A2', second));
    const newIndex = book(NEW, (b) => b.state(lot('S-K')));

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex, replay });

    expect(plan.placements).toEqual([
      {
        reference: 'ORDER-1',
        reasonText: 'Court order ORDER-1',
        lots: [{ security_id: 'S-K' }],
        stops: [[teardownStop('S-A1', ORDER), teardownStop('S-A2', second)]],
      },
    ]);
  });

  it('groups the stops of one reference and reason into placements of at most 50 lots', () => {
    const ids = Array.from({ length: 51 }, (_, n) => `S-${String(n).padStart(2, '0')}`);
    const oldIndex = tornDown((b) => {
      for (const id of ids) stopped(b, id, stopHold('ORDER-9', `HOLD-${id}`), 'Order 9');
      stopped(b, 'S-X1', stopHold('ORDER-9', 'HOLD-S-X1'), 'Order 9, amended');
      stopped(b, 'S-X2', stopHold('CASE-1', 'HOLD-S-X2'), 'Case 1');
    });
    const newIndex = book(NEW, (b) => {
      for (const id of [...ids, 'S-X1', 'S-X2']) b.state(lot(id));
    });

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex });

    expect(plan.unmapped).toEqual([]);
    expect(
      plan.placements.map((placement) => [placement.reference, placement.reasonText, placement.lots.length])
    ).toEqual([
      ['CASE-1', 'Case 1', 1],
      ['ORDER-9', 'Order 9', 50],
      ['ORDER-9', 'Order 9', 1],
      ['ORDER-9', 'Order 9, amended', 1],
    ]);
    expect(plan.placements[1]?.lots[0]).toEqual({ security_id: 'S-00' });
    expect(plan.placements[2]?.lots).toEqual([{ security_id: 'S-50' }]);
  });

  it('skips a stop the new book already carries, so planning again places only the rest', () => {
    const second = stopHold('ORDER-2', 'HOLD-S-A2');
    const oldIndex = tornDown((b) => stopped(stopped(b, 'S-A1', ORDER), 'S-A2', second));
    const newIndex = book(NEW, (b) => b.state(lot('S-A1', [stopHold('ORDER-1', 'NEW-HOLD-1')])).state(lot('S-A2')));

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex });

    expect(plan.placed).toEqual([{ stop: teardownStop('S-A1', ORDER), securityIds: ['S-A1'] }]);
    expect(plan.placements.map((placement) => placement.lots)).toEqual([[{ security_id: 'S-A2' }]]);
  });

  it('reports each stop it cannot place, with the reason', () => {
    const replay = replayOf(
      issuance('S-X', 'SH-A', 'CLS-A', '100', D2024),
      cancellation('CN-1', 'S-X', '100', null),
      issuance('S-Z', 'SH-A', 'CLS-A', '100', D2024)
    );
    const holds = {
      full: stopHold('R-F', 'HOLD-F'),
      missing: stopHold('R-M', 'HOLD-M'),
      inUse: stopHold('R-U', 'HOLD-U'),
      retired: stopHold('R-X', 'HOLD-X'),
      unknown: stopHold('R-Y', 'HOLD-Y'),
      behind: stopHold('R-Z', 'HOLD-Z'),
    };
    const oldIndex = tornDown((b) => {
      stopped(b, 'S-F', holds.full);
      b.state(lot('S-M', [holds.missing]));
      stopped(b, 'S-U', holds.inUse);
      stopped(b, 'S-X', holds.retired);
      stopped(b, 'S-Y', holds.unknown);
      stopped(b, 'S-Z', holds.behind);
    });
    const thirtyTwo = Array.from({ length: 32 }, (_, n) => stopHold(`OTHER-${n}`, `HOLD-OTHER-${n}`));
    const newIndex = book(NEW, (b) =>
      b
        .state(lot('S-F', thirtyTwo))
        .state(lot('S-M'))
        .state(lot('S-U', [settlementHold('R-U', 'HOLD-TRADE')]))
    );

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex, replay });

    expect(plan.placements).toEqual([]);
    expect(plan.unmapped.map(({ stop, reason, securityIds }) => [stop.securityId, reason, securityIds])).toEqual([
      ['S-F', 'hold_limit', ['S-F']],
      ['S-M', 'hold_record_missing', []],
      ['S-U', 'reference_in_use', ['S-U']],
      ['S-X', 'retired', []],
      ['S-Y', 'not_in_source', []],
      ['S-Z', 'not_on_new_book', ['S-Z']],
    ]);
    expect(plan.unmapped.map((unmapped) => unmapped.message)).toEqual([
      'S-F would carry more than 32 holds on the new book',
      "The old book's index does not hold HOLD-M, the TX_STOCK_HOLD of stop R-M on S-M",
      'Reference R-U is open as a settlement hold on S-U on the new book',
      'The replayed source retires security S-X by CN-1 and derives no security from it',
      'Security S-Y is neither on the new book test-2 nor in its replayed source',
      'Security S-Z has no active state on the new book test-2',
    ]);
    expect(plan.stops.find((stop) => stop.securityId === 'S-M')?.reasonText).toBeNull();
  });

  it('counts the holds it adds to a security against the 32 a security carries', () => {
    const oldIndex = tornDown((b) =>
      stopped(stopped(b, 'S-A1', stopHold('R-1', 'HOLD-1')), 'S-A2', stopHold('R-2', 'HOLD-2'))
    );
    const replay = replayOf(consolidation('CO-1', ['S-A1', 'S-A2'], 'S-K'), out('S-K', 'SH-A', '1000'));
    const thirtyOne = Array.from({ length: 31 }, (_, n) => stopHold(`OTHER-${n}`, `HOLD-OTHER-${n}`));
    const newIndex = book(NEW, (b) => b.state(lot('S-K', thirtyOne)));

    const plan = planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex, replay });

    expect(plan.placements.map((placement) => [placement.reference, placement.lots])).toEqual([
      ['R-1', [{ security_id: 'S-K' }]],
    ]);
    expect(plan.unmapped.map(({ stop, reason }) => [stop.reference, reason])).toEqual([['R-2', 'hold_limit']]);
  });

  it('refuses an old book still Active, a new book that is not, an old index without payloads and one book twice', () => {
    const newIndex = book(NEW, (b) => b.state(lot('S-A1')));
    expectThrowsClassified(
      () => planStopReplacement({ oldIndexAtTeardown: book(OLD, (b) => stopped(b, 'S-A1', ORDER)), newIndex }),
      'teardown_not_begun'
    );
    const oldIndex = tornDown((b) => stopped(b, 'S-A1', ORDER));
    expectThrowsClassified(
      () =>
        planStopReplacement({
          oldIndexAtTeardown: oldIndex,
          newIndex: book(NEW, () => {}, { status: 'TEARING_DOWN' }),
        }),
      'new_book_not_active'
    );
    const bare = anchored(new RegisterIndex({ context: OLD, offset: 20, retainPayloads: false }), 'TEARING_DOWN');
    expectThrowsClassified(
      () => planStopReplacement({ oldIndexAtTeardown: bare, newIndex }),
      'register_payload_required'
    );
    expectThrowsClassified(
      () => planStopReplacement({ oldIndexAtTeardown: oldIndex, newIndex: oldIndex }),
      'same_book'
    );
    expectThrowsClassified(
      () => planStopReplacement({ oldIndexAtTeardown: book(OLD, () => {}, { status: null }), newIndex }),
      'register_anchor_not_found'
    );
  });
});

describe('reconcileStops', () => {
  const ORDER = stopHold('ORDER-1', derived('S-A1', 0, 'hold'));
  const oldIndex = (): RegisterIndex => book(OLD, (b) => stopped(b, 'S-A1', ORDER), { status: 'TEARING_DOWN' });
  const replay = (): ReplayResult =>
    replayOf(transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A3'), out('S-B1', 'SH-B', '200'), out('S-A3', 'SH-A', '400'));
  const placedOn = (securityId: string): StockSecurityState =>
    lot(securityId, [stopHold('ORDER-1', `NEW-${securityId}`)]);

  it('matches every open stop of the old book on the new book', () => {
    const same = reconcileStops(
      oldIndex(),
      book(NEW, (b) => b.state(placedOn('S-A1')))
    );
    expect(same).toEqual({
      reconciled: true,
      matched: [{ stop: teardownStop('S-A1', ORDER), securityIds: ['S-A1'] }],
      mismatches: [],
    });

    const derivedOnes = reconcileStops(
      oldIndex(),
      book(NEW, (b) => b.state(placedOn('S-B1')).state(placedOn('S-A3'))),
      {
        replay: replay(),
      }
    );
    expect(derivedOnes.reconciled).toBe(true);
    expect(derivedOnes.matched).toEqual([{ stop: teardownStop('S-A1', ORDER), securityIds: ['S-B1', 'S-A3'] }]);
  });

  it('reports a security that lacks the stop, or holds it only as a settlement reference', () => {
    const newIndex = book(NEW, (b) =>
      b.state(placedOn('S-B1')).state(lot('S-A3', [settlementHold('ORDER-1', 'HOLD-TRADE')]))
    );

    const reconciliation = reconcileStops(oldIndex(), newIndex, { replay: replay() });

    expect(reconciliation).toEqual({
      reconciled: false,
      matched: [],
      mismatches: [
        {
          stop: teardownStop('S-A1', ORDER),
          reason: 'missing_stop',
          message: 'Stop ORDER-1 of security S-A1 is not open on S-A3 on the new book test-2',
          securityIds: ['S-A3'],
        },
      ],
    });
  });

  it('reports a stop no security of the new book maps to', () => {
    const reconciliation = reconcileStops(
      oldIndex(),
      book(NEW, (b) => b.state(placedOn('S-A3')))
    );

    expect(reconciliation.reconciled).toBe(false);
    expect(reconciliation.mismatches).toEqual([
      {
        stop: teardownStop('S-A1', ORDER),
        reason: 'not_on_new_book',
        message: 'Security S-A1 has no active state on the new book test-2',
        securityIds: ['S-A1'],
      },
    ]);
  });

  it('refuses an old book still Active', () => {
    expectThrowsClassified(
      () =>
        reconcileStops(
          book(OLD, (b) => stopped(b, 'S-A1', ORDER)),
          book(NEW)
        ),
      'teardown_not_begun'
    );
  });
});

describe('planPurge', () => {
  /** A torn-down book of exactly `total` contracts besides its anchor: the base book, stakeholders and 256 shards. */
  function bookOf(total: number, status: CapTableStatus = 'TEARING_DOWN'): RegisterIndex {
    const index = book(
      OLD,
      (b) => {
        b.state(lot('S-A1'));
        for (let n = 0; n < total - 262; n += 1) b.record('stakeholder', stakeholder(`SH-P-${n}`));
      },
      { status }
    );
    const { records, states, epochs, shards } = index.counts();
    expect(records + states + epochs + shards).toBe(total);
    return index;
  }

  const purgedTargets = (command: { command: unknown }) =>
    decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Purge, exerciseOf(command).choiceArgument).targets;

  it('purges 500 contracts in one CapTable_Purge, then closes, as system_operator', () => {
    const plan = planPurge(bookOf(500));

    expect(plan).toMatchObject({
      capTableId: 'test-1',
      status: 'ready',
      capTableContractId: 'anchor-test-1',
      systemOperator: OLD.system_operator,
      unreadable: [],
    });
    expect(plan.batches.map((batch) => batch.targets.length)).toEqual([500]);
    expect(plan.commands.map((command) => exerciseOf(command).choice)).toEqual(['CapTable_Purge', 'CapTable_Close']);
    for (const command of plan.commands) {
      expect(command.actAs).toEqual([OLD.system_operator]);
      expect(exerciseOf(command).contractId).toBe('anchor-test-1');
    }
    const [purge] = plan.commands;
    if (purge === undefined) throw new Error('no purge');
    expect(purgedTargets(purge)).toHaveLength(500);

    // Records first, then states, epochs and shards.
    const kinds = plan.batches[0]?.targets.map((target) => target.kind) ?? [];
    expect(kinds.filter((kind, position) => kind !== kinds[position - 1])).toEqual([
      'record',
      'state',
      'epoch',
      'shard',
    ]);
    expect(plan.batches[0]?.targets[0]).toEqual({ kind: 'record', entityType: 'stakeholder', contractId: 'cid-SH-A' });
  });

  it('purges 501 contracts in two CapTable_Purge of 500 and 1', () => {
    const plan = planPurge(bookOf(501));

    expect(plan.batches.map((batch) => batch.targets.length)).toEqual([500, 1]);
    expect(plan.commands.map((command) => exerciseOf(command).choice)).toEqual([
      'CapTable_Purge',
      'CapTable_Purge',
      'CapTable_Close',
    ]);
    const [, second] = plan.commands;
    if (second === undefined) throw new Error('no second purge');
    expect(purgedTargets(second)).toHaveLength(1);
  });

  it('keeps each purge within the byte budget', () => {
    const index = bookOf(300);
    const plan = planPurge(index, { byteBudget: 20_000, capTableTemplateId: ANCHOR_TEMPLATE_ID });

    expect(plan.batches.length).toBeGreaterThan(1);
    for (const batch of plan.batches) expect(batch.bytes <= 20_000 || batch.targets.length === 1).toBe(true);
    expect(plan.batches.reduce((total, batch) => total + batch.targets.length, 0)).toBe(300);
    expect(exerciseOf(plan.commands[0] ?? { command: {} }).templateId).toBe(ANCHOR_TEMPLATE_ID);
    expect(() => planPurge(index, { byteBudget: 0 })).toThrow("Validation error at 'byteBudget'");
  });

  it('only closes a torn-down book with nothing left, and plans nothing for a closed one', () => {
    const empty = anchored(new RegisterIndex({ context: OLD, offset: 20 }), 'TEARING_DOWN');
    expect(planPurge(empty).commands.map((command) => exerciseOf(command).choice)).toEqual(['CapTable_Close']);

    const closed = planPurge(bookOf(300, 'CLOSED'));
    expect(closed).toMatchObject({ status: 'closed', batches: [], commands: [] });
  });

  it('does not close a book holding contracts the SDK cannot read', () => {
    const index = bookOf(300);
    index.addUnreadable({
      contractId: 'cid-later-upgrade',
      templateId: null,
      packageName: 'OpenCapTable-v35',
      capTableId: 'test-1',
      reason: 'invalid_payload',
      message: 'the payload does not decode',
    });

    const plan = planPurge(index);

    expect(plan.status).toBe('unreadable');
    expect(plan.unreadable).toEqual(['cid-later-upgrade']);
    expect(plan.commands.map((command) => exerciseOf(command).choice)).toEqual(['CapTable_Purge']);
  });

  it('refuses an Active book and a book without an anchor', () => {
    expectThrowsClassified(() => planPurge(bookOf(300, 'ACTIVE')), 'teardown_not_begun');
    expectThrowsClassified(
      () => planPurge(new RegisterIndex({ context: OLD, offset: 20 })),
      'register_anchor_not_found'
    );
  });
});
