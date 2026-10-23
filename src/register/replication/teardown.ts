/**
 * The switch from a book to its rebuild, and the old book's purge (design, "One mode and teardown").
 *
 * A book whose correction the restatement limits refuse, or that changes its TA, is rebuilt as a new cap table while
 * the old one keeps running. Once every writer sends the old book nothing but stops and knows its pending commands'
 * outcomes (step 1, the drain), and the TA has released every open trade (step 2):
 *
 * 3. {@link checkTeardownReady}: the old book carries no settlement hold, current or voided, and the new book holds
 *    every record the old book wrote through the drain other than the hold pair. The TA then commits
 *    `CapTable_BeginTeardown` on the old book, which fails every write sequenced after it.
 * 4. {@link planStopReplacement}: every stop still open on the old book, read at or after that commit, re-placed on the
 *    new book under its reference, on the security with the same ID or on each security the replayed source derives
 *    from it.
 * 5. {@link reconcileStops}: every open stop of the old book has its match on the new one.
 * 6. Only then does ta-service place settlement holds on the new book.
 *
 * {@link planPurge} plans the optional purge that may follow: `system_operator`'s `CapTable_Purge` batches, then
 * `CapTable_Close`, which leaves the anchor as a tombstone. On a change of TA the outgoing TA runs steps 1 to 3 and
 * cannot read the new book, and the incoming TA runs steps 4 to 6 and cannot read the old one: each reads the other's
 * book as its issuer or `system_operator` ({@link readTeardownBook}).
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../errors';
import { isOcfLedgerWrittenEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import { buildCloseCommand, buildPurgeCommand } from '../../functions/OpenCapTable/capTable/teardown';
import type {
  BookWrite,
  CapTableStatus,
  OpenHold,
  PurgeTarget,
  RecordedSplit,
  RegisterAnchor,
  RegisterRecord,
  ReplayResult,
} from '../../types/register';
import { DEFAULT_DEPRECATED_FIELDS, DEFAULT_INTERNAL_FIELDS, ocfCompare } from '../../utils/ocfComparison';
import { epochBytes, jsonBytes, shardBytes, stateBytes } from '../bookSimulation';
import {
  MAX_CONTRACTS_PER_PURGE,
  MAX_HOLDS_PER_SECURITY,
  MAX_LOTS_PER_OPERATION,
  SDK_BATCH_BYTE_BUDGET,
} from '../caps';
import { requireDate } from '../dates';
import { readRegister } from '../reader';
import type { RegisterIndex } from '../registerIndex';
import { isVoidedHold } from '../splits';
import type {
  PlacedStop,
  PurgeBatch,
  PurgePlan,
  StopMismatch,
  StopPlacement,
  StopReconciliation,
  StopReplacementPlan,
  TeardownIssue,
  TeardownReadiness,
  TeardownRecordDifference,
  TeardownStop,
  UnmappedStop,
  UnmappedStopReason,
} from './types';

/** What `checkTeardownReady` checks. */
export interface CheckTeardownReadyInput {
  /** The book to tear down, read at or after `drainOffset` */
  oldIndex: RegisterIndex;
  /** Its rebuild, read as its TA, issuer or `system_operator` */
  newIndex: RegisterIndex;
  /** The old book's offset at which the drain finished: no writer sent it anything but stops after it */
  drainOffset: number;
  /** The date a settlement hold is reported voided on (default: today, UTC) */
  asOf?: string;
}

/** What `planStopReplacement` plans from. */
export interface PlanStopReplacementInput {
  /** The old book, read at or after its `CapTable_BeginTeardown` commit, with record payloads (each stop's reason) */
  oldIndexAtTeardown: RegisterIndex;
  /** The new book, current */
  newIndex: RegisterIndex;
  /**
   * The replay of the new book's source (`register.replayOcf`): where a correction replaced a stopped security, the
   * securities it derives from it take the stop. Without it, a security the new book does not hold is unmapped.
   */
  replay?: ReplayResult;
}

