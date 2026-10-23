/**
 * Replication into an OpenCapTable-v35 book (design, "One mode and teardown"): `planReplication` plans the steps that
 * bring a book to its source records, `executeReplication` writes them through the book's register writer; and the
 * switch to a rebuilt book: `checkTeardownReady` before the old book's teardown, `planStopReplacement` and
 * `reconcileStops` after it, `planPurge` for the old book's purge.
 */

export { executeReplication } from './execute';
export { planReplication, type PlanReplicationInput } from './plan';
export {
  checkTeardownReady,
  planPurge,
  planStopReplacement,
  readTeardownBook,
  reconcileStops,
  stopPlacementWrite,
  type CheckTeardownReadyInput,
  type PlanPurgeOptions,
  type PlanStopReplacementInput,
  type ReadTeardownBookOptions,
  type ReconcileStopsOptions,
} from './teardown';
export type {
  ExecuteReplicationOptions,
  ExecutedReplicationStep,
  PlacedStop,
  PlanReplicationOptions,
  PurgeBatch,
  PurgePlan,
  PurgePlanStatus,
  ReplicationApplyStep,
  ReplicationError,
  ReplicationNotice,
  ReplicationNoticeKind,
  ReplicationPlan,
  ReplicationPlanStatus,
  ReplicationPreSplitStep,
  ReplicationProgress,
  ReplicationRefusal,
  ReplicationRefusalRule,
  ReplicationRestateBasis,
  ReplicationRestateStep,
  ReplicationResult,
  ReplicationSource,
  ReplicationSplitStep,
  ReplicationStep,
  ReplicationStepKind,
  StopMismatch,
  StopMismatchReason,
  StopPlacement,
  StopReconciliation,
  StopReplacementPlan,
  TeardownCondition,
  TeardownIssue,
  TeardownReadiness,
  TeardownRecordDifference,
  TeardownStop,
  UnmappedStop,
  UnmappedStopReason,
} from './types';
