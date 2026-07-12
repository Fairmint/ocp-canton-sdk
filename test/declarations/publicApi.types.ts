/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  applyCommandContext,
  authorizeIssuer,
  buildCreateIssuerCommand,
  CapTableBatch,
  OcpClient,
  OcpValidationError,
  withdrawAuthorization,
  type AppliedCommandContext,
  type AuthorizeIssuerResult,
  type CapTableBatchExecuteResult,
  type CapTableBatchOperations,
  type CapTableBatchParams,
  type CapTableContractDetails,
  type CommandContext,
  type ConversionTriggerFor,
  type ConvertibleConversionRight,
  type ConvertibleConversionTrigger,
  type CreateIssuerParams,
  type DisclosedContract,
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
  type SubmitAndWaitForTransactionTreeResponse,
  type WarrantExerciseTrigger,
  type WarrantTriggerConversionRight,
  type WithdrawAuthorizationResult,
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
import type { Assert, IsExactly } from '../typeContracts/typeAssertions';

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
const authorizeIssuerResponseUsesPublicLedgerType: Assert<
  IsExactly<AuthorizeIssuerResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;
const withdrawAuthorizationResponseUsesPublicLedgerType: Assert<
  IsExactly<WithdrawAuthorizationResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;
declare const publishedBatchParams: CapTableBatchParams;
const publishedReadonlyActAs: readonly string[] = publishedBatchParams.actAs;
const publishedReadonlyReadAs: readonly string[] | undefined = publishedBatchParams.readAs;
// @ts-expect-error published command scopes are immutable
publishedBatchParams.actAs.push('mutated-party');
// @ts-expect-error published optional read scopes are immutable
publishedBatchParams.readAs?.push('mutated-reader');
if (publishedBatchParams.capTableContractDetails !== undefined) {
  // @ts-expect-error published template coordinates are immutable
  publishedBatchParams.capTableContractDetails.templateId = 'mutated-template';
}
const publishedMinimalCapTableDetails: CapTableContractDetails = { templateId: 'package:Module:CapTable' };
const publishedDisclosedContract: DisclosedContract = {
  templateId: 'package:Module:CapTable',
  contractId: 'cap-table-contract',
  createdEventBlob: 'created-event-blob',
  synchronizerId: 'synchronizer-id',
};
const publishedDisclosedCapTableDetails: CapTableContractDetails = publishedDisclosedContract;
const publishedExtraInlineCapTableDetails: CapTableContractDetails = {
  templateId: 'package:Module:CapTable',
  // @ts-expect-error published inline details expose only the exact template-reference surface
  contractId: 'cap-table-contract',
};
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
void generatedAndLegacyValuesAreNotRootExports;
void authorizeIssuerResponseUsesPublicLedgerType;
void withdrawAuthorizationResponseUsesPublicLedgerType;
void publishedReadonlyActAs;
void publishedReadonlyReadAs;
void publishedMinimalCapTableDetails;
void publishedDisclosedContract;
void publishedDisclosedCapTableDetails;
void publishedExtraInlineCapTableDetails;
void validatedDamlTime;
void validatedOcfDate;
void optionalDamlTime;
void nullableDamlTime;
void optionalOcfDate;
void nullableOcfDate;
void authorizeIssuer;
void buildCreateIssuerCommand;
void CapTableBatch;
void OcpClient;
void OcpValidationError;
void withdrawAuthorization;

declare const createIssuerParams: CreateIssuerParams;
buildCreateIssuerCommand(createIssuerParams);

const paramsWithCallerMetadata = {
  commands: [],
  actAs: ['issuer::party'],
  callerMetadata: 'preserved' as const,
};
const contextualizedParams = applyCommandContext(paramsWithCallerMetadata);
const publishedContextUsesPlainResult: AppliedCommandContext = contextualizedParams;
const publishedContextKeysAreExact: Assert<IsExactly<keyof typeof contextualizedParams, keyof AppliedCommandContext>> =
  true;
const publishedContextFieldsAreExact: Assert<
  IsExactly<Pick<typeof contextualizedParams, keyof CommandContext>, Pick<AppliedCommandContext, keyof CommandContext>>
> = true;
const publishedWorkflowId: string | undefined = contextualizedParams.workflowId;
const publishedActAs: string[] | undefined = contextualizedParams.actAs;
const publishedReadAs: string[] | undefined = contextualizedParams.readAs;

const paramsWithLiteralCommandId = {
  ...paramsWithCallerMetadata,
  commandId: 'command-from-params' as const,
};
const contextualizedWithCommandOverride = applyCommandContext(paramsWithLiteralCommandId, {
  context: { commandId: 'command-from-context' },
});
const publishedCommandId: string | undefined = contextualizedWithCommandOverride.commandId;
// @ts-expect-error Plain submit results do not promise arbitrary caller-specific members.
contextualizedParams.callerMetadata;
void publishedContextUsesPlainResult;
void publishedContextKeysAreExact;
void publishedContextFieldsAreExact;
void publishedWorkflowId;
void publishedActAs;
void publishedReadAs;
void publishedCommandId;

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

