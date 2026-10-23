/**
 * Replication end to end over a simulated ledger: a fresh book from the production fixtures, every record created and
 * the split recorded by the split procedure; a second run that writes nothing; corrections restating, ending and
 * recreating lots, the recreated state's `seq` read from the ledger; derived-form trade records skipped, and a
 * settlement's new buyer kept until apiv2 reads it back; a delete the writer's references check refuses, refused in
 * the plan, and a document moved to a new stakeholder with the delete it repairs; bulk corrections written in several
 * restatements the writer accepts (vesting terms with the vesting records naming their conditions, stock issuances
 * whose edits move no ceiling, renames of the class and holder they name, vesting terms edited in what no vesting record
 * reads of their conditions, and a plan, class or vesting terms edited in what the records naming them do not read,
 * written apart from them, lots whose new quantities move a ceiling written apart, and a duplicate holder's lots moved
 * off it before its delete); a run that plans again after a failed step; and a restatement planned again when its lot
 * changed after it was planned.
 */

import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import { mapOcfObjectTypeToEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { stockSecurityWire } from '../../src/register/bookSimulation';
import { executeReplication } from '../../src/register/replication/execute';
import { planReplication } from '../../src/register/replication/plan';
import type {
  ReplicationError,
  ReplicationPlan,
  ReplicationProgress,
  ReplicationSource,
} from '../../src/register/replication/types';
import type { OcfIssuer } from '../../src/types/native';
import { buildOcfManifest } from '../../src/utils/cantonOcfExtractor';
import { ocfDeepEqual } from '../../src/utils/ocfComparison';
import { normalizeOcfData } from '../../src/utils/planSecurityAliases';
import { document, stockPlan, vestingStart, vestingTerms, warrantIssuance } from './bookFixtures';
import { option } from './checkFixtures';
import { damlData, recordEvent, stateEvent } from './registerLedgerFixtures';
import {
  acceptance,
  D2024,
  derived,
  issuance,
  issuer,
  manifestOf,
  out,
  stakeholder,
  standardBook,
  stockClass,
  transfer,
  type OcfJson,
} from './replayFixtures';
import { productionBook, productionIssuer, productionRecords, SPLIT_ID } from './replicationFixtures';
import { SimulatedLedger } from './simulatedLedger';

async function plan(ledger: SimulatedLedger, source: ReplicationSource): Promise<ReplicationPlan> {
  const writer = ledger.writer();
  await writer.refresh();
  return planReplication({ source, index: writer.index, options: { ledger: ledger.ledger.asClient() } });
}

/** Replicate a source into the ledger's book with a writer of its own; returns the writer. */
async function replicate(ledger: SimulatedLedger, source: ReplicationSource) {
  const writer = ledger.writer();
  await writer.refresh();
  const planned = await planReplication({ source, index: writer.index, options: { ledger: ledger.ledger.asClient() } });
  const result = await executeReplication(writer, planned);
  return { writer, planned, result };
}

const json = (record: object): OcfJson => record as OcfJson;

function standardLedger(): SimulatedLedger {
  const ledger = new SimulatedLedger();
  ledger.setup(issuer() as unknown as OcfIssuer);
  return ledger;
}

function stateOf(ledger: SimulatedLedger, securityId: string) {
  return ledger.book.stateOf(securityId)?.state ?? null;
}

describe('executeReplication: a fresh book from the production fixtures', () => {
  it('creates every record in replay order, the split by the split procedure, and a second run writes nothing', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());

    const { planned, result, writer } = await replicate(ledger, productionBook());

    expect(planned.status).toBe('ready');
    expect(planned.violation).toBeNull();
    expect(planned.refusals).toEqual([]);
    expect(planned.diff.creates).toHaveLength(productionRecords().length - 1);
    expect(planned.steps.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);
    // Definitions first, the stock dated before the split, the split, then everything dated on or after it.
    expect(planned.steps[0]).toMatchObject({
      kind: 'apply',
      recordIds: [
        'test-stakeholder-individual-001',
        'test-stakeholder-institution-001',
        'test-vesting-terms-001',
        'test-legend-001',
        'test-stock-class-common-001',
        'test-stock-class-preferred-001',
        'test-stock-plan-001',
      ],
    });
    expect(planned.steps[1]?.kind === 'apply' ? planned.steps[1].recordIds : []).toEqual([
      'test-stock-issuance-founders-001',
      'test-convertible-note-001',
      'test-stock-issuance-vesting-001',
    ]);
    expect(planned.steps[2]).toMatchObject({ kind: 'split', recordIds: [SPLIT_ID] });
    const last = planned.steps[3];
    const lastIds = last?.kind === 'apply' ? last.recordIds : [];
    // A valuation is written on its effective date, after the split of its class.
    expect(lastIds.indexOf('test-valuation-001')).toBeGreaterThan(lastIds.indexOf('test-stock-plan-pool-adj-001'));
    expect(lastIds.indexOf('test-valuation-001')).toBeLessThan(lastIds.indexOf('test-equity-comp-exercise-001'));
    expect(lastIds[lastIds.length - 1]).toBe('test-document-001');

    expect(ledger.choices()).toEqual([
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_FreezeClass',
      'CapTable_Apply',
      'CapTable_UnfreezeClass',
      'CapTable_Apply',
    ]);
    expect(result).toMatchObject({ transactions: 6, replans: 1, plan: { status: 'current', steps: [] } });
    expect(result.committed).toHaveLength(4);
    expect(result.executed.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);

    // The book holds every source record as the source has it.
    const exported = buildOcfManifest(writer.index);
    const source = productionRecords().map((record) => normalizeOcfData(record));
    const onBook = [
      exported.issuer,
      ...exported.stakeholders,
      ...exported.stockClasses,
      ...exported.stockPlans,
      ...exported.vestingTerms,
      ...exported.valuations,
      ...exported.documents,
      ...exported.financings,
      ...exported.stockLegendTemplates,
      ...exported.transactions,
    ].map((record) => normalizeOcfData(record));
    expect(onBook).toHaveLength(source.length);
    for (const record of source) {
      const match = onBook.find((candidate) => candidate.id === record.id);
      expect(match !== undefined && ocfDeepEqual(record, match)).toBe(true);
    }
    // The transfer applied the split to its source at its own date: 1,000,000 became 10,000,000.
    expect(stateOf(ledger, 'test-security-transfer-balance-001')).toMatchObject({ quantity: '9950000' });
    expect(writer.index.epochOf('test-stock-class-common-001')?.epoch).toMatchObject({
      frozen: false,
      splits: [{ split_id: SPLIT_ID, date: '2024-06-15' }],
    });

    const again = await plan(ledger, productionBook());
    expect(again).toMatchObject({ status: 'current', steps: [], refusals: [], violation: null });
    expect(again.diff.total).toBe(0);
    const submitted = ledger.ledger.submitted.length;
    const noop = await executeReplication(ledger.writer(), again);
    expect(noop).toMatchObject({ transactions: 0, replans: 0, executed: [] });
    expect(ledger.ledger.submitted).toHaveLength(submitted);
  });

  it('reports each step and plan, and plans the same from the source as items', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    const writer = ledger.writer();
    await writer.refresh();
    const items = productionRecords().map((data) => ({
      entityType: mapOcfObjectTypeToEntityType(String(data.object_type)) ?? 'issuer',
      data,
    }));
    const planned = await planReplication({ source: items, index: writer.index });
    const fromManifest = await planReplication({ source: productionBook(), index: writer.index });
    expect(planned.steps).toEqual(fromManifest.steps);
    const progress: ReplicationProgress[] = [];
    await executeReplication(writer, planned, {
      onProgress: (event) => {
        progress.push(event);
        throw new Error('ignored');
      },
    });
    expect(progress.map((event) => [event.phase, event.plan, event.step, event.kind])).toEqual([
      ['step', 1, 0, 'apply'],
      ['step', 1, 1, 'apply'],
      ['step', 1, 2, 'split'],
      ['step', 1, 3, 'apply'],
      ['replan', 2, 0, null],
    ]);
    expect(progress[4]?.transactions).toBe(6);
  });

  it('plans again from the updated index after a failed step, and resumes where the book stands', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    // The definitions commit; the next Apply is refused, as a concurrent write could have it refused.
    ledger.ledger.next({ outcome: 'commit' }, { outcome: 'reject', message: 'contract not active' });

    const { result } = await replicate(ledger, productionBook());

    expect(result.plan.status).toBe('current');
    expect(result.replans).toBe(2);
    expect(ledger.choices()).toEqual([
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_FreezeClass',
      'CapTable_Apply',
      'CapTable_UnfreezeClass',
      'CapTable_Apply',
    ]);
    expect(result.transactions).toBe(6);
  });

  it('stops on a failure planning again cannot help, carrying what it wrote', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    ledger.ledger.next({ outcome: 'reject', message: 'ID already used' });

    const error = (await replicate(ledger, productionBook()).catch((caught: unknown) => caught)) as ReplicationError;

    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({ code: OcpErrorCodes.CHOICE_FAILED });
    expect(error.replication).toMatchObject({ transactions: 0, replans: 0, executed: [] });
  });

  it('stops at once on an unknown outcome, which the writer must reconcile first', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    ledger.ledger.next({ outcome: 'commit' }, { outcome: 'unknown' });

    const error = (await replicate(ledger, productionBook()).catch((caught: unknown) => caught)) as ReplicationError;

    expect(error).toMatchObject({ code: OcpErrorCodes.OUTCOME_UNKNOWN, classification: 'unresolved_command' });
    expect(error.replication).toMatchObject({ transactions: 1, replans: 0 });
  });

  it('refuses a plan of another book', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    const planned = await plan(ledger, productionBook());
    await expect(executeReplication(ledger.writer(), { ...planned, capTableId: 'other' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'plan',
    });
  });
});

