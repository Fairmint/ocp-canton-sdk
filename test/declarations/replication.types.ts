/**
 * Compile-time smoke tests for the replication subpath declarations.
 *
 * Validates that every symbol exported from `@open-captable-protocol/canton/replication`
 * (built: `../../dist/replication`) is importable and has the expected shape.
 * Types that would appear in consumer code are explicitly verified; implementation
 * details intentionally stay off this surface.
 */

import {
  archiveCapTable,
  buildCantonOcfDataMap,
  classifyIssuerCapTables,
  computeReplicationDiff,
  countManifestObjects,
  createFactory,
  createOcfMismatchError,
  DEFAULT_DEPRECATED_FIELDS,
  DEFAULT_INTERNAL_FIELDS,
  diffOcfObjects,
  ENTITY_OBJECT_TYPE_MAP,
  extractCantonOcfManifest,
  FIELD_TO_ENTITY_TYPE,
  getCapTableState,
  getEntityTypeLabel,
  getOcfSchema,
  getOcfTypeLabel,
  getSystemOperatorPartyId,
  isOcfMismatchError,
  mapCategorizedTypeToEntityType,
  matchesTemplateIdentity,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  ocfCompare,
  ocfDeepEqual,
  parseOcfEntityInput,
  parseOcfObject,
  SECURITY_ID_FIELD_TO_ENTITY_TYPE,
  sortTransactions,
  stripInternalFields,
  TRANSACTION_SUBTYPE_MAP,
  type CantonOcfDataMap,
  type ComputeReplicationDiffOptions,
  type CreateFactoryParams,
  type CreateFactoryResult,
  type ExtractCantonOcfOptions,
  type OcfComparisonOptions,
  type OcfComparisonResult,
  type OcfManifest,
  type OcfMismatchError,
  type ReplicationDiff,
  type ReplicationItem,
  type SecurityIdConflict,
  type SourceReplicationItem,
} from '../../dist/replication';

// Root barrel types used in replication consumer signatures — imported from root, not from this subpath.
import type { CapTableState, OcfEntityType } from '../../dist';

type Assert<T extends true> = T;
type IsAssignableTo<A, B> = A extends B ? true : false;

// ── Runtime values are callable/accessible ──────────────────────────────────

void archiveCapTable;
void buildCantonOcfDataMap;
void classifyIssuerCapTables;
void computeReplicationDiff;
void countManifestObjects;
void createFactory;
void createOcfMismatchError;
void DEFAULT_DEPRECATED_FIELDS;
void DEFAULT_INTERNAL_FIELDS;
void diffOcfObjects;
void ENTITY_OBJECT_TYPE_MAP;
void extractCantonOcfManifest;
void FIELD_TO_ENTITY_TYPE;
void getCapTableState;
void getEntityTypeLabel;
void getOcfSchema;
void getOcfTypeLabel;
void getSystemOperatorPartyId;
void isOcfMismatchError;
void mapCategorizedTypeToEntityType;
void matchesTemplateIdentity;
void normalizeEntityType;
void normalizeObjectType;
void normalizeOcfData;
void ocfCompare;
void ocfDeepEqual;
void parseOcfEntityInput;
void parseOcfObject;
void SECURITY_ID_FIELD_TO_ENTITY_TYPE;
void sortTransactions;
void stripInternalFields;
void TRANSACTION_SUBTYPE_MAP;

// ── Key type contracts ──────────────────────────────────────────────────────

// CantonOcfDataMap is a Map keyed by entity type
const cantonDataMap: CantonOcfDataMap = new Map<OcfEntityType, Map<string, Record<string, unknown>>>();
void cantonDataMap;

// computeReplicationDiff returns a ReplicationDiff
declare const fakeState: CapTableState;
const diff: ReplicationDiff = computeReplicationDiff([], fakeState);
const creates: ReplicationItem[] = diff.creates;
const edits: ReplicationItem[] = diff.edits;
const deletes: ReplicationItem[] = diff.deletes;
const conflicts: SecurityIdConflict[] = diff.conflicts;
const total: number = diff.total;
void creates;
void edits;
void deletes;
void conflicts;
void total;

