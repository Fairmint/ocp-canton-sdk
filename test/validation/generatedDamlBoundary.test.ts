import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { getEntityAsOcf, type SupportedOcfReadType } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { documentDataToDaml } from '../../src/functions/OpenCapTable/document/createDocument';
import { getDocumentAsOcf } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import { issuerDataToDaml } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { stakeholderRelationshipChangeEventDataToDaml } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { stockPlanDataToDaml } from '../../src/functions/OpenCapTable/stockPlan/createStockPlan';
import { getStockPlanAsOcf } from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { OcpClient } from '../../src/OcpClient';
import {
  assertSafeGeneratedDamlJson,
  extractGeneratedCreateArgumentData,
} from '../../src/utils/generatedDamlValidation';

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function mockClient(templateId: string, createArgument: unknown): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: { createdEvent: { templateId, createArgument } },
    }),
  } as unknown as LedgerJsonApiClient;
}

const wrapperCases: ReadonlyArray<{
  readonly name: string;
  readonly entityType: SupportedOcfReadType;
  readonly templateId: string;
  readonly dataField: string;
  readonly data: Record<string, unknown>;
  readonly dedicated: (client: LedgerJsonApiClient) => Promise<unknown>;
}> = [
  {
    name: 'Document',
    entityType: 'document',
    templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
    dataField: 'document_data',
    data: {
      id: 'document-wrapper',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: './agreement.pdf',
      uri: null,
      related_objects: [],
      comments: [],
    },
    dedicated: async (client) => getDocumentAsOcf(client, { contractId: 'document-wrapper' }),
  },
  {
    name: 'Issuer',
    entityType: 'issuer',
    templateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
    dataField: 'issuer_data',
    data: {
      id: 'issuer-wrapper',
      legal_name: 'Wrapper Issuer',
      country_of_formation: 'US',
      formation_date: '2026-01-01T00:00:00.000Z',
      dba: null,
      country_subdivision_of_formation: null,
      country_subdivision_name_of_formation: null,
      tax_ids: [],
      email: null,
      phone: null,
      address: null,
      initial_shares_authorized: null,
      comments: [],
    },
    dedicated: async (client) => getIssuerAsOcf(client, { contractId: 'issuer-wrapper' }),
  },
  {
    name: 'StockPlan',
    entityType: 'stockPlan',
    templateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
    dataField: 'plan_data',
    data: {
      id: 'plan-wrapper',
      plan_name: 'Wrapper Plan',
      initial_shares_reserved: '1000',
      stock_class_ids: ['class-1'],
      comments: [],
    },
    dedicated: async (client) => getStockPlanAsOcf(client, { contractId: 'plan-wrapper' }),
  },
  {
    name: 'VestingTerms',
    entityType: 'vestingTerms',
    templateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
    dataField: 'vesting_terms_data',
    data: {
      id: 'vesting-wrapper',
      name: 'Wrapper Vesting',
      description: 'Wrapper validation',
      allocation_type: 'OcfAllocationCumulativeRounding',
      vesting_conditions: [
        {
          id: 'vesting-wrapper-condition',
          description: null,
          quantity: null,
          portion: { numerator: '1', denominator: '1', remainder: false },
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: [],
        },
      ],
      comments: [],
    },
    dedicated: async (client) => getVestingTermsAsOcf(client, { contractId: 'vesting-wrapper' }),
  },
];

