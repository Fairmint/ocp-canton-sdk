/**
 * Replication into an OpenCapTable-v35 book (design, "One mode and teardown"): `planReplication` plans the steps that
 * bring a book to its source records, `executeReplication` writes them through the book's register writer.
 */

export { executeReplication } from './execute';
export { planReplication, type PlanReplicationInput } from './plan';
export type {
  ExecuteReplicationOptions,
  ExecutedReplicationStep,
  PlanReplicationOptions,
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
  ReplicationRestateStep,
  ReplicationResult,
  ReplicationSource,
  ReplicationSplitStep,
  ReplicationStep,
  ReplicationStepKind,
} from './types';
