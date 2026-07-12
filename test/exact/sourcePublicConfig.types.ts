import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type {
  OcpClientDependencies,
  OcpClientEnvOptions,
  OcpClientHostedPresetOptions,
  OcpClientLocalNetOptions,
  OcpFactoryCoordinates,
} from '../../src/clientOptions';
import {
  ENVIRONMENT_PRESETS,
  type EnvironmentConfig,
  type EnvironmentConfigInput,
  type ValidationResult,
} from '../../src/environment';
import { OcpNetworkError, type OcpValidationError } from '../../src/errors';
import type { AuthorizeIssuerParams } from '../../src/functions/OpenCapTable/issuerAuthorization/types';
import { applyCommandContext, type AppliedCommandContext } from '../../src/observability';
import type { CommandContext, OcpObservabilityOptions } from '../../src/observabilityTypes';

type IsOptional<T, Key extends keyof T> = {} extends Pick<T, Key> ? true : false;

declare const ledger: LedgerJsonApiClient;
declare const resolved: EnvironmentConfig;
declare const validationResult: ValidationResult;
declare const observability: OcpObservabilityOptions;
declare const immutableDefaultContext: CommandContext;
declare const immutableTraceMetadata: NonNullable<NonNullable<typeof immutableDefaultContext.traceContext>['metadata']>;

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

// @ts-expect-error OAuth2 credentials are required in the OAuth2 branch.
const incompleteOAuth: EnvironmentConfigInput = { environment: 'devnet', authMode: 'oauth2' };
// @ts-expect-error MainNet cannot use shared-secret authentication.
const mainnetSharedSecret: EnvironmentConfigInput = {
  environment: 'mainnet',
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
// @ts-expect-error Resolved managed parties are immutable snapshots.
resolved.managedParties?.push('mutated::party');
// @ts-expect-error Resolved state exposes only canonical partyId, not the party input alias.
resolved.party;
// @ts-expect-error Validation diagnostics are immutable snapshots.
validationResult.errors.push('mutated');
// @ts-expect-error Exported preset mappings cannot be replaced.
ENVIRONMENT_PRESETS.localnet = { environment: 'localnet', authMode: 'shared-secret' };
// @ts-expect-error Client observability options are immutable after construction.
observability.defaultContext = { workflowId: 'mutated' };
// @ts-expect-error Default command context fields are immutable.
immutableDefaultContext.workflowId = 'mutated';
// @ts-expect-error Nested trace metadata is immutable.
immutableTraceMetadata.tenant = 'mutated';
// @ts-expect-error A plain submit result does not promise prototype-only input members.
appliedCommandContext.helper;
// @ts-expect-error Applied command-context fields are immutable.
appliedCommandContext.workflowId = 'mutated';
// @ts-expect-error Applied optional context properties are omission-only.
const explicitUndefinedAppliedContext: AppliedCommandContext = { commands: [], workflowId: undefined };
const explicitUndefinedAppliedTraceId: AppliedCommandContext = {
  commands: [],
  // @ts-expect-error Nested trace identifiers are omission-only too.
  traceContext: { traceId: undefined },
};

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
void incompleteOAuth;
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
void validationResult;
void observability;
void immutableDefaultContext;
void immutableTraceMetadata;
void appliedWorkflowId;
void appliedCommands;
void appliedActAs;
void appliedReadAs;
void appliedContextContract;
void explicitUndefinedAppliedContext;
void explicitUndefinedAppliedTraceId;
