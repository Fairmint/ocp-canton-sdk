import type { ApiConfig, AuthConfig, CantonConfig, NetworkType } from '@fairmint/canton-node-sdk';
import { createHmac } from 'crypto';
import { OcpErrorCodes, OcpValidationError, type OcpErrorCode, type OcpErrorContext } from './errors';
import { ENVIRONMENT_CONFIG_KEYS, ENVIRONMENT_CONFIG_STRING_KEYS } from './utils/environmentConfigKeys';
import {
  inspectExactArray,
  inspectExactObject,
  inspectOwnDataProperty,
  type ExactDataFailure,
  type ExactObjectSnapshot,
} from './utils/exactObject';

export type OcpEnvironment = 'localnet' | 'scratchnet' | 'devnet' | 'testnet' | 'staging' | 'mainnet' | 'custom';
export type OcpAuthMode = 'shared-secret' | 'oauth2';

interface EnvironmentConfigInputBase {
  readonly validatorApiUrl?: string;
  readonly scanApiUrl?: string;
  readonly provider?: string;
  readonly partyId?: string;
  readonly party?: string;
  readonly userId?: string;
  readonly managedParties?: readonly string[];
  readonly audience?: string;
  readonly scope?: string;
  readonly debug?: boolean;
}

interface LocalNetEndpointConfigInput {
  readonly ledgerApiUrl?: string;
}

interface ExplicitEndpointConfigInput {
  readonly ledgerApiUrl: string;
}

interface OAuth2CredentialsInput {
  readonly authMode: 'oauth2';
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly sharedSecret?: never;
}

/** LocalNet input. Shared-secret authentication and its unsafe development secret are supplied by the preset. */
export interface LocalNetEnvironmentConfigInput extends EnvironmentConfigInputBase, LocalNetEndpointConfigInput {
  readonly environment: 'localnet';
  readonly authMode?: 'shared-secret';
  readonly authUrl?: never;
  readonly clientId?: string;
  readonly clientSecret?: never;
  readonly sharedSecret?: string;
}

/** LocalNet OAuth2 input. Endpoints may come from the LocalNet preset, but credentials must be explicit. */
export interface LocalNetOAuth2EnvironmentConfigInput
  extends EnvironmentConfigInputBase, LocalNetEndpointConfigInput, OAuth2CredentialsInput {
  readonly environment: 'localnet';
}

/** OAuth2 input for environments without a bundled ledger endpoint. */
export interface NonLocalOAuth2EnvironmentConfigInput
  extends EnvironmentConfigInputBase, ExplicitEndpointConfigInput, OAuth2CredentialsInput {
  readonly environment: Exclude<OcpEnvironment, 'localnet'>;
}

/** Complete caller input for OAuth2 authentication. */
export type OAuth2EnvironmentConfigInput = LocalNetOAuth2EnvironmentConfigInput | NonLocalOAuth2EnvironmentConfigInput;

/** Complete caller input for shared-secret authentication outside LocalNet. */
export interface SharedSecretEnvironmentConfigInput extends EnvironmentConfigInputBase, ExplicitEndpointConfigInput {
  readonly environment: Exclude<OcpEnvironment, 'localnet' | 'mainnet'>;
  readonly authMode: 'shared-secret';
  readonly authUrl?: never;
  readonly clientId?: string;
  readonly clientSecret?: never;
  readonly sharedSecret: string;
}

/**
 * Complete, validated configuration input supplied directly by an SDK caller.
 *
 * Environment-variable overrides use {@link EnvironmentConfigOverrides} instead because the environment may provide
 * the rest of a credential set.
 */
export type EnvironmentConfigInput =
  | OAuth2EnvironmentConfigInput
  | LocalNetEnvironmentConfigInput
  | SharedSecretEnvironmentConfigInput;

interface ResolvedEnvironmentConfigBase {
  readonly environment: OcpEnvironment;
  readonly ledgerApiUrl: string;
  readonly validatorApiUrl: string | undefined;
  readonly scanApiUrl: string | undefined;
  readonly provider: string | undefined;
  readonly partyId: string | undefined;
  readonly userId: string | undefined;
  readonly managedParties: readonly string[] | undefined;
  readonly audience: string | undefined;
  readonly scope: string | undefined;
  readonly debug: boolean | undefined;
}

/** Fully resolved OAuth2 configuration. Required credentials are guaranteed to be present. */
export interface OAuth2EnvironmentConfig extends ResolvedEnvironmentConfigBase {
  readonly authMode: 'oauth2';
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly sharedSecret: undefined;
}

/** Fully resolved shared-secret configuration. Irrelevant OAuth2 fields are guaranteed to be absent. */
export interface SharedSecretEnvironmentConfig extends ResolvedEnvironmentConfigBase {
  readonly environment: Exclude<OcpEnvironment, 'mainnet'>;
  readonly authMode: 'shared-secret';
  readonly authUrl: undefined;
  readonly clientId: string;
  readonly clientSecret: undefined;
  readonly sharedSecret: string;
}

/** Fully validated runtime configuration. */
export type EnvironmentConfig = OAuth2EnvironmentConfig | SharedSecretEnvironmentConfig;

