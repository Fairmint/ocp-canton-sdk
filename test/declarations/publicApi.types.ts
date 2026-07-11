/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  convertToDaml,
  getOcfObjectTypeCapability,
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
  type OcfFinancing,
  type OcfIssuer,
  type OcfObject,
  type OcfObjectTypeCapability,
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
  validateOcfCapTableSnapshot as validateSourceOcfCapTableSnapshot,
  type OcfCapTableSnapshotObject as SourceOcfCapTableSnapshotObject,
  type OcfObjectTypeCapability as SourceOcfObjectTypeCapability,
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
declare const templateObjectType: `TX_${string}`;
declare const unrelatedTemplateObjectType: `UNRELATED_${string}`;
declare const broadObjectType: string;
declare const brandedObjectType: string & { readonly __ocfObjectType: unique symbol };
const templateCapability = getOcfObjectTypeCapability(templateObjectType);
const sourceTemplateCapability = getSourceOcfObjectTypeCapability(templateObjectType);
const unrelatedTemplateCapability = getOcfObjectTypeCapability(unrelatedTemplateObjectType);
const sourceUnrelatedTemplateCapability = getSourceOcfObjectTypeCapability(unrelatedTemplateObjectType);
const broadCapability = getOcfObjectTypeCapability(broadObjectType);
const sourceBroadCapability = getSourceOcfObjectTypeCapability(broadObjectType);
const brandedCapability = getOcfObjectTypeCapability(brandedObjectType);
const sourceBrandedCapability = getSourceOcfObjectTypeCapability(brandedObjectType);
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

if (financingCapability.support === 'schema-only') {
  const financingObjectType: 'FINANCING' = financingCapability.objectType;
  void financingObjectType;
}

const canonicalPlanSecurityType: 'TX_EQUITY_COMPENSATION_ISSUANCE' = planSecurityCapability.canonicalObjectType;
const canonicalPlanSecurityEntity: 'equityCompensationIssuance' = planSecurityCapability.entityType;
const unsupportedCapabilityTag: 'unsupported' = unsupportedCapability.support;
const sourceUnsupportedCapabilityTag: 'unsupported' = sourceUnsupportedCapability.support;
const unsupportedCapabilityObjectType: 'TX_NOT_REAL' = unsupportedCapability.objectType;
const sourceUnsupportedCapabilityObjectType: 'TX_NOT_REAL' = sourceUnsupportedCapability.objectType;
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
const securityFamily: OcfSecurityFamily = 'stock';
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
void unsupportedCapabilityTag;
void sourceUnsupportedCapabilityTag;
void unsupportedCapabilityObjectType;
void sourceUnsupportedCapabilityObjectType;
void templateCapabilityTag;
void sourceTemplateCapabilityTag;
void unrelatedTemplateCapabilityTag;
void sourceUnrelatedTemplateCapabilityTag;
void broadCapabilityTag;
void sourceBroadCapabilityTag;
void brandedCapabilityTag;
void sourceBrandedCapabilityTag;
void templateCapabilityIsUnion;
void sourceTemplateCapabilityIsUnion;
void broadCapabilityIsUnion;
void sourceBroadCapabilityIsUnion;
void brandedCapabilityIsUnion;
void sourceBrandedCapabilityIsUnion;
void capabilitySourceAndDistMatch;
void impossibleCapability;
void lineageIssue;
void malformedTriggerIssue;
void duplicateTriggerIssue;
void incompleteLineageIssue;
void invalidFalseResult;
void invalidTrueResult;
void verifyCapabilityCorrelation;

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
