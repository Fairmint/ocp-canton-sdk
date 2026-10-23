/**
 * The `CapTable_Restate` a replication's corrections need (design, "One mode and teardown", "Restatement limits"), and
 * its check against the replay of the corrected book.
 *
 * A correction edits or deletes records; the states those records produced must change with them, in the same
 * transaction. The planner replays the corrected book (the book's records with the edits applied and the deletes
 * removed) and restates every state that replay disagrees with: a successor of an active state, the end of a state
 * whose issuance is deleted, or a recreated state for a security whose consuming record is deleted, its `seq` read from
 * the ledger. Each restated state takes its quantity, stakeholder, class, vesting, last event date and origin from the
 * replay, brought to the ledger's own last event date when that is later (a TA snapshot is an event the OCF does not
 * show), its snapshot from the ledger, rescaled to its units, and its `accelerated_since_snapshot` from the
 * accelerations the corrected book records after that snapshot.
 *
 * `checkRestatement` then refuses, with a reason, what the register refuses (its restatement limits and the lineage
 * rules of `Restate.daml`), and any restatement after which a state differs from the replay. A correction larger than
 * one restatement's caps is written in several (`packRestatement`), each holding whole groups of operations that must
 * change together (`restatementGroups`); only a group too large for one restatement is refused.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Restate.daml
 */

import { OcpValidationError } from '../../errors';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { Vesting } from '../../types/native';
import type {
  RecordedSplit,
  RegisterContext,
  RegisterRecord,
  RegisterRequirement,
  ReplayedStockState,
  ReplayResult,
  RestateOperation,
  StateRestatement,
  StockSecurityState,
  StockVesting,
  VestedSnapshot,
} from '../../types/register';
import { recordSecurityIds } from '../admissionRules';
import {
  emptyDelta,
  OverlayView,
  simulateWrite,
  type BookDelta,
  type BookView,
  type WriteSimulation,
} from '../bookSimulation';
import { MAX_CONTRACTS_PER_RESTATEMENT, MAX_TRANCHES_PER_SECURITY } from '../caps';
import { isDerivedForm } from '../ids';
import { requirementsOf } from '../inputs';
import { floorMulDivUnits, fromUnits, showDaml, toUnits } from '../numeric';
import type { RegisterIndex } from '../registerIndex';
import { exceededLimits, type SizingOptions } from '../sizing';
import { applySplits, isCurrentHold, scaleQuantityAcross, settlementHolds, splitsOnOrBefore } from '../splits';
import { fullyCovered, vestedAt } from '../vesting';
import type { EndedState } from './endedState';
import { consumedSecurityIds, dateOfRecord, issuedSecurity, textOf, type SourceRecord } from './source';
import type { ReplicationNotice, ReplicationRefusal, ReplicationRefusalRule } from './types';

/** The records whose security a stock acceptance or vesting record is on (`Restate.subjectSecurity`). */
const SUBJECT_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'vestingStart',
  'vestingEvent',
  'vestingAcceleration',
  'stockAcceptance',
]);

const VESTING_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'vestingStart',
  'vestingEvent',
  'vestingAcceleration',
]);

/** The issuances a vesting record with no stock state may move between. */
const STATELESS_VESTING_TARGETS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'warrantIssuance',
  'equityCompensationIssuance',
]);

/** A ledger write's placeholder contract IDs, for the simulation's working set. */
const placeholder = (kind: string, key: string): string => `restated:${kind}:${key}`;

/** A reason a plan writes nothing, with the records and securities it concerns. */
export function refusal(
  rule: ReplicationRefusalRule,
  message: string,
  recordIds: readonly string[] = [],
  securityIds: readonly string[] = []
): ReplicationRefusal {
  return { rule, message, recordIds: [...recordIds], securityIds: [...securityIds] };
}

function dataOf(record: RegisterRecord | null): Record<string, unknown> | null {
  return record?.data === null || record?.data === undefined ? null : (record.data as Record<string, unknown>);
}

function sameTranches(a: readonly Vesting[], b: readonly Vesting[]): boolean {
  return (
    a.length === b.length &&
    a.every((tranche, i) => {
      const other = b[i];
      return tranche.date === other?.date && toUnits(tranche.amount) === toUnits(other.amount);
    })
  );
}

function sameVesting(a: StockVesting, b: StockVesting): boolean {
  if (a.kind === 'tranches' && b.kind === 'tranches') return sameTranches(a.tranches, b.tranches);
  if (a.kind === 'on_terms' && b.kind === 'on_terms') return a.vesting_terms_id === b.vesting_terms_id;
  return a.kind === b.kind;
}

type RestatedFields = Pick<
  ReplayedStockState,
  | 'issue_date'
  | 'last_event_date'
  | 'origin_transaction_id'
  | 'quantity'
  | 'stakeholder_id'
  | 'stock_class_id'
  | 'vesting'
>;

