import { OcpValidationError } from '../../src/errors';
import { plannedContractId } from '../../src/register/bookSimulation';
import { deriveId } from '../../src/register/ids';
import { resolveInputs } from '../../src/register/inputs';
import { exceededLimits, planBatches } from '../../src/register/sizing';
import type { ApplyOperation, BookWriteUsage } from '../../src/types/register';
import {
  baseBook,
  CONTEXT,
  document,
  financing,
  stakeholder,
  stockIssuance,
  stockTransfer,
  TestBook,
} from './bookFixtures';

function usage(overrides: Partial<BookWriteUsage> = {}): BookWriteUsage {
  return {
    operations: 1,
    claims: 0,
    shardsCreated: 0,
    tranches: 0,
    polymorphicReferences: 0,
    contractsTouched: 0,
    bytes: 0,
    recordCaps: [],
    ...overrides,
  };
}

function stakeholders(count: number, stem = 'SH-N'): ApplyOperation[] {
  return Array.from({ length: count }, (_, n) => ({
    kind: 'record',
    type: 'stakeholder',
    data: stakeholder(`${stem}-${n}`),
  }));
}

function issuances(
  count: number,
  overrides: (n: number) => Partial<ReturnType<typeof stockIssuance>> = () => ({})
): ApplyOperation[] {
  return Array.from({ length: count }, (_, n) => ({
    kind: 'record',
    type: 'stockIssuance',
    data: stockIssuance({ id: `ISS-N-${n}`, security_id: `S-N-${n}`, custom_id: `CS-N-${n}`, ...overrides(n) }),
  }));
}

function sizes(plan: ReturnType<typeof planBatches>): number[] {
  return plan.batches.map((batch) => batch.operations.length);
}

describe('plannedContractId', () => {
  it('is as long as a ledger contract ID, so a later planned write is not estimated smaller than it is', () => {
    // A ledger issues 138-character contract IDs: a 2-character prefix and 68 bytes in hex
    expect(plannedContractId('planned:0:shard:00110101')).toHaveLength(138);
    expect(plannedContractId('planned:12:state:S-1')).toHaveLength(138);
    // A label already as long as that is left as it is, followed by its colon
    const long = `planned:0:record:${'x'.repeat(200)}`;
    expect(plannedContractId(long)).toBe(`${long}:`);
  });

  it('gives distinct labels distinct IDs', () => {
    const labels = ['planned:0:shard:0', 'planned:0:shard:00', 'planned:0:shard:0:0', 'planned:1:shard:0'];
    expect(new Set(labels.map((label) => plannedContractId(label))).size).toBe(labels.length);
  });
});

describe('exceededLimits', () => {
  it('fits each counted cap at its value and names it one above', () => {
    expect(exceededLimits('apply', usage({ operations: 500 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ operations: 501 }))).toEqual([
      'CapTable_Apply takes at most 500 operations',
    ]);
    expect(exceededLimits('restate', usage({ operations: 600, contractsTouched: 500 }))).toEqual([]);
    expect(exceededLimits('restate', usage({ contractsTouched: 501 }))).toEqual([
      'CapTable_Restate touches at most 500 contracts',
    ]);
    expect(exceededLimits('apply', usage({ claims: 500 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ claims: 501 }))).toEqual(['more than 500 claimed IDs in one transaction']);
    expect(exceededLimits('apply', usage({ tranches: 20000 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ tranches: 20001 }))).toEqual([
      'more than 20000 vesting tranches read or written in one transaction',
    ]);
    expect(exceededLimits('apply', usage({ polymorphicReferences: 100 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ polymorphicReferences: 101 }))).toEqual([
      'more than 100 polymorphic references checked in one transaction',
    ]);
    expect(exceededLimits('apply', usage({ shardsCreated: 4096 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ shardsCreated: 4097 }))).toEqual([
      'more than 4096 ID shards created in one transaction',
    ]);
    expect(exceededLimits('settle', usage({ operations: 50 }))).toEqual([]);
    expect(exceededLimits('settle', usage({ operations: 51 }))).toEqual(['CapTable_Settle takes at most 50 lots']);
    expect(exceededLimits('placeHolds', usage({ operations: 51 }))).toEqual([
      'CapTable_PlaceHolds takes at most 50 lots',
    ]);
    expect(exceededLimits('cancelHolds', usage({ operations: 51 }))).toEqual([
      'CapTable_CancelHolds takes at most 50 holds',
    ]);
  });

  it('keeps the byte budget, 8 MiB unless given, and reports per-record caps', () => {
    expect(exceededLimits('apply', usage({ bytes: 8 * 1024 * 1024 }))).toEqual([]);
    expect(exceededLimits('apply', usage({ bytes: 8 * 1024 * 1024 + 1 }))).toEqual([
      "an estimated 8388609 bytes, over the SDK's batch budget of 8388608 bytes",
    ]);
    expect(exceededLimits('apply', usage({ bytes: 101 }), { byteBudget: 100 })).toHaveLength(1);
    expect(exceededLimits('apply', usage({ recordCaps: ['too big'] }))).toEqual(['too big']);
  });
});

