/**
 * Replication planning on key indexes built directly: each restatement limit refused with its reason, a correction
 * above one restatement's caps written in several (and the groups that must stay together), the history a book
 * already holds refusing a create, a source that does not replay, pre-splits for a large book, the snapshot and
 * `accelerated_since_snapshot` a restated lot states, and a restatement checked against the replay.
 */

import { OcpErrorCodes } from '../../src/errors';
import { IndexView, simulateWrite } from '../../src/register/bookSimulation';
import type { RegisterIndex } from '../../src/register/registerIndex';
import { replayOcf } from '../../src/register/replay/replay';
import { planReplication } from '../../src/register/replication/plan';
import { checkRestatement, packRestatement, restatementGroups } from '../../src/register/replication/restatement';
import type { ReplicationPlan, ReplicationRefusalRule } from '../../src/register/replication/types';
import { planBatches } from '../../src/register/sizing';
import type {
  OcfStockClassSplit,
  OcfStockIssuance,
  OcfStockTransfer,
  OcfVestingAcceleration,
} from '../../src/types/native';
import type { OpenHold, RestateOperation, StockSecurityState } from '../../src/types/register';
import { buildOcfManifest } from '../../src/utils/cantonOcfExtractor';
import * as ocfComparison from '../../src/utils/ocfComparison';
import {
  document,
  stakeholder,
  stockAcceptance,
  stockClass,
  stockClassSplit,
  stockIssuance,
  stockState,
  stockTransfer,
  TestBook,
  vestingTerms,
} from './bookFixtures';
import { issuerRecord } from './checkFixtures';
import { split } from './registerFixtures';
import { derived, manifestOf, type OcfJson } from './replayFixtures';
import { anchoredIndex } from './writerFixtures';

const json = (record: object): OcfJson => record as OcfJson;

/** The base book's records: stakeholders SH-A and SH-B, class CLS-A and S-A1 (600 shares to SH-A). */
function baseRecords(): OcfJson[] {
  return [stakeholder('SH-A'), stakeholder('SH-B'), stockClass('CLS-A'), stockIssuance()].map(json);
}

/** The base book with these extra records and the state and epoch given. */
function bookOf(
  options: {
    records?: Array<Parameters<TestBook['record']>>;
    state?: Partial<StockSecurityState> | null;
    epoch?: Parameters<TestBook['epoch']>[1];
    status?: 'ACTIVE' | 'TEARING_DOWN';
  } = {}
): RegisterIndex {
  const book = new TestBook()
    .record('stakeholder', stakeholder('SH-A'))
    .record('stakeholder', stakeholder('SH-B'))
    .record('stockClass', stockClass('CLS-A'))
    .epoch('CLS-A', options.epoch ?? {})
    .record('stockIssuance', stockIssuance());
  for (const [type, data] of options.records ?? []) book.record(type, data);
  if (options.state !== null) book.state(stockState(options.state ?? {}));
  const index = anchoredIndex(book);
  if (options.status !== undefined) {
    const { anchor } = index;
    if (anchor !== null)
      index.add({ kind: 'anchor', context: index.context, contract: { ...anchor, status: options.status } });
    if (anchor !== null) index.remove(anchor.contractId);
    index.add({
      kind: 'anchor',
      context: index.context,
      contract: {
        contractId: 'anchor-2',
        templateId: anchor?.templateId ?? '',
        createdOffset: 1,
        status: options.status,
      },
    });
  }
  return index;
}

async function planFor(index: RegisterIndex, records: OcfJson[], hashesPerShard?: number): Promise<ReplicationPlan> {
  return planReplication({
    source: manifestOf(records),
    index,
    ...(hashesPerShard !== undefined ? { options: { hashesPerShard } } : {}),
  });
}

function rules(plan: ReplicationPlan): ReplicationRefusalRule[] {
  return plan.refusals.map((refusal) => refusal.rule);
}

function expectRefused(plan: ReplicationPlan, rule: ReplicationRefusalRule, fragment: string): void {
  expect(plan.status).toBe('refused');
  expect(plan.steps).toEqual([]);
  expect(plan.refusals).toEqual(
    expect.arrayContaining([expect.objectContaining({ rule, message: expect.stringContaining(fragment) as unknown })])
  );
}

