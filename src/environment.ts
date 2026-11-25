import type { ApiConfig, AuthConfig, CantonConfig, NetworkType } from '@fairmint/canton-node-sdk';
import { createHmac } from 'crypto';

export type OcpEnvironment = 'localnet' | 'scratchnet' | 'devnet' | 'testnet' | 'mainnet' | 'custom';
export type OcpAuthMode = 'shared-secret' | 'oauth2';

export interface EnvironmentConfig {
  environment: OcpEnvironment;
  ledgerApiUrl: string;
  validatorApiUrl?: string;
  scanApiUrl?: string;
  authMode: OcpAuthMode;
  authUrl?: string;
  clientId?: string;
  clientSecret?: string;
  sharedSecret?: string;
  provider?: string;
  partyId?: string;
  party?: string;
  userId?: string;
  managedParties?: string[];
  audience?: string;
  scope?: string;
  debug?: boolean;
}

export type EnvironmentConfigInput = Partial<EnvironmentConfig> & Pick<EnvironmentConfig, 'environment'>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type EnvironmentPreset = Partial<EnvironmentConfig> & Pick<EnvironmentConfig, 'environment' | 'authMode'>;
type EnvironmentConfigCandidateInput = Omit<Partial<EnvironmentConfig>, 'environment' | 'authMode'> & {
  environment: string;
  authMode?: string;
};
type EnvironmentConfigCandidate = Omit<Partial<EnvironmentConfig>, 'environment' | 'authMode'> & {
  environment: string;
  authMode?: string;
};

export const LOCALNET_PRESET: EnvironmentPreset = {
  environment: 'localnet',
  ledgerApiUrl: 'http://localhost:3975',
  validatorApiUrl: 'http://localhost:3903',
  scanApiUrl: 'http://localhost:4000/api/scan',
  authMode: 'shared-secret',
  provider: 'app-provider',
  clientId: 'ocp-sdk',
  sharedSecret: 'unsafe',
};

export const SCRATCHNET_PRESET: EnvironmentPreset = {
  environment: 'scratchnet',
  authMode: 'oauth2',
};

export const DEVNET_PRESET: EnvironmentPreset = {
  environment: 'devnet',
  authMode: 'oauth2',
};

export const TESTNET_PRESET: EnvironmentPreset = {
  environment: 'testnet',
  authMode: 'oauth2',
};

export const MAINNET_PRESET: EnvironmentPreset = {
  environment: 'mainnet',
  authMode: 'oauth2',
};

export const CUSTOM_PRESET: EnvironmentPreset = {
  environment: 'custom',
  authMode: 'oauth2',
};

export const ENVIRONMENT_PRESETS: Record<OcpEnvironment, EnvironmentPreset> = {
  localnet: LOCALNET_PRESET,
  scratchnet: SCRATCHNET_PRESET,
  devnet: DEVNET_PRESET,
  testnet: TESTNET_PRESET,
  mainnet: MAINNET_PRESET,
  custom: CUSTOM_PRESET,
};

const ENVIRONMENTS = Object.keys(ENVIRONMENT_PRESETS) as OcpEnvironment[];
const AUTH_MODES: OcpAuthMode[] = ['shared-secret', 'oauth2'];

function isOcpEnvironment(value: string): value is OcpEnvironment {
  return ENVIRONMENTS.includes(value as OcpEnvironment);
}

function isOcpAuthMode(value: string): value is OcpAuthMode {
  return AUTH_MODES.includes(value as OcpAuthMode);
}

