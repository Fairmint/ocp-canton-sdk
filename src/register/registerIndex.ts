/**
 * The key index of one OpenCapTable-v35 book: the keys the Ledger API cannot filter by, kept off the ledger.
 *
 * Contract keys do not help on Canton 3.4 (none) or 3.5 (not unique), so readers keep (cap table, object ID) and
 * (cap table, security ID) themselves, key on the full `Context`, and use each state's `seq` and
 * `origin_transaction_id` to check that they hold every record for a security. One index holds one book: the contracts
 * whose `Context` is its anchor's.
 */

import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../errors';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type { CantonRecordIndex } from '../functions/OpenCapTable/capTable/types';
import type {
  AdmittedRegisterContract,
  RegisterAnchor,
  RegisterContext,
  RegisterEpoch,
  RegisterIndexFlag,
  RegisterOpenHold,
  RegisterRecord,
  RegisterRejectedContract,
  RegisterShard,
  RegisterState,
  RegisterTransaction,
  RegisterTransactionResult,
} from '../types/register';
import { admitContract } from './admission';
import { contextKey, rejectedContract, sameContext } from './admissionRules';
import { requireDate } from './dates';
import { coveringShardPrefix } from './ids';
import { isVoidedHold, scaleQuantityAcross } from './splits';

/** How to build a {@link RegisterIndex}. */
export interface RegisterIndexOptions {
  /** The book's `Context`: its anchor's cap table ID and three parties */
  context: RegisterContext;
  /** The offset the index is current at (the snapshot's `activeAtOffset`) */
  offset: number;
  /**
   * Keep each OCF record's native data (default `true`). A consumer that streams a large book through `onContract`
   * can set it to `false`: the index then keeps every key, state, epoch and shard, but no record data.
   */
  retainPayloads?: boolean;
}

/** The issuance kinds, of every instrument, whose `security_id` the index keys. */
const ISSUANCE_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
]);

/**
 * The records of non-terminal stock events: each one a state applied advanced its `seq` by one (`successor` in
 * OpenCapTable-v35's `Events.daml`). Snapshots and restatements advance it with no record, so a state's `seq` is at
 * least the number of these records naming its security.
 */
const NON_TERMINAL_EVENT_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockAcceptance',
  'vestingStart',
  'vestingEvent',
  'vestingAcceleration',
  'stockHold',
  'stockHoldCancellation',
]);

/** The number of 8-bit-or-longer prefixes' worth of hash space: shards partition `2^256` hashes. */
const HASH_SPACE = 1n << 256n;

function requireOffset(offset: unknown, fieldPath: string): number {
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new OcpValidationError(fieldPath, 'Must be a non-negative ledger offset', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-negative safe integer',
      receivedValue: offset,
    });
  }
  return offset;
}

function addKey(index: Map<string, Set<string>>, key: string, contractId: string): void {
  const existing = index.get(key);
  if (existing === undefined) index.set(key, new Set([contractId]));
  else existing.add(contractId);
}

