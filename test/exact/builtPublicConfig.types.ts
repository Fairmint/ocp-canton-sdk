import {
  OcpNetworkError,
  type AuthorizeIssuerParams,
  type EnvironmentConfigInput,
  type OcpClient,
  type OcpClientDependencies,
  type OcpClientEnvOptions,
  type OcpValidationError,
} from '../../dist';

type IsOptional<T, Key extends keyof T> = {} extends Pick<T, Key> ? true : false;

declare const client: OcpClient;
declare const dependencies: OcpClientDependencies;

const { validator, factory, environment } = client;
const validAuthorization: AuthorizeIssuerParams = {
  issuer: 'issuer::party',
  factory: { contractId: 'factory-cid', templateId: 'factory-tid' },
};
const clientValidatorIsRequired: IsOptional<OcpClient, 'validator'> = false;
const clientFactoryIsRequired: IsOptional<OcpClient, 'factory'> = false;
const clientEnvironmentIsRequired: IsOptional<OcpClient, 'environment'> = false;
const errorStatusCodeIsRequired: IsOptional<OcpNetworkError, 'statusCode'> = false;
const validationReceivedValueIsRequired: IsOptional<OcpValidationError, 'receivedValue'> = false;
declare const validationError: OcpValidationError;
const validationReceivedValue: unknown = validationError.receivedValue;

// @ts-expect-error Built environment inputs preserve omission-only properties.
const explicitUndefinedInput: EnvironmentConfigInput = { environment: 'localnet', ledgerApiUrl: undefined };
// @ts-expect-error Built env overrides preserve omission-only properties.
const explicitUndefinedOverride: OcpClientEnvOptions = { factory: undefined };
// @ts-expect-error Built dependency declarations preserve omission-only properties.
const explicitUndefinedDependency: OcpClientDependencies = { ledger: dependencies.ledger, environment: undefined };
// @ts-expect-error Built authorization declarations expose only an atomic factory override.
const partialAuthorization: AuthorizeIssuerParams = { issuer: 'issuer::party', factory: { contractId: 'cid' } };
// @ts-expect-error Built error options reject explicit undefined.
const explicitUndefinedErrorOption = new OcpNetworkError('unreachable', { statusCode: undefined });

void validator;
void factory;
void environment;
void validAuthorization;
void clientValidatorIsRequired;
void clientFactoryIsRequired;
void clientEnvironmentIsRequired;
void errorStatusCodeIsRequired;
void validationReceivedValueIsRequired;
void validationReceivedValue;
void explicitUndefinedInput;
void explicitUndefinedOverride;
void explicitUndefinedDependency;
void partialAuthorization;
void explicitUndefinedErrorOption;
