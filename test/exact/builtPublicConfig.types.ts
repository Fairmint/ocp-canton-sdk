import {
  ENVIRONMENT_PRESETS,
  OcpNetworkError,
  type AuthorizeIssuerParams,
  type CommandContext,
  type EnvironmentConfig,
  type EnvironmentConfigInput,
  type OcpClient,
  type OcpClientDependencies,
  type OcpClientEnvOptions,
  type OcpClientHostedPresetOptions,
  type OcpClientLocalNetOptions,
  type OcpValidationError,
  type ValidationResult,
} from '../../dist';

type IsOptional<T, Key extends keyof T> = {} extends Pick<T, Key> ? true : false;

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
const clientValidatorIsRequired: IsOptional<OcpClient, 'validator'> = false;
const clientFactoryIsRequired: IsOptional<OcpClient, 'factory'> = false;
const clientEnvironmentIsRequired: IsOptional<OcpClient, 'environment'> = false;
const errorStatusCodeIsRequired: IsOptional<OcpNetworkError, 'statusCode'> = false;
const validationReceivedValueIsRequired: IsOptional<OcpValidationError, 'receivedValue'> = false;
declare const validationError: OcpValidationError;
const validationReceivedValue: unknown = validationError.receivedValue;
// @ts-expect-error Built nested trace identifiers remain omission-only.
const explicitUndefinedTraceId: CommandContext = { traceContext: { traceId: undefined } };
// @ts-expect-error Built nested span identifiers remain omission-only.
const explicitUndefinedSpanId: CommandContext = { traceContext: { spanId: undefined } };
// @ts-expect-error Built nested parent span identifiers remain omission-only.
const explicitUndefinedParentSpanId: CommandContext = { traceContext: { parentSpanId: undefined } };

// @ts-expect-error Built environment inputs preserve omission-only properties.
const explicitUndefinedInput: EnvironmentConfigInput = { environment: 'localnet', ledgerApiUrl: undefined };
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

void validator;
void factory;
void environment;
void validAuthorization;
void localNetInput;
void localNetOAuthOptions;
void hostedOptions;
void clientValidatorIsRequired;
void clientFactoryIsRequired;
void clientEnvironmentIsRequired;
void errorStatusCodeIsRequired;
void validationReceivedValueIsRequired;
void validationReceivedValue;
void explicitUndefinedTraceId;
void explicitUndefinedSpanId;
void explicitUndefinedParentSpanId;
void explicitUndefinedInput;
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
