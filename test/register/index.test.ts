import { OcpContractError, OcpValidationError } from '../../src/errors';
import { admitContract } from '../../src/register/admission';
import { simulatePreSplit } from '../../src/register/ids';
import { RegisterIndex } from '../../src/register/registerIndex';
import type { RegisterContext, RegisterTransaction } from '../../src/types/register';
import {
  anchorEvent,
  BOOK_DATA,
  bookEvents,
  COMMON_CLASS_ID,
  CONTEXT,
  epochEvent,
  FOREIGN_CONTEXT,
  FOUNDERS_SECURITY_ID,
  HOLD_DATA,
  recordEvent,
  shardEvent,
  STAKEHOLDER_CLAIM,
  STAKEHOLDER_ID,
  STAKEHOLDER_SHARD_PREFIX,
  stateEvent,
} from './registerLedgerFixtures';

function admitted(event: unknown) {
  const result = admitContract(event, { requireView: true });
  if (!result.ok) throw new Error(`not admitted: ${result.rejection.message}`);
  return result.contract;
}

function indexOf(
  events: unknown[],
  options: { context?: RegisterContext; offset?: number; retainPayloads?: boolean } = {}
): RegisterIndex {
  const index = new RegisterIndex({
    context: options.context ?? CONTEXT,
    offset: options.offset ?? 50,
    ...(options.retainPayloads !== undefined ? { retainPayloads: options.retainPayloads } : {}),
  });
  for (const event of events) index.add(admitted(event));
  return index;
}

function withoutContract(contractId: string): Array<Record<string, unknown>> {
  return bookEvents().filter((event) => event.contractId !== contractId);
}

describe('RegisterIndex flags', () => {
  it('flags nothing on a genuine, complete book', () => {
    expect(indexOf(bookEvents()).flags()).toEqual([]);
  });

  it('flags a missing anchor and two anchors', () => {
    expect(indexOf(withoutContract('cid-anchor')).flags()).toEqual([{ kind: 'missing_anchor' }]);
    const twice = indexOf([...bookEvents(), anchorEvent('cid-anchor-2')]);
    expect(twice.flags()).toEqual([{ kind: 'duplicate_anchor', contractIds: ['cid-anchor', 'cid-anchor-2'] }]);
    expect(() => twice.anchor).toThrow(OcpContractError);
  });

  it('flags duplicate states and object IDs, and refuses to pick one', () => {
    const index = indexOf([
      ...bookEvents(),
      stateEvent('cid-state-2', { seq: '5' }),
      recordEvent('cid-stakeholder-2', 'stakeholder', BOOK_DATA.stakeholder, { offset: 7 }),
    ]);

    expect(index.flags()).toEqual([
      { kind: 'duplicate_object_id', objectId: STAKEHOLDER_ID, contractIds: ['cid-stakeholder', 'cid-stakeholder-2'] },
      { kind: 'duplicate_state', securityId: FOUNDERS_SECURITY_ID, contractIds: ['cid-state', 'cid-state-2'] },
    ]);
    expect(() => index.stateOf(FOUNDERS_SECURITY_ID)).toThrow(
      expect.objectContaining({ classification: 'ambiguous_register_key' })
    );
    expect(() => index.record(STAKEHOLDER_ID)).toThrow(OcpContractError);
  });

  it('flags two issuances of one security and two epochs of one class', () => {
    const index = indexOf([
      ...bookEvents(),
      recordEvent('cid-issuance-2', 'stockIssuance', { ...BOOK_DATA.issuance, id: 'issuance-2' }),
      epochEvent('cid-epoch-2', COMMON_CLASS_ID),
    ]);

    expect(index.flags()).toEqual([
      {
        kind: 'duplicate_security_id',
        securityId: FOUNDERS_SECURITY_ID,
        contractIds: ['cid-issuance', 'cid-issuance-2'],
      },
      { kind: 'duplicate_epoch', stockClassId: COMMON_CLASS_ID, contractIds: ['cid-epoch', 'cid-epoch-2'] },
    ]);
  });

  it('flags overlapping shards and an incomplete partition', () => {
    const overlapping = indexOf([...bookEvents(), shardEvent('cid-shard-deeper', `${STAKEHOLDER_SHARD_PREFIX}0`)]);
    expect(overlapping.flags()).toEqual([
      {
        kind: 'overlapping_shards',
        prefixes: [STAKEHOLDER_SHARD_PREFIX, `${STAKEHOLDER_SHARD_PREFIX}0`],
        contractIds: [`cid-shard-${STAKEHOLDER_SHARD_PREFIX}`, 'cid-shard-deeper'],
      },
    ]);

    const twice = indexOf([...bookEvents(), shardEvent('cid-shard-again', STAKEHOLDER_SHARD_PREFIX)]);
    expect(twice.flags()).toEqual([
      expect.objectContaining({
        kind: 'overlapping_shards',
        prefixes: [STAKEHOLDER_SHARD_PREFIX, STAKEHOLDER_SHARD_PREFIX],
      }),
    ]);

    const gap = indexOf(withoutContract('cid-shard-00000000'));
    expect(gap.flags()).toEqual([{ kind: 'incomplete_shard_partition', shardCount: 255 }]);
  });

  it('flags a state whose origin record is missing, and a seq below its event records', () => {
    const noOrigin = indexOf(withoutContract('cid-issuance'));
    expect(noOrigin.flags()).toEqual([
      {
        kind: 'missing_origin',
        securityId: FOUNDERS_SECURITY_ID,
        originTransactionId: 'test-stock-issuance-founders-001',
        contractId: 'cid-state',
      },
    ]);

    // An acceptance and a hold each advanced the state's seq; a seq of 1 misses one of them.
    const behind = indexOf([...withoutContract('cid-state'), stateEvent('cid-state', { seq: '1' })]);
    expect(behind.flags()).toEqual([
      {
        kind: 'seq_below_event_records',
        securityId: FOUNDERS_SECURITY_ID,
        seq: 1,
        eventRecords: 2,
        contractId: 'cid-state',
      },
    ]);
  });
});