/** Optional caller overrides layered over `CANTON_*` environment variables. */
export interface EnvironmentConfigOverrides {
  readonly environment?: OcpEnvironment;
  readonly ledgerApiUrl?: string;
  readonly validatorApiUrl?: string;
  readonly scanApiUrl?: string;
  readonly authMode?: OcpAuthMode;
  readonly authUrl?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly sharedSecret?: string;
  readonly provider?: string;
  readonly partyId?: string;
  readonly party?: string;
  readonly userId?: string;
  readonly managedParties?: readonly string[];
  readonly audience?: string;
  readonly scope?: string;
  readonly debug?: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface EnvironmentConfigCandidateInput {
  readonly environment: string;
  readonly ledgerApiUrl?: string;
  readonly validatorApiUrl?: string;
  readonly scanApiUrl?: string;
  readonly authMode?: string;
  readonly authUrl?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly sharedSecret?: string;
  readonly provider?: string;
  readonly partyId?: string;
  readonly party?: string;
  readonly userId?: string;
  readonly managedParties?: readonly string[];
  readonly audience?: string;
  readonly scope?: string;
  readonly debug?: boolean;
}

export type EnvironmentPreset = Omit<EnvironmentConfigCandidateInput, 'environment' | 'authMode'> & {
  readonly environment: OcpEnvironment;
  readonly authMode: OcpAuthMode;
};

interface EnvironmentConfigCandidate {
  readonly environment: string;
  readonly ledgerApiUrl: string | undefined;
  readonly validatorApiUrl: string | undefined;
  readonly scanApiUrl: string | undefined;
  readonly authMode: string | undefined;
  readonly authUrl: string | undefined;
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  readonly sharedSecret: string | undefined;
  readonly provider: string | undefined;
  readonly partyId: string | undefined;
  readonly party: string | undefined;
  readonly userId: string | undefined;
  readonly managedParties: readonly string[] | undefined;
  readonly audience: string | undefined;
  readonly scope: string | undefined;
  readonly debug: boolean | undefined;
}

interface SnapshottedEnvironmentValues {
  readonly environment: string | undefined;
  readonly ledgerApiUrl: string | undefined;
  readonly validatorApiUrl: string | undefined;
  readonly scanApiUrl: string | undefined;
  readonly authMode: string | undefined;
  readonly authUrl: string | undefined;
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  readonly sharedSecret: string | undefined;
  readonly provider: string | undefined;
  readonly partyId: string | undefined;
  readonly party: string | undefined;
  readonly userId: string | undefined;
  readonly managedParties: readonly string[] | undefined;
  readonly audience: string | undefined;
  readonly scope: string | undefined;
  readonly debug: boolean | undefined;
}

interface ConfigObjectInspection {
  readonly values: SnapshottedEnvironmentValues | undefined;
  readonly issues: readonly ConfigurationIssue[];
}

interface ConfigurationIssue {
  readonly fieldPath: string;
  readonly message: string;
  readonly code: OcpErrorCode;
  readonly expectedType: string | undefined;
  readonly receivedValue: unknown;
  readonly context: OcpErrorContext | undefined;
}

interface ConfigurationValidation {
  readonly result: ValidationResult;
  readonly issues: readonly ConfigurationIssue[];
}

interface ConfigurationIssueOptions {
  readonly code?: OcpErrorCode;
  readonly expectedType?: string;
  readonly receivedValue?: unknown;
  readonly context?: OcpErrorContext;
}

function configurationIssue(
  fieldPath: string,
  message: string,
  options: ConfigurationIssueOptions = {}
): ConfigurationIssue {
  return Object.freeze({
    fieldPath,
    message,
    code: options.code ?? OcpErrorCodes.INVALID_FORMAT,
    expectedType: options.expectedType,
    receivedValue: options.receivedValue,
    context: options.context,
  });
}

function freezeValidation(
  issues: readonly ConfigurationIssue[],
  warnings: readonly string[] = []
): ConfigurationValidation {
  const frozenIssues = Object.freeze([...issues]);
  const errors = Object.freeze(frozenIssues.map(({ message }) => message));
  const frozenWarnings = Object.freeze([...warnings]);
  return Object.freeze({
    result: Object.freeze({ valid: errors.length === 0, errors, warnings: frozenWarnings }),
    issues: frozenIssues,
  });
}

function throwConfigurationIssues(issues: readonly ConfigurationIssue[]): never {
  const primary = issues[0];
  if (primary === undefined) {
    throw new OcpValidationError('environmentConfig', 'configuration validation failed', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const issueSummaries = Object.freeze(
    issues.map(({ fieldPath, message, code, expectedType }) =>
      Object.freeze({
        fieldPath,
        message,
        code,
        ...(expectedType !== undefined ? { expectedType } : {}),
      })
    )
  );
  const context: OcpErrorContext = {
    ...primary.context,
    issues: issueSummaries,
  };
  throw new OcpValidationError(primary.fieldPath, primary.message, {
    code: primary.code,
    ...(primary.expectedType !== undefined ? { expectedType: primary.expectedType } : {}),
    ...(primary.receivedValue !== undefined ? { receivedValue: primary.receivedValue } : {}),
    context,
  });
}

function freezePreset(preset: EnvironmentPreset): EnvironmentPreset {
  const managedParties = preset.managedParties === undefined ? undefined : Object.freeze([...preset.managedParties]);
  return Object.freeze({
    ...preset,
    ...(managedParties !== undefined ? { managedParties } : {}),
  });
}

export const LOCALNET_PRESET: EnvironmentPreset = freezePreset({
  environment: 'localnet',
  ledgerApiUrl: 'http://localhost:3975',
  validatorApiUrl: 'http://localhost:3903',
  scanApiUrl: 'http://localhost:4000/api/scan',
  authMode: 'shared-secret',
  provider: 'app-provider',
  clientId: 'ocp-sdk',
  sharedSecret: 'unsafe',
});

export const SCRATCHNET_PRESET: EnvironmentPreset = freezePreset({
  environment: 'scratchnet',
  authMode: 'oauth2',
});

export const DEVNET_PRESET: EnvironmentPreset = freezePreset({
  environment: 'devnet',
  authMode: 'oauth2',
});

export const TESTNET_PRESET: EnvironmentPreset = freezePreset({
  environment: 'testnet',
  authMode: 'oauth2',
});

export const STAGING_PRESET: EnvironmentPreset = freezePreset({
  environment: 'staging',
  authMode: 'oauth2',
});

export const MAINNET_PRESET: EnvironmentPreset = freezePreset({
  environment: 'mainnet',
  authMode: 'oauth2',
});

export const CUSTOM_PRESET: EnvironmentPreset = freezePreset({
  environment: 'custom',
  authMode: 'oauth2',
});

export const ENVIRONMENT_PRESETS: Readonly<Record<OcpEnvironment, EnvironmentPreset>> = Object.freeze({
  localnet: LOCALNET_PRESET,
  scratchnet: SCRATCHNET_PRESET,
  devnet: DEVNET_PRESET,
  testnet: TESTNET_PRESET,
  staging: STAGING_PRESET,
  mainnet: MAINNET_PRESET,
  custom: CUSTOM_PRESET,
});

const ENVIRONMENTS = Object.freeze(Object.keys(ENVIRONMENT_PRESETS) as OcpEnvironment[]);
const AUTH_MODES = Object.freeze(['shared-secret', 'oauth2'] as const satisfies readonly OcpAuthMode[]);

function isOcpEnvironment(value: string): value is OcpEnvironment {
  return ENVIRONMENTS.includes(value as OcpEnvironment);
}

function isOcpAuthMode(value: string): value is OcpAuthMode {
  return AUTH_MODES.includes(value as OcpAuthMode);
}

function parseOcpEnvironment(value: string): OcpEnvironment {
  const normalized = value.toLowerCase();
  if (!isOcpEnvironment(normalized)) {
    throw new OcpValidationError('environment', `Unsupported Canton environment: ${value}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: ENVIRONMENTS.join(' | '),
      receivedValue: value,
    });
  }
  return normalized;
}

function envValue(env: Record<string, string | undefined>, ...names: string[]): string | undefined {
  for (const name of names) {
    const inspection = inspectOwnDataProperty(env, name);
    if (!inspection.ok) {
      throw new OcpValidationError(
        `environmentVariables.${name}`,
        'environment variables must be own data properties.',
        {
          code: inspection.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'object with string-valued own data properties',
          receivedValue: inspection.receivedValue,
          context: { reason: inspection.reason },
        }
      );
    }
    if (!inspection.present) continue;
    const { value } = inspection;
    if (value !== undefined && typeof value !== 'string') {
      throw new OcpValidationError(`environmentVariables.${name}`, `${name} must be a string when provided.`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string or omitted',
        receivedValue: value,
      });
    }
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  throw new OcpValidationError('debug', 'CANTON_DEBUG must use an explicit boolean token', {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType: '1 | true | yes | on | 0 | false | no | off',
    receivedValue: value,
  });
}

function parseManagedParties(value: string | undefined): string[] | undefined {
  const parties = value
    ?.split(',')
    .map((party) => party.trim())
    .filter((party) => party.length > 0);
  return parties && parties.length > 0 ? parties : undefined;
}

function isLocalUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname) || parsed.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) {
      return false;
    }
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//iu.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = trimOptionalString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function trimManagedParties(managedParties: readonly string[] | undefined): readonly string[] | undefined {
  const trimmed = managedParties
    ?.map((party) => trimOptionalString(party))
    .filter((party): party is string => party !== undefined);
  return trimmed && trimmed.length > 0 ? Object.freeze(trimmed) : undefined;
}

function urlEnvironmentTokens(url: string): Set<string> {
  try {
    const parsed = new URL(url.toLowerCase());
    return new Set(`${parsed.hostname} ${parsed.pathname}`.split(/[^a-z0-9]+/).filter(Boolean));
  } catch {
    return new Set(
      url
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    );
  }
}

function configWithPreset(input: EnvironmentConfigCandidate): EnvironmentConfigCandidate {
  const preset: EnvironmentPreset | undefined = isOcpEnvironment(input.environment)
    ? ENVIRONMENT_PRESETS[input.environment]
    : undefined;
  const authMode = input.authMode ?? preset?.authMode;
  const authPreset = preset?.authMode === authMode ? preset : undefined;
  return Object.freeze({
    environment: input.environment,
    ledgerApiUrl: input.ledgerApiUrl ?? preset?.ledgerApiUrl,
    validatorApiUrl: input.validatorApiUrl ?? preset?.validatorApiUrl,
    scanApiUrl: input.scanApiUrl ?? preset?.scanApiUrl,
    authMode,
    authUrl: input.authUrl ?? authPreset?.authUrl,
    clientId: input.clientId ?? authPreset?.clientId,
    clientSecret: input.clientSecret ?? authPreset?.clientSecret,
    sharedSecret: input.sharedSecret ?? authPreset?.sharedSecret,
    provider: input.provider ?? preset?.provider,
    partyId: firstNonBlank(input.partyId, input.party, preset?.partyId, preset?.party),
    party: input.party ?? preset?.party,
    userId: input.userId ?? preset?.userId,
    managedParties: input.managedParties ?? preset?.managedParties,
    audience: input.audience ?? preset?.audience,
    scope: input.scope ?? preset?.scope,
    debug: input.debug ?? preset?.debug,
  });
}

const CONFIG_KEYS = new Set<string>(ENVIRONMENT_CONFIG_KEYS);

function exactConfigIssue(root: string, failure: ExactDataFailure): ConfigurationIssue {
  const fieldPath = typeof failure.key === 'string' ? failure.key : root;
  const keyDescription =
    failure.key === undefined
      ? ''
      : typeof failure.key === 'symbol'
        ? ` (${failure.key.description ?? 'symbol'})`
        : ` (${failure.key})`;
  return configurationIssue(
    fieldPath,
    `${root} must be an exact plain object containing only supported own data properties; rejected ${failure.reason}${keyDescription}.`,
    {
      code: failure.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'exact plain configuration object with own data properties only',
      receivedValue: failure.receivedValue,
      context: { reason: failure.reason },
    }
  );
}

function acceptedString(snapshot: ExactObjectSnapshot, field: string): string | undefined {
  const value = snapshot.get(field);
  return typeof value === 'string' ? value : undefined;
}

function inspectConfigObject(input: unknown, root: string, environmentRequired: boolean): ConfigObjectInspection {
  const inspection = inspectExactObject(input, { allowedKeys: CONFIG_KEYS });
  if (!inspection.ok) {
    return Object.freeze({ values: undefined, issues: Object.freeze([exactConfigIssue(root, inspection)]) });
  }

  const { snapshot } = inspection;
  const issues: ConfigurationIssue[] = [];
  for (const field of ENVIRONMENT_CONFIG_STRING_KEYS) {
    if (!snapshot.has(field)) continue;
    const value = snapshot.get(field);
    if (value === undefined) {
      issues.push(
        configurationIssue(field, `${field} must be omitted rather than set to undefined.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string or omitted',
        })
      );
    } else if (value === null) {
      issues.push(
        configurationIssue(
          field,
          `${field}${root === 'environmentOverrides' ? ' override' : ''} must not be null; omit the property.`,
          {
            code: OcpErrorCodes.INVALID_TYPE,
            expectedType: 'string or omitted',
            receivedValue: null,
          }
        )
      );
    } else if (typeof value !== 'string') {
      issues.push(
        configurationIssue(field, `${field} must be a string when provided.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string or omitted',
          receivedValue: value,
        })
      );
    }
  }
  if (environmentRequired && !snapshot.has('environment')) {
    issues.push(
      configurationIssue('environment', 'environment is required.', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'string',
      })
    );
  }

  let managedParties: readonly string[] | undefined;
  if (snapshot.has('managedParties')) {
    const rawManagedParties = snapshot.get('managedParties');
    if (rawManagedParties === undefined) {
      issues.push(
        configurationIssue('managedParties', 'managedParties must be omitted rather than set to undefined.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'array of strings or omitted',
        })
      );
    } else {
      const arrayInspection = inspectExactArray(rawManagedParties);
      if (!arrayInspection.ok) {
        issues.push(
          configurationIssue(
            typeof arrayInspection.key === 'string' ? `managedParties.${arrayInspection.key}` : 'managedParties',
            `managedParties must be a plain dense array of strings; rejected ${arrayInspection.reason}.`,
            {
              code:
                arrayInspection.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
              expectedType: 'plain dense array of strings',
              receivedValue: rawManagedParties,
              context: { reason: arrayInspection.reason },
            }
          )
        );
      } else {
        const strings: string[] = [];
        for (let index = 0; index < arrayInspection.values.length; index += 1) {
          const party = arrayInspection.values[index];
          if (typeof party !== 'string') {
            issues.push(
              configurationIssue(`managedParties.${index}`, 'managedParties entries must be strings.', {
                code: OcpErrorCodes.INVALID_TYPE,
                expectedType: 'string',
                receivedValue: party,
              })
            );
          } else {
            strings.push(party);
          }
        }
        if (strings.length === arrayInspection.values.length) managedParties = Object.freeze(strings);
      }
    }
  }

  let debug: boolean | undefined;
  if (snapshot.has('debug')) {
    const rawDebug = snapshot.get('debug');
    if (rawDebug === undefined) {
      issues.push(
        configurationIssue('debug', 'debug must be omitted rather than set to undefined.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean or omitted',
        })
      );
    } else if (typeof rawDebug !== 'boolean') {
      issues.push(
        configurationIssue('debug', 'debug must be a boolean when provided.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean or omitted',
          receivedValue: rawDebug,
        })
      );
    } else {
      debug = rawDebug;
    }
  }

  const values: SnapshottedEnvironmentValues = Object.freeze({
    environment: acceptedString(snapshot, 'environment'),
    ledgerApiUrl: acceptedString(snapshot, 'ledgerApiUrl'),
    validatorApiUrl: acceptedString(snapshot, 'validatorApiUrl'),
    scanApiUrl: acceptedString(snapshot, 'scanApiUrl'),
    authMode: acceptedString(snapshot, 'authMode'),
    authUrl: acceptedString(snapshot, 'authUrl'),
    clientId: acceptedString(snapshot, 'clientId'),
    clientSecret: acceptedString(snapshot, 'clientSecret'),
    sharedSecret: acceptedString(snapshot, 'sharedSecret'),
    provider: acceptedString(snapshot, 'provider'),
    partyId: acceptedString(snapshot, 'partyId'),
    party: acceptedString(snapshot, 'party'),
    userId: acceptedString(snapshot, 'userId'),
    managedParties,
    audience: acceptedString(snapshot, 'audience'),
    scope: acceptedString(snapshot, 'scope'),
    debug,
  });
  return Object.freeze({ values, issues: Object.freeze(issues) });
}

function validateDirectConfigInput(input: unknown): ConfigObjectInspection {
  const inspected = inspectConfigObject(input, 'environmentConfig', true);
  if (inspected.values === undefined) return inspected;

  const issues = [...inspected.issues];
  const preset =
    inspected.values.environment !== undefined && isOcpEnvironment(inspected.values.environment)
      ? ENVIRONMENT_PRESETS[inspected.values.environment]
      : undefined;
  const authMode = inspected.values.authMode ?? preset?.authMode;
  if (authMode === 'oauth2' && inspected.values.sharedSecret !== undefined) {
    issues.push(configurationIssue('sharedSecret', 'sharedSecret is not allowed for oauth2 auth mode.'));
  }
  if (authMode === 'shared-secret') {
    if (inspected.values.authUrl !== undefined) {
      issues.push(configurationIssue('authUrl', 'authUrl is not allowed for shared-secret auth mode.'));
    }
    if (inspected.values.clientSecret !== undefined) {
      issues.push(configurationIssue('clientSecret', 'clientSecret is not allowed for shared-secret auth mode.'));
    }
  }
  return Object.freeze({ values: inspected.values, issues: Object.freeze(issues) });
}

function validateEnvironmentConfigOverrides(input: unknown): ConfigObjectInspection {
  return inspectConfigObject(input, 'environmentOverrides', false);
}

function validateResolvedConfigCandidate(config: EnvironmentConfigCandidate): ConfigurationValidation {
  const issues: ConfigurationIssue[] = [];
  const warnings: string[] = [];

  if (!isOcpEnvironment(config.environment)) {
    issues.push(
      configurationIssue('environment', `Unsupported Canton environment: ${String(config.environment)}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: ENVIRONMENTS.join(' | '),
        receivedValue: config.environment,
      })
    );
  }

