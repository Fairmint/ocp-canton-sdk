/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  authorizeIssuer,
  buildCreateIssuerCommand,
  CapTableBatch,
  isContractId,
  isOcfId,
  isPartyId,
  isSecurityId,
  OcpClient,
  OcpValidationError,
  toContractId,
  toOcfId,
  toPartyId,
  toSecurityId,
  withdrawAuthorization,
  type CapTableBatchExecuteResult,
  type CapTableBatchOperations,
  type ContractId,
  type CreateIssuerParams,
  type OcfContractId,
  type OcfCreateOperation,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfFinancing,
  type OcfId,
  type OcfIssuer,
  type OcfObject,
  type OcfStakeholder,
  type OcfStockAcceptance,
  type OcfStockClass,
  type OcfVestingStart,
  type PartyId,
  type SecurityId,
} from '../../dist';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type RemovedRootValue = Extract<
  keyof typeof import('../../dist'),
  | 'convertToDaml'
  | 'convertToOcf'
  | 'decodeDamlEntityData'
  | 'ENTITY_REGISTRY'
  | 'ENTITY_TAG_MAP'
  | 'getIssuerAsOcf'
  | 'getStakeholderAsOcf'
  | 'unsafeToContractId'
  | 'unsafeToOcfId'
  | 'unsafeToPartyId'
  | 'unsafeToSecurityId'
>;
// This file is linted before `dist` exists in a clean checkout, so its declaration-only imports appear as error types.

type IntendedCanonicalOcfObject = OcfEntityDataMap[OcfEntityType] | OcfFinancing;
type LegacyPlanSecurityObjectType =
  | 'TX_PLAN_SECURITY_ACCEPTANCE'
  | 'TX_PLAN_SECURITY_CANCELLATION'
  | 'TX_PLAN_SECURITY_EXERCISE'
  | 'TX_PLAN_SECURITY_ISSUANCE'
  | 'TX_PLAN_SECURITY_RELEASE'
  | 'TX_PLAN_SECURITY_RETRACTION'
  | 'TX_PLAN_SECURITY_TRANSFER';

const publishedOcfObjectIsExact: Assert<IsExactly<OcfObject, IntendedCanonicalOcfObject>> = true;
const publishedOcfObjectExcludesLegacyPlanSecurity: Assert<
  IsExactly<Extract<OcfObject, { readonly object_type: LegacyPlanSecurityObjectType }>, never>
> = true;
const generatedAndLegacyValuesAreNotRootExports: Assert<IsExactly<RemovedRootValue, never>> = true;

void publishedOcfObjectIsExact;
void publishedOcfObjectExcludesLegacyPlanSecurity;
void generatedAndLegacyValuesAreNotRootExports;
void authorizeIssuer;
void buildCreateIssuerCommand;
void CapTableBatch;
void OcpClient;
void OcpValidationError;
void withdrawAuthorization;

declare const rawIdentifier: string;
const contractIdBrand: ContractId = toContractId(rawIdentifier);
const ocfIdBrand: OcfId = toOcfId(rawIdentifier);
const partyIdBrand: PartyId = toPartyId(rawIdentifier);
const securityIdBrand: SecurityId = toSecurityId(rawIdentifier);

// @ts-expect-error distinct identifier brands cannot be mixed
const wrongContractIdBrand: ContractId = partyIdBrand;

declare const unknownIdentifier: unknown;
const parsedContractIdBrand: ContractId = toContractId(unknownIdentifier);
const parsedOcfIdBrand: OcfId = toOcfId(unknownIdentifier);
const parsedPartyIdBrand: PartyId = toPartyId(unknownIdentifier);
const parsedSecurityIdBrand: SecurityId = toSecurityId(unknownIdentifier);
if (isContractId(unknownIdentifier)) {
  const narrowed: ContractId = unknownIdentifier;
  void narrowed;
}
if (isOcfId(unknownIdentifier)) {
  const narrowed: OcfId = unknownIdentifier;
  void narrowed;
}
if (isPartyId(unknownIdentifier)) {
  const narrowed: PartyId = unknownIdentifier;
  void narrowed;
}
if (isSecurityId(unknownIdentifier)) {
  const narrowed: SecurityId = unknownIdentifier;
  void narrowed;
}

void contractIdBrand;
void ocfIdBrand;
void partyIdBrand;
void securityIdBrand;
void wrongContractIdBrand;
void parsedContractIdBrand;
void parsedOcfIdBrand;
void parsedPartyIdBrand;
void parsedSecurityIdBrand;

declare const createIssuerParams: CreateIssuerParams;
buildCreateIssuerCommand(createIssuerParams);

// @ts-expect-error generated DAML wire unions are intentionally not root exports
type RemovedGeneratedWireType = import('../../dist').OcfCreateData;
declare const removedGeneratedWireType: RemovedGeneratedWireType;
void removedGeneratedWireType;

declare const executeResult: CapTableBatchExecuteResult;
const returnedContractIds: readonly OcfContractId[] = executeResult.editedCids;
const issuerContractId: OcfContractId = { tag: 'CidIssuer', value: 'issuer-cid' };
void returnedContractIds;
void issuerContractId;

// @ts-expect-error built declarations exclude legacy PlanSecurity result tags
const legacyContractId: OcfContractId = { tag: 'CidPlanSecurityIssuance', value: 'legacy-cid' };
void legacyContractId;

function verifyPublishedBatchApi(
  batch: CapTableBatch,
  stakeholder: OcfStakeholder,
  stockClass: OcfStockClass,
  issuer: OcfIssuer,
  stockAcceptance: OcfStockAcceptance,
  vestingStart: OcfVestingStart
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

  // @ts-expect-error published types preserve stock vs warrant identity even with identical fields
  batch.create('warrantAcceptance', stockAcceptance);

  // @ts-expect-error published types preserve vesting start vs vesting event identity
  batch.create('vestingEvent', vestingStart);

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

void verifyPublishedBatchApi;
