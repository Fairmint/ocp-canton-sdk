/** Compile the installed-package surface through package.json exports, not a direct dist path. */
import type {
  CantonOcfDataEntry,
  CantonOcfDataMap,
  EnvironmentConfigInput,
  NonLocalOAuth2EnvironmentConfigInput,
  OcfManifest,
  OcfObject,
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
void packageOAuth2CredentialsStayRequired;
void packageSharedSecretEnvironmentsStayExact;
void packageMainNetNeverSupportsSharedSecret;
void packageCantonEntry;
void packageReplicationDiff;
