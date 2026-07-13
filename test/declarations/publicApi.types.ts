/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  convertToDaml,
  getOcfObjectTypeCapability,
  mapOcfObjectTypeToEntityType,
  validateOcfCapTableSnapshot,
  type CapTableBatch,
  type CapTableBatchOperations,
  type OcfCapTableSnapshotIssue,
  type OcfCapTableSnapshotIssueCode,
  type OcfCapTableSnapshotObject,
  type OcfCapTableSnapshotValidationResult,
  type OcfCreateOperation,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfEntityTypeForObjectType,
  type OcfFinancing,
  type OcfIssuer,
  type OcfObject,
  type OcfObjectTypeCapability,
  type OcfReadableObjectType,
  type OcfSecurityFamily,
  type OcfStakeholder,
  type OcfStockAcceptance,
  type OcfStockClass,
  type OcfVestingEvent,
  type OcfVestingStart,
  type OcfWarrantAcceptance,
} from '../../dist';
import { isOcfEntityType as isOcfEntityTypeFromUtils } from '../../dist/utils';
import {
  getOcfObjectTypeCapability as getSourceOcfObjectTypeCapability,
  mapOcfObjectTypeToEntityType as mapSourceOcfObjectTypeToEntityType,
  validateOcfCapTableSnapshot as validateSourceOcfCapTableSnapshot,
  type OcfCapTableSnapshotObject as SourceOcfCapTableSnapshotObject,
  type OcfEntityTypeForObjectType as SourceOcfEntityTypeForObjectType,
  type OcfObjectTypeCapability as SourceOcfObjectTypeCapability,
  type OcfReadableObjectType as SourceOcfReadableObjectType,
} from '../../src';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IntendedCanonicalOcfObject = OcfEntityDataMap[OcfEntityType] | OcfFinancing;
type SchemaSupportedPlanSecurityObjectType =
  | 'TX_PLAN_SECURITY_ACCEPTANCE'
  | 'TX_PLAN_SECURITY_CANCELLATION'
  | 'TX_PLAN_SECURITY_EXERCISE'
  | 'TX_PLAN_SECURITY_ISSUANCE'
  | 'TX_PLAN_SECURITY_RELEASE'
  | 'TX_PLAN_SECURITY_RETRACTION'
  | 'TX_PLAN_SECURITY_TRANSFER';

const publishedOcfObjectIsExact: Assert<IsExactly<OcfObject, IntendedCanonicalOcfObject>> = true;
const publishedOcfObjectExcludesPlanSecurityWrappers: Assert<
  IsExactly<Extract<OcfObject, { readonly object_type: SchemaSupportedPlanSecurityObjectType }>, never>
> = true;

void publishedOcfObjectIsExact;
void publishedOcfObjectExcludesPlanSecurityWrappers;