describe('RegisterIndex accessors', () => {
  const split = { split_id: 'split-1', date: '2024-06-01', ratio: { numerator: '2', denominator: '1' } };

  it('scales a state’s quantity reader-side through the splits after its last event', () => {
    const index = indexOf([...withoutContract('cid-epoch'), epochEvent('cid-epoch', COMMON_CLASS_ID, [split])]);

    expect(index.currentQuantity(FOUNDERS_SECURITY_ID, '2024-05-31')).toBe('5000000');
    expect(index.currentQuantity(FOUNDERS_SECURITY_ID, '2024-06-01')).toBe('10000000');
    expect(() => index.currentQuantity(FOUNDERS_SECURITY_ID, '2024-01-31')).toThrow(OcpValidationError);
    expect(() => index.currentQuantity('unknown-security', '2024-06-01')).toThrow(
      expect.objectContaining({ classification: 'register_state_not_found' })
    );
  });

  it('flags holds a later split voids', () => {
    const index = indexOf([...withoutContract('cid-epoch'), epochEvent('cid-epoch', COMMON_CLASS_ID, [split])]);

    expect(index.openHolds(FOUNDERS_SECURITY_ID, '2024-05-31')).toEqual([
      {
        hold_id: 'hold-1',
        hold_type: 'REGISTER_SETTLEMENT',
        reference: 'settlement-1',
        split_epoch: 0,
        quantity: '1500',
        voided: false,
      },
    ]);
    expect(index.openHolds(FOUNDERS_SECURITY_ID, '2024-06-01')[0]?.voided).toBe(true);
  });

  it('requires the epoch of a state’s class', () => {
    const index = indexOf(withoutContract('cid-epoch'));
    expect(() => index.openHolds(FOUNDERS_SECURITY_ID, '2024-06-01')).toThrow(
      expect.objectContaining({ classification: 'register_epoch_not_found' })
    );
  });

  it('gives the record index that replication diffing consumes', () => {
    const recordIndex = indexOf(bookEvents()).toRecordIndex();

    expect(recordIndex.securityIds).toEqual(new Set([FOUNDERS_SECURITY_ID]));
    expect(recordIndex.entities.get('stakeholder')).toEqual(new Set([STAKEHOLDER_ID]));
    expect(recordIndex.contractIds.get('stockHold')).toEqual(new Map([['hold-1', 'cid-hold']]));
    expect([...recordIndex.entities.keys()].sort()).toEqual(
      ['issuer', 'stakeholder', 'stockAcceptance', 'stockClass', 'stockHold', 'stockIssuance'].sort()
    );
  });

  it('keeps no record data without retainPayloads, and every key', () => {
    const index = indexOf(bookEvents(), { retainPayloads: false });

    expect(index.record(STAKEHOLDER_ID)).toMatchObject({ contractId: 'cid-stakeholder', data: null });
    expect(index.issuanceOf(FOUNDERS_SECURITY_ID)?.contractId).toBe('cid-issuance');
    expect(index.stateOf(FOUNDERS_SECURITY_ID)?.state.seq).toBe(2);
  });

  it('refuses a contract of another context', () => {
    const index = indexOf([]);
    expect(() => index.add(admitted(anchorEvent('cid-other', FOREIGN_CONTEXT)))).toThrow(OcpValidationError);
    expect(() => new RegisterIndex({ context: CONTEXT, offset: -1 })).toThrow(OcpValidationError);
  });

  it('returns null for keys it does not hold', () => {
    const index = indexOf([]);
    expect(index.anchor).toBeNull();
    expect(index.record('nothing')).toBeNull();
    expect(index.issuanceOf('nothing')).toBeNull();
    expect(index.stateOf('nothing')).toBeNull();
    expect(index.epochOf('nothing')).toBeNull();
    expect(index.shardFor(STAKEHOLDER_CLAIM)).toBeNull();
    expect(index.remove('nothing')).toBe(false);
    expect(index.recordsOf('stakeholder')).toEqual([]);
    expect(index.contains('nothing')).toBe(false);
  });

  it('lists records by entity kind and tells whether it holds a contract', () => {
    const index = indexOf(bookEvents());
    expect(index.recordsOf('stakeholder').map((record) => record.objectId)).toEqual([STAKEHOLDER_ID]);
    expect(index.recordsOf('stockHold').map((record) => record.contractId)).toEqual(['cid-hold']);
    for (const contractId of ['cid-anchor', 'cid-issuer', 'cid-state', 'cid-epoch', 'cid-shard-00000000']) {
      expect(index.contains(contractId)).toBe(true);
    }
    index.remove('cid-stakeholder');
    expect(index.recordsOf('stakeholder')).toEqual([]);
    expect(index.contains('cid-stakeholder')).toBe(false);
  });

  it('advances to a later offset once the updates up to it are read, never back', () => {
    const index = indexOf([], { offset: 50 });
    index.advance(40);
    expect(index.offset).toBe(50);
    index.advance(60);
    expect(index.offset).toBe(60);
    expect(() => index.advance(-1)).toThrow(OcpValidationError);
  });
});