function removeKey(index: Map<string, Set<string>>, key: string, contractId: string): void {
  const existing = index.get(key);
  if (existing === undefined) return;
  existing.delete(contractId);
  if (existing.size === 0) index.delete(key);
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The key index of one book (one `Context`): its anchor, records by object ID, issuances by security ID, states by
 * security ID, epochs by class and shards by prefix, kept current by {@link RegisterIndex.applyTransaction}.
 *
 * Accessors return the one contract under a key, or `null`; under a key that holds more than one contract (which
 * {@link RegisterIndex.flags} reports) they throw rather than pick one.
 */
export class RegisterIndex {
  /** The book's `Context` */
  readonly context: RegisterContext;

  /** Whether the index keeps each OCF record's native data */
  readonly retainsPayloads: boolean;

  private currentOffset: number;
  private readonly anchors = new Map<string, RegisterAnchor>();
  private readonly recordsById = new Map<string, RegisterRecord>();
  private readonly recordsByObjectId = new Map<string, Set<string>>();
  private readonly issuancesBySecurityId = new Map<string, Set<string>>();
  private readonly statesById = new Map<string, RegisterState>();
  private readonly statesBySecurityId = new Map<string, Set<string>>();
  private readonly epochsById = new Map<string, RegisterEpoch>();
  private readonly epochsByClass = new Map<string, Set<string>>();
  private readonly shardsById = new Map<string, RegisterShard>();
  private readonly shardsByPrefix = new Map<string, Set<string>>();
  private readonly unreadable = new Map<string, RegisterRejectedContract>();

  constructor(options: RegisterIndexOptions) {
    this.context = { ...options.context };
    this.currentOffset = requireOffset(options.offset, 'offset');
    this.retainsPayloads = options.retainPayloads ?? true;
  }

  /** The offset the index is current at: its snapshot's, or the last transaction it applied. */
  get offset(): number {
    return this.currentOffset;
  }

  /** The book's anchor, or `null` when the read found none. */
  get anchor(): RegisterAnchor | null {
    return this.single(new Set(this.anchors.keys()), this.anchors, `anchor of cap table ${this.context.cap_table_id}`);
  }

  /** How many active contracts of each kind the index holds. */
  counts(): { anchors: number; records: number; states: number; epochs: number; shards: number } {
    return {
      anchors: this.anchors.size,
      records: this.recordsById.size,
      states: this.statesById.size,
      epochs: this.epochsById.size,
      shards: this.shardsById.size,
    };
  }

  /** Every OCF record, in the order the index admitted them. */
  records(): IterableIterator<RegisterRecord> {
    return this.recordsById.values();
  }

  /** Every active stock security state. */
  states(): IterableIterator<RegisterState> {
    return this.statesById.values();
  }

  /** Every active stock class epoch. */
  epochs(): IterableIterator<RegisterEpoch> {
    return this.epochsById.values();
  }

  /** Every active ID shard. */
  shards(): IterableIterator<RegisterShard> {
    return this.shardsById.values();
  }

  /** The record with an object ID (object IDs are unique across object types), or `null`. */
  record(objectId: string): RegisterRecord | null {
    return this.single(this.recordsByObjectId.get(objectId), this.recordsById, `object ${objectId}`);
  }

  /** The issuance (stock, warrant, convertible or equity compensation) that created a security, or `null`. */
  issuanceOf(securityId: string): RegisterRecord | null {
    return this.single(this.issuancesBySecurityId.get(securityId), this.recordsById, `issuance of ${securityId}`);
  }

  /** The active state of a stock security, or `null` when the security is not outstanding. */
  stateOf(securityId: string): RegisterState | null {
    return this.single(this.statesBySecurityId.get(securityId), this.statesById, `state of ${securityId}`);
  }

  /** A stock class's epoch, or `null`. */
  epochOf(stockClassId: string): RegisterEpoch | null {
    return this.single(this.epochsByClass.get(stockClassId), this.epochsById, `epoch of class ${stockClassId}`);
  }

  /** The shard whose prefix covers a claim hash (64 lowercase hex characters), or `null` when none does. */
  shardFor(hash: string): RegisterShard | null {
    const prefix = coveringShardPrefix(hash, this.shardsByPrefix);
    return prefix === null ? null : this.single(this.shardsByPrefix.get(prefix), this.shardsById, `shard ${prefix}`);
  }

  /**
   * A stock security's quantity in the units of `asOf`: its state's quantity, in the units of its last event date,
   * stepped through each split of its class dated after that and on or before `asOf`, with the shared floor function
   * (the ledger applies them the same way at the state's next event).
   *
   * @throws OcpContractError when the security has no active state or its class no epoch
   * @throws OcpValidationError when `asOf` is before the state's last event date
   */
  currentQuantity(securityId: string, asOf: string): string {
    const { state, splits } = this.stateWithSplits(securityId);
    requireDate(asOf, 'asOf');
    if (asOf < state.last_event_date) {
      throw new OcpValidationError(
        'asOf',
        `Security ${securityId} is in the units of its last event date ${state.last_event_date}`,
        { code: OcpErrorCodes.OUT_OF_RANGE, receivedValue: asOf }
      );
    }
    return scaleQuantityAcross(state.quantity, splits, state.last_event_date, asOf);
  }

  /**
   * The holds open on a stock security, each flagged `voided` when a split of its class dated on or before `asOf`
   * voids it (a settlement hold drawn on `asOf` must carry the split epoch of that date; a stop is never voided).
   *
   * @throws OcpContractError when the security has no active state or its class no epoch
   */
  openHolds(securityId: string, asOf: string): RegisterOpenHold[] {
    const { state, splits } = this.stateWithSplits(securityId);
    requireDate(asOf, 'asOf');
    return state.holds.map((hold) => ({ ...hold, voided: isVoidedHold(hold, splits, asOf) }));
  }

  /** The book's records as the minimal {@link CantonRecordIndex} that replication diffing and extraction consume. */
  toRecordIndex(): CantonRecordIndex {
    const entities = new Map<OcfEntityType, Set<string>>();
    const contractIds = new Map<OcfEntityType, Map<string, string>>();
    for (const record of this.recordsById.values()) {
      let ids = entities.get(record.entityType);
      if (ids === undefined) {
        ids = new Set();
        entities.set(record.entityType, ids);
      }
      ids.add(record.objectId);
      let byId = contractIds.get(record.entityType);
      if (byId === undefined) {
        byId = new Map();
        contractIds.set(record.entityType, byId);
      }
      byId.set(record.objectId, record.contractId);
    }
    return { entities, contractIds, securityIds: new Set(this.issuancesBySecurityId.keys()) };
  }

  /**
   * Index a contract the reader admitted for this book.
   *
   * @throws OcpValidationError when the contract's `Context` is not this book's
   */
  add(admitted: AdmittedRegisterContract): void {
    if (!sameContext(admitted.context, this.context)) {
      throw new OcpValidationError(
        'context',
        `Contract ${admitted.contract.contractId} is not of this book's context`,
        {
          code: OcpErrorCodes.INVALID_FORMAT,
          receivedValue: admitted.context,
        }
      );
    }
    const { contractId } = admitted.contract;
    this.remove(contractId);
    switch (admitted.kind) {
      case 'anchor':
        this.anchors.set(contractId, admitted.contract);
        return;
      case 'record': {
        const record = this.retainsPayloads
          ? admitted.contract
          : ({ ...admitted.contract, data: null } as RegisterRecord);
        this.recordsById.set(contractId, record);
        addKey(this.recordsByObjectId, record.objectId, contractId);
        if (ISSUANCE_TYPES.has(record.entityType)) {
          for (const securityId of record.securityIds) addKey(this.issuancesBySecurityId, securityId, contractId);
        }
        return;
      }
      case 'state':
        this.statesById.set(contractId, admitted.contract);
        addKey(this.statesBySecurityId, admitted.contract.state.security_id, contractId);
        return;
      case 'epoch':
        this.epochsById.set(contractId, admitted.contract);
        addKey(this.epochsByClass, admitted.contract.epoch.stock_class_id, contractId);
        return;
      case 'shard':
        this.shardsById.set(contractId, admitted.contract);
        addKey(this.shardsByPrefix, admitted.contract.shard.prefix, contractId);
    }
  }

  /**
   * Record a contract signed by this book's three parties that the reader could not admit, so that {@link flags}
   * reports the book as incomplete.
   */
  addUnreadable(rejection: RegisterRejectedContract): void {
    this.unreadable.set(rejection.contractId, rejection);
  }

  /** Drop a contract the ledger archived. Returns whether the index held it. */
  remove(contractId: string): boolean {
    if (this.anchors.delete(contractId)) return true;
    if (this.unreadable.delete(contractId)) return true;
    const record = this.recordsById.get(contractId);
    if (record !== undefined) {
      this.recordsById.delete(contractId);
      removeKey(this.recordsByObjectId, record.objectId, contractId);
      if (ISSUANCE_TYPES.has(record.entityType)) {
        for (const securityId of record.securityIds) removeKey(this.issuancesBySecurityId, securityId, contractId);
      }
      return true;
    }
    const state = this.statesById.get(contractId);
    if (state !== undefined) {
      this.statesById.delete(contractId);
      removeKey(this.statesBySecurityId, state.state.security_id, contractId);
      return true;
    }
    const epoch = this.epochsById.get(contractId);
    if (epoch !== undefined) {
      this.epochsById.delete(contractId);
      removeKey(this.epochsByClass, epoch.epoch.stock_class_id, contractId);
      return true;
    }
    const shard = this.shardsById.get(contractId);
    if (shard !== undefined) {
      this.shardsById.delete(contractId);
      removeKey(this.shardsByPrefix, shard.shard.prefix, contractId);
      return true;
    }
    return false;
  }

  /**
   * Apply a ledger-effects transaction read with the reader's event format (`registerEventFormat`): drop the contracts
   * it consumed and index those of this book it created, so a writer keeps the index current without reading the
   * active contract set again. Contracts the transaction both creates and consumes are skipped, and contracts of other
   * cap tables ignored; one of this cap table under other parties is rejected as `foreign_context`. A transaction at or
   * before the index's offset was applied already and changes nothing.
   *
   * @throws OcpValidationError when the transaction is malformed
   */
  applyTransaction(transaction: RegisterTransaction): RegisterTransactionResult {
    if (!isRecordObject(transaction)) {
      throw new OcpValidationError('transaction', 'Must be a ledger transaction', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: transaction,
      });
    }
    const offset = requireOffset(transaction.offset, 'transaction.offset');
    if (!Array.isArray(transaction.events)) {
      throw new OcpValidationError('transaction.events', 'Must be a list of events', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: transaction.events,
      });
    }
    if (offset <= this.currentOffset) return { applied: false, created: 0, consumed: 0, rejected: [] };

    const createdEvents: unknown[] = [];
    const createdIds = new Set<string>();
    const consumedIds = new Set<string>();
    for (const event of transaction.events as readonly unknown[]) {
      if (!isRecordObject(event)) continue;
      const created = event.CreatedEvent;
      const archived = event.ArchivedEvent;
      const exercised = event.ExercisedEvent;
      if (isRecordObject(created)) {
        createdEvents.push(created);
        if (typeof created.contractId === 'string') createdIds.add(created.contractId);
      } else if (isRecordObject(archived) && typeof archived.contractId === 'string') {
        consumedIds.add(archived.contractId);
      } else if (
        isRecordObject(exercised) &&
        exercised.consuming === true &&
        typeof exercised.contractId === 'string'
      ) {
        consumedIds.add(exercised.contractId);
      }
    }

    let consumed = 0;
    for (const contractId of consumedIds) {
      if (!createdIds.has(contractId) && this.remove(contractId)) consumed += 1;
    }
    let createdCount = 0;
    const rejected: RegisterRejectedContract[] = [];
    for (const created of createdEvents) {
      const { contractId } = created as { contractId?: unknown };
      if (typeof contractId === 'string' && consumedIds.has(contractId)) continue;
      const result = admitContract(created, { requireView: true });
      if (result.ok) {
        if (sameContext(result.contract.context, this.context)) {
          this.add(result.contract);
          createdCount += 1;
        } else if (result.contract.context.cap_table_id === this.context.cap_table_id) {
          const { contract } = result.contract;
          rejected.push(
            rejectedContract(
              { contractId: contract.contractId, templateId: contract.templateId, packageName: null },
              'foreign_context',
              `Contract of cap table ${this.context.cap_table_id} under parties other than its anchor's`,
              this.context.cap_table_id
            )
          );
        }
        continue;
      }
      if (result.signedBy !== null && contextKey(result.signedBy) === contextKey(this.context)) {
        this.addUnreadable(result.rejection);
        rejected.push(result.rejection);
      } else if (result.rejection.capTableId === this.context.cap_table_id) {
        rejected.push(result.rejection);
      }
    }
    this.currentOffset = offset;
    return { applied: true, created: createdCount, consumed, rejected };
  }

  /**
   * What is wrong with the book, computed from the contracts the index holds now. A genuine, completely read book has
   * no flags.
   */
  flags(): RegisterIndexFlag[] {
    const flags: RegisterIndexFlag[] = [];
    if (this.anchors.size === 0) flags.push({ kind: 'missing_anchor' });
    if (this.anchors.size > 1) flags.push({ kind: 'duplicate_anchor', contractIds: [...this.anchors.keys()] });
    for (const [objectId, ids] of this.recordsByObjectId) {
      if (ids.size > 1) flags.push({ kind: 'duplicate_object_id', objectId, contractIds: [...ids] });
    }
    for (const [securityId, ids] of this.issuancesBySecurityId) {
      if (ids.size > 1) flags.push({ kind: 'duplicate_security_id', securityId, contractIds: [...ids] });
    }
    for (const [securityId, ids] of this.statesBySecurityId) {
      if (ids.size > 1) flags.push({ kind: 'duplicate_state', securityId, contractIds: [...ids] });
    }
    for (const [stockClassId, ids] of this.epochsByClass) {
      if (ids.size > 1) flags.push({ kind: 'duplicate_epoch', stockClassId, contractIds: [...ids] });
    }
    flags.push(...this.shardFlags());

    const eventRecords = new Map<string, number>();
    for (const record of this.recordsById.values()) {
      if (!NON_TERMINAL_EVENT_TYPES.has(record.entityType)) continue;
      for (const securityId of record.securityIds)
        eventRecords.set(securityId, (eventRecords.get(securityId) ?? 0) + 1);
    }
    for (const { contractId, state } of this.statesById.values()) {
      if (!this.recordsByObjectId.has(state.origin_transaction_id)) {
        flags.push({
          kind: 'missing_origin',
          securityId: state.security_id,
          originTransactionId: state.origin_transaction_id,
          contractId,
        });
      }
      const count = eventRecords.get(state.security_id) ?? 0;
      if (state.seq < count) {
        flags.push({
          kind: 'seq_below_event_records',
          securityId: state.security_id,
          seq: state.seq,
          eventRecords: count,
          contractId,
        });
      }
    }
    for (const rejection of this.unreadable.values()) {
      flags.push({
        kind: 'unreadable_contract',
        contractId: rejection.contractId,
        templateId: rejection.templateId,
        reason: rejection.reason,
        message: rejection.message,
      });
    }
    return flags;
  }

  private shardFlags(): RegisterIndexFlag[] {
    const flags: RegisterIndexFlag[] = [];
    let overlapping = false;
    for (const [prefix, ids] of this.shardsByPrefix) {
      if (ids.size > 1) {
        overlapping = true;
        const [first, second] = [...ids];
        if (first !== undefined && second !== undefined) {
          flags.push({ kind: 'overlapping_shards', prefixes: [prefix, prefix], contractIds: [first, second] });
        }
      }
    }
    // After sorting, a prefix that starts another sorts directly before one that it starts.
    const prefixes = [...this.shardsByPrefix.keys()].sort();
    for (let i = 0; i + 1 < prefixes.length; i += 1) {
      const shorter = prefixes[i];
      const longer = prefixes[i + 1];
      if (shorter === undefined || longer?.startsWith(shorter) !== true) continue;
      overlapping = true;
      const shorterId = this.shardsByPrefix.get(shorter)?.values().next().value;
      const longerId = this.shardsByPrefix.get(longer)?.values().next().value;
      if (shorterId !== undefined && longerId !== undefined) {
        flags.push({ kind: 'overlapping_shards', prefixes: [shorter, longer], contractIds: [shorterId, longerId] });
      }
    }
    if (!overlapping) {
      let covered = 0n;
      for (const prefix of prefixes) covered += HASH_SPACE >> BigInt(prefix.length);
      if (covered !== HASH_SPACE) flags.push({ kind: 'incomplete_shard_partition', shardCount: this.shardsById.size });
    }
    return flags;
  }

  private stateWithSplits(securityId: string): {
    state: RegisterState['state'];
    splits: RegisterEpoch['epoch']['splits'];
  } {
    const entry = this.stateOf(securityId);
    if (entry === null) {
      throw new OcpContractError(
        `Security ${securityId} has no active state in cap table ${this.context.cap_table_id}`,
        {
          code: OcpErrorCodes.CONTRACT_NOT_FOUND,
          classification: 'register_state_not_found',
          context: { capTableId: this.context.cap_table_id, securityId },
        }
      );
    }
    const epoch = this.epochOf(entry.state.stock_class_id);
    if (epoch === null) {
      throw new OcpContractError(
        `Stock class ${entry.state.stock_class_id} has no epoch in cap table ${this.context.cap_table_id}`,
        {
          code: OcpErrorCodes.CONTRACT_NOT_FOUND,
          classification: 'register_epoch_not_found',
          context: { capTableId: this.context.cap_table_id, stockClassId: entry.state.stock_class_id },
        }
      );
    }
    return { state: entry.state, splits: epoch.epoch.splits };
  }

  private single<T>(ids: ReadonlySet<string> | undefined, from: ReadonlyMap<string, T>, what: string): T | null {
    if (ids === undefined || ids.size === 0) return null;
    if (ids.size > 1) {
      throw new OcpContractError(`The ${what} is ambiguous: ${ids.size} active contracts`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'ambiguous_register_key',
        context: { capTableId: this.context.cap_table_id, contractIds: [...ids] },
      });
    }
    const [contractId] = ids;
    return contractId === undefined ? null : (from.get(contractId) ?? null);
  }
}