/** Options of `reconcileStops`. */
export interface ReconcileStopsOptions {
  /** The replay of the new book's source, as `planStopReplacement` took it */
  replay?: ReplayResult;
}

/** Options of `planPurge`. */
export interface PlanPurgeOptions {
  /**
   * The most bytes one `CapTable_Purge` may archive, as the SDK estimates the contracts' JSON (default 8 MiB). A
   * record read without its payload counts only its target.
   */
  byteBudget?: number;
  /** The anchor's template ID as the ledger reports it; defaults to the bundled `OpenCapTable-v35` template */
  capTableTemplateId?: string;
}

/** Options of `readTeardownBook`. */
export interface ReadTeardownBookOptions {
  capTableId: string;
  /** The party to read as: the book's issuer, `system_operator` or TA */
  readAs: string;
  /** The offset to read at; defaults to the ledger end */
  activeAtOffset?: number;
  /** Keep each OCF record's native data (default `true`; the readiness comparison and stop reasons need it) */
  retainPayloads?: boolean;
  idleTimeoutMs?: number;
}

const COMPARISON = { ignoredFields: DEFAULT_INTERNAL_FIELDS, deprecatedFields: DEFAULT_DEPRECATED_FIELDS };

/** Index flags that leave a book's records unknown: what it holds under an object ID cannot be told. */
const INCOMPLETE_FLAGS: ReadonlySet<string> = new Set([
  'unreadable_contract',
  'duplicate_anchor',
  'duplicate_object_id',
]);

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

function requireDistinctBooks(oldIndex: RegisterIndex, newIndex: RegisterIndex): void {
  if (oldIndex.context.cap_table_id === newIndex.context.cap_table_id) {
    throw new OcpValidationError(
      'newIndex',
      `The new book must be another cap table than the old book ${oldIndex.context.cap_table_id}`,
      { code: OcpErrorCodes.INVALID_FORMAT, classification: 'same_book', receivedValue: newIndex.context.cap_table_id }
    );
  }
}

function anchorOf(index: RegisterIndex): RegisterAnchor {
  const { anchor } = index;
  if (anchor === null) {
    throw new OcpContractError(`Cap table ${index.context.cap_table_id} has no anchor in the index`, {
      code: OcpErrorCodes.CONTRACT_NOT_FOUND,
      classification: 'register_anchor_not_found',
      context: { capTableId: index.context.cap_table_id },
    });
  }
  return anchor;
}

/** A torn-down book's anchor, refused while the book is still Active: its records and stops can still change. */
function requireTornDown(index: RegisterIndex, fieldPath: string): RegisterAnchor {
  const anchor = anchorOf(index);
  if (anchor.status === 'ACTIVE') {
    throw new OcpValidationError(
      fieldPath,
      `Cap table ${index.context.cap_table_id} is Active: read it at or after its CapTable_BeginTeardown commit`,
      { code: OcpErrorCodes.INVALID_FORMAT, classification: 'teardown_not_begun', receivedValue: anchor.status }
    );
  }
  return anchor;
}

