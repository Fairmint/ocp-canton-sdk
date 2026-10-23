import { Canton, type ClientConfig, type LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import {
  ENTITY_REGISTRY,
  mapOcfObjectTypeToEntityType,
  OCF_DATA_FIELD,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfEntityType,
  type OcfReadableObjectType,
} from '../../src/functions/OpenCapTable/capTable';
import { OcpClient } from '../../src/OcpClient';
import * as register from '../../src/register';
import type { ContractResult, OcfOutputForObjectType, OcpFactoryIdentity } from '../../src/types';
import { deliverMessages, queueWebSocketScript, resetWebSocketMock } from '../mocks/canton-deep';
import { acsItem, anchorEvent, anchorItems, bookEvents, CONTEXT } from '../register/registerLedgerFixtures';
import {
  AUTHORIZATION_TEMPLATE_ID,
  authorizationRef,
  CAP_TABLE_ID,
  context,
  createdEvent,
  exercisedEvent,
  FACTORY_ID,
  FACTORY_TEMPLATE_ID,
  factoryArgument,
  factoryItem,
  initialShardEntries,
  ISSUER,
  ISSUER_DATA,
  mockLedger,
  SYSTEM_OPERATOR,
  transaction,
  TRANSFER_AGENT,
} from '../setup/setupFixtures';
import { createLedgerAndValidatorClients, createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';
import { TEST_REGISTER_SIGNATORIES } from '../utils/registerEvents';

const GENERATED_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
  transfer_agent: 'transfer-agent::party',
  cap_table_id: 'cap-table-1',
} as const;

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

  it('exposes the optional client-level factory identity', () => {
    const ledger = createLedgerJsonApiClient(config);
    const factory = { factoryId: 'acme', systemOperator: 'system-operator::party', templateId: 'factory-tid' };

    const ocp = new OcpClient({ ledger, factory });

    expect(ocp.factory).toEqual(factory);
    expect(new OcpClient({ ledger }).factory).toBeUndefined();
    expect(
      new OcpClient({ ledger, factory: { factoryId: 'acme', systemOperator: 'so::party' } }).factory
    ).toStrictEqual({
      factoryId: 'acme',
      systemOperator: 'so::party',
    });
  });

  it.each([
    ['the v34 coordinates', { contractId: 'factory-cid', templateId: 'factory-tid' }, 'factory.factoryId'],
    ['a factory ID with a colon', { factoryId: 'acme:1', systemOperator: 'so::party' }, 'factory.factoryId'],
    ['an empty system operator', { factoryId: 'acme', systemOperator: '' }, 'factory.systemOperator'],
  ])('rejects a client-level factory identity with %s', (_name, factory, fieldPath) => {
    const ledger = createLedgerJsonApiClient(config);

    expect(() => new OcpClient({ ledger, factory: factory as unknown as OcpFactoryIdentity })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath })
    );
  });

  it('stores client-level observability defaults', () => {
    const ledger = createLedgerJsonApiClient(config);
    const defaultContext = { workflowId: 'workflow-1' };

    const ocp = new OcpClient({ ledger, defaultContext });

    expect(ocp.observability).toEqual({ defaultContext });
  });

  it('exposes entity readers, the register reader, the three-step setup and the anchor choices: the v34 groups are gone', () => {
    const ocp = new OcpClient({ ledger: createLedgerJsonApiClient(config) });

    expect(ocp.OpenCapTable.capTable).not.toHaveProperty('update');
    expect(ocp.OpenCapTable).not.toHaveProperty('issuerAuthorization');
    expect(ocp.OpenCapTable.issuer).not.toHaveProperty('buildCreate');
    expect(typeof ocp.OpenCapTable.issuer.get).toBe('function');
    expect(Object.keys(ocp.OpenCapTable.setup).sort()).toEqual([
      'acceptAuthorization',
      'authorizeIssuer',
      'buildCreateCapTable',
      'createFactory',
      'findFactory',
      'readCreateCapTableResult',
      'withdrawAuthorization',
    ]);
    expect(Object.keys(ocp.OpenCapTable.capTable).sort()).toEqual([
      'apply',
      'buildBeginTeardown',
      'buildCancelHolds',
      'buildClose',
      'buildFreezeClass',
      'buildPlaceHolds',
      'buildPurge',
      'buildSettle',
      'buildUnfreezeClass',
      'findSettleResults',
      'readBeginTeardownResult',
      'readCancelHoldsResult',
      'readCloseResult',
      'readFreezeClassResult',
      'readPlaceHoldsResult',
      'readSettleResult',
      'readUnfreezeClassResult',
      'restate',
    ]);
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
    async (entityType) => {
      const wrongTemplateId =
        entityType === 'stakeholder' ? ENTITY_REGISTRY.stockClass.templateId : ENTITY_REGISTRY.stakeholder.templateId;
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            signatories: TEST_REGISTER_SIGNATORIES,
            templateId: wrongTemplateId,
            createArgument: { context: GENERATED_CONTEXT, [OCF_DATA_FIELD]: {} },
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
            signatories: TEST_REGISTER_SIGNATORIES,
            templateId: entry.templateId,
            createArgument: { context: GENERATED_CONTEXT, [OCF_DATA_FIELD]: {} },
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
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId: ENTITY_REGISTRY.document.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            ocf_data: {
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
    const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

    await expect(read(ocp)).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_generated_decode',
      source: 'damlToOcf.document.path',
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
      date: '2026-01-01',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1', currency: 'USD' },
        ratio: { numerator: '1', denominator: '1' },
        rounding_type: 'OcfRoundingTypeNormal',
      },
      comments: [],
    };

    for (const malformed of [
      {
        createArgument: { ocf_data: adjustmentData },
        source: 'damlToOcf.stockClassConversionRatioAdjustment.createArgument.context',
        classification: 'invalid_generated_create_argument',
      },
      {
        createArgument: {
          context: GENERATED_CONTEXT,
          ocf_data: adjustmentData,
          unexpected: true,
        },
        source: 'damlToOcf.stockClassConversionRatioAdjustment.createArgument.unexpected',
        classification: 'invalid_generated_daml_json',
      },
    ] as const) {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            signatories: TEST_REGISTER_SIGNATORIES,
            templateId: ENTITY_REGISTRY.stockClassConversionRatioAdjustment.templateId,
            createArgument: malformed.createArgument,
          },
        },
      });
      const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

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
        date: '2026-01-01',
        stock_class_id: 'class-1',
        new_ratio_conversion_mechanism: null,
        comments: [],
      },
    },
    {
      name: 'unknown issuer initial-shares enum',
      entityType: 'issuer',
      objectType: 'ISSUER',
      expectedCode: OcpErrorCodes.SCHEMA_MISMATCH,
      data: {
        id: 'issuer-unknown-shares',
        legal_name: 'Issuer Inc.',
        formation_date: '2026-01-01',
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
        formation_date: '2026-01-01',
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
        allocation_type: 'OcfAllocationTypeCumulativeRounding',
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
        date: '2026-01-01',
        stakeholder_id: 'stakeholder-1',
        relationship_started: '',
        relationship_ended: 'OcfStakeholderRelationshipTypeEmployee',
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
        allocation_type: 'OcfAllocationTypeCumulativeRounding',
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
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId: entry.templateId,
          createArgument: { context: GENERATED_CONTEXT, [OCF_DATA_FIELD]: data },
        },
      },
    });
    const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

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
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId: ENTITY_REGISTRY.issuer.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            ocf_data: {
              id: 'issuer-plus',
              legal_name: 'Issuer Inc.',
              formation_date: '2026-01-01',
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
    const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

    await expect(read(ocp)).resolves.toMatchObject({ data: { initial_shares_authorized: '1.23' } });
  });

  it('generic namespace reads reject create-argument accessors without invoking them', async () => {
    const getter = jest.fn(() => ({ id: 'issuer-accessor' }));
    const createArgument: Record<string, unknown> = { context: GENERATED_CONTEXT };
    Object.defineProperty(createArgument, 'ocf_data', { enumerable: true, get: getter });
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId: ENTITY_REGISTRY.issuer.templateId,
          createArgument,
        },
      },
    });
    const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

    await expect(ocp.OpenCapTable.issuer.get({ contractId: 'issuer-accessor' })).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining('.createArgument.ocf_data'),
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('vestingTerms namespace rejects duplicate next_condition_ids with the exact duplicate index', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          signatories: TEST_REGISTER_SIGNATORIES,
          templateId: ENTITY_REGISTRY.vestingTerms.templateId,
          createArgument: {
            context: GENERATED_CONTEXT,
            ocf_data: {
              id: 'vesting-duplicates',
              allocation_type: 'OcfAllocationTypeCumulativeRounding',
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
    const ocp = new OcpClient({ ledger: { getEventsByContractId } as never });

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
    const ledger = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            signatories: TEST_REGISTER_SIGNATORIES,
            templateId: issuerTemplateId,
            createArgument: {
              context: GENERATED_CONTEXT,
              ocf_data: {
                id: 'iss-1',
                legal_name: 'Facade Test Corp',
                country_of_formation: 'US',
                formation_date: '2025-01-01',
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
            signatories: TEST_REGISTER_SIGNATORIES,
            templateId: Fairmint.OpenCapTable.OCF.StockRetraction.StockRetraction.templateId,
            createArgument: {
              context: GENERATED_CONTEXT,
              ocf_data: {
                id: 'ret-1',
                date: '2025-01-01',
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

describe('OcpClient OpenCapTable.register', () => {
  const ledger = { getLedgerEnd: jest.fn().mockResolvedValue({ offset: 11 }) } as never;

  beforeEach(() => {
    resetWebSocketMock();
  });

  it('reads books and lists cap tables with the injected ledger client', async () => {
    const ocp = new OcpClient({ ledger });
    queueWebSocketScript(async (connection) => deliverMessages(connection, anchorItems(anchorEvent('cid-anchor'))));
    queueWebSocketScript(async (connection) => deliverMessages(connection, bookEvents().map(acsItem)));
    queueWebSocketScript(async (connection) => deliverMessages(connection, anchorItems(anchorEvent('cid-anchor'))));

    const snapshot = await ocp.OpenCapTable.register.read({ readAs: CONTEXT.issuer });
    const found = await ocp.OpenCapTable.register.findCapTables({ party: CONTEXT.issuer, activeAtOffset: 11 });

    expect(snapshot.offset).toBe(11);
    expect(snapshot.books.map((book) => book.context)).toEqual([CONTEXT]);
    expect(found.capTables).toEqual([
      { context: CONTEXT, anchor: expect.objectContaining({ contractId: 'cid-anchor', status: 'ACTIVE' }) },
    ]);
  });

  it("builds a book's writer on the client's ledger with the client's observability defaults", async () => {
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const writerLedger = {
      getNetwork: () => 'devnet',
      getUserId: () => 'ledger-api-user',
      getApiUrl: () => 'http://ledger.test',
      getLedgerEnd: jest.fn().mockResolvedValue({ offset: 5 }),
      makePostRequest: jest.fn().mockResolvedValue([]),
    };
    const ocp = new OcpClient({ ledger: writerLedger as never, logger });
    const index = new register.RegisterIndex({ context: CONTEXT, offset: 1 });

    const writer = ocp.OpenCapTable.register.writer({ context: CONTEXT, transferAgent: CONTEXT.transfer_agent, index });

    expect(writer).toBeInstanceOf(register.RegisterWriter);
    await expect(writer.refresh()).resolves.toBe(5);
    expect(writerLedger.makePostRequest).toHaveBeenCalledTimes(1);
    expect(() =>
      new OcpClient({ ledger: { ...writerLedger, getNetwork: () => 'mainnet' } as never }).OpenCapTable.register.writer(
        {
          context: CONTEXT,
          transferAgent: CONTEXT.transfer_agent,
          index,
        }
      )
    ).toThrow('OpenCapTable-v35 targets DevNet only');
  });
});

describe('OcpClient OpenCapTable.setup', () => {
  const factory = { factoryId: FACTORY_ID, systemOperator: SYSTEM_OPERATOR };
  let ledger: ReturnType<typeof mockLedger>;

  function clientOn(network: string, options: { factory?: OcpFactoryIdentity } = {}): OcpClient {
    const ledgerClient = Object.assign(ledger, { getNetwork: () => network });
    return new OcpClient({
      ledger: ledgerClient as unknown as LedgerJsonApiClient,
      ...(options.factory !== undefined ? { factory: options.factory } : {}),
      defaultContext: { workflowId: 'setup-workflow' },
    });
  }

  beforeEach(() => {
    ledger = mockLedger();
  });

  it('creates the factory of the client identity as its system operator', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([createdEvent('factory-1', FACTORY_TEMPLATE_ID, factoryArgument())])
    );
    const ocp = clientOn('localnet', { factory });

    const result = await ocp.OpenCapTable.setup.createFactory({ context: { commandId: 'create-1' } });

    expect(result).toMatchObject({ contractId: 'factory-1', factoryId: FACTORY_ID, systemOperator: SYSTEM_OPERATOR });
    expect(ledger.submitAndWaitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ actAs: [SYSTEM_OPERATOR], workflowId: 'setup-workflow', commandId: 'create-1' })
    );
  });

  it('finds the live factory of the identity at call time, with the identity template override', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-live')]);
    const ocp = clientOn('localnet', { factory: { ...factory, templateId: FACTORY_TEMPLATE_ID } });

    await expect(ocp.OpenCapTable.setup.findFactory()).resolves.toMatchObject({ contractId: 'factory-live' });

    expect(ledger.getActiveContracts).toHaveBeenCalledWith(
      expect.objectContaining({ templateIds: [FACTORY_TEMPLATE_ID] })
    );
  });

  it('authorizes an issuer through the identity factory, as its system operator', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-live')]);
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([
        exercisedEvent('factory-live', FACTORY_TEMPLATE_ID, 'OcpFactory_AuthorizeIssuer', {
          factory: 'factory-2',
          authorization: 'authorization-1',
          cap_table_id: CAP_TABLE_ID,
        }),
      ])
    );
    const ocp = clientOn('localnet', { factory });

    const result = await ocp.OpenCapTable.setup.authorizeIssuer({ issuer: ISSUER, transferAgent: TRANSFER_AGENT });

    expect(result).toMatchObject({ authorizationContractId: 'authorization-1', capTableId: CAP_TABLE_ID });
    expect(ledger.submitAndWaitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ actAs: [SYSTEM_OPERATOR], workflowId: 'setup-workflow' })
    );
  });

  it('refuses to authorize a self-named transfer agent before touching the ledger', async () => {
    const ocp = clientOn('localnet', { factory });

    await expect(
      ocp.OpenCapTable.setup.authorizeIssuer({ issuer: ISSUER, transferAgent: ISSUER })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
    });
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('accepts the authorization as the transfer agent and withdraws it as the identity system operator', async () => {
    ledger.submitAndWaitForTransaction
      .mockResolvedValueOnce(
        transaction([
          exercisedEvent(
            'authorization-1',
            AUTHORIZATION_TEMPLATE_ID,
            'IssuerAuthorization_TaAccept',
            'authorization-2'
          ),
          createdEvent(
            'authorization-2',
            AUTHORIZATION_TEMPLATE_ID,
            { context: context(), ta_accepted: true },
            { createdEventBlob: 'blob-2' }
          ),
        ])
      )
      .mockResolvedValueOnce(transaction([]));
    const ocp = clientOn('localnet', { factory });

    const accepted = await ocp.OpenCapTable.setup.acceptAuthorization({
      authorizationContractId: 'authorization-1',
      transferAgent: TRANSFER_AGENT,
    });
    await ocp.OpenCapTable.setup.withdrawAuthorization({ authorizationContractId: 'authorization-2' });

    expect(accepted.authorization.contractId).toBe('authorization-2');
    expect(ledger.submitAndWaitForTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actAs: [TRANSFER_AGENT] })
    );
    expect(ledger.submitAndWaitForTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actAs: [SYSTEM_OPERATOR] })
    );
  });

  it('builds the issuer step and reads its result without a ledger call', () => {
    const ocp = clientOn('localnet');

    const built = ocp.OpenCapTable.setup.buildCreateCapTable({
      authorization: authorizationRef(),
      transferAgent: TRANSFER_AGENT,
      issuerData: ISSUER_DATA,
    });
    const result = ocp.OpenCapTable.setup.readCreateCapTableResult(
      transaction([
        exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, 'IssuerAuthorization_CreateCapTable', {
          cap_table: 'cap-table-1',
          issuer: 'issuer-record-1',
          shards: initialShardEntries(),
        }),
      ])
    );

    expect(built.actAs).toEqual([ISSUER]);
    expect(result.capTableContractId).toBe('cap-table-1');
    expect(result.shards.size).toBe(256);
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('asks for an identity on a network the package ships none for, and names the DevNet gap', async () => {
    await expect(clientOn('localnet').OpenCapTable.setup.findFactory()).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'factory',
      message: expect.stringContaining('ships no OcpFactory identity for localnet'),
    });
    await expect(
      clientOn('devnet').OpenCapTable.setup.authorizeIssuer({ issuer: ISSUER, transferAgent: TRANSFER_AGENT })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      message: expect.stringContaining('DevNet OcpFactory has not been created yet'),
    });
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();
  });

  it('uses the explicit identity on DevNet', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-devnet')]);

    await expect(clientOn('devnet', { factory }).OpenCapTable.setup.findFactory()).resolves.toMatchObject({
      contractId: 'factory-devnet',
    });
  });

  it('refuses every setup call that touches the ledger on MainNet, even with an identity', async () => {
    const ocp = clientOn('mainnet', { factory });

    for (const call of [
      async () => ocp.OpenCapTable.setup.createFactory(),
      async () => ocp.OpenCapTable.setup.findFactory(),
      async () => ocp.OpenCapTable.setup.authorizeIssuer({ issuer: ISSUER, transferAgent: TRANSFER_AGENT }),
      async () =>
        ocp.OpenCapTable.setup.acceptAuthorization({ authorizationContractId: 'a', transferAgent: TRANSFER_AGENT }),
      async () => ocp.OpenCapTable.setup.withdrawAuthorization({ authorizationContractId: 'a' }),
    ]) {
      await expect(call()).rejects.toMatchObject({
        name: 'OcpValidationError',
        message: expect.stringContaining('OpenCapTable-v35 targets DevNet only'),
      });
    }
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('uses the logical environment over the ledger network when the client has one', async () => {
    const ocp = new OcpClient({
      ledger: Object.assign(ledger, { getNetwork: () => 'localnet' }) as unknown as LedgerJsonApiClient,
      environment: 'scratchnet',
    });

    await expect(ocp.OpenCapTable.setup.findFactory()).rejects.toMatchObject({
      message: expect.stringContaining('ships no OcpFactory identity for scratchnet'),
    });
  });
});