const typedIssuerSnapshotObject: OcfCapTableSnapshotObject = {
  object_type: 'ISSUER',
  id: 'issuer-typed',
  legal_name: 'Typed Issuer, Inc.',
  formation_date: '2025-01-01',
  country_of_formation: 'US',
};
const snapshot: readonly OcfCapTableSnapshotObject[] = [typedIssuerSnapshotObject];
const snapshotResult: OcfCapTableSnapshotValidationResult = validateOcfCapTableSnapshot(snapshot);
const sourceSnapshotResult: OcfCapTableSnapshotValidationResult = validateSourceOcfCapTableSnapshot(snapshot);
const snapshotSourceAndDistMatch: Assert<IsExactly<OcfCapTableSnapshotObject, SourceOcfCapTableSnapshotObject>> = true;
// @ts-expect-error snapshot inputs require the complete canonical OCF discriminator member
const incompleteSnapshotObject: OcfCapTableSnapshotObject = { object_type: 'ISSUER', id: 'issuer-incomplete' };
const planSecuritySnapshotObject: OcfCapTableSnapshotObject = {
  // @ts-expect-error runtime compatibility wrappers must be normalized before typed snapshot validation
  object_type: 'TX_PLAN_SECURITY_ISSUANCE',
  id: 'plan-security-1',
};
const financingCapability = getOcfObjectTypeCapability('FINANCING');
const planSecurityCapability = getOcfObjectTypeCapability('TX_PLAN_SECURITY_ISSUANCE');
const unsupportedCapability = getOcfObjectTypeCapability('TX_NOT_REAL');
const sourceUnsupportedCapability = getSourceOcfObjectTypeCapability('TX_NOT_REAL');
const longUnsupportedCapability = getOcfObjectTypeCapability(
  'TX_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
);
const sourceLongUnsupportedCapability = getSourceOcfObjectTypeCapability(
  'TX_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
);
declare const templateObjectType: `TX_${string}`;
declare const unrelatedTemplateObjectType: `UNRELATED_${string}`;
declare const broadObjectType: string;
declare const objectTypeBrand: unique symbol;
type ObjectTypeBrand = { readonly [objectTypeBrand]: true };
type BrandedObjectType = string & ObjectTypeBrand;
type BrandedReadableObjectType = OcfReadableObjectType & SourceOcfReadableObjectType & ObjectTypeBrand;
type BrandedIssuerObjectType = 'ISSUER' & BrandedObjectType;
type BrandedPlanSecurityObjectType = 'TX_PLAN_SECURITY_ISSUANCE' & BrandedObjectType;
declare const brandedObjectType: BrandedObjectType;
declare const brandedIssuerObjectType: BrandedIssuerObjectType;
declare const brandedPlanSecurityObjectType: BrandedPlanSecurityObjectType;
declare const opaqueSuffixTemplateObjectType: `TX_STOCK_${BrandedObjectType}`;
declare const opaquePrefixTemplateObjectType: `${BrandedObjectType}ISSUER`;
declare const opaqueMiddleTemplateObjectType: `TX_STOCK_${BrandedObjectType}ANCE`;
declare const opaqueIntrinsicObjectType: Uppercase<BrandedObjectType>;
declare const unrelatedOpaqueTemplateObjectType: `UNRELATED_${BrandedObjectType}`;
const templateCapability = getOcfObjectTypeCapability(templateObjectType);
const sourceTemplateCapability = getSourceOcfObjectTypeCapability(templateObjectType);
const unrelatedTemplateCapability = getOcfObjectTypeCapability(unrelatedTemplateObjectType);
const sourceUnrelatedTemplateCapability = getSourceOcfObjectTypeCapability(unrelatedTemplateObjectType);
const broadCapability = getOcfObjectTypeCapability(broadObjectType);
const sourceBroadCapability = getSourceOcfObjectTypeCapability(broadObjectType);
const brandedCapability = getOcfObjectTypeCapability(brandedObjectType);
const sourceBrandedCapability = getSourceOcfObjectTypeCapability(brandedObjectType);
const brandedIssuerCapability = getOcfObjectTypeCapability(brandedIssuerObjectType);
const sourceBrandedIssuerCapability = getSourceOcfObjectTypeCapability(brandedIssuerObjectType);
const brandedPlanSecurityCapability = getOcfObjectTypeCapability(brandedPlanSecurityObjectType);
const sourceBrandedPlanSecurityCapability = getSourceOcfObjectTypeCapability(brandedPlanSecurityObjectType);
const opaqueSuffixTemplateCapability = getOcfObjectTypeCapability(opaqueSuffixTemplateObjectType);
const sourceOpaqueSuffixTemplateCapability = getSourceOcfObjectTypeCapability(opaqueSuffixTemplateObjectType);
const opaquePrefixTemplateCapability = getOcfObjectTypeCapability(opaquePrefixTemplateObjectType);
const sourceOpaquePrefixTemplateCapability = getSourceOcfObjectTypeCapability(opaquePrefixTemplateObjectType);
const opaqueMiddleTemplateCapability = getOcfObjectTypeCapability(opaqueMiddleTemplateObjectType);
const sourceOpaqueMiddleTemplateCapability = getSourceOcfObjectTypeCapability(opaqueMiddleTemplateObjectType);
const opaqueIntrinsicCapability = getOcfObjectTypeCapability(opaqueIntrinsicObjectType);
const sourceOpaqueIntrinsicCapability = getSourceOcfObjectTypeCapability(opaqueIntrinsicObjectType);
const unrelatedOpaqueTemplateCapability = getOcfObjectTypeCapability(unrelatedOpaqueTemplateObjectType);
const sourceUnrelatedOpaqueTemplateCapability = getSourceOcfObjectTypeCapability(unrelatedOpaqueTemplateObjectType);
const templateCapabilityIsUnion: Assert<IsExactly<typeof templateCapability, OcfObjectTypeCapability>> = true;
const sourceTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof sourceTemplateCapability, SourceOcfObjectTypeCapability>
> = true;
const broadCapabilityIsUnion: Assert<IsExactly<typeof broadCapability, OcfObjectTypeCapability>> = true;
const sourceBroadCapabilityIsUnion: Assert<IsExactly<typeof sourceBroadCapability, SourceOcfObjectTypeCapability>> =
  true;
