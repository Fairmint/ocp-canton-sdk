import {
  ENVIRONMENT_PRESETS,
  OcpNetworkError,
  applyCommandContext,
  type AppliedCommandContext,
  type AuthorizeIssuerParams,
  type CommandContext,
  type EnvironmentConfig,
  type EnvironmentConfigInput,
  type NonLocalOAuth2EnvironmentConfigInput,
  type OcpClient,
  type OcpClientDependencies,
  type OcpClientEnvOptions,
  type OcpClientHostedPresetOptions,
  type OcpClientLocalNetOptions,
  type OcpEnvironment,
  type OcpValidationError,
  type SharedSecretEnvironmentConfigInput,
  type ValidationResult,
} from '../../dist';

type IsOptional<T, Key extends keyof T> = {} extends Pick<T, Key> ? true : false;
type Assert<T extends true> = T;
type IsExactly<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

interface RequiredOAuth2Credentials {
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

const builtOAuth2CredentialsStayRequired: Assert<
  IsExactly<Pick<NonLocalOAuth2EnvironmentConfigInput, keyof RequiredOAuth2Credentials>, RequiredOAuth2Credentials>
> = true;
const builtSharedSecretEnvironmentsStayExact: Assert<
  IsExactly<SharedSecretEnvironmentConfigInput['environment'], Exclude<OcpEnvironment, 'localnet' | 'mainnet'>>
> = true;
const builtMainNetNeverSupportsSharedSecret: Assert<
  IsExactly<Extract<SharedSecretEnvironmentConfigInput['environment'], 'mainnet'>, never>
> = true;

declare const client: OcpClient;
declare const dependencies: OcpClientDependencies;
declare const resolved: EnvironmentConfig;
declare const validationResult: ValidationResult;
declare const immutableDefaultContext: NonNullable<OcpClient['observability']['defaultContext']>;
declare const immutableTraceMetadata: NonNullable<NonNullable<typeof immutableDefaultContext.traceContext>['metadata']>;

const { validator, factory, environment } = client;
const validAuthorization: AuthorizeIssuerParams = {
  issuer: 'issuer::party',
  factory: { contractId: 'factory-cid', templateId: 'factory-tid' },
};
const localNetInput: EnvironmentConfigInput = { environment: 'localnet' };
const localNetOAuthOptions: OcpClientLocalNetOptions = {
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const hostedOptions: OcpClientHostedPresetOptions = {
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const stagingInput: EnvironmentConfigInput = {
  environment: 'staging',
  ledgerApiUrl: 'https://ledger.staging.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
const stagingFactoryOptions: Parameters<typeof import('../../dist').OcpClient.forStaging>[0] = hostedOptions;
const clientValidatorIsRequired: IsOptional<OcpClient, 'validator'> = false;
const clientFactoryIsRequired: IsOptional<OcpClient, 'factory'> = false;
const clientEnvironmentIsRequired: IsOptional<OcpClient, 'environment'> = false;
const errorStatusCodeIsRequired: IsOptional<OcpNetworkError, 'statusCode'> = false;
const validationReceivedValueIsRequired: IsOptional<OcpValidationError, 'receivedValue'> = false;
declare const validationError: OcpValidationError;
const validationReceivedValue: unknown = validationError.receivedValue;
class SubmitParamsWithHelper {
  get commands(): never[] {
    return [];
  }

  get actAs(): string[] {
    return ['issuer::party'];
  }

  get readAs(): string[] {
    return ['reader::party'];
  }

  helper(): string {
    return 'prototype-only';
  }
}
const appliedCommandContext = applyCommandContext(new SubmitParamsWithHelper(), {
  context: { workflowId: 'workflow-from-context' },
});
const appliedWorkflowId: string | undefined = appliedCommandContext.workflowId;
const appliedCommands = appliedCommandContext.commands;
const appliedActAs: string[] | undefined = appliedCommandContext.actAs;
const appliedReadAs: string[] | undefined = appliedCommandContext.readAs;
const appliedContextContract: AppliedCommandContext = appliedCommandContext;
// @ts-expect-error Built nested trace identifiers remain omission-only.
const explicitUndefinedTraceId: CommandContext = { traceContext: { traceId: undefined } };
// @ts-expect-error Built nested span identifiers remain omission-only.
const explicitUndefinedSpanId: CommandContext = { traceContext: { spanId: undefined } };
// @ts-expect-error Built nested parent span identifiers remain omission-only.
const explicitUndefinedParentSpanId: CommandContext = { traceContext: { parentSpanId: undefined } };

// @ts-expect-error Built environment inputs preserve omission-only properties.
const explicitUndefinedInput: EnvironmentConfigInput = { environment: 'localnet', ledgerApiUrl: undefined };
// @ts-expect-error Built OAuth2 authUrl is required when every other field is valid.
const missingOAuthAuthUrl: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error Built OAuth2 clientId is required when every other field is valid.
const missingOAuthClientId: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientSecret: 'client-secret',
};
// @ts-expect-error Built OAuth2 clientSecret is required when every other field is valid.
const missingOAuthClientSecret: EnvironmentConfigInput = {
  environment: 'devnet',
  ledgerApiUrl: 'https://ledger.devnet.example.com',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
};
// @ts-expect-error Built MainNet inputs cannot use shared-secret authentication.
const mainnetSharedSecret: EnvironmentConfigInput = {
  environment: 'mainnet',
  ledgerApiUrl: 'https://ledger.mainnet.example.com',
  authMode: 'shared-secret',
  sharedSecret: 'secret',
};
// @ts-expect-error Built non-LocalNet OAuth2 input requires an explicit ledger endpoint.
const missingOAuthLedger: EnvironmentConfigInput = {
  environment: 'devnet',
  authMode: 'oauth2',
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error Built non-LocalNet shared-secret input requires an explicit ledger endpoint.
const missingSharedSecretLedger: EnvironmentConfigInput = {
  environment: 'custom',
  authMode: 'shared-secret',
  sharedSecret: 'secret',
};
// @ts-expect-error Built hosted client options require an explicit ledger endpoint.
const missingHostedLedger: OcpClientHostedPresetOptions = {
  authUrl: 'https://auth.example.com/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
};
// @ts-expect-error Built env overrides preserve omission-only properties.
const explicitUndefinedOverride: OcpClientEnvOptions = { factory: undefined };
// @ts-expect-error Built dependency declarations preserve omission-only properties.
const explicitUndefinedDependency: OcpClientDependencies = { ledger: dependencies.ledger, environment: undefined };
// @ts-expect-error Built authorization declarations expose only an atomic factory override.
const partialAuthorization: AuthorizeIssuerParams = { issuer: 'issuer::party', factory: { contractId: 'cid' } };
// @ts-expect-error Built error options reject explicit undefined.
const explicitUndefinedErrorOption = new OcpNetworkError('unreachable', { statusCode: undefined });
// @ts-expect-error Built resolved managed parties are immutable snapshots.
resolved.managedParties?.push('mutated::party');
// @ts-expect-error Built resolved state omits the party input alias.
resolved.party;
// @ts-expect-error Built validation diagnostics are immutable snapshots.
validationResult.warnings.push('mutated');
// @ts-expect-error Built preset mappings cannot be replaced.
ENVIRONMENT_PRESETS.localnet = { environment: 'localnet', authMode: 'shared-secret' };
// @ts-expect-error Built client observability options are immutable.
client.observability.defaultContext = { workflowId: 'mutated' };
// @ts-expect-error Built default command context fields are immutable.
immutableDefaultContext.workflowId = 'mutated';
// @ts-expect-error Built nested trace metadata is immutable.
immutableTraceMetadata.tenant = 'mutated';
// @ts-expect-error Built plain submit results do not promise prototype-only input members.
appliedCommandContext.helper;
// @ts-expect-error Built applied command-context fields are immutable.
appliedCommandContext.workflowId = 'mutated';
// @ts-expect-error Built applied optional context properties are omission-only.
const explicitUndefinedAppliedContext: AppliedCommandContext = { commands: [], workflowId: undefined };
const explicitUndefinedAppliedTraceId: AppliedCommandContext = {
  commands: [],
  // @ts-expect-error Built nested trace identifiers are omission-only too.
  traceContext: { traceId: undefined },
};

void validator;
void factory;
void environment;
void validAuthorization;
void localNetInput;
void localNetOAuthOptions;
void hostedOptions;
void stagingInput;
void stagingFactoryOptions;
void clientValidatorIsRequired;
void clientFactoryIsRequired;
void clientEnvironmentIsRequired;
void errorStatusCodeIsRequired;
void validationReceivedValueIsRequired;
void validationReceivedValue;
void builtOAuth2CredentialsStayRequired;
void builtSharedSecretEnvironmentsStayExact;
void builtMainNetNeverSupportsSharedSecret;
void explicitUndefinedTraceId;
void explicitUndefinedSpanId;
void explicitUndefinedParentSpanId;
void explicitUndefinedInput;
void missingOAuthAuthUrl;
void missingOAuthClientId;
void missingOAuthClientSecret;
void mainnetSharedSecret;
void missingOAuthLedger;
void missingSharedSecretLedger;
void missingHostedLedger;
void explicitUndefinedOverride;
void explicitUndefinedDependency;
void partialAuthorization;
void explicitUndefinedErrorOption;
void resolved;
void validationResult;
void immutableDefaultContext;
void immutableTraceMetadata;
void appliedWorkflowId;
void appliedCommands;
void appliedActAs;
void appliedReadAs;
void appliedContextContract;
void explicitUndefinedAppliedContext;
void explicitUndefinedAppliedTraceId;
