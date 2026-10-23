/**
 * Compile-time smoke tests for the replication subpath declarations.
 *
 * Validates that every symbol exported from `@open-captable-protocol/canton/replication`
 * (built: `../../dist/replication`) is importable and has the expected shape.
 * Types that would appear in consumer code are explicitly verified; implementation
 * details intentionally stay off this surface.
 */

import {
  buildCantonOcfDataMap,
  buildOcfManifest,
  checkTeardownReady,
  computeReplicationDiff,
  countManifestObjects,
  createOcfMismatchError,
  DEFAULT_DEPRECATED_FIELDS,
  DEFAULT_INTERNAL_FIELDS,
  diffOcfObjects,
  ENTITY_OBJECT_TYPE_MAP,
  executeReplication,
  extractCantonOcfManifest,
  getEntityTypeLabel,
  getOcfSchema,
  getOcfTypeLabel,
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
  planPurge,
  planReplication,
  planStopReplacement,
  readTeardownBook,
  reconcileStops,
  SCHEMA_DEFAULT_EQUIVALENCE_RULES,
  sortTransactions,
  stopPlacementWrite,
  stripInternalFields,
  TRANSACTION_SUBTYPE_MAP,
  type BuildOcfManifestOptions,
  type CantonOcfDataMap,
  type CantonRecordIndex,
  type ComputeReplicationDiffOptions,
  type ExecuteReplicationOptions,
  type ExtractCantonOcfOptions,
  type OcfComparisonOptions,
  type OcfComparisonResult,
  type OcfManifest,
  type OcfMismatchError,
  type PlanReplicationOptions,
  type PurgePlan,
  type ReplicationDiff,
  type ReplicationError,
  type ReplicationItem,
  type ReplicationPlan,
  type ReplicationRefusal,
  type ReplicationResult,
  type ReplicationStep,
  type SchemaDefaultEquivalencePathMatcher,
  type SchemaDefaultEquivalenceRule,
  type SecurityIdConflict,
  type SourceReplicationItem,
  type StopPlacement,
  type StopReconciliation,
  type StopReplacementPlan,
  type TeardownReadiness,
  type UnmappedStopReason,
} from '../../dist/replication';

// Root barrel types used in replication consumer signatures — imported from root, not from this subpath.
import type { BookWrite, LedgerJsonApiClient, OcfEntityType, register } from '../../dist';

type Assert<T extends true> = T;
type IsAssignableTo<A, B> = A extends B ? true : false;

// ── Runtime values are callable/accessible ──────────────────────────────────

void buildCantonOcfDataMap;
void computeReplicationDiff;
void countManifestObjects;
void createOcfMismatchError;
void DEFAULT_DEPRECATED_FIELDS;
void DEFAULT_INTERNAL_FIELDS;
void diffOcfObjects;
void ENTITY_OBJECT_TYPE_MAP;
void extractCantonOcfManifest;
void getEntityTypeLabel;
void getOcfSchema;
void getOcfTypeLabel;
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
void sortTransactions;
void stripInternalFields;
void TRANSACTION_SUBTYPE_MAP;
void SCHEMA_DEFAULT_EQUIVALENCE_RULES;

// ── Key type contracts ──────────────────────────────────────────────────────

// CantonOcfDataMap is a Map keyed by entity type
const cantonDataMap: CantonOcfDataMap = new Map<OcfEntityType, Map<string, Record<string, unknown>>>();
void cantonDataMap;

// computeReplicationDiff returns a ReplicationDiff
declare const fakeState: CantonRecordIndex;
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

// extractCantonOcfManifest reads as one party, then builds the manifest
const extractOpts: ExtractCantonOcfOptions = { readAs: 'issuer::1220', capTableId: 'test-1', includeHoldRecords: true };
// @ts-expect-error the party to read as is required
const extractOptsWithoutParty: ExtractCantonOcfOptions = {};
declare const ledger: LedgerJsonApiClient;
const extracted: Promise<OcfManifest> = extractCantonOcfManifest(ledger, extractOpts);
void extractOptsWithoutParty;
void extracted;

// buildOcfManifest builds a manifest from a book's key index, and the index gives the diff's record index
declare const bookIndex: register.RegisterIndex;
const buildOpts: BuildOcfManifestOptions = { includeHoldRecords: false };
const builtManifest: OcfManifest = buildOcfManifest(bookIndex, buildOpts);
const indexRecords: CantonRecordIndex = bookIndex.toRecordIndex();
void builtManifest;
void indexRecords;

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

// CantonRecordIndex is the minimal book view that diffing and extraction consume
const recordIndex: CantonRecordIndex = {
  entities: new Map<OcfEntityType, Set<string>>(),
  contractIds: new Map<OcfEntityType, Map<string, string>>(),
  securityIds: new Set<string>(),
};
void recordIndex;

// SourceReplicationItem is constructable
const sourceItem: SourceReplicationItem = { entityType: 'stakeholder', data: { id: 'sh-1' } };
void sourceItem;

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

// planReplication plans from a source and a book's key index; executeReplication writes the plan through its writer
declare const writer: register.RegisterWriter;
const planOptions: PlanReplicationOptions = { ledger, readAs: 'transfer-agent::1220', hashesPerShard: 32 };
const planned: Promise<ReplicationPlan> = planReplication({ source: manifest, index: bookIndex, options: planOptions });
const fromItems: Promise<ReplicationPlan> = planReplication({ source: [sourceItem], index: bookIndex });
declare const plan: ReplicationPlan;
const status: 'current' | 'ready' | 'blocked' | 'refused' = plan.status;
const steps: ReplicationStep[] = plan.steps;
const refusals: ReplicationRefusal[] = plan.refusals;
const executeOptions: ExecuteReplicationOptions = { maxReplans: 2, onProgress: ({ plan: n, step }) => void [n, step] };
const executed: Promise<ReplicationResult> = executeReplication(writer, plan, executeOptions);
declare const replicationError: ReplicationError;
const committedBefore: number | undefined = replicationError.replication?.transactions;
void planned;
void fromItems;
void status;
void steps;
void refusals;
void executed;
void committedBefore;

// The switch to a rebuilt book: readiness, stops carried over and reconciled, and the old book's purge
declare const oldBook: register.RegisterIndex;
declare const newBook: register.RegisterIndex;
const readiness: TeardownReadiness = checkTeardownReady({ oldIndex: oldBook, newIndex: newBook, drainOffset: 42 });
const readyToTearDown: boolean = readiness.ready;
const issueCondition: string | undefined = readiness.issues[0]?.condition;
const stopPlan: StopReplacementPlan = planStopReplacement({ oldIndexAtTeardown: oldBook, newIndex: newBook });
const firstPlacement: StopPlacement | undefined = stopPlan.placements[0];
const unmappedReason: UnmappedStopReason | undefined = stopPlan.unmapped[0]?.reason;
if (firstPlacement !== undefined) {
  const placeHolds: BookWrite = stopPlacementWrite(firstPlacement, '2026-10-23');
  void placeHolds;
}
const reconciliation: StopReconciliation = reconcileStops(oldBook, newBook);
const purge: PurgePlan = planPurge(oldBook, { byteBudget: 4_000_000 });
const purgeTargets: number = purge.batches.reduce((total, batch) => total + batch.targets.length, 0);
const readBook: Promise<register.RegisterIndex> = readTeardownBook(ledger, {
  capTableId: 'test-2',
  readAs: 'issuer::1220',
});
void readyToTearDown;
void issueCondition;
void unmappedReason;
void reconciliation.reconciled;
void purgeTargets;
void readBook;
