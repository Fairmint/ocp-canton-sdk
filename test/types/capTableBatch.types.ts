/**
 * Compile-time contract tests for the public CapTableBatch API.
 *
 * This file is included by tsconfig.tests.json but intentionally does not match
 * Jest's test-file pattern. `npm run typecheck` is the test runner: every
 * `@ts-expect-error` must continue to describe a real compiler error.
 */

import {
  type CapTableBatch,
  type CapTableBatchOperations,
  convertToDaml,
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
} from '../../src';

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

const publicOcfObjectIsExact: Assert<IsExactly<OcfObject, IntendedCanonicalOcfObject>> = true;
const publicOcfObjectExcludesLegacyPlanSecurity: Assert<
  IsExactly<Extract<OcfObject, { readonly object_type: LegacyPlanSecurityObjectType }>, never>
> = true;

void publicOcfObjectIsExact;
void publicOcfObjectExcludesLegacyPlanSecurity;

function verifyCapTableBatchContract(
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

  // @ts-expect-error the entity kind determines the payload type
  batch.create('stockClass', stakeholder);

  // @ts-expect-error the entity kind determines the edit payload type
  batch.edit('stakeholder', stockClass);

  const widenedKind = 'stakeholder' as 'stakeholder' | 'stockClass';

  // @ts-expect-error a union-valued kind does not prove which payload belongs to it
  batch.create(widenedKind, stakeholder);

  // @ts-expect-error explicit union type arguments cannot bypass kind/payload correlation
  batch.edit(widenedKind, stakeholder);

  // @ts-expect-error the converter uses the same kind/payload correlation as the batch API
  convertToDaml(widenedKind, stakeholder);

  // @ts-expect-error identical payload fields cannot erase stock vs warrant identity
  batch.create('warrantAcceptance', stockAcceptance);

  // @ts-expect-error the discriminator also separates vesting start from vesting event
  batch.create('vestingEvent', vestingStart);

  // @ts-expect-error converter dispatch cannot reinterpret a warrant acceptance as stock
  convertToDaml('stockAcceptance', warrantAcceptance);

  // @ts-expect-error converter dispatch cannot reinterpret a vesting event as vesting start
  convertToDaml('vestingStart', vestingEvent);

  // @ts-expect-error every top-level OCF object requires its canonical discriminator
  const missingObjectType: OcfStockAcceptance = {
    id: 'acceptance-1',
    date: '2026-01-01',
    security_id: 'security-1',
  };
  void missingObjectType;

  const wrongObjectType: OcfStockAcceptance = {
    // @ts-expect-error stock acceptance cannot carry the warrant discriminator
    object_type: 'TX_WARRANT_ACCEPTANCE',
    id: 'acceptance-2',
    date: '2026-01-01',
    security_id: 'security-2',
  };
  void wrongObjectType;

  const createOperation: OcfCreateOperation = {
    type: 'stakeholder',
    data: stakeholder,
  };
  void createOperation;

  // @ts-expect-error operation objects preserve identity for structurally identical payloads
  const invalidIdentityOperation: OcfCreateOperation = {
    type: 'warrantAcceptance',
    data: stockAcceptance,
  };
  void invalidIdentityOperation;

  const operations: CapTableBatchOperations = {
    creates: [
      { type: 'stakeholder', data: stakeholder },
      { type: 'stockClass', data: stockClass },
    ],
    edits: [{ type: 'issuer', data: issuer }],
    deletes: [{ type: 'stakeholder', id: stakeholder.id }],
  };
  void operations;

  // @ts-expect-error a stockClass operation cannot carry stakeholder data
  const invalidCreateOperation: OcfCreateOperation = {
    type: 'stockClass',
    data: stakeholder,
  };
  void invalidCreateOperation;
}

void verifyCapTableBatchContract;
