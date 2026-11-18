/**
 * The replication subpath's types: what `planReplication` plans from a book's source records and its key index, what
 * `executeReplication` reports as it writes the plan through the register writer, and the switch from a book to its
 * rebuild (`checkTeardownReady`, `planStopReplacement`, `reconcileStops`, `planPurge`).
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { OcfStockClassSplit } from '../../types/native';
import type {
  ApplyOperation,
  ApplyPreSplitShardOperation,
  CapTableCommand,
  PlaceHoldLot,
  PurgeTarget,
  RecordSplitResult,
  RegisterBatchCommitted,
  RegisterWriteSummary,
  ReplayViolation,
  RestateOperation,
} from '../../types/register';
import type { OcfManifest } from '../../utils/cantonOcfExtractor';
import type { ReplicationDiff, SourceReplicationItem } from '../../utils/replicationHelpers';

/** A book's source records (PostgreSQL's OCF): a manifest, or items with their entity kinds. */
export type ReplicationSource = OcfManifest | readonly SourceReplicationItem[];

/** Options of `planReplication`. */
export interface PlanReplicationOptions {
  /**
   * The Ledger API client the planner reads ended states with: a restatement that recreates the state of a security
   * whose consuming record it deletes needs that state's `seq`, which only the ledger knows. Required only then.
   */
  ledger?: LedgerJsonApiClient;
  /** The party those reads are made as (default: the book's transfer agent) */
  readAs?: string;
  /**
   * Pre-split the ID shards until each would hold about this many claimed IDs once the creates are written (default
   * 32, half a shard's 64). A book whose claims fit the shards it has gets no pre-split.
   */
  hashesPerShard?: number;
  /** Log the field-level differences of every edit (`computeReplicationDiff`'s `reportDifferences`) */
  reportDifferences?: boolean;
}

/** How a replication step is written. */
export type ReplicationStepKind = 'preSplit' | 'apply' | 'split' | 'restate';

/** One-bit `ApplyPreSplitShard` operations, written before a large book's records so its claims seldom split a shard. */
export interface ReplicationPreSplitStep {
  kind: 'preSplit';
  operations: ApplyPreSplitShardOperation[];
}

/** Records written through `CapTable_Apply`, in replay order; the writer packs them into transactions. */
export interface ReplicationApplyStep {
  kind: 'apply';
  operations: ApplyOperation[];
  /** The records the step writes, in order */
  recordIds: string[];
}

/** A historical split, recorded by the split procedure (`register.recordSplit`). */
export interface ReplicationSplitStep {
  kind: 'split';
  split: OcfStockClassSplit;
  recordIds: [string];
}

/** Corrections written through one `CapTable_Restate`, with the states they restate. */
export interface ReplicationRestateStep {
  kind: 'restate';
  operations: RestateOperation[];
  /** The records the restatement edits or deletes */
  recordIds: string[];
  /** The securities whose states it replaces, ends or recreates */
  securityIds: string[];
  /**
   * The contracts the plan read the restatement from: the state of each security it sets or ends, and each record it
   * edits or deletes. `executeReplication` refuses the step under the writer's locks, and plans again, when any of
   * them is no longer the book's (a snapshot, hold or edit committed since), so a restatement never writes what the
   * plan read over a newer state.
   */
  basis: ReplicationRestateBasis[];
}

/** A contract a restatement was planned from. */
export interface ReplicationRestateBasis {
  kind: 'state' | 'record';
  /** The security's ID for a state, the object ID for a record */
  id: string;
  /** The active contract the plan read; `null` for a security with no active state (one the restatement recreates) */
  contractId: string | null;
}

/** One step of a replication plan. */
export type ReplicationStep =
  ReplicationPreSplitStep | ReplicationApplyStep | ReplicationSplitStep | ReplicationRestateStep;

/**
 * Why a plan refuses to write anything: a restatement limit of the register, or a source the book cannot be brought
 * to by Apply and Restate. A refused book is rebuilt as a new cap table.
 *
 * - `book_not_active`: the book has no active anchor (it is being torn down, or was not read)
 * - `derived_form`: a correction needs a record a register choice wrote (its ID has this book's derived form) to change
 * - `split`: an edit or delete of a `TX_STOCK_CLASS_SPLIT`
 * - `hold_record`: an edit or delete of a hold record
 * - `issuer`: the issuer record's delete, or a second issuer
 * - `class_with_splits`: the delete of a stock class whose epoch has recorded splits
 * - `held_state`: a state with an open hold or stop would change its stakeholder, class or last event date, end, or
 *   be left with a settlement hold its vested shares or tranches no longer cover
 * - `frozen_class`: a correction touches a stock class frozen for a split
 * - `restatement`: another rule of `CapTable_Restate` refuses the correction (the ledger's message)
 * - `replay_mismatch`: the states after the restatement would not be the replayed states
 * - `out_of_order`: a record to create precedes history the book already holds (a later event on its security, or a
 *   record in a split's class dated on or after the split)
 * - `partial_bundle`: part of a bundled stock event is on the book and part is not
 * - `too_large`: one correction whose records and states must change together exceeds a per-transaction cap (an
 *   independent correction goes in a restatement of its own), or a correction above the caps cannot be split into
 *   restatements the writer's checks accept, each over the book as the restatements before it leave it
 * - `ledger`: the ledger's ID or reference rules would refuse a step (the ledger's message)
 * - `references`: the writer's references check would refuse a restatement: it would leave a live record with a broken
 *   reference, or delete a stock class or stakeholder that stock is outstanding in (the check's message)
 */