/** The first field a restatement sets in which two states differ, or `null` when they agree. */
export function differingField(a: RestatedFields, b: RestatedFields): string | null {
  if (a.issue_date !== b.issue_date) return 'issue_date';
  if (a.last_event_date !== b.last_event_date) return 'last_event_date';
  if (a.origin_transaction_id !== b.origin_transaction_id) return 'origin_transaction_id';
  if (toUnits(a.quantity) !== toUnits(b.quantity)) return 'quantity';
  if (a.stakeholder_id !== b.stakeholder_id) return 'stakeholder_id';
  if (a.stock_class_id !== b.stock_class_id) return 'stock_class_id';
  if (!sameVesting(a.vesting, b.vesting)) return 'vesting';
  return null;
}

/**
 * A replayed state brought to a later last event date the ledger shows (a TA snapshot is an event the OCF does not
 * record): the class's splits dated in between applied as the ledger applies them. A later replayed date stays.
 */
export function expectedState(
  replayed: ReplayedStockState,
  ledgerLastEventDate: string | null,
  splits: readonly RecordedSplit[],
  context: RegisterContext
): ReplayedStockState {
  if (ledgerLastEventDate === null || ledgerLastEventDate <= replayed.last_event_date) return replayed;
  const brought = applySplits(splits, ledgerLastEventDate, { ...replayed, context });
  if (!brought.ok) return replayed;
  const { context: _context, ...state } = brought.value;
  return state;
}

/** A quantity in the units of one split epoch of a class, in the units of a later one; `null` going back. */
function scaleBetweenEpochs(
  quantity: string,
  splits: readonly RecordedSplit[],
  fromEpoch: number,
  toEpoch: number
): string | null {
  if (toEpoch < fromEpoch) return null;
  let units = toUnits(quantity);
  for (const split of splits.slice(fromEpoch, toEpoch)) {
    units = floorMulDivUnits(units, toUnits(split.ratio.numerator), toUnits(split.ratio.denominator));
  }
  return fromUnits(units);
}

const minUnits = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * Why `CapTable_Restate` refuses to edit or delete a record, before any state is looked at: a protected record (this
 * book's derived form, a split, the hold pair, the issuer's delete, a stock class with recorded splits or frozen for
 * one), or an edit that changes the record's type, the securities a stock event consumed, the security an acceptance or
 * a vesting record on a stock lot is on, or a stock issuance's security ID. `null` when none applies.
 */
export function recordRefusal(
  index: RegisterIndex,
  operation: Extract<RestateOperation, { kind: 'edit' | 'delete' }>
): ReplicationRefusal | null {
  const objectId = operation.kind === 'edit' ? operation.data.id : operation.objectId;
  const old = index.record(objectId);
  if (old === null) return refusal('restatement', `Record ${objectId} is not on the book`, [objectId]);
  if (isDerivedForm(index.context.cap_table_id, objectId)) {
    return refusal(
      'derived_form',
      `record ${objectId} was written by a register choice and is never restated; correct it with a new record`,
      [objectId]
    );
  }
  if (old.entityType === 'stockClassSplit') {
    return refusal('split', `split ${objectId} is never restated; rebuild the book to correct it`, [objectId]);
  }
  if (old.entityType === 'stockHold' || old.entityType === 'stockHoldCancellation') {
    return refusal('hold_record', 'hold records are never restated', [objectId]);
  }
  if (operation.kind === 'delete') return deleteRefusal(index, old);
  if (operation.type !== old.entityType) {
    return refusal('restatement', `an edit keeps record ${objectId}'s type`, [objectId]);
  }
  const before = dataOf(old);
  const data = operation.data as unknown as Record<string, unknown>;
  const consumedBefore = consumedSecurityIds(old.entityType, before);
  const consumedAfter = consumedSecurityIds(old.entityType, data);
  if (consumedBefore.join('\u0000') !== consumedAfter.join('\u0000')) {
    return refusal(
      'restatement',
      `an edit cannot change the securities record ${objectId} consumed; delete it and write a new one`,
      [objectId],
      [...new Set([...consumedBefore, ...consumedAfter])]
    );
  }
  if (SUBJECT_RECORDS.has(old.entityType)) {
    const from = textOf(before, 'security_id');
    const to = textOf(data, 'security_id');
    const movable =
      VESTING_RECORDS.has(old.entityType) &&
      from !== null &&
      to !== null &&
      STATELESS_VESTING_TARGETS.has(index.issuanceOf(from)?.entityType ?? 'issuer');
    if (from !== to && !movable) {
      return refusal(
        'restatement',
        `an edit cannot change the security record ${objectId} is on; delete it and write a new one`,
        [objectId],
        [from, to].filter((id): id is string => id !== null)
      );
    }
  }
  if (
    old.entityType === 'stockIssuance' &&
    issuedSecurity(old.entityType, before) !== issuedSecurity(old.entityType, data)
  ) {
    return refusal(
      'restatement',
      `an edit cannot change stock issuance ${objectId}'s security ID; delete it and write a new one`,
      [objectId]
    );
  }
  return null;
}