function requireActive(index: RegisterIndex, fieldPath: string): void {
  const { status } = anchorOf(index);
  if (status !== 'ACTIVE') {
    throw new OcpValidationError(fieldPath, `Cap table ${index.context.cap_table_id} is ${statusText(status)}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      classification: 'new_book_not_active',
      receivedValue: status,
    });
  }
}

function statusText(status: CapTableStatus): string {
  return status === 'ACTIVE' ? 'Active' : status === 'TEARING_DOWN' ? 'tearing down' : 'closed';
}

function issue(
  condition: TeardownIssue['condition'],
  message: string,
  recordIds: string[] = [],
  securityIds: string[] = []
): TeardownIssue {
  return { condition, message, recordIds, securityIds };
}

/** Whether a book is Active and reads complete, as the switch needs both books to be before the teardown. */
function bookIssues(index: RegisterIndex, which: 'old' | 'new'): { status: TeardownIssue[]; read: TeardownIssue[] } {
  const capTableId = index.context.cap_table_id;
  const flags = index.flags().filter((flag) => INCOMPLETE_FLAGS.has(flag.kind));
  const read: TeardownIssue[] = [];
  if (flags.length > 0) {
    const kinds = [...new Set(flags.map((flag) => flag.kind))].join(', ');
    read.push(
      issue(
        'incomplete_read',
        `The ${which} book ${capTableId} reads incomplete (${kinds}): read it again, with an SDK that reads every ` +
          'contract it holds',
        flags.flatMap((flag) => (flag.kind === 'duplicate_object_id' ? [flag.objectId] : []))
      )
    );
  }
  const condition = which === 'old' ? 'old_book_status' : 'new_book_status';
  // Two anchors are an incomplete read; the index names neither as the book's.
  if (flags.some((flag) => flag.kind === 'duplicate_anchor')) return { status: [], read };
  const { anchor } = index;
  if (anchor === null) {
    return { status: [issue(condition, `The ${which} book ${capTableId} has no anchor in the index`)], read };
  }
  if (anchor.status === 'ACTIVE') return { status: [], read };
  return {
    status: [issue(condition, `The ${which} book ${capTableId} is ${statusText(anchor.status)}, not Active`)],
    read,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether a book's teardown may begin (step 3 of the switch): the old book carries no settlement hold, current or
 * voided, because no hold choice runs after the teardown; and the new book holds every record the old book wrote,
 * other than the hold pair, by object ID: ordinary records and corrections, and the records the old book's register
 * choices wrote, whose IDs in the old book's derived form the new book holds as claimed IDs. Each record must have
 * been written through `drainOffset`; one written later means a writer did not stop.
 *
 * A record both books hold may differ where the rebuild corrected it; each difference is reported, not refused, for
 * the TA to confirm. Plan the new book's replication from its source first: a `current` plan shows that every
 * correction mirrored to the old book is on the new one too.
 *
 * On a change of TA the outgoing TA, who is no informee of the new book, reads it as its issuer or `system_operator`
 * ({@link readTeardownBook}); no condition compares the two books' parties.
 *
 * @throws OcpValidationError when the two indexes are one cap table, or `drainOffset` or `asOf` is malformed
 */
export function checkTeardownReady(input: CheckTeardownReadyInput): TeardownReadiness {
  const { oldIndex, newIndex } = input;
  const drainOffset = requireOffset(input.drainOffset, 'drainOffset');
  const asOf = requireDate(input.asOf ?? today(), 'asOf');
  requireDistinctBooks(oldIndex, newIndex);
  const oldCapTableId = oldIndex.context.cap_table_id;
  const newCapTableId = newIndex.context.cap_table_id;

  const oldBook = bookIssues(oldIndex, 'old');
  const newBook = bookIssues(newIndex, 'new');
  const issues: TeardownIssue[] = [...oldBook.status, ...newBook.status, ...oldBook.read, ...newBook.read];
  if (oldIndex.offset < drainOffset) {
    issues.push(
      issue(
        'index_behind',
        `The old book ${oldCapTableId} was read at offset ${oldIndex.offset}, before the drain finished at ` +
          `${drainOffset}: read it again`
      )
    );
  }

  const splitsByClass = new Map<string, RecordedSplit[]>();
  for (const { epoch } of oldIndex.epochs()) splitsByClass.set(epoch.stock_class_id, epoch.splits);
  for (const { state } of oldIndex.states()) {
    const splits = splitsByClass.get(state.stock_class_id) ?? [];
    for (const hold of state.holds) {
      if (hold.hold_type !== 'REGISTER_SETTLEMENT') continue;
      const voided = isVoidedHold(hold, splits, asOf);
      issues.push(
        issue(
          'settlement_hold',
          `Security ${state.security_id} carries the ${voided ? 'voided ' : ''}settlement hold ${hold.hold_id} of ` +
            `settlement ${hold.reference}: ${voided ? 'cancel it' : 'release its trade'} before the teardown`,
          [hold.hold_id],
          [state.security_id]
        )
      );
    }
  }

  const newRecords = new Map<string, RegisterRecord>();
  for (const record of newIndex.records()) newRecords.set(record.objectId, record);
  const differences: TeardownRecordDifference[] = [];
  let recordsChecked = 0;
  for (const record of oldIndex.records()) {
    if (isOcfLedgerWrittenEntityType(record.entityType)) continue;
    recordsChecked += 1;
    if (record.createdOffset > drainOffset) {
      issues.push(
        issue(
          'written_after_drain',
          `${record.objectType} ${record.objectId} was written to the old book at offset ${record.createdOffset}, ` +
            `after the drain finished at ${drainOffset}`,
          [record.objectId],
          record.securityIds
        )
      );
    }
    const rebuilt = newRecords.get(record.objectId);
    if (rebuilt === undefined) {
      issues.push(
        issue(
          'missing_record',
          `${record.objectType} ${record.objectId} of the old book is not on the new book ${newCapTableId}`,
          [record.objectId],
          record.securityIds
        )
      );
      continue;
    }
    if (record.data === null || rebuilt.data === null) continue;
    const comparison = ocfCompare(record.data, rebuilt.data, COMPARISON);
    if (!comparison.equal) {
      differences.push({
        objectId: record.objectId,
        entityType: record.entityType,
        newEntityType: rebuilt.entityType,
        differences: comparison.differences,
      });
    }
  }

  return {
    ready: issues.length === 0,
    oldCapTableId,
    newCapTableId,
    drainOffset,
    issues,
    differences,
    recordsChecked,
  };
}

// ===== Stops =====

/** Every open stop of a book, by reference and then security, each with the reason its `TX_STOCK_HOLD` gives. */
function openStops(index: RegisterIndex): TeardownStop[] {
  const reasons = new Map<string, string>();
  for (const record of index.recordsOf('stockHold')) {
    if (record.entityType === 'stockHold' && record.data !== null)
      reasons.set(record.objectId, record.data.reason_text);
  }
  const stops: TeardownStop[] = [];
  for (const { state } of index.states()) {
    for (const hold of state.holds) {
      if (hold.hold_type !== 'STOP_TRANSFER') continue;
      stops.push({
        securityId: state.security_id,
        holdId: hold.hold_id,
        reference: hold.reference,
        reasonText: reasons.get(hold.hold_id) ?? null,
        stakeholderId: state.stakeholder_id,
        stockClassId: state.stock_class_id,
      });
    }
  }
  return stops.sort((a, b) =>
    a.reference === b.reference ? compareText(a.securityId, b.securityId) : compareText(a.reference, b.reference)
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The securities the replayed source derives from each security it retires: the outputs of the record that ends it
 * (a transfer's resulting and balance securities, a consolidation's resulting one, ...).
 */
function lineageOf(replay: ReplayResult | undefined): Map<string, string[]> {
  const lineage = new Map<string, string[]>();
  if (replay === undefined) return lineage;
  const consumedBy = new Map<string, Set<string>>();
  for (const [securityId, retirement] of replay.retired) {
    const consumed = consumedBy.get(retirement.recordId) ?? new Set<string>();
    consumed.add(securityId);
    consumedBy.set(retirement.recordId, consumed);
  }
  const outputs = new Map<string, string[]>();
  for (const step of replay.steps) {
    const [eventId] = step.recordIds;
    const consumed = eventId === undefined ? undefined : consumedBy.get(eventId);
    if (eventId === undefined || consumed === undefined) continue;
    outputs.set(
      eventId,
      step.securityIds.filter((securityId) => !consumed.has(securityId))
    );
  }
  for (const [securityId, retirement] of replay.retired) {
    lineage.set(securityId, outputs.get(retirement.recordId) ?? []);
  }
  return lineage;
}

/** The active securities the replay derives from a retired one, through every later retirement, in lineage order. */
function derivedSecurities(securityId: string, lineage: ReadonlyMap<string, string[]>, replay: ReplayResult): string[] {
  const derived: string[] = [];
  const seen = new Set<string>([securityId]);
  const queue = [...(lineage.get(securityId) ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next)) continue;
    seen.add(next);
    if (replay.states.has(next)) derived.push(next);
    else queue.push(...(lineage.get(next) ?? []));
  }
  return derived;
}

/** Why no security of the new book maps to a stop. */
type MappingFailure = Extract<UnmappedStopReason, 'not_on_new_book' | 'not_in_source' | 'retired'>;

type StopTargets =
  { ok: true; securityIds: string[] } | { ok: false; reason: MappingFailure; message: string; securityIds: string[] };

/** Maps the old book's stops onto the new book's securities. */
class StopMapper {
  private readonly lineage: Map<string, string[]>;

  constructor(
    private readonly newIndex: RegisterIndex,
    private readonly replay: ReplayResult | undefined
  ) {
    this.lineage = lineageOf(replay);
  }

  /**
   * The new book's securities a stop goes on: the security with the same ID, else, where the replayed source retired
   * it, each active security it derives from it.
   */
  targets(stop: TeardownStop): StopTargets {
    const { securityId } = stop;
    const newCapTableId = this.newIndex.context.cap_table_id;
    if (this.newIndex.stateOf(securityId) !== null) return { ok: true, securityIds: [securityId] };
    const { replay } = this;
    if (replay === undefined || replay.states.has(securityId)) {
      return {
        ok: false,
        reason: 'not_on_new_book',
        message: `Security ${securityId} has no active state on the new book ${newCapTableId}`,
        securityIds: [securityId],
      };
    }
    const retirement = replay.retired.get(securityId);
    if (retirement === undefined) {
      return {
        ok: false,
        reason: 'not_in_source',
        message: `Security ${securityId} is neither on the new book ${newCapTableId} nor in its replayed source`,
        securityIds: [],
      };
    }
    const derived = derivedSecurities(securityId, this.lineage, replay);
    if (derived.length === 0) {
      return {
        ok: false,
        reason: 'retired',
        message: `The replayed source retires security ${securityId} by ${retirement.recordId} and derives no security from it`,
        securityIds: [],
      };
    }
    const missing = derived.filter((derivedId) => this.newIndex.stateOf(derivedId) === null);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: 'not_on_new_book',
        message:
          `The securities the replayed source derives from ${securityId} (${derived.join(', ')}) are not all on the ` +
          `new book ${newCapTableId}: ${missing.join(', ')} has no active state`,
        securityIds: missing,
      };
    }
    return { ok: true, securityIds: derived };
  }

  /** The new book's open holds on a security (one `targets` returned, so active). */
  holds(securityId: string): OpenHold[] {
    return this.newIndex.stateOf(securityId)?.state.holds ?? [];
  }
}

interface PlacementGroup {
  reference: string;
  reasonText: string;
  lots: Map<string, TeardownStop[]>;
}

/**
 * Plan the re-placement of the old book's open stops on the new book (step 4 of the switch), from the old book read at
 * or after its `CapTable_BeginTeardown` commit: each `STOP_TRANSFER` with `CapTable_PlaceHolds` under the same
 * reference and reason, on the new book's security with the same `security_id`, or, where a correction replaced that
 * security, on each security the replayed source derives from it. Stops of one reference and reason share
 * placements of at most 50 lots.
 *
 * A stop already open on the new book under its reference is not placed again, so planning again after a partial run
 * places only the rest. A stop the plan cannot place, or a part of one, is reported for the TA to resolve.
 *
 * @throws OcpValidationError when the two indexes are one cap table, the old book is still Active
 * (`teardown_not_begun`), the new book is not (`new_book_not_active`) or the old index holds no record payloads
 * (`register_payload_required`)
 * @throws OcpContractError when a book's index has no anchor, or holds two states of one security
 */
export function planStopReplacement(input: PlanStopReplacementInput): StopReplacementPlan {
  const { oldIndexAtTeardown: oldIndex, newIndex, replay } = input;
  requireDistinctBooks(oldIndex, newIndex);
  requireTornDown(oldIndex, 'oldIndexAtTeardown');
  requireActive(newIndex, 'newIndex');
  if (!oldIndex.retainsPayloads) {
    throw new OcpValidationError(
      'oldIndexAtTeardown',
      'The old book was read with retainPayloads: false and holds no stop reasons',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, classification: 'register_payload_required' }
    );
  }
  const mapper = new StopMapper(newIndex, replay);
  const stops = openStops(oldIndex);
  const placed: PlacedStop[] = [];
  const unmapped: UnmappedStop[] = [];
  const groups = new Map<string, PlacementGroup>();
  // The lot that already re-places a reference on a security, and the holds each security gains.
  const lotGroup = new Map<string, PlacementGroup>();
  const added = new Map<string, number>();

  for (const stop of stops) {
    if (stop.reasonText === null) {
      unmapped.push({
        stop,
        reason: 'hold_record_missing',
        message: `The old book's index does not hold ${stop.holdId}, the TX_STOCK_HOLD of stop ${stop.reference} on ${stop.securityId}`,
        securityIds: [],
      });
      continue;
    }
    const targets = mapper.targets(stop);
    if (!targets.ok) {
      unmapped.push({ stop, reason: targets.reason, message: targets.message, securityIds: targets.securityIds });
      continue;
    }
    const already: string[] = [];
    const inUse: string[] = [];
    const full: string[] = [];
    for (const securityId of targets.securityIds) {
      const open = mapper.holds(securityId).find((hold) => hold.reference === stop.reference);
      if (open !== undefined) {
        (open.hold_type === 'STOP_TRANSFER' ? already : inUse).push(securityId);
        continue;
      }
      const lotKey = `${stop.reference}\u0000${securityId}`;
      const existing = lotGroup.get(lotKey);
      if (existing !== undefined) {
        existing.lots.get(securityId)?.push(stop);
        continue;
      }
      const holds = mapper.holds(securityId).length + (added.get(securityId) ?? 0);
      if (holds >= MAX_HOLDS_PER_SECURITY) {
        full.push(securityId);
        continue;
      }
      const groupKey = `${stop.reference}\u0000${stop.reasonText}`;
      let group = groups.get(groupKey);
      if (group === undefined) {
        group = { reference: stop.reference, reasonText: stop.reasonText, lots: new Map() };
        groups.set(groupKey, group);
      }
      group.lots.set(securityId, [stop]);
      lotGroup.set(lotKey, group);
      added.set(securityId, (added.get(securityId) ?? 0) + 1);
    }
    if (already.length > 0) placed.push({ stop, securityIds: already });
    if (inUse.length > 0) {
      unmapped.push({
        stop,
        reason: 'reference_in_use',
        message: `Reference ${stop.reference} is open as a settlement hold on ${inUse.join(', ')} on the new book`,
        securityIds: inUse,
      });
    }
    if (full.length > 0) {
      unmapped.push({
        stop,
        reason: 'hold_limit',
        message: `${full.join(', ')} would carry more than ${MAX_HOLDS_PER_SECURITY} holds on the new book`,
        securityIds: full,
      });
    }
  }

  const placements: StopPlacement[] = [];
  const ordered = [...groups.values()].sort((a, b) =>
    a.reference === b.reference ? compareText(a.reasonText, b.reasonText) : compareText(a.reference, b.reference)
  );
  for (const group of ordered) {
    const lots = [...group.lots.entries()];
    for (let start = 0; start < lots.length; start += MAX_LOTS_PER_OPERATION) {
      const chunk = lots.slice(start, start + MAX_LOTS_PER_OPERATION);
      placements.push({
        reference: group.reference,
        reasonText: group.reasonText,
        lots: chunk.map(([securityId]) => ({ security_id: securityId })),
        stops: chunk.map(([, sources]) => sources),
      });
    }
  }
  return {
    oldCapTableId: oldIndex.context.cap_table_id,
    newCapTableId: newIndex.context.cap_table_id,
    stops,
    placements,
    placed,
    unmapped,
  };
}

