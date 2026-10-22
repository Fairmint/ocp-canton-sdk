/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  OcpClient,
  OcpValidationError,
  register,
  type AdmittedRegisterContract,
  type ClaimedShards,
  type ConversionTriggerFor,
  type ConvertibleConversionRight,
  type ConvertibleConversionTrigger,
  type IssuerDataInput,
  type LedgerJsonApiClient,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfIssuer,
  type OcfObject,
  type OcfStockAcceptance,
  type OutputVesting,
  type RatioConversionMechanism,
  type RecordedSplit,
  type RegisterCheckResult,
  type RegisterIndexFlag,
  type RegisterOpenHold,
  type RegisterRecord,
  type RegisterRejectedContract,
  type RegisterResult,
  type RegisterTransactionResult,
  type ShardStep,
  type StockClassConversionRight,
  type StockSecurityState,
  type SubmitAndWaitForTransactionResponse,
  type WarrantExerciseTrigger,
  type WarrantTriggerConversionRight,
} from '../../dist';
import {
  damlDateToDateString,
  dateStringToDAMLDate,
  isOcfEntityType as isOcfEntityTypeFromUtils,
  nullableDamlDateToDateString,
  nullableDateStringToDAMLDate,
  optionalDamlDateToDateString,
  optionalDateStringToDAMLDate,
} from '../../dist/utils';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type RemovedRootValue = Extract<
  keyof typeof import('../../dist'),
  | 'convertToDaml'
  | 'convertToDamlData'
  | 'convertToOcf'
  | 'decodeDamlEntityData'
  | 'ENTITY_REGISTRY'
  | 'OCF_DATA_FIELD'
  | 'damlEnumConstructor'
  | 'ocfEnumValue'
  | 'getIssuerAsOcf'
  | 'getStakeholderAsOcf'
>;
// This file is linted before `dist` exists in a clean checkout, so its declaration-only imports appear as error types.

type IntendedCanonicalOcfObject = OcfEntityDataMap[OcfEntityType];
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
const issuerDataInputIsTheCanonicalIssuer: Assert<IsExactly<IssuerDataInput, OcfIssuer>> = true;
declare const unknownDateInput: unknown;
const validatedDamlDate: string = dateStringToDAMLDate(unknownDateInput, 'transaction.date');
const validatedOcfDate: string = damlDateToDateString(unknownDateInput, 'transaction.date');
const optionalDamlDate: string | null = optionalDateStringToDAMLDate(unknownDateInput, 'transaction.date');
const nullableDamlDate: string | null = nullableDateStringToDAMLDate(unknownDateInput, 'transaction.date');
const optionalOcfDate: string | undefined = optionalDamlDateToDateString(unknownDateInput, 'transaction.date');
const nullableOcfDate: string | null = nullableDamlDateToDateString(unknownDateInput, 'transaction.date');