describe('OcpClient OpenCapTable.capTable', () => {
  const inputs = { states: [], epochs: [], shards: ['shard-1'], records: [] };
  const stakeholder = {
    object_type: 'STAKEHOLDER' as const,
    id: 'SH-1',
    name: { legal_name: 'Holder' },
    stakeholder_type: 'INDIVIDUAL' as const,
  };
  let ledger: ReturnType<typeof mockLedger>;

  function clientOn(network: string): OcpClient {
    return new OcpClient({
      ledger: Object.assign(ledger, { getNetwork: () => network }) as unknown as LedgerJsonApiClient,
      defaultContext: { workflowId: 'register-writes' },
    });
  }

  beforeEach(() => {
    ledger = mockLedger();
  });

  it('submits Apply and Restate through the client as the transfer agent, with its observability defaults', async () => {
    ledger.submitAndWaitForTransaction.mockImplementation(async (request: { commands: unknown[] }) => {
      const [command] = request.commands as Array<{ ExerciseCommand: { choice: string } }>;
      return Promise.resolve(
        transaction([
          exercisedEvent(
            'anchor-1',
            Fairmint.OpenCapTable.CapTable.CapTable.templateIdWithPackageId,
            command?.ExerciseCommand.choice ?? '',
            {
              records: [['SH-1', { tag: 'OcfRecordCidStakeholder', value: 'cid-SH-1' }]],
              states: [],
              epochs: [],
              shards: [],
            },
            false
          ),
        ])
      );
    });
    const ocp = clientOn('devnet');

    const applied = await ocp.OpenCapTable.capTable
      .apply({ capTableContractId: 'anchor-1', transferAgent: TRANSFER_AGENT, inputs })
      .create('stakeholder', stakeholder)
      .execute();
    const restated = await ocp.OpenCapTable.capTable
      .restate({ capTableContractId: 'anchor-1', transferAgent: TRANSFER_AGENT, inputs, commandId: 'restate-1' })
      .edit('stakeholder', stakeholder)
      .execute();

    expect(applied.records.get('SH-1')).toEqual({ entityType: 'stakeholder', contractId: 'cid-SH-1' });
    expect(restated.records.get('SH-1')?.contractId).toBe('cid-SH-1');
    const [applyRequest, restateRequest] = ledger.submitAndWaitForTransaction.mock.calls.map(([request]) => request);
    expect(applyRequest).toMatchObject({ actAs: [TRANSFER_AGENT], workflowId: 'register-writes' });
    expect(restateRequest).toMatchObject({ actAs: [TRANSFER_AGENT], commandId: 'restate-1' });
  });

  it('builds the other anchor choices without a ledger call', () => {
    const ocp = clientOn('devnet');
    const freeze = ocp.OpenCapTable.capTable.buildFreezeClass({
      capTableContractId: 'anchor-1',
      transferAgent: TRANSFER_AGENT,
      epochContractId: 'epoch-1',
    });
    const close = ocp.OpenCapTable.capTable.buildClose({
      capTableContractId: 'anchor-1',
      systemOperator: SYSTEM_OPERATOR,
    });
    expect(freeze.actAs).toEqual([TRANSFER_AGENT]);
    expect(close.actAs).toEqual([SYSTEM_OPERATOR]);
    expect(ocp.OpenCapTable.capTable.findSettleResults({ events: [] })).toEqual([]);
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('refuses register writes on MainNet', () => {
    const ocp = clientOn('mainnet');
    for (const call of [
      () => ocp.OpenCapTable.capTable.apply({ capTableContractId: 'a', transferAgent: TRANSFER_AGENT, inputs }),
      () => ocp.OpenCapTable.capTable.restate({ capTableContractId: 'a', transferAgent: TRANSFER_AGENT, inputs }),
    ]) {
      expect(call).toThrow('OpenCapTable-v35 targets DevNet only');
    }
  });
});