function deleteRefusal(index: RegisterIndex, old: RegisterRecord): ReplicationRefusal | null {
  if (old.entityType === 'issuer') {
    return refusal(
      'issuer',
      'the issuer record is never deleted; tear the book down instead, and rebuild it as a new cap table',
      [old.objectId]
    );
  }
  if (old.entityType !== 'stockClass') return null;
  const epoch = index.epochOf(old.objectId)?.epoch ?? null;
  if (epoch !== null && epoch.splits.length > 0) {
    return refusal(
      'class_with_splits',
      `stock class ${old.objectId} has recorded splits and is never deleted; rebuild the book`,
      [old.objectId]
    );
  }
  if (epoch?.frozen === true) {
    return refusal('frozen_class', `stock class ${old.objectId} is frozen for a split`, [old.objectId]);
  }
  return null;
}

/** What the planner needs to derive a correction's state operations. */
export interface DeriveStatesInput {
  index: RegisterIndex;
  /** The replay of the corrected book, which must hold no violation */
  replay: ReplayResult;
  /** The corrected book's records */
  records: readonly SourceRecord[];
  /** The object IDs the correction deletes */
  deleted: ReadonlySet<string>;
  /** The securities the corrected records name, before and after the correction */
  corrected: ReadonlySet<string>;
  /** Read the state a record ended from the ledger */
  endedState: (consumer: RegisterRecord, securityId: string) => Promise<EndedState>;
}

/** A correction's state operations, and what refuses or reports them. */
export interface DerivedStates {
  operations: RestateOperation[];
  securityIds: string[];
  refusals: ReplicationRefusal[];
  notices: ReplicationNotice[];
}

class StateDeriver {
  readonly operations: RestateOperation[] = [];
  readonly securityIds: string[] = [];
  readonly refusals: ReplicationRefusal[] = [];
  readonly notices: ReplicationNotice[] = [];
  private readonly accelerations = new Map<string, Array<{ date: string; quantity: string }>>();

  constructor(private readonly input: DeriveStatesInput) {
    for (const record of input.records) {
      if (record.entityType !== 'vestingAcceleration') continue;
      const securityId = textOf(record.data, 'security_id');
      const date = dateOfRecord(record.data);
      const quantity = textOf(record.data, 'quantity');
      if (securityId === null || date === null || quantity === null) continue;
      const list = this.accelerations.get(securityId) ?? [];
      list.push({ date, quantity });
      this.accelerations.set(securityId, list);
    }
  }

  async derive(): Promise<DerivedStates> {
    const { index, replay, deleted } = this.input;
    for (const { state } of index.states()) {
      const securityId = state.security_id;
      const replayed = replay.states.get(securityId);
      if (replayed === undefined) {
        const origin = index.record(state.origin_transaction_id);
        if (deleted.has(state.origin_transaction_id) && origin?.entityType === 'stockIssuance') {
          this.push({ kind: 'endState', securityId }, securityId);
        } else {
          this.refusals.push(
            refusal(
              'replay_mismatch',
              `The corrected book ends security ${securityId}, which a restatement ends only with the deletion of its ` +
                `origin issuance ${state.origin_transaction_id}`,
              [state.origin_transaction_id],
              [securityId]
            )
          );
        }
        continue;
      }
      const expected = expectedState(
        replayed,
        state.last_event_date,
        this.splitsOf(replayed.stock_class_id),
        state.context
      );
      if (differingField(state, expected) === null) continue;
      this.push({ kind: 'setState', state: this.restatement(expected, state) }, securityId);
      if (!this.input.corrected.has(securityId)) {
        this.notices.push({
          kind: 'state_drift',
          message: `Security ${securityId} differs from the replay in ${differingField(state, expected) ?? ''}, though no correction names it; it is restated`,
          id: securityId,
          entityType: null,
        });
      }
    }
    for (const [securityId, replayed] of replay.states) {
      if (index.stateOf(securityId) !== null) continue;
      await this.recreate(securityId, replayed);
    }
    return {
      operations: this.operations,
      securityIds: this.securityIds,
      refusals: this.refusals,
      notices: this.notices,
    };
  }

  private push(operation: RestateOperation, securityId: string): void {
    this.operations.push(operation);
    this.securityIds.push(securityId);
  }

  private splitsOf(stockClassId: string): RecordedSplit[] {
    return this.input.replay.splits.get(stockClassId) ?? this.input.index.epochOf(stockClassId)?.epoch.splits ?? [];
  }