export type ReplicationRefusalRule =
  | 'book_not_active'
  | 'derived_form'
  | 'split'
  | 'hold_record'
  | 'issuer'
  | 'class_with_splits'
  | 'held_state'
  | 'frozen_class'
  | 'restatement'
  | 'replay_mismatch'
  | 'out_of_order'
  | 'partial_bundle'
  | 'too_large'
  | 'ledger'
  | 'references';

/** A reason a plan writes nothing. */
export interface ReplicationRefusal {
  rule: ReplicationRefusalRule;
  message: string;
  /** The records concerned */
  recordIds: string[];
  /** The stock securities concerned */
  securityIds: string[];
}

/**
 * Something the plan leaves out or works around, which writes nothing wrong:
 *
 * - `hold_pair`: a source hold record, left out: only the hold choices write the hold pair
 * - `derived_form_skipped`: a source record with this book's derived form, equal to the ledger's: the ledger wrote it
 * - `derived_form_differs`: such a record differs from the ledger's: never edited, a correction is a new record
 * - `derived_form_missing`: such a record is not on the book: a register choice of another book wrote it, or it was
 *   never written; it cannot be claimed
 * - `register_named_kept`: a record of the book the source lacks, which a record a register choice wrote names: kept,
 *   never deleted, as no restatement could repair that reference. Chiefly a settlement's new buyer, whose stakeholder
 *   `CapTable_Settle` wrote under a claimed ID, before apiv2 reads the trade back
 * - `edit_unchanged`: the source differs from the book only where the ledger stores nothing: no edit is written
 * - `state_drift`: a state no correction touches differs from the replay of the corrected book, and is restated
 */
export type ReplicationNoticeKind =
  | 'hold_pair'
  | 'derived_form_skipped'
  | 'derived_form_differs'
  | 'derived_form_missing'
  | 'register_named_kept'
  | 'edit_unchanged'
  | 'state_drift';

/** A record or state the plan reports. */
export interface ReplicationNotice {
  kind: ReplicationNoticeKind;
  message: string;
  /** The record concerned, or the security for `state_drift` */
  id: string;
  entityType: OcfEntityType | null;
}

/**
 * What a plan does:
 *
 * - `current`: the book holds the source; nothing to write
 * - `ready`: the steps bring the book to the source
 * - `blocked`: the source does not replay under the v35 rules (`violation`): the steps write only the valid prefix of a
 *   source that needs no correction, else nothing; fix the source first
 * - `refused`: a restatement limit or the book's history refuses the source (`refusals`): nothing is written, and the
 *   book is rebuilt as a new cap table
 */
export type ReplicationPlanStatus = 'current' | 'ready' | 'blocked' | 'refused';

/** A replication plan: the steps that bring one book to its source, in order. */
export interface ReplicationPlan {
  capTableId: string;
  /** The key index's offset the plan was made at */
  offset: number;
  status: ReplicationPlanStatus;
  steps: ReplicationStep[];
  /**
   * The records to create, edit and delete: never a derived-form record or the hold pair, and never the delete of a
   * record a derived-form record names
   */
  diff: ReplicationDiff;
  /** The securities whose states the restatements replace, end or recreate */
  restatedSecurityIds: string[];
  /** The source's first record the v35 rules refuse, or `null` */
  violation: ReplayViolation | null;
  refusals: ReplicationRefusal[];
  notices: ReplicationNotice[];
  /** The source as planned (normalized, entity kinds resolved): `executeReplication` plans again from it */
  source: SourceReplicationItem[];
  /** The options it was planned with */
  options: PlanReplicationOptions;
}

/** Options of `executeReplication`. */
export interface ExecuteReplicationOptions {
  /** Called before each step and after each re-plan */
  onProgress?: (progress: ReplicationProgress) => void;
  /**
   * How many times a run plans again from the updated index (after a failed step, or once its steps are written)
   * before it stops (default 3). A failed step whose plan committed nothing and is not retryable stops the run.
   */
  maxReplans?: number;
  /** The writer's checks of each `CapTable_Apply` and `CapTable_Restate` (default: all) */
  checks?: boolean;
  /** Stop waiting for locks when this signal aborts; no further step starts once it has */
  signal?: AbortSignal;
}