// @ts-expect-error every public date conversion requires an entity-specific field path
dateStringToDAMLDate(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
damlDateToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
optionalDamlDateToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
nullableDamlDateToDateString(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
optionalDateStringToDAMLDate(unknownDateInput);
// @ts-expect-error every public date conversion requires an entity-specific field path
nullableDateStringToDAMLDate(unknownDateInput);

void publishedOcfObjectIsExact;
void publishedOcfObjectExcludesLegacyPlanSecurity;
void generatedAndLegacyValuesAreNotRootExports;
void issuerDataInputIsTheCanonicalIssuer;
void validatedDamlDate;
void validatedOcfDate;
void optionalDamlDate;
void nullableDamlDate;
void optionalOcfDate;
void nullableOcfDate;
void OcpClient;
void OcpValidationError;

// @ts-expect-error generated DAML payload types are intentionally not root exports
type RemovedGeneratedWireType = import('../../dist').DamlDataTypeFor<'stakeholder'>;
declare const removedGeneratedWireType: RemovedGeneratedWireType;
void removedGeneratedWireType;

function verifyPublishedEntityTypes(stockAcceptance: OcfStockAcceptance): void {
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
  void stockAcceptance;
}

function verifyPublishedUtilsApi(candidateEntityType: string): void {
  if (isOcfEntityTypeFromUtils(candidateEntityType)) {
    const narrowedEntityType: OcfEntityType = candidateEntityType;
    void narrowedEntityType;
  }
}

void verifyPublishedEntityTypes;
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
  conversion_mechanism: PublishedRatioConversionMechanism;
  converts_to_stock_class_id?: string;
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

// ── Register primitives (the `register` namespace) and the native ledger-state types ─────────────────────────────

declare const publishedState: StockSecurityState;
declare const publishedSplits: RecordedSplit[];
declare const publishedShards: ClaimedShards;
declare const publishedOutputs: OutputVesting[];

const publishedDerivedId: string = register.deriveId({
  capTableId: 'test-1',
  securityId: 'S-A1',
  seq: 0,
  role: 'resulting_security',
  index: 0,
});
// @ts-expect-error derived-ID roles are a fixed vocabulary
register.deriveId({ capTableId: 'test-1', securityId: 'S-A1', seq: 0, role: 'issuance', index: 0 });
const publishedClaimStep: ShardStep = register.simulateClaim(publishedShards, register.claimHash('object', 'ID-1'));
const publishedApplied: RegisterResult<StockSecurityState> = register.applySplits(
  publishedSplits,
  '2025-01-10',
  publishedState
);
const publishedOutputsCheck: RegisterCheckResult = register.checkOutputsVesting(
  '2025-01-10',
  'TR-1',
  [publishedState],
  publishedOutputs
);
const publishedFloor: string = register.floorMulDiv('1000', '250', '1000');
const publishedUnits: bigint = register.floorMulDivUnits(1n, 1n, 3n);
const publishedCap: number = register.MAX_HASHES_PER_SHARD;
const publishedVestingIsTagged: StockSecurityState['vesting'] = { kind: 'on_terms', vesting_terms_id: 'VT-1' };
// @ts-expect-error vesting on terms names its vesting terms
const publishedVestingMissingTerms: StockSecurityState['vesting'] = { kind: 'on_terms' };
if (publishedApplied.ok) {
  const appliedQuantity: string = publishedApplied.value.quantity;
  void appliedQuantity;
} else {
  const refusal: string = publishedApplied.message;
  void refusal;
}

void publishedDerivedId;
void publishedClaimStep;
void publishedOutputsCheck;
void publishedFloor;
void publishedUnits;
void publishedCap;
void publishedVestingIsTagged;
void publishedVestingMissingTerms;

// ── Register reader and key index ──────────────────────────────────────────────────────────────────────────────

declare const publishedLedger: LedgerJsonApiClient;
declare const publishedIndex: register.RegisterIndex;
declare const publishedResponse: SubmitAndWaitForTransactionResponse;

const publishedSnapshot: Promise<register.RegisterSnapshot> = register.readRegister(publishedLedger, {
  readAs: 'issuer::1220',
  capTableId: 'test-1',
  retainPayloads: false,
  onContract: async (contract: AdmittedRegisterContract) => {
    if (contract.kind === 'record' && contract.contract.entityType === 'stockIssuance') {
      const quantity: string | undefined = contract.contract.data?.quantity;
      void quantity;
    }
    await Promise.resolve();
  },
});
// @ts-expect-error the reader reads as one party
void register.readRegister(publishedLedger, { readAs: ['issuer::1220'] });
const publishedViaClient: Promise<register.RegisterSnapshot> = new OcpClient({
  ledger: publishedLedger,
}).OpenCapTable.register.read({ readAs: 'issuer::1220' });
const publishedCapTables: Promise<register.FoundCapTables> = register.findCapTables(publishedLedger, {
  party: 'issuer::1220',
});
const publishedIndexRecord: RegisterRecord | null = publishedIndex.record('ID-1');
if (publishedIndexRecord?.entityType === 'stakeholder' && publishedIndexRecord.data !== null) {
  const stakeholderType: string = publishedIndexRecord.data.stakeholder_type;
  void stakeholderType;
}
const publishedFlags: RegisterIndexFlag[] = publishedIndex.flags();
const publishedHolds: RegisterOpenHold[] = publishedIndex.openHolds('S-A1', '2025-01-10');
const publishedQuantity: string = publishedIndex.currentQuantity('S-A1', '2025-01-10');
// A ledger-effects transaction from the Ledger API client applies as it is.
const publishedApplyResult: RegisterTransactionResult = publishedIndex.applyTransaction(publishedResponse.transaction);
const publishedRejections: RegisterRejectedContract[] = publishedApplyResult.rejected;
const publishedFormat: register.RegisterEventFormat = register.registerEventFormat('issuer::1220');

void publishedSnapshot;
void publishedViaClient;
void publishedCapTables;
void publishedFlags;
void publishedHolds;
void publishedQuantity;
void publishedRejections;
void publishedFormat;