// computeReplicationDiff accepts ComputeReplicationDiffOptions
const opts: ComputeReplicationDiffOptions = { cantonOcfData: cantonDataMap, reportDifferences: true };
computeReplicationDiff([], fakeState, opts);

// buildCantonOcfDataMap converts a manifest into a CantonOcfDataMap
declare const manifest: OcfManifest;
const ocfDataMap: CantonOcfDataMap = buildCantonOcfDataMap(manifest);
void ocfDataMap;

// extractCantonOcfManifest options are typed
const extractOpts: ExtractCantonOcfOptions = {};
void extractOpts;

// ocfCompare returns OcfComparisonResult
const compareResult: OcfComparisonResult = ocfCompare({}, {});
const isEqual: boolean = compareResult.equal;
const diffs: string[] = compareResult.differences;
void isEqual;
void diffs;

// OcfComparisonOptions accepted by ocfCompare
const cmpOpts: OcfComparisonOptions = {
  ignoredFields: DEFAULT_INTERNAL_FIELDS,
  deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
  reportDifferences: false,
};
ocfCompare({}, {}, cmpOpts);

// createOcfMismatchError returns OcfMismatchError
const mismatch: OcfMismatchError = createOcfMismatchError('msg', [], {}, {});
const ocfDiffs: string[] = mismatch.ocfDiffs;
void ocfDiffs;

// isOcfMismatchError narrows type
declare const unknownErr: unknown;
if (isOcfMismatchError(unknownErr)) {
  const narrowed: OcfMismatchError = unknownErr;
  void narrowed;
}

// mapCategorizedTypeToEntityType returns OcfEntityType or null
const entityType: OcfEntityType | null = mapCategorizedTypeToEntityType('STAKEHOLDER', null);
void entityType;

// getEntityTypeLabel returns a string
const label: string = getEntityTypeLabel('stakeholder', 1);
void label;

// normalizeObjectType narrows the type
const normalizedObj = normalizeObjectType('TX_PLAN_SECURITY_ISSUANCE' as string);
void normalizedObj;

// normalizeEntityType narrows the type
const normalizedEntity = normalizeEntityType('planSecurityIssuance' as string);
void normalizedEntity;

// normalizeOcfData returns a record
const normalizedData: Record<string, unknown> = normalizeOcfData({ object_type: 'STAKEHOLDER' });
void normalizedData;

// FIELD_TO_ENTITY_TYPE and SECURITY_ID_FIELD_TO_ENTITY_TYPE are string-keyed entity maps
const fieldEntity: OcfEntityType = FIELD_TO_ENTITY_TYPE['issuer_ids'];
void fieldEntity;

// SourceReplicationItem is constructable
const sourceItem: SourceReplicationItem = { entityType: 'stakeholder', data: { id: 'sh-1' } };
void sourceItem;

// CreateFactoryParams and CreateFactoryResult are opaque but importable
declare const factoryParams: CreateFactoryParams;
void factoryParams;
declare const factoryResult: CreateFactoryResult;
void factoryResult;

// Type-level check: constants satisfy broad assignability
const _defaultInternalFields: IsAssignableTo<typeof DEFAULT_INTERNAL_FIELDS, readonly string[]> = true;
const _defaultDeprecatedFields: IsAssignableTo<typeof DEFAULT_DEPRECATED_FIELDS, readonly string[]> = true;
void _defaultInternalFields;
void _defaultDeprecatedFields;

// Ensure OcfManifest has expected shape (issuer is an array)
declare const ocfManifest: OcfManifest;
const _issuerCount: number = countManifestObjects(ocfManifest);
void _issuerCount;

// Assert<true> usage to keep unused-import linter happy for type-only verifications
type _Assert = Assert<true>;
void (undefined as unknown as _Assert);