function verifyPublishedUtilsApi(candidateEntityType: string): void {
  if (isOcfEntityTypeFromUtils(candidateEntityType)) {
    const narrowedEntityType: OcfEntityType = candidateEntityType;
    void narrowedEntityType;
  }
}

void verifyPublishedBatchApi;
void verifyPublishedUtilsApi;

type PublishedCanonicalConvertibleTrigger = ConversionTriggerFor<ConvertibleConversionRight>;
type PublishedCanonicalWarrantTrigger = ConversionTriggerFor<WarrantTriggerConversionRight>;

const publishedConvertibleTriggerIsCanonical: Assert<
  IsExactly<ConvertibleConversionTrigger, PublishedCanonicalConvertibleTrigger>
> = true;
const publishedWarrantTriggerIsCanonical: Assert<IsExactly<WarrantExerciseTrigger, PublishedCanonicalWarrantTrigger>> =
  true;

declare const publishedConvertibleRight: ConvertibleConversionRight;
declare const publishedWarrantRight: WarrantTriggerConversionRight;

const publishedValidConditionTrigger: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_CONDITION',
  trigger_id: 'convertible-trigger-1',
  conversion_right: publishedConvertibleRight,
  trigger_condition: 'qualified financing',
};
const publishedValidAtWillTrigger: WarrantExerciseTrigger = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'warrant-trigger-1',
  conversion_right: publishedWarrantRight,
};

const publishedMixedRangeTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'warrant-trigger-mixed',
  conversion_right: publishedWarrantRight,
  start_date: '2026-01-01',
  end_date: '2026-02-01',
  trigger_date: '2026-01-15',
} as const;
// @ts-expect-error built declarations forbid fields from another discriminator variant
const publishedInvalidMixedRangeTrigger: WarrantExerciseTrigger = publishedMixedRangeTrigger;

// @ts-expect-error built declarations require trigger_condition for condition triggers
const publishedMissingCondition: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_ON_CONDITION',
  trigger_id: 'convertible-trigger-missing-condition',
  conversion_right: publishedConvertibleRight,
};

// @ts-expect-error built declarations require trigger_id
const publishedMissingTriggerId: WarrantExerciseTrigger = {
  type: 'UNSPECIFIED',
  conversion_right: publishedWarrantRight,
};

// @ts-expect-error built declarations require conversion_right
const publishedMissingConversionRight: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'convertible-trigger-missing-right',
};

// @ts-expect-error published API does not accept a bare trigger discriminator
const publishedBareTriggerString: WarrantExerciseTrigger = 'AUTOMATIC_ON_DATE';

void publishedConvertibleTriggerIsCanonical;
void publishedWarrantTriggerIsCanonical;
void publishedValidConditionTrigger;
void publishedValidAtWillTrigger;
void publishedInvalidMixedRangeTrigger;
void publishedMissingCondition;
void publishedMissingTriggerId;
void publishedMissingConversionRight;
void publishedBareTriggerString;

interface PublishedRatioConversionMechanism {
  type: 'RATIO_CONVERSION';
  ratio: { numerator: string; denominator: string };
  conversion_price: { amount: string; currency: string };
  rounding_type: 'CEILING' | 'FLOOR' | 'NORMAL';
}
interface PublishedStockClassConversionRight {
  type: 'STOCK_CLASS_CONVERSION_RIGHT';
  conversion_mechanism: Omit<PublishedRatioConversionMechanism, 'rounding_type'> & { rounding_type: 'NORMAL' };
  converts_to_stock_class_id: string;
  converts_to_future_round?: boolean;
}

const publishedRatioMechanismIsExact: Assert<IsExactly<RatioConversionMechanism, PublishedRatioConversionMechanism>> =
  true;
const publishedStockClassRightIsExact: Assert<
  IsExactly<StockClassConversionRight, PublishedStockClassConversionRight>
> = true;

const publishedStockClassRight: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'RATIO_CONVERSION',
    ratio: { numerator: '1', denominator: '1' },
    conversion_price: { amount: '1', currency: 'USD' },
    rounding_type: 'NORMAL',
  },
  converts_to_stock_class_id: 'common',
};
const publishedInvalidStockClassType: StockClassConversionRight = {
  ...publishedStockClassRight,
  // @ts-expect-error built declarations preserve the exact stock-class-right tag
  type: 'NOT_THE_SCHEMA_TAG',
};
const publishedInvalidScalarTrigger: StockClassConversionRight = {
  ...publishedStockClassRight,
  // @ts-expect-error built declarations do not expose the DAML-only trigger artifact
  conversion_trigger: 'AUTOMATIC_ON_DATE',
};

void publishedRatioMechanismIsExact;
void publishedStockClassRightIsExact;
void publishedStockClassRight;
void publishedInvalidStockClassType;
void publishedInvalidScalarTrigger;