/**
 * A stop placement as the register writer takes it, dated on the ledger date it is submitted on: submit it on the new
 * book through its writer (`writer.submit`, with `register.resolveInputs` and `buildPlaceHoldsCommand`).
 */
export function stopPlacementWrite(placement: StopPlacement, date: string): Extract<BookWrite, { kind: 'placeHolds' }> {
  return {
    kind: 'placeHolds',
    holdType: 'STOP_TRANSFER',
    reference: placement.reference,
    date: requireDate(date, 'date'),
    reasonText: placement.reasonText,
    lots: placement.lots.map((lot) => ({ ...lot })),
  };
}

/**
 * Reconcile the two books' stops (step 5 of the switch): every open stop of the old book, read at or after its
 * `CapTable_BeginTeardown` commit, is open under its reference on each new-book security `planStopReplacement` maps it
 * to. Stops the new book holds beyond them (ordered after the commit) are not compared. Run it before the old book is
 * purged: a purged state's stop is no longer read.
 *
 * @throws OcpValidationError when the two indexes are one cap table or the old book is still Active
 * (`teardown_not_begun`)
 * @throws OcpContractError when a book's index has no anchor, or holds two states of one security
 */
export function reconcileStops(
  oldIndex: RegisterIndex,
  newIndex: RegisterIndex,
  options: ReconcileStopsOptions = {}
): StopReconciliation {
  requireDistinctBooks(oldIndex, newIndex);
  requireTornDown(oldIndex, 'oldIndex');
  const mapper = new StopMapper(newIndex, options.replay);
  const matched: PlacedStop[] = [];
  const mismatches: StopMismatch[] = [];
  for (const stop of openStops(oldIndex)) {
    const targets = mapper.targets(stop);
    if (!targets.ok) {
      mismatches.push({ stop, reason: targets.reason, message: targets.message, securityIds: targets.securityIds });
      continue;
    }
    const missing = targets.securityIds.filter(
      (securityId) =>
        !mapper
          .holds(securityId)
          .some((hold) => hold.hold_type === 'STOP_TRANSFER' && hold.reference === stop.reference)
    );
    if (missing.length > 0) {
      mismatches.push({
        stop,
        reason: 'missing_stop',
        message: `Stop ${stop.reference} of security ${stop.securityId} is not open on ${missing.join(', ')} on the new book ${newIndex.context.cap_table_id}`,
        securityIds: missing,
      });
      continue;
    }
    matched.push({ stop, securityIds: targets.securityIds });
  }
  return { reconciled: mismatches.length === 0, matched, mismatches };
}

