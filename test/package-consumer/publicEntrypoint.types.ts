/** Compile the installed-package surface through package.json exports, not a direct dist path. */
import type {
  EnvironmentConfigInput,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfObject,
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockReissuance,
  OcfStockRepurchase,
  OcfWarrantExercise,
  OcpClient,
  OcpValidationError,
  SubmitAndWaitForTransactionTreeResponse,
} from '@open-captable-protocol/canton';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<Left, Right> =
  IsAny<Left> extends true
    ? false
    : IsAny<Right> extends true
      ? false
      : [Left] extends [Right]
        ? [Right] extends [Left]
          ? true
          : false
        : false;
type EveryTrue<T extends readonly boolean[]> = Exclude<T[number], true> extends never ? true : false;

declare const client: OcpClient;
declare const environmentInput: EnvironmentConfigInput;
declare const ocfObject: OcfObject;
declare const validationError: OcpValidationError;
declare const transactionResponse: SubmitAndWaitForTransactionTreeResponse;

const packageEntryPointExposesValidationValue: unknown = validationError.receivedValue;
const packageEntryPointExposesTransactionTree: SubmitAndWaitForTransactionTreeResponse['transactionTree'] =
  transactionResponse.transactionTree;

interface ExactOptionalCompilerProbe {
  readonly value?: string;
}

const omittedOptionalProperty: ExactOptionalCompilerProbe = {};
// @ts-expect-error Package-consumer checks must run with exactOptionalPropertyTypes enabled.
const explicitUndefinedOptionalProperty: ExactOptionalCompilerProbe = { value: undefined };

declare const indexedStrings: readonly string[];
// @ts-expect-error Package-consumer checks must run with noUncheckedIndexedAccess enabled.
const uncheckedIndexedString: string = indexedStrings[0];

const packageEntryPointKeepsEnvironmentDiscriminant: Assert<
  IsExactly<
    EnvironmentConfigInput['environment'],
    'localnet' | 'scratchnet' | 'devnet' | 'testnet' | 'staging' | 'mainnet' | 'custom'
  >
> = true;

const convertibleRead = client.OpenCapTable.convertibleConversion.get({ contractId: 'contract-id' });
const stockRead = client.OpenCapTable.stockConversion.get({ contractId: 'contract-id' });
const equityExerciseRead = client.OpenCapTable.getByObjectType({
  objectType: 'TX_EQUITY_COMPENSATION_EXERCISE',
  contractId: 'contract-id',
});
const warrantExerciseRead = client.OpenCapTable.getByObjectType({
  objectType: 'TX_WARRANT_EXERCISE',
  contractId: 'contract-id',
});
const corporateRatioRead = client.OpenCapTable.stockClassConversionRatioAdjustment.get({ contractId: 'contract-id' });
const corporateSplitRead = client.OpenCapTable.stockClassSplit.get({ contractId: 'contract-id' });
const corporateConsolidationRead = client.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_CONSOLIDATION',
  contractId: 'contract-id',
});
const corporateReissuanceRead = client.OpenCapTable.getByObjectType({
  objectType: 'TX_STOCK_REISSUANCE',
  contractId: 'contract-id',
});
const corporateRepurchaseRead = client.OpenCapTable.stockRepurchase.get({ contractId: 'contract-id' });
const stakeholderRelationshipRead = client.OpenCapTable.stakeholderRelationshipChangeEvent.get({
  contractId: 'contract-id',
});
const stakeholderStatusRead = client.OpenCapTable.getByObjectType({
  objectType: 'CE_STAKEHOLDER_STATUS',
  contractId: 'contract-id',
});
const packageConversionExerciseReadersAreExact: Assert<
  IsExactly<Awaited<typeof convertibleRead>['data'], OcfConvertibleConversion>
> = true;
const packageStockReaderIsExact: Assert<IsExactly<Awaited<typeof stockRead>['data'], OcfStockConversion>> = true;
const packageEquityExerciseReaderIsExact: Assert<
  IsExactly<Awaited<typeof equityExerciseRead>['data'], OcfEquityCompensationExercise>
> = true;
const packageWarrantExerciseReaderIsExact: Assert<
  IsExactly<Awaited<typeof warrantExerciseRead>['data'], OcfWarrantExercise>
