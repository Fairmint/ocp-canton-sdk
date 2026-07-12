/** Compile the installed-package surface through package.json exports, not a direct dist path. */
import type {
  DeepReadonly,
  EnvironmentConfigInput,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfObject,
  OcfStockConversion,
  OcfWarrantExercise,
  OcpClient,
  OcpValidationError,
  SubmitAndWaitForTransactionTreeResponse,
} from '@open-captable-protocol/canton';

type Assert<T extends true> = T;
type IsExactly<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

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
void packageReadonlyConvertible;
