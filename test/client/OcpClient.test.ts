import { Canton, type ClientConfig } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import {
  ENTITY_REGISTRY,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  mapOcfObjectTypeToEntityType,
  type OcfEntityType,
  type OcfReadableObjectType,
} from '../../src/functions/OpenCapTable/capTable';
import * as capTableState from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import {
  authorizeIssuer,
  type AuthorizeIssuerResult,
} from '../../src/functions/OpenCapTable/issuerAuthorization/authorizeIssuer';
import { OcpClient } from '../../src/OcpClient';
import type { ContractResult, OcfOutputForObjectType } from '../../src/types';
import {
  createLedgerAndValidatorClients,
  createLedgerJsonApiClient,
  createValidatorApiClient,
} from '../utils/cantonNodeSdkCompat';

jest.mock('../../src/functions/OpenCapTable/issuerAuthorization/authorizeIssuer', () => ({
  authorizeIssuer: jest.fn(),
}));

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function ledgerWithEvents(getEventsByContractId: jest.Mock) {
  const ledger = createLedgerJsonApiClient({ network: 'devnet' });
  Object.defineProperty(ledger, 'getEventsByContractId', {
    value: getEventsByContractId,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return ledger;
}

describe('OcpClient', () => {
  const config: ClientConfig = { network: 'devnet' };
  const mockedCanton = Canton as unknown as { __instances: Array<{ config: unknown }> };

  beforeEach(() => {
    mockedCanton.__instances.length = 0;
  });

  it('reuses injected runtime clients instead of constructing hidden ones', () => {
    const { ledger, validator } = createLedgerAndValidatorClients(config);

    const ocp = new OcpClient({ ledger, validator });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBe(validator);
  });

  it('supports ledger-only dependencies', () => {
    const ledger = createLedgerJsonApiClient(config);

    const ocp = new OcpClient({ ledger });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBeUndefined();
  });

  it('exposes optional client-level factory config', () => {
    const ledger = createLedgerJsonApiClient(config);
    const factory = { contractId: 'factory-cid', templateId: 'factory-tid' };

    const ocp = new OcpClient({ ledger, factory });

    expect(ocp.factory).toEqual(factory);
    expect(ocp.factory).not.toBe(factory);
    expect(Object.isFrozen(ocp.factory)).toBe(true);
  });

  it('rejects extra client-level factory fields instead of leaking them into public state', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: {
            contractId: 'factory-cid',
            templateId: 'factory-tid',
            unexpected: 'must-not-survive',
          } as { contractId: string; templateId: string },
        })
    ).toThrow('factory override must contain exactly');
  });

  it('snapshots and freezes client observability defaults without freezing service hooks', () => {
    const ledger = createLedgerJsonApiClient(config);
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const defaultContext = {
      workflowId: 'workflow-original',
      traceContext: {
        traceId: 'trace-original',
        metadata: { tenant: 'tenant-original' },
      },
    };
    const ocp = new OcpClient({ ledger, logger, defaultContext });

    defaultContext.workflowId = 'workflow-mutated';
    defaultContext.traceContext.traceId = 'trace-mutated';
    defaultContext.traceContext.metadata.tenant = 'tenant-mutated';

    expect(ocp.observability.defaultContext).toEqual({
      workflowId: 'workflow-original',
      traceContext: {
        traceId: 'trace-original',
        metadata: { tenant: 'tenant-original' },
      },
    });
    expect(Object.isFrozen(ocp.observability)).toBe(true);
    expect(Object.isFrozen(ocp.observability.defaultContext)).toBe(true);
    expect(Object.isFrozen(ocp.observability.defaultContext?.traceContext)).toBe(true);
    expect(Object.isFrozen(ocp.observability.defaultContext?.traceContext?.metadata)).toBe(true);
    expect(Object.isFrozen(logger)).toBe(false);
  });

  it('rejects incomplete client-level factory config', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: { contractId: 'factory-cid' } as unknown as { contractId: string; templateId: string },
        })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'dependencies.factory',
      })
    );
  });

  it('roots malformed static factory options at options.factory', () => {
    expect(() =>
      OcpClient.forLocalNet({
        factory: { contractId: 'factory-cid' } as unknown as { contractId: string; templateId: string },
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'options.factory',
      })
    );
  });

  it('describes blank client-level factory coordinates as non-empty requirements', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: { contractId: '   ', templateId: 'factory-tid' },
        })
    ).toThrow('factory override must contain exactly');
  });

  it('rejects whitespace-padded client-level factory coordinates', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: { contractId: ' factory-cid', templateId: 'factory-tid' },
        })
    ).toThrow('without leading or trailing whitespace');
  });

  it('rejects injected environment labels that do not match the ledger network', () => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });

    expect(() => new OcpClient({ ledger, environment: 'mainnet' })).toThrow(
      'environment mainnet does not match ledger network devnet'
    );
  });

  it('creates a LocalNet client from environment defaults', () => {
    const ocp = OcpClient.forLocalNet({ party: 'app_provider::party' });

    expect(ocp.environment).toBe('localnet');
    expect(ocp.isLocalNet()).toBe(true);
    expect(ocp.isProduction()).toBe(false);
    expect(mockedCanton.__instances).toHaveLength(1);
    expect(mockedCanton.__instances[0]?.config).toMatchObject({
      network: 'localnet',
      provider: 'app-provider',
      partyId: 'app_provider::party',
      apis: {
        LEDGER_JSON_API: {
          apiUrl: 'http://localhost:3975',
          auth: {
            grantType: 'client_credentials',
            clientId: 'ocp-sdk',
          },
        },
        VALIDATOR_API: {
          apiUrl: 'http://localhost:3903',
        },
      },
    });
  });

  it('requires explicit OAuth2 credentials instead of borrowing the LocalNet shared-secret client ID', () => {
    expect(() =>
      OcpClient.forLocalNet({
        authMode: 'oauth2',
        authUrl: 'https://auth.example.com/token',
        clientSecret: 'client-secret',
      } as never)
    ).toThrow('clientId is required for oauth2 auth mode');
    expect(mockedCanton.__instances).toHaveLength(0);
  });

  it('creates a DevNet client from explicit OAuth2 config', () => {
    const ocp = OcpClient.forDevNet({
      ledgerApiUrl: 'https://ledger.devnet.example.com',
      validatorApiUrl: 'https://validator.devnet.example.com',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      provider: '5n',
      partyId: 'issuer::party',
    });

    expect(ocp.environment).toBe('devnet');
    expect(mockedCanton.__instances).toHaveLength(1);
    expect(mockedCanton.__instances[0]?.config).toMatchObject({
      network: 'devnet',
      provider: '5n',
      authUrl: 'https://auth.example.com/token',
      partyId: 'issuer::party',
      apis: {
        LEDGER_JSON_API: {
          apiUrl: 'https://ledger.devnet.example.com',
          auth: {
            grantType: 'client_credentials',
            clientId: 'client-id',
            clientSecret: 'client-secret',
          },
        },
        VALIDATOR_API: {
          apiUrl: 'https://validator.devnet.example.com',
        },
      },
    });
  });

  it('creates a Staging client without falling back to LocalNet', () => {
    const ocp = OcpClient.forStaging({
      ledgerApiUrl: 'https://ledger.staging.example.com',
      validatorApiUrl: 'https://validator.staging.example.com',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(ocp.environment).toBe('staging');
    expect(mockedCanton.__instances).toHaveLength(1);
    expect(mockedCanton.__instances[0]?.config).toMatchObject({
      network: 'staging',
      apis: {
        LEDGER_JSON_API: { apiUrl: 'https://ledger.staging.example.com' },
        VALIDATOR_API: { apiUrl: 'https://validator.staging.example.com' },
      },
    });
  });

  it('tracks production safety helper state', () => {
    const ocp = OcpClient.forMainNet({
      ledgerApiUrl: 'https://ledger.mainnet.example.com',
      authUrl: 'https://auth.example.com/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      productionSafetyChecks: true,
    });

    expect(ocp.isProduction()).toBe(true);
    expect(ocp.areProductionSafetyChecksEnabled()).toBe(true);
    expect(ocp.setProductionSafetyChecks(false)).toBe(ocp);
    expect(ocp.areProductionSafetyChecksEnabled()).toBe(false);
  });

  it('rejects invalid injected environment, safety, and default-context runtime states', () => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });

    expect(() => new OcpClient({ ledger, environment: 'bogus' } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.environment' })
    );
    expect(() => new OcpClient({ ledger, productionSafetyChecks: 'yes' } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.productionSafetyChecks' })
    );
    expect(() => new OcpClient({ ledger, defaultContext: { workflowId: 123 } } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.defaultContext.workflowId' })
    );
    expect(() => new OcpClient({ ledger, validator: undefined } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.validator' })
    );
    expect(() => OcpClient.fromEnv({ factory: undefined } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'options.factory' })
    );

    const client = new OcpClient({ ledger });
    expect(() => client.setProductionSafetyChecks('yes' as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'productionSafetyChecks' })
    );
  });

  it('rejects incomplete and invalid-network injected ledger clients', () => {
    expect(() => new OcpClient({ ledger: { getNetwork: () => 'devnet' } } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.ledger.getActiveContracts' })
    );

    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    Object.defineProperty(ledger, 'getNetwork', { value: () => 'bogus' });
    expect(() => new OcpClient({ ledger })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.ledger.network' })
    );

    const methodTrap = jest.fn(() => {
      throw new Error('proxied method invoked');
    });
    const proxiedMethodLedger = createLedgerJsonApiClient({ network: 'devnet' });
    Object.defineProperty(proxiedMethodLedger, 'getNetwork', {
      value: new Proxy(() => 'devnet', { apply: methodTrap }),
    });
    expect(() => new OcpClient({ ledger: proxiedMethodLedger })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.ledger.getNetwork' })
    );
    expect(methodTrap).not.toHaveBeenCalled();
  });

  it('rejects validator clients on a different Canton network', () => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    const validator = createValidatorApiClient({ network: 'testnet' });

    expect(() => new OcpClient({ ledger, validator })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.validator.network' })
    );
  });

  it('rejects dependency and static-option proxies, accessors, symbols, and unknown keys without invoking traps', () => {
    const ledgerGetter = jest.fn(() => createLedgerJsonApiClient({ network: 'devnet' }));
    const accessorDependencies = {};
    Object.defineProperty(accessorDependencies, 'ledger', { enumerable: true, get: ledgerGetter });
    expect(() => new OcpClient(accessorDependencies as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies.ledger' })
    );
    expect(ledgerGetter).not.toHaveBeenCalled();

    const trap = jest.fn(() => {
      throw new Error('proxy trap invoked');
    });
    const proxy = new Proxy({}, { get: trap, ownKeys: trap });
    expect(() => new OcpClient(proxy as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies' })
    );
    expect(() => OcpClient.forLocalNet(proxy as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'options' })
    );
    expect(trap).not.toHaveBeenCalled();

    const symbol = Symbol('unexpected');
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    expect(() => new OcpClient({ ledger, [symbol]: true } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'dependencies' })
    );
    expect(() => OcpClient.forLocalNet({ unexpected: true } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'options.unexpected' })
    );
  });
});

