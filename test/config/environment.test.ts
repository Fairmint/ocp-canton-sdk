import jwt from 'jsonwebtoken';
import {
  createSharedSecretTokenGenerator,
  detectEnvironment,
  ENVIRONMENT_PRESETS,
  loadEnvironmentConfigFromEnv,
  LOCALNET_PRESET,
  resolveEnvironmentConfig,
  toCantonConfig,
  toResolvedCantonConfig,
  validateConfig,
} from '../../src/environment';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';

describe('environment configuration', () => {
  it('provides a LocalNet preset with cn-quickstart endpoints', () => {
    expect(LOCALNET_PRESET).toMatchObject({
      environment: 'localnet',
      ledgerApiUrl: 'http://localhost:3975',
      validatorApiUrl: 'http://localhost:3903',
      authMode: 'shared-secret',
    });
    expect(Object.isFrozen(LOCALNET_PRESET)).toBe(true);
    expect(Object.isFrozen(ENVIRONMENT_PRESETS)).toBe(true);
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

  it('maps CANTON_PARTY to the canonical partyId-only resolved state', () => {
    const config = loadEnvironmentConfigFromEnv({ CANTON_PARTY: ' issuer::party ' });

    expect(config.partyId).toBe('issuer::party');
    expect(Object.prototype.hasOwnProperty.call(config, 'party')).toBe(false);
  });

  it('canonicalizes an explicit party alias to partyId without preserving the alias', () => {
    const config = loadEnvironmentConfigFromEnv({}, { party: ' issuer::party ' });

    expect(config.partyId).toBe('issuer::party');
    expect(Object.prototype.hasOwnProperty.call(config, 'party')).toBe(false);
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

  it('rejects explicit undefined env-loader overrides to match exact optional declarations', () => {
    expect(() =>
      loadEnvironmentConfigFromEnv(
        {},
        {
          ledgerApiUrl: undefined,
        }
      )
    ).toThrow('ledgerApiUrl must be omitted rather than set to undefined');
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

  test.each([
    ['ledgerApiUrl', 'not a url'],
    ['ledgerApiUrl', 'file:///tmp/ledger'],
    ['validatorApiUrl', 'file:///tmp/validator'],
    ['scanApiUrl', 'relative/scan'],
    ['authUrl', 'file:///tmp/token'],
  ] as const)('rejects a non-HTTP absolute %s with structured diagnostics', (fieldPath, value) => {
    const input = {
      environment: 'custom',
      ledgerApiUrl: 'https://ledger.example.com',
      validatorApiUrl: 'https://validator.example.com',
      scanApiUrl: 'https://scan.example.com',
      authMode: 'oauth2',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      [fieldPath]: value,
    };

    try {
      resolveEnvironmentConfig(input as never);
      throw new Error('Expected URL validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath,
        expectedType: 'absolute http:// or https:// URL',
        receivedValue: value,
      });
    }
  });

  it('accepts explicit HTTP localhost URLs', () => {
    const config = resolveEnvironmentConfig({
      environment: 'custom',
      ledgerApiUrl: 'http://localhost:7575',
      validatorApiUrl: 'http://127.0.0.1:7576',
      scanApiUrl: 'http://scan.localhost:7577',
      authMode: 'oauth2',
      authUrl: 'http://localhost:7578/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(config.ledgerApiUrl).toBe('http://localhost:7575');
    expect(config.authUrl).toBe('http://localhost:7578/token');
  });

  test.each([
    ['1', true],
    ['TRUE', true],
    ['yes', true],
    ['On', true],
    ['0', false],
    ['FALSE', false],
    ['no', false],
    ['Off', false],
  ] as const)('parses explicit CANTON_DEBUG token %s', (value, expected) => {
    expect(loadEnvironmentConfigFromEnv({ CANTON_DEBUG: value }).debug).toBe(expected);
  });

  it('rejects unknown nonblank CANTON_DEBUG tokens with a field-specific error', () => {
    try {
      loadEnvironmentConfigFromEnv({ CANTON_DEBUG: 'definitely' });
      throw new Error('Expected debug parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        fieldPath: 'debug',
        receivedValue: 'definitely',
      });
    }
  });

  it('rejects conflicting direct party aliases while accepting equivalent aliases', () => {
    expect(() =>
      resolveEnvironmentConfig({
        environment: 'localnet',
        partyId: 'issuer::party',
        party: 'other::party',
      })
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'party',
        receivedValue: 'other::party',
      })
    );

    const config = resolveEnvironmentConfig({
      environment: 'localnet',
      partyId: ' issuer::party ',
      party: 'issuer::party',
    });
    expect(config.partyId).toBe('issuer::party');
    expect(Object.prototype.hasOwnProperty.call(config, 'party')).toBe(false);
  });

  it('rejects conflicting environment party aliases while accepting equivalent aliases', () => {
    expect(() =>
      loadEnvironmentConfigFromEnv({
        CANTON_PARTY_ID: 'issuer::party',
        CANTON_PARTY: 'other::party',
      })
    ).toThrow(expect.objectContaining({ fieldPath: 'party', receivedValue: 'other::party' }));

    expect(
      loadEnvironmentConfigFromEnv({
        CANTON_PARTY_ID: 'issuer::party',
        CANTON_PARTY: ' issuer::party ',
      }).partyId
    ).toBe('issuer::party');
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

  it('returns frozen validation results and resolved configuration snapshots', () => {
    const invalid = validateConfig({
      environment: 'devnet',
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      authMode: 'oauth2',
    });
    expect(Object.isFrozen(invalid)).toBe(true);
    expect(Object.isFrozen(invalid.errors)).toBe(true);
    expect(Object.isFrozen(invalid.warnings)).toBe(true);
    expect(() => (invalid.errors as string[]).push('mutated')).toThrow(TypeError);

    const managedParties = ['issuer::party'];
    const resolved = resolveEnvironmentConfig({
      environment: 'localnet',
      managedParties,
    });
    managedParties.push('mutated::party');

    expect(resolved.managedParties).toEqual(['issuer::party']);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.managedParties)).toBe(true);
    expect(() => (resolved.managedParties as string[]).push('mutated::party')).toThrow(TypeError);
  });

  it('does not allow exported preset state to change later resolutions', () => {
    expect(() => {
      (ENVIRONMENT_PRESETS as Record<string, unknown>).localnet = {};
    }).toThrow(TypeError);
    expect(() => {
      (LOCALNET_PRESET as { ledgerApiUrl?: string }).ledgerApiUrl = 'https://mutated.example.com';
    }).toThrow(TypeError);

    expect(resolveEnvironmentConfig({ environment: 'localnet' }).ledgerApiUrl).toBe('http://localhost:3975');
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

  it('rejects revoked and throwing config proxies without invoking traps', () => {
    const traps = {
      get: jest.fn(() => {
        throw new Error('get trap invoked');
      }),
      ownKeys: jest.fn(() => {
        throw new Error('ownKeys trap invoked');
      }),
      getOwnPropertyDescriptor: jest.fn(() => {
        throw new Error('descriptor trap invoked');
      }),
    };
    const throwingProxy = new Proxy({}, traps);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    for (const input of [throwingProxy, revoked.proxy]) {
      expect(() => resolveEnvironmentConfig(input as never)).toThrow(
        expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'environmentConfig' })
      );
      const validation = validateConfig(input as never);
      expect(validation).toMatchObject({ valid: false });
      expect(validation.errors[0]).toContain('proxy');
    }
    expect(traps.get).not.toHaveBeenCalled();
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
  });

  it('rejects config accessors and inherited config without invoking getters', () => {
    const ownGetter = jest.fn(() => 'http://localhost:3975');
    const accessorConfig: Record<string, unknown> = { environment: 'localnet' };
    Object.defineProperty(accessorConfig, 'ledgerApiUrl', { enumerable: true, get: ownGetter });

    expect(() => resolveEnvironmentConfig(accessorConfig as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'ledgerApiUrl' })
    );
    expect(ownGetter).not.toHaveBeenCalled();

    const inheritedGetter = jest.fn(() => 'localnet');
    const prototype = {};
    Object.defineProperty(prototype, 'environment', { get: inheritedGetter });
    const inheritedConfig = Object.create(prototype);
    expect(() => resolveEnvironmentConfig(inheritedConfig as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'environmentConfig' })
    );
    expect(inheritedGetter).not.toHaveBeenCalled();
  });

  it('rejects ordinary, symbol, and non-enumerable unknown config keys', () => {
    const symbol = Symbol('unexpected');
    expect(validateConfig({ environment: 'localnet', unexpected: true } as never).valid).toBe(false);
    expect(validateConfig({ environment: 'localnet', [symbol]: true } as never).valid).toBe(false);

    const nonEnumerableUnknown = { environment: 'localnet' };
    Object.defineProperty(nonEnumerableUnknown, 'unexpected', { value: true });
    expect(validateConfig(nonEnumerableUnknown as never).valid).toBe(false);
  });

  it('accepts supported non-enumerable data properties and returns a canonical frozen snapshot', () => {
    const input = {};
    Object.defineProperty(input, 'environment', { value: 'localnet' });
    const config = resolveEnvironmentConfig(input as never);

    expect(config.environment).toBe('localnet');
    expect(Object.keys(config)).toContain('environment');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('rejects managed-party accessors and proxies without invoking them', () => {
    const getter = jest.fn(() => 'issuer::party');
    const accessorParties: string[] = [];
    accessorParties.length = 1;
    Object.defineProperty(accessorParties, '0', { enumerable: true, get: getter });
    const proxyGet = jest.fn(() => {
      throw new Error('managed party proxy invoked');
    });
    const proxiedParties = new Proxy([], { get: proxyGet });

    expect(() => resolveEnvironmentConfig({ environment: 'localnet', managedParties: accessorParties })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'managedParties.0' })
    );
    expect(() => resolveEnvironmentConfig({ environment: 'localnet', managedParties: proxiedParties })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'managedParties' })
    );
    expect(getter).not.toHaveBeenCalled();
    expect(proxyGet).not.toHaveBeenCalled();
  });

  it('rejects accessor-backed environment records and override objects without invoking them', () => {
    const envGetter = jest.fn(() => 'localnet');
    const env: Record<string, string | undefined> = {};
    Object.defineProperty(env, 'CANTON_ENVIRONMENT', { enumerable: true, get: envGetter });
    expect(() => loadEnvironmentConfigFromEnv(env)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'environmentVariables.CANTON_ENVIRONMENT' })
    );
    expect(envGetter).not.toHaveBeenCalled();

    const overrideGetter = jest.fn(() => 'oauth2');
    const overrides = {};
    Object.defineProperty(overrides, 'authMode', { enumerable: true, get: overrideGetter });
    expect(() => loadEnvironmentConfigFromEnv({}, overrides as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'authMode' })
    );
    expect(overrideGetter).not.toHaveBeenCalled();
  });

  it('validates and detaches claimed resolved configuration before public conversion', () => {
    const original = resolveEnvironmentConfig({ environment: 'localnet', managedParties: ['issuer::party'] });
    const mutable = {
      ...original,
      managedParties: [...(original.managedParties ?? [])],
    };
    const cantonConfig = toResolvedCantonConfig(mutable);
    mutable.managedParties.push('mutated::party');

    expect(cantonConfig.managedParties).toEqual(['issuer::party']);
    expect(() => toResolvedCantonConfig({ ...mutable, authMode: 'bogus' } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'authMode' })
    );
    expect(() => toResolvedCantonConfig({ ...mutable, unexpected: true } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'unexpected' })
    );
  });

  it('snapshots the shared secret used by standalone token generators', async () => {
    const resolved = resolveEnvironmentConfig({ environment: 'localnet' });
    if (resolved.authMode !== 'shared-secret') throw new Error('Expected shared-secret config');
    const mutable = { ...resolved };
    const generator = createSharedSecretTokenGenerator(mutable);
    mutable.sharedSecret = 'mutated-secret';

    const token = await generator();
    expect(() => jwt.verify(token, 'unsafe')).not.toThrow();
    expect(() => jwt.verify(token, 'mutated-secret')).toThrow();
  });
});
