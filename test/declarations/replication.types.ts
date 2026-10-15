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
  findPositionManagedWrites,
  getCapTableState,
  getEntityTypeLabel,
  getOcfSchema,
  getOcfTypeLabel,
  getSystemOperatorPartyId,
  isOcfMismatchError,
  isSchemaDefaultEquivalent,
  isSchemaDefaultEquivalentWithContext,
  mapCategorizedTypeToEntityType,
  matchesTemplateIdentity,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  ocfCompare,
  ocfDeepEqual,
  parseOcfEntityInput,
  parseOcfObject,
  readCapTablePositionFields,
  SCHEMA_DEFAULT_EQUIVALENCE_RULES,
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
  type OcfManifestPositions,
  type OcfMismatchError,
  type PositionGuardBatchItem,
  type PositionGuardTarget,
  type ReplicationDiff,
  type ReplicationItem,
  type SchemaDefaultEquivalencePathMatcher,
  type SchemaDefaultEquivalenceRule,
  type SecurityIdConflict,
  type SkippedReplicationItem,
  type SourceReplicationItem,
} from '../../dist/replication';

// Root barrel types used in replication consumer signatures — imported from root, not from this subpath.
import type {
  CapTablePositionFields,
  CapTablePositionState,
  CapTableState,
  ConflictingPositionRecord,
  OcfEntityType,
  PositionWriteRefusal,
  PositionWriteViolation,
} from '../../dist';

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
void isSchemaDefaultEquivalent;
void isSchemaDefaultEquivalentWithContext;
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
void SCHEMA_DEFAULT_EQUIVALENCE_RULES;

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
const fieldEntity: OcfEntityType | undefined = FIELD_TO_ENTITY_TYPE['issuer_ids'];
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

// Schema-default equivalence rules are importable and deeply readonly
const firstRule: SchemaDefaultEquivalenceRule | undefined = SCHEMA_DEFAULT_EQUIVALENCE_RULES[0];
if (firstRule) {
  const matcher: SchemaDefaultEquivalencePathMatcher = firstRule.match;
  void matcher;
  void firstRule.isEquivalent({}, {});
}
declare const injectedRule: SchemaDefaultEquivalenceRule;
const _rulesReadonly: IsAssignableTo<typeof SCHEMA_DEFAULT_EQUIVALENCE_RULES, readonly SchemaDefaultEquivalenceRule[]> =
  true;
void _rulesReadonly;
void injectedRule;

// Ensure OcfManifest has expected shape (issuer is an array)
declare const ocfManifest: OcfManifest;
const _issuerCount: number = countManifestObjects(ocfManifest);
void _issuerCount;

// Assert<true> usage to keep unused-import linter happy for type-only verifications
type _Assert = Assert<true>;
void (undefined as unknown as _Assert);

// ── Position register ───────────────────────────────────────────────────────

// The position guard reports withheld operations with their reasons.
const skipped: SkippedReplicationItem[] | undefined = diff.skipped;
const firstReasons: PositionWriteViolation[] | undefined = skipped?.[0]?.reasons;
void firstReasons;

// getCapTableState says whether the cap table has positions: a position state, or null when it has none.
const positionState: CapTablePositionState | null = fakeState.positionState;
// Registry-written records that reuse an OCF ID are reported, not thrown, by the readers.
const conflictingRecords: readonly ConflictingPositionRecord[] | undefined = positionState?.conflictingRecords;
void conflictingRecords;
const unmarkedPositionState: IsAssignableTo<CapTableState, { positionState?: undefined }> = false;
void unmarkedPositionState;
// For a cap table with positions, computeReplicationDiff needs the stakeholders of its open trades.
computeReplicationDiff([], fakeState, positionState ? { protectedStakeholderIds: ['stakeholder-1'] } : {});
computeReplicationDiff([], fakeState, { protectedStakeholderIds: new Set<string>() });
const protectedReason: PositionWriteViolation['reason'] = 'protected_stakeholder';
void protectedReason;

// readCapTablePositionFields reads a CapTable payload.
const positionFields: CapTablePositionFields = readCapTablePositionFields({});
void positionFields;

// findPositionManagedWrites checks batch items against a CapTable.
declare const guardClient: Parameters<typeof findPositionManagedWrites>[0];
const guardItems: PositionGuardBatchItem[] = [{ operation: 'delete', entityType: 'stockClass', id: 'class-1' }];
const guardTarget: PositionGuardTarget = { capTableContractId: 'cap-table-1', capTableState: fakeState };
const pendingRefusals: Promise<PositionWriteRefusal[]> = findPositionManagedWrites(
  guardClient,
  guardItems,
  guardTarget
);
void pendingRefusals;

// The manifest names position-managed history when the cap table has positions.
const manifestPositions: OcfManifestPositions | undefined = manifest.positions;
void manifestPositions;
// …including the ledger records it leaves out.
const leftOutIds: string[] | undefined = manifestPositions?.unattributedRecords.map((record) => record.id);
void leftOutIds;