  /** A security the ledger ended whose state the corrected book keeps: its consumer is deleted, and it comes back. */
  private async recreate(securityId: string, replayed: ReplayedStockState): Promise<void> {
    const { index, deleted } = this.input;
    const consumer = index
      .recordsNaming(securityId)
      .find(
        (record) =>
          deleted.has(record.objectId) && consumedSecurityIds(record.entityType, dataOf(record)).includes(securityId)
      );
    if (consumer === undefined) {
      this.refusals.push(
        refusal(
          'replay_mismatch',
          `The corrected book keeps security ${securityId}, which has no state on the book, and the correction deletes ` +
            'no record that ended it',
          [],
          [securityId]
        )
      );
      return;
    }
    const ended = await this.input.endedState(consumer, securityId);
    const expected = expectedState(
      replayed,
      ended.state?.last_event_date ?? null,
      this.splitsOf(replayed.stock_class_id),
      index.context
    );
    this.push(
      { kind: 'setState', state: { ...this.restatement(expected, ended.state), seq: ended.seq + 1 } },
      securityId
    );
  }

  /** The restated state: the replay's fields, the ledger's snapshot in its units, the accelerations since. */
  private restatement(expected: ReplayedStockState, from: StockSecurityState | null): StateRestatement {
    const quantity = toUnits(expected.quantity);
    let snapshot: VestedSnapshot | null = null;
    let accelerated: string | null = null;
    if (expected.vesting.kind === 'on_terms') {
      if (from?.snapshot !== null && from?.snapshot !== undefined) {
        const splits = this.splitsOf(from.stock_class_id);
        const vested = scaleBetweenEpochs(
          from.snapshot.vested,
          splits,
          from.split_epoch,
          splitsOnOrBefore(splits, expected.last_event_date)
        );
        if (vested !== null) {
          snapshot = { as_of: from.snapshot.as_of, vested: fromUnits(minUnits(toUnits(vested), quantity)) };
        }
      }
      const since = snapshot?.as_of ?? null;
      const splits = this.splitsOf(expected.stock_class_id);
      let sum = 0n;
      for (const acceleration of this.accelerations.get(expected.security_id) ?? []) {
        if (since !== null && acceleration.date <= since) continue;
        if (acceleration.date > expected.last_event_date) continue;
        sum += toUnits(scaleQuantityAcross(acceleration.quantity, splits, acceleration.date, expected.last_event_date));
      }
      const room = quantity - (snapshot === null ? 0n : toUnits(snapshot.vested));
      sum = minUnits(sum, room);
      accelerated = sum > 0n ? fromUnits(sum) : null;
    }
    return {
      security_id: expected.security_id,
      issue_date: expected.issue_date,
      last_event_date: expected.last_event_date,
      origin_transaction_id: expected.origin_transaction_id,
      quantity: expected.quantity,
      stakeholder_id: expected.stakeholder_id,
      stock_class_id: expected.stock_class_id,
      vesting: expected.vesting,
      snapshot,
      accelerated_since_snapshot: accelerated,
    };
  }
}

/**
 * The state operations a correction needs: the replay of the corrected book against the book's states (see the module
 * notes). States the replay agrees with are left alone.
 */
export async function deriveStateRestatements(input: DeriveStatesInput): Promise<DerivedStates> {
  return new StateDeriver(input).derive();
}

// ===== Restatements in parts =====

/**
 * The records whose correction moves a ceiling the writer checks (`checks/ceilings.ts`) with no state changing: the
 * issuer's, a class's and a plan's definitions and adjustments, a split and a return to a pool.
 */
const CEILING_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'issuer',
  'issuerAuthorizedSharesAdjustment',
  'stockClass',
  'stockClassAuthorizedSharesAdjustment',
  'stockClassSplit',
  'stockPlan',
  'stockPlanPoolAdjustment',
  'stockPlanReturnToPool',
]);

/** The issuances whose securities fill a ceiling: a class's outstanding stock, a plan's grants and plan stock. */
const CEILING_ISSUANCES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'equityCompensationIssuance',
]);

/** The key every operation that can move a ceiling shares. */
const CEILINGS = 'ceilings';

/** The object and security IDs a record's references name. */
function referencedIds(
  entityType: OcfEntityType,
  data: Record<string, unknown>
): { objects: string[]; securities: string[] } {
  const objects: string[] = [];
  const securities: string[] = [];
  let requirements: RegisterRequirement[];
  try {
    requirements = requirementsOf(entityType, data as never);
  } catch {
    // A record the ledger's codec cannot encode names nothing the simulation would accept; it is refused there.
    return { objects, securities };
  }
  for (const requirement of requirements) {
    switch (requirement.kind) {
      case 'object':
        objects.push(requirement.object_id);
        break;
      case 'security':
      case 'vesting_condition':
      case 'trigger':
        securities.push(requirement.security_id);
        break;
      case 'plan_includes_class':
        objects.push(requirement.stock_plan_id, requirement.stock_class_id);
        break;
      case 'ratio_conversion_right':
        objects.push(requirement.stock_class_id);
        break;
      case 'split_of_class':
        objects.push(requirement.split_id, requirement.stock_class_id);
        break;
    }
  }
  return { objects, securities };
}

