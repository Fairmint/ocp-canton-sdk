/**
 * The replication subpath's types: what `planReplication` plans from a book's source records and its key index, and
 * what `executeReplication` reports as it writes the plan through the register writer.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { OcfStockClassSplit } from '../../types/native';
import type {
  ApplyOperation,
  ApplyPreSplitShardOperation,
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
 * - `too_large`: the restatement exceeds a per-transaction cap
 * - `ledger`: the ledger's ID or reference rules would refuse a step (the ledger's message)
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
  | 'ledger';

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
 * - `edit_unchanged`: the source differs from the book only where the ledger stores nothing: no edit is written
 * - `state_drift`: a state no correction touches differs from the replay of the corrected book, and is restated
 */
export type ReplicationNoticeKind =
  | 'hold_pair'
  | 'derived_form_skipped'
  | 'derived_form_differs'
  | 'derived_form_missing'
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
  /** The records to create, edit and delete (derived-form records and the hold pair left out) */
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
