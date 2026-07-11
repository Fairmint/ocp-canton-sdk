import type { LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type {
  EnvironmentConfigInput,
  EnvironmentConfigOverrides,
  LocalNetEnvironmentConfigInput,
  LocalNetOAuth2EnvironmentConfigInput,
  NonLocalOAuth2EnvironmentConfigInput,
  OcpEnvironment,
} from './environment';
import type { OcpObservabilityOptions } from './observabilityTypes';

/** OCP Factory contract coordinates for custom deployments (localnet, staging, etc.). */
export interface OcpFactoryCoordinates {
  /** Contract ID of the deployed OCP Factory. */
  readonly contractId: string;
  /** Template ID of the deployed OCP Factory. */
  readonly templateId: string;
}

interface OcpClientConstructionOptions {
  /** Factory coordinates for a custom OCP Factory deployment. */
  readonly factory?: OcpFactoryCoordinates;
  /** Enable safeguards for production operations. */
  readonly productionSafetyChecks?: boolean;
}

/** Runtime clients injected into {@link OcpClient}. */
export interface OcpClientDependencies extends OcpObservabilityOptions, OcpClientConstructionOptions {
  readonly ledger: LedgerJsonApiClient;
  readonly validator?: ValidatorApiClient;
  readonly environment?: OcpEnvironment;
}

/** Complete environment configuration used by {@link OcpClient.create}. */
export type OcpClientEnvironmentOptions = EnvironmentConfigInput & OcpClientConstructionOptions;

/** LocalNet preset options, including an optional explicit OAuth2 override. */
export type OcpClientLocalNetOptions =
  | (Omit<LocalNetEnvironmentConfigInput, 'environment'> & OcpClientConstructionOptions)
  | (Omit<LocalNetOAuth2EnvironmentConfigInput, 'environment'> & OcpClientConstructionOptions);

/** Hosted-network preset options. OAuth2 credentials are always required. */
export type OcpClientHostedPresetOptions = Omit<NonLocalOAuth2EnvironmentConfigInput, 'environment' | 'authMode'> &
  OcpClientConstructionOptions;

/** Optional overrides layered over `CANTON_*` environment variables. */
export type OcpClientEnvOptions = EnvironmentConfigOverrides & OcpClientConstructionOptions;