const brandedCapabilityIsUnion: Assert<IsExactly<typeof brandedCapability, OcfObjectTypeCapability>> = true;
const sourceBrandedCapabilityIsUnion: Assert<IsExactly<typeof sourceBrandedCapability, SourceOcfObjectTypeCapability>> =
  true;
const opaqueSuffixTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof opaqueSuffixTemplateCapability, OcfObjectTypeCapability>
> = true;
const sourceOpaqueSuffixTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof sourceOpaqueSuffixTemplateCapability, SourceOcfObjectTypeCapability>
> = true;
const opaquePrefixTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof opaquePrefixTemplateCapability, OcfObjectTypeCapability>
> = true;
const sourceOpaquePrefixTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof sourceOpaquePrefixTemplateCapability, SourceOcfObjectTypeCapability>
> = true;
const opaqueMiddleTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof opaqueMiddleTemplateCapability, OcfObjectTypeCapability>
> = true;
const sourceOpaqueMiddleTemplateCapabilityIsUnion: Assert<
  IsExactly<typeof sourceOpaqueMiddleTemplateCapability, SourceOcfObjectTypeCapability>
> = true;
const opaqueIntrinsicCapabilityIsUnion: Assert<IsExactly<typeof opaqueIntrinsicCapability, OcfObjectTypeCapability>> =
  true;
const sourceOpaqueIntrinsicCapabilityIsUnion: Assert<
  IsExactly<typeof sourceOpaqueIntrinsicCapability, SourceOcfObjectTypeCapability>
> = true;

if (financingCapability.support === 'schema-only') {
  const financingObjectType: 'FINANCING' = financingCapability.objectType;
  void financingObjectType;
}

const canonicalPlanSecurityType: 'TX_EQUITY_COMPENSATION_ISSUANCE' = planSecurityCapability.canonicalObjectType;
const canonicalPlanSecurityEntity: 'equityCompensationIssuance' = planSecurityCapability.entityType;
const brandedIssuerObjectTypeIsPreserved: BrandedIssuerObjectType = brandedIssuerCapability.objectType;
const sourceBrandedIssuerObjectTypeIsPreserved: BrandedIssuerObjectType = sourceBrandedIssuerCapability.objectType;
const brandedIssuerCanonicalType: 'ISSUER' = brandedIssuerCapability.canonicalObjectType;
const sourceBrandedIssuerCanonicalType: 'ISSUER' = sourceBrandedIssuerCapability.canonicalObjectType;
const brandedIssuerEntity: 'issuer' = brandedIssuerCapability.entityType;
const sourceBrandedIssuerEntity: 'issuer' = sourceBrandedIssuerCapability.entityType;
const brandedIssuerMappedEntity: 'issuer' = mapOcfObjectTypeToEntityType(brandedIssuerObjectType);
const sourceBrandedIssuerMappedEntity: 'issuer' = mapSourceOcfObjectTypeToEntityType(brandedIssuerObjectType);
const brandedIssuerEntityAlias: OcfEntityTypeForObjectType<BrandedIssuerObjectType> = 'issuer';
const sourceBrandedIssuerEntityAlias: SourceOcfEntityTypeForObjectType<BrandedIssuerObjectType> = 'issuer';
const readableEntityMapPreservesUnion: Assert<
  IsExactly<OcfEntityTypeForObjectType<OcfReadableObjectType>, OcfEntityType>
> = true;
const sourceReadableEntityMapPreservesUnion: Assert<
  IsExactly<SourceOcfEntityTypeForObjectType<SourceOcfReadableObjectType>, OcfEntityType>
