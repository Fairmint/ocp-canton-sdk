import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type {
  OcpClientDependencies,
  OcpClientEnvOptions,
  OcpClientHostedPresetOptions,
  OcpClientLocalNetOptions,
  OcpFactoryCoordinates,
} from '../../src/clientOptions';
import type {
  EnvironmentConfig,
  EnvironmentConfigInput,
  NonLocalOAuth2EnvironmentConfigInput,
  OcpEnvironment,
  SharedSecretEnvironmentConfigInput,
} from '../../src/environment';
import { OcpNetworkError, type OcpValidationError } from '../../src/errors';
import type { AuthorizeIssuerParams } from '../../src/functions/OpenCapTable/issuerAuthorization/types';

type IsOptional<T, Key extends keyof T> = {} extends Pick<T, Key> ? true : false;
type Assert<T extends true> = T;
type IsExactly<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

interface RequiredOAuth2Credentials {
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

const sourceOAuth2CredentialsStayRequired: Assert<
  IsExactly<Pick<NonLocalOAuth2EnvironmentConfigInput, keyof RequiredOAuth2Credentials>, RequiredOAuth2Credentials>
> = true;
const sourceSharedSecretEnvironmentsStayExact: Assert<
  IsExactly<SharedSecretEnvironmentConfigInput['environment'], Exclude<OcpEnvironment, 'localnet' | 'mainnet'>>
> = true;
const sourceMainNetNeverSupportsSharedSecret: Assert<
  IsExactly<Extract<SharedSecretEnvironmentConfigInput['environment'], 'mainnet'>, never>
> = true;

declare const ledger: LedgerJsonApiClient;
declare const resolved: EnvironmentConfig;

const oauthInput: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};

const sharedSecretInput: EnvironmentConfigInput = {
  environment: 'custom',
  ledgerApiUrl: 'https://ledger.example.com',
  authMode: 'shared-secret',
  sharedSecret: 'secret',
};

const localNetInput: EnvironmentConfigInput = { environment: 'localnet' };
const localNetOAuthInput: EnvironmentConfigInput = {
  environment: 'localnet',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const localNetOAuthOptions: OcpClientLocalNetOptions = {
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const hostedOptions: OcpClientHostedPresetOptions = {
  ledgerApiUrl: 'https://ledger.mainnet.example.com',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const dependencies: OcpClientDependencies = { ledger };
const factory: OcpFactoryCoordinates = { contractId: 'factory-cid', templateId: 'factory-tid' };
const authorization: AuthorizeIssuerParams = { issuer: 'issuer::party', factory };
const resolvedValidatorUrlIsRequired: IsOptional<EnvironmentConfig, 'validatorApiUrl'> = false;
const errorEndpointIsRequired: IsOptional<OcpNetworkError, 'endpoint'> = false;
const validationReceivedValueIsRequired: IsOptional<OcpValidationError, 'receivedValue'> = false;
declare const validationError: OcpValidationError;
const validationReceivedValue: unknown = validationError.receivedValue;

const optionalValidatorUrl: string | undefined = resolved.validatorApiUrl;
if (resolved.authMode === 'oauth2') {
  const { clientSecret, sharedSecret } = resolved;
  const oauthCredentials: readonly [string, undefined] = [clientSecret, sharedSecret];
  void oauthCredentials;
} else {
  const { sharedSecret, authUrl } = resolved;
  const sharedSecretCredentials: readonly [string, undefined] = [sharedSecret, authUrl];
  void sharedSecretCredentials;
}

// @ts-expect-error OAuth2 authUrl is required when every other field is valid.
const missingOAuthAuthUrl: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error OAuth2 clientId is required when every other field is valid.
const missingOAuthClientId: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientSecret: 'client-secret',
};
// @ts-expect-error OAuth2 clientSecret is required when every other field is valid.
const missingOAuthClientSecret: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
};
// @ts-expect-error MainNet cannot use shared-secret authentication.
const mainnetSharedSecret: EnvironmentConfigInput = {
  environment: 'mainnet',
  ledgerApiUrl: 'https://ledger.mainnet.example.com',
  authMode: 'shared-secret',
  sharedSecret: 'secret',
};
// @ts-expect-error Non-LocalNet OAuth2 input requires an explicit ledger endpoint.
const missingOAuthLedger: EnvironmentConfigInput = {
  environment: 'devnet',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error Non-LocalNet shared-secret input requires an explicit ledger endpoint.
const missingSharedSecretLedger: EnvironmentConfigInput = {
  environment: 'custom',
  authMode: 'shared-secret',
  sharedSecret: 'secret',
};
// @ts-expect-error Hosted client factories require an explicit ledger endpoint.
const missingHostedLedger: OcpClientHostedPresetOptions = {
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error Optional input properties are omission-only with exact optional semantics.
const explicitUndefinedInput: EnvironmentConfigInput = { environment: 'localnet', ledgerApiUrl: undefined };
// @ts-expect-error Environment overrides reject explicit undefined.
const explicitUndefinedOverride: OcpClientEnvOptions = { clientId: undefined };
// @ts-expect-error Injected optional dependencies reject explicit undefined.
const explicitUndefinedDependency: OcpClientDependencies = { ledger, validator: undefined };
// @ts-expect-error Factory coordinates are atomic and both members are required.
const incompleteFactory: OcpFactoryCoordinates = { contractId: 'factory-cid' };
// @ts-expect-error Authorization factory overrides are omission-only.
const explicitUndefinedFactory: AuthorizeIssuerParams = { issuer: 'issuer::party', factory: undefined };
// @ts-expect-error Observability options are omission-only.
const explicitUndefinedLogger: AuthorizeIssuerParams = { issuer: 'issuer::party', logger: undefined };
// @ts-expect-error Legacy split factory fields are not part of the authorization API.
const legacyFactory: AuthorizeIssuerParams = { issuer: 'issuer::party', factoryContractId: 'factory-cid' };
// @ts-expect-error Error option properties are omission-only.
const explicitUndefinedErrorOption = new OcpNetworkError('unreachable', { endpoint: undefined });

void oauthInput;
void sharedSecretInput;
void localNetInput;
void localNetOAuthInput;
void localNetOAuthOptions;
void hostedOptions;
void dependencies;
void authorization;
void resolvedValidatorUrlIsRequired;
void errorEndpointIsRequired;
void validationReceivedValueIsRequired;
void validationReceivedValue;
void optionalValidatorUrl;
void sourceOAuth2CredentialsStayRequired;
void sourceSharedSecretEnvironmentsStayExact;
void sourceMainNetNeverSupportsSharedSecret;
void missingOAuthAuthUrl;
void missingOAuthClientId;
void missingOAuthClientSecret;
void mainnetSharedSecret;
void missingOAuthLedger;
void missingSharedSecretLedger;
void missingHostedLedger;
void explicitUndefinedInput;
void explicitUndefinedOverride;
void explicitUndefinedDependency;
void incompleteFactory;
void explicitUndefinedFactory;
void explicitUndefinedLogger;
void legacyFactory;
void explicitUndefinedErrorOption;
