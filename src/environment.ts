import type { ApiConfig, AuthConfig, CantonConfig, NetworkType } from '@fairmint/canton-node-sdk';
import { createHmac } from 'crypto';
import { OcpErrorCodes, OcpValidationError, type OcpErrorCode, type OcpErrorContext } from './errors';

export type OcpEnvironment = 'localnet' | 'scratchnet' | 'devnet' | 'testnet' | 'mainnet' | 'custom';
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

type EnvironmentConfigCandidateLike = EnvironmentConfigCandidateInput | EnvironmentConfigCandidate;

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
    const value = env[name];
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

function configWithPreset(input: EnvironmentConfigCandidateLike): EnvironmentConfigCandidate {
  const preset: EnvironmentPreset | undefined = isOcpEnvironment(input.environment)
    ? ENVIRONMENT_PRESETS[input.environment]
    : undefined;
  const authMode = input.authMode ?? preset?.authMode;
  const authPreset = preset?.authMode === authMode ? preset : undefined;
  return {
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
  };
}

const DIRECT_OPTIONAL_STRING_FIELDS = [
  'ledgerApiUrl',
  'validatorApiUrl',
  'scanApiUrl',
  'authMode',
  'authUrl',
  'clientId',
  'clientSecret',
  'sharedSecret',
  'provider',
  'partyId',
  'party',
  'userId',
  'audience',
  'scope',
] as const satisfies ReadonlyArray<keyof EnvironmentConfigCandidateInput>;

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateDirectConfigInput(input: unknown): readonly ConfigurationIssue[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Object.freeze([
      configurationIssue('environmentConfig', 'configuration must be an object.', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: input,
      }),
    ]);
  }

  const candidate = input as Record<string, unknown>;
  const issues: ConfigurationIssue[] = [];
  if (typeof candidate.environment !== 'string') {
    issues.push(
      configurationIssue('environment', 'environment must be a string.', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: candidate.environment,
      })
    );
  }

  for (const field of DIRECT_OPTIONAL_STRING_FIELDS) {
    if (!hasOwn(candidate, field)) {
      continue;
    }
    const value = candidate[field];
    if (value === null) {
      issues.push(
        configurationIssue(field, `${field} must not be null; omit the property to use a preset or default.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string or omitted',
          receivedValue: value,
        })
      );
    } else if (value === undefined) {
      issues.push(
        configurationIssue(field, `${field} must be omitted rather than set to undefined.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string or omitted',
        })
      );
    } else if (typeof value !== 'string') {
      issues.push(
        configurationIssue(field, `${field} must be a string.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string',
          receivedValue: value,
        })
      );
    }
  }

  if (hasOwn(candidate, 'managedParties')) {
    const { managedParties } = candidate;
    if (managedParties === null) {
      issues.push(
        configurationIssue(
          'managedParties',
          'managedParties must not be null; omit the property to use a preset or default.',
          { code: OcpErrorCodes.INVALID_TYPE, expectedType: 'array of strings or omitted', receivedValue: null }
        )
      );
    } else if (managedParties === undefined) {
      issues.push(
        configurationIssue('managedParties', 'managedParties must be omitted rather than set to undefined.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'array of strings or omitted',
        })
      );
    } else if (!Array.isArray(managedParties) || managedParties.some((party) => typeof party !== 'string')) {
      issues.push(
        configurationIssue('managedParties', 'managedParties must be an array of strings.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'array of strings',
          receivedValue: managedParties,
        })
      );
    }
  }

  if (hasOwn(candidate, 'debug')) {
    const { debug } = candidate;
    if (debug === null) {
      issues.push(
        configurationIssue('debug', 'debug must not be null; omit the property to use a preset or default.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean or omitted',
          receivedValue: null,
        })
      );
    } else if (debug === undefined) {
      issues.push(
        configurationIssue('debug', 'debug must be omitted rather than set to undefined.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean or omitted',
        })
      );
    } else if (typeof debug !== 'boolean') {
      issues.push(
        configurationIssue('debug', 'debug must be a boolean.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean',
          receivedValue: debug,
        })
      );
    }
  }

  const preset =
    typeof candidate.environment === 'string' && isOcpEnvironment(candidate.environment)
      ? ENVIRONMENT_PRESETS[candidate.environment]
      : undefined;
  const authMode = typeof candidate.authMode === 'string' ? candidate.authMode : preset?.authMode;
  if (authMode === 'oauth2' && typeof candidate.sharedSecret === 'string') {
    issues.push(configurationIssue('sharedSecret', 'sharedSecret is not allowed for oauth2 auth mode.'));
  }
  if (authMode === 'shared-secret') {
    if (typeof candidate.authUrl === 'string') {
      issues.push(configurationIssue('authUrl', 'authUrl is not allowed for shared-secret auth mode.'));
    }
    if (typeof candidate.clientSecret === 'string') {
      issues.push(configurationIssue('clientSecret', 'clientSecret is not allowed for shared-secret auth mode.'));
    }
  }

  return Object.freeze(issues);
}

const ENVIRONMENT_OVERRIDE_STRING_FIELDS = [
  'environment',
  ...DIRECT_OPTIONAL_STRING_FIELDS,
] as const satisfies ReadonlyArray<keyof EnvironmentConfigOverrides>;

function validateEnvironmentConfigOverrides(input: unknown): readonly ConfigurationIssue[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Object.freeze([
      configurationIssue('environmentOverrides', 'environment overrides must be an object.', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: input,
      }),
    ]);
  }

  const overrides = input as Record<string, unknown>;
  const issues: ConfigurationIssue[] = [];
  for (const field of ENVIRONMENT_OVERRIDE_STRING_FIELDS) {
    if (!hasOwn(overrides, field)) {
      continue;
    }
    const value = overrides[field];
    if (value === null) {
      issues.push(
        configurationIssue(
          field,
          `${field} override must not be null; omit it or use undefined to preserve the environment value.`,
          { code: OcpErrorCodes.INVALID_TYPE, expectedType: 'string or omitted', receivedValue: value }
        )
      );
    } else if (value !== undefined && typeof value !== 'string') {
      issues.push(
        configurationIssue(field, `${field} override must be a string.`, {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string',
          receivedValue: value,
        })
      );
    }
  }

  if (hasOwn(overrides, 'managedParties')) {
    const { managedParties } = overrides;
    if (managedParties === null) {
      issues.push(
        configurationIssue(
          'managedParties',
          'managedParties override must not be null; omit it or use undefined to preserve the environment value.',
          { code: OcpErrorCodes.INVALID_TYPE, expectedType: 'array of strings or omitted', receivedValue: null }
        )
      );
    } else if (
      managedParties !== undefined &&
      (!Array.isArray(managedParties) || managedParties.some((party) => typeof party !== 'string'))
    ) {
      issues.push(
        configurationIssue('managedParties', 'managedParties override must be an array of strings.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'array of strings',
          receivedValue: managedParties,
        })
      );
    }
  }

  if (hasOwn(overrides, 'debug')) {
    const { debug } = overrides;
    if (debug === null) {
      issues.push(
        configurationIssue(
          'debug',
          'debug override must not be null; omit it or use undefined to preserve the environment value.',
          { code: OcpErrorCodes.INVALID_TYPE, expectedType: 'boolean or omitted', receivedValue: null }
        )
      );
    } else if (debug !== undefined && typeof debug !== 'boolean') {
      issues.push(
        configurationIssue('debug', 'debug override must be a boolean.', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'boolean',
          receivedValue: debug,
        })
      );
    }
  }

  return Object.freeze(issues);
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

  if (['devnet', 'testnet', 'mainnet'].includes(config.environment) && isLocalUrl(config.ledgerApiUrl)) {
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

function validateConfigCandidate(input: EnvironmentConfigCandidateLike): ConfigurationValidation {
  return validateResolvedConfigCandidate(configWithPreset(input));
}

export function validateConfig(input: EnvironmentConfigCandidateInput): ValidationResult {
  const directInputIssues = validateDirectConfigInput(input);
  if (directInputIssues.length > 0) {
    return freezeValidation(directInputIssues).result;
  }
  return validateConfigCandidate(input).result;
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

function resolveEnvironmentConfigCandidate(input: EnvironmentConfigCandidateLike): EnvironmentConfig {
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
  const directInputIssues = validateDirectConfigInput(input);
  if (directInputIssues.length > 0) {
    throwConfigurationIssues(directInputIssues);
  }
  return resolveEnvironmentConfigCandidate(input);
}

export function detectEnvironment(ledgerApiUrl: string): OcpEnvironment {
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
  if (tokens.has('mainnet')) {
    return 'mainnet';
  }

  return 'custom';
}

export function loadEnvironmentConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  overrides: EnvironmentConfigOverrides = {}
): EnvironmentConfig {
  const overrideIssues = validateEnvironmentConfigOverrides(overrides);
  if (overrideIssues.length > 0) {
    throwConfigurationIssues(overrideIssues);
  }

  const ledgerApiUrl = overrides.ledgerApiUrl ?? envValue(env, 'CANTON_LEDGER_API_URL', 'CANTON_LEDGER_JSON_API_URL');
  const rawEnvironment =
    overrides.environment ?? envValue(env, 'CANTON_ENVIRONMENT', 'CANTON_CURRENT_NETWORK') ?? undefined;
  const environment = rawEnvironment
    ? parseOcpEnvironment(rawEnvironment)
    : ledgerApiUrl
      ? detectEnvironment(ledgerApiUrl)
      : 'localnet';
  const rawAuthMode = overrides.authMode ?? envValue(env, 'CANTON_AUTH_MODE');
  const normalizedAuthMode = rawAuthMode?.toLowerCase();
  const authMode = normalizedAuthMode;
  const hasPartyOverride = overrides.partyId !== undefined || overrides.party !== undefined;
  const envPartyId = envValue(env, 'CANTON_PARTY_ID');
  const envPartyAlias = envValue(env, 'CANTON_PARTY');
  const partyId = hasPartyOverride ? (overrides.partyId ?? overrides.party) : (envPartyId ?? envPartyAlias);
  const party = hasPartyOverride ? overrides.party : envPartyAlias;

  const candidate: EnvironmentConfigCandidate = {
    environment,
    ledgerApiUrl,
    validatorApiUrl: overrides.validatorApiUrl ?? envValue(env, 'CANTON_VALIDATOR_API_URL', 'CANTON_VALIDATOR_API_URI'),
    scanApiUrl: overrides.scanApiUrl ?? envValue(env, 'CANTON_SCAN_API_URL', 'CANTON_SCAN_API_URI'),
    authMode,
    authUrl: overrides.authUrl ?? envValue(env, 'CANTON_AUTH_URL'),
    clientId: overrides.clientId ?? envValue(env, 'CANTON_CLIENT_ID'),
    clientSecret: overrides.clientSecret ?? envValue(env, 'CANTON_CLIENT_SECRET'),
    sharedSecret: overrides.sharedSecret ?? envValue(env, 'CANTON_SHARED_SECRET'),
    provider: overrides.provider ?? envValue(env, 'CANTON_PROVIDER', 'CANTON_CURRENT_PROVIDER'),
    partyId,
    userId: overrides.userId ?? envValue(env, 'CANTON_USER_ID'),
    managedParties: overrides.managedParties ?? parseManagedParties(envValue(env, 'CANTON_MANAGED_PARTIES')),
    audience: overrides.audience ?? envValue(env, 'CANTON_AUDIENCE'),
    scope: overrides.scope ?? envValue(env, 'CANTON_SCOPE'),
    debug: overrides.debug ?? parseBoolean(envValue(env, 'CANTON_DEBUG')),
    party,
  };

  return resolveEnvironmentConfigCandidate(candidate);
}

export function toCantonNetwork(environment: OcpEnvironment): NetworkType {
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
  const audience = config.audience ?? 'https://canton.network.global';
  const subject = config.userId ?? 'ledger-api-user';
  return async () => {
    await Promise.resolve();
    return createSharedSecretJwt(config.sharedSecret, audience, subject);
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
  const auth = buildAuthConfig(config);
  const ledger = apiConfig(config.ledgerApiUrl, auth, config);
  const validator = apiConfig(config.validatorApiUrl, auth, config);
  const scan = apiConfig(config.scanApiUrl, auth, config);

  return {
    network: toCantonNetwork(config.environment),
    ...(config.provider ? { provider: config.provider } : {}),
    ...(config.authUrl ? { authUrl: config.authUrl } : {}),
    ...(config.partyId ? { partyId: config.partyId } : {}),
    ...(config.userId ? { userId: config.userId } : {}),
    ...(config.managedParties ? { managedParties: [...config.managedParties] } : {}),
    ...(config.debug !== undefined ? { debug: config.debug } : {}),
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