> = true;
const packageEmptyConvertibleResults: OcfConvertibleConversion['resulting_security_ids'] = [];
const packageEmptyStockResults: OcfStockConversion['resulting_security_ids'] = [];
const packageEmptyEquityResults: OcfEquityCompensationExercise['resulting_security_ids'] = [];
const packageEmptyWarrantResults: OcfWarrantExercise['resulting_security_ids'] = [];
const packageCorporateReadersAreExact: Assert<
  EveryTrue<
    [
      IsExactly<Awaited<typeof corporateRatioRead>['data'], OcfStockClassConversionRatioAdjustment>,
      IsExactly<Awaited<typeof corporateSplitRead>['data'], OcfStockClassSplit>,
      IsExactly<Awaited<typeof corporateConsolidationRead>['data'], OcfStockConsolidation>,
      IsExactly<Awaited<typeof corporateReissuanceRead>['data'], OcfStockReissuance>,
      IsExactly<Awaited<typeof corporateRepurchaseRead>['data'], OcfStockRepurchase>,
    ]
  >
> = true;
const packageStakeholderEventReadersAreExact: Assert<
  EveryTrue<
    [
      IsExactly<Awaited<typeof stakeholderRelationshipRead>['data'], OcfStakeholderRelationshipChangeEvent>,
      IsExactly<Awaited<typeof stakeholderStatusRead>['data'], OcfStakeholderStatusChangeEvent>,
    ]
  >
> = true;
type PackageRelationshipReaderData = Awaited<typeof stakeholderRelationshipRead>['data'];
type PackageStatusReaderData = Awaited<typeof stakeholderStatusRead>['data'];
const packageStakeholderEventTypesAreNotAny: Assert<
  EveryTrue<
    [
      IsExactly<IsAny<OcfStakeholderRelationshipChangeEvent>, false>,
      IsExactly<IsAny<OcfStakeholderStatusChangeEvent>, false>,
      IsExactly<IsAny<PackageRelationshipReaderData>, false>,
      IsExactly<IsAny<PackageStatusReaderData>, false>,
      IsExactly<IsAny<OcfStakeholderRelationshipChangeEvent['relationship_started']>, false>,
      IsExactly<IsAny<OcfStakeholderRelationshipChangeEvent['relationship_ended']>, false>,
      IsExactly<IsAny<OcfStakeholderStatusChangeEvent['new_status']>, false>,
      IsExactly<IsAny<PackageRelationshipReaderData['relationship_started']>, false>,
      IsExactly<IsAny<PackageRelationshipReaderData['relationship_ended']>, false>,
      IsExactly<IsAny<PackageStatusReaderData['new_status']>, false>,
    ]
  >
> = true;
const packageFirstConsolidationSource: string = (null as unknown as OcfStockConsolidation).security_ids[0];
const packageFirstReissuanceResult: string | undefined = (null as unknown as OcfStockReissuance)
  .resulting_security_ids[0];
const packageEmptyReissuanceResults: OcfStockReissuance['resulting_security_ids'] = [];
// @ts-expect-error package-root consolidation sources are statically non-empty
const packageEmptyConsolidationSources: OcfStockConsolidation['security_ids'] = [];

void client;
void environmentInput;
void ocfObject;
void packageEntryPointExposesValidationValue;
void packageEntryPointExposesTransactionTree;
void omittedOptionalProperty;
void explicitUndefinedOptionalProperty;
void uncheckedIndexedString;
void packageEntryPointKeepsEnvironmentDiscriminant;
void convertibleRead;
void stockRead;
void equityExerciseRead;
void warrantExerciseRead;
void packageConversionExerciseReadersAreExact;
void packageStockReaderIsExact;
void packageEquityExerciseReaderIsExact;
void packageWarrantExerciseReaderIsExact;
void packageEmptyConvertibleResults;
void packageEmptyStockResults;
void packageEmptyEquityResults;
void packageEmptyWarrantResults;
void corporateRatioRead;
void corporateSplitRead;
void corporateConsolidationRead;
void corporateReissuanceRead;
void corporateRepurchaseRead;
void packageCorporateReadersAreExact;
void stakeholderRelationshipRead;
void stakeholderStatusRead;
void packageStakeholderEventReadersAreExact;
void packageStakeholderEventTypesAreNotAny;
void packageFirstConsolidationSource;
void packageFirstReissuanceResult;
void packageEmptyReissuanceResults;
void packageEmptyConsolidationSources;