/** The keys an operation shares with the operations that must go in the same restatement. */
function groupKeys(index: RegisterIndex, operation: RestateOperation, targets: ReadonlySet<string>): Set<string> {
  if (operation.kind === 'setState') return new Set([`security:${operation.state.security_id}`, CEILINGS]);
  if (operation.kind === 'endState') return new Set([`security:${operation.securityId}`, CEILINGS]);
  const objectId = operation.kind === 'edit' ? operation.data.id : operation.objectId;
  const keys = new Set([`object:${objectId}`]);
  const old = index.record(objectId);
  const sides: Array<[OcfEntityType, Record<string, unknown>]> = [];
  if (old !== null) {
    const data = dataOf(old);
    if (data !== null) sides.push([old.entityType, data]);
  }
  if (operation.kind === 'edit') sides.push([operation.type, operation.data as unknown as Record<string, unknown>]);
  for (const [entityType, data] of sides) {
    if (CEILING_RECORDS.has(entityType) || CEILING_ISSUANCES.has(entityType)) keys.add(CEILINGS);
    const named = referencedIds(entityType, data);
    for (const securityId of [...recordSecurityIds(entityType, data), ...named.securities]) {
      keys.add(`security:${securityId}`);
      if (CEILING_ISSUANCES.has(index.issuanceOf(securityId)?.entityType ?? 'issuer')) keys.add(CEILINGS);
    }
    for (const id of named.objects) if (targets.has(id)) keys.add(`object:${id}`);
  }
  return keys;
}

/**
 * A correction's operations in the groups that must each go in one `CapTable_Restate`, each in the correction's
 * order, the groups in the order of their first operation. Operations go together when they name a common stock
 * security (a state with the records that restate it, an event with the lots it consumes and creates), when one's
 * record names a record the other edits or deletes (so no restatement leaves a reference to a record another has
 * deleted), and when both can move a ceiling the writer checks (every state, every record on a stock or
 * equity-compensation security, and the issuer's, a class's and a plan's definitions and adjustments), so no part is
 * checked against a ceiling another part has yet to move back. Every other record, such as a stakeholder, a legend or
 * a document that no other corrected record names, is a group of its own.
 */
export function restatementGroups(index: RegisterIndex, operations: readonly RestateOperation[]): RestateOperation[][] {
  const targets = new Set(
    operations.flatMap((operation) =>
      operation.kind === 'edit' ? [operation.data.id] : operation.kind === 'delete' ? [operation.objectId] : []
    )
  );
  const parent = operations.map((_operation, position) => position);
  const root = (position: number): number => {
    let at = position;
    while (parent[at] !== at) {
      const up = parent[at] ?? at;
      parent[at] = parent[up] ?? up;
      at = up;
    }
    return at;
  };
  const owner = new Map<string, number>();
  for (const [position, operation] of operations.entries()) {
    for (const key of groupKeys(index, operation, targets)) {
      const other = owner.get(key);
      if (other === undefined) {
        owner.set(key, position);
        continue;
      }
      const [a, b] = [root(position), root(other)];
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  }
  const groups = new Map<number, RestateOperation[]>();
  for (const [position, operation] of operations.entries()) {
    const group = groups.get(root(position)) ?? [];
    group.push(operation);
    groups.set(root(position), group);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

/** One `CapTable_Restate` of a correction, simulated over the book as the parts before it leave it. */
export interface RestatementPart {
  operations: RestateOperation[];
  simulation: WriteSimulation;
}

/** A correction packed into restatements within the caps, or why it cannot be. */
export interface PackedRestatement {
  /** The restatements in order; empty when refused */
  parts: RestatementPart[];
  /** The book after every part, over the view, under placeholder contract IDs */
  delta: BookDelta;
  refusals: ReplicationRefusal[];
}

function recordIdsOf(operations: readonly RestateOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === 'edit' ? [operation.data.id] : operation.kind === 'delete' ? [operation.objectId] : []
  );
}

function securityIdsOf(operations: readonly RestateOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === 'setState'
      ? [operation.state.security_id]
      : operation.kind === 'endState'
        ? [operation.securityId]
        : []
  );
}

/**
 * Pack a correction into `CapTable_Restate` transactions within every cap (500 contracts, the claims, tranches,
 * references and shards a transaction may use, the SDK's byte budget): one when it fits, else as few as fit of its
 * groups ({@link restatementGroups}), each part the longest run of groups that fits over the book as the parts before
 * it leave it. Only a group that fits in no restatement on its own is refused (`too_large`).
 *
 * @throws OcpValidationError with the ledger's message when the simulation refuses an operation
 */
export function packRestatement(
  index: RegisterIndex,
  view: BookView,
  operations: readonly RestateOperation[],
  sizing?: SizingOptions
): PackedRestatement {
  const delta = emptyDelta();
  const whole = simulateWrite(view, { kind: 'restate', operations: [...operations] });
  if (exceededLimits('restate', whole.usage(), sizing).length === 0) {
    whole.commitTo(delta, (kind, key) => placeholder(`0:${kind}`, key));
    return { parts: [{ operations: [...operations], simulation: whole }], delta, refusals: [] };
  }
  const groups = restatementGroups(index, operations);
  const order = new Map(operations.map((operation, position) => [operation, position]));
  const after = new OverlayView(view, delta);
  const parts: RestatementPart[] = [];
  const attempt = (start: number, count: number) => {
    const part = groups
      .slice(start, start + count)
      .flat()
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const simulation = simulateWrite(after, { kind: 'restate', operations: part });
    return { part, simulation, exceeded: exceededLimits('restate', simulation.usage(), sizing) };
  };
  for (let start = 0; start < groups.length;) {
    let fit = attempt(start, 1);
    if (fit.exceeded.length > 0) {
      return {
        parts: [],
        delta: emptyDelta(),
        refusals: [
          refusal(
            'too_large',
            `A correction whose records and states change together exceeds one restatement's caps: ${fit.exceeded.join(
              '; '
            )}; correct it in smaller steps in the source, or rebuild the book`,
            recordIdsOf(fit.part),
            securityIdsOf(fit.part)
          ),
        ],
      };
    }
    // The longest run of groups from `start` that fits: usage only grows with the operations added, and every
    // operation touches at least one contract.
    let low = 1;
    let high = 1;
    for (let size = fit.part.length; start + high < groups.length; high += 1) {
      size += groups[start + high]?.length ?? 0;
      if (size > MAX_CONTRACTS_PER_RESTATEMENT) break;
    }
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = attempt(start, middle);
      if (candidate.exceeded.length === 0) {
        low = middle;
        fit = candidate;
      } else {
        high = middle - 1;
      }
    }
    fit.simulation.commitTo(delta, (kind, key) => placeholder(`${parts.length}:${kind}`, key));
    parts.push({ operations: fit.part, simulation: fit.simulation });
    start += low;
  }
  return { parts, delta, refusals: [] };
}