// ===== Purge =====

function requireByteBudget(value: unknown): number {
  if (value === undefined) return SDK_BATCH_BYTE_BUDGET;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new OcpValidationError('byteBudget', 'Must be a positive number of bytes', {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: value,
    });
  }
  return value;
}

/** Every contract of a book `CapTable_Purge` can archive, with its estimated size: records, states, epochs, shards. */
function purgeTargets(index: RegisterIndex): Array<{ target: PurgeTarget; bytes: number }> {
  const { context } = index;
  const targets: Array<{ target: PurgeTarget; bytes: number }> = [];
  const add = (target: PurgeTarget, payloadBytes: number): void => {
    targets.push({ target, bytes: payloadBytes + jsonBytes(target) });
  };
  for (const record of index.records()) {
    add(
      { kind: 'record', entityType: record.entityType, contractId: record.contractId },
      record.data === null ? 0 : jsonBytes({ context, ocf_data: record.data })
    );
  }
  for (const { contractId, state } of index.states()) add({ kind: 'state', contractId }, stateBytes(state));
  for (const { contractId, epoch } of index.epochs()) add({ kind: 'epoch', contractId }, epochBytes(epoch));
  for (const { contractId, shard } of index.shards()) {
    add({ kind: 'shard', contractId }, shardBytes(context, shard.prefix, shard.claimed.length));
  }
  return targets;
}

