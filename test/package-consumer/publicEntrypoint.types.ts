/** Compile the installed-package surface through package.json exports, not a direct dist path. */
import type {
  CantonOcfDataEntry,
  CantonOcfDataMap,
  DeepReadonly,
  EnvironmentConfigInput,
  NonLocalOAuth2EnvironmentConfigInput,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfManifest,
  OcfObject,
  OcfReadDataTypeFor,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockReissuance,
  OcfWarrantExercise,
  OcpClient,
  OcpEnvironment,
  OcpValidationError,
  SharedSecretEnvironmentConfigInput,
  SourceReplicationItem,
  SubmitAndWaitForTransactionTreeResponse,
} from '@open-captable-protocol/canton';
import { buildCantonOcfDataMap, computeReplicationDiff } from '@open-captable-protocol/canton';
import type { Assert, IsExactly } from '../typeContracts/typeAssertions';

const packageExactnessRejectsCompilerAny: Assert<
  IsExactly<IsExactly<ReturnType<typeof JSON.parse>, 'canonical'>, false>
> = true;

interface NestedCompilerAny {
  readonly config: { readonly authUrl: ReturnType<typeof JSON.parse> };
}

interface NestedCanonicalConfig {
  readonly config: { readonly authUrl: string };
}

const packageExactnessRejectsNestedCompilerAny: Assert<
  IsExactly<IsExactly<NestedCompilerAny, NestedCanonicalConfig>, false>
> = true;

interface RequiredOAuth2Credentials {
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

const packageOAuth2CredentialsStayRequired: Assert<
  IsExactly<Pick<NonLocalOAuth2EnvironmentConfigInput, keyof RequiredOAuth2Credentials>, RequiredOAuth2Credentials>
> = true;
const packageSharedSecretEnvironmentsStayExact: Assert<
  IsExactly<SharedSecretEnvironmentConfigInput['environment'], Exclude<OcpEnvironment, 'localnet' | 'mainnet'>>
> = true;
const packageMainNetNeverSupportsSharedSecret: Assert<
  IsExactly<Extract<SharedSecretEnvironmentConfigInput['environment'], 'mainnet'>, never>
> = true;

declare const client: OcpClient;
declare const environmentInput: EnvironmentConfigInput;
declare const ocfObject: OcfObject;
declare const validationError: OcpValidationError;
declare const transactionResponse: SubmitAndWaitForTransactionTreeResponse;
declare const manifest: OcfManifest;
declare const sourceItems: readonly SourceReplicationItem[];
declare const cantonState: Parameters<typeof computeReplicationDiff>[1];

const packageCantonData = buildCantonOcfDataMap(manifest);
const packageCantonMap: CantonOcfDataMap = packageCantonData;
declare const packageCantonEntry: CantonOcfDataEntry<'stakeholder'>;
const packageReplicationDiff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData: packageCantonMap });

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
const packageConversionExerciseReadersAreExact: Assert<
  IsExactly<Awaited<typeof convertibleRead>['data'], DeepReadonly<OcfConvertibleConversion>>
> = true;
const packageStockReaderIsExact: Assert<
  IsExactly<Awaited<typeof stockRead>['data'], DeepReadonly<OcfStockConversion>>
> = true;
const packageEquityExerciseReaderIsExact: Assert<
  IsExactly<Awaited<typeof equityExerciseRead>['data'], DeepReadonly<OcfEquityCompensationExercise>>
> = true;
const packageWarrantExerciseReaderIsExact: Assert<
  IsExactly<Awaited<typeof warrantExerciseRead>['data'], DeepReadonly<OcfWarrantExercise>>
> = true;
// @ts-expect-error package convertible conversions require at least one resulting security
const packageEmptyConvertibleResults: OcfConvertibleConversion['resulting_security_ids'] = [];
// @ts-expect-error package stock conversions require at least one resulting security
const packageEmptyStockResults: OcfStockConversion['resulting_security_ids'] = [];
const packageEmptyEquityResults: OcfEquityCompensationExercise['resulting_security_ids'] = [];
// @ts-expect-error package warrant exercises require at least one resulting security
const packageEmptyWarrantResults: OcfWarrantExercise['resulting_security_ids'] = [];
const packageCorporateReadersAreExact: Assert<
  IsExactly<Awaited<typeof corporateRatioRead>['data'], OcfReadDataTypeFor<'stockClassConversionRatioAdjustment'>> &
    IsExactly<Awaited<typeof corporateSplitRead>['data'], OcfReadDataTypeFor<'stockClassSplit'>> &
    IsExactly<Awaited<typeof corporateConsolidationRead>['data'], OcfReadDataTypeFor<'stockConsolidation'>> &
    IsExactly<Awaited<typeof corporateReissuanceRead>['data'], OcfReadDataTypeFor<'stockReissuance'>> &
    IsExactly<Awaited<typeof corporateRepurchaseRead>['data'], OcfReadDataTypeFor<'stockRepurchase'>>
> = true;
const packageFirstConsolidationSource: string = (null as unknown as OcfStockConsolidation).security_ids[0];
const packageFirstReissuanceResult: string = (null as unknown as OcfStockReissuance).resulting_security_ids[0];
// @ts-expect-error package-root reissuance results are statically non-empty
const packageEmptyReissuanceResults: OcfStockReissuance['resulting_security_ids'] = [];
// @ts-expect-error package-root consolidation sources are statically non-empty
const packageEmptyConsolidationSources: OcfStockConsolidation['security_ids'] = [];

declare const packageReadonlyConvertible: Awaited<typeof convertibleRead>['data'];
// @ts-expect-error installed-package readers expose recursively readonly result tuples
packageReadonlyConvertible.resulting_security_ids.push('mutated');
// @ts-expect-error installed-package reader objects are readonly
packageReadonlyConvertible.reason_text = 'mutated';

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
void packageFirstConsolidationSource;
void packageFirstReissuanceResult;
void packageEmptyReissuanceResults;
void packageEmptyConsolidationSources;
void packageReadonlyConvertible;
void packageExactnessRejectsCompilerAny;
void packageExactnessRejectsNestedCompilerAny;
void packageOAuth2CredentialsStayRequired;
void packageSharedSecretEnvironmentsStayExact;
void packageMainNetNeverSupportsSharedSecret;
void packageCantonEntry;
void packageReplicationDiff;