> = true;
const brandedPlanSecurityObjectTypeIsPreserved: BrandedPlanSecurityObjectType =
  brandedPlanSecurityCapability.objectType;
const sourceBrandedPlanSecurityObjectTypeIsPreserved: BrandedPlanSecurityObjectType =
  sourceBrandedPlanSecurityCapability.objectType;
const brandedPlanSecurityCanonicalType: 'TX_EQUITY_COMPENSATION_ISSUANCE' =
  brandedPlanSecurityCapability.canonicalObjectType;
const sourceBrandedPlanSecurityCanonicalType: 'TX_EQUITY_COMPENSATION_ISSUANCE' =
  sourceBrandedPlanSecurityCapability.canonicalObjectType;
const brandedPlanSecurityEntity: 'equityCompensationIssuance' = brandedPlanSecurityCapability.entityType;
const sourceBrandedPlanSecurityEntity: 'equityCompensationIssuance' = sourceBrandedPlanSecurityCapability.entityType;
const unsupportedCapabilityTag: 'unsupported' = unsupportedCapability.support;
const sourceUnsupportedCapabilityTag: 'unsupported' = sourceUnsupportedCapability.support;
const unsupportedCapabilityObjectType: 'TX_NOT_REAL' = unsupportedCapability.objectType;
const sourceUnsupportedCapabilityObjectType: 'TX_NOT_REAL' = sourceUnsupportedCapability.objectType;
const longUnsupportedCapabilityTag: 'unsupported' = longUnsupportedCapability.support;
const sourceLongUnsupportedCapabilityTag: 'unsupported' = sourceLongUnsupportedCapability.support;
// @ts-expect-error template-literal inputs can include supported OCF discriminators
const templateCapabilityTag: 'unsupported' = templateCapability.support;
// @ts-expect-error source and dist both preserve overlapping template possibilities
const sourceTemplateCapabilityTag: 'unsupported' = sourceTemplateCapability.support;
const unrelatedTemplateCapabilityTag: 'unsupported' = unrelatedTemplateCapability.support;
const sourceUnrelatedTemplateCapabilityTag: 'unsupported' = sourceUnrelatedTemplateCapability.support;
// @ts-expect-error a broad runtime string can name a supported OCF discriminator
const broadCapabilityTag: 'unsupported' = broadCapability.support;
// @ts-expect-error source and dist both preserve broad runtime possibilities
const sourceBroadCapabilityTag: 'unsupported' = sourceBroadCapability.support;
// @ts-expect-error an opaque string refinement can still contain a supported runtime value
const brandedCapabilityTag: 'unsupported' = brandedCapability.support;
// @ts-expect-error source and dist both preserve opaque runtime possibilities
const sourceBrandedCapabilityTag: 'unsupported' = sourceBrandedCapability.support;
// @ts-expect-error an opaque template suffix can evaluate to a supported discriminator
const opaqueSuffixTemplateCapabilityTag: 'unsupported' = opaqueSuffixTemplateCapability.support;
// @ts-expect-error source declarations preserve opaque template overlap
const sourceOpaqueSuffixTemplateCapabilityTag: 'unsupported' = sourceOpaqueSuffixTemplateCapability.support;
// @ts-expect-error an opaque template prefix can evaluate to a supported discriminator
const opaquePrefixTemplateCapabilityTag: 'unsupported' = opaquePrefixTemplateCapability.support;
// @ts-expect-error source declarations preserve opaque prefix overlap
const sourceOpaquePrefixTemplateCapabilityTag: 'unsupported' = sourceOpaquePrefixTemplateCapability.support;
// @ts-expect-error an embedded opaque segment can evaluate to a supported discriminator
const opaqueMiddleTemplateCapabilityTag: 'unsupported' = opaqueMiddleTemplateCapability.support;
// @ts-expect-error source declarations preserve embedded opaque overlap
const sourceOpaqueMiddleTemplateCapabilityTag: 'unsupported' = sourceOpaqueMiddleTemplateCapability.support;
// @ts-expect-error an intrinsic transform of an opaque string can evaluate to a supported discriminator
const opaqueIntrinsicCapabilityTag: 'unsupported' = opaqueIntrinsicCapability.support;
// @ts-expect-error source declarations preserve opaque intrinsic overlap
const sourceOpaqueIntrinsicCapabilityTag: 'unsupported' = sourceOpaqueIntrinsicCapability.support;
const unrelatedOpaqueTemplateCapabilityTag: 'unsupported' = unrelatedOpaqueTemplateCapability.support;
const sourceUnrelatedOpaqueTemplateCapabilityTag: 'unsupported' = sourceUnrelatedOpaqueTemplateCapability.support;
const capabilitySourceAndDistMatch: Assert<IsExactly<OcfObjectTypeCapability, SourceOcfObjectTypeCapability>> = true;
const impossibleCapability: OcfObjectTypeCapability = {
  support: 'ledger-backed',
  objectType: 'TX_STOCK_ISSUANCE',
  canonicalObjectType: 'TX_STOCK_ISSUANCE',
  // @ts-expect-error canonical object type and SDK entity type must remain correlated
  entityType: 'stakeholder',
};