/**
 * Plan the optional purge of a torn-down book, as `system_operator`: `CapTable_Purge` batches of at most 500 of its
 * contracts (records, states, epochs and shards), each within the byte budget, then `CapTable_Close`, which leaves
 * the anchor as a tombstone. Export any records the TA must keep first.
 *
 * Plan from a fresh read of the book and submit the commands in order: a purge naming a contract an earlier one
 * archived fails whole, so after a partial run read the book again and plan the rest.
 *
 * @throws OcpContractError when the index has no anchor (`register_anchor_not_found`)
 * @throws OcpValidationError when the book is still Active (`teardown_not_begun`), or for a malformed byte budget
 */
export function planPurge(index: RegisterIndex, options: PlanPurgeOptions = {}): PurgePlan {
  const byteBudget = requireByteBudget(options.byteBudget);
  const anchor = requireTornDown(index, 'index');
  const capTableId = index.context.cap_table_id;
  const systemOperator = index.context.system_operator;
  const unreadable = index.flags().flatMap((flag) => (flag.kind === 'unreadable_contract' ? [flag.contractId] : []));
  const plan = {
    capTableId,
    capTableContractId: anchor.contractId,
    systemOperator,
    unreadable,
  };
  if (anchor.status === 'CLOSED') return { ...plan, status: 'closed', batches: [], commands: [] };

  const batches: PurgeBatch[] = [];
  let current: PurgeBatch = { targets: [], bytes: 0 };
  for (const { target, bytes } of purgeTargets(index)) {
    if (
      current.targets.length > 0 &&
      (current.targets.length >= MAX_CONTRACTS_PER_PURGE || current.bytes + bytes > byteBudget)
    ) {
      batches.push(current);
      current = { targets: [], bytes: 0 };
    }
    current.targets.push(target);
    current.bytes += bytes;
  }
  if (current.targets.length > 0) batches.push(current);

  const anchorRef = {
    capTableContractId: anchor.contractId,
    ...(options.capTableTemplateId !== undefined ? { capTableTemplateId: options.capTableTemplateId } : {}),
  };
  const commands = batches.map((batch) => buildPurgeCommand({ ...anchorRef, systemOperator, targets: batch.targets }));
  const status = unreadable.length > 0 ? 'unreadable' : 'ready';
  if (status === 'ready') commands.push(buildCloseCommand({ ...anchorRef, systemOperator }));
  return { ...plan, status, batches, commands };
}