// ===== The check =====

/** What `checkRestatement` checks. */
export interface CheckRestatementInput {
  index: RegisterIndex;
  /** The book as the restatement will find it (the key index, or an overlay with the writes planned before it) */
  view: BookView;
  operations: readonly RestateOperation[];
  /** The replay of the corrected book */
  replay: ReplayResult;
  sizing?: SizingOptions;
}

/**
 * A checked correction: its refusals, and when the ledger's rules accept it, its restatements within the caps, in
 * order, each simulated over the view as the parts before it leave it.
 */
export interface RestatementCheck {
  refusals: ReplicationRefusal[];
  parts: RestatementPart[] | null;
}

class RestatementChecker {
  readonly refusals: ReplicationRefusal[] = [];
  private readonly deletedRecords = new Map<string, RegisterRecord>();
  private readonly ended = new Set<string>();
  private readonly recreated = new Set<string>();

  constructor(private readonly input: CheckRestatementInput) {}

  check(): RestatementCheck {
    const { operations } = this.input;
    for (const operation of operations) {
      if (operation.kind === 'delete') {
        const record = this.input.index.record(operation.objectId);
        if (record !== null) this.deletedRecords.set(operation.objectId, record);
      }
      if (operation.kind === 'endState') this.ended.add(operation.securityId);
      if (operation.kind === 'setState' && operation.state.seq !== undefined && operation.state.seq !== null) {
        this.recreated.add(operation.state.security_id);
      }
    }
    for (const operation of operations) this.checkOperation(operation);
    this.checkDeletedIssuances();
    if (this.refusals.length > 0) return { refusals: this.refusals, parts: null };

    let packed: PackedRestatement;
    try {
      packed = packRestatement(this.input.index, this.input.view, operations, this.input.sizing);
    } catch (error) {
      if (!(error instanceof OcpValidationError)) throw error;
      this.refusals.push(refusal('restatement', `CapTable_Restate would be refused: ${error.message}`));
      return { refusals: this.refusals, parts: null };
    }
    this.refusals.push(...packed.refusals);
    if (this.refusals.length > 0) return { refusals: this.refusals, parts: null };
    this.checkAfter(packed.delta);
    return { refusals: this.refusals, parts: this.refusals.length === 0 ? packed.parts : null };
  }

  private checkOperation(operation: RestateOperation): void {
    switch (operation.kind) {
      case 'edit':
      case 'delete': {
        const refused = recordRefusal(this.input.index, operation);
        if (refused !== null) this.refusals.push(refused);
        break;
      }
      case 'endState':
        this.checkEnd(operation.securityId);
        break;
      case 'setState':
        this.checkSetState(operation.state);
        break;
    }
  }

