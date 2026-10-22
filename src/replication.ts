/**
 * Replication subpath — sanctioned public surface for OCF replication, verification,
 * extraction, and comparison helpers.
 *
 * Import this subpath when building cap-table replication or verification tooling:
 *
 * ```typescript
 * import {
 *   extractCantonOcfManifest,
 *   computeReplicationDiff,
 *   ocfCompare,
 * } from '@open-captable-protocol/canton/replication';
 * ```
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

// ── OCF manifest extraction ─────────────────────────────────────────────────

export {
  countManifestObjects,
  extractCantonOcfManifest,
  sortTransactions,
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
