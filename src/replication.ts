/**
 * Replication subpath — sanctioned public surface for OCF replication, verification,
 * extraction, and comparison helpers.
 *
 * Import this subpath when building cap-table replication or verification tooling:
 *
 * ```typescript
 * import {
 *   buildOcfManifest,
 *   extractCantonOcfManifest,
 *   computeReplicationDiff,
 *   ocfCompare,
 *   planReplication,
 *   executeReplication,
 * } from '@open-captable-protocol/canton/replication';
 * ```
 *
 * `planReplication` plans the steps that bring a book to its source records (`CapTable_Apply` for what the book
 * lacks, the split procedure for each historical split, `CapTable_Restate` for corrections), and `executeReplication`
 * writes them through the book's `RegisterWriter`.
 *
 * A book the restatement limits refuse to correct, or that changes its TA, is rebuilt as a new cap table and the old
 * one torn down: `checkTeardownReady` before `CapTable_BeginTeardown`, then `planStopReplacement` and `reconcileStops`
 * to carry the old book's stops over, and `planPurge` for the optional purge and close (`readTeardownBook` reads either
 * book as its issuer or `system_operator` on a change of TA).
 *
 * The register reader and its key index (`readRegister`, `RegisterIndex`) are on the root's `register` namespace;
 * `buildOcfManifest` turns a key index into a manifest, and `RegisterIndex.toRecordIndex()` gives the
 * `CantonRecordIndex` that `computeReplicationDiff` takes.
 *
 * Symbols that are part of the core SDK surface (OcpClient, entity
 * types, environment, errors, etc.) remain on the root import
 * `@open-captable-protocol/canton` and are NOT re-exported from this subpath.
 * Consumers that need both should import each symbol from its canonical home.
 */

// ── Registry constants (DAML-registry-derived, consumer-visible) ───────────

export { ENTITY_OBJECT_TYPE_MAP } from './functions/OpenCapTable/capTable/batchTypes';

// ── Record index ────────────────────────────────────────────────────────────

export type { CantonRecordIndex } from './functions/OpenCapTable/capTable/types';

// ── Replication diff ────────────────────────────────────────────────────────

export {
  TRANSACTION_SUBTYPE_MAP,
  buildCantonOcfDataMap,
  computeReplicationDiff,
  getEntityTypeLabel,
  mapCategorizedTypeToEntityType,
  type CantonOcfDataMap,
  type ComputeReplicationDiffOptions,
  type ReplicationDiff,
  type ReplicationItem,
  type SecurityIdConflict,
  type SourceReplicationItem,
} from './utils/replicationHelpers';

// ── Replication into a book ────────────────────────────────────────────────

export {
  executeReplication,
  planReplication,
  type ExecuteReplicationOptions,
  type ExecutedReplicationStep,
  type PlanReplicationInput,
  type PlanReplicationOptions,
  type ReplicationApplyStep,
  type ReplicationError,
  type ReplicationNotice,
  type ReplicationNoticeKind,
  type ReplicationPlan,
  type ReplicationPlanStatus,
  type ReplicationPreSplitStep,
  type ReplicationProgress,
  type ReplicationRefusal,
  type ReplicationRefusalRule,
  type ReplicationRestateBasis,
  type ReplicationRestateStep,
  type ReplicationResult,
  type ReplicationSource,
  type ReplicationSplitStep,
  type ReplicationStep,
  type ReplicationStepKind,
} from './register/replication';

// ── The switch to a rebuilt book, and the old book's purge ─────────────────

export {
  checkTeardownReady,
  planPurge,
  planStopReplacement,
  readTeardownBook,
  reconcileStops,
  stopPlacementWrite,
  type CheckTeardownReadyInput,
  type PlacedStop,
  type PlanPurgeOptions,
  type PlanStopReplacementInput,
  type PurgeBatch,
  type PurgePlan,
  type PurgePlanStatus,
  type ReadTeardownBookOptions,
  type ReconcileStopsOptions,
  type StopMismatch,
  type StopMismatchReason,
  type StopPlacement,
  type StopReconciliation,
  type StopReplacementPlan,
  type TeardownCondition,
  type TeardownIssue,
  type TeardownReadiness,
  type TeardownRecordDifference,
  type TeardownStop,
  type UnmappedStop,
  type UnmappedStopReason,
} from './register/replication';

// ── OCF manifest extraction ─────────────────────────────────────────────────

export {
  buildOcfManifest,
  countManifestObjects,
  extractCantonOcfManifest,
  sortTransactions,
  type BuildOcfManifestOptions,
  type ExtractCantonOcfOptions,
  type OcfManifest,
} from './utils/cantonOcfExtractor';

// ── OCF comparison and diff ─────────────────────────────────────────────────

export {
  DEFAULT_DEPRECATED_FIELDS,
  DEFAULT_INTERNAL_FIELDS,
  SCHEMA_DEFAULT_EQUIVALENCE_RULES,
  createOcfMismatchError,
  diffOcfObjects,
  isOcfMismatchError,
  isSchemaDefaultEquivalent,
  isSchemaDefaultEquivalentWithContext,
  ocfCompare,
  ocfDeepEqual,
  stripInternalFields,
  type OcfComparisonOptions,
  type OcfComparisonResult,
  type OcfMismatchError,
  type SchemaDefaultEquivalencePathMatcher,
  type SchemaDefaultEquivalenceRule,
} from './utils/ocfComparison';

// ── Type/object-type normalisation ──────────────────────────────────────────

export { normalizeEntityType, normalizeObjectType, normalizeOcfData } from './utils/planSecurityAliases';

// ── OCF schema parsing ──────────────────────────────────────────────────────

export { getOcfSchema, parseOcfEntityInput, parseOcfObject } from './utils/ocfZodSchemas';

// ── Human-readable labels ───────────────────────────────────────────────────

export { getOcfTypeLabel } from './utils/ocfHelpers';

// ── Template identity helpers ───────────────────────────────────────────────

export { matchesTemplateIdentity } from './utils/templateIdentity';
