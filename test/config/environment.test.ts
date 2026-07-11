import type { EnvironmentConfigOverrides } from '../../src/environment';
import {
  detectEnvironment,
  loadEnvironmentConfigFromEnv,
  LOCALNET_PRESET,
  resolveEnvironmentConfig,
  toCantonConfig,
  toResolvedCantonConfig,
  validateConfig,
} from '../../src/environment';

describe('environment configuration', () => {
  it('provides a LocalNet preset with cn-quickstart endpoints', () => {
    expect(LOCALNET_PRESET).toMatchObject({
      environment: 'localnet',
      ledgerApiUrl: 'http://localhost:3975',
      validatorApiUrl: 'http://localhost:3903',
      authMode: 'shared-secret',
    });
  });

  it('detects common environments from ledger API URLs', () => {
    expect(detectEnvironment('http://localhost:3975')).toBe('localnet');
    expect(detectEnvironment('https://ledger.devnet.example.com')).toBe('devnet');
    expect(detectEnvironment('https://ledger.testnet.example.com')).toBe('testnet');
    expect(detectEnvironment('https://ledger.mainnet.example.com')).toBe('mainnet');
    expect(detectEnvironment('https://ledger.scratchnet.example.com')).toBe('scratchnet');
    expect(detectEnvironment('https://ledger.internal.example.com')).toBe('custom');
  });

  it('does not detect environments from unrelated URL substrings', () => {
    expect(detectEnvironment('https://ledger.contestnet.example.com')).toBe('custom');
    expect(detectEnvironment('https://scratchpad.example.com/ledger')).toBe('custom');
    expect(detectEnvironment('https://ledger.example.com/testnet/v1')).toBe('testnet');
  });

  it('validates oauth2 credentials and warns for production', () => {
    const result = validateConfig({
      environment: 'mainnet',
      ledgerApiUrl: 'https://ledger.mainnet.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('mainnet configuration targets production Canton services.');
  });

  it('rejects incomplete oauth2 config', () => {
    const result = validateConfig({
      environment: 'devnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      authMode: 'oauth2',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'authUrl is required for oauth2 auth mode.',
      'clientId is required for oauth2 auth mode.',
      'clientSecret is required for oauth2 auth mode.',
    ]);
  });

  it('loads environment config from CANTON_* variables', () => {
    const config = loadEnvironmentConfigFromEnv({
      CANTON_LEDGER_API_URL: ' https://ledger.devnet.example.com ',
      CANTON_VALIDATOR_API_URL: 'https://validator.devnet.example.com',
      CANTON_SCAN_API_URL: 'https://scan.devnet.example.com',
      CANTON_ENVIRONMENT: 'DevNet',
      CANTON_AUTH_MODE: 'OAUTH2',
      CANTON_AUTH_URL: 'https://auth.example.com/token',
      CANTON_CLIENT_ID: 'client-id',
      CANTON_CLIENT_SECRET: ' client-secret ',
      CANTON_PROVIDER: '5n',
      CANTON_PARTY_ID: 'issuer::party',
      CANTON_MANAGED_PARTIES: 'issuer::party,holder::party',
      CANTON_AUDIENCE: 'https://devnet.example.com',
      CANTON_SCOPE: 'openid canton',
      CANTON_DEBUG: 'true',
    });

    expect(config).toMatchObject({
      environment: 'devnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      validatorApiUrl: 'https://validator.devnet.example.com',
      scanApiUrl: 'https://scan.devnet.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      provider: '5n',
      partyId: 'issuer::party',
      managedParties: ['issuer::party', 'holder::party'],
      audience: 'https://devnet.example.com',
      scope: 'openid canton',
      debug: true,
    });
  });

  it('maps CANTON_PARTY to canonical partyId while keeping party override-only', () => {
    const config = loadEnvironmentConfigFromEnv({ CANTON_PARTY: ' issuer::party ' });

    expect(config.partyId).toBe('issuer::party');
    expect(config.party).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(config, 'party')).toBe(true);
  });

  it('preserves an explicit party override while canonicalizing partyId', () => {
    const config = loadEnvironmentConfigFromEnv({}, { party: ' issuer::party ' });

    expect(config.partyId).toBe('issuer::party');
    expect(config.party).toBe('issuer::party');
  });

  it('keeps LocalNet preset defaults when env variables are omitted', () => {
    const config = loadEnvironmentConfigFromEnv({});

    expect(config).toMatchObject({
      environment: 'localnet',
      ledgerApiUrl: 'http://localhost:3975',
      validatorApiUrl: 'http://localhost:3903',
      scanApiUrl: 'http://localhost:4000/api/scan',
      authMode: 'shared-secret',
      sharedSecret: 'unsafe',
    });
  });

  it('keeps LocalNet preset defaults when env-loader overrides are explicitly undefined internally', () => {
    const config = loadEnvironmentConfigFromEnv({}, {
      ledgerApiUrl: undefined,
      authMode: undefined,
      clientId: undefined,
      sharedSecret: undefined,
    } as unknown as EnvironmentConfigOverrides);

    expect(config).toMatchObject({
      environment: 'localnet',
      ledgerApiUrl: 'http://localhost:3975',
      authMode: 'shared-secret',
      clientId: 'ocp-sdk',
      sharedSecret: 'unsafe',
    });
  });

  it('rejects explicit null env-loader overrides instead of treating them as omission', () => {
    expect(() => loadEnvironmentConfigFromEnv({}, { ledgerApiUrl: null } as never)).toThrow(
      'ledgerApiUrl override must not be null'
    );
  });

  test.each([
    ['authMode', { environment: 'localnet', authMode: null }, 'authMode must not be null'],
    ['ledgerApiUrl', { environment: 'localnet', ledgerApiUrl: null }, 'ledgerApiUrl must not be null'],
    ['sharedSecret', { environment: 'localnet', sharedSecret: null }, 'sharedSecret must not be null'],
  ])('rejects an explicit null %s before applying LocalNet presets', (_field, input, expectedMessage) => {
    expect(() => resolveEnvironmentConfig(input as never)).toThrow(expectedMessage);
  });

  it('rejects explicit undefined from direct callers instead of treating it as omission', () => {
    expect(() => resolveEnvironmentConfig({ environment: 'localnet', ledgerApiUrl: undefined } as never)).toThrow(
      'ledgerApiUrl must be omitted rather than set to undefined'
    );
  });

  it('does not borrow shared-secret preset credentials for LocalNet OAuth2', () => {
    expect(() =>
      resolveEnvironmentConfig({
        environment: 'localnet',
        authMode: 'oauth2',
        authUrl: 'https://auth.example.com/token',
        clientSecret: 'client-secret',
      } as never)
    ).toThrow('clientId is required for oauth2 auth mode');
  });

  it('combines explicit LocalNet OAuth2 credentials with neutral endpoint presets', () => {
    const config = resolveEnvironmentConfig({
      environment: 'localnet',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'oauth-client',
      clientSecret: 'client-secret',
    });

    expect(config).toMatchObject({
      environment: 'localnet',
      ledgerApiUrl: 'http://localhost:3975',
      validatorApiUrl: 'http://localhost:3903',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'oauth-client',
      clientSecret: 'client-secret',
      sharedSecret: undefined,
    });
  });

  test.each([
    [
      'sharedSecret with OAuth2',
      {
        environment: 'devnet',
        ledgerApiUrl: 'https://ledger.devnet.example.com',
        authMode: 'oauth2',
        authUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        sharedSecret: 'unused-secret',
      },
      'sharedSecret is not allowed for oauth2 auth mode',
    ],
    [
      'authUrl with shared-secret auth',
      {
        environment: 'custom',
        ledgerApiUrl: 'https://ledger.example.com',
        authMode: 'shared-secret',
        sharedSecret: 'shared-secret',
        authUrl: 'https://auth.example.com/token',
      },
      'authUrl is not allowed for shared-secret auth mode',
    ],
    [
      'clientSecret with shared-secret auth',
      {
        environment: 'custom',
        ledgerApiUrl: 'https://ledger.example.com',
        authMode: 'shared-secret',
        sharedSecret: 'shared-secret',
        clientSecret: 'unused-secret',
      },
      'clientSecret is not allowed for shared-secret auth mode',
    ],
  ])('rejects incompatible credential input: %s', (_case, input, expectedMessage) => {
    expect(() => resolveEnvironmentConfig(input as never)).toThrow(expectedMessage);
  });

  it('rejects incompatible credentials loaded from environment variables', () => {
    expect(() =>
      loadEnvironmentConfigFromEnv({
        CANTON_ENVIRONMENT: 'devnet',
        CANTON_LEDGER_API_URL: 'https://ledger.devnet.example.com',
        CANTON_AUTH_MODE: 'oauth2',
        CANTON_AUTH_URL: 'https://auth.example.com/token',
        CANTON_CLIENT_ID: 'client-id',
        CANTON_CLIENT_SECRET: 'client-secret',
        CANTON_SHARED_SECRET: 'unused-secret',
      })
    ).toThrow('sharedSecret is not allowed for oauth2 auth mode');

    expect(() =>
      loadEnvironmentConfigFromEnv({
        CANTON_AUTH_MODE: 'shared-secret',
        CANTON_AUTH_URL: 'https://auth.example.com/token',
      })
    ).toThrow('authUrl is not allowed for shared-secret auth mode');
  });

  it('rejects invalid CANTON_AUTH_MODE values', () => {
    expect(() =>
      loadEnvironmentConfigFromEnv({
        CANTON_LEDGER_API_URL: 'https://ledger.devnet.example.com',
        CANTON_AUTH_MODE: 'password',
      })
    ).toThrow('authMode must be one of: shared-secret, oauth2');
  });

  it('rejects unknown CANTON_ENVIRONMENT values instead of treating them as custom', () => {
    expect(() =>
      loadEnvironmentConfigFromEnv({
        CANTON_ENVIRONMENT: 'mainent',
        CANTON_LEDGER_API_URL: 'https://ledger.mainnet.example.com',
      })
    ).toThrow('Unsupported Canton environment: mainent');
  });

  it('reports unsupported direct environment inputs without throwing from preset lookup', () => {
    const result = validateConfig({
      environment: 'mystery',
      ledgerApiUrl: 'https://ledger.internal.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported Canton environment: mystery');
  });

  it('rejects explicit environment labels that conflict with recognized ledger URLs', () => {
    const result = validateConfig({
      environment: 'mainnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('ledgerApiUrl appears to target devnet, but environment is mainnet.');
  });

  it('rejects shared-secret auth outside LocalNet without an explicit secret', () => {
    const result = validateConfig({
      environment: 'devnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      authMode: 'shared-secret',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('sharedSecret is required for shared-secret auth mode outside localnet.');
  });

  it('trims direct config string fields when resolving', () => {
    const config = resolveEnvironmentConfig({
      environment: 'devnet',
      ledgerApiUrl: ' https://ledger.devnet.example.com ',
      validatorApiUrl: ' https://validator.devnet.example.com ',
      scanApiUrl: ' https://scan.devnet.example.com ',
      authMode: 'oauth2',
      authUrl: ' https://auth.example.com/token ',
      clientId: ' client-id ',
      clientSecret: ' client-secret ',
      provider: ' 5n ',
      partyId: ' issuer::party ',
      userId: ' sdk-user ',
      managedParties: [' issuer::party ', ' ', 'holder::party'],
      audience: ' https://devnet.example.com ',
      scope: ' openid canton ',
    });

    expect(config).toMatchObject({
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      validatorApiUrl: 'https://validator.devnet.example.com',
      scanApiUrl: 'https://scan.devnet.example.com',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      provider: '5n',
      partyId: 'issuer::party',
      userId: 'sdk-user',
      managedParties: ['issuer::party', 'holder::party'],
      audience: 'https://devnet.example.com',
      scope: 'openid canton',
    });
  });

  it('resolves OAuth2 input into an exhaustive discriminated runtime state', () => {
    const config = resolveEnvironmentConfig({
      environment: 'devnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(config.authMode).toBe('oauth2');
    if (config.authMode !== 'oauth2') {
      throw new Error('Expected OAuth2 configuration');
    }
    expect(config.authUrl).toBe('https://auth.example.com/token');
    expect(config.clientId).toBe('client-id');
    expect(config.clientSecret).toBe('client-secret');
    expect(config.sharedSecret).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(config, 'sharedSecret')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(config, 'validatorApiUrl')).toBe(true);
  });

  it('resolves LocalNet into shared-secret state without OAuth2 credential placeholders', () => {
    const config = resolveEnvironmentConfig({ environment: 'localnet' });

    expect(config.authMode).toBe('shared-secret');
    if (config.authMode !== 'shared-secret') {
      throw new Error('Expected shared-secret configuration');
    }
    expect(config.sharedSecret).toBe('unsafe');
    expect(config.clientId).toBe('ocp-sdk');
    expect(config.authUrl).toBeUndefined();
    expect(config.clientSecret).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(config, 'authUrl')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(config, 'clientSecret')).toBe(true);

    const cantonConfig = toResolvedCantonConfig(config);
    expect(cantonConfig).not.toHaveProperty('authUrl');
    expect(cantonConfig.apis?.LEDGER_JSON_API?.auth).not.toHaveProperty('clientSecret');
    expect(cantonConfig.apis?.LEDGER_JSON_API?.auth.tokenGenerator).toEqual(expect.any(Function));
  });

  it('converts a resolved config to Canton SDK config', () => {
    const cantonConfig = toCantonConfig({
      environment: 'custom',
      ledgerApiUrl: 'https://ledger.internal.example.com',
      validatorApiUrl: 'https://validator.internal.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      party: 'issuer::party',
    });

    expect(cantonConfig).toMatchObject({
      network: 'localnet',
      authUrl: 'https://auth.example.com/token',
      partyId: 'issuer::party',
      apis: {
        LEDGER_JSON_API: {
          apiUrl: 'https://ledger.internal.example.com',
          auth: {
            grantType: 'client_credentials',
            clientId: 'client-id',
            clientSecret: 'client-secret',
          },
          partyId: 'issuer::party',
        },
        VALIDATOR_API: {
          apiUrl: 'https://validator.internal.example.com',
        },
      },
    });
  });

  it('creates shared-secret token generators without external JWT dependencies', async () => {
    const cantonConfig = toResolvedCantonConfig(resolveEnvironmentConfig({ environment: 'localnet' }));
    const tokenGenerator = cantonConfig.apis?.LEDGER_JSON_API?.auth.tokenGenerator;

    expect(tokenGenerator).toBeDefined();
    const token = await tokenGenerator?.();
    expect(token?.split('.')).toHaveLength(3);
  });
});