const STOP: OpenHold = {
  hold_id: 'HOLD-1',
  hold_type: 'STOP_TRANSFER',
  reference: 'stop-1',
  split_epoch: 0,
  quantity: null,
};
const SPLIT: OcfStockClassSplit = stockClassSplit('SPLIT-1', 'CLS-A', '2024-06-01');

describe('planReplication: a book that holds its source', () => {
  it('plans nothing, and creates only what the book lacks', async () => {
    const index = bookOf();
    await expect(planFor(index, baseRecords())).resolves.toMatchObject({ status: 'current', steps: [] });

    const plan = await planFor(index, [...baseRecords(), json(stockAcceptance('ACC-1', 'S-A1', '2024-02-01'))]);
    expect(plan).toMatchObject({ status: 'ready', violation: null, refusals: [] });
    expect(plan.steps).toEqual([
      {
        kind: 'apply',
        recordIds: ['ACC-1'],
        operations: [expect.objectContaining({ kind: 'record', type: 'stockAcceptance' })],
      },
    ]);
  });

  it('writes no edit where the source differs from the book only where the ledger stores nothing', async () => {
    const index = bookOf();
    // A difference the OCF comparison sees and the Daml record does not keep: the edit would change nothing.
    const comparison = jest
      .spyOn(ocfComparison, 'ocfDeepEqual')
      .mockImplementation((a: unknown) => (a as { id?: unknown }).id !== 'SH-A');
    try {
      const plan = await planFor(index, baseRecords());
      expect(plan.status).toBe('current');
      expect(plan.notices).toEqual([expect.objectContaining({ kind: 'edit_unchanged', id: 'SH-A' })]);
    } finally {
      comparison.mockRestore();
    }
  });

  it('refuses a source record the ledger cannot store', async () => {
    const [holderA, ...rest] = baseRecords();
    const plan = await planFor(bookOf(), [{ ...holderA, unknown_extension: 'kept only in PostgreSQL' }, ...rest]);
    expectRefused(plan, 'restatement', 'must NOT have additional properties');
  });

  it('needs a book read with its payloads', async () => {
    const index = bookOf();
    const bare = new TestBook().index();
    Object.defineProperty(bare, 'retainsPayloads', { value: false });
    await expect(planReplication({ source: manifestOf(baseRecords()), index: bare })).rejects.toMatchObject({
      classification: 'register_payload_required',
    });
    await expect(
      planReplication({ source: manifestOf(baseRecords()), index, options: { hashesPerShard: 0 } })
    ).rejects.toMatchObject({ fieldPath: 'options.hashesPerShard' });
    await expect(
      planReplication({ source: [{ entityType: 'stakeholder', data: { name: 'no id' } }], index })
    ).rejects.toMatchObject({ fieldPath: 'source[0].id', code: OcpErrorCodes.REQUIRED_FIELD_MISSING });
    await expect(
      planReplication({ source: manifestOf([{ object_type: 'TX_UNKNOWN', id: 'X', date: '2024-01-01' }]), index })
    ).rejects.toMatchObject({ code: OcpErrorCodes.UNKNOWN_ENUM_VALUE });
  });
});

