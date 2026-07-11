/**
 * Compile-time contract tests for the public CapTableBatch API.
 *
 * This file is included by tsconfig.tests.json but intentionally does not match
 * Jest's test-file pattern. `npm run typecheck` is the test runner: every
 * `@ts-expect-error` must continue to describe a real compiler error.
 */

import {
  type CapTableBatch,
  type CapTableBatchExecuteResult,
  type CapTableBatchOperations,
  type ConversionTriggerFor,
  type ConvertibleConversionRight,
  type ConvertibleConversionTrigger,
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
  type RatioConversionMechanism,
  type StockClassConversionRight,
  type WarrantExerciseTrigger,
  type WarrantTriggerConversionRight,
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

declare const executeResult: CapTableBatchExecuteResult;
const returnedContractIds: readonly OcfContractId[] = executeResult.createdCids;
const stakeholderContractId: OcfContractId = { tag: 'CidStakeholder', value: 'stakeholder-cid' };
void returnedContractIds;
void stakeholderContractId;

// @ts-expect-error batch results expose only canonical entity contract-id tags
const legacyContractId: OcfContractId = { tag: 'CidPlanSecurityIssuance', value: 'legacy-cid' };
void legacyContractId;

function verifyCapTableBatchContract(
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

  // @ts-expect-error the entity kind determines the payload type
  batch.create('stockClass', stakeholder);

  // @ts-expect-error the entity kind determines the edit payload type
  batch.edit('stakeholder', stockClass);

  const widenedKind = 'stakeholder' as 'stakeholder' | 'stockClass';

  // @ts-expect-error a union-valued kind does not prove which payload belongs to it
  batch.create(widenedKind, stakeholder);

  // @ts-expect-error explicit union type arguments cannot bypass kind/payload correlation
  batch.edit(widenedKind, stakeholder);

  // @ts-expect-error identical payload fields cannot erase stock vs warrant identity
  batch.create('warrantAcceptance', stockAcceptance);

  // @ts-expect-error the discriminator also separates vesting start from vesting event
  batch.create('vestingEvent', vestingStart);

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

type CanonicalConvertibleTrigger = ConversionTriggerFor<ConvertibleConversionRight>;
type CanonicalWarrantTrigger = ConversionTriggerFor<WarrantTriggerConversionRight>;

const convertibleTriggerAliasIsCanonical: Assert<IsExactly<ConvertibleConversionTrigger, CanonicalConvertibleTrigger>> =
  true;
const warrantTriggerAliasIsCanonical: Assert<IsExactly<WarrantExerciseTrigger, CanonicalWarrantTrigger>> = true;

declare const convertibleRight: ConvertibleConversionRight;
declare const warrantRight: WarrantTriggerConversionRight;

const validDateTrigger: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'convertible-trigger-1',
  conversion_right: convertibleRight,
  trigger_date: '2026-01-01',
};
const validRangeTrigger: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'warrant-trigger-1',
  conversion_right: warrantRight,
  start_date: '2026-01-01',
  end_date: '2026-02-01',
};

const mixedDateTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'convertible-trigger-mixed',
  conversion_right: convertibleRight,
  trigger_date: '2026-01-01',
  trigger_condition: 'forbidden',
} as const;
// @ts-expect-error discriminator-specific fields cannot be mixed, including through a variable
const invalidMixedDateTrigger: ConvertibleConversionTrigger = mixedDateTrigger;

const fieldFreeTriggerWithDate = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'warrant-trigger-with-date',
  conversion_right: warrantRight,
  trigger_date: '2026-01-01',
} as const;
// @ts-expect-error field-free variants reject discriminator-specific fields
const invalidFieldFreeTrigger: WarrantExerciseTrigger = fieldFreeTriggerWithDate;

// @ts-expect-error AUTOMATIC_ON_DATE requires trigger_date
const missingTriggerDate: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'convertible-trigger-missing-date',
  conversion_right: convertibleRight,
};

// @ts-expect-error ELECTIVE_IN_RANGE requires end_date
const missingRangeEnd: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'warrant-trigger-missing-end',
  conversion_right: warrantRight,
  start_date: '2026-01-01',
};

// @ts-expect-error every trigger requires trigger_id
const missingTriggerId: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_AT_WILL',
  conversion_right: convertibleRight,
};

// @ts-expect-error every trigger requires conversion_right
const missingConversionRight: WarrantExerciseTrigger = {
  type: 'UNSPECIFIED',
  trigger_id: 'warrant-trigger-missing-right',
};

// @ts-expect-error bare trigger strings are not conversion-trigger records
const bareTriggerString: ConvertibleConversionTrigger = 'AUTOMATIC_ON_DATE';

const wrongTriggerRight: ConvertibleConversionTrigger = {
  type: 'UNSPECIFIED',
  trigger_id: 'convertible-trigger-wrong-right',
  // @ts-expect-error convertible triggers require a convertible conversion right
  conversion_right: warrantRight,
};

void convertibleTriggerAliasIsCanonical;
void warrantTriggerAliasIsCanonical;
void validDateTrigger;
void validRangeTrigger;
void invalidMixedDateTrigger;
void invalidFieldFreeTrigger;
void missingTriggerDate;
void missingRangeEnd;
void missingTriggerId;
void missingConversionRight;
void bareTriggerString;
void wrongTriggerRight;

interface CanonicalRatioConversionMechanism {
  type: 'RATIO_CONVERSION';
  ratio: { numerator: string; denominator: string };
  conversion_price: { amount: string; currency: string };
  rounding_type: 'CEILING' | 'FLOOR' | 'NORMAL';
}
interface CanonicalStockClassConversionRight {
  type: 'STOCK_CLASS_CONVERSION_RIGHT';
  conversion_mechanism: CanonicalRatioConversionMechanism;
  converts_to_stock_class_id: string;
  converts_to_future_round?: boolean;
}

const ratioMechanismIsSchemaExact: Assert<IsExactly<RatioConversionMechanism, CanonicalRatioConversionMechanism>> =
  true;
const stockClassRightIsSchemaExact: Assert<IsExactly<StockClassConversionRight, CanonicalStockClassConversionRight>> =
  true;

const validStockClassRight: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    ratio: { numerator: '1', denominator: '1' },
    conversion_price: { amount: '1', currency: 'USD' },
    rounding_type: 'NORMAL',
  },
  converts_to_stock_class_id: 'common',
};
const invalidStockClassRightType: StockClassConversionRight = {
  ...validStockClassRight,
  // @ts-expect-error stock-class conversion rights have one exact discriminator
  type: 'NOT_THE_SCHEMA_TAG',
};
const invalidStockClassScalarTrigger: StockClassConversionRight = {
  ...validStockClassRight,
  // @ts-expect-error DAML-only trigger artifacts are not part of canonical OCF
  conversion_trigger: 'AUTOMATIC_ON_DATE',
};
const invalidStockClassStringMechanism: StockClassConversionRight = {
  ...validStockClassRight,
  // @ts-expect-error stock-class rights require the complete ratio mechanism object
  conversion_mechanism: 'RATIO_CONVERSION',
};

void ratioMechanismIsSchemaExact;
void stockClassRightIsSchemaExact;
void validStockClassRight;
void invalidStockClassRightType;
void invalidStockClassScalarTrigger;
void invalidStockClassStringMechanism;