  private frozen(stockClassId: string, securityId: string): boolean {
    if (this.input.view.epoch(stockClassId)?.epoch.frozen !== true) return false;
    this.refusals.push(refusal('frozen_class', `stock class ${stockClassId} is frozen for a split`, [], [securityId]));
    return true;
  }

  private checkEnd(securityId: string): void {
    const current = this.input.view.state(securityId)?.state ?? null;
    if (current === null) {
      this.refusals.push(refusal('restatement', `no active state for security ${securityId}`, [], [securityId]));
      return;
    }
    if (this.frozen(current.stock_class_id, securityId)) return;
    if (current.holds.length > 0) {
      this.refusals.push(
        refusal(
          'held_state',
          `security ${securityId} carries an open hold; a restatement never ends a lot on hold`,
          current.holds.map((hold) => hold.hold_id),
          [securityId]
        )
      );
      return;
    }
    const origin = this.deletedRecords.get(current.origin_transaction_id);
    if (origin?.entityType !== 'stockIssuance' || textOf(dataOf(origin), 'security_id') !== securityId) {
      this.refusals.push(
        refusal(
          'restatement',
          `a restatement ends security ${securityId}'s state only with the deletion of its origin issuance ${
            current.origin_transaction_id
          }`,
          [current.origin_transaction_id],
          [securityId]
        )
      );
    }
  }

  private checkSetState(restated: StateRestatement): void {
    const securityId = restated.security_id;
    const current = this.input.view.state(securityId)?.state ?? null;
    const seq = restated.seq ?? null;
    if (this.frozen(restated.stock_class_id, securityId)) return;
    if (current !== null && seq !== null) {
      this.refusals.push(
        refusal('restatement', `security ${securityId} has an active state; replace it without a seq`, [], [securityId])
      );
      return;
    }
    if (current === null) {
      if (seq === null) {
        this.refusals.push(
          refusal(
            'restatement',
            `no active state for security ${securityId}; give a seq to recreate one`,
            [],
            [securityId]
          )
        );
        return;
      }
      const consumedByDeleted = [...this.deletedRecords.values()].some((record) =>
        consumedSecurityIds(record.entityType, dataOf(record)).includes(securityId)
      );
      if (!consumedByDeleted) {
        this.refusals.push(
          refusal(
            'restatement',
            `a restatement recreates security ${securityId}'s state only with the deletion of the record that consumed it`,
            [],
            [securityId]
          )
        );
      }
      return;
    }
    if (restated.last_event_date < current.last_event_date) {
      this.refusals.push(
        refusal(
          'restatement',
          `a restatement never moves security ${securityId}'s last event date back`,
          [],
          [securityId]
        )
      );
    } else if (restated.origin_transaction_id !== current.origin_transaction_id) {
      this.refusals.push(
        refusal(
          'restatement',
          `a successor of security ${securityId} keeps its origin transaction ${current.origin_transaction_id}`,
          [current.origin_transaction_id],
          [securityId]
        )
      );
    } else if (current.stock_class_id !== restated.stock_class_id && this.frozen(current.stock_class_id, securityId)) {
    } else if (
      current.holds.length > 0 &&
      (restated.stakeholder_id !== current.stakeholder_id ||
        restated.stock_class_id !== current.stock_class_id ||
        restated.last_event_date !== current.last_event_date)
    ) {
      this.refusals.push(
        refusal(
          'held_state',
          `security ${securityId} carries an open hold, so a restatement keeps its stakeholder, class and last event date`,
          current.holds.map((hold) => hold.hold_id),
          [securityId]
        )
      );
    }
  }

  /** A deleted stock issuance's lot must end here, or the record that consumed it be present or deleted with it. */
  private checkDeletedIssuances(): void {
    const { index } = this.input;
    for (const [objectId, record] of this.deletedRecords) {
      if (record.entityType !== 'stockIssuance') continue;
      const securityId = textOf(dataOf(record), 'security_id');
      if (securityId === null || this.ended.has(securityId)) continue;
      const consumers = index
        .recordsNaming(securityId)
        .filter((candidate) => consumedSecurityIds(candidate.entityType, dataOf(candidate)).includes(securityId));
      const present = consumers.find((consumer) => !this.deletedRecords.has(consumer.objectId));
      if (present !== undefined) {
        if (isDerivedForm(index.context.cap_table_id, present.objectId)) {
          this.refusals.push(
            refusal(
              'derived_form',
              `security ${securityId} was consumed by ${present.objectId}, which a register choice wrote, so its ` +
                `issuance ${objectId} is never deleted`,
              [objectId, present.objectId],
              [securityId]
            )
          );
        }
        continue;
      }
      if (consumers.length > 0 && !this.recreated.has(securityId)) continue;
      this.refusals.push(
        refusal(
          'restatement',
          `a restatement deletes stock issuance ${objectId} only with the end of security ${securityId}'s state, or ` +
            'with the record that consumed it among its inputs or deleted with it',
          [objectId],
          [securityId]
        )
      );
    }
  }