/** Where a replication run is. */
export interface ReplicationProgress {
  /** `step`: a step is about to run; `replan`: the run planned again */
  phase: 'step' | 'replan';
  /** The plan's number in this run, from 1 */
  plan: number;
  /** The step's position in its plan, from 0; the number of steps for `replan` */
  step: number;
  /** The plan's number of steps */
  steps: number;
  kind: ReplicationStepKind | null;
  /** Transactions committed so far in this run */
  transactions: number;
}

/** A step a run wrote, with what it committed. */
export type ExecutedReplicationStep =
  | { kind: 'preSplit' | 'apply' | 'restate'; step: ReplicationStep; summary: RegisterWriteSummary }
  | { kind: 'split'; step: ReplicationSplitStep; result: RecordSplitResult };

/** What `executeReplication` did. */
export interface ReplicationResult {
  /** The last plan: `current` once the book holds the source */
  plan: ReplicationPlan;
  /** The steps written, in order, over every plan of the run */
  executed: ExecutedReplicationStep[];
  /** The `CapTable_Apply` and `CapTable_Restate` transactions committed, in order */
  committed: RegisterBatchCommitted[];
  /** Transactions committed in all, the split procedure's freezes and unfreezes included */
  transactions: number;
  /** How many times the run planned again */
  replans: number;
}

/**
 * The error `executeReplication` throws: the failing step's own error, carrying what the run wrote before it on
 * `replication` (non-enumerable).
 */
export type ReplicationError = Error & {
  readonly replication?: Omit<ReplicationResult, 'plan'> & { plan: ReplicationPlan };
};

// ===== Teardown and the switch to a rebuilt book =====

/**
 * A condition of the switch to a rebuilt book that does not hold yet (`checkTeardownReady`):
 *
 * - `old_book_status`: the old book has no anchor, or its anchor is not Active (its teardown has begun already)
 * - `new_book_status`: the new book has no anchor, or its anchor is not Active
 * - `incomplete_read`: a book's index holds a contract it could not read, two anchors or two records under one object
 *   ID, so it cannot show which records the book holds
 * - `index_behind`: the old book's index was read before the drain finished
 * - `settlement_hold`: the old book carries a settlement hold, current or voided: no hold choice runs after the
 *   teardown, so the TA releases its trade (or cancels the voided hold) first
 * - `missing_record`: a record the old book wrote, other than the hold pair and the records the correction removes, is
 *   not on the new book; a record a register choice wrote, or one such a record names, is never one the correction
 *   removes
 * - `written_after_drain`: a record other than the hold pair was written to the old book after the drain finished: a
 *   writer did not stop, and the drain must be run again
 */
export type TeardownCondition =
  | 'old_book_status'
  | 'new_book_status'
  | 'incomplete_read'
  | 'index_behind'
  | 'settlement_hold'
  | 'missing_record'
  | 'written_after_drain';

/** A condition that stops the switch, with what it concerns. */
export interface TeardownIssue {
  condition: TeardownCondition;
  message: string;
  /** The records concerned (the hold of a `settlement_hold`) */
  recordIds: string[];
  /** The stock securities concerned */
  securityIds: string[];
}

/**
 * A record of the old book the rebuild corrected, which the TA confirms:
 *
 * - `differs`: both books hold it, and its content differs (only books read with their record payloads are compared)
 * - `removed`: the correction removes it (`removedByCorrection`), and the new book does not hold it
 */
export interface TeardownRecordDifference {
  kind: 'differs' | 'removed';
  objectId: string;
  /** The old book's record kind */
  entityType: OcfEntityType;
  /** The new book's record kind, which a correction may have changed; `null` for a removed record */
  newEntityType: OcfEntityType | null;
  /** The differing fields, as `ocfCompare` reports them (old first); empty for a removed record */
  differences: string[];
}

/** Whether a book's teardown may begin (step 3 of the switch). */
export interface TeardownReadiness {
  /** Every condition holds: the TA may commit `CapTable_BeginTeardown` on the old book */
  ready: boolean;
  oldCapTableId: string;
  newCapTableId: string;
  drainOffset: number;
  /** The conditions that do not hold, in the order checked */
  issues: TeardownIssue[];
  /** The records the rebuild corrected: those both books hold that differ, and those the correction removes */
  differences: TeardownRecordDifference[];
  /** The old book's records checked against the new book (the hold pair left out) */
  recordsChecked: number;
}