describe('executeReplication: corrections', () => {
  it('restates a lot whose issuance is edited, and the next run writes nothing', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const corrected = standardBook();
    const s1 = corrected.transactions.find((record) => record.id === 'ISS-S-A1') as OcfJson;
    s1.quantity = '650';

    const planned = await plan(ledger, corrected);

    expect(planned.status).toBe('ready');
    expect(planned.diff.edits.map((item) => item.id)).toEqual(['ISS-S-A1']);
    expect(planned.steps).toEqual([
      expect.objectContaining({
        kind: 'restate',
        recordIds: ['ISS-S-A1'],
        securityIds: ['S-A1'],
        operations: [
          expect.objectContaining({ kind: 'edit', type: 'stockIssuance' }),
          {
            kind: 'setState',
            state: expect.objectContaining({ security_id: 'S-A1', quantity: '650', accelerated_since_snapshot: null }),
          },
        ],
      }),
    ]);
    const seqBefore = stateOf(ledger, 'S-A1')?.seq ?? -1;
    const result = await executeReplication(ledger.writer(), planned);

    expect(result.plan.status).toBe('current');
    expect(ledger.choices()[ledger.choices().length - 1]).toBe('CapTable_Restate');
    expect(stateOf(ledger, 'S-A1')).toMatchObject({ quantity: '650', seq: seqBefore + 1 });
    expect(ledger.book.record('ISS-S-A1')?.data).toMatchObject({ quantity: '650' });
  });

  it('restates a lot whose issuance is moved to another class, and the next run writes nothing', async () => {
    const ledger = standardLedger();
    const base = [
      issuer(),
      stakeholder('SH-A'),
      stockClass('CLS-A'),
      stockClass('CLS-X', { default_id_prefix: 'CX-' }),
    ];
    const lot = issuance('S-1', 'SH-A', 'CLS-X', '10', D2024);
    await replicate(ledger, manifestOf([...base, lot]));
    const moved = manifestOf([...base, { ...lot, stock_class_id: 'CLS-A' }]);

    const planned = await plan(ledger, moved);

    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    expect(planned.diff.edits.map((item) => item.id)).toEqual(['ISS-S-1']);
    expect(planned.steps).toEqual([
      expect.objectContaining({ kind: 'restate', recordIds: ['ISS-S-1'], securityIds: ['S-1'] }),
    ]);
    const result = await executeReplication(ledger.writer(), planned);

    expect(result.plan.status).toBe('current');
    expect(stateOf(ledger, 'S-1')?.stock_class_id).toBe('CLS-A');
    expect(ledger.book.record('ISS-S-1')?.data).toMatchObject({ stock_class_id: 'CLS-A' });
    await expect(plan(ledger, moved)).resolves.toMatchObject({ status: 'current', steps: [] });
  });

  it('ends a lot whose issuance is deleted', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const corrected = standardBook();
    corrected.transactions = corrected.transactions.filter((record) => record.id !== 'ISS-S-A2');

    const planned = await plan(ledger, corrected);

    expect(planned.steps).toEqual([
      expect.objectContaining({
        kind: 'restate',
        operations: [
          { kind: 'delete', objectId: 'ISS-S-A2' },
          { kind: 'endState', securityId: 'S-A2' },
        ],
      }),
    ]);
    const result = await executeReplication(ledger.writer(), planned);
    expect(result.plan.status).toBe('current');
    expect(stateOf(ledger, 'S-A2')).toBeNull();
    expect(ledger.book.record('ISS-S-A2')).toBeNull();
  });

  it.each([
    ['in a later transaction, from the consumed state', true],
    ['in the transaction that created the state, from the operations before it', false],
  ])(
    'recreates the source of a deleted transfer with the ledger seq + 1, the state ended %s',
    async (_label, separately) => {
      const ledger = standardLedger();
      const accepted = standardBook(acceptance('ACC-1', 'S-A1', '2024-02-01'));
      const withTransfer = standardBook(
        acceptance('ACC-1', 'S-A1', '2024-02-01'),
        transfer('TR-1', 'S-A1', '600', ['S-B1'], null),
        out('S-B1', 'SH-B', '600')
      );
      if (separately) await replicate(ledger, accepted);
      await replicate(ledger, withTransfer);
      expect(stateOf(ledger, 'S-A1')).toBeNull();

      const planned = await plan(ledger, accepted);

      expect(planned.status).toBe('ready');
      const [step] = planned.steps;
      expect(step).toMatchObject({ kind: 'restate', recordIds: ['ISS-S-B1', 'TR-1'], securityIds: ['S-B1', 'S-A1'] });
      // The ended state had seq 1 (the acceptance's); its recreation takes 2, which no event derived an ID at.
      expect(step?.kind === 'restate' ? step.operations : []).toEqual([
        { kind: 'delete', objectId: 'ISS-S-B1' },
        { kind: 'delete', objectId: 'TR-1' },
        { kind: 'endState', securityId: 'S-B1' },
        {
          kind: 'setState',
          state: expect.objectContaining({
            security_id: 'S-A1',
            quantity: '600',
            last_event_date: '2024-02-01',
            origin_transaction_id: 'ISS-S-A1',
            seq: 2,
          }),
        },
      ]);
      const result = await executeReplication(ledger.writer(), planned);
      expect(result.plan.status).toBe('current');
      expect(stateOf(ledger, 'S-A1')).toMatchObject({ quantity: '600', seq: 2 });
      expect(stateOf(ledger, 'S-B1')).toBeNull();
      expect(ledger.book.record('TR-1')).toBeNull();
    }
  );

  it('plans a restatement again when the TA records a snapshot on its lot after it was planned', async () => {
    const ledger = standardLedger();
    const terms: OcfJson = { ...vestingTerms('VT-1') };
    const onTerms = (quantity: string): OcfJson =>
      issuance('S-V1', 'SH-A', 'CLS-A', quantity, D2024, { vesting_terms_id: 'VT-1' });
    await replicate(ledger, standardBook(terms, onTerms('1000')));
    const ta = ledger.writer();
    await ta.refresh();
    await ta.apply([{ kind: 'vestingSnapshot', securityId: 'S-V1', asOf: D2024, vested: '100' }]);

    const planned = await plan(ledger, standardBook(terms, onTerms('900')));
    const [step] = planned.steps;
    expect(step).toMatchObject({
      kind: 'restate',
      basis: [
        { kind: 'state', id: 'S-V1', contractId: ledger.book.stateOf('S-V1')?.contractId },
        { kind: 'record', id: 'ISS-S-V1', contractId: ledger.book.record('ISS-S-V1')?.contractId },
      ],
      operations: [
        expect.objectContaining({ kind: 'edit' }),
        {
          kind: 'setState',
          state: expect.objectContaining({ quantity: '900', snapshot: { as_of: D2024, vested: '100' } }),
        },
      ],
    });

    // The TA records a newer snapshot once the run has begun, before the restatement is written.
    let recorded = false;
    const result = await executeReplication(ledger.writer(), planned, {
      onProgress: ({ phase, kind }) => {
        if (recorded || phase !== 'step' || kind !== 'restate') return;
        recorded = true;
        const current = ledger.book.stateOf('S-V1');
        if (current === null) throw new Error('S-V1 has no state');
        const { context: _context, ...payload } = stockSecurityWire({
          ...current.state,
          seq: current.state.seq + 1,
          snapshot: { as_of: D2024, vested: '300' },
          accelerated_since_snapshot: null,
        });
        ledger.ledger.commit({ archived: [current.contractId], created: [stateEvent('cid-ta-snapshot', payload)] });
      },
    });

    expect(recorded).toBe(true);
    expect(result.plan.status).toBe('current');
    expect(result.replans).toBe(2);
    expect(result.executed.map((executed) => executed.kind)).toEqual(['restate']);
    // The newer snapshot stands: the restatement planned before it was never written over it.
    expect(stateOf(ledger, 'S-V1')).toMatchObject({ quantity: '900', snapshot: { as_of: D2024, vested: '300' } });
    const restatements = ledger.ledger.submitted.filter(
      (submission) =>
        (submission.commands as Array<{ ExerciseCommand?: { choice?: string } }>)[0]?.ExerciseCommand?.choice ===
        'CapTable_Restate'
    );
    expect(restatements).toHaveLength(1);
  });

  it('skips the trade records a register choice wrote, and never edits or deletes them', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    // CapTable_Settle drew all of S-A2 for SH-B: the transfer, the buyer's issuance and state, all in derived form.
    const transferId = derived('S-A2', 0, 'event');
    const buyerIssuance = derived('S-A2', 0, 'resulting_issuance');
    const buyerSecurity = derived('S-A2', 0, 'resulting_security');
    const trade = transfer(transferId, 'S-A2', '400', [buyerSecurity], null, '2024-05-01');
    const bought = { ...issuance(buyerSecurity, 'SH-B', 'CLS-A', '400', '2024-05-01'), id: buyerIssuance };
    ledger.ledger.commit({
      archived: [ledger.book.stateOf('S-A2')?.contractId ?? ''],
      created: [
        recordEvent('cid-trade', 'stockTransfer', damlData('stockTransfer', trade)),
        recordEvent('cid-bought', 'stockIssuance', damlData('stockIssuance', bought)),
        stateEvent('cid-bought-state', {
          security_id: buyerSecurity,
          issue_date: '2024-05-01',
          last_event_date: '2024-05-01',
          origin_transaction_id: buyerIssuance,
          quantity: '400.0000000000',
          seq: '0',
          stakeholder_id: 'SH-B',
          stock_class_id: 'CLS-A',
          holds: [],
          derived_ids: false,
        }),
      ],
    });

    // apiv2 read the trade back, with an edited comment on the transfer; the source never had the buyer's issuance.
    const readBack = standardBook({ ...trade, comments: ['edited in PostgreSQL'] });
    const planned = await plan(ledger, readBack);

    expect(planned.status).toBe('current');
    expect(planned.steps).toEqual([]);
    expect(planned.diff).toMatchObject({ creates: [], edits: [], deletes: [] });
    expect(planned.notices).toEqual([
      expect.objectContaining({ kind: 'derived_form_differs', id: transferId, entityType: 'stockTransfer' }),
    ]);

    const unchanged = await plan(ledger, standardBook(trade, bought));
    expect(unchanged.status).toBe('current');
    expect(unchanged.notices.map((notice) => [notice.kind, notice.id])).toEqual([
      ['derived_form_skipped', transferId],
      ['derived_form_skipped', buyerIssuance],
    ]);
    // The buyer's issuance read back in another class differs from the book's.
    const reclassed = await plan(ledger, standardBook(trade, { ...bought, stock_class_id: 'CLS-X' }));
    expect(reclassed.notices.map((notice) => [notice.kind, notice.id])).toEqual([
      ['derived_form_skipped', transferId],
      ['derived_form_differs', buyerIssuance],
    ]);

    const missing = derived('S-A1', 0, 'event');
    const unknown = await plan(ledger, standardBook(transfer(missing, 'S-A1', '600', ['S-X'], null)));
    expect(unknown.notices).toEqual([expect.objectContaining({ kind: 'derived_form_missing', id: missing })]);
  });

  describe("keeps a settlement's new buyer that apiv2 has not read back yet", () => {
    const buyerIssuance = derived('S-A2', 0, 'resulting_issuance');
    const buyerSecurity = derived('S-A2', 0, 'resulting_security');

    /** The standard book, and a settlement of S-A2 to a new buyer SH-NEW, whose stakeholder it claimed. */
    async function settledToNewBuyer(): Promise<SimulatedLedger> {
      const ledger = standardLedger();
      await replicate(ledger, standardBook());
      // CapTable_Settle with SettleBuyerNew claims the buyer's ID as Apply claims any writer-chosen one.
      const writer = ledger.writer();
      await writer.refresh();
      await writer.apply([{ kind: 'record', type: 'stakeholder', data: stakeholder('SH-NEW') as never }], {
        checks: false,
      });
      const trade = transfer(derived('S-A2', 0, 'event'), 'S-A2', '400', [buyerSecurity], null, '2024-05-01');
      const bought = { ...issuance(buyerSecurity, 'SH-NEW', 'CLS-A', '400', '2024-05-01'), id: buyerIssuance };
      ledger.ledger.commit({
        archived: [ledger.book.stateOf('S-A2')?.contractId ?? ''],
        created: [
          recordEvent('cid-trade', 'stockTransfer', damlData('stockTransfer', trade)),
          recordEvent('cid-bought', 'stockIssuance', damlData('stockIssuance', bought)),
          stateEvent('cid-bought-state', {
            security_id: buyerSecurity,
            issue_date: '2024-05-01',
            last_event_date: '2024-05-01',
            origin_transaction_id: buyerIssuance,
            quantity: '400.0000000000',
            seq: '0',
            stakeholder_id: 'SH-NEW',
            stock_class_id: 'CLS-A',
            holds: [],
            delivery: { reference: 'trade-1', seller_stakeholder_id: 'SH-A', transfer_id: trade.id as string },
            derived_ids: false,
          }),
        ],
      });
      return ledger;
    }

    it.each([
      ['on', true],
      ['off', false],
    ])('never deletes it, with the writer checks %s', async (_label, checks) => {
      const ledger = await settledToNewBuyer();
      // PostgreSQL has not read the trade back, and has a new stakeholder of its own to replicate.
      const planned = await plan(ledger, standardBook(stakeholder('SH-C')));

      expect(planned.status).toBe('ready');
      expect(planned.diff).toMatchObject({
        creates: [expect.objectContaining({ id: 'SH-C' })],
        edits: [],
        deletes: [],
      });
      expect(planned.steps.map((step) => step.kind)).toEqual(['apply']);
      expect(planned.notices).toEqual([
        expect.objectContaining({
          kind: 'register_named_kept',
          id: 'SH-NEW',
          entityType: 'stakeholder',
          message: expect.stringContaining(`names it: it is never deleted`) as unknown,
        }),
      ]);

      const writer = ledger.writer();
      await writer.refresh();
      const result = await executeReplication(writer, planned, { checks });
      expect(result.plan.status).toBe('current');
      expect(result.executed.map((step) => step.kind)).toEqual(['apply']);
      expect(ledger.book.record('SH-NEW')).not.toBeNull();
      expect(ledger.book.record('SH-C')).not.toBeNull();
      expect(stateOf(ledger, buyerSecurity)).toMatchObject({ stakeholder_id: 'SH-NEW' });
    });

    it('edits it like any stakeholder once apiv2 has read it back', async () => {
      const ledger = await settledToNewBuyer();
      const renamed = { ...stakeholder('SH-NEW'), name: { legal_name: 'New Buyer LLC' } };
      const planned = await plan(ledger, standardBook(renamed));

      expect(planned.status).toBe('ready');
      expect(planned.diff.edits.map((item) => item.id)).toEqual(['SH-NEW']);
      expect(planned.steps.map((step) => step.kind)).toEqual(['restate']);
      await executeReplication(ledger.writer(), planned);
      expect(ledger.book.record('SH-NEW')?.data).toMatchObject({ name: { legal_name: 'New Buyer LLC' } });
    });
  });

  it('refuses in the plan a delete that the writer references check refuses', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    // SH-B holds nothing and nothing names it; SH-A holds S-A1 and S-A2, whose issuances the source keeps.
    const source = manifestOf([
      issuer(),
      stakeholder('SH-B'),
      stockClass('CLS-A'),
      issuance('S-A1', 'SH-A', 'CLS-A', '600', D2024),
      issuance('S-A2', 'SH-A', 'CLS-A', '400', D2024),
    ]);
    const planned = await plan(ledger, source);

    expect(planned.status).toBe('refused');
    expect(planned.steps).toEqual([]);
    expect(planned.refusals.map((refusal) => [refusal.rule, refusal.recordIds])).toEqual([
      ['references', ['SH-A', 'ISS-S-A1']],
      ['references', ['SH-A', 'ISS-S-A2']],
      ['references', ['SH-A']],
    ]);
    expect(planned.refusals[0]?.message).toBe(
      "The restatement would be refused by the writer's references check: TX_STOCK_ISSUANCE ISS-S-A1 would be left " +
        'with a broken reference: Stock issuance stakeholder not found: SH-A'
    );
    expect(planned.refusals[2]?.message).toContain('Stakeholder SH-A still holds 2 outstanding stock securities');
    const writer = ledger.writer();
    await writer.refresh();
    const result = await executeReplication(writer, planned, { checks: false });
    expect(result.executed).toEqual([]);
    expect(ledger.book.record('SH-A')).not.toBeNull();
  });

  it('leaves the hold pair out of the source', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const hold = {
      object_type: 'TX_STOCK_HOLD',
      id: 'HOLD-1',
      date: D2024,
      security_id: 'S-A1',
      hold_type: 'STOP_TRANSFER',
      reference: 'stop-1',
      reason_text: 'Court order',
    };
    const planned = await plan(
      ledger,
      manifestOf([
        ...standardBook().transactions,
        hold,
        ...standardBook().stakeholders,
        ...standardBook().stockClasses,
        issuer(),
      ])
    );
    expect(planned.status).toBe('current');
    expect(planned.notices).toEqual([expect.objectContaining({ kind: 'hold_pair', id: 'HOLD-1' })]);
  });

  it('writes a bulk correction above one restatement in several, each in one transaction', async () => {
    const ledger = standardLedger();
    const ids = Array.from({ length: 501 }, (_, n) => `SH-${String(n).padStart(3, '0')}`);
    await replicate(ledger, standardBook(...ids.map(stakeholder)));
    const renamed = ids.map((id) => ({ ...stakeholder(id), name: { legal_name: `${id} (new address)` } }));

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: standardBook(...renamed), index: writer.index });
    expect(planned.status).toBe('ready');
    expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
      250, 250, 1,
    ]);

    const before = ledger.choices().length;
    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.choices().slice(before)).toEqual(['CapTable_Restate', 'CapTable_Restate', 'CapTable_Restate']);
    const names = ids.map(
      (id) => (ledger.book.record(id)?.data as { name?: { legal_name?: string } } | null)?.name?.legal_name
    );
    expect(names).toEqual(ids.map((id) => `${id} (new address)`));
    await expect(plan(ledger, standardBook(...renamed))).resolves.toMatchObject({ status: 'current', steps: [] });
  });

  it.each([
    ['on', true],
    ['off', false],
  ])('moves a document from a deleted stakeholder to a new one, with the writer checks %s', async (_label, checks) => {
    const ledger = standardLedger();
    await replicate(
      ledger,
      manifestOf([issuer(), stakeholder('SH-A'), stakeholder('SH-X'), json(document('DOC-1', ['SH-X']))])
    );
    const source = manifestOf([issuer(), stakeholder('SH-A'), stakeholder('SH-C'), json(document('DOC-1', ['SH-C']))]);
    const planned = await plan(ledger, source);

    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    expect(planned.steps).toEqual([
      expect.objectContaining({ kind: 'apply', recordIds: ['SH-C'] }),
      expect.objectContaining({ kind: 'restate', recordIds: ['DOC-1', 'SH-X'] }),
    ]);
    const writer = ledger.writer();
    await writer.refresh();
    const result = await executeReplication(writer, planned, { checks });
    expect(result.plan.status).toBe('current');
    expect(ledger.book.record('SH-X')).toBeNull();
    expect(ledger.book.record('DOC-1')?.data).toMatchObject({ related_objects: [{ object_id: 'SH-C' }] });
  });

  describe('writes a vesting terms correction with the vesting records that name its conditions', () => {
    const holders = Array.from({ length: 249 }, (_, n) => `SH-${String(n).padStart(3, '0')}`);
    const renamed = holders.map((id) => ({ ...stakeholder(id), name: { legal_name: `${id} (new address)` } }));
    const terms = vestingTerms('VT-1');
    const [start, milestone] = terms.vesting_conditions;
    const warrant = json(warrantIssuance('W-1', 'WS-1', { vesting_terms_id: 'VT-1' }));
    const event = {
      object_type: 'TX_VESTING_EVENT',
      id: 'VE-1',
      date: '2024-09-01',
      security_id: 'WS-1',
      vesting_condition_id: 'milestone',
    };

    it.each([
      [
        'a renamed condition, and the vesting start that names it',
        [
          json({ ...terms, vesting_conditions: [{ ...start, id: 'begin' }, milestone] }),
          json(vestingStart('VS-1', 'WS-1', 'begin')),
          event,
        ],
        'VS-1',
        ['begin', 'milestone'],
      ],
      [
        'a dropped condition, and the deleted vesting event that named it',
        [
          json({ ...terms, vesting_conditions: [{ ...start, next_condition_ids: [] }] }),
          json(vestingStart('VS-1', 'WS-1')),
        ],
        'VE-1',
        ['start'],
      ],
    ])('%s', async (_label, corrected, recordId, conditions) => {
      const ledger = standardLedger();
      await replicate(
        ledger,
        standardBook(...holders.map(stakeholder), json(terms), warrant, json(vestingStart('VS-1', 'WS-1')), event)
      );
      const writer = ledger.writer();
      await writer.refresh();
      const planned = await planReplication({
        source: standardBook(...renamed, warrant, ...corrected),
        index: writer.index,
      });

      expect(planned).toMatchObject({ status: 'ready', refusals: [] });
      // The 249 stakeholders fill one restatement; the terms go with the vesting record the writer re-checks.
      const restated = planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds : []));
      expect(restated).toEqual([holders, ['VT-1', recordId]]);
      const result = await executeReplication(writer, planned);
      expect(result.plan.status).toBe('current');
      const onLedger = ledger.book.record('VT-1')?.data as { vesting_conditions?: Array<{ id: string }> } | undefined;
      expect(onLedger?.vesting_conditions?.map((condition) => condition.id)).toEqual(conditions);
    });
  });

  it("writes a bulk correction of stock issuances that moves no ceiling in several restatements, under the writer's checks", async () => {
    const ledger = standardLedger();
    const lots = Array.from({ length: 249 }, (_, n) => issuance(`S-B${n}`, 'SH-B', 'CLS-A', '10', D2024));
    await replicate(ledger, standardBook(...lots));
    const book = standardBook(...lots);
    const commented = manifestOf([
      issuer(),
      ...book.stakeholders,
      ...book.stockClasses,
      ...book.transactions.map((record) => ({ ...record, comments: ['Corrected in PostgreSQL'] })),
    ]);

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: commented, index: writer.index });
    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
      250, 1,
    ]);

    const before = ledger.choices().length;
    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.choices().slice(before)).toEqual(['CapTable_Restate', 'CapTable_Restate']);
    expect(ledger.book.record('ISS-S-B248')?.data).toMatchObject({ comments: ['Corrected in PostgreSQL'] });
  });

  it("writes the class and holder renames apart from the lots naming them, under the writer's checks", async () => {
    const ledger = standardLedger();
    const lots = Array.from({ length: 249 }, (_, n) => issuance(`S-B${n}`, 'SH-B', 'CLS-A', '10', D2024));
    await replicate(ledger, standardBook(...lots));
    const book = standardBook(...lots);
    const corrected = manifestOf([
      issuer(),
      ...book.stakeholders.map((holder) =>
        holder.id === 'SH-B' ? { ...holder, name: { legal_name: 'Holder SH-B (fixed)' } } : holder
      ),
      ...book.stockClasses.map((definition) => ({ ...definition, name: 'Common A (fixed)' })),
      ...book.transactions.map((record) => ({ ...record, comments: ['Corrected in PostgreSQL'] })),
    ]);

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: corrected, index: writer.index });
    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
      250, 3,
    ]);

    const before = ledger.choices().length;
    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.choices().slice(before)).toEqual(['CapTable_Restate', 'CapTable_Restate']);
    expect(ledger.book.record('CLS-A')?.data).toMatchObject({ name: 'Common A (fixed)' });
  });

  describe("writes vesting terms edited in what no vesting record reads apart from them, under the writer's checks", () => {
    const terms = vestingTerms('VT-1');
    const [start, milestone] = terms.vesting_conditions;

    it.each([
      ['their description', { ...terms, description: 'A start condition and an event condition (fixed)' }],
      [
        "a condition's description",
        { ...terms, vesting_conditions: [{ ...start, description: 'Start (fixed)' }, milestone] },
      ],
      ["a condition's quantity", { ...terms, vesting_conditions: [start, { ...milestone, quantity: '90' }] }],
    ])('%s', async (_label, edited) => {
      const ledger = standardLedger();
      const warrants = Array.from({ length: 251 }, (_, n) =>
        json(warrantIssuance(`W-${n}`, `WS-${n}`, { vesting_terms_id: 'VT-1' }))
      );
      const starts = Array.from({ length: 251 }, (_, n) => vestingStart(`VS-${n}`, `WS-${n}`));
      await replicate(ledger, standardBook(json(terms), ...warrants, ...starts.map(json)));

      const writer = ledger.writer();
      await writer.refresh();
      const planned = await planReplication({
        source: standardBook(
          json(edited),
          ...warrants,
          ...starts.map((record) => json({ ...record, comments: ['fixed'] }))
        ),
        index: writer.index,
      });
      expect(planned).toMatchObject({ status: 'ready', refusals: [] });
      expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
        250, 2,
      ]);

      const before = ledger.choices().length;
      const result = await executeReplication(writer, planned);
      expect(result.plan.status).toBe('current');
      expect(ledger.choices().slice(before)).toEqual(['CapTable_Restate', 'CapTable_Restate']);
    });
  });

  it("writes a bulk correction that moves a class's outstanding shares apart, each part under the writer's checks", async () => {
    const ledger = standardLedger();
    const lots = Array.from({ length: 251 }, (_, n) => issuance(`S-B${n}`, 'SH-B', 'CLS-A', '10', D2024));
    await replicate(ledger, standardBook(...lots));
    const raised = lots.map((lot) => ({ ...lot, quantity: '11', cost_basis: { amount: '11', currency: 'USD' } }));

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: standardBook(...raised), index: writer.index });
    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    const restates = planned.steps.filter((step) => step.kind === 'restate');
    expect(restates.length).toBeGreaterThan(1);

    const before = ledger.choices().length;
    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.choices().slice(before)).toEqual(restates.map(() => 'CapTable_Restate'));
    expect(stateOf(ledger, 'S-B250')?.quantity).toBe('11');
  });

  describe("writes a definition's edit apart from the records naming it that it cannot break, under the writer's checks", () => {
    const usd = (amount: string): OcfJson => ({ amount, currency: 'USD' });
    const right = (price: string): OcfJson => ({
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      converts_to_stock_class_id: 'CLS-A',
      conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '1', denominator: '1' },
        conversion_price: usd(price),
        rounding_type: 'NORMAL',
      },
    });
    const preferred = (rights: OcfJson[]): OcfJson =>
      stockClass('CLS-P', { class_type: 'PREFERRED', default_id_prefix: 'PS-', conversion_rights: rights });
    const lots = Array.from({ length: 251 }, (_, n) => issuance(`S-P${n}`, 'SH-B', 'CLS-P', '10', D2024));
    const terms = vestingTerms('VT-1');
    const [start, milestone] = terms.vesting_conditions;
    const warrants = Array.from({ length: 251 }, (_, n) =>
      json(warrantIssuance(`W-${n}`, `WS-${n}`, { vesting_terms_id: 'VT-1' }))
    );
    const pool = stockPlan('PLAN-1', ['CLS-A']);
    const grants = Array.from({ length: 251 }, (_, n) => json(option(`ECS-${n}`, '10', { stock_plan_id: 'PLAN-1' })));
    const commented = (records: OcfJson[]): OcfJson[] => records.map((record) => ({ ...record, comments: ['fixed'] }));

    it.each([
      [
        "a vesting condition's description, beside comments on the warrants on its terms",
        [json(terms), ...warrants],
        [
          json({ ...terms, vesting_conditions: [start, { ...milestone, description: 'Board milestone' }] }),
          ...commented(warrants),
        ],
      ],
      [
        'a class gaining its first conversion right, beside comments on its lots',
        [preferred([]), ...lots],
        [preferred([right('1')]), ...commented(lots)],
      ],
      [
        'a plan gaining a class, beside comments on the grants under it',
        [stockClass('CLS-B'), json(pool), ...grants],
        [stockClass('CLS-B'), json({ ...pool, stock_class_ids: ['CLS-A', 'CLS-B'] }), ...commented(grants)],
      ],
      [
        "a class's conversion price, beside its lots' new share prices",
        [preferred([right('1')]), ...lots],
        [preferred([right('2')]), ...lots.map((lot) => ({ ...lot, share_price: usd('2'), cost_basis: usd('20') }))],
      ],
    ])('%s', async (_label, book, corrected) => {
      const ledger = standardLedger();
      await replicate(ledger, standardBook(...book));

      const writer = ledger.writer();
      await writer.refresh();
      const planned = await planReplication({ source: standardBook(...corrected), index: writer.index });
      expect(planned).toMatchObject({ status: 'ready', refusals: [] });
      expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
        250, 2,
      ]);

      const result = await executeReplication(writer, planned);
      expect(result.plan.status).toBe('current');
      await expect(plan(ledger, standardBook(...corrected))).resolves.toMatchObject({ status: 'current', steps: [] });
    });
  });

  it("merges a duplicate holder: its lots moved off it apart from its delete, under the writer's checks", async () => {
    const ledger = standardLedger();
    const lots = Array.from({ length: 251 }, (_, n) => issuance(`S-X${n}`, 'SH-X', 'CLS-A', '10', D2024));
    await replicate(ledger, standardBook(stakeholder('SH-X'), ...lots));
    const moved = standardBook(...lots.map((lot) => ({ ...lot, stakeholder_id: 'SH-A' })));

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: moved, index: writer.index });
    expect(planned).toMatchObject({ status: 'ready', refusals: [] });
    const restates = planned.steps.filter((step) => step.kind === 'restate');
    expect(restates.length).toBeGreaterThan(1);
    // The holder goes last, once every state has left it.
    expect(restates[restates.length - 1]?.recordIds).toContain('SH-X');

    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.book.record('SH-X')).toBeNull();
    expect(stateOf(ledger, 'S-X250')?.stakeholder_id).toBe('SH-A');
    await expect(plan(ledger, moved)).resolves.toMatchObject({ status: 'current', steps: [] });
  });

  it.each([
    [
      'a holder recorded in error with its lots',
      'SH-X',
      [stakeholder('SH-X')],
      (n: number) => issuance(`S-X${n}`, 'SH-X', 'CLS-A', '10', D2024),
    ],
    [
      'a holder recorded in error with its warrants',
      'SH-X',
      [stakeholder('SH-X')],
      (n: number) => json(warrantIssuance(`W-${n}`, `WS-${n}`, { stakeholder_id: 'SH-X' })),
    ],
    [
      'a plan recorded in error with its grants',
      'PLAN-1',
      [json(stockPlan('PLAN-1', ['CLS-A']))],
      (n: number) => json(option(`ECS-${n}`, '10', { stock_plan_id: 'PLAN-1' })),
    ],
  ])(
    "deletes %s, the definition after the records naming it, under the writer's checks",
    async (_label, definitionId, definition, naming) => {
      const ledger = standardLedger();
      await replicate(ledger, standardBook(...definition, ...Array.from({ length: 200 }, (_, n) => naming(n))));

      const writer = ledger.writer();
      await writer.refresh();
      const planned = await planReplication({ source: standardBook(), index: writer.index });
      expect(planned).toMatchObject({ status: 'ready', refusals: [] });
      const restates = planned.steps.filter((step) => step.kind === 'restate');
      expect(restates.length).toBeGreaterThan(1);
      // The definition goes last, once no record names it.
      expect(restates.map((step) => step.recordIds.includes(definitionId))).toEqual([
        ...restates.slice(1).map(() => false),
        true,
      ]);

      const result = await executeReplication(writer, planned);
      expect(result.plan.status).toBe('current');
      expect(ledger.book.record(definitionId)).toBeNull();
      await expect(plan(ledger, standardBook())).resolves.toMatchObject({ status: 'current', steps: [] });
    }
  );
});