describe('RegisterIndex.applyTransaction', () => {
  const prefix = STAKEHOLDER_SHARD_PREFIX;
  const split = simulatePreSplit(new Map([[prefix, new Set([STAKEHOLDER_CLAIM])]]), prefix);
  const children = split.created.map((child) => ({
    prefix: child,
    claimed: [...(split.shards.get(child) ?? [])],
  }));
  const cancellation = {
    id: 'hold-cancel-1',
    date: '2024-02-02',
    hold_id: 'hold-1',
    reason_text: 'The trade was not executed',
    security_id: FOUNDERS_SECURITY_ID,
    comments: [],
  };

  /** A hold cancellation, as `CapTable_CancelHolds` writes it, with a shard pre-split in the same transaction. */
  function cancelTransaction(offset = 100): RegisterTransaction {
    return {
      offset,
      updateId: 'update-100',
      events: [
        { ExercisedEvent: { contractId: 'cid-anchor', consuming: false } },
        { ExercisedEvent: { contractId: 'cid-state', consuming: true } },
        { CreatedEvent: recordEvent('cid-cancel', 'stockHoldCancellation', cancellation, { offset }) as never },
        { CreatedEvent: stateEvent('cid-state-3', { seq: '3', holds: [] }, { offset }) as never },
        { ArchivedEvent: { contractId: `cid-shard-${prefix}` } },
        ...children.map((child) => ({
          CreatedEvent: shardEvent(`cid-shard-${child.prefix}`, child.prefix, child.claimed, { offset }) as never,
        })),
      ],
    };
  }

  it('applies created and consumed contracts so the index stays current', () => {
    const index = indexOf(bookEvents());

    const result = index.applyTransaction(cancelTransaction());

    expect(result).toEqual({ applied: true, created: 4, consumed: 2, rejected: [] });
    expect(index.offset).toBe(100);
    expect(index.stateOf(FOUNDERS_SECURITY_ID)).toMatchObject({
      contractId: 'cid-state-3',
      state: { seq: 3, holds: [] },
    });
    expect(index.record('hold-cancel-1')).toMatchObject({ entityType: 'stockHoldCancellation', createdOffset: 100 });
    expect(index.shardFor(STAKEHOLDER_CLAIM)?.shard.prefix).toHaveLength(9);
    expect(index.shardAt(STAKEHOLDER_SHARD_PREFIX)).toBeNull();
    expect(index.shardAt(`${STAKEHOLDER_SHARD_PREFIX}0`)?.shard.prefix).toBe(`${STAKEHOLDER_SHARD_PREFIX}0`);
    expect(index.shardFor(STAKEHOLDER_CLAIM)?.shard.claimed).toEqual([STAKEHOLDER_CLAIM]);
    expect(index.counts()).toMatchObject({ records: 7, states: 1, shards: 257 });
    expect(index.flags()).toEqual([]);
  });

  it('does not apply a transaction at or before its offset twice', () => {
    const index = indexOf(bookEvents());
    index.applyTransaction(cancelTransaction());

    expect(index.applyTransaction(cancelTransaction())).toEqual({
      applied: false,
      created: 0,
      consumed: 0,
      rejected: [],
    });
    expect(indexOf(bookEvents(), { offset: 100 }).applyTransaction(cancelTransaction()).applied).toBe(false);
  });

  it('skips a contract the transaction both creates and consumes', () => {
    const index = indexOf(bookEvents());
    const transient = shardEvent('cid-transient', `${prefix}0`);

    const result = index.applyTransaction({
      offset: 101,
      events: [
        { CreatedEvent: transient as never },
        { ExercisedEvent: { contractId: 'cid-transient', consuming: true } },
      ],
    });

    expect(result).toEqual({ applied: true, created: 0, consumed: 0, rejected: [] });
    expect(index.counts().shards).toBe(256);
  });

  it('ignores other cap tables, rejects this cap table under other parties, and flags unreadable contracts', () => {
    const index = indexOf(bookEvents());
    const otherBook = { ...CONTEXT, cap_table_id: 'test-2' };
    const { id: _id, ...withoutId } = BOOK_DATA.stakeholder;

    const result = index.applyTransaction({
      offset: 102,
      events: [
        {
          CreatedEvent: recordEvent('cid-elsewhere', 'stakeholder', BOOK_DATA.stakeholder, {
            context: otherBook,
          }) as never,
        },
        {
          CreatedEvent: recordEvent('cid-foreign', 'stakeholder', BOOK_DATA.stakeholder, {
            context: FOREIGN_CONTEXT,
          }) as never,
        },
        { CreatedEvent: recordEvent('cid-broken', 'stakeholder', { ...withoutId, id: 3 }) as never },
        { CreatedEvent: recordEvent('cid-forged', 'stockHold', HOLD_DATA, { signatories: [CONTEXT.issuer] }) as never },
      ],
    });

    expect(result.created).toBe(0);
    expect(result.rejected.map((rejection) => [rejection.contractId, rejection.reason])).toEqual([
      ['cid-foreign', 'foreign_context'],
      ['cid-broken', 'invalid_payload'],
      ['cid-forged', 'wrong_signatories'],
    ]);
    expect(index.flags()).toEqual([expect.objectContaining({ kind: 'unreadable_contract', contractId: 'cid-broken' })]);
    expect(index.counts().records).toBe(6);
  });

  it('refuses a malformed transaction', () => {
    const index = indexOf(bookEvents());
    expect(() => index.applyTransaction(null as never)).toThrow(OcpValidationError);
    expect(() => index.applyTransaction({ offset: 'x', events: [] } as never)).toThrow(OcpValidationError);
    expect(() => index.applyTransaction({ offset: 103, events: {} } as never)).toThrow(OcpValidationError);
  });
});
