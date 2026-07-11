import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { getEntityAsOcf, type SupportedOcfReadType } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { getDocumentAsOcf } from '../../src/functions/OpenCapTable/document/getDocumentAsOcf';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { getStockPlanAsOcf } from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
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

  test('rejects ambiguous canonical and fallback wrappers consistently', () => {
    expect(() =>
      extractGeneratedCreateArgumentData(
        { context: GENERATED_CONTEXT, canonical_data: {}, fallback_data: {} },
        'Probe.createArgument',
        { dataField: 'canonical_data', fallbackDataFields: ['fallback_data'] }
      )
    ).toThrow(
      expect.objectContaining({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'Probe.createArgument',
        context: expect.objectContaining({ presentDataFields: ['canonical_data', 'fallback_data'] }),
      })
    );
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

describe('bounded generated and numeric diagnostics', () => {
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