function verifyCapabilityCorrelation(capability: OcfObjectTypeCapability): void {
  if (capability.support === 'ledger-backed' && capability.canonicalObjectType === 'TX_STOCK_ISSUANCE') {
    const exactEntityType: 'stockIssuance' = capability.entityType;
    void exactEntityType;
  }
}

function verifyBrandedObjectTypeEqualityNarrowing(objectType: BrandedReadableObjectType): void {
  if (objectType !== 'ISSUER') return;

  const capability = getOcfObjectTypeCapability(objectType);
  const sourceCapability = getSourceOcfObjectTypeCapability(objectType);
  const exactObjectType: typeof objectType = capability.objectType;
  const exactSourceObjectType: typeof objectType = sourceCapability.objectType;
  const canonicalObjectType: 'ISSUER' = capability.canonicalObjectType;
  const sourceCanonicalObjectType: 'ISSUER' = sourceCapability.canonicalObjectType;
  const entityType: 'issuer' = capability.entityType;
  const sourceEntityType: 'issuer' = sourceCapability.entityType;
  const mappedEntityType: 'issuer' = mapOcfObjectTypeToEntityType(objectType);
  const sourceMappedEntityType: 'issuer' = mapSourceOcfObjectTypeToEntityType(objectType);
  const entityAlias: OcfEntityTypeForObjectType<typeof objectType> = 'issuer';
  const sourceEntityAlias: SourceOcfEntityTypeForObjectType<typeof objectType> = 'issuer';

  void exactObjectType;
  void exactSourceObjectType;
  void canonicalObjectType;
  void sourceCanonicalObjectType;
  void entityType;
  void sourceEntityType;
  void mappedEntityType;
  void sourceMappedEntityType;
  void entityAlias;
  void sourceEntityAlias;
}
const lineageIssueCode: OcfCapTableSnapshotIssueCode = 'SECURITY_LINEAGE_CYCLE';
const lineageIssue: OcfCapTableSnapshotIssue = {
  code: lineageIssueCode,
  message: 'cycle',
  objectType: 'TX_STOCK_TRANSFER',
  objectId: 'transfer-1',
  path: 'resulting_security_ids[0]',
  referenceId: 'security-a',
  cycleIds: ['security-a', 'security-b'],
};
const malformedTriggerIssue: OcfCapTableSnapshotIssue = {
  code: 'MALFORMED_TRIGGER_ID',
  message: 'empty trigger id',
  objectType: 'TX_CONVERTIBLE_ISSUANCE',
  objectId: 'convertible-1',
  path: 'conversion_triggers[0].trigger_id',
  referenceId: '',
};
const duplicateTriggerIssue: OcfCapTableSnapshotIssue = {
  code: 'DUPLICATE_TRIGGER_ID',
  message: 'duplicate trigger id',
  objectType: 'TX_CONVERTIBLE_ISSUANCE',
  objectId: 'convertible-1',
  path: 'conversion_triggers[1].trigger_id',
  firstPath: 'conversion_triggers[0].trigger_id',
  referenceId: 'trigger-1',
  count: 2,
};
// @ts-expect-error cycle diagnostics require location, reference, and non-empty cycle evidence
const incompleteLineageIssue: OcfCapTableSnapshotIssue = {
  code: 'SECURITY_LINEAGE_CYCLE',
  message: 'cycle without evidence',
};