// ===== Reads =====

/**
 * Read one book for the switch, as any of its three parties: on a change of TA the outgoing TA reads the new book, and
 * the incoming TA the old one, as its issuer or `system_operator`.
 *
 * @throws OcpContractError when the party sees no book under the cap table ID (`register_book_not_found`), or more
 * than one (`register_book_ambiguous`)
 * @throws OcpNetworkError when the read fails
 */
export async function readTeardownBook(
  ledger: LedgerJsonApiClient,
  options: ReadTeardownBookOptions
): Promise<RegisterIndex> {
  const { capTableId, readAs } = options;
  const snapshot = await readRegister(ledger, {
    readAs,
    capTableId,
    ...(options.activeAtOffset !== undefined ? { activeAtOffset: options.activeAtOffset } : {}),
    ...(options.retainPayloads !== undefined ? { retainPayloads: options.retainPayloads } : {}),
    ...(options.idleTimeoutMs !== undefined ? { idleTimeoutMs: options.idleTimeoutMs } : {}),
  });
  const books = snapshot.books.filter((book) => book.context.cap_table_id === capTableId);
  const [book] = books;
  if (book === undefined || books.length > 1) {
    throw new OcpContractError(
      book === undefined
        ? `${readAs} reads no book for cap table ${capTableId} at offset ${snapshot.offset}`
        : `${readAs} reads ${books.length} books for cap table ${capTableId} at offset ${snapshot.offset}`,
      {
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        classification: book === undefined ? 'register_book_not_found' : 'register_book_ambiguous',
        context: { capTableId, readAs, offset: snapshot.offset, books: books.length },
      }
    );
  }
  return book;
}