describe('planReplication: restatement limits', () => {
  it('refuses an edit or delete of a split: the book is rebuilt', async () => {
    const index = bookOf({
      records: [['stockClassSplit', SPLIT]],
      epoch: { splits: [split('SPLIT-1', '2024-06-01', '2', '1')] },
    });
    const edited = { ...SPLIT, split_ratio: { numerator: '3', denominator: '1' } };
    expectRefused(await planFor(index, [...baseRecords(), json(edited)]), 'split', 'split SPLIT-1 is never restated');
    expectRefused(await planFor(index, baseRecords()), 'split', 'rebuild the book');
  });

  it("refuses the issuer's delete, and a second issuer", async () => {
    const index = bookOf({ records: [['issuer', issuerRecord()]] });
    const plan = await planFor(index, [...baseRecords(), json({ ...issuerRecord(), id: 'ISSUER-2' })]);
    expect(rules(plan)).toEqual(['issuer', 'issuer']);
    expectRefused(plan, 'issuer', 'the issuer record is never deleted');
    expectRefused(plan, 'issuer', 'differs from the book');
  });

  it('refuses the delete of a stock class with recorded splits, or one frozen for a split', async () => {
    const withSplits = bookOf({ epoch: { splits: [split('SPLIT-0', '2023-06-01', '2', '1')] }, state: null });
    const records = [stakeholder('SH-A'), stakeholder('SH-B')].map(json);
    const refused = await planFor(withSplits, records);
    expectRefused(refused, 'class_with_splits', 'stock class CLS-A has recorded splits');

    const frozen = bookOf({ epoch: { frozen: true }, state: null });
    expectRefused(await planFor(frozen, records), 'frozen_class', 'stock class CLS-A is frozen for a split');
  });

  it('refuses a correction that would change a lot on hold, or end it', async () => {
    const index = bookOf({ state: { holds: [STOP], seq: 1 } });
    const moved = { ...stockIssuance(), stakeholder_id: 'SH-B' };
    expectRefused(
      await planFor(index, [...baseRecords().slice(0, 3), json(moved)]),
      'held_state',
      'security S-A1 carries an open hold, so a restatement keeps its stakeholder, class and last event date'
    );
    expectRefused(
      await planFor(index, baseRecords().slice(0, 3)),
      'held_state',
      'a restatement never ends a lot on hold'
    );
    // A correction that keeps them is fine: the hold is carried forward.
    const resized = await planFor(index, [...baseRecords().slice(0, 3), json({ ...stockIssuance(), quantity: '650' })]);
    expect(resized.status).toBe('ready');
  });

  it('refuses a correction in a class frozen for a split', async () => {
    const index = bookOf({ epoch: { frozen: true } });
    expectRefused(
      await planFor(index, [...baseRecords().slice(0, 3), json({ ...stockIssuance(), quantity: '650' })]),
      'frozen_class',
      'stock class CLS-A is frozen for a split'
    );
  });

  it('refuses what Restate.daml refuses: an edit that changes the securities a stock event consumed', async () => {
    const transfer: OcfStockTransfer = stockTransfer();
    const index = bookOf({
      records: [
        ['stockTransfer', transfer],
        [
          'stockIssuance',
          stockIssuance({ id: 'ISS-B1', security_id: 'S-B1', stakeholder_id: 'SH-B', date: '2024-03-01' }),
        ],
      ],
      state: null,
    });
    const source = [
      ...baseRecords(),
      json(stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2', quantity: '600' })),
      json({ ...transfer, security_id: 'S-A2' }),
      json(stockIssuance({ id: 'ISS-B1', security_id: 'S-B1', stakeholder_id: 'SH-B', date: '2024-03-01' })),
    ];
    expectRefused(
      await planFor(index, source),
      'restatement',
      'an edit cannot change the securities record TR-1 consumed; delete it and write a new one'
    );
  });

  it('refuses a book that is being torn down', async () => {
    const index = bookOf({ status: 'TEARING_DOWN' });
    expectRefused(await planFor(index, baseRecords()), 'book_not_active', 'is TEARING_DOWN');
  });

  it('writes a correction above 500 contracts in several restatements, each within the caps', async () => {
    const book = new TestBook();
    const holders = Array.from({ length: 501 }, (_, n) => stakeholder(`SH-${n}`));
    for (const holder of holders) book.record('stakeholder', holder);
    const index = anchoredIndex(book);
    const renamed = holders.map((holder) => json({ ...holder, name: { legal_name: `${holder.name.legal_name} Jr.` } }));
    const plan = await planFor(index, renamed);

    expect(plan).toMatchObject({ status: 'ready', refusals: [] });
    // Each edit archives a record and creates its successor: 250 edits fill a restatement's 500 contracts.
    expect(plan.steps.map((step) => step.kind)).toEqual(['restate', 'restate', 'restate']);
    const restated = plan.steps.map((step) => (step.kind === 'restate' ? step.recordIds : []));
    expect(restated.map((ids) => ids.length)).toEqual([250, 250, 1]);
    expect(restated.flat()).toEqual(holders.map((holder) => holder.id));
    // Each part fits one CapTable_Restate over the book as the part before it leaves it.
    const view = new IndexView(index);
    expect(
      plan.steps.map((step) =>
        step.kind === 'restate'
          ? simulateWrite(view, { kind: 'restate', operations: step.operations }).usage().contractsTouched
          : null
      )
    ).toEqual([500, 500, 2]);
  });

  it('refuses a correction whose records and states must change together, above the caps', () => {
    const book = bookOf();
    const replay = replayOcf(
      manifestOf([...baseRecords().slice(0, 3), json({ ...stockIssuance(), quantity: '650' })]),
      {
        capTableId: 'test-1',
      }
    );
    const operations: RestateOperation[] = [
      { kind: 'edit', type: 'stockIssuance', data: { ...stockIssuance(), quantity: '650' } },
      {
        kind: 'setState',
        state: {
          security_id: 'S-A1',
          issue_date: '2024-01-01',
          last_event_date: '2024-01-01',
          origin_transaction_id: 'ISS-A1',
          quantity: '650',
          stakeholder_id: 'SH-A',
          stock_class_id: 'CLS-A',
          vesting: { kind: 'none' },
          snapshot: null,
          accelerated_since_snapshot: null,
        },
      },
    ];
    const { bytes } = simulateWrite(new IndexView(book), { kind: 'restate', operations }).usage();
    const check = checkRestatement({
      index: book,
      view: new IndexView(book),
      operations,
      replay,
      sizing: { byteBudget: bytes - 1 },
    });
    expect(check.parts).toBeNull();
    expect(check.refusals).toEqual([
      {
        rule: 'too_large',
        message: expect.stringContaining(
          "A correction whose records and states change together exceeds one restatement's caps: an estimated"
        ) as unknown,
        recordIds: ['ISS-A1'],
        securityIds: ['S-A1'],
      },
    ]);
  });
});

describe('restatementGroups and packRestatement', () => {
  const rename = (id: string): RestateOperation => ({
    kind: 'edit',
    type: 'stakeholder',
    data: { ...stakeholder(id), name: { legal_name: `${id} renamed` } },
  });
  const raised: RestateOperation = {
    kind: 'edit',
    type: 'stockIssuance',
    data: { ...stockIssuance(), quantity: '650' },
  };
  const restated: RestateOperation = {
    kind: 'setState',
    state: {
      security_id: 'S-A1',
      issue_date: '2024-01-01',
      last_event_date: '2024-01-01',
      origin_transaction_id: 'ISS-A1',
      quantity: '650',
      stakeholder_id: 'SH-A',
      stock_class_id: 'CLS-A',
      vesting: { kind: 'none' },
      snapshot: null,
      accelerated_since_snapshot: null,
    },
  };

  it('groups a state with the records that restate it and the records they name, and nothing else', () => {
    const book = bookOf({ records: [['stakeholder', stakeholder('SH-C')]] });
    expect(restatementGroups(book, [rename('SH-B'), raised, restated, rename('SH-A'), rename('SH-C')])).toEqual([
      [rename('SH-B')],
      [raised, restated, rename('SH-A')],
      [rename('SH-C')],
    ]);
  });

  it('puts every operation that can move a ceiling in one group', () => {
    const book = bookOf({
      records: [
        ['stockIssuance', stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2' })],
        ['stockClass', stockClass('CLS-B')],
      ],
    });
    const other: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: { ...stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2' }), comments: ['edited'] },
    };
    const reclassed: RestateOperation = {
      kind: 'edit',
      type: 'stockClass',
      data: { ...stockClass('CLS-B'), name: 'B' },
    };
    expect(restatementGroups(book, [raised, rename('SH-B'), other, reclassed])).toEqual([
      [raised, other, reclassed],
      [rename('SH-B')],
    ]);
  });

  it('packs the groups into as few restatements as fit, in order', () => {
    const book = bookOf({ records: [['stakeholder', stakeholder('SH-C')]] });
    const view = new IndexView(book);
    const operations = [rename('SH-A'), rename('SH-B'), rename('SH-C')];
    const one = simulateWrite(view, { kind: 'restate', operations: [rename('SH-A')] }).usage().bytes;
    const two = simulateWrite(view, { kind: 'restate', operations: operations.slice(0, 2) }).usage().bytes;
    expect(two).toBeGreaterThan(one);

    expect(packRestatement(book, view, operations).parts.map((part) => part.operations)).toEqual([operations]);
    const packed = packRestatement(book, view, operations, { byteBudget: two });
    expect(packed.refusals).toEqual([]);
    expect(packed.parts.map((part) => part.operations)).toEqual([operations.slice(0, 2), operations.slice(2)]);
    expect(packed.delta.records.get('SH-C')?.data()).toMatchObject({ value: { name: { legal_name: 'SH-C renamed' } } });
    expect(packRestatement(book, view, operations, { byteBudget: one - 1 }).refusals).toEqual([
      expect.objectContaining({ rule: 'too_large', recordIds: ['SH-A'], securityIds: [] }),
    ]);
  });
});

describe("planReplication: the book's history", () => {
  it('refuses a record dated before the last event the book holds on its security', async () => {
    const index = bookOf({
      records: [['stockAcceptance', stockAcceptance('ACC-0', 'S-A1', '2024-05-01')]],
      state: { last_event_date: '2024-05-01', seq: 1 },
    });
    const source = [
      ...baseRecords(),
      json(stockAcceptance('ACC-0', 'S-A1', '2024-05-01')),
      json(stockAcceptance('ACC-1', 'S-A1', '2024-03-01')),
    ];
    expectRefused(
      await planFor(index, source),
      'out_of_order',
      'Record ACC-1 dated 2024-03-01 precedes the last event on security S-A1 on the book (2024-05-01)'
    );
  });

  it('refuses a record on a security the book has ended', async () => {
    const transfer = stockTransfer();
    const output = stockIssuance({
      id: 'ISS-B1',
      security_id: 'S-B1',
      custom_id: 'CS-B1',
      stakeholder_id: 'SH-B',
      date: '2024-03-01',
    });
    const index = bookOf({
      records: [
        ['stockTransfer', transfer],
        ['stockIssuance', output],
      ],
      state: null,
    });
    const source = [
      ...baseRecords(),
      json(transfer),
      json(output),
      json(stockAcceptance('ACC-1', 'S-A1', '2024-02-01')),
    ];
    expectRefused(
      await planFor(index, source),
      'out_of_order',
      'is on security S-A1, which the book has already ended'
    );
  });

  it('refuses a split dated before records the book holds in its class', async () => {
    const early = stockClassSplit('SPLIT-0', 'CLS-A', '2023-12-01');
    expectRefused(
      await planFor(bookOf(), [...baseRecords(), json(early)]),
      'out_of_order',
      'Split SPLIT-0 of stock class CLS-A dated 2023-12-01 precedes 1 record(s) the book already holds in the class'
    );
  });

  it('refuses a correction that adds an output to a stock event the book holds', async () => {
    const whole = stockTransfer();
    const output = stockIssuance({
      id: 'ISS-B1',
      security_id: 'S-B1',
      custom_id: 'CS-B1',
      stakeholder_id: 'SH-B',
      date: '2024-03-01',
      quantity: '600',
    });
    const index = bookOf({
      records: [
        ['stockTransfer', whole],
        ['stockIssuance', output],
      ],
      state: null,
    });
    const partial = { ...whole, quantity: '500', balance_security_id: 'S-A3' };
    const balance = stockIssuance({
      id: 'ISS-A3',
      security_id: 'S-A3',
      custom_id: 'CS-A3',
      date: '2024-03-01',
      quantity: '100',
    });
    const plan = await planFor(index, [
      ...baseRecords(),
      json(partial),
      json({ ...output, quantity: '500' }),
      json(balance),
    ]);
    expectRefused(plan, 'partial_bundle', 'Records ISS-A3 are written with TR-1, ISS-B1');
  });
});

describe('planReplication: a source that does not replay', () => {
  it('stops at the first violation, writing only the valid prefix of a source with no corrections', async () => {
    const index = bookOf();
    const tooMuch = stockTransfer({ quantity: '700', resulting_security_ids: ['S-B1'] });
    const output = stockIssuance({
      id: 'ISS-B1',
      security_id: 'S-B1',
      custom_id: 'CS-B1',
      stakeholder_id: 'SH-B',
      date: '2024-03-01',
      quantity: '700',
    });
    const plan = await planFor(index, [
      ...baseRecords(),
      json(stockAcceptance('ACC-1', 'S-A1', '2024-02-01')),
      json(tooMuch),
      json(output),
      json(stockAcceptance('ACC-2', 'S-A1', '2024-04-01')),
    ]);
    expect(plan.status).toBe('blocked');
    expect(plan.violation).toMatchObject({ rule: 'balance', recordIds: ['TR-1', 'ISS-B1'] });
    expect(plan.steps).toEqual([expect.objectContaining({ kind: 'apply', recordIds: ['ACC-1'] })]);

    const corrected = await planFor(index, [
      ...baseRecords().slice(0, 3),
      json({ ...stockIssuance(), quantity: '650' }),
      json(tooMuch),
      json(output),
    ]);
    expect(corrected).toMatchObject({ status: 'blocked', steps: [] });
  });

  it('refuses a correction whose corrected book does not replay', async () => {
    const transfer = stockTransfer();
    const output = stockIssuance({
      id: 'ISS-B1',
      security_id: 'S-B1',
      custom_id: 'CS-B1',
      stakeholder_id: 'SH-B',
      date: '2024-03-01',
    });
    const index = bookOf({
      records: [
        ['stockTransfer', transfer],
        ['stockIssuance', output],
      ],
      state: null,
    });
    // The issuance shrinks below what the transfer the book holds takes from it.
    const plan = await planFor(index, [
      ...baseRecords().slice(0, 3),
      json({ ...stockIssuance(), quantity: '500' }),
      json(transfer),
      json(output),
    ]);
    expect(plan.violation).not.toBeNull();
    expect(plan.status).toBe('blocked');
  });
});

describe('planReplication: pre-splits', () => {
  it('splits the shortest shards first, one bit each, until they hold about the claims asked for', async () => {
    const index = bookOf();
    const holders = Array.from({ length: 300 }, (_, n) => json(stakeholder(`SH-N${n}`)));
    const plan = await planFor(index, [...baseRecords(), ...holders], 1);
    const [preSplit] = plan.steps;
    // 5 claims on the book (SH-A, SH-B, CLS-A, ISS-A1 and S-A1) and 300 to come: 305 shards, from 256.
    expect(preSplit?.kind).toBe('preSplit');
    const prefixes = preSplit?.kind === 'preSplit' ? preSplit.operations.map((operation) => operation.prefix) : [];
    expect(prefixes).toHaveLength(49);
    expect(prefixes.slice(0, 3)).toEqual(['00000000', '00000001', '00000010']);
    expect(plan.steps[1]).toMatchObject({ kind: 'apply' });
    // The writer can pack them.
    const batches = planBatches(index, preSplit?.kind === 'preSplit' ? preSplit.operations : []);
    expect(batches.oversized).toBeNull();

    const defaultPlan = await planFor(index, [...baseRecords(), ...holders]);
    expect(defaultPlan.steps.map((step) => step.kind)).toEqual(['apply']);
  });
});

describe('planReplication: restated lots on vesting terms', () => {
  it("carries the ledger's snapshot in the state's units and states the accelerations since it", async () => {
    const onTerms: OcfStockIssuance = stockIssuance({ quantity: '1000', vesting_terms_id: 'VT-1' });
    const acceleration = (date: string, quantity: string): OcfVestingAcceleration => ({
      object_type: 'TX_VESTING_ACCELERATION',
      id: 'ACCEL-1',
      date,
      security_id: 'S-A1',
      quantity,
      reason_text: 'Board resolution',
    });
    // The TA's snapshot (vested 200 as of 2024-03-01) and an acceleration of 100 on 2024-05-01, before a 2:1 split.
    const index = bookOf({
      records: [
        ['vestingTerms', vestingTerms('VT-1')],
        ['stockClassSplit', SPLIT],
        ['vestingAcceleration', acceleration('2024-05-01', '100')],
      ],
      epoch: { splits: [split('SPLIT-1', '2024-06-01', '2', '1')] },
      state: {
        quantity: '1000',
        vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' },
        last_event_date: '2024-05-01',
        seq: 2,
        snapshot: { as_of: '2024-03-01', vested: '200' },
        accelerated_since_snapshot: '100',
      },
    });
    index.remove('cid-ISS-A1');
    index.add({
      kind: 'record',
      context: index.context,
      contract: {
        contractId: 'cid-ISS-A1',
        templateId: 'stock-issuance',
        createdOffset: 1,
        entityType: 'stockIssuance',
        objectId: 'ISS-A1',
        objectType: 'TX_STOCK_ISSUANCE',
        securityIds: ['S-A1'],
        data: onTerms,
      },
    });
    // The source moves the acceleration past the split: the lot's last event is then in post-split units.
    const source = [
      ...baseRecords().slice(0, 3),
      json(onTerms),
      json(vestingTerms('VT-1')),
      json(SPLIT),
      json(acceleration('2024-07-01', '150')),
    ];
    const plan = await planFor(index, source);

    expect(plan.status).toBe('ready');
    const [step] = plan.steps;
    const operations: RestateOperation[] = step?.kind === 'restate' ? step.operations : [];
    expect(operations).toEqual([
      expect.objectContaining({ kind: 'edit', type: 'vestingAcceleration' }),
      {
        kind: 'setState',
        state: {
          security_id: 'S-A1',
          issue_date: '2024-01-01',
          last_event_date: '2024-07-01',
          origin_transaction_id: 'ISS-A1',
          quantity: '2000',
          stakeholder_id: 'SH-A',
          stock_class_id: 'CLS-A',
          vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' },
          snapshot: { as_of: '2024-03-01', vested: '400' },
          accelerated_since_snapshot: '150',
        },
      },
    ]);
    expect(plan.restatedSecurityIds).toEqual(['S-A1']);
  });

  it('needs a ledger client to recreate a state', async () => {
    const transfer = stockTransfer();
    const output = stockIssuance({
      id: 'ISS-B1',
      security_id: 'S-B1',
      custom_id: 'CS-B1',
      stakeholder_id: 'SH-B',
      date: '2024-03-01',
    });
    const index = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stakeholder', stakeholder('SH-B'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance())
      .record('stockTransfer', transfer)
      .record('stockIssuance', output)
      .state(
        stockState({
          security_id: 'S-B1',
          origin_transaction_id: 'ISS-B1',
          stakeholder_id: 'SH-B',
          issue_date: '2024-03-01',
          last_event_date: '2024-03-01',
        })
      );
    await expect(planFor(anchoredIndex(index), baseRecords())).rejects.toMatchObject({
      classification: 'ledger_required',
      fieldPath: 'options.ledger',
    });
  });
});

describe('planReplication: edits that name records to create', () => {
  it('writes a document edit that names a new record in a last restatement', async () => {
    const index = bookOf({ records: [['document', document('DOC-1', ['SH-A'])]] });
    const plan = await planFor(index, [
      ...baseRecords(),
      json(stakeholder('SH-C')),
      json(document('DOC-1', ['SH-A', 'SH-C'])),
    ]);
    expect(plan.status).toBe('ready');
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: 'apply', recordIds: ['SH-C'] }),
      expect.objectContaining({ kind: 'restate', recordIds: ['DOC-1'], securityIds: [] }),
    ]);
  });

  it('writes the definitions a correction names before the correction', async () => {
    const index = bookOf();
    const plan = await planFor(index, [
      ...baseRecords().slice(0, 3),
      json(stakeholder('SH-C')),
      json({ ...stockIssuance(), stakeholder_id: 'SH-C' }),
    ]);
    expect(plan.steps.map((step) => step.kind)).toEqual(['apply', 'restate']);
    expect(plan.steps[1]).toMatchObject({
      operations: [
        expect.objectContaining({ kind: 'edit' }),
        { kind: 'setState', state: expect.objectContaining({ stakeholder_id: 'SH-C' }) },
      ],
    });
  });
});

