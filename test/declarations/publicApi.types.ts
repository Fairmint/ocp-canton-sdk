/* eslint @typescript-eslint/no-redundant-type-constituents: off */
/** Compile-time smoke tests for declarations exported by the built SDK. */

import {
  CapTableApply,
  CapTableRestate,
  OcpClient,
  OcpContextManager,
  OcpErrorCodes,
  OcpValidationError,
  assertOpenCapTableV35Network,
  buildApplyCommand,
  buildCancelHoldsCommand,
  buildPlaceHoldsCommand,
  buildPurgeCommand,
  buildSettleCommand,
  findSettleResults,
  readApplyResult,
  readPlaceHoldsResult,
  readSettleResult,
  register,
  resolveFactoryIdentity,
  type AcceptIssuerAuthorizationResult,
  type AdmittedRegisterContract,
  type ApplyOperation,
  type AuthorizeIssuerResult,
  type BatchPlan,
  type BookInputs,
  type BookWrite,
  type BookWriteExecuteResult,
  type BookWriteResult,
  type BundledOcpFactoryIdentities,
  type CapTableCommand,
  type CapTableWriteError,
  type ClaimedShards,
  type ConversionTriggerFor,
  type ConvertibleConversionRight,
  type ConvertibleConversionTrigger,
  type CreateCapTableCommand,
  type CreateCapTableResult,
  type CreateFactoryResult,
  type DeliveredTerms,
  type InstrumentState,
  type IssuerAuthorizationRef,
  type IssuerDataInput,
  type LedgerJsonApiClient,
  type LiveOcpFactory,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfIssuer,
  type OcfObject,
  type OcfStockAcceptance,
  type OcpFactoryIdentity,
  type OutputVesting,
  type PlaceHoldResult,
  type PlannedDraw,
  type RatioConversionMechanism,
  type ReconcileResult,
  type RecordSplitError,
  type RecordSplitResult,
  type RecordedSplit,
  type RegisterCheckError,
  type RegisterCheckResult,
  type RegisterCheckRule,
  type RegisterCheckViolation,
  type RegisterIndexFlag,
  type RegisterOpenHold,
  type RegisterRecord,
  type RegisterRejectedContract,
  type RegisterRequirement,
  type RegisterResult,
  type RegisterTransactionResult,
  type RegisterWriteError,
  type RegisterWriteSummary,
  type ReplayResult,
  type ReplayRule,
  type ReplayStep,
  type ReplayedStockState,
  type ResolvedInputs,
  type RestateOperation,
  type ScopedLock,
  type SettlementInTransaction,
  type ShardStep,
  type SplitOffender,
  type StateRestatement,
  type StockClassConversionRight,
  type StockSecurityState,
  type SubmitAndWaitForTransactionResponse,
  type UnresolvedCommand,
  type WarrantExerciseTrigger,
  type WarrantTriggerConversionRight,
  type WithdrawAuthorizationResult,
  type WriterLockProvider,
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

// ── Three-step cap table setup and the factory identity ───────────────────────────────────────────────────────────

declare const publishedAuthorization: IssuerAuthorizationRef;
declare const publishedIssuerData: IssuerDataInput;

const publishedFactoryIdentity: OcpFactoryIdentity = { factoryId: 'acme', systemOperator: 'so::1220' };
// @ts-expect-error a factory is its identity, not the v34 contract coordinates
const publishedFactoryCoordinates: OcpFactoryIdentity = { contractId: 'factory-cid', templateId: 'factory-tid' };
const publishedSetupClient = new OcpClient({ ledger: publishedLedger, factory: publishedFactoryIdentity });
const publishedResolvedFactory: OcpFactoryIdentity = resolveFactoryIdentity('devnet', publishedFactoryIdentity);
const publishedBundledIdentities: BundledOcpFactoryIdentities = {};
void resolveFactoryIdentity('devnet', undefined, publishedBundledIdentities);
assertOpenCapTableV35Network('devnet');

const publishedCreateFactory: Promise<CreateFactoryResult> = publishedSetupClient.OpenCapTable.setup.createFactory();
const publishedFindFactory: Promise<LiveOcpFactory> = publishedSetupClient.OpenCapTable.setup.findFactory();
const publishedAuthorize: Promise<AuthorizeIssuerResult> = publishedSetupClient.OpenCapTable.setup.authorizeIssuer({
  issuer: 'issuer::1220',
  transferAgent: 'ta::1220',
  factoryContractId: 'factory-cid',
});
// @ts-expect-error the factory's identity comes from the client, not from the call
void publishedSetupClient.OpenCapTable.setup.authorizeIssuer({ issuer: 'i', transferAgent: 't', factoryId: 'acme' });
const publishedAccept: Promise<AcceptIssuerAuthorizationResult> =
  publishedSetupClient.OpenCapTable.setup.acceptAuthorization({
    authorizationContractId: 'authorization-cid',
    transferAgent: 'ta::1220',
  });
const publishedCreateCapTable: CreateCapTableCommand = publishedSetupClient.OpenCapTable.setup.buildCreateCapTable({
  authorization: publishedAuthorization,
  transferAgent: 'ta::1220',
  issuerData: publishedIssuerData,
});
const publishedCreateCapTableResult: CreateCapTableResult =
  publishedSetupClient.OpenCapTable.setup.readCreateCapTableResult(publishedResponse);
const publishedWithdraw: Promise<WithdrawAuthorizationResult> =
  publishedSetupClient.OpenCapTable.setup.withdrawAuthorization({
    authorizationContractId: 'authorization-cid',
  });
// The authorization is disclosed: it carries the fields of a disclosed contract and the issuer who submits the choice
const publishedAuthorizationBlob: string = publishedAuthorization.createdEventBlob;
const publishedActAs: string[] = publishedCreateCapTable.actAs;
const publishedShardContractId: string | undefined = publishedCreateCapTableResult.shards.get('00000000');

const publishedContext = new OcpContextManager();
publishedContext.setTransferAgentParty('ta::1220');
publishedContext.setCapTableId('acme-1');
const publishedContextCapTableId: string = publishedContext.requireCapTableId();
const publishedContextTransferAgent: string = publishedContext.requireTransferAgentParty();

void publishedFactoryCoordinates;
void publishedResolvedFactory;
void publishedCreateFactory;
void publishedFindFactory;
void publishedAuthorize;
void publishedAccept;
void publishedWithdraw;
void publishedAuthorizationBlob;
void publishedActAs;
void publishedShardContractId;
void publishedContextCapTableId;
void publishedContextTransferAgent;

// ── The anchor's choices: builders, results and delivered terms ──────────────────────────────────────────────────

declare const publishedStakeholder: OcfEntityDataMap['stakeholder'];
declare const publishedIssuance: OcfEntityDataMap['stockIssuance'];
declare const publishedTransfer: OcfEntityDataMap['stockTransfer'];
declare const publishedIssuer: OcfIssuer;
declare const publishedRestated: StateRestatement;

const publishedInputs: BookInputs = {
  states: ['state-1'],
  epochs: ['epoch-1'],
  shards: ['shard-1'],
  records: [{ entityType: 'stakeholder', contractId: 'cid-1' }],
};
const publishedAnchor = { capTableContractId: 'anchor-1', transferAgent: 'ta::1220', inputs: publishedInputs };
const publishedApply: CapTableCommand = new CapTableApply(publishedAnchor)
  .create('stakeholder', publishedStakeholder)
  .stockTransfer({ transfer: publishedTransfer, resulting: [publishedIssuance], balance: null })
  .vestingSnapshot({ securityId: 'S-1', asOf: '2025-01-01', vested: '10' })
  .preSplitShard('00000000')
  .build();
// @ts-expect-error the issuer is written with the cap table and edited by CapTable_Restate
new CapTableApply(publishedAnchor).create('issuer', publishedIssuer);
// @ts-expect-error a bundled stock event is written with its output issuances, never as a plain record
const publishedPlainTransfer: ApplyOperation = { kind: 'record', type: 'stockTransfer', data: publishedTransfer };
const publishedOperations: ApplyOperation[] = [{ kind: 'preSplitShard', prefix: '00000001' }];
const publishedBuilt: CapTableCommand = buildApplyCommand(publishedAnchor, publishedOperations);
const publishedApplyCreated: BookWriteResult = readApplyResult(publishedResponse, { capTableContractId: 'anchor-1' });
const publishedRecordRef: string | undefined = publishedApplyCreated.records.get('SH-1')?.entityType;
const publishedRestate: Promise<BookWriteExecuteResult> = new CapTableRestate(publishedAnchor, publishedLedger)
  .edit('issuer', publishedIssuer)
  .setState(publishedRestated)
  .execute();
const publishedRestateOperation: RestateOperation = { kind: 'setState', state: { ...publishedRestated, seq: 3 } };
// @ts-expect-error a restated state always states accelerated_since_snapshot
const publishedUnstated: StateRestatement = { ...publishedRestated, accelerated_since_snapshot: undefined };
const publishedPlaceHolds: CapTableCommand = buildPlaceHoldsCommand({
  ...publishedAnchor,
  holdType: 'REGISTER_SETTLEMENT',
  reference: 'T-1',
  date: '2025-06-02',
  reasonText: 'Trade T-1',
  lots: [{ security_id: 'S-1', quantity: '100', origin_issuance: 'cid-ISS' }],
});
const publishedHoldResults: PlaceHoldResult[] = readPlaceHoldsResult(publishedResponse);
const publishedCancel: CapTableCommand = buildCancelHoldsCommand({
  ...publishedAnchor,
  date: '2025-06-02',
  holds: [{ security_id: 'S-1', hold_id: 'H-1', reason_text: 'released' }],
});
const publishedPurge: CapTableCommand = buildPurgeCommand({
  capTableContractId: 'anchor-1',
  systemOperator: 'so::1220',
  targets: [
    { kind: 'record', entityType: 'stakeholder', contractId: 'cid-1' },
    { kind: 'shard', contractId: 's-1' },
  ],
});

declare const publishedPlanState: StockSecurityState;
const publishedPlanned: PlannedDraw = register.planDraw({
  state: publishedPlanState,
  epochSplits: publishedSplits,
  settlementId: 'T-1',
  holdId: 'H-1',
  quantity: '750',
  sharePrice: { amount: '2', currency: 'USD' },
  customId: 'BUY-1',
  originIssuance: { contractId: 'cid-ISS', data: publishedIssuance },
  date: '2025-06-02',
  capTableId: 'test-1',
});
const publishedSettle: CapTableCommand = buildSettleCommand({
  ...publishedAnchor,
  settlementId: 'T-1',
  date: '2025-06-02',
  buyer: { kind: 'existing', contractId: 'cid-SH-B' },
  lots: [
    { kind: 'draw', lot: publishedPlanned.lot },
    { kind: 'cancel', hold: { security_id: 'S-2', hold_id: 'H-2', reason_text: 'undrawn' } },
  ],
});
const publishedTerms: DeliveredTerms = readSettleResult(publishedResponse);
const publishedFound: SettlementInTransaction[] = findSettleResults(publishedResponse.transaction);
const publishedFirstLot = publishedTerms.lots[0];
if (publishedFirstLot?.kind === 'draw') {
  const buyerState: string = publishedFirstLot.buyer_state;
  const balanceState: string | null = publishedFirstLot.balance_state;
  void buyerState;
  void balanceState;
}
const publishedViaClientApply: CapTableApply = new OcpClient({ ledger: publishedLedger }).OpenCapTable.capTable.apply(
  publishedAnchor
);
declare const publishedWriteError: CapTableWriteError;
const publishedUnknownOutcome: boolean =
  publishedWriteError.code === OcpErrorCodes.OUTCOME_UNKNOWN && !publishedWriteError.retryable;
const publishedFailedOperation: string | undefined = publishedWriteError.operations?.[0]?.kind;

void publishedApply;
void publishedPlainTransfer;
void publishedBuilt;
void publishedRecordRef;
void publishedRestate;
void publishedRestateOperation;
void publishedUnstated;
void publishedPlaceHolds;
void publishedHoldResults;
void publishedCancel;
void publishedPurge;
void publishedSettle;
void publishedFound;
void publishedViaClientApply;
void publishedUnknownOutcome;
void publishedFailedOperation;

// ── Book inputs resolution and batch sizing ───────────────────────────────────────────────────────────────────────

const publishedWrite: BookWrite = {
  kind: 'settle',
  settlementId: 'T-1',
  date: '2025-06-02',
  buyer: { kind: 'existingStakeholder', stakeholderId: 'SH-B' },
  lots: [{ kind: 'cancel', hold: { security_id: 'S-2', hold_id: 'H-2', reason_text: 'undrawn' } }],
};
const publishedResolved: ResolvedInputs = register.resolveInputs(publishedIndex, publishedWrite, { byteBudget: 1024 });
const publishedResolvedInputs: BookInputs = publishedResolved.inputs;
const publishedOrigin: string | undefined = publishedResolved.originIssuances.get('S-1');
const publishedPlan: BatchPlan = register.planBatches(publishedIndex, [
  {
    kind: 'record',
    type: 'stakeholder',
    data: { object_type: 'STAKEHOLDER', id: 'SH-1', name: { legal_name: 'One' }, stakeholder_type: 'INDIVIDUAL' },
  },
]);
const publishedFirstBatch = publishedPlan.batches[0];
if (publishedFirstBatch?.kind === 'restate') {
  const restated: RestateOperation[] = publishedFirstBatch.operations;
  void restated;
}
const publishedOverLimits: string[] = register.exceededLimits('apply', publishedResolved.usage);
const publishedRequirements: RegisterRequirement[] = register.requirementsOf('stockClassSplit', {
  object_type: 'TX_STOCK_CLASS_SPLIT',
  id: 'SPLIT-1',
  date: '2025-01-01',
  stock_class_id: 'CLS-A',
  split_ratio: { numerator: '2', denominator: '1' },
});
// @ts-expect-error an index resolves the inputs of a batch, never of an unknown write
void register.resolveInputs(publishedIndex, { kind: 'purge', targets: [] });
const publishedResolvingApply: CapTableCommand = new CapTableApply({
  capTableContractId: 'anchor-1',
  transferAgent: 'ta::1220',
  index: publishedIndex,
})
  .create('stakeholder', {
    object_type: 'STAKEHOLDER',
    id: 'SH-2',
    name: { legal_name: 'Two' },
    stakeholder_type: 'INDIVIDUAL',
  })
  .build();

void publishedResolvedInputs;
void publishedOrigin;
void publishedOverLimits;
void publishedRequirements;
void publishedResolvingApply;

// ── One writer per issuer: scoped locks and command outcomes ────────────────────────────────────────────────────

const publishedLocks: WriterLockProvider = new register.InProcessLockProvider();
const publishedWriter = new register.RegisterWriter({
  ledger: publishedLedger,
  context: publishedIndex.context,
  transferAgent: publishedIndex.context.transfer_agent,
  index: publishedIndex,
  locks: publishedLocks,
  outcome: { timeoutMs: 60_000, pollMs: 500 },
});
const publishedViaClientWriter: register.RegisterWriter = new OcpClient({
  ledger: publishedLedger,
}).OpenCapTable.register.writer({
  context: publishedIndex.context,
  transferAgent: publishedIndex.context.transfer_agent,
  index: publishedIndex,
});
const publishedScopes: ScopedLock[] = register.writeScopes(publishedIndex, publishedWrite);
const publishedSummary: Promise<RegisterWriteSummary> = publishedWriter.apply([
  {
    kind: 'record',
    type: 'stakeholder',
    data: { object_type: 'STAKEHOLDER', id: 'SH-3', name: { legal_name: 'Three' }, stakeholder_type: 'INDIVIDUAL' },
  },
]);
const publishedSubmitted: Promise<number> = publishedWriter
  .submit({
    scopes: [register.classScope('CLS-A'), { scope: 'issuer', mode: 'shared' }],
    check: (index) => {
      void index.currentQuantity('S-A1', '2025-01-10');
    },
    build: () => publishedResolvingApply,
    decode: (response) => response.transaction.offset,
  })
  .then((committed) => committed.result);
const publishedUnresolved: UnresolvedCommand[] = publishedWriter.unresolved();
const publishedReconciled: Promise<ReconcileResult> = publishedWriter.reconcile('ocp-CapTable_Apply-0', {
  assume: 'absent',
});
const publishedCommandId: string = register.registerCommandId(publishedIndex.context, publishedResolvingApply);
declare const publishedWriteFailure: RegisterWriteError;
const publishedCommittedBefore: number | undefined = publishedWriteFailure.committed?.length;
// @ts-expect-error a lock scope names one of the register's four scopes
const publishedBadScope: ScopedLock = { scope: 'stakeholder:SH-1', mode: 'exclusive' };

void publishedViaClientWriter;
void publishedScopes;
void publishedSummary;
void publishedSubmitted;
void publishedUnresolved;
void publishedReconciled;
void publishedCommandId;
void publishedCommittedBefore;
void publishedBadScope;

// ── Offline replay of a book's OCF ──────────────────────────────────────────────────────────────────────────────

const publishedReplay: ReplayResult = register.replayOcf(
  {
    issuer: null,
    stakeholders: [
      { object_type: 'STAKEHOLDER', id: 'SH-1', name: { legal_name: 'One' }, stakeholder_type: 'INDIVIDUAL' },
    ],
    stockClasses: [],
    stockPlans: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    financings: [],
    stockLegendTemplates: [],
    transactions: [],
  },
  { capTableId: 'test-1' }
);
const publishedReplayStep: ReplayStep | undefined = publishedReplay.steps[0];
const publishedReplayOperation: ApplyOperation | null | undefined = publishedReplayStep?.operation;
const publishedReplayRule: ReplayRule | undefined = publishedReplay.violations[0]?.rule;
const publishedReplayedState: ReplayedStockState | undefined = publishedReplay.states.get('S-1');
const publishedInstrument: InstrumentState | undefined = publishedReplay.instruments.get('W-1');
// @ts-expect-error a replayed state carries no context: the replay knows only the cap table ID
void publishedReplayedState?.context;

void publishedReplayOperation;
void publishedReplayRule;
void publishedInstrument;

// ── Off-ledger checks and the split procedure ───────────────────────────────────────────────────────────────────

const publishedViolations: RegisterCheckViolation[] = register.writeViolations(publishedIndex, publishedWrite, {
  today: '2026-10-23',
  ceilings: false,
});
const publishedViolationRule: RegisterCheckRule | undefined = publishedViolations[0]?.rule;
register.checkWrite(publishedIndex, publishedWrite, { today: '2026-10-23' });
// @ts-expect-error the checks need the ledger date
register.checkWrite(publishedIndex, publishedWrite, {});
declare const publishedCheckFailure: RegisterCheckError;
const publishedCheckFailures: number | undefined = publishedCheckFailure.violations?.length;
const publishedCheckedApply: Promise<RegisterWriteSummary> = publishedWriter.apply([], {
  checks: { ceilings: false },
});
const publishedUncheckedRestate: Promise<RegisterWriteSummary> = publishedWriter.restate([], { checks: false });
const publishedSession: Promise<number> = publishedWriter.session([register.classScope('CLS-A')], async (session) => {
  const committed = await session.submit({
    scopes: [register.classScope('CLS-A')],
    build: () => publishedResolvingApply,
    decode: (response) => response.transaction.offset,
  });
  await session.apply([], { checks: true });
  return committed.offset;
});
const publishedSplit: Promise<RecordSplitResult> = register.recordSplit(publishedWriter, {
  object_type: 'TX_STOCK_CLASS_SPLIT',
  id: 'SPLIT-1',
  date: '2026-11-01',
  stock_class_id: 'CLS-A',
  split_ratio: { numerator: '2', denominator: '1' },
});
const publishedOffenders: SplitOffender[] = register.splitOffenders(publishedIndex, {
  id: 'SPLIT-1',
  date: '2026-11-01',
  stock_class_id: 'CLS-A',
});
declare const publishedSplitFailure: RecordSplitError;
const publishedSplitOffenders: readonly SplitOffender[] | undefined = publishedSplitFailure.offenders;
const publishedReferrers: RegisterRecord[] = publishedIndex.referrersOf('SH-1');
const publishedNaming: RegisterRecord[] = publishedIndex.recordsNaming('S-A1');
const publishedClassStates: number = publishedIndex.statesOfClass('CLS-A').length;

void publishedViolationRule;
void publishedCheckFailures;
void publishedCheckedApply;
void publishedUncheckedRestate;
void publishedSession;
void publishedSplit;
void publishedOffenders;
void publishedSplitOffenders;
void publishedReferrers;
void publishedNaming;
void publishedClassStates;