/** An open `STOP_TRANSFER` of a book being torn down. */
export interface TeardownStop {
  securityId: string;
  /** The `TX_STOCK_HOLD` that placed it */
  holdId: string;
  /** The stop's case or order reference */
  reference: string;
  /** The hold record's reason; `null` when the index does not hold the record or its payload */
  reasonText: string | null;
  stakeholderId: string;
  stockClassId: string;
}

/**
 * Why a stop of the old book cannot be re-placed on the new book, or where it would not hold:
 *
 * - `not_on_new_book`: the security, or a security the replayed source derives from it, has no active state on the new
 *   book: replicate the source into it first
 * - `not_in_source`: the new book has no active state for the security and the replayed source never issued it
 * - `retired`: the replayed source retires the security and derives no security from it
 * - `hold_record_missing`: the old book's index does not hold the stop's `TX_STOCK_HOLD`, so its reason is unknown
 * - `reference_in_use`: the new book's security carries a settlement hold under the stop's reference
 * - `hold_limit`: the new book's security would carry more than 32 holds
 */
export type UnmappedStopReason =
  'not_on_new_book' | 'not_in_source' | 'retired' | 'hold_record_missing' | 'reference_in_use' | 'hold_limit';

/** A stop the plan cannot re-place, on the securities named; the TA resolves it. */
export interface UnmappedStop {
  stop: TeardownStop;
  reason: UnmappedStopReason;
  message: string;
  /** The new book's securities concerned (empty when none could be named) */
  securityIds: string[];
}

/** A stop of the old book already open on the new book's securities, under the same reference. */
export interface PlacedStop {
  stop: TeardownStop;
  securityIds: string[];
}

/**
 * One `CapTable_PlaceHolds` of `STOP_TRANSFER` holds on the new book: every lot under the stops' reference and reason.
 * `stopPlacementWrite` turns it into the write, dated on the ledger date it is submitted on.
 */
export interface StopPlacement {
  reference: string;
  reasonText: string;
  /** 1 to 50 lots, each a security of the new book; a stop takes no quantity and no origin issuance */
  lots: PlaceHoldLot[];
  /** For each lot, in order, the old book's stops it re-places */
  stops: TeardownStop[][];
}

/** How the old book's open stops go onto the new book (step 4 of the switch). */
export interface StopReplacementPlan {
  oldCapTableId: string;
  newCapTableId: string;
  /** The old book's open stops, by reference and security */
  stops: TeardownStop[];
  /** The placements to submit on the new book as its TA, in order */
  placements: StopPlacement[];
  /** Stops already open on the new book */
  placed: PlacedStop[];
  /** Stops, or the parts of a stop, the plan cannot place */
  unmapped: UnmappedStop[];
}

/**
 * Why a stop of the old book has no match on the new book: no security of the new book maps to it
 * (`not_on_new_book`, `not_in_source`, `retired`, as {@link UnmappedStopReason} says), or one that does lacks the stop
 * (`missing_stop`).
 */
export type StopMismatchReason =
  Extract<UnmappedStopReason, 'not_on_new_book' | 'not_in_source' | 'retired'> | 'missing_stop';

/** A stop of the old book without its match on the new book. */
export interface StopMismatch {
  stop: TeardownStop;
  reason: StopMismatchReason;
  message: string;
  /** The new book's securities that should carry the stop */
  securityIds: string[];
}

/** The two books' stops compared (step 5 of the switch). */
export interface StopReconciliation {
  /** Every open stop of the old book has its match on the new one */
  reconciled: boolean;
  /** The stops matched, with the new book's securities that carry each */
  matched: PlacedStop[];
  mismatches: StopMismatch[];
}

/**
 * What `planPurge` plans:
 *
 * - `ready`: the purges, then `CapTable_Close`
 * - `unreadable`: the purges only: the book holds contracts the SDK cannot read, which no purge names, and a closed
 *   book can no longer be purged; read them with an SDK that can before closing it
 * - `closed`: the book is closed already; nothing can be purged
 */
export type PurgePlanStatus = 'ready' | 'unreadable' | 'closed';

/** One `CapTable_Purge`. */
export interface PurgeBatch {
  /** 1 to 500 contracts of the book */
  targets: PurgeTarget[];
  /** The JSON size of the contracts it archives and of its argument, as the SDK estimates it */
  bytes: number;
}

/** The optional purge of a torn-down book, as `system_operator`. */
export interface PurgePlan {
  capTableId: string;
  status: PurgePlanStatus;
  /** The tearing-down (or closed) anchor the commands exercise */
  capTableContractId: string;
  /** The commands' controller */
  systemOperator: string;
  batches: PurgeBatch[];
  /** One `CapTable_Purge` per batch, then `CapTable_Close` when the plan is `ready`; submit them in order */
  commands: CapTableCommand[];
  /** Contracts signed by the book's parties that the SDK could not read, so no purge names them */
  unreadable: string[];
}