// @ts-expect-error an invalid result must contain at least one issue
const invalidFalseResult: OcfCapTableSnapshotValidationResult = {
  valid: false,
  issues: [],
};
// @ts-expect-error a valid result cannot contain diagnostics
const invalidTrueResult: OcfCapTableSnapshotValidationResult = {
  valid: true,
  issues: [lineageIssue],
};

if (!snapshotResult.valid) {
  const firstIssue = snapshotResult.issues[0];
  if (firstIssue.code === 'SECURITY_FAMILY_MISMATCH') {
    const expectedFamilies: readonly OcfSecurityFamily[] = firstIssue.expectedSecurityFamilies;
    const actualFamily: OcfSecurityFamily = firstIssue.actualSecurityFamily;
    // @ts-expect-error security-family diagnostics do not pretend issuance types are object references
    firstIssue.targetObjectTypes;
    void expectedFamilies;
    void actualFamily;
  }
  if (firstIssue.code === 'AMBIGUOUS_SECURITY_REFERENCE') {
    const producerTypes: readonly string[] = firstIssue.producerObjectTypes;
    // @ts-expect-error ambiguity evidence describes producers, not reference targets
    firstIssue.targetObjectTypes;
    void producerTypes;
  }
  if (firstIssue.code === 'MULTIPLE_SECURITY_CONSUMERS') {
    const consumerTypes: readonly string[] = firstIssue.consumerObjectTypes;
    // @ts-expect-error consumer multiplicity does not expose producer evidence
    firstIssue.producerObjectTypes;
    void consumerTypes;
  }
}

void snapshotResult;
void sourceSnapshotResult;
void snapshotSourceAndDistMatch;
void typedIssuerSnapshotObject;
void incompleteSnapshotObject;
void planSecuritySnapshotObject;
void canonicalPlanSecurityType;
void canonicalPlanSecurityEntity;
void brandedIssuerObjectTypeIsPreserved;
void sourceBrandedIssuerObjectTypeIsPreserved;
void brandedIssuerCanonicalType;
void sourceBrandedIssuerCanonicalType;
void brandedIssuerEntity;
void sourceBrandedIssuerEntity;
void brandedIssuerMappedEntity;
void sourceBrandedIssuerMappedEntity;
void brandedIssuerEntityAlias;
void sourceBrandedIssuerEntityAlias;
void readableEntityMapPreservesUnion;
void sourceReadableEntityMapPreservesUnion;
void brandedPlanSecurityObjectTypeIsPreserved;
void sourceBrandedPlanSecurityObjectTypeIsPreserved;
void brandedPlanSecurityCanonicalType;
void sourceBrandedPlanSecurityCanonicalType;
void brandedPlanSecurityEntity;
void sourceBrandedPlanSecurityEntity;
void unsupportedCapabilityTag;
void sourceUnsupportedCapabilityTag;
void unsupportedCapabilityObjectType;
void sourceUnsupportedCapabilityObjectType;
void longUnsupportedCapabilityTag;
void sourceLongUnsupportedCapabilityTag;
void templateCapabilityTag;
void sourceTemplateCapabilityTag;
void unrelatedTemplateCapabilityTag;
void sourceUnrelatedTemplateCapabilityTag;
void broadCapabilityTag;
void sourceBroadCapabilityTag;
void brandedCapabilityTag;
void sourceBrandedCapabilityTag;
void opaqueSuffixTemplateCapabilityTag;
void sourceOpaqueSuffixTemplateCapabilityTag;
void opaquePrefixTemplateCapabilityTag;
void sourceOpaquePrefixTemplateCapabilityTag;
void opaqueMiddleTemplateCapabilityTag;
void sourceOpaqueMiddleTemplateCapabilityTag;
void opaqueIntrinsicCapabilityTag;
void sourceOpaqueIntrinsicCapabilityTag;
void unrelatedOpaqueTemplateCapabilityTag;
void sourceUnrelatedOpaqueTemplateCapabilityTag;
void templateCapabilityIsUnion;
void sourceTemplateCapabilityIsUnion;
void broadCapabilityIsUnion;
void sourceBroadCapabilityIsUnion;
void brandedCapabilityIsUnion;
void sourceBrandedCapabilityIsUnion;
void opaqueSuffixTemplateCapabilityIsUnion;
void sourceOpaqueSuffixTemplateCapabilityIsUnion;
void opaquePrefixTemplateCapabilityIsUnion;
void sourceOpaquePrefixTemplateCapabilityIsUnion;
void opaqueMiddleTemplateCapabilityIsUnion;
void sourceOpaqueMiddleTemplateCapabilityIsUnion;
void opaqueIntrinsicCapabilityIsUnion;
void sourceOpaqueIntrinsicCapabilityIsUnion;
void capabilitySourceAndDistMatch;
void impossibleCapability;
void lineageIssue;
void malformedTriggerIssue;
void duplicateTriggerIssue;
void incompleteLineageIssue;
void invalidFalseResult;
void invalidTrueResult;
void verifyCapabilityCorrelation;
void verifyBrandedObjectTypeEqualityNarrowing;