describe('planBatches', () => {
  it('puts 500 operations in one transaction and the 501st in the next', () => {
    const index = new TestBook().index();
    expect(sizes(planBatches(index, stakeholders(500)))).toEqual([500]);
    const plan = planBatches(index, stakeholders(501));
    expect(sizes(plan)).toEqual([500, 1]);
    expect(plan.batches[1]?.sources).toEqual([500]);
    expect(plan.oversized).toBeNull();
  });

  it('puts 500 claimed IDs in one transaction and splits at the 501st', () => {
    const index = baseBook().index();
    const fits = planBatches(index, issuances(250));
    expect(sizes(fits)).toEqual([250]);
    expect(fits.batches[0]?.usage.claims).toBe(500);
    const plan = planBatches(index, issuances(251));
    expect(sizes(plan)).toEqual([250, 1]);
    expect(plan.batches.map((batch) => batch.usage.claims)).toEqual([500, 2]);
  });

  it('counts tranches written by each issuance and its new state: 20,000 fit, more split', () => {
    const index = baseBook().index();
    const vestings = Array.from({ length: 1250 }, () => ({ date: '2025-01-01', amount: '1' }));
    const operations = issuances(9, () => ({ quantity: '1250', vestings }));
    const plan = planBatches(index, operations);
    expect(sizes(plan)).toEqual([8, 1]);
    expect(plan.batches[0]?.usage.tranches).toBe(20000);
    expect(plan.batches[1]?.usage.tranches).toBe(2500);
  });

  it('checks 100 polymorphic references in one transaction and moves the 101st to the next', () => {
    const book = new TestBook();
    for (let n = 0; n < 101; n++) book.record('stakeholder', stakeholder(`SH-${n}`));
    const index = book.index();
    const ids = (from: number, count: number): string[] => Array.from({ length: count }, (_, n) => `SH-${from + n}`);
    const plan = planBatches(index, [
      { kind: 'record', type: 'document', data: document('DOC-1', ids(0, 60)) },
      { kind: 'record', type: 'document', data: document('DOC-2', ids(60, 40)) },
      { kind: 'record', type: 'document', data: document('DOC-3', ids(100, 1)) },
    ]);
    expect(sizes(plan)).toEqual([2, 1]);
    expect(plan.batches.map((batch) => batch.usage.polymorphicReferences)).toEqual([100, 1]);
  });

  it('creates a financing of more than 100 references with 100, then extends it by restatements', () => {
    const book = baseBook();
    for (let n = 0; n < 250; n++) {
      book.record(
        'stockIssuance',
        stockIssuance({ id: `ISS-F-${n}`, security_id: `S-F-${n}`, custom_id: `CS-F-${n}` })
      );
    }
    const index = book.index();
    const all = Array.from({ length: 250 }, (_, n) => `ISS-F-${n}`);
    const plan = planBatches(index, [
      ...stakeholders(2),
      { kind: 'record', type: 'financing', data: financing('FIN-1', all) },
      ...stakeholders(1, 'SH-AFTER'),
    ]);

    expect(plan.oversized).toBeNull();
    expect(plan.batches.map((batch) => batch.kind)).toEqual(['apply', 'restate', 'restate', 'apply']);
    expect(plan.batches.map((batch) => batch.sources)).toEqual([[0, 1, 2], [2], [2], [3]]);
    const [create, first, second] = plan.batches;
    expect(create?.operations[2]).toEqual({
      kind: 'record',
      type: 'financing',
      data: financing('FIN-1', all.slice(0, 100)),
    });
    expect(first?.operations).toEqual([
      { kind: 'edit', type: 'financing', data: financing('FIN-1', all.slice(0, 200)) },
    ]);
    expect(second?.operations).toEqual([{ kind: 'edit', type: 'financing', data: financing('FIN-1', all) }]);
    expect(plan.batches.map((batch) => batch.usage.polymorphicReferences)).toEqual([100, 100, 50, 0]);
    // Each extension edits the record the earlier batch created: one archive, one create.
    expect(first?.usage.contractsTouched).toBe(2);
  });

  it('reports a financing over the 1,000 references a record stores as oversized', () => {
    const index = baseBook().index();
    const plan = planBatches(index, [
      ...stakeholders(1),
      {
        kind: 'record',
        type: 'financing',
        data: financing(
          'FIN-1',
          Array.from({ length: 1001 }, (_, n) => `ISS-${n}`)
        ),
      },
    ]);
    expect(sizes(plan)).toEqual([1]);
    expect(plan.oversized).toEqual({
      index: 1,
      kind: 'record',
      exceeded: [
        'more than 100 polymorphic references checked in one transaction',
        'OcfObjectTypeFinancing has 1001 financing issuance IDs; at most 1000',
      ],
    });
  });

  it('keeps each transaction within the byte budget', () => {
    const index = new TestBook().index();
    const budget = resolveInputs(index, { kind: 'apply', operations: stakeholders(3) }).usage.bytes;
    const plan = planBatches(index, stakeholders(4), { byteBudget: budget });
    expect(sizes(plan)).toEqual([3, 1]);
    expect(plan.batches[0]?.usage.bytes).toBe(budget);
  });

  it('reports one operation that fits in no transaction, planning only the operations before it', () => {
    const index = new TestBook().index();
    const huge = 'x'.repeat(9 * 1024 * 1024);
    const plan = planBatches(index, [
      ...stakeholders(2),
      { kind: 'record', type: 'document', data: document('DOC-1', [], [huge]) },
      ...stakeholders(1, 'SH-AFTER'),
    ]);
    expect(sizes(plan)).toEqual([2]);
    expect(plan.oversized?.index).toBe(2);
    expect(plan.oversized?.exceeded[0]).toMatch(
      /^an estimated \d+ bytes, over the SDK's batch budget of 8388608 bytes$/
    );

    const tranches = Array.from({ length: 1501 }, () => ({ date: '2025-01-01', amount: '1' }));
    const overCap = planBatches(
      baseBook().index(),
      issuances(1, () => ({ quantity: '1501', vestings: tranches }))
    );
    expect(overCap.oversized?.exceeded).toEqual([
      'OcfObjectTypeTxStockIssuance has 1501 vesting tranches; at most 1500',
    ]);
  });

  it('never splits a bundled stock event, and plans a later batch on what the earlier ones create', () => {
    const index = baseBook().index();
    const transferId = deriveId({
      capTableId: CONTEXT.cap_table_id,
      securityId: 'S-NEW',
      seq: 0,
      role: 'event',
      index: 0,
    });
    const operations: ApplyOperation[] = [
      { kind: 'record', type: 'stakeholder', data: stakeholder('SH-NEW') },
      {
        kind: 'record',
        type: 'stockIssuance',
        data: stockIssuance({ id: 'ISS-NEW', security_id: 'S-NEW', custom_id: 'CS-NEW', stakeholder_id: 'SH-NEW' }),
      },
      {
        kind: 'stockTransfer',
        transfer: stockTransfer({
          id: transferId,
          security_id: 'S-NEW',
          quantity: '200',
          resulting_security_ids: ['S-T1'],
          balance_security_id: 'S-T2',
        }),
        resulting: [
          stockIssuance({
            id: 'ISS-T1',
            security_id: 'S-T1',
            custom_id: 'CS-T1',
            date: '2024-03-01',
            quantity: '200',
            stakeholder_id: 'SH-B',
          }),
        ],
        balance: stockIssuance({
          id: 'ISS-T2',
          security_id: 'S-T2',
          custom_id: 'CS-T2',
          date: '2024-03-01',
          quantity: '400',
          stakeholder_id: 'SH-NEW',
        }),
      },
    ];
    // 499 claims before the transfer, whose four writer-chosen IDs take the batch over 500.
    operations.splice(2, 0, ...issuances(248));
    const plan = planBatches(index, operations);

    expect(sizes(plan)).toEqual([250, 1]);
    expect(plan.batches[0]?.usage.claims).toBe(499);
    const transfer = plan.batches[1];
    expect(transfer?.operations[0]?.kind).toBe('stockTransfer');
    // The transfer reads the state and the stakeholder the first batch creates: they are inputs of the second.
    expect(transfer?.usage.claims).toBe(4);
    expect(transfer?.usage.contractsTouched).toBeGreaterThan(5);
  });

  it('refuses a batch whose record references one that only a later batch creates', () => {
    const index = baseBook().index();
    const operations: ApplyOperation[] = [
      {
        kind: 'record',
        type: 'stockIssuance',
        data: stockIssuance({ id: 'ISS-N', security_id: 'S-N', stakeholder_id: 'SH-LATER' }),
      },
      { kind: 'record', type: 'stakeholder', data: stakeholder('SH-LATER') },
    ];
    expect(sizes(planBatches(index, operations))).toEqual([2]);
    const budget = resolveInputs(index, {
      kind: 'apply',
      operations: [{ kind: 'record', type: 'stockIssuance', data: stockIssuance({ id: 'ISS-N', security_id: 'S-N' }) }],
    }).usage.bytes;
    expect(() => planBatches(index, operations, { byteBudget: budget + 200 })).toThrow(OcpValidationError);
    expect(() => planBatches(index, operations, { byteBudget: budget + 200 })).toThrow(
      'Stock issuance stakeholder not found: SH-LATER'
    );
  });
});