describe('exact generated createArgument wrappers', () => {
  test.each(wrapperCases)('$name dedicated and generic readers accept the exact wrapper', async (entry) => {
    const createArgument = { context: GENERATED_CONTEXT, [entry.dataField]: entry.data };

    await expect(entry.dedicated(mockClient(entry.templateId, createArgument))).resolves.toBeDefined();
    await expect(
      getEntityAsOcf(mockClient(entry.templateId, createArgument), entry.entityType, `${entry.entityType}-generic`)
    ).resolves.toBeDefined();
  });

  test.each(wrapperCases)('$name dedicated and generic readers reject unexpected wrapper fields', async (entry) => {
    const createArgument = {
      context: GENERATED_CONTEXT,
      [entry.dataField]: entry.data,
      unexpected_wrapper: true,
    };
    const expected = {
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining('unexpected_wrapper'),
    };

    await expect(entry.dedicated(mockClient(entry.templateId, createArgument))).rejects.toMatchObject(expected);
    await expect(
      getEntityAsOcf(mockClient(entry.templateId, createArgument), entry.entityType, `${entry.entityType}-generic`)
    ).rejects.toMatchObject(expected);
  });

  test('OcpClient namespace and object-type routes preserve exact wrapper validation', async () => {
    const document = wrapperCases[0];
    const createArgument = {
      context: GENERATED_CONTEXT,
      [document.dataField]: document.data,
      unexpected_wrapper: true,
    };
    const expected = {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'damlToOcf.document.createArgument.unexpected_wrapper',
    };
    const ocp = new OcpClient({ ledger: mockClient(document.templateId, createArgument) });

    await expect(ocp.OpenCapTable.document.get({ contractId: 'document-namespace' })).rejects.toMatchObject(expected);
    await expect(
      ocp.OpenCapTable.getByObjectType({ objectType: 'DOCUMENT', contractId: 'document-object-type' })
    ).rejects.toMatchObject(expected);
  });

  test.each(wrapperCases)('$name dedicated and generic readers require canonical context', async (entry) => {
    const createArgument = { [entry.dataField]: entry.data };
    const expected = {
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining('.context'),
    };

    await expect(entry.dedicated(mockClient(entry.templateId, createArgument))).rejects.toMatchObject(expected);
    await expect(
      getEntityAsOcf(mockClient(entry.templateId, createArgument), entry.entityType, `${entry.entityType}-generic`)
    ).rejects.toMatchObject(expected);
  });

  test.each(wrapperCases)('$name dedicated and generic readers align missing data wrapper errors', async (entry) => {
    const createArgument = { context: GENERATED_CONTEXT };
    const expected = {
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining(`.${entry.dataField}`),
    };

    await expect(entry.dedicated(mockClient(entry.templateId, createArgument))).rejects.toMatchObject(expected);
    await expect(
      getEntityAsOcf(mockClient(entry.templateId, createArgument), entry.entityType, `${entry.entityType}-generic`)
    ).rejects.toMatchObject(expected);
  });

  test.each([
    ['missing issuer', { system_operator: 'system-operator::party' }, '.context.issuer'],
    ['missing system operator', { issuer: 'issuer::party' }, '.context.system_operator'],
    ['unexpected context field', { ...GENERATED_CONTEXT, unexpected: true }, '.context.unexpected'],
  ] as const)('rejects canonical context with %s', (_case, context, sourceSuffix) => {
    expect(() =>
      extractGeneratedCreateArgumentData({ context, document_data: wrapperCases[0]?.data }, 'Document.createArgument', {
        dataField: 'document_data',
      })
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `Document.createArgument${sourceSuffix}`,
      })
    );
  });

  test('rejects any wrapper field other than the one emitted by the pinned template', () => {
    expect(() =>
      extractGeneratedCreateArgumentData(
        { context: GENERATED_CONTEXT, canonical_data: {}, fallback_data: {} },
        'Probe.createArgument',
        { dataField: 'canonical_data' }
      )
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'Probe.createArgument.fallback_data',
      })
    );
  });

  test('accepts exact null-prototype wrapper, context, and data records', async () => {
    const document = wrapperCases[0];
    const context = Object.assign(Object.create(null) as Record<string, unknown>, GENERATED_CONTEXT);
    const data = Object.assign(Object.create(null) as Record<string, unknown>, document.data);
    const createArgument = Object.assign(Object.create(null) as Record<string, unknown>, {
      context,
      [document.dataField]: data,
    });

    await expect(document.dedicated(mockClient(document.templateId, createArgument))).resolves.toBeDefined();
    await expect(
      getEntityAsOcf(mockClient(document.templateId, createArgument), 'document', 'null-prototype-document')
    ).resolves.toBeDefined();
  });

  test('rejects non-enumerable wrapper fields and million-length sparse nested arrays', async () => {
    const document = wrapperCases[0];
    const nonEnumerable: Record<string, unknown> = { context: GENERATED_CONTEXT };
    Object.defineProperty(nonEnumerable, document.dataField, {
      value: document.data,
      enumerable: false,
    });
    const sparse = new Array(1_000_000);
    const sparseArgument = {
      context: GENERATED_CONTEXT,
      [document.dataField]: { ...document.data, comments: sparse },
    };

    await expect(document.dedicated(mockClient(document.templateId, nonEnumerable))).rejects.toBeInstanceOf(
      OcpParseError
    );
    const startedAt = Date.now();
    await expect(document.dedicated(mockClient(document.templateId, sparseArgument))).rejects.toBeInstanceOf(
      OcpParseError
    );
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

describe('proxy-safe generated JSON validation', () => {
  function throwingProxy(target: object = {}): { proxy: object; traps: jest.Mock[] } {
    const get = jest.fn(() => {
      throw new Error('get trap invoked');
    });
    const getPrototypeOf = jest.fn(() => {
      throw new Error('getPrototypeOf trap invoked');
    });
    const ownKeys = jest.fn(() => {
      throw new Error('ownKeys trap invoked');
    });
    const getOwnPropertyDescriptor = jest.fn(() => {
      throw new Error('getOwnPropertyDescriptor trap invoked');
    });
    return {
      proxy: new Proxy(target, { get, getPrototypeOf, ownKeys, getOwnPropertyDescriptor }),
      traps: [get, getPrototypeOf, ownKeys, getOwnPropertyDescriptor],
    };
  }

  test('rejects a top-level throwing proxy without invoking any trap', async () => {
    const { proxy, traps } = throwingProxy();
    const document = wrapperCases[0];

    await expect(document.dedicated(mockClient(document.templateId, proxy))).rejects.toMatchObject({
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
    expect(traps.every((trap) => trap.mock.calls.length === 0)).toBe(true);
  });

  test.each(['created', 'createdEvent'] as const)(
    'rejects a proxied ledger %s envelope before invoking traps',
    async (level) => {
      const { proxy, traps } = throwingProxy();
      const response = level === 'created' ? { created: proxy } : { created: { createdEvent: proxy } };
      const client = { getEventsByContractId: jest.fn().mockResolvedValue(response) } as unknown as LedgerJsonApiClient;

      await expect(getDocumentAsOcf(client, { contractId: `envelope-${level}` })).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.INVALID_RESPONSE,
      });
      expect(traps.every((trap) => trap.mock.calls.length === 0)).toBe(true);
    }
  );

  test('rejects benign and revoked ledger proxies without executing them', async () => {
    const getter = jest.fn((target: object, property: PropertyKey, receiver: unknown) =>
      Reflect.get(target, property, receiver)
    );
    const target = {
      createdEvent: {
        templateId: wrapperCases[0]?.templateId,
        createArgument: { context: GENERATED_CONTEXT, document_data: wrapperCases[0]?.data },
      },
    };
    const benign = new Proxy(target, { get: getter });
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();

    for (const [label, response] of [
      ['benign', benign],
      ['revoked', revocable.proxy],
    ] as const) {
      const client = {
        getEventsByContractId: jest.fn().mockResolvedValue({ created: response }),
      } as unknown as LedgerJsonApiClient;
      await expect(getDocumentAsOcf(client, { contractId: `envelope-${label}` })).rejects.toBeInstanceOf(OcpParseError);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  test('rejects an envelope createArgument accessor without invoking it', async () => {
    const getter = jest.fn(() => ({ context: GENERATED_CONTEXT, document_data: wrapperCases[0]?.data }));
    const createdEvent: Record<string, unknown> = { templateId: wrapperCases[0]?.templateId };
    Object.defineProperty(createdEvent, 'createArgument', { enumerable: true, get: getter });
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({ created: { createdEvent } }),
    } as unknown as LedgerJsonApiClient;

    await expect(getDocumentAsOcf(client, { contractId: 'envelope-accessor' })).rejects.toMatchObject({
      name: OcpParseError.name,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: expect.stringContaining('.createArgument'),
    });
    expect(getter).not.toHaveBeenCalled();
  });

  test('rejects nested object and array proxies without invoking traps', () => {
    const nestedObject = throwingProxy();
    const nestedArray = throwingProxy([]);

    for (const [value, traps, source] of [
      [
        { context: GENERATED_CONTEXT, document_data: nestedObject.proxy },
        nestedObject.traps,
        'Document.createArgument.document_data',
      ],
      [
        { context: GENERATED_CONTEXT, document_data: { ...wrapperCases[0]?.data, comments: nestedArray.proxy } },
        nestedArray.traps,
        'Document.createArgument.document_data.comments',
      ],
    ] as const) {
      expect(() =>
        extractGeneratedCreateArgumentData(value, 'Document.createArgument', { dataField: 'document_data' })
      ).toThrow(expect.objectContaining({ code: OcpErrorCodes.SCHEMA_MISMATCH, source }));
      expect(traps.every((trap) => trap.mock.calls.length === 0)).toBe(true);
    }
  });

  test('rejects a revoked proxy with a structured serializable error', () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    try {
      assertSafeGeneratedDamlJson(revocable.proxy, 'payload');
      throw new Error('Expected revoked proxy validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'payload',
        context: { receivedValue: { containerType: 'proxy' }, source: 'payload' },
      });
      expect(() => JSON.stringify(error)).not.toThrow();
    }
  });

  test('rejects an accessor wrapper field without invoking it', () => {
    const getter = jest.fn(() => wrapperCases[0]?.data);
    const createArgument: Record<string, unknown> = { context: GENERATED_CONTEXT };
    Object.defineProperty(createArgument, 'document_data', { enumerable: true, get: getter });

    expect(() =>
      extractGeneratedCreateArgumentData(createArgument, 'Document.createArgument', { dataField: 'document_data' })
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'Document.createArgument.document_data',
      })
    );
    expect(getter).not.toHaveBeenCalled();
  });

  test('rejects inherited wrapper fields without invoking prototype accessors', () => {
    const getter = jest.fn(() => wrapperCases[0]?.data);
    const prototype = {};
    Object.defineProperty(prototype, 'document_data', { enumerable: true, get: getter });
    const createArgument = Object.assign(Object.create(prototype) as Record<string, unknown>, {
      context: GENERATED_CONTEXT,
    });

    expect(() =>
      extractGeneratedCreateArgumentData(createArgument, 'Document.createArgument', { dataField: 'document_data' })
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'Document.createArgument',
      })
    );
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('trap-free direct OCF writers', () => {
  const directWriters: ReadonlyArray<readonly [string, (value: never) => unknown]> = [
    ['Document', documentDataToDaml],
    ['Issuer', issuerDataToDaml],
    ['Stakeholder', stakeholderDataToDaml],
    ['StakeholderRelationshipChangeEvent', stakeholderRelationshipChangeEventDataToDaml],
    ['StockClassConversionRatioAdjustment', stockClassConversionRatioAdjustmentDataToDaml],
    ['StockPlan', stockPlanDataToDaml],
    ['VestingTerms', vestingTermsDataToDaml],
  ];

  test.each(directWriters)(
    '%s rejects throwing and revoked top-level proxies without invoking traps',
    (_name, write) => {
      const traps = {
        get: jest.fn(() => {
          throw new Error('direct writer get trap invoked');
        }),
        getPrototypeOf: jest.fn(() => {
          throw new Error('direct writer getPrototypeOf trap invoked');
        }),
        ownKeys: jest.fn(() => {
          throw new Error('direct writer ownKeys trap invoked');
        }),
      };
      const proxy = new Proxy({}, traps);
      const revocable = Proxy.revocable({}, {});
      revocable.revoke();

      expect(() => write(proxy as never)).toThrow(OcpValidationError);
      expect(() => write(revocable.proxy as never)).toThrow(OcpValidationError);
      expect(Object.values(traps).every((trap) => trap.mock.calls.length === 0)).toBe(true);
    }
  );

  test('rejects nested proxies and accessors without invoking them', () => {
    const proxyGetter = jest.fn(() => {
      throw new Error('nested proxy trap invoked');
    });
    const nestedProxy = new Proxy({}, { get: proxyGetter });
    const accessor = jest.fn(() => './agreement.pdf');
    const accessorDocument: Record<string, unknown> = {
      object_type: 'DOCUMENT',
      id: 'accessor-document',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
    };
    Object.defineProperty(accessorDocument, 'path', { enumerable: true, get: accessor });

    expect(() =>
      documentDataToDaml({
        object_type: 'DOCUMENT',
        id: 'nested-proxy-document',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
        related_objects: [nestedProxy as never],
      })
    ).toThrow(expect.objectContaining({ fieldPath: 'document.related_objects[0]' }));
    expect(() => documentDataToDaml(accessorDocument as never)).toThrow(
      expect.objectContaining({ fieldPath: 'document.path' })
    );
    expect(proxyGetter).not.toHaveBeenCalled();
    expect(accessor).not.toHaveBeenCalled();
  });

  test.each([
    ['undefined', undefined],
    ['BigInt', 1n],
    ['Symbol', Symbol('direct-writer')],
    ['function', () => 'direct-writer'],
  ] as const)('rejects nested %s before semantic conversion', (_name, adversarial) => {
    expect(() =>
      documentDataToDaml({
        object_type: 'DOCUMENT',
        id: 'non-json-document',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
        adversarial,
      } as never)
    ).toThrow(expect.objectContaining({ fieldPath: 'document.adversarial' }));
  });

  test('reports structured errors for JSON objects in scalar and nested-object slots', () => {
    const adversarialObject = Object.create(null) as Record<string, unknown>;
    const baseVesting = {
      object_type: 'VESTING_TERMS' as const,
      id: 'vesting-structured-errors',
      name: 'Structured errors',
      description: 'Reject wrong runtime shapes',
      allocation_type: 'CUMULATIVE_ROUNDING' as const,
      vesting_conditions: [
        {
          id: 'condition-1',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' as const },
          next_condition_ids: [],
        },
      ] as const,
    };

    const actions = [
      () =>
        stockPlanDataToDaml({
          object_type: 'STOCK_PLAN',
          id: 'plan-structured-errors',
          plan_name: 'Plan',
          initial_shares_reserved: adversarialObject,
          stock_class_ids: ['class-1'],
        } as never),
      () => vestingTermsDataToDaml({ ...baseVesting, allocation_type: adversarialObject } as never),
      () => vestingTermsDataToDaml({ ...baseVesting, vesting_conditions: [null] } as never),
      () =>
        vestingTermsDataToDaml({
          ...baseVesting,
          vesting_conditions: [
            {
              id: 'condition-1',
              portion: adversarialObject,
              trigger: { type: 'VESTING_START_DATE' },
              next_condition_ids: [],
            },
          ],
        } as never),
      () =>
        stakeholderRelationshipChangeEventDataToDaml({
          object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
          id: 'relationship-structured-errors',
          date: '2026-01-01',
          stakeholder_id: 'stakeholder-1',
          relationship_started: adversarialObject,
        } as never),
    ];

    for (const action of actions) expect(action).toThrow(OcpError);
  });

  test('rejects custom prototypes but accepts semantically valid null-prototype JSON', () => {
    const custom = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, {
      object_type: 'DOCUMENT',
      id: 'custom-document',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: './agreement.pdf',
    });
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      object_type: 'DOCUMENT',
      id: 'null-prototype-document',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: './agreement.pdf',
    });

    expect(() => documentDataToDaml(custom as never)).toThrow(OcpValidationError);
    expect(documentDataToDaml(nullPrototype as never)).toMatchObject({
      id: 'null-prototype-document',
      path: './agreement.pdf',
      uri: null,
    });
  });

  test('rejects extra and non-enumerable direct-writer fields instead of discarding them', () => {
    const extra = {
      object_type: 'DOCUMENT' as const,
      id: 'extra-document',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: './agreement.pdf',
      unexpected: true,
    };
    const nonEnumerable: Record<string, unknown> = {
      object_type: 'DOCUMENT',
      id: 'non-enumerable-document',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      path: './agreement.pdf',
    };
    Object.defineProperty(nonEnumerable, 'comments', { value: [], enumerable: false });

    expect(() => documentDataToDaml(extra as never)).toThrow(OcpValidationError);
    expect(() => documentDataToDaml(nonEnumerable as never)).toThrow(
      expect.objectContaining({ fieldPath: 'document.comments' })
    );
  });

  test('rejects million-length sparse containers in bounded time and space', () => {
    const sparse = new Array(1_000_000);
    const startedAt = Date.now();

    expect(() =>
      documentDataToDaml({
        object_type: 'DOCUMENT',
        id: 'sparse-document',
        md5: 'd41d8cd98f00b204e9800998ecf8427e',
        path: './agreement.pdf',
        comments: sparse,
      } as never)
    ).toThrow(expect.objectContaining({ fieldPath: 'document.comments[0]' }));
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

describe('bounded generated and numeric diagnostics', () => {
  test('globally bounds deep, wide, and repeatedly referenced diagnostics', () => {
    const huge = 'x'.repeat(100_000);
    const leaf = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`leaf${index}`, huge]));
    const branch = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`branch${index}`, leaf]));
    const root = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`root${index}`, branch]));
    const error = new OcpValidationError('field'.repeat(10_000), 'message'.repeat(10_000), {
      classification: 'classification'.repeat(10_000),
      receivedValue: root,
      context: { root },
    });

    const serialized = JSON.stringify(error);
    expect(serialized.length).toBeLessThanOrEqual(2_048);
    expect(error.message.length).toBeLessThan(1_000);
    expect(error.classification?.length).toBeLessThan(300);
  });

  test('bounds every public OcpError field in JSON, including an adversarial cause', () => {
    const cause = Object.assign(new Error('cause'.repeat(100_000)), {
      huge: 'x'.repeat(100_000),
      bigint: 1n,
    });
    const error = new OcpError('message'.repeat(100_000), OcpErrorCodes.INVALID_RESPONSE, cause, {
      classification: 'classification'.repeat(100_000),
      context: { huge: 'x'.repeat(100_000) },
    });

    expect(error.cause).toBe(cause);
    expect(JSON.stringify(error).length).toBeLessThanOrEqual(2_048);
  });

  test('summarizes huge BigInt and Symbol primitives without full text coercion', () => {
    const hugeBigInt = 1n << 1_000_000n;
    const hugeSymbolDescription = 's'.repeat(100_000);
    const error = new OcpValidationError('primitive', 'adversarial primitive diagnostics', {
      receivedValue: {
        hugeBigInt,
        hugeSymbol: Symbol(hugeSymbolDescription),
      },
    });

    expect(error.receivedValue).toMatchObject({
      hugeBigInt: { valueType: 'bigint', sign: 'positive' },
      hugeSymbol: {
        valueType: 'symbol',
        description: { valueType: 'string', length: hugeSymbolDescription.length },
      },
    });
    expect((error.receivedValue as { hugeBigInt: unknown }).hugeBigInt).not.toHaveProperty('value');
    expect(JSON.stringify(error).length).toBeLessThanOrEqual(2_048);
  });

  test.each([
    ['top-level undefined', undefined, 'payload'],
    ['nested undefined', { nested: undefined }, 'payload.nested'],
    ['BigInt', { nested: 1n }, 'payload.nested'],
    ['Symbol', { nested: Symbol('adversarial') }, 'payload.nested'],
    ['function', { nested: () => 'adversarial' }, 'payload.nested'],
  ] as const)('rejects %s with bounded JSON-serializable diagnostics', (_case, value, source) => {
    try {
      assertSafeGeneratedDamlJson(value, 'payload');
      throw new Error('Expected generated JSON validation to fail');
    } catch (error) {
      expect(error).toMatchObject({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source });
      const serialized = JSON.stringify(error);
      expect(serialized.length).toBeLessThan(1_000);
    }
  });

  test('bounds a 100k Numeric diagnostic on generated reads and OCF writes', () => {
    const hugeNumeric = '9'.repeat(100_000);
    const generated = {
      id: 'ratio-diagnostic',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: hugeNumeric, currency: 'USD' },
        ratio: { numerator: '1', denominator: '1' },
        rounding_type: 'OcfRoundingNormal',
      },
      comments: [],
    };
    const ocf = {
      object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT' as const,
      id: 'ratio-diagnostic',
      date: '2026-01-01',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION' as const,
        conversion_price: { amount: hugeNumeric, currency: 'USD' },
        ratio: { numerator: '1', denominator: '1' },
        rounding_type: 'NORMAL' as const,
      },
    };

    for (const convert of [
      () => damlStockClassConversionRatioAdjustmentToNative(generated),
      () => stockClassConversionRatioAdjustmentDataToDaml(ocf),
    ]) {
      try {
        convert();
        throw new Error('Expected Numeric validation to fail');
      } catch (error) {
        expect(error instanceof OcpParseError || error instanceof OcpValidationError).toBe(true);
        const serialized = JSON.stringify(error);
        expect(serialized.length).toBeLessThan(2_000);
        expect(serialized).not.toContain(hugeNumeric.slice(0, 1_000));
      }
    }
  });

  test('keeps huge sparse-container diagnostics bounded without scanning array length', () => {
    const sparse = new Array(2 ** 32 - 1);
    Object.setPrototypeOf(sparse, {});

    try {
      assertSafeGeneratedDamlJson(sparse, 'payload');
      throw new Error('Expected sparse custom-prototype array to fail');
    } catch (error) {
      const serialized = JSON.stringify(error);
      expect(serialized.length).toBeLessThan(1_000);
      expect(error).toMatchObject({
        context: expect.objectContaining({ receivedValue: expect.objectContaining({ containerType: 'array' }) }),
      });
    }
  });

  test('sanitizes proxied contexts and keeps adversarial causes non-enumerable', () => {
    const contextProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('context ownKeys trap invoked');
        },
      }
    );
    const cause = Object.assign(new Error('cause'), { adversarial: 1n, huge: 'x'.repeat(100_000) });
    const error = new OcpParseError('diagnostic', { context: contextProxy, cause });

    expect(error.cause).toBe(cause);
    expect(Object.prototype.propertyIsEnumerable.call(error, 'cause')).toBe(false);
    const serialized = JSON.stringify(error);
    expect(serialized.length).toBeLessThan(1_000);
    expect(serialized).toContain('proxy');
  });
});
