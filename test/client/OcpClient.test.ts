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
import { createLedgerAndValidatorClients, createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

jest.mock('../../src/functions/OpenCapTable/issuerAuthorization/authorizeIssuer', () => ({
  authorizeIssuer: jest.fn(),
}));

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
  });

  it('rejects incomplete client-level factory config', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: { contractId: 'factory-cid' } as unknown as { contractId: string; templateId: string },
        })
    ).toThrow('factory override must include non-empty contractId and templateId');
  });

  it('describes blank client-level factory coordinates as non-empty requirements', () => {
    const ledger = createLedgerJsonApiClient(config);

    expect(
      () =>
        new OcpClient({
          ledger,
          factory: { contractId: '   ', templateId: 'factory-tid' },
        })
    ).toThrow('factory override must include non-empty contractId and templateId');
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
    ).rejects.toThrow('factory override must include non-empty contractId and templateId');

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
      fieldPath: 'factory',
      code: 'INVALID_FORMAT',
      expectedType: 'object with non-empty string contractId and templateId properties',
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
            createArgument: { [entry.dataField]: {} },
          },
        },
      });
      const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });
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
            createArgument: { [entry.dataField]: {} },
          },
        },
      });
      const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

      await expect(
        ocp.OpenCapTable[entityType].get({ contractId: `malformed-payload-${entityType}` })
      ).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    }
  );

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
    const ledger = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: issuerTemplateId,
            createArgument: {
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
      }),
    };
    const ocp = new OcpClient({ ledger: ledger as never });

    const result = await ocp.OpenCapTable.issuer.get({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });

    expect(result.contractId).toBe('issuer-cid-1');
    expect(result.data.id).toBe('iss-1');
    expect(ledger.getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });
  });

  it('exposes dispatcher-backed readers for transaction types missing dedicated facade wiring', async () => {
    const ledger = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
            createArgument: {
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
      }),
    };
    const ocp = new OcpClient({ ledger: ledger as never });

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