function parseOcpEnvironment(value: string): OcpEnvironment {
  const normalized = value.toLowerCase();
  if (!isOcpEnvironment(normalized)) {
    throw new Error(
      `Invalid Canton environment configuration: Unsupported Canton environment: ${value}. Expected one of: ${ENVIRONMENTS.join(', ')}`
    );
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
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || parsed.hostname.endsWith('.localhost');
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

function trimManagedParties(managedParties: string[] | undefined): string[] | undefined {
  const trimmed = managedParties
    ?.map((party) => trimOptionalString(party))
    .filter((party): party is string => party !== undefined);
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

function omitUndefined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function configWithPreset(input: EnvironmentConfigCandidateInput): EnvironmentConfigCandidate {
  const preset: Partial<EnvironmentConfig> = isOcpEnvironment(input.environment)
    ? ENVIRONMENT_PRESETS[input.environment]
    : {};
  const definedInput = omitUndefined(input);
  return {
    ...preset,
    ...definedInput,
    environment: input.environment,
    partyId: firstNonBlank(input.partyId, input.party, preset.partyId, preset.party),
  };
}

export function validateConfig(input: EnvironmentConfigCandidateInput): ValidationResult {
  const config = configWithPreset(input);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isOcpEnvironment(config.environment)) {
    errors.push(`Unsupported Canton environment: ${String(config.environment)}`);
  }

  if (isBlank(config.ledgerApiUrl)) {
    errors.push('ledgerApiUrl is required. Set it explicitly or provide CANTON_LEDGER_API_URL.');
  }

  const detectedEnvironment = config.ledgerApiUrl ? detectEnvironment(config.ledgerApiUrl) : undefined;
  if (
    detectedEnvironment !== undefined &&
    detectedEnvironment !== 'custom' &&
    config.environment !== 'custom' &&
    detectedEnvironment !== config.environment
  ) {
    errors.push(`ledgerApiUrl appears to target ${detectedEnvironment}, but environment is ${config.environment}.`);
  }

  if (config.authMode === undefined || !isOcpAuthMode(config.authMode)) {
    errors.push(`authMode must be one of: ${AUTH_MODES.join(', ')}`);
  }

  if (config.authMode === 'oauth2') {
    if (isBlank(config.authUrl)) {
      errors.push('authUrl is required for oauth2 auth mode.');
    }
    if (isBlank(config.clientId)) {
      errors.push('clientId is required for oauth2 auth mode.');
    }
    if (isBlank(config.clientSecret)) {
      errors.push('clientSecret is required for oauth2 auth mode.');
    }
  }

  if (config.authMode === 'shared-secret') {
    if (config.environment === 'mainnet') {
      errors.push('shared-secret auth mode is not allowed for mainnet.');
    }
    if (config.environment !== 'localnet' && isBlank(config.sharedSecret)) {
      errors.push('sharedSecret is required for shared-secret auth mode outside localnet.');
    }
  }

  if (config.environment === 'localnet') {
    for (const [name, url] of [
      ['ledgerApiUrl', config.ledgerApiUrl],
      ['validatorApiUrl', config.validatorApiUrl],
      ['scanApiUrl', config.scanApiUrl],
    ] as const) {
      if (url && !isLocalUrl(url)) {
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

  if (config.validatorApiUrl === undefined) {
    warnings.push('validatorApiUrl is not set; validator-backed helpers will rely on Canton defaults if available.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function resolveEnvironmentConfig(input: EnvironmentConfigCandidateInput): EnvironmentConfig {
  const config = configWithPreset(input);
  const result = validateConfig(config);

  if (!result.valid) {
    throw new Error(`Invalid Canton environment configuration: ${result.errors.join('; ')}`);
  }

  return {
    environment: config.environment as OcpEnvironment,
    ledgerApiUrl: trimOptionalString(config.ledgerApiUrl) as string,
    validatorApiUrl: trimOptionalString(config.validatorApiUrl),
    scanApiUrl: trimOptionalString(config.scanApiUrl),
    authMode: config.authMode as OcpAuthMode,
    authUrl: trimOptionalString(config.authUrl),
    clientId: trimOptionalString(config.clientId),
    clientSecret: trimOptionalString(config.clientSecret),
    sharedSecret: trimOptionalString(config.sharedSecret),
    provider: trimOptionalString(config.provider),
    partyId: trimOptionalString(config.partyId),
    party: trimOptionalString(config.party),
    userId: trimOptionalString(config.userId),
    managedParties: trimManagedParties(config.managedParties),
    audience: trimOptionalString(config.audience),
    scope: trimOptionalString(config.scope),
    debug: config.debug,
  };
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
  overrides: Partial<EnvironmentConfigInput> = {}
): EnvironmentConfig {
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

  return resolveEnvironmentConfig({
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
    partyId: overrides.partyId ?? overrides.party ?? envValue(env, 'CANTON_PARTY_ID', 'CANTON_PARTY'),
    userId: overrides.userId ?? envValue(env, 'CANTON_USER_ID'),
    managedParties: overrides.managedParties ?? parseManagedParties(envValue(env, 'CANTON_MANAGED_PARTIES')),
    audience: overrides.audience ?? envValue(env, 'CANTON_AUDIENCE'),
    scope: overrides.scope ?? envValue(env, 'CANTON_SCOPE'),
    debug: overrides.debug ?? parseBoolean(envValue(env, 'CANTON_DEBUG')),
  });
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

export function createSharedSecretTokenGenerator(config: EnvironmentConfig): () => Promise<string> {
  const sharedSecret = config.sharedSecret ?? (config.environment === 'localnet' ? 'unsafe' : undefined);
  if (!sharedSecret) {
    throw new Error('sharedSecret is required for shared-secret auth mode outside localnet.');
  }

  const audience = config.audience ?? 'https://canton.network.global';
  const subject = config.userId ?? 'ledger-api-user';
  return async () => {
    await Promise.resolve();
    return createSharedSecretJwt(sharedSecret, audience, subject);
  };
}

function buildAuthConfig(config: EnvironmentConfig): AuthConfig {
  if (config.authMode === 'shared-secret') {
    return {
      grantType: 'client_credentials',
      clientId: config.clientId ?? 'ocp-sdk',
      ...(config.audience ? { audience: config.audience } : {}),
      ...(config.scope ? { scope: config.scope } : {}),
      tokenGenerator: createSharedSecretTokenGenerator(config),
    };
  }

  return {
    grantType: 'client_credentials',
    clientId: config.clientId as string,
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
    ...(config.managedParties ? { managedParties: config.managedParties } : {}),
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
