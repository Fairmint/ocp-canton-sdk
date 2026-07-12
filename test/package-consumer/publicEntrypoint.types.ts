/** Compile the installed-package surface through package.json exports, not a direct dist path. */
import type {
  EnvironmentConfigInput,
  OcfObject,
  OcpClient,
  OcpValidationError,
  SubmitAndWaitForTransactionTreeResponse,
} from '@open-captable-protocol/canton';
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

void client;
void environmentInput;
void ocfObject;
void packageEntryPointExposesValidationValue;
void packageEntryPointExposesTransactionTree;
void omittedOptionalProperty;
void explicitUndefinedOptionalProperty;
void uncheckedIndexedString;
void packageEntryPointKeepsEnvironmentDiscriminant;
void packageExactnessRejectsCompilerAny;
void packageExactnessRejectsNestedCompilerAny;
