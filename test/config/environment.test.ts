import {
  assertOpenCapTableV35Network,
  detectEnvironment,
  loadEnvironmentConfigFromEnv,
  LOCALNET_PRESET,
  resolveEnvironmentConfig,
  resolveFactoryIdentity,
  toCantonConfig,
  validateConfig,
} from '../../src/environment';
import { OcpErrorCodes } from '../../src/errors';
import type { BundledOcpFactoryIdentities } from '../../src/types/setup';

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
    const cantonConfig = toCantonConfig(resolveEnvironmentConfig({ environment: 'localnet' }));
    const tokenGenerator = cantonConfig.apis?.LEDGER_JSON_API?.auth.tokenGenerator;

    expect(tokenGenerator).toBeDefined();
    const token = await tokenGenerator?.();
    expect(token?.split('.')).toHaveLength(3);
  });
});

describe('OcpFactory identity resolution', () => {
  const explicit = { factoryId: 'acme', systemOperator: 'system-operator::1220aaaa' };
  const bundled: BundledOcpFactoryIdentities = {
    devnet: {
      templateId: 'pkg-id:Fairmint.OpenCapTable.OcpFactory:OcpFactory',
      system_operator: 'devnet-operator::1220ffff',
      factory_id: 'fairmint-devnet',
    },
  };

  it('resolves the identity the package ships for DevNet, with its template ID', () => {
    expect(resolveFactoryIdentity('devnet', undefined, bundled)).toEqual({
      factoryId: 'fairmint-devnet',
      systemOperator: 'devnet-operator::1220ffff',
      templateId: 'pkg-id:Fairmint.OpenCapTable.OcpFactory:OcpFactory',
    });
  });

  it('prefers an explicit identity to the shipped one', () => {
    expect(resolveFactoryIdentity('devnet', explicit, bundled)).toBe(explicit);
    expect(resolveFactoryIdentity('localnet', explicit, bundled)).toBe(explicit);
  });

  it('says the DevNet factory does not exist yet while the package ships none', () => {
    expect(() => resolveFactoryIdentity('devnet', undefined, {})).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'factory',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        message: expect.stringContaining('DevNet OcpFactory has not been created yet'),
      })
    );
  });

  it.each(['localnet', 'scratchnet', 'testnet', 'custom'])('asks for an explicit identity on %s', (network) => {
    expect(() => resolveFactoryIdentity(network, undefined, bundled)).toThrow(
      expect.objectContaining({
        fieldPath: 'factory',
        message: expect.stringContaining(`ships no OcpFactory identity for ${network}`),
      })
    );
  });

  it('refuses MainNet: with an explicit identity, with a shipped one and with none', () => {
    const mainnetBundle: BundledOcpFactoryIdentities = { ...bundled, mainnet: bundled.devnet };
    for (const factory of [undefined, explicit]) {
      expect(() => resolveFactoryIdentity('mainnet', factory, mainnetBundle)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          fieldPath: 'environment',
          code: OcpErrorCodes.INVALID_FORMAT,
          message: expect.stringContaining('OpenCapTable-v35 targets DevNet only (ADR-040)'),
        })
      );
    }
    expect(() => assertOpenCapTableV35Network('mainnet')).toThrow(
      expect.objectContaining({ fieldPath: 'environment' })
    );
    expect(() => assertOpenCapTableV35Network('devnet')).not.toThrow();
    expect(() => assertOpenCapTableV35Network('localnet')).not.toThrow();
  });

  it('rejects an invalid explicit identity', () => {
    expect(() => resolveFactoryIdentity('devnet', { factoryId: 'a:b', systemOperator: 'so::1' }, bundled)).toThrow(
      expect.objectContaining({ fieldPath: 'factory.factoryId' })
    );
  });

  it.each([
    ['a factory ID with a colon', { ...bundled.devnet, factory_id: 'a:b' }, 'bundled factory.factory_id'],
    ['an empty system operator', { ...bundled.devnet, system_operator: '' }, 'bundled factory.system_operator'],
  ])('rejects a shipped identity with %s', (_name, devnet, fieldPath) => {
    expect(() => resolveFactoryIdentity('devnet', undefined, { devnet } as BundledOcpFactoryIdentities)).toThrow(
      expect.objectContaining({ fieldPath })
    );
  });

  it('leaves the template ID out of a shipped identity that has none', () => {
    const { templateId: _templateId, ...withoutTemplate } = bundled.devnet as NonNullable<
      BundledOcpFactoryIdentities['devnet']
    >;

    expect(resolveFactoryIdentity('devnet', undefined, { devnet: withoutTemplate as never })).toStrictEqual({
      factoryId: 'fairmint-devnet',
      systemOperator: 'devnet-operator::1220ffff',
    });
  });

  it("reads the package's own file by default", () => {
    jest.isolateModules(() => {
      jest.doMock('@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json', () => ({
        __esModule: true,
        default: { devnet: bundled.devnet },
      }));

      const environment = require('../../src/environment') as typeof import('../../src/environment');

      expect(environment.resolveFactoryIdentity('devnet')).toMatchObject({ factoryId: 'fairmint-devnet' });
    });
    jest.dontMock('@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json');
  });

  it('treats the package file as empty until a factory is created', () => {
    jest.isolateModules(() => {
      jest.doMock('@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json', () => ({
        __esModule: true,
        default: {},
      }));

      const environment = require('../../src/environment') as typeof import('../../src/environment');

      expect(() => environment.resolveFactoryIdentity('devnet')).toThrow(
        expect.objectContaining({ message: expect.stringContaining('has not been created yet') })
      );
    });
    jest.dontMock('@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json');
  });
});