  const ledgerApiUrlMissing = isBlank(config.ledgerApiUrl);
  const ledgerApiUrlValid = !ledgerApiUrlMissing && isAbsoluteHttpUrl(config.ledgerApiUrl ?? '');
  if (ledgerApiUrlMissing) {
    issues.push(
      configurationIssue(
        'ledgerApiUrl',
        'ledgerApiUrl is required. Set it explicitly or provide CANTON_LEDGER_API_URL.',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'absolute http:// or https:// URL',
        }
      )
    );
  } else if (!ledgerApiUrlValid) {
    issues.push(
      configurationIssue('ledgerApiUrl', 'ledgerApiUrl must be an absolute http:// or https:// URL.', {
        expectedType: 'absolute http:// or https:// URL',
        receivedValue: config.ledgerApiUrl,
      })
    );
  }

  for (const [fieldPath, value] of [
    ['validatorApiUrl', config.validatorApiUrl],
    ['scanApiUrl', config.scanApiUrl],
  ] as const) {
    if (!isBlank(value) && !isAbsoluteHttpUrl(value ?? '')) {
      issues.push(
        configurationIssue(fieldPath, `${fieldPath} must be an absolute http:// or https:// URL.`, {
          expectedType: 'absolute http:// or https:// URL',
          receivedValue: value,
        })
      );
    }
  }

  const detectedEnvironment = ledgerApiUrlValid ? detectEnvironment(config.ledgerApiUrl ?? '') : undefined;
  if (
    detectedEnvironment !== undefined &&
    detectedEnvironment !== 'custom' &&
    config.environment !== 'custom' &&
    detectedEnvironment !== config.environment
  ) {
    issues.push(
      configurationIssue(
        'ledgerApiUrl',
        `ledgerApiUrl appears to target ${detectedEnvironment}, but environment is ${config.environment}.`,
        {
          expectedType: `URL for ${config.environment}`,
          receivedValue: config.ledgerApiUrl,
          context: { detectedEnvironment },
        }
      )
    );
  }

  if (config.authMode === undefined || !isOcpAuthMode(config.authMode)) {
    issues.push(
      configurationIssue('authMode', `authMode must be one of: ${AUTH_MODES.join(', ')}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: AUTH_MODES.join(' | '),
        receivedValue: config.authMode,
      })
    );
  }

  if (config.authMode === 'oauth2') {
    if (config.sharedSecret !== undefined) {
      issues.push(configurationIssue('sharedSecret', 'sharedSecret is not allowed for oauth2 auth mode.'));
    }
    if (isBlank(config.authUrl)) {
      issues.push(
        configurationIssue('authUrl', 'authUrl is required for oauth2 auth mode.', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'absolute http:// or https:// URL',
        })
      );
    } else if (!isAbsoluteHttpUrl(config.authUrl ?? '')) {
      issues.push(
        configurationIssue('authUrl', 'authUrl must be an absolute http:// or https:// URL.', {
          expectedType: 'absolute http:// or https:// URL',
          receivedValue: config.authUrl,
        })
      );
    }
    if (isBlank(config.clientId)) {
      issues.push(
        configurationIssue('clientId', 'clientId is required for oauth2 auth mode.', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'non-empty string',
        })
      );
    }
    if (isBlank(config.clientSecret)) {
      issues.push(
        configurationIssue('clientSecret', 'clientSecret is required for oauth2 auth mode.', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'non-empty string',
        })
      );
    }
  }

  if (config.authMode === 'shared-secret') {
    if (config.authUrl !== undefined) {
      issues.push(configurationIssue('authUrl', 'authUrl is not allowed for shared-secret auth mode.'));
    }
    if (config.clientSecret !== undefined) {
      issues.push(configurationIssue('clientSecret', 'clientSecret is not allowed for shared-secret auth mode.'));
    }
    if (config.environment === 'mainnet') {
      issues.push(configurationIssue('authMode', 'shared-secret auth mode is not allowed for mainnet.'));
    }
    if (config.environment !== 'localnet' && isBlank(config.sharedSecret)) {
      issues.push(
        configurationIssue('sharedSecret', 'sharedSecret is required for shared-secret auth mode outside localnet.', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'non-empty string',
        })
      );
    }
  }

  const normalizedPartyId = trimOptionalString(config.partyId);
  const normalizedPartyAlias = trimOptionalString(config.party);
  if (
    normalizedPartyId !== undefined &&
    normalizedPartyAlias !== undefined &&
    normalizedPartyId !== normalizedPartyAlias
  ) {
    issues.push(
      configurationIssue('party', 'party must match partyId when both aliases are provided.', {
        expectedType: normalizedPartyId,
        receivedValue: normalizedPartyAlias,
        context: { partyId: normalizedPartyId },
      })
    );
  }

  if (config.environment === 'localnet') {
    for (const [name, url] of [
      ['ledgerApiUrl', config.ledgerApiUrl],
      ['validatorApiUrl', config.validatorApiUrl],
      ['scanApiUrl', config.scanApiUrl],
    ] as const) {
      if (url && isAbsoluteHttpUrl(url) && !isLocalUrl(url)) {
        warnings.push(`${name} is not a localhost URL for localnet.`);
      }
    }
  }

  if (['devnet', 'testnet', 'staging', 'mainnet'].includes(config.environment) && isLocalUrl(config.ledgerApiUrl)) {
    warnings.push(`${config.environment} ledgerApiUrl points at localhost.`);
  }

  if (config.environment === 'mainnet') {
    warnings.push('mainnet configuration targets production Canton services.');
  }

  if (isBlank(config.validatorApiUrl)) {
    warnings.push('validatorApiUrl is not set; validator-backed helpers will rely on Canton defaults if available.');
  }

  return freezeValidation(issues, warnings);
}

function environmentCandidate(values: SnapshottedEnvironmentValues): EnvironmentConfigCandidate | undefined {
  if (values.environment === undefined) return undefined;
  return Object.freeze({
    environment: values.environment,
    ledgerApiUrl: values.ledgerApiUrl,
    validatorApiUrl: values.validatorApiUrl,
    scanApiUrl: values.scanApiUrl,
    authMode: values.authMode,
    authUrl: values.authUrl,
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    sharedSecret: values.sharedSecret,
    provider: values.provider,
    partyId: values.partyId,
    party: values.party,
    userId: values.userId,
    managedParties: values.managedParties,
    audience: values.audience,
    scope: values.scope,
    debug: values.debug,
  });
}

function validateConfigCandidate(input: EnvironmentConfigCandidate): ConfigurationValidation {
  return validateResolvedConfigCandidate(configWithPreset(input));
}

export function validateConfig(input: EnvironmentConfigCandidateInput): ValidationResult {
  const inspected = validateDirectConfigInput(input);
  if (inspected.issues.length > 0 || inspected.values === undefined) {
    return freezeValidation(inspected.issues).result;
  }
  const candidate = environmentCandidate(inspected.values);
  return candidate === undefined
    ? freezeValidation([
        configurationIssue('environment', 'environment is required.', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'string',
        }),
      ]).result
    : validateConfigCandidate(candidate).result;
}

function requiredResolvedString(value: string | undefined, field: string): string {
  const resolved = trimOptionalString(value);
  if (resolved === undefined) {
    throw new OcpValidationError(field, `${field} is required.`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
    });
  }
  return resolved;
}

function resolveEnvironmentConfigCandidate(input: EnvironmentConfigCandidate): EnvironmentConfig {
  const config = configWithPreset(input);
  const validation = validateResolvedConfigCandidate(config);

  if (!validation.result.valid) {
    throwConfigurationIssues(validation.issues);
  }

  if (!isOcpEnvironment(config.environment) || !isOcpAuthMode(config.authMode ?? '')) {
    throw new OcpValidationError('environmentConfig', 'validated configuration could not be resolved.', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const common: ResolvedEnvironmentConfigBase = {
    environment: config.environment,
    ledgerApiUrl: requiredResolvedString(config.ledgerApiUrl, 'ledgerApiUrl'),
    validatorApiUrl: trimOptionalString(config.validatorApiUrl),
    scanApiUrl: trimOptionalString(config.scanApiUrl),
    provider: trimOptionalString(config.provider),
    partyId: firstNonBlank(config.partyId, config.party),
    userId: trimOptionalString(config.userId),
    managedParties: trimManagedParties(config.managedParties),
    audience: trimOptionalString(config.audience),
    scope: trimOptionalString(config.scope),
    debug: config.debug,
  };

  if (config.authMode === 'oauth2') {
    return Object.freeze({
      ...common,
      authMode: 'oauth2',
      authUrl: requiredResolvedString(config.authUrl, 'authUrl'),
      clientId: requiredResolvedString(config.clientId, 'clientId'),
      clientSecret: requiredResolvedString(config.clientSecret, 'clientSecret'),
      sharedSecret: undefined,
    });
  }

  if (config.environment === 'mainnet') {
    throw new OcpValidationError('authMode', 'shared-secret auth mode is not allowed for mainnet.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: config.authMode,
    });
  }

  return Object.freeze({
    ...common,
    environment: config.environment,
    authMode: 'shared-secret',
    authUrl: undefined,
    clientId: trimOptionalString(config.clientId) ?? 'ocp-sdk',
    clientSecret: undefined,
    sharedSecret: requiredResolvedString(
      trimOptionalString(config.sharedSecret) ?? (config.environment === 'localnet' ? 'unsafe' : undefined),
      'sharedSecret'
    ),
  });
}

export function resolveEnvironmentConfig(input: EnvironmentConfigInput): EnvironmentConfig {
  const inspected = validateDirectConfigInput(input);
  if (inspected.issues.length > 0 || inspected.values === undefined) {
    throwConfigurationIssues(inspected.issues);
  }
  const candidate = environmentCandidate(inspected.values);
  if (candidate === undefined) {
    throw new OcpValidationError('environment', 'environment is required.', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
    });
  }
  return resolveEnvironmentConfigCandidate(candidate);
}

const RESOLVED_CONFIG_KEYS = new Set([
  'environment',
  'ledgerApiUrl',
  'validatorApiUrl',
  'scanApiUrl',
  'provider',
  'partyId',
  'userId',
  'managedParties',
  'audience',
  'scope',
  'debug',
  'authMode',
  'authUrl',
  'clientId',
  'clientSecret',
  'sharedSecret',
]);

function requiredResolvedOwnString(snapshot: ExactObjectSnapshot, field: string): string {
  if (!snapshot.has(field)) {
    throw new OcpValidationError(field, `${field} must be present on resolved configuration.`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'required own string property',
    });
  }
  const value = snapshot.get(field);
  if (typeof value !== 'string') {
    throw new OcpValidationError(field, `${field} must be a string on resolved configuration.`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function optionalResolvedOwnString(snapshot: ExactObjectSnapshot, field: string): string | undefined {
  if (!snapshot.has(field)) {
    throw new OcpValidationError(field, `${field} must be present on resolved configuration.`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'required own string | undefined property',
    });
  }
  const value = snapshot.get(field);
  if (value !== undefined && typeof value !== 'string') {
    throw new OcpValidationError(field, `${field} must be a string or undefined on resolved configuration.`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string | undefined',
      receivedValue: value,
    });
  }
  return value;
}

/** Validate and detach a value claimed to be fully resolved runtime configuration. */
function snapshotResolvedEnvironmentConfig(value: unknown): EnvironmentConfig {
  const inspection = inspectExactObject(value, { allowedKeys: RESOLVED_CONFIG_KEYS });
  if (!inspection.ok) {
    throwConfigurationIssues([exactConfigIssue('resolvedEnvironmentConfig', inspection)]);
  }
  const { snapshot } = inspection;
  for (const key of RESOLVED_CONFIG_KEYS) {
    if (!snapshot.has(key)) {
      throw new OcpValidationError(key, `${key} must be present on resolved configuration.`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'required own property',
      });
    }
  }

  const environmentValue = requiredResolvedOwnString(snapshot, 'environment');
  if (!isOcpEnvironment(environmentValue)) {
    throw new OcpValidationError('environment', 'resolved environment is unsupported.', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: ENVIRONMENTS.join(' | '),
      receivedValue: environmentValue,
    });
  }
  const authModeValue = requiredResolvedOwnString(snapshot, 'authMode');
  if (!isOcpAuthMode(authModeValue)) {
    throw new OcpValidationError('authMode', 'resolved auth mode is unsupported.', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: AUTH_MODES.join(' | '),
      receivedValue: authModeValue,
    });
  }

  const ledgerApiUrl = requiredResolvedOwnString(snapshot, 'ledgerApiUrl');
  const validatorApiUrl = optionalResolvedOwnString(snapshot, 'validatorApiUrl');
  const scanApiUrl = optionalResolvedOwnString(snapshot, 'scanApiUrl');
  const provider = optionalResolvedOwnString(snapshot, 'provider');
  const partyId = optionalResolvedOwnString(snapshot, 'partyId');
  const userId = optionalResolvedOwnString(snapshot, 'userId');
  const audience = optionalResolvedOwnString(snapshot, 'audience');
  const scope = optionalResolvedOwnString(snapshot, 'scope');
  const authUrl = optionalResolvedOwnString(snapshot, 'authUrl');
  const clientId = requiredResolvedOwnString(snapshot, 'clientId');
  const clientSecret = optionalResolvedOwnString(snapshot, 'clientSecret');
  const sharedSecret = optionalResolvedOwnString(snapshot, 'sharedSecret');

  const debugValue = snapshot.get('debug');
  if (debugValue !== undefined && typeof debugValue !== 'boolean') {
    throw new OcpValidationError('debug', 'debug must be boolean or undefined on resolved configuration.', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean | undefined',
      receivedValue: debugValue,
    });
  }
  const managedPartiesValue = snapshot.get('managedParties');
  let managedParties: readonly string[] | undefined;
  if (managedPartiesValue !== undefined) {
    const partiesInspection = inspectExactArray(managedPartiesValue);
    if (!partiesInspection.ok) {
      throw new OcpValidationError('managedParties', 'resolved managedParties must be a plain dense string array.', {
        code: partiesInspection.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'plain dense array of strings',
        receivedValue: managedPartiesValue,
        context: { reason: partiesInspection.reason },
      });
    }
    const parties: string[] = [];
    for (let index = 0; index < partiesInspection.values.length; index += 1) {
      const party = partiesInspection.values[index];
      if (typeof party !== 'string') {
        throw new OcpValidationError(`managedParties.${index}`, 'resolved managed party must be a string.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string',
          receivedValue: party,
        });
      }
      parties.push(party);
    }
    managedParties = Object.freeze(parties);
  }

  const candidate: EnvironmentConfigCandidate = Object.freeze({
    environment: environmentValue,
    ledgerApiUrl,
    validatorApiUrl,
    scanApiUrl,
    authMode: authModeValue,
    authUrl,
    clientId,
    clientSecret,
    sharedSecret,
    provider,
    partyId,
    party: undefined,
    userId,
    managedParties,
    audience,
    scope,
    debug: debugValue,
  });
  const validation = validateResolvedConfigCandidate(candidate);
  if (!validation.result.valid) throwConfigurationIssues(validation.issues);

  const common: ResolvedEnvironmentConfigBase = {
    environment: environmentValue,
    ledgerApiUrl: requiredResolvedString(ledgerApiUrl, 'ledgerApiUrl'),
    validatorApiUrl: trimOptionalString(validatorApiUrl),
    scanApiUrl: trimOptionalString(scanApiUrl),
    provider: trimOptionalString(provider),
    partyId: trimOptionalString(partyId),
    userId: trimOptionalString(userId),
    managedParties: trimManagedParties(managedParties),
    audience: trimOptionalString(audience),
    scope: trimOptionalString(scope),
    debug: debugValue,
  };
  if (authModeValue === 'oauth2') {
    return Object.freeze({
      ...common,
      authMode: 'oauth2',
      authUrl: requiredResolvedString(authUrl, 'authUrl'),
      clientId: requiredResolvedString(clientId, 'clientId'),
      clientSecret: requiredResolvedString(clientSecret, 'clientSecret'),
      sharedSecret: undefined,
    });
  }
  if (environmentValue === 'mainnet') {
    throw new OcpValidationError('authMode', 'shared-secret auth mode is not allowed for mainnet.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: authModeValue,
    });
  }
  return Object.freeze({
    ...common,
    environment: environmentValue,
    authMode: 'shared-secret',
    authUrl: undefined,
    clientId: requiredResolvedString(clientId, 'clientId'),
    clientSecret: undefined,
    sharedSecret: requiredResolvedString(sharedSecret, 'sharedSecret'),
  });
}

export function detectEnvironment(ledgerApiUrl: string): OcpEnvironment {
  if (typeof ledgerApiUrl !== 'string') {
    throw new OcpValidationError('ledgerApiUrl', 'ledgerApiUrl must be a string.', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: ledgerApiUrl,
    });
  }
  if (!isAbsoluteHttpUrl(ledgerApiUrl)) {
    throw new OcpValidationError('ledgerApiUrl', 'ledgerApiUrl must be an absolute http:// or https:// URL.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'absolute http:// or https:// URL',
      receivedValue: ledgerApiUrl,
    });
  }
  if (isLocalUrl(ledgerApiUrl)) {
    return 'localnet';
  }

  const tokens = urlEnvironmentTokens(ledgerApiUrl);
  if (tokens.has('scratchnet') || tokens.has('scratch')) {
    return 'scratchnet';
  }
  if (tokens.has('devnet')) {
    return 'devnet';
  }
  if (tokens.has('testnet')) {
    return 'testnet';
  }
  if (tokens.has('staging')) {
    return 'staging';
  }
  if (tokens.has('mainnet')) {
    return 'mainnet';
  }

  return 'custom';
}

export function loadEnvironmentConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  overrides: EnvironmentConfigOverrides = {}
): EnvironmentConfig {
  const overrideInspection = validateEnvironmentConfigOverrides(overrides);
  if (overrideInspection.issues.length > 0 || overrideInspection.values === undefined) {
    throwConfigurationIssues(overrideInspection.issues);
  }
  const overrideValues = overrideInspection.values;

  const ledgerApiUrl =
    overrideValues.ledgerApiUrl ?? envValue(env, 'CANTON_LEDGER_API_URL', 'CANTON_LEDGER_JSON_API_URL');
  const rawEnvironment =
    overrideValues.environment ?? envValue(env, 'CANTON_ENVIRONMENT', 'CANTON_CURRENT_NETWORK') ?? undefined;
  const environment = rawEnvironment
    ? parseOcpEnvironment(rawEnvironment)
    : ledgerApiUrl
      ? detectEnvironment(ledgerApiUrl)
      : 'localnet';
  const rawAuthMode = overrideValues.authMode ?? envValue(env, 'CANTON_AUTH_MODE');
  const normalizedAuthMode = rawAuthMode?.toLowerCase();
  const authMode = normalizedAuthMode;
  const hasPartyOverride = overrideValues.partyId !== undefined || overrideValues.party !== undefined;
  const envPartyId = envValue(env, 'CANTON_PARTY_ID');
  const envPartyAlias = envValue(env, 'CANTON_PARTY');
  const partyId = hasPartyOverride ? (overrideValues.partyId ?? overrideValues.party) : (envPartyId ?? envPartyAlias);
  const party = hasPartyOverride ? overrideValues.party : envPartyAlias;

  const candidate: EnvironmentConfigCandidate = Object.freeze({
    environment,
    ledgerApiUrl,
    validatorApiUrl:
      overrideValues.validatorApiUrl ?? envValue(env, 'CANTON_VALIDATOR_API_URL', 'CANTON_VALIDATOR_API_URI'),
    scanApiUrl: overrideValues.scanApiUrl ?? envValue(env, 'CANTON_SCAN_API_URL', 'CANTON_SCAN_API_URI'),
    authMode,
    authUrl: overrideValues.authUrl ?? envValue(env, 'CANTON_AUTH_URL'),
    clientId: overrideValues.clientId ?? envValue(env, 'CANTON_CLIENT_ID'),
    clientSecret: overrideValues.clientSecret ?? envValue(env, 'CANTON_CLIENT_SECRET'),
    sharedSecret: overrideValues.sharedSecret ?? envValue(env, 'CANTON_SHARED_SECRET'),
    provider: overrideValues.provider ?? envValue(env, 'CANTON_PROVIDER', 'CANTON_CURRENT_PROVIDER'),
    partyId,
    userId: overrideValues.userId ?? envValue(env, 'CANTON_USER_ID'),
    managedParties: overrideValues.managedParties ?? parseManagedParties(envValue(env, 'CANTON_MANAGED_PARTIES')),
    audience: overrideValues.audience ?? envValue(env, 'CANTON_AUDIENCE'),
    scope: overrideValues.scope ?? envValue(env, 'CANTON_SCOPE'),
    debug: overrideValues.debug ?? parseBoolean(envValue(env, 'CANTON_DEBUG')),
    party,
  });

  return resolveEnvironmentConfigCandidate(candidate);
}

export function toCantonNetwork(environment: OcpEnvironment): NetworkType {
  if (typeof environment !== 'string' || !isOcpEnvironment(environment)) {
    throw new OcpValidationError('environment', 'environment must be a supported OCP environment.', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: ENVIRONMENTS.join(' | '),
      receivedValue: environment,
    });
  }
  if (environment === 'scratchnet' || environment === 'custom') {
    return 'localnet';
  }
  return environment;
}

function createSharedSecretJwt(sharedSecret: string, audience: string, subject: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: subject,
      aud: audience,
      iat: now,
      exp: now + 2 * 60 * 60,
    })
  ).toString('base64url');
  const signature = createHmac('sha256', sharedSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function createSharedSecretTokenGenerator(config: SharedSecretEnvironmentConfig): () => Promise<string> {
  const snapshot = snapshotResolvedEnvironmentConfig(config);
  if (snapshot.authMode !== 'shared-secret') {
    throw new OcpValidationError('authMode', 'shared-secret token generation requires shared-secret auth mode.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'shared-secret',
      receivedValue: snapshot.authMode,
    });
  }
  const audience = snapshot.audience ?? 'https://canton.network.global';
  const subject = snapshot.userId ?? 'ledger-api-user';
  const { sharedSecret } = snapshot;
  return async () => {
    await Promise.resolve();
    return createSharedSecretJwt(sharedSecret, audience, subject);
  };
}

function buildAuthConfig(config: EnvironmentConfig): AuthConfig {
  if (config.authMode === 'shared-secret') {
    return {
      grantType: 'client_credentials',
      clientId: config.clientId,
      ...(config.audience ? { audience: config.audience } : {}),
      ...(config.scope ? { scope: config.scope } : {}),
      tokenGenerator: createSharedSecretTokenGenerator(config),
    };
  }

  return {
    grantType: 'client_credentials',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    ...(config.audience ? { audience: config.audience } : {}),
    ...(config.scope ? { scope: config.scope } : {}),
  };
}

function apiConfig(apiUrl: string | undefined, auth: AuthConfig, config: EnvironmentConfig): ApiConfig | undefined {
  if (!apiUrl) {
    return undefined;
  }

  return {
    apiUrl,
    auth,
    ...(config.partyId ? { partyId: config.partyId } : {}),
    ...(config.userId ? { userId: config.userId } : {}),
  };
}

export function toResolvedCantonConfig(config: EnvironmentConfig): CantonConfig {
  const snapshot = snapshotResolvedEnvironmentConfig(config);
  const auth = buildAuthConfig(snapshot);
  const ledger = apiConfig(snapshot.ledgerApiUrl, auth, snapshot);
  const validator = apiConfig(snapshot.validatorApiUrl, auth, snapshot);
  const scan = apiConfig(snapshot.scanApiUrl, auth, snapshot);

  return {
    network: toCantonNetwork(snapshot.environment),
    ...(snapshot.provider ? { provider: snapshot.provider } : {}),
    ...(snapshot.authUrl ? { authUrl: snapshot.authUrl } : {}),
    ...(snapshot.partyId ? { partyId: snapshot.partyId } : {}),
    ...(snapshot.userId ? { userId: snapshot.userId } : {}),
    ...(snapshot.managedParties ? { managedParties: [...snapshot.managedParties] } : {}),
    ...(snapshot.debug !== undefined ? { debug: snapshot.debug } : {}),
    apis: {
      ...(ledger ? { LEDGER_JSON_API: ledger } : {}),
      ...(validator ? { VALIDATOR_API: validator } : {}),
      ...(scan ? { SCAN_API: scan } : {}),
    },
  };
}

export function toCantonConfig(input: EnvironmentConfigInput): CantonConfig {
  return toResolvedCantonConfig(resolveEnvironmentConfig(input));
}
