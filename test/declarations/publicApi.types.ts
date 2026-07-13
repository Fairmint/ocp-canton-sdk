/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for the curated declarations exported by the built SDK. */

import {
  authorizeIssuer,
  buildCreateIssuerCommand,
  CapTableBatch,
  OcpClient,
  OcpValidationError,
  withdrawAuthorization,
  type AuthorizeIssuerResult,
  type CapTableBatchExecuteResult,
  type CapTableBatchOperations,
  type CreateIssuerParams,
  type OcfContractId,
  type OcfCreateOperation,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfFinancing,
  type OcfIssuer,
  type OcfObject,
  type OcfStakeholder,
  type OcfStockAcceptance,
  type OcfStockClass,
  type OcfVestingStart,
  type SubmitAndWaitForTransactionTreeResponse,
  type WithdrawAuthorizationResult,
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
>;
type IntendedCanonicalOcfObject = OcfEntityDataMap[OcfEntityType];

const publishedOcfObjectIsExact: Assert<IsExactly<OcfObject, IntendedCanonicalOcfObject>> = true;
const generatedValuesAreNotRootExports: Assert<IsExactly<RemovedRootValue, never>> = true;
const authorizeIssuerResponseUsesPublicLedgerType: Assert<
  IsExactly<AuthorizeIssuerResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;
const withdrawAuthorizationResponseUsesPublicLedgerType: Assert<
  IsExactly<WithdrawAuthorizationResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;

void publishedOcfObjectIsExact;
void generatedValuesAreNotRootExports;
void authorizeIssuerResponseUsesPublicLedgerType;
void withdrawAuthorizationResponseUsesPublicLedgerType;
void authorizeIssuer;
void buildCreateIssuerCommand;
void CapTableBatch;
void OcpClient;
void OcpValidationError;
void withdrawAuthorization;

declare const createIssuerParams: CreateIssuerParams;
buildCreateIssuerCommand(createIssuerParams);

// @ts-expect-error generated DAML wire unions are intentionally not root exports
type RemovedGeneratedWireType = import('../../dist').OcfCreateData;
declare const removedGeneratedWireType: RemovedGeneratedWireType;
void removedGeneratedWireType;

declare const executeResult: CapTableBatchExecuteResult;
const returnedContractIds: readonly OcfContractId[] = executeResult.editedCids;
const issuerContractId: OcfContractId = { tag: 'CidIssuer', value: 'issuer-cid' };
const financingContractId: OcfContractId = { tag: 'CidFinancing', value: 'financing-cid' };
void returnedContractIds;
void issuerContractId;
void financingContractId;

function verifyPublishedBatchApi(
  batch: CapTableBatch,
  stakeholder: OcfStakeholder,
  stockClass: OcfStockClass,
  financing: OcfFinancing,
  issuer: OcfIssuer,
  stockAcceptance: OcfStockAcceptance,
  vestingStart: OcfVestingStart
): void {
  batch.create('stakeholder', stakeholder);
  batch.create('stockClass', stockClass);
  batch.create('financing', financing);
  batch.edit('financing', financing);
  batch.delete('financing', financing.id);
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

  // @ts-expect-error published types preserve entity identity even with structurally similar fields
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

  const operations: CapTableBatchOperations = {
    creates: [
      { type: 'stakeholder', data: stakeholder },
      { type: 'financing', data: financing },
    ],
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