describe('OcpClient OpenCapTable.issuerAuthorization.authorize', () => {
  const config: ClientConfig = { network: 'devnet' };
  const minimalAuthorizeResult = {} as AuthorizeIssuerResult;
  const mockedAuthorizeIssuer = authorizeIssuer as jest.MockedFunction<typeof authorizeIssuer>;

  beforeEach(() => {
    mockedAuthorizeIssuer.mockResolvedValue(minimalAuthorizeResult);
  });

  afterEach(() => {
    mockedAuthorizeIssuer.mockClear();
  });

  it('merges client-level factory into authorizeIssuer when per-call overrides are omitted', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const factory = { contractId: 'client-factory-cid', templateId: 'client-factory-tid' };
    const ocp = new OcpClient({ ledger, factory });

    await ocp.OpenCapTable.issuerAuthorization.authorize({ issuer: 'issuer::party' });

    expect(mockedAuthorizeIssuer).toHaveBeenCalledWith(ledger, {
      issuer: 'issuer::party',
      factory: {
        contractId: 'client-factory-cid',
        templateId: 'client-factory-tid',
      },
    });
    expect(mockedAuthorizeIssuer).toHaveBeenCalledTimes(1);
  });

  it('prefers per-call factory overrides over client-level factory', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({
      ledger,
      factory: { contractId: 'client-factory-cid', templateId: 'client-factory-tid' },
    });

    await ocp.OpenCapTable.issuerAuthorization.authorize({
      issuer: 'issuer::party',
      factory: {
        contractId: 'per-call-cid',
        templateId: 'per-call-tid',
      },
    });

    expect(mockedAuthorizeIssuer).toHaveBeenCalledWith(ledger, {
      issuer: 'issuer::party',
      factory: {
        contractId: 'per-call-cid',
        templateId: 'per-call-tid',
      },
    });
    expect(mockedAuthorizeIssuer).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed per-call factory coordinates instead of mixing them with client defaults', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({
      ledger,
      factory: { contractId: 'client-factory-cid', templateId: 'client-factory-tid' },
    });

    await expect(
      ocp.OpenCapTable.issuerAuthorization.authorize({
        issuer: 'issuer::party',
        factory: { contractId: 'per-call-cid-only' } as unknown as {
          contractId: string;
          templateId: string;
        },
      })
    ).rejects.toThrow('factory override must contain exactly');

    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('rejects whitespace-padded per-call factory coordinates instead of forwarding them', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await expect(
      ocp.OpenCapTable.issuerAuthorization.authorize({
        issuer: 'issuer::party',
        factory: { contractId: 'per-call-cid', templateId: 'per-call-tid ' },
      })
    ).rejects.toThrow('without leading or trailing whitespace');

    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('rejects a null per-call factory instead of falling back to client defaults', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({
      ledger,
      factory: { contractId: 'client-factory-cid', templateId: 'client-factory-tid' },
    });

    await expect(
      ocp.OpenCapTable.issuerAuthorization.authorize({
        issuer: 'issuer::party',
        factory: null as unknown as { contractId: string; templateId: string },
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.factory',
      code: 'INVALID_FORMAT',
      expectedType: 'exact object with non-empty, whitespace-trimmed string contractId and templateId properties',
      receivedValue: null,
    });

    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('requires explicit factory coordinates for custom environment authorization', async () => {
    const ledger = createLedgerJsonApiClient({ network: 'localnet' });
    const ocp = new OcpClient({ ledger, environment: 'custom' });

    await expect(ocp.OpenCapTable.issuerAuthorization.authorize({ issuer: 'issuer::party' })).rejects.toThrow(
      'factory override is required for custom issuer authorization'
    );
    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('requires explicit factory coordinates for LocalNet authorization', async () => {
    const ledger = createLedgerJsonApiClient({ network: 'localnet' });
    const ocp = new OcpClient({ ledger, environment: 'localnet' });

    await expect(ocp.OpenCapTable.issuerAuthorization.authorize({ issuer: 'issuer::party' })).rejects.toThrow(
      'factory override is required for localnet issuer authorization'
    );
    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('requires explicit factory coordinates for Staging authorization', async () => {
    const ledger = createLedgerJsonApiClient({ network: 'staging' });
    const ocp = new OcpClient({ ledger, environment: 'staging' });

    await expect(ocp.OpenCapTable.issuerAuthorization.authorize({ issuer: 'issuer::party' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.factory',
      message: expect.stringContaining('factory override is required for staging issuer authorization'),
    });
    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it.each([
    ['ScratchNet', 'scratchnet', 'localnet'],
    ['TestNet', 'testnet', 'testnet'],
  ] as const)('requires explicit factory coordinates for %s authorization', async (_name, environment, network) => {
    const ledger = createLedgerJsonApiClient({ network });
    const ocp = new OcpClient({ ledger, environment });

    await expect(ocp.OpenCapTable.issuerAuthorization.authorize({ issuer: 'issuer::party' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.factory',
      code: 'REQUIRED_FIELD_MISSING',
      message: expect.stringContaining(`factory override is required for ${environment} issuer authorization`),
    });
    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });

  it('defensively freezes client-level factory coordinates', () => {
    const ledger = createLedgerJsonApiClient({ network: 'localnet' });
    const ocp = new OcpClient({
      ledger,
      environment: 'localnet',
      factory: { contractId: 'client-factory-cid', templateId: 'client-factory-tid' },
    });
    expect(Object.isFrozen(ocp.factory)).toBe(true);
    expect(ocp.factory).toEqual({ contractId: 'client-factory-cid', templateId: 'client-factory-tid' });
  });

  it('passes client-level observability defaults into authorizeIssuer', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };
    const ocp = new OcpClient({
      ledger,
      logger,
      metrics,
      defaultContext: { workflowId: 'workflow-default' },
    });

    await ocp.OpenCapTable.issuerAuthorization.authorize({
      issuer: 'issuer::party',
      context: { commandId: 'command-call' },
    });

    expect(mockedAuthorizeIssuer).toHaveBeenCalledWith(
      ledger,
      expect.objectContaining({
        issuer: 'issuer::party',
        logger,
        metrics,
        defaultContext: { workflowId: 'workflow-default' },
        context: { commandId: 'command-call' },
      })
    );
    expect(mockedAuthorizeIssuer).toHaveBeenCalledTimes(1);
  });

  it('keeps client-level observability defaults when per-call fields are omitted', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };
    const ocp = new OcpClient({
      ledger,
      logger,
      metrics,
      defaultContext: { workflowId: 'workflow-default' },
    });

    await ocp.OpenCapTable.issuerAuthorization.authorize({
      issuer: 'issuer::party',
      context: { commandId: 'command-call' },
    });

    expect(mockedAuthorizeIssuer).toHaveBeenCalledWith(
      ledger,
      expect.objectContaining({
        issuer: 'issuer::party',
        logger,
        metrics,
        defaultContext: { workflowId: 'workflow-default' },
        context: { commandId: 'command-call' },
      })
    );
    expect(mockedAuthorizeIssuer).toHaveBeenCalledTimes(1);
  });

  it('rejects explicit undefined per-call observability fields', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await expect(
      ocp.OpenCapTable.issuerAuthorization.authorize({
        issuer: 'issuer::party',
        logger: undefined,
        context: { commandId: 'command-call' },
      } as never)
    ).rejects.toThrow('logger must be omitted rather than set to undefined');
    expect(mockedAuthorizeIssuer).not.toHaveBeenCalled();
  });
});

describe('OcpClient OpenCapTable.capTable facade', () => {
  const config: ClientConfig = { network: 'devnet' };

  let classifySpy: jest.SpiedFunction<typeof capTableState.classifyIssuerCapTables>;
  let getStateSpy: jest.SpiedFunction<typeof capTableState.getCapTableState>;

  beforeEach(() => {
    classifySpy = jest.spyOn(capTableState, 'classifyIssuerCapTables').mockResolvedValue({
      status: 'none',
      current: null,
    });
    getStateSpy = jest.spyOn(capTableState, 'getCapTableState').mockResolvedValue(null);
  });

  afterEach(() => {
    classifySpy.mockRestore();
    getStateSpy.mockRestore();
  });

  it('forwards capTable.classify to classifyIssuerCapTables with the injected ledger', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await ocp.OpenCapTable.capTable.classify('issuer::party-1');

    expect(classifySpy).toHaveBeenCalledTimes(1);
    expect(classifySpy).toHaveBeenCalledWith(ledger, 'issuer::party-1');
  });

  it('forwards capTable.getState to getCapTableState with the injected ledger', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await ocp.OpenCapTable.capTable.getState('issuer::party-2');

    expect(getStateSpy).toHaveBeenCalledTimes(1);
    expect(getStateSpy).toHaveBeenCalledWith(ledger, 'issuer::party-2');
  });
});

describe('OcpClient OpenCapTable entity facade', () => {
  type ObjectReaderEntityType = (typeof OCF_OBJECT_TYPE_TO_ENTITY_TYPE)[OcfReadableObjectType];
  const objectTypeReaderEntries = Object.entries(OCF_OBJECT_TYPE_TO_ENTITY_TYPE) as Array<
    [OcfReadableObjectType, ObjectReaderEntityType]
  >;
  const canonicalEntityEntries = Object.entries(ENTITY_REGISTRY) as Array<
    [OcfEntityType, (typeof ENTITY_REGISTRY)[OcfEntityType]]
  >;

  it('exports one canonical OCF object_type mapping for each readable registry entry', () => {
    const expected = Object.fromEntries(
      Object.entries(ENTITY_REGISTRY)
        .filter(([entityType]) => !entityType.startsWith('planSecurity'))
        .map(([entityType, entry]) => [entry.objectType, entityType])
    );

    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE).toEqual(expected);
  });

  it.each(objectTypeReaderEntries)('maps %s to %s', (objectType, entityType) => {
    expect(mapOcfObjectTypeToEntityType(objectType)).toBe(entityType);
  });

  it.each(objectTypeReaderEntries)('dispatches getByObjectType(%s) through %s.get', async (objectType, entityType) => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    const ocp = new OcpClient({ ledger });
    const expected = {
      contractId: `cid-${objectType}`,
      data: { object_type: objectType },
    };
    const getMock = jest.fn().mockResolvedValue(expected);
    (ocp.OpenCapTable[entityType] as { get: typeof getMock }).get = getMock;

    const result = await ocp.OpenCapTable.getByObjectType({
      objectType,
      contractId: `cid-${objectType}`,
      readAs: ['issuer::party-1'],
    });

    expect(result).toBe(expected);
    expect(getMock).toHaveBeenCalledWith({
      contractId: `cid-${objectType}`,
      readAs: ['issuer::party-1'],
    });
  });

  it.each(canonicalEntityEntries)(
    '%s namespace validates template identity before decoding and forwards readAs',
    async (entityType, entry) => {
      const wrongTemplateId =
        entityType === 'stakeholder' ? ENTITY_REGISTRY.stockClass.templateId : ENTITY_REGISTRY.stakeholder.templateId;
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: wrongTemplateId,
            createArgument: { context: GENERATED_CONTEXT, [entry.dataField]: {} },
          },
        },
      });
      const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });
      const readAs = [`reader::${entityType}`];

      await expect(
        ocp.OpenCapTable[entityType].get({ contractId: `wrong-template-${entityType}`, readAs })
      ).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'module_entity_mismatch',
      });
      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: `wrong-template-${entityType}`,
        readAs,
      });
    }
  );

  it.each(canonicalEntityEntries)(
    '%s namespace rejects malformed generated DAML payloads',
    async (entityType, entry) => {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: entry.templateId,
            createArgument: { context: GENERATED_CONTEXT, [entry.dataField]: {} },
          },
        },
      });
      const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

      await expect(
        ocp.OpenCapTable[entityType].get({ contractId: `malformed-payload-${entityType}` })
      ).rejects.toMatchObject(
        entityType === 'issuer'
          ? {
              name: 'OcpValidationError',
              code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
              fieldPath: 'issuer.id',
            }
          : {
              name: 'OcpParseError',
              code: OcpErrorCodes.SCHEMA_MISMATCH,
            }
      );
    }
  );

  it.each([
    ['document namespace', async (ocp: OcpClient) => ocp.OpenCapTable.document.get({ contractId: 'lossy-document' })],
    [
      'getByObjectType',
      async (ocp: OcpClient) =>
        ocp.OpenCapTable.getByObjectType({ objectType: 'DOCUMENT', contractId: 'lossy-document' }),
    ],
  ] as const)('%s rejects generated optional loss', async (_case, read) => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_REGISTRY.document.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            document_data: {
              id: 'document-lossy',
              md5: 'd41d8cd98f00b204e9800998ecf8427e',
              comments: [],
              related_objects: [],
              path: 42,
              uri: 'https://example.com/document.pdf',
            },
          },
        },
      },
    });
    const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

    await expect(read(ocp)).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'document.path',
    });
  });

  it.each([
    [
      'ratio-adjustment namespace',
      async (ocp: OcpClient) =>
        ocp.OpenCapTable.stockClassConversionRatioAdjustment.get({ contractId: 'ratio-wrapper' }),
    ],
    [
      'getByObjectType',
      async (ocp: OcpClient) =>
        ocp.OpenCapTable.getByObjectType({
          objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
          contractId: 'ratio-wrapper',
        }),
    ],
  ] as const)('%s enforces the exact generated ratio-adjustment create-argument wrapper', async (_surface, read) => {
    const adjustmentData = {
      id: 'ratio-wrapper',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1', currency: 'USD' },
        ratio: { numerator: '1', denominator: '1' },
        rounding_type: 'OcfRoundingNormal',
      },
      comments: [],
    };

    for (const malformed of [
      {
        createArgument: { adjustment_data: adjustmentData },
        source: 'damlToOcf.stockClassConversionRatioAdjustment.createArgument.context',
        classification: 'invalid_generated_create_argument',
      },
      {
        createArgument: {
          context: GENERATED_CONTEXT,
          adjustment_data: adjustmentData,
          unexpected: true,
        },
        source: 'damlToOcf.stockClassConversionRatioAdjustment.createArgument.unexpected',
        classification: 'invalid_generated_daml_json',
      },
    ] as const) {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: ENTITY_REGISTRY.stockClassConversionRatioAdjustment.templateId,
            createArgument: malformed.createArgument,
          },
        },
      });
      const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

      await expect(read(ocp)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: malformed.source,
        classification: malformed.classification,
      });
    }
  });

  it.each([
    {
      name: 'null ratio mechanism',
      entityType: 'stockClassConversionRatioAdjustment',
      objectType: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      expectedCode: OcpErrorCodes.SCHEMA_MISMATCH,
      data: {
        id: 'ratio-null-mechanism',
        date: '2026-01-01T00:00:00.000Z',
        stock_class_id: 'class-1',
        new_ratio_conversion_mechanism: null,
        comments: [],
      },
    },
    {
      name: 'unknown issuer initial-shares enum',
      entityType: 'issuer',
      objectType: 'ISSUER',
      expectedCode: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      data: {
        id: 'issuer-unknown-shares',
        legal_name: 'Issuer Inc.',
        formation_date: '2026-01-01T00:00:00.000Z',
        country_of_formation: 'US',
        country_subdivision_of_formation: null,
        country_subdivision_name_of_formation: null,
        initial_shares_authorized: {
          tag: 'OcfInitialSharesEnum',
          value: 'OcfAuthorizedSharesSurprise',
        },
        tax_ids: [],
        comments: [],
      },
    },
    {
      name: 'issuer initial shares beyond Numeric 10 scale',
      entityType: 'issuer',
      objectType: 'ISSUER',
      expectedCode: OcpErrorCodes.INVALID_FORMAT,
      data: {
        id: 'issuer-invalid-numeric-shares',
        legal_name: 'Issuer Inc.',
        formation_date: '2026-01-01T00:00:00.000Z',
        country_of_formation: 'US',
        country_subdivision_of_formation: null,
        country_subdivision_name_of_formation: null,
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1.12345678901' },
        tax_ids: [],
        comments: [],
      },
    },
    {
      name: 'fractional generated vesting period Int',
      entityType: 'vestingTerms',
      objectType: 'VESTING_TERMS',
      expectedCode: OcpErrorCodes.INVALID_FORMAT,
      data: {
        id: 'vesting-fractional-period',
        name: 'Fractional period',
        description: 'Invalid generated DAML Int',
        allocation_type: 'OcfAllocationCumulativeRounding',
        vesting_conditions: [
          {
            id: 'condition-relative',
            description: null,
            quantity: '100',
            portion: null,
            trigger: {
              tag: 'OcfVestingScheduleRelativeTrigger',
              value: {
                relative_to_condition_id: 'condition-start',
                period: {
                  tag: 'OcfVestingPeriodDays',
                  value: { length_: '1.5', occurrences: '1', cliff_installment: null },
                },
              },
            },
            next_condition_ids: [],
          },
        ],
        comments: [],
      },
    },
    {
      name: 'empty relationship enum alongside a valid sibling',
      entityType: 'stakeholderRelationshipChangeEvent',
      objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
      expectedCode: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      data: {
        id: 'relationship-empty-started',
        date: '2026-01-01T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        relationship_started: '',
        relationship_ended: 'OcfRelEmployee',
        comments: [],
      },
    },
    {
      name: 'unexpected relative-period value field',
      entityType: 'vestingTerms',
      objectType: 'VESTING_TERMS',
      expectedCode: OcpErrorCodes.SCHEMA_MISMATCH,
      data: {
        id: 'vesting-extra-period-field',
        name: 'Unexpected period field',
        description: 'Invalid generated DAML shape',
        allocation_type: 'OcfAllocationCumulativeRounding',
        vesting_conditions: [
          {
            id: 'condition-relative',
            description: null,
            quantity: '100',
            portion: null,
            trigger: {
              tag: 'OcfVestingScheduleRelativeTrigger',
              value: {
                relative_to_condition_id: 'condition-start',
                period: {
                  tag: 'OcfVestingPeriodDays',
                  value: { length_: '1', occurrences: '1', cliff_installment: null, unexpected: true },
                },
              },
            },
            next_condition_ids: [],
          },
        ],
        comments: [],
      },
    },
  ] as const)('namespace and getByObjectType reject $name', async ({ entityType, objectType, data, expectedCode }) => {
    const entry = ENTITY_REGISTRY[entityType];
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: entry.templateId,
          createArgument: { context: GENERATED_CONTEXT, [entry.dataField]: data },
        },
      },
    });
    const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

    await expect(
      ocp.OpenCapTable[entityType].get({ contractId: `${entityType}-malformed-namespace` })
    ).rejects.toMatchObject({ code: expectedCode });
    await expect(
      ocp.OpenCapTable.getByObjectType({
        objectType,
        contractId: `${entityType}-malformed-object-type`,
      })
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it.each([
    ['issuer namespace', async (ocp: OcpClient) => ocp.OpenCapTable.issuer.get({ contractId: 'issuer-plus' })],
    [
      'getByObjectType',
      async (ocp: OcpClient) => ocp.OpenCapTable.getByObjectType({ objectType: 'ISSUER', contractId: 'issuer-plus' }),
    ],
  ] as const)('%s canonicalizes valid signed issuer initial shares', async (_case, read) => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_REGISTRY.issuer.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            issuer_data: {
              id: 'issuer-plus',
              legal_name: 'Issuer Inc.',
              formation_date: '2026-01-01T00:00:00.000Z',
              country_of_formation: 'US',
              country_subdivision_of_formation: null,
              country_subdivision_name_of_formation: null,
              initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '+0001.2300000000' },
              tax_ids: [],
              comments: [],
            },
          },
        },
      },
    });
    const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

    await expect(read(ocp)).resolves.toMatchObject({ data: { initial_shares_authorized: '1.23' } });
  });

  it('generic namespace reads reject create-argument accessors without invoking them', async () => {
    const getter = jest.fn(() => ({ id: 'issuer-accessor' }));
    const createArgument: Record<string, unknown> = { context: GENERATED_CONTEXT };
    Object.defineProperty(createArgument, 'issuer_data', { enumerable: true, get: getter });
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_REGISTRY.issuer.templateId,
          createArgument,
        },
      },
    });
    const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

    await expect(ocp.OpenCapTable.issuer.get({ contractId: 'issuer-accessor' })).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining('.createArgument.issuer_data'),
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('vestingTerms namespace rejects duplicate next_condition_ids with the exact duplicate index', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_REGISTRY.vestingTerms.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            vesting_terms_data: {
              id: 'vesting-duplicates',
              allocation_type: 'OcfAllocationCumulativeRounding',
              description: 'Vesting',
              name: 'Vesting',
              comments: [],
              vesting_conditions: [
                {
                  id: 'condition-1',
                  trigger: { tag: 'OcfVestingStartTrigger', value: {} },
                  next_condition_ids: ['condition-2', 'condition-2'],
                  description: null,
                  portion: { numerator: '1', denominator: '4', remainder: false },
                  quantity: null,
                },
              ],
            },
          },
        },
      },
    });
    const ocp = new OcpClient({ ledger: ledgerWithEvents(getEventsByContractId) });

    await expect(ocp.OpenCapTable.vestingTerms.get({ contractId: 'vesting-duplicates' })).rejects.toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'vestingTerms.vesting_conditions[0].next_condition_ids[1]',
      receivedValue: 'condition-2',
    });
  });

  it('rejects unsupported runtime object types', async () => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    const ocp = new OcpClient({ ledger });

    await expect(
      ocp.OpenCapTable.getByObjectType({
        objectType: 'UNKNOWN_OBJECT_TYPE' as OcfReadableObjectType,
        contractId: 'unknown-cid',
      })
    ).rejects.toThrow('Unsupported OCF object_type: UNKNOWN_OBJECT_TYPE');
    await expect(
      ocp.OpenCapTable.getByObjectType({
        objectType: 'UNKNOWN_OBJECT_TYPE' as OcfReadableObjectType,
        contractId: 'unknown-cid',
      })
    ).rejects.toMatchObject({ code: OcpErrorCodes.UNKNOWN_ENUM_VALUE });
  });

  it('preserves concrete output inference for literal object types', async () => {
    const ledger = createLedgerJsonApiClient({ network: 'devnet' });
    const ocp = new OcpClient({ ledger });
    const expected: ContractResult<OcfOutputForObjectType<'STOCK_CLASS'>> = {
      contractId: 'stock-class-cid-1',
      data: {
        object_type: 'STOCK_CLASS',
        id: 'stock-class-1',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '1000',
        name: 'Common Stock',
        seniority: '1',
        board_approval_date: '2025-01-01',
        votes_per_share: '1',
        par_value: { amount: '0.00001', currency: 'USD' },
        price_per_share: { amount: '1', currency: 'USD' },
        comments: [],
      },
    };
    const getMock = jest.fn().mockResolvedValue(expected);
    (ocp.OpenCapTable.stockClass as { get: typeof getMock }).get = getMock;

    const result = await ocp.OpenCapTable.getByObjectType({
      objectType: 'STOCK_CLASS',
      contractId: 'stock-class-cid-1',
    });
    const objectType: 'STOCK_CLASS' = result.data.object_type;
    const { id }: { id: string } = result.data;

    expect(objectType).toBe('STOCK_CLASS');
    expect(id).toBe('stock-class-1');
  });

  it('forwards issuer.get readAs through the OcpClient facade', async () => {
    const issuerTemplateId = Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId;
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: issuerTemplateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            issuer_data: {
              id: 'iss-1',
              legal_name: 'Facade Test Corp',
              country_of_formation: 'US',
              formation_date: '2025-01-01T00:00:00Z',
              tax_ids: [],
              comments: [],
            },
          },
        },
      },
    });
    const ledger = ledgerWithEvents(getEventsByContractId);
    const ocp = new OcpClient({ ledger });

    const result = await ocp.OpenCapTable.issuer.get({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });

    expect(result.contractId).toBe('issuer-cid-1');
    expect(result.data.id).toBe('iss-1');
    expect(getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });
  });

  it('exposes dispatcher-backed readers for transaction types missing dedicated facade wiring', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            retraction_data: {
              id: 'ret-1',
              date: '2025-01-01T00:00:00.000Z',
              security_id: 'stock-1',
              reason_text: 'Correction',
              comments: [],
            },
          },
        },
      },
    });
    const ledger = ledgerWithEvents(getEventsByContractId);
    const ocp = new OcpClient({ ledger });

    const result = await ocp.OpenCapTable.stockRetraction.get({
      contractId: 'stock-retraction-cid-1',
      readAs: ['issuer::party-1'],
    });

    expect(result).toEqual({
      contractId: 'stock-retraction-cid-1',
      data: {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'ret-1',
        date: '2025-01-01',
        security_id: 'stock-1',
        reason_text: 'Correction',
      },
    });
    expect(ledger.getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'stock-retraction-cid-1',
      readAs: ['issuer::party-1'],
    });
  });
});