describe('checkRestatement', () => {
  const index = (): RegisterIndex => bookOf();
  const corrected = (quantity: string) =>
    replayOcf(manifestOf([...baseRecords().slice(0, 3), json({ ...stockIssuance(), quantity })]), {
      capTableId: 'test-1',
    });
  const restated = (quantity: string): Extract<RestateOperation, { kind: 'setState' }> => ({
    kind: 'setState',
    state: {
      security_id: 'S-A1',
      issue_date: '2024-01-01',
      last_event_date: '2024-01-01',
      origin_transaction_id: 'ISS-A1',
      quantity,
      stakeholder_id: 'SH-A',
      stock_class_id: 'CLS-A',
      vesting: { kind: 'none' },
      snapshot: null,
      accelerated_since_snapshot: null,
    },
  });
  const edit: RestateOperation = { kind: 'edit', type: 'stockIssuance', data: { ...stockIssuance(), quantity: '650' } };

  function check(book: RegisterIndex, operations: RestateOperation[], quantity = '650') {
    return checkRestatement({ index: book, view: new IndexView(book), operations, replay: corrected(quantity) });
  }

  it('accepts a restatement whose states equal the replay, and returns it simulated in one part', () => {
    const result = check(index(), [edit, restated('650')]);
    expect(result.refusals).toEqual([]);
    expect(result.parts?.map((part) => part.operations)).toEqual([[edit, restated('650')]]);
  });

  it('refuses a restatement whose states disagree with the replay', () => {
    expect(check(index(), [edit, restated('640')]).refusals).toEqual([
      expect.objectContaining({
        rule: 'replay_mismatch',
        message: 'Security S-A1 differs from the replay of the corrected book in quantity after the restatement',
      }),
    ]);
    expect(check(index(), [edit]).refusals.map((refusal) => refusal.rule)).toEqual(['replay_mismatch']);
  });

  it('refuses the lineage Restate.daml refuses', () => {
    const book = index();
    expect(check(book, [{ kind: 'endState', securityId: 'S-A1' }]).refusals[0]).toMatchObject({
      rule: 'restatement',
      message: "a restatement ends security S-A1's state only with the deletion of its origin issuance ISS-A1",
    });
    expect(
      check(book, [{ ...restated('600'), state: { ...restated('600').state, seq: 4 } }]).refusals[0]
    ).toMatchObject({
      message: 'security S-A1 has an active state; replace it without a seq',
    });
    expect(check(book, [{ kind: 'delete', objectId: 'ISS-A1' }]).refusals[0]).toMatchObject({
      rule: 'restatement',
      message: expect.stringContaining(
        'a restatement deletes stock issuance ISS-A1 only with the end of security S-A1'
      ) as unknown,
    });
    expect(
      check(book, [{ kind: 'setState', state: { ...restated('600').state, last_event_date: '2023-12-01' } }])
        .refusals[0]
    ).toMatchObject({
      message: "a restatement never moves security S-A1's last event date back",
    });
  });

  it('refuses the protected records: derived form, hold records, and an issuance a register choice consumed', () => {
    const tradeId = derived('S-A1', 0, 'event');
    const trade = stockTransfer({ id: tradeId });
    const book = bookOf({
      records: [
        ['stockTransfer', trade],
        [
          'stockHold',
          {
            object_type: 'TX_STOCK_HOLD',
            id: 'HOLD-1',
            date: '2024-01-02',
            security_id: 'S-A2',
            hold_type: 'STOP_TRANSFER',
            reference: 'stop-1',
            reason_text: 'Court order',
          },
        ],
      ],
      state: null,
    });
    const view = new IndexView(book);
    const replay = corrected('600');
    const refusals = (operations: RestateOperation[]) =>
      checkRestatement({ index: book, view, operations, replay }).refusals;
    expect(refusals([{ kind: 'delete', objectId: tradeId }])[0]).toMatchObject({
      rule: 'derived_form',
      message: `record ${tradeId} was written by a register choice and is never restated; correct it with a new record`,
    });
    expect(refusals([{ kind: 'delete', objectId: 'HOLD-1' }])[0]).toMatchObject({
      rule: 'hold_record',
      message: 'hold records are never restated',
    });
    expect(refusals([{ kind: 'delete', objectId: 'ISS-A1' }])[0]).toMatchObject({
      rule: 'derived_form',
      message: `security S-A1 was consumed by ${tradeId}, which a register choice wrote, so its issuance ISS-A1 is never deleted`,
    });
  });

  it("refuses a state the ledger's invariants refuse", () => {
    const held = bookOf({
      state: {
        holds: [
          {
            hold_id: 'HOLD-2',
            hold_type: 'REGISTER_SETTLEMENT',
            reference: 'trade-1',
            split_epoch: 0,
            quantity: '600',
          },
        ],
      },
    });
    const replay = replayOcf(
      manifestOf([
        ...baseRecords().slice(0, 3),
        json({ ...stockIssuance(), vestings: [{ date: '2030-01-01', amount: '600' }] }),
      ]),
      { capTableId: 'test-1' }
    );
    const unvested: RestateOperation = {
      kind: 'setState',
      state: {
        ...restated('600').state,
        vesting: { kind: 'tranches', tranches: [{ date: '2030-01-01', amount: '600' }] },
      },
    };
    expect(
      checkRestatement({ index: held, view: new IndexView(held), operations: [unvested], replay }).refusals[0]
    ).toMatchObject({ rule: 'held_state', message: expect.stringContaining('above its vested shares') as unknown });
  });

  it('refuses a recreated state without the deletion of the record that ended it', () => {
    const book = bookOf({ state: null, records: [['stockTransfer', stockTransfer()]] });
    const recreate = { ...restated('600'), state: { ...restated('600').state, seq: 3 } } as RestateOperation;
    expect(check(book, [recreate], '600').refusals[0]).toMatchObject({
      rule: 'restatement',
      message: "a restatement recreates security S-A1's state only with the deletion of the record that consumed it",
    });
  });

  it('builds the manifest the replay reads from the same records', () => {
    expect(buildOcfManifest(index()).transactions.map((record) => record.id)).toEqual(['ISS-A1']);
  });
});
