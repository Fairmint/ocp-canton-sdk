/**
 * Replication planning on key indexes built directly: each restatement limit refused with its reason, a correction
 * above one restatement's caps written in several (the groups that must stay together, records joining a definition's
 * correction only through a reference it can flip, each part one the writer's checks accept over the book the parts
 * before it leave, the operations that can move a ceiling written apart when together they fit no restatement, and a
 * group too large for one refused), the history a book already holds refusing a create, a source that does not replay,
 * pre-splits for a large book, the snapshot and `accelerated_since_snapshot` a restated lot states, edits that name
 * records to create, and a restatement checked against the replay.
 */

import { OcpErrorCodes } from '../../src/errors';
import { IndexView, simulateWrite } from '../../src/register/bookSimulation';
import { writeViolations } from '../../src/register/checks/write';
import type { RegisterIndex } from '../../src/register/registerIndex';
import { replayOcf } from '../../src/register/replay/replay';
import { planReplication } from '../../src/register/replication/plan';
import { checkRestatement, packRestatement, restatementGroups } from '../../src/register/replication/restatement';
import type { ReplicationPlan, ReplicationRefusalRule } from '../../src/register/replication/types';
import { planBatches } from '../../src/register/sizing';
import type {
  OcfStockClass,
  OcfStockClassSplit,
  OcfStockIssuance,
  OcfStockTransfer,
  OcfVestingAcceleration,
  OcfVestingTerms,
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
  stockPlan,
  stockState,
  stockTransfer,
  TestBook,
  vestingStart,
  vestingTerms,
  warrantIssuance,
} from './bookFixtures';
import { CHECKS, issuerRecord, option, optionExercise, rulesOf } from './checkFixtures';
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

  it('writes a bulk correction of stock issuances that moves no ceiling in several restatements', async () => {
    const issuances = Array.from({ length: 251 }, (_, n) =>
      stockIssuance({ id: `ISS-${n}`, security_id: `S-${n}`, custom_id: `CS-${n}`, quantity: '100' })
    );
    const book = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A');
    for (const issuance of issuances) {
      book.record('stockIssuance', issuance);
      book.state(
        stockState({ security_id: issuance.security_id, origin_transaction_id: issuance.id, quantity: '100' })
      );
    }
    const index = anchoredIndex(book);
    const source = (edit: (issuance: OcfStockIssuance) => OcfStockIssuance): OcfJson[] => [
      json(stakeholder('SH-A')),
      json(stockClass('CLS-A')),
      ...issuances.map((issuance) => json(edit(issuance))),
    ];

    const commented = await planFor(
      index,
      source((issuance) => ({ ...issuance, comments: ['Corrected in PostgreSQL'] }))
    );
    expect(commented).toMatchObject({ status: 'ready', refusals: [] });
    const restated = commented.steps.map((step) => (step.kind === 'restate' ? step.recordIds : []));
    expect(restated.map((ids) => ids.length)).toEqual([250, 1]);
    expect(restated.flat()).toEqual(issuances.map((issuance) => issuance.id));
    const view = new IndexView(index);
    expect(
      commented.steps.map((step) =>
        step.kind === 'restate'
          ? simulateWrite(view, { kind: 'restate', operations: step.operations }).usage().contractsTouched
          : null
      )
    ).toEqual([500, 2]);

    // A rename of the class or holder every lot names breaks no reference to it, so it ties no lot to another.
    for (const definitions of [
      [json(stakeholder('SH-A')), json({ ...stockClass('CLS-A'), name: 'Common A (fixed)' })],
      [json({ ...stakeholder('SH-A'), name: { legal_name: 'A fixed' } }), json(stockClass('CLS-A'))],
    ]) {
      const renamed = await planFor(index, [
        ...definitions,
        ...issuances.map((issuance) => json({ ...issuance, comments: ['Corrected in PostgreSQL'] })),
      ]);
      expect(renamed).toMatchObject({ status: 'ready', refusals: [] });
      expect(renamed.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : 0))).toEqual([250, 2]);
    }

    // A new quantity on every lot moves the class's outstanding shares: those edits and the states they restate fit no
    // restatement together, so each lot is written apart, every part within the class's authorized shares.
    const raised = await planFor(
      index,
      source((issuance) => ({ ...issuance, quantity: '101' }))
    );
    expect(raised).toMatchObject({ status: 'ready', refusals: [] });
    expect(raised.steps.flatMap((step) => (step.kind === 'restate' ? step.recordIds : []))).toEqual(
      issuances.map((issuance) => issuance.id)
    );
    expect(raised.steps.length).toBeGreaterThan(1);
  });

  it('writes a bulk correction of dates, deletes or vesting records apart when each part keeps every ceiling', async () => {
    const lots = Array.from({ length: 400 }, (_, n) =>
      stockIssuance({ id: `ISS-${n}`, security_id: `S-${n}`, custom_id: `CS-${n}`, quantity: '100' })
    );
    const book = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A');
    for (const lot of lots) {
      book.record('stockIssuance', lot);
      book.state(stockState({ security_id: lot.security_id, origin_transaction_id: lot.id, quantity: '100' }));
    }
    const index = anchoredIndex(book);
    const definitions = [json(stakeholder('SH-A')), json(stockClass('CLS-A'))];

    const redated = await planFor(index, [...definitions, ...lots.map((lot) => json({ ...lot, date: '2024-01-02' }))]);
    expect(redated).toMatchObject({ status: 'ready', refusals: [] });
    expect(redated.steps.flatMap((step) => (step.kind === 'restate' ? step.recordIds : []))).toHaveLength(400);

    const pruned = await planFor(index, [...definitions, ...lots.slice(300).map(json)]);
    expect(pruned).toMatchObject({ status: 'ready', refusals: [] });
    expect(pruned.steps.flatMap((step) => (step.kind === 'restate' ? step.recordIds : []))).toEqual(
      lots.slice(0, 300).map((lot) => lot.id)
    );

    const grants = Array.from({ length: 251 }, (_, n) =>
      option(`O-${n}`, '100', { id: `ECI-${n}`, stock_plan_id: 'PLAN-1', vesting_terms_id: 'VT-1' })
    );
    const starts = grants.map((grant, n) => vestingStart(`VS-${n}`, grant.security_id));
    const plans = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockPlan', stockPlan('PLAN-1', ['CLS-A']))
      .record('vestingTerms', vestingTerms('VT-1'));
    for (const grant of grants) plans.record('equityCompensationIssuance', grant);
    for (const start of starts) plans.record('vestingStart', start);
    const restarted = await planFor(anchoredIndex(plans), [
      ...definitions,
      json(stockPlan('PLAN-1', ['CLS-A'])),
      json(vestingTerms('VT-1')),
      ...grants.map(json),
      ...starts.map((start) => json({ ...start, date: '2024-06-02' })),
    ]);
    expect(restarted).toMatchObject({ status: 'ready', refusals: [] });
    expect(restarted.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : 0))).toEqual([250, 1]);
  });

  it('refuses a bulk correction whose parts, written apart, would each break a ceiling the whole keeps', async () => {
    // 260 lots at the class's 26,000 authorized shares: the first 130 grow by one share, the last 130 shrink by one.
    const lots = Array.from({ length: 260 }, (_, n) =>
      stockIssuance({ id: `ISS-${n}`, security_id: `S-${n}`, custom_id: `CS-${n}`, quantity: '100' })
    );
    const full = { ...stockClass('CLS-A'), initial_shares_authorized: '26000' };
    const book = new TestBook().record('stakeholder', stakeholder('SH-A')).record('stockClass', full).epoch('CLS-A');
    for (const lot of lots) {
      book.record('stockIssuance', lot);
      book.state(stockState({ security_id: lot.security_id, origin_transaction_id: lot.id, quantity: '100' }));
    }
    const plan = await planFor(anchoredIndex(book), [
      json(stakeholder('SH-A')),
      json(full),
      ...lots.map((lot, n) => json({ ...lot, quantity: n < 130 ? '101' : '99' })),
    ]);
    expectRefused(plan, 'too_large', "A correction whose records and states change together exceeds one restatement's");
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

  it('groups a state with the records that restate it, and the records they name only to delete or create them', () => {
    const book = bookOf({ records: [['stakeholder', stakeholder('SH-C')]] });
    // A rename keeps the record a reference needs, so the lot naming SH-A waits for nothing its rename does.
    expect(restatementGroups(book, [rename('SH-B'), raised, restated, rename('SH-A'), rename('SH-C')])).toEqual([
      [rename('SH-B')],
      [raised, restated],
      [rename('SH-A')],
      [rename('SH-C')],
    ]);
    // A delete of a record the lot names, or the edit creating the holder it moves to, goes with it.
    const deleted: RestateOperation = { kind: 'delete', objectId: 'SH-A' };
    expect(restatementGroups(book, [rename('SH-B'), raised, restated, deleted])).toEqual([
      [rename('SH-B')],
      [raised, restated, deleted],
    ]);
    const created: RestateOperation = { kind: 'edit', type: 'stakeholder', data: stakeholder('SH-D') };
    const moved: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: { ...stockIssuance(), stakeholder_id: 'SH-D' },
    };
    expect(restatementGroups(book, [moved, rename('SH-A'), created])).toEqual([[moved, created], [rename('SH-A')]]);
  });

  it('puts the operations that can move a ceiling in one group, and an edit that moves none apart', () => {
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
    // A restated state moves a ceiling only with its quantity, class or last event date.
    const rehomed: RestateOperation = {
      kind: 'setState',
      state: {
        security_id: 'S-A1',
        issue_date: '2024-01-01',
        last_event_date: '2024-01-01',
        origin_transaction_id: 'ISS-A1',
        quantity: '600',
        stakeholder_id: 'SH-B',
        stock_class_id: 'CLS-A',
        vesting: { kind: 'none' },
        snapshot: null,
        accelerated_since_snapshot: null,
      },
    };
    expect(restatementGroups(book, [raised, rename('SH-B'), other, reclassed])).toEqual([
      [raised, reclassed],
      [rename('SH-B')],
      [other],
    ]);
    expect(restatementGroups(book, [reclassed, rehomed, other])).toEqual([[reclassed], [rehomed], [other]]);
  });

  it('groups vesting terms with the vesting records that name their conditions through their security', () => {
    const milestone = {
      object_type: 'TX_VESTING_EVENT',
      id: 'VE-1',
      date: '2024-09-01',
      security_id: 'WS-1',
      vesting_condition_id: 'milestone',
    } as const;
    const book = bookOf({
      records: [
        ['vestingTerms', vestingTerms('VT-1')],
        ['warrantIssuance', warrantIssuance('W-1', 'WS-1', { vesting_terms_id: 'VT-1' })],
        ['vestingStart', vestingStart('VS-1', 'WS-1')],
        ['vestingEvent', milestone],
      ],
    });
    const terms = vestingTerms('VT-1');
    const [start, ...rest] = terms.vesting_conditions;
    const dropped: RestateOperation = {
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...terms, vesting_conditions: [{ ...start, next_condition_ids: [] }] },
    };
    const renamed: RestateOperation = {
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...terms, vesting_conditions: [{ ...start, id: 'begin' }, ...terms.vesting_conditions.slice(1)] },
    };
    const begun: RestateOperation = { kind: 'edit', type: 'vestingStart', data: vestingStart('VS-1', 'WS-1', 'begin') };
    const deleted: RestateOperation = { kind: 'delete', objectId: 'VE-1' };

    // The writer re-checks the vesting records on the securities of the issuances naming edited terms.
    expect(restatementGroups(book, [dropped, rename('SH-B'), deleted])).toEqual([[dropped, deleted], [rename('SH-B')]]);
    // And the ledger checks an edited vesting record's condition against the terms as the restatement leaves them.
    expect(restatementGroups(book, [begun, rename('SH-B'), renamed])).toEqual([[begun, renamed], [rename('SH-B')]]);
    // Terms edited without touching their conditions break no vesting record, so neither waits for the other.
    const described: RestateOperation = {
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...terms, description: 'Fixed' },
    };
    const commented: RestateOperation = {
      kind: 'edit',
      type: 'vestingStart',
      data: { ...vestingStart('VS-1', 'WS-1'), comments: ['fixed'] },
    };
    expect(restatementGroups(book, [described, rename('SH-B'), commented])).toEqual([
      [described],
      [rename('SH-B')],
      [commented],
    ]);
    // Nor do terms edited in what no reference reads of a condition: only its ID and trigger type are checked.
    const retellings: Array<OcfVestingTerms['vesting_conditions']> = [
      [{ ...start, description: 'Start (fixed)' }, ...rest],
      [start, { id: 'milestone', trigger: { type: 'VESTING_EVENT' }, quantity: '90', next_condition_ids: [] }],
    ];
    for (const conditions of retellings) {
      const retold: RestateOperation = {
        kind: 'edit',
        type: 'vestingTerms',
        data: { ...terms, vesting_conditions: conditions },
      };
      const warranted: RestateOperation = {
        kind: 'edit',
        type: 'warrantIssuance',
        data: warrantIssuance('W-1', 'WS-1', { vesting_terms_id: 'VT-1', comments: ['fixed'] }),
      };
      expect(restatementGroups(book, [retold, warranted, commented])).toEqual([[retold], [warranted, commented]]);
    }
  });

  it('groups an issuance moved to or from vesting terms with their edit when it changes a condition', () => {
    const terms = vestingTerms('VT-2');
    const [start] = terms.vesting_conditions;
    const book = bookOf({
      records: [
        ['vestingTerms', vestingTerms('VT-1')],
        ['vestingTerms', { ...terms, vesting_conditions: [{ ...start, next_condition_ids: [] }] }],
        ['warrantIssuance', warrantIssuance('W-1', 'WS-1', { vesting_terms_id: 'VT-1' })],
        ['vestingStart', vestingStart('VS-1', 'WS-1')],
        [
          'vestingEvent',
          {
            object_type: 'TX_VESTING_EVENT',
            id: 'VE-1',
            date: '2024-09-01',
            security_id: 'WS-1',
            vesting_condition_id: 'milestone',
          },
        ],
      ],
    });
    // VE-1 names the milestone VT-2 gains: written before it, the warrant would leave VE-1 on terms without it.
    const widened: RestateOperation = { kind: 'edit', type: 'vestingTerms', data: terms };
    const moved: RestateOperation = {
      kind: 'edit',
      type: 'warrantIssuance',
      data: warrantIssuance('W-1', 'WS-1', { vesting_terms_id: 'VT-2' }),
    };
    expect(restatementGroups(book, [moved, rename('SH-B'), widened])).toEqual([[moved, widened], [rename('SH-B')]]);
    // Its old terms changing a condition go with it too, but neither waits for terms edited in no condition.
    const narrowed: RestateOperation = {
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...vestingTerms('VT-1'), vesting_conditions: [{ ...start, next_condition_ids: [] }] },
    };
    expect(restatementGroups(book, [moved, narrowed, widened])).toEqual([[moved, narrowed, widened]]);
    const described: RestateOperation = {
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...terms, vesting_conditions: [{ ...start, description: 'Start (fixed)', next_condition_ids: [] }] },
    };
    expect(restatementGroups(book, [moved, described])).toEqual([[moved], [described]]);
  });

  it("joins a plan's or class's edit only with the records whose references it can flip", () => {
    const preferred: OcfStockClass = { ...stockClass('CLS-P'), class_type: 'PREFERRED' };
    const book = bookOf({
      records: [
        ['stockClass', preferred],
        ['stockClass', stockClass('CLS-B')],
        ['stockPlan', stockPlan('P-1', ['CLS-A'])],
        ['equityCompensationIssuance', option('EC-1', '10', { stock_plan_id: 'P-1' })],
        [
          'stockIssuance',
          stockIssuance({ id: 'ISS-P1', security_id: 'S-P1', custom_id: 'CS-P1', stock_class_id: 'CLS-P' }),
        ],
      ],
    });
    const granted: RestateOperation = {
      kind: 'edit',
      type: 'equityCompensationIssuance',
      data: option('EC-1', '10', { stock_plan_id: 'P-1', comments: ['fixed'] }),
    };
    // A plan that keeps the grant's class breaks no grant under it; one that drops it does.
    const widened: RestateOperation = { kind: 'edit', type: 'stockPlan', data: stockPlan('P-1', ['CLS-A', 'CLS-B']) };
    expect(restatementGroups(book, [widened, granted])).toEqual([[widened], [granted]]);
    const moved: RestateOperation = { kind: 'edit', type: 'stockPlan', data: stockPlan('P-1', ['CLS-B']) };
    expect(restatementGroups(book, [moved, granted])).toEqual([[moved, granted]]);
    // A class's conversion right is read only by a ratio adjustment, so the class's lots never wait for it.
    const lot: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: stockIssuance({
        id: 'ISS-P1',
        security_id: 'S-P1',
        custom_id: 'CS-P1',
        stock_class_id: 'CLS-P',
        comments: ['fixed'],
      }),
    };
    const converting: RestateOperation = {
      kind: 'edit',
      type: 'stockClass',
      data: {
        ...preferred,
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            converts_to_stock_class_id: 'CLS-A',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '1', denominator: '1' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
          },
        ],
      },
    };
    expect(restatementGroups(book, [converting, lot])).toEqual([[converting], [lot]]);
  });

  it('writes an edit that stops naming a deleted record apart from the delete, and the deletes of its referrers with it', () => {
    const book = bookOf({
      records: [
        ['stakeholder', stakeholder('SH-X')],
        [
          'stockIssuance',
          stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2', stakeholder_id: 'SH-X' }),
        ],
        [
          'stockIssuance',
          stockIssuance({ id: 'ISS-A3', security_id: 'S-A3', custom_id: 'CS-A3', stakeholder_id: 'SH-X' }),
        ],
      ],
    });
    const moved: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2', stakeholder_id: 'SH-A' }),
    };
    const gone: RestateOperation = { kind: 'delete', objectId: 'ISS-A3' };
    const dropped: RestateOperation = { kind: 'delete', objectId: 'SH-X' };
    expect(restatementGroups(book, [moved, gone, dropped], false)).toEqual([[moved], [gone, dropped]]);
    // An edit that keeps naming it goes with it.
    const kept: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: stockIssuance({
        id: 'ISS-A2',
        security_id: 'S-A2',
        custom_id: 'CS-A2',
        stakeholder_id: 'SH-X',
        comments: ['fixed'],
      }),
    };
    expect(restatementGroups(book, [kept, dropped], false)).toEqual([[kept, dropped]]);
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

  it("packs a part only when the writer's checks accept it over the book as the parts before it leave it", () => {
    // SH-C holds S-A1, so its delete waits for the restated state that moves S-A1 to SH-A; no reference joins them.
    const book = bookOf({ records: [['stakeholder', stakeholder('SH-C')]], state: { stakeholder_id: 'SH-C' } });
    const view = new IndexView(book);
    const deleted: RestateOperation = { kind: 'delete', objectId: 'SH-C' };
    const moved: RestateOperation = {
      kind: 'setState',
      state: {
        security_id: 'S-A1',
        issue_date: '2024-01-01',
        last_event_date: '2024-01-01',
        origin_transaction_id: 'ISS-A1',
        quantity: '600',
        stakeholder_id: 'SH-A',
        stock_class_id: 'CLS-A',
        vesting: { kind: 'none' },
        snapshot: null,
        accelerated_since_snapshot: null,
      },
    };
    const operations = [rename('SH-B'), deleted, moved];
    expect(restatementGroups(book, operations)).toEqual([[rename('SH-B')], [deleted], [moved]]);
    const bytes = (part: RestateOperation[]): number =>
      simulateWrite(view, { kind: 'restate', operations: part }).usage().bytes;
    const pairs = Math.max(bytes([rename('SH-B'), deleted]), bytes([deleted, moved]));
    expect(bytes(operations)).toBeGreaterThan(pairs);

    const packed = packRestatement(book, view, operations, { byteBudget: pairs });
    expect(packed.refusals).toEqual([]);
    expect(packed.parts.map((part) => part.operations)).toEqual([[rename('SH-B')], [deleted, moved]]);
    expect(writeViolations(book, { kind: 'restate', operations: [rename('SH-B'), deleted] }, CHECKS)).toEqual([
      expect.objectContaining({ rule: 'stakeholder_holds', subject: 'SH-C' }),
    ]);

    // Apart from the state, the delete fits but the writer refuses it, and with the state it exceeds the caps.
    const single = Math.max(...operations.map((operation) => bytes([operation])));
    expect(packRestatement(book, view, operations, { byteBudget: single }).refusals).toEqual([
      {
        rule: 'too_large',
        message: expect.stringContaining(
          'Stakeholder SH-C still holds 1 outstanding stock securities (S-A1)'
        ) as unknown,
        recordIds: ['SH-C'],
        securityIds: [],
      },
    ]);
  });

  it('checks a later part over the states the parts before it leave', () => {
    // SH-C holds S-A1 until the first part moves it to SH-A, with its issuance's edit; the delete, packed after it (the
    // planner writes edits, deletes, then states), is checked over the book that part leaves.
    const book = bookOf({ records: [['stakeholder', stakeholder('SH-C')]], state: { stakeholder_id: 'SH-C' } });
    const view = new IndexView(book);
    const commented: RestateOperation = {
      kind: 'edit',
      type: 'stockIssuance',
      data: { ...stockIssuance(), comments: ['corrected'] },
    };
    const deleted: RestateOperation = { kind: 'delete', objectId: 'SH-C' };
    const moved: RestateOperation = {
      kind: 'setState',
      state: {
        security_id: 'S-A1',
        issue_date: '2024-01-01',
        last_event_date: '2024-01-01',
        origin_transaction_id: 'ISS-A1',
        quantity: '600',
        stakeholder_id: 'SH-A',
        stock_class_id: 'CLS-A',
        vesting: { kind: 'none' },
        snapshot: null,
        accelerated_since_snapshot: null,
      },
    };
    const operations = [commented, deleted, moved];
    expect(restatementGroups(book, operations)).toEqual([[commented, moved], [deleted]]);
    const bytes = (part: RestateOperation[]): number =>
      simulateWrite(view, { kind: 'restate', operations: part }).usage().bytes;
    const budget = bytes([commented, moved]);
    expect(bytes(operations)).toBeGreaterThan(budget);

    const packed = packRestatement(book, view, operations, { byteBudget: budget });
    expect(packed.refusals).toEqual([]);
    expect(packed.parts.map((part) => part.operations)).toEqual([[commented, moved], [deleted]]);
  });

  it("writes the operations that can move a ceiling apart only in parts the writer's instruments check accepts", () => {
    // EC-1 names no class, so its 100 options follow its plan's only class: moved to CLS-A, they double in its split of
    // 2025-01-01, and the exercise grown to 150 fits only once the plan is edited.
    const { stock_class_id: _stockClassId, ...grant } = option('EC-1', '100', { stock_plan_id: 'P-1' });
    const book = anchoredIndex(
      new TestBook()
        .record('stakeholder', stakeholder('SH-A'))
        .record('stockClass', stockClass('CLS-A'))
        .record('stockClass', stockClass('CLS-B'))
        .record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2025-01-01'))
        .epoch('CLS-A', { splits: [split('SPLIT-1', '2025-01-01', '2', '1')] })
        .epoch('CLS-B')
        .record('stockPlan', stockPlan('P-1', ['CLS-B']))
        .record('equityCompensationIssuance', grant)
        .record('equityCompensationExercise', optionExercise('EX-1', 'EC-1', '90', '2025-06-01'))
    );
    const view = new IndexView(book);
    const replanned: RestateOperation = { kind: 'edit', type: 'stockPlan', data: stockPlan('P-1', ['CLS-A']) };
    const exercised: RestateOperation = {
      kind: 'edit',
      type: 'equityCompensationExercise',
      data: optionExercise('EX-1', 'EC-1', '150', '2025-06-01'),
    };
    expect(restatementGroups(book, [replanned, exercised])).toEqual([[replanned, exercised]]);
    expect(restatementGroups(book, [replanned, exercised], false)).toEqual([[replanned], [exercised]]);
    expect(writeViolations(book, { kind: 'restate', operations: [replanned, exercised] }, CHECKS)).toEqual([]);
    expect(rulesOf(writeViolations(book, { kind: 'restate', operations: [exercised] }, CHECKS))).toEqual([
      'exceeds_remaining',
    ]);
    const bytes = (part: RestateOperation[]): number =>
      simulateWrite(view, { kind: 'restate', operations: part }).usage().bytes;
    const budget = Math.max(bytes([replanned]), bytes([exercised]));
    expect(bytes([replanned, exercised])).toBeGreaterThan(budget);

    const packed = packRestatement(book, view, [replanned, exercised], { byteBudget: budget });
    expect(packed.refusals).toEqual([]);
    expect(packed.parts.map((part) => part.operations)).toEqual([[replanned], [exercised]]);
    // The exercise first would exceed the grant before the plan moves it to the split class.
    expect(packRestatement(book, view, [exercised, replanned], { byteBudget: budget }).refusals).toEqual([
      expect.objectContaining({ rule: 'too_large', recordIds: ['EX-1', 'P-1'] }),
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
  /** A document naming SH-A and, when given, a record that is not a stakeholder. */
  const namingIssuance = (id: string, issuanceId?: string): OcfJson =>
    json({
      ...document(id, ['SH-A']),
      related_objects: [
        { object_type: 'STAKEHOLDER', object_id: 'SH-A' },
        ...(issuanceId === undefined ? [] : [{ object_type: 'TX_STOCK_ISSUANCE', object_id: issuanceId }]),
      ],
    });
  const newIssuance = json(
    stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', custom_id: 'CS-A2', date: '2024-02-01' })
  );

  it('writes a document edit that names a new dated record in a last restatement', async () => {
    const index = bookOf({ records: [['document', document('DOC-1', ['SH-A'])]] });
    const plan = await planFor(index, [...baseRecords(), newIssuance, namingIssuance('DOC-1', 'ISS-A2')]);
    expect(plan.status).toBe('ready');
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: 'apply', recordIds: ['ISS-A2'] }),
      expect.objectContaining({ kind: 'restate', recordIds: ['DOC-1'], securityIds: [] }),
    ]);
  });

  it('packs the last restatement within the caps', async () => {
    const ids = Array.from({ length: 251 }, (_, n) => `DOC-${n}`);
    const index = bookOf({
      records: ids.map((id): Parameters<TestBook['record']> => ['document', document(id, ['SH-A'])]),
    });
    const plan = await planFor(index, [
      ...baseRecords(),
      newIssuance,
      ...ids.map((id) => namingIssuance(id, 'ISS-A2')),
    ]);
    expect(plan).toMatchObject({ status: 'ready', refusals: [] });
    // Each edit checks the one reference it adds, and a restatement checks at most 100.
    expect(plan.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
      'apply',
      100,
      100,
      51,
    ]);
    expect(plan.steps.flatMap((step) => (step.kind === 'restate' ? step.recordIds : []))).toEqual(ids);
  });

  it('writes a document moved from a deleted stakeholder to a new one with the delete, after the new stakeholder', async () => {
    const index = bookOf({
      records: [
        ['stakeholder', stakeholder('SH-X')],
        ['document', document('DOC-1', ['SH-X'])],
      ],
    });
    const plan = await planFor(index, [...baseRecords(), json(stakeholder('SH-C')), json(document('DOC-1', ['SH-C']))]);
    expect(plan).toMatchObject({ status: 'ready', refusals: [] });
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: 'apply', recordIds: ['SH-C'] }),
      expect.objectContaining({ kind: 'restate', recordIds: ['DOC-1', 'SH-X'], securityIds: [] }),
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
