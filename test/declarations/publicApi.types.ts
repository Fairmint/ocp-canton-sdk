/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  convertToDaml,
  type CapTableBatch,
  type CapTableBatchOperations,
  type OcfCreateOperation,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfFinancing,
  type OcfIssuer,
  type OcfObject,
  type OcfStakeholder,
  type OcfStockAcceptance,
  type OcfStockClass,
  type OcfVestingEvent,
  type OcfVestingStart,
  type OcfWarrantAcceptance,
} from '../../dist';
import {
  damlTimeToDateString,
  dateStringToDAMLTime,
  isOcfEntityType as isOcfEntityTypeFromUtils,
  nullableDamlTimeToDateString,
  nullableDateStringToDAMLTime,
  optionalDamlTimeToDateString,
  optionalDateStringToDAMLTime,
} from '../../dist/utils';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
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
declare const unknownDateInput: unknown;
const validatedDamlTime: string = dateStringToDAMLTime(unknownDateInput, 'transaction.date');
const validatedOcfDate: string = damlTimeToDateString(unknownDateInput, 'transaction.date');
const optionalDamlTime: string | null = optionalDateStringToDAMLTime(unknownDateInput, 'transaction.date');
const nullableDamlTime: string | null = nullableDateStringToDAMLTime(unknownDateInput, 'transaction.date');
const optionalOcfDate: string | undefined = optionalDamlTimeToDateString(unknownDateInput, 'transaction.date');
const nullableOcfDate: string | null = nullableDamlTimeToDateString(unknownDateInput, 'transaction.date');

// @ts-expect-error every public date conversion requires an entity-specific field path
dateStringToDAMLTime(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
damlTimeToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
optionalDamlTimeToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
nullableDamlTimeToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
optionalDateStringToDAMLTime(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
nullableDateStringToDAMLTime(unknownDateInput);

void publishedOcfObjectIsExact;
void publishedOcfObjectExcludesLegacyPlanSecurity;
void validatedDamlTime;
void validatedOcfDate;
void optionalDamlTime;
void nullableDamlTime;
void optionalOcfDate;
void nullableOcfDate;

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