  /** The states after every part of the restatement equal the replay's, and keep the ledger's invariants. */
  private checkAfter(delta: BookDelta): void {
    const { index, replay, view } = this.input;
    const after = new OverlayView(view, delta);
    const securities = new Set<string>([...replay.states.keys(), ...delta.states.keys()]);
    for (const { state } of index.states()) securities.add(state.security_id);
    for (const securityId of [...securities].sort()) {
      const post = after.state(securityId)?.state ?? null;
      const replayed = replay.states.get(securityId);
      if (replayed === undefined) {
        if (post !== null) {
          this.refusals.push(
            refusal(
              'replay_mismatch',
              `Security ${securityId} keeps a state after the restatement, which the corrected book ends`,
              [],
              [securityId]
            )
          );
        }
        continue;
      }
      if (post === null) {
        this.refusals.push(
          refusal(
            'replay_mismatch',
            `The corrected book holds security ${securityId}, which has no state after the restatement`,
            [],
            [securityId]
          )
        );
        continue;
      }
      const splits =
        replay.splits.get(replayed.stock_class_id) ?? view.epoch(replayed.stock_class_id)?.epoch.splits ?? [];
      const expected = expectedState(replayed, post.last_event_date, splits, index.context);
      const field = differingField(post, expected);
      if (field !== null) {
        this.refusals.push(
          refusal(
            'replay_mismatch',
            `Security ${securityId} differs from the replay of the corrected book in ${field} after the restatement`,
            [],
            [securityId]
          )
        );
        continue;
      }
      if (delta.states.has(securityId)) this.checkInvariants(post);
    }
  }

  /** `State.validateStockSecurity` on a state the restatement writes. */
  private checkInvariants(state: StockSecurityState): void {
    const securityId = state.security_id;
    const quantity = toUnits(state.quantity);
    const broken = (message: string, rule: ReplicationRefusalRule = 'restatement'): void => {
      this.refusals.push(refusal(rule, message, [], [securityId]));
    };
    if (quantity <= 0n) {
      broken(`security ${securityId} must hold a positive quantity`);
      return;
    }
    if (state.issue_date > state.last_event_date) {
      broken(`security ${securityId} would be issued after its last event date`);
      return;
    }
    if (state.vesting.kind === 'tranches') {
      const { tranches } = state.vesting;
      const total = tranches.reduce((sum, tranche) => sum + toUnits(tranche.amount), 0n);
      if (tranches.length > MAX_TRANCHES_PER_SECURITY || tranches.some((tranche) => toUnits(tranche.amount) <= 0n)) {
        broken(`security ${securityId} would have tranches the ledger refuses`);
        return;
      }
      if (total > quantity) {
        broken(`the vesting tranches of security ${securityId} would exceed its quantity ${showDaml(quantity)}`);
        return;
      }
    }
    const { snapshot } = state;
    const accelerated = state.accelerated_since_snapshot === null ? 0n : toUnits(state.accelerated_since_snapshot);
    if (
      (snapshot !== null || state.accelerated_since_snapshot !== null) &&
      (state.vesting.kind !== 'on_terms' ||
        (snapshot !== null && (toUnits(snapshot.vested) > quantity || snapshot.as_of > state.last_event_date)) ||
        (snapshot === null ? 0n : toUnits(snapshot.vested)) + accelerated > quantity)
    ) {
      broken(`the vesting snapshot of security ${securityId} would not fit the restated state`);
      return;
    }
    for (const hold of settlementHolds(state)) {
      if (!fullyCovered(state)) {
        broken(
          `security ${securityId} carries settlement hold ${hold.hold_id}, so its tranches must cover its quantity`,
          'held_state'
        );
        return;
      }
      if (
        isCurrentHold(state, hold) &&
        hold.quantity !== null &&
        toUnits(hold.quantity) > toUnits(vestedAt(state, state.last_event_date))
      ) {
        broken(
          `the restatement would leave settlement hold ${hold.hold_id} on security ${securityId} above its vested shares`,
          'held_state'
        );
        return;
      }
    }
  }
}

/**
 * Check a `CapTable_Restate` against the register's restatement limits and the replay of the corrected book: the
 * protected records (derived form, splits, the hold pair, the issuer, a class with splits), frozen classes, held lots,
 * the lineage rules (a state ends only with its issuance's delete, a recreated state needs its consumer's delete, a
 * deleted stock issuance's lot ends here or its consumer is present), the ledger's ID and reference rules and caps
 * (simulated over the view), and then that every state after it equals the replayed state and keeps the state's
 * invariants.
 *
 * @returns the refusals, and the simulation when there are none (to carry the book forward for later planned writes)
 */
export function checkRestatement(input: CheckRestatementInput): RestatementCheck {
  return new RestatementChecker(input).check();
}