function verifyPublishedBatchApi(
  batch: CapTableBatch,
  stakeholder: OcfStakeholder,
  stockClass: OcfStockClass,
  issuer: OcfIssuer,
  stockAcceptance: OcfStockAcceptance,
  warrantAcceptance: OcfWarrantAcceptance,
  vestingStart: OcfVestingStart,
  vestingEvent: OcfVestingEvent
): void {
  batch.create('stakeholder', stakeholder);
  batch.create('stockClass', stockClass);
  batch.edit('issuer', issuer);
  batch.delete('stakeholder', stakeholder.id);

  // @ts-expect-error issuer is edit-only
  batch.create('issuer', issuer);

  // @ts-expect-error issuer cannot be deleted from a cap table
  batch.delete('issuer', issuer.id);

  // @ts-expect-error the published declaration must correlate kind and payload
  batch.create('stockClass', stakeholder);

  const widenedKind = 'stakeholder' as 'stakeholder' | 'stockClass';

  // @ts-expect-error a union-valued kind does not prove which payload belongs to it
  batch.create(widenedKind, stakeholder);

  // @ts-expect-error a union-valued kind cannot bypass edit payload correlation
  batch.edit(widenedKind, stakeholder);

  // @ts-expect-error a union-valued kind cannot bypass converter payload correlation
  convertToDaml(widenedKind, stakeholder);

  // @ts-expect-error published types preserve stock vs warrant identity even with identical fields
  batch.create('warrantAcceptance', stockAcceptance);

  // @ts-expect-error published types preserve vesting start vs vesting event identity
  batch.create('vestingEvent', vestingStart);

  // @ts-expect-error converter declarations cannot reinterpret a warrant acceptance as stock
  convertToDaml('stockAcceptance', warrantAcceptance);

  // @ts-expect-error converter declarations cannot reinterpret a vesting event as vesting start
  convertToDaml('vestingStart', vestingEvent);

  // @ts-expect-error published entity declarations require object_type
  const missingObjectType: OcfStockAcceptance = {
    id: 'acceptance-1',
    date: '2026-01-01',
    security_id: 'security-1',
  };
  void missingObjectType;

  const wrongObjectType: OcfStockAcceptance = {
    // @ts-expect-error published literal rejects another entity discriminator
    object_type: 'TX_WARRANT_ACCEPTANCE',
    id: 'acceptance-2',
    date: '2026-01-01',
    security_id: 'security-2',
  };
  void wrongObjectType;

  const operations: CapTableBatchOperations = {
    creates: [{ type: 'stakeholder', data: stakeholder }],
    edits: [{ type: 'issuer', data: issuer }],
    deletes: [{ type: 'stockClass', id: stockClass.id }],
  };
  void operations;

  // @ts-expect-error published operation declarations preserve exact payload identity
  const invalidIdentityOperation: OcfCreateOperation = {
    type: 'warrantAcceptance',
    data: stockAcceptance,
  };
  void invalidIdentityOperation;
}

function verifyPublishedUtilsApi(candidateEntityType: string): void {
  if (isOcfEntityTypeFromUtils(candidateEntityType)) {
    const narrowedEntityType: OcfEntityType = candidateEntityType;
    void narrowedEntityType;
  }
}

void verifyPublishedBatchApi;
void verifyPublishedUtilsApi;
