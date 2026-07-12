/** Direct ledger-reader contracts for stock corporate-action transactions. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
  type OcfReadDataTypeFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { getStockClassConversionRatioAdjustmentAsOcf } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/getStockClassConversionRatioAdjustmentAsOcf';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { getStockClassSplitAsOcf } from '../../src/functions/OpenCapTable/stockClassSplit/getStockClassSplitAsOcf';
import { stockClassSplitDataToDaml } from '../../src/functions/OpenCapTable/stockClassSplit/stockClassSplitDataToDaml';
import { damlStockConsolidationToNative } from '../../src/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import { getStockConsolidationAsOcf } from '../../src/functions/OpenCapTable/stockConsolidation/getStockConsolidationAsOcf';
import { stockConsolidationDataToDaml } from '../../src/functions/OpenCapTable/stockConsolidation/stockConsolidationDataToDaml';
import { damlStockReissuanceToNative } from '../../src/functions/OpenCapTable/stockReissuance/damlToStockReissuance';
import { getStockReissuanceAsOcf } from '../../src/functions/OpenCapTable/stockReissuance/getStockReissuanceAsOcf';
import { stockReissuanceDataToDaml } from '../../src/functions/OpenCapTable/stockReissuance/stockReissuanceDataToDaml';
import { damlStockRepurchaseToNative } from '../../src/functions/OpenCapTable/stockRepurchase/damlToOcf';
import { getStockRepurchaseAsOcf } from '../../src/functions/OpenCapTable/stockRepurchase/getStockRepurchaseAsOcf';
import { stockRepurchaseDataToDaml } from '../../src/functions/OpenCapTable/stockRepurchase/stockRepurchaseDataToDaml';
import type { RoundingType } from '../../src/types/native';

type StockCorporateActionEntityType = Extract<
  OcfEntityType,
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockReissuance'
  | 'stockRepurchase'
>;

type StockCorporateAction = OcfReadDataTypeFor<StockCorporateActionEntityType>;

const canonicalContext = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

function conversionRatioAdjustmentData(roundingType: RoundingType = 'NORMAL'): Record<string, unknown> {
  return stockClassConversionRatioAdjustmentDataToDaml({
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: 'conversion-ratio-adjustment-1',
    date: '2026-07-10',
    stock_class_id: 'preferred-stock-class-1',
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: { amount: '2.2500', currency: 'USD' },
      ratio: { numerator: '3.0000', denominator: '2.0000' },
      rounding_type: roundingType,
    },
    comments: ['anti-dilution adjustment'],
  });
}

function stockClassSplitData(): Record<string, unknown> {
  return stockClassSplitDataToDaml({
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: 'stock-class-split-1',
    date: '2026-07-10',
    stock_class_id: 'common-stock-class-1',
    split_ratio: { numerator: '4.0000', denominator: '1.0000' },
    comments: ['four-for-one split'],
  });
}

function stockConsolidationData(): Record<string, unknown> {
  return stockConsolidationDataToDaml({
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: 'stock-consolidation-1',
    date: '2026-07-10',
    security_ids: ['security-old-1', 'security-old-2'],
    resulting_security_id: 'security-consolidated-1',
    reason_text: 'Reverse split cleanup',
    comments: ['securities consolidated'],
  });
}

function stockReissuanceData(): Record<string, unknown> {
  return stockReissuanceDataToDaml({
    object_type: 'TX_STOCK_REISSUANCE',
    id: 'stock-reissuance-1',
    date: '2026-07-10',
    security_id: 'security-retired-1',
    resulting_security_ids: ['security-new-1', 'security-new-2'],
    reason_text: 'Certificate replacement',
    split_transaction_id: 'stock-class-split-1',
    comments: ['security reissued'],
  });
}

function stockRepurchaseData(): Record<string, unknown> {
  return stockRepurchaseDataToDaml({
    object_type: 'TX_STOCK_REPURCHASE',
    id: 'stock-repurchase-1',
    date: '2026-07-10',
    security_id: 'security-repurchased-1',
    quantity: '12.5000',
    price: { amount: '2.2500', currency: 'USD' },
    balance_security_id: 'security-balance-1',
    consideration_text: 'Cash repurchase',
    comments: ['shares repurchased'],
  });
}

interface StockCorporateActionReaderCase {
  readonly entityType: StockCorporateActionEntityType;
  readonly contractId: string;
  readonly requiredScalar: string;
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: StockCorporateAction;
  readonly directRead: (data: Record<string, unknown>) => StockCorporateAction;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: StockCorporateAction; readonly contractId: string }>;
}

const conversionRatioAdjustmentCase: StockCorporateActionReaderCase = {
  entityType: 'stockClassConversionRatioAdjustment',
  contractId: 'conversion-ratio-adjustment-cid',
  requiredScalar: 'stock_class_id',
  validData: conversionRatioAdjustmentData,
  expectedEvent: {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: 'conversion-ratio-adjustment-1',
    date: '2026-07-10',
    stock_class_id: 'preferred-stock-class-1',
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: { amount: '2.25', currency: 'USD' },
      ratio: { numerator: '3', denominator: '2' },
      rounding_type: 'NORMAL',
    },
    comments: ['anti-dilution adjustment'],
  },
  directRead: (data) =>
    damlStockClassConversionRatioAdjustmentToNative(
      data as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0]
    ),
  invoke: async (client, readAs) =>
    getStockClassConversionRatioAdjustmentAsOcf(client, {
      contractId: 'conversion-ratio-adjustment-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stockClassSplitCase: StockCorporateActionReaderCase = {
  entityType: 'stockClassSplit',
  contractId: 'stock-class-split-cid',
  requiredScalar: 'stock_class_id',
  validData: stockClassSplitData,
  expectedEvent: {
    object_type: 'TX_STOCK_CLASS_SPLIT',
    id: 'stock-class-split-1',
    date: '2026-07-10',
    stock_class_id: 'common-stock-class-1',
    split_ratio: { numerator: '4', denominator: '1' },
    comments: ['four-for-one split'],
  },
  directRead: (data) => damlStockClassSplitToNative(data as Parameters<typeof damlStockClassSplitToNative>[0]),
  invoke: async (client, readAs) =>
    getStockClassSplitAsOcf(client, {
      contractId: 'stock-class-split-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stockConsolidationCase: StockCorporateActionReaderCase = {
  entityType: 'stockConsolidation',
  contractId: 'stock-consolidation-cid',
  requiredScalar: 'resulting_security_id',
  validData: stockConsolidationData,
  expectedEvent: {
    object_type: 'TX_STOCK_CONSOLIDATION',
    id: 'stock-consolidation-1',
    date: '2026-07-10',
    security_ids: ['security-old-1', 'security-old-2'],
    resulting_security_id: 'security-consolidated-1',
    reason_text: 'Reverse split cleanup',
    comments: ['securities consolidated'],
  },
  directRead: (data) => damlStockConsolidationToNative(data as Parameters<typeof damlStockConsolidationToNative>[0]),
  invoke: async (client, readAs) =>
    getStockConsolidationAsOcf(client, {
      contractId: 'stock-consolidation-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stockReissuanceCase: StockCorporateActionReaderCase = {
  entityType: 'stockReissuance',
  contractId: 'stock-reissuance-cid',
  requiredScalar: 'security_id',
  validData: stockReissuanceData,
  expectedEvent: {
    object_type: 'TX_STOCK_REISSUANCE',
    id: 'stock-reissuance-1',
    date: '2026-07-10',
    security_id: 'security-retired-1',
    resulting_security_ids: ['security-new-1', 'security-new-2'],
    reason_text: 'Certificate replacement',
    split_transaction_id: 'stock-class-split-1',
    comments: ['security reissued'],
  },
  directRead: (data) => damlStockReissuanceToNative(data as Parameters<typeof damlStockReissuanceToNative>[0]),
  invoke: async (client, readAs) =>
    getStockReissuanceAsOcf(client, {
      contractId: 'stock-reissuance-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stockRepurchaseCase: StockCorporateActionReaderCase = {
  entityType: 'stockRepurchase',
  contractId: 'stock-repurchase-cid',
  requiredScalar: 'security_id',
  validData: stockRepurchaseData,
  expectedEvent: {
    object_type: 'TX_STOCK_REPURCHASE',
    id: 'stock-repurchase-1',
    date: '2026-07-10',
    security_id: 'security-repurchased-1',
    quantity: '12.5',
    price: { amount: '2.25', currency: 'USD' },
    balance_security_id: 'security-balance-1',
    consideration_text: 'Cash repurchase',
    comments: ['shares repurchased'],
  },
  directRead: (data) => damlStockRepurchaseToNative(data as Parameters<typeof damlStockRepurchaseToNative>[0]),
  invoke: async (client, readAs) =>
    getStockRepurchaseAsOcf(client, {
      contractId: 'stock-repurchase-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stockCorporateActionCases = [
  conversionRatioAdjustmentCase,
  stockClassSplitCase,
  stockConsolidationCase,
  stockReissuanceCase,
  stockRepurchaseCase,
] as const;

function createMockClient(
  testCase: StockCorporateActionReaderCase,
  data: unknown,
  options: {
    readonly createArgument?: unknown;
    /** Null deliberately omits ledger template identity. */
    readonly templateId?: string | null;
  } = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : { context: canonicalContext, [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
  const templateId =
    options.templateId === undefined ? ENTITY_TEMPLATE_ID_MAP[testCase.entityType] : options.templateId;
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        ...(templateId !== null ? { templateId } : {}),
        createArgument,
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: StockCorporateActionReaderCase, field: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  const parseError = error as OcpParseError;
  expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
  expect(parseError.context?.entityType).toBe(testCase.entityType);
  expect(typeof parseError.context?.decoderPath).toBe('string');
  expect(JSON.stringify(parseError.context)).toContain(field);
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

async function expectDecoderRejection(
  testCase: StockCorporateActionReaderCase,
  data: unknown,
  field: string
): Promise<void> {
  const { client } = createMockClient(testCase, data);
  try {
    await testCase.invoke(client);
    throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${field}`);
  } catch (error: unknown) {
    expectDecoderFailure(error, testCase, field);
  }
}

function setPath(data: Record<string, unknown>, path: readonly string[], value: unknown): Record<string, unknown> {
  const finalKey = path[path.length - 1];
  if (!finalKey) throw new Error('Mutation path must not be empty');
  let target = data;
  for (const key of path.slice(0, -1)) {
    const nested = target[key];
    if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) {
      throw new Error(`Fixture path ${path.join('.')} is not an object`);
    }
    target = nested as Record<string, unknown>;
  }
  target[finalKey] = value;
  return data;
}

function deletePath(data: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  const finalKey = path[path.length - 1];
  if (!finalKey) throw new Error('Deletion path must not be empty');
  let target = data;
  for (const key of path.slice(0, -1)) {
    const nested = target[key];
    if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) {
      throw new Error(`Fixture path ${path.join('.')} is not an object`);
    }
    target = nested as Record<string, unknown>;
  }
  delete target[finalKey];
  return data;
}

function getPath(data: unknown, path: readonly string[]): unknown {
  let value = data;
  for (const key of path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

describe('decoder-backed stock corporate-action readers', () => {
  it.each(stockCorporateActionCases)(
    '$entityType returns the same exact event through direct and dispatcher conversion',
    (testCase) => {
      const data = testCase.validData();
      expect(testCase.directRead(data)).toEqual(testCase.expectedEvent);
      expect(convertToOcf(testCase.entityType, data as never)).toEqual(testCase.expectedEvent);
    }
  );

  it.each(stockCorporateActionCases)(
    '$entityType returns its exact canonical event and forwards readAs',
    async (testCase) => {
      const { client, getEventsByContractId } = createMockClient(testCase, testCase.validData());

      await expect(testCase.invoke(client, ['issuer::reader'])).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: testCase.contractId,
        readAs: ['issuer::reader'],
      });
    }
  );

  it.each(stockCorporateActionCases)(
    '$entityType rejects fields outside its exact canonical wrapper',
    async (testCase) => {
      const canonicalData = testCase.validData();
      const { client } = createMockClient(testCase, canonicalData, {
        createArgument: {
          context: canonicalContext,
          ...canonicalData,
          id: 'wrong-top-level-id',
          [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: canonicalData,
        },
      });

      await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpParseError);
    }
  );

  it.each(stockCorporateActionCases)('$entityType rejects malformed transaction dates', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), date: 17 }, 'date');
  });

  it.each(stockCorporateActionCases)('$entityType rejects missing transaction dates', async (testCase) => {
    const data = testCase.validData();
    delete data.date;
    await expectDecoderRejection(testCase, data, 'date');
  });

  it.each(stockCorporateActionCases)('$entityType rejects a missing transaction id', async (testCase) => {
    const data = testCase.validData();
    delete data.id;
    await expectDecoderRejection(testCase, data, 'id');
  });

  it.each(stockCorporateActionCases)('$entityType rejects a malformed transaction id', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), id: 17 }, 'id');
  });

  it.each(stockCorporateActionCases)('$entityType rejects semantically invalid transaction dates', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    expect((error as OcpValidationError).code).toBe(OcpErrorCodes.INVALID_FORMAT);
  });

  it.each(stockCorporateActionCases)('$entityType rejects malformed comments', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), comments: ['valid', 17] }, 'comments');
  });

  it.each(stockCorporateActionCases)('$entityType rejects a missing required comments list', async (testCase) => {
    const data = testCase.validData();
    delete data.comments;
    await expectDecoderRejection(testCase, data, 'comments');
  });

  it.each(stockCorporateActionCases)('$entityType omits empty comments canonically', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: [] });
    const result = await testCase.invoke(client);

    expect(result.event.comments).toBeUndefined();
    expect('comments' in result.event).toBe(false);
  });

  it.each(stockCorporateActionCases)('$entityType rejects a missing required scalar', async (testCase) => {
    const data = testCase.validData();
    delete data[testCase.requiredScalar];
    await expectDecoderRejection(testCase, data, testCase.requiredScalar);
  });

  it.each(stockCorporateActionCases)('$entityType rejects a malformed required scalar', async (testCase) => {
    await expectDecoderRejection(
      testCase,
      { ...testCase.validData(), [testCase.requiredScalar]: 17 },
      testCase.requiredScalar
    );
  });

  it.each(stockCorporateActionCases)(
    '$entityType rejects fields discarded by the generated codec',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), unexpected_field: true });

      const error = await captureRejection(testCase.invoke(client));
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(parseError.context).toMatchObject({
        entityType: testCase.entityType,
        decoderPath: `input.${ENTITY_DATA_FIELD_MAP[testCase.entityType]}.unexpected_field`,
        decoderMessage: 'raw field was discarded by the generated codec',
      });
    }
  );

  it.each(stockCorporateActionCases)('$entityType rejects a missing canonical wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: canonicalContext },
    });

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect((error as OcpParseError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
    expect((error as Error).message).toContain(ENTITY_DATA_FIELD_MAP[testCase.entityType]);
  });

  it.each(stockCorporateActionCases)('$entityType rejects whole-createArgument data lookalikes', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: canonicalContext, ...testCase.validData() },
    });

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect((error as OcpParseError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
  });

  it.each(stockCorporateActionCases)('$entityType rejects non-object nested data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect((error as OcpParseError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
  });

  it.each(stockCorporateActionCases)('$entityType rejects a missing ledger template identity', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: null });

    const error = (await captureRejection(testCase.invoke(client))) as OcpParseError;
    expect(error.name).toBe('OcpContractError');
    expect(error.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
    expect(error.classification).toBe('missing_template_id');
    expect(error.context?.expectedTemplateId).toBe(ENTITY_TEMPLATE_ID_MAP[testCase.entityType]);
  });

  it.each(stockCorporateActionCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    const error = (await captureRejection(testCase.invoke(client))) as OcpParseError;
    expect(error.name).toBe('OcpContractError');
    expect(error.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
    expect(error.classification).toBe('module_entity_mismatch');
    expect(error.context).toMatchObject({
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
      actualTemplateId: wrongTemplateId,
    });
  });

  it.each(stockCorporateActionCases)('$entityType rejects an empty transaction id', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), id: '' });

    const error = (await captureRejection(testCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe(`${testCase.entityType}.id`);
  });

  it.each(stockCorporateActionCases)('$entityType rejects an empty required identifier', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      [testCase.requiredScalar]: '',
    });

    const error = (await captureRejection(testCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe(`${testCase.entityType}.${testCase.requiredScalar}`);
  });

  it.each(stockCorporateActionCases)('$entityType rejects an empty comment item', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: [''] });

    const error = (await captureRejection(testCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe(`${testCase.entityType}.comments[0]`);
  });

  it.each(stockCorporateActionCases)('$entityType validates both Canton Party IDs', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: { issuer: 'issuer party', system_operator: canonicalContext.system_operator },
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    const error = (await captureRejection(testCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.fieldPath).toBe(`damlToOcf.${testCase.entityType}.createArgument.context.issuer`);
  });

  it.each(stockCorporateActionCases)(
    '$entityType returns a detached, recursively frozen event and result',
    async (testCase) => {
      const data = testCase.validData();
      const { client } = createMockClient(testCase, data);
      const result = await testCase.invoke(client);

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.event)).toBe(true);
      if (result.event.comments !== undefined) {
        expect(Object.isFrozen(result.event.comments)).toBe(true);
      }
      for (const value of Object.values(result.event)) {
        if (value !== null && typeof value === 'object') expect(Object.isFrozen(value)).toBe(true);
      }

      const rawComments = data.comments as string[];
      rawComments[0] = 'mutated after read';
      expect(result.event.comments?.[0]).toBe(testCase.expectedEvent.comments?.[0]);
    }
  );

  it('bounds hostile direct-reader depth before generated decoding', () => {
    let nested: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 110; depth += 1) nested = { child: nested };
    const data = { ...stockClassSplitData(), hostile: nested };

    expect(() => stockClassSplitCase.directRead(data)).toThrow(OcpParseError);
  });

  it.each(stockCorporateActionCases)(
    '$entityType rejects proxied entity data without invoking traps',
    async (testCase) => {
      let trapCalls = 0;
      const failTrap = (): never => {
        trapCalls += 1;
        throw new Error('entity-data proxy trap must not run');
      };
      const data = new Proxy(testCase.validData(), {
        get: failTrap,
        getOwnPropertyDescriptor: failTrap,
        getPrototypeOf: failTrap,
        has: failTrap,
        ownKeys: failTrap,
      });
      const { client } = createMockClient(testCase, data);

      const error = await captureRejection(testCase.invoke(client));
      expect(error).toBeInstanceOf(OcpParseError);
      expect((error as OcpParseError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(trapCalls).toBe(0);
    }
  );

  it.each(stockCorporateActionCases)(
    '$entityType rejects entity-data accessors without invoking getters',
    async (testCase) => {
      let getterCalls = 0;
      const data = testCase.validData();
      Object.defineProperty(data, 'id', {
        configurable: true,
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error('entity-data getter must not run');
        },
      });
      const { client } = createMockClient(testCase, data);

      const error = await captureRejection(testCase.invoke(client));
      expect(error).toBeInstanceOf(OcpParseError);
      expect((error as OcpParseError).code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(getterCalls).toBe(0);
    }
  );

  it.each(stockCorporateActionCases)('$entityType does not assimilate hostile response thenables', async (testCase) => {
    let thenGetterCalls = 0;
    const response = {
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          createArgument: {
            context: canonicalContext,
            [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
          },
        },
      },
    };
    Object.defineProperty(response, 'then', {
      configurable: true,
      enumerable: true,
      get() {
        thenGetterCalls += 1;
        throw new Error('response then getter must not run');
      },
    });
    const client = {
      getEventsByContractId: jest.fn(() => response),
    } as unknown as LedgerJsonApiClient;

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect((error as OcpParseError).code).toBe(OcpErrorCodes.INVALID_RESPONSE);
    expect(thenGetterCalls).toBe(0);
  });
});

describe('numeric and nested stock corporate-action fields', () => {
  const numericFields = [
    {
      label: 'conversion price amount',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'conversion_price', 'amount'],
    },
    {
      label: 'conversion ratio numerator',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'ratio', 'numerator'],
    },
    {
      label: 'conversion ratio denominator',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'ratio', 'denominator'],
    },
    { label: 'split numerator', testCase: stockClassSplitCase, path: ['split_ratio', 'numerator'] },
    { label: 'split denominator', testCase: stockClassSplitCase, path: ['split_ratio', 'denominator'] },
    { label: 'repurchase quantity', testCase: stockRepurchaseCase, path: ['quantity'] },
    { label: 'repurchase price amount', testCase: stockRepurchaseCase, path: ['price', 'amount'] },
  ] as const;

  it.each(numericFields)('rejects a numeric primitive for $label', async ({ testCase, path }) => {
    await expectDecoderRejection(testCase, setPath(testCase.validData(), path, 17), path[path.length - 1] ?? 'numeric');
  });

  it.each(numericFields)('accepts generated exponent syntax for $label', async ({ testCase, path }) => {
    const { client } = createMockClient(testCase, setPath(testCase.validData(), path, '1e3'));

    const result = await testCase.invoke(client);
    expect(getPath(result.event, path)).toBe('1000');
  });

  it.each(numericFields)('rejects an invalid numeric string for $label', async ({ testCase, path }) => {
    const { client } = createMockClient(testCase, setPath(testCase.validData(), path, 'not-a-number'));

    const error = await captureRejection(testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    const validationError = error as OcpValidationError;
    expect(validationError.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(validationError.fieldPath).toBe(`${testCase.entityType}.${path.join('.')}`);
  });

  const requiredNestedFields = [
    {
      label: 'complete conversion mechanism',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism'],
    },
    {
      label: 'conversion price',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'conversion_price'],
    },
    {
      label: 'conversion price currency',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'conversion_price', 'currency'],
    },
    {
      label: 'conversion ratio',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'ratio'],
    },
    {
      label: 'conversion ratio denominator',
      testCase: conversionRatioAdjustmentCase,
      path: ['new_ratio_conversion_mechanism', 'ratio', 'denominator'],
    },
    { label: 'split ratio', testCase: stockClassSplitCase, path: ['split_ratio'] },
    { label: 'split ratio numerator', testCase: stockClassSplitCase, path: ['split_ratio', 'numerator'] },
    { label: 'repurchase quantity', testCase: stockRepurchaseCase, path: ['quantity'] },
    { label: 'repurchase price', testCase: stockRepurchaseCase, path: ['price'] },
    { label: 'repurchase price currency', testCase: stockRepurchaseCase, path: ['price', 'currency'] },
  ] as const;

  it.each(requiredNestedFields)('rejects a missing $label', async ({ testCase, path }) => {
    await expectDecoderRejection(testCase, deletePath(testCase.validData(), path), path[path.length - 1] ?? 'nested');
  });

  it.each([
    {
      label: 'consolidation security IDs',
      testCase: stockConsolidationCase,
      field: 'security_ids',
    },
    {
      label: 'reissuance resulting security IDs',
      testCase: stockReissuanceCase,
      field: 'resulting_security_ids',
    },
  ] as const)('rejects a missing required $label list', async ({ testCase, field }) => {
    const data = testCase.validData();
    delete data[field];
    await expectDecoderRejection(testCase, data, field);
  });

  it.each([
    {
      label: 'consolidation security IDs',
      testCase: stockConsolidationCase,
      field: 'security_ids',
    },
    {
      label: 'reissuance resulting security IDs',
      testCase: stockReissuanceCase,
      field: 'resulting_security_ids',
    },
  ] as const)('rejects malformed nested values in the $label list', async ({ testCase, field }) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), [field]: ['valid-id', 17] }, field);
  });
});

describe('conversion-ratio rounding and shared-wrapper isolation', () => {
  it.each([
    ['OcfRoundingNormal', 'NORMAL'],
    ['OcfRoundingCeiling', 'CEILING'],
    ['OcfRoundingFloor', 'FLOOR'],
  ] as const)('maps %s to %s', async (damlRoundingType, nativeRoundingType) => {
    const data = setPath(
      conversionRatioAdjustmentData(),
      ['new_ratio_conversion_mechanism', 'rounding_type'],
      damlRoundingType
    );
    const { client } = createMockClient(conversionRatioAdjustmentCase, data);

    const result = await conversionRatioAdjustmentCase.invoke(client);
    if (result.event.object_type !== 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT') {
      throw new Error('Expected a conversion-ratio adjustment event');
    }
    expect(result.event.new_ratio_conversion_mechanism.rounding_type).toBe(nativeRoundingType);
  });

  it('rejects an unsupported generated rounding variant', async () => {
    const data = setPath(
      conversionRatioAdjustmentData(),
      ['new_ratio_conversion_mechanism', 'rounding_type'],
      'OcfRoundingBankers'
    );

    await expectDecoderRejection(conversionRatioAdjustmentCase, data, 'rounding_type');
  });

  it('does not confuse another adjustment family sharing adjustment_data', async () => {
    const authorizedSharesData = stockClassAuthorizedSharesAdjustmentDataToDaml({
      object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'authorized-shares-adjustment-1',
      date: '2026-07-10',
      stock_class_id: 'preferred-stock-class-1',
      new_shares_authorized: '1000000',
    });
    const { client } = createMockClient(conversionRatioAdjustmentCase, authorizedSharesData, {
      templateId: ENTITY_TEMPLATE_ID_MAP.stockClassAuthorizedSharesAdjustment,
    });

    const error = (await captureRejection(conversionRatioAdjustmentCase.invoke(client))) as OcpParseError;
    expect(error.name).toBe('OcpContractError');
    expect(error.classification).toBe('module_entity_mismatch');
    expect(error.context).toMatchObject({
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassConversionRatioAdjustment,
      actualTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassAuthorizedSharesAdjustment,
    });
  });

  it('rejects another adjustment family even under the expected template identity', async () => {
    const authorizedSharesData = stockClassAuthorizedSharesAdjustmentDataToDaml({
      object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'authorized-shares-adjustment-1',
      date: '2026-07-10',
      stock_class_id: 'preferred-stock-class-1',
      new_shares_authorized: '1000000',
    });

    await expectDecoderRejection(conversionRatioAdjustmentCase, authorizedSharesData, 'new_ratio_conversion_mechanism');
  });
});

describe('optional stock corporate-action fields', () => {
  const optionalFields = [
    { testCase: stockConsolidationCase, field: 'reason_text' },
    { testCase: stockReissuanceCase, field: 'reason_text' },
    { testCase: stockReissuanceCase, field: 'split_transaction_id' },
    { testCase: stockRepurchaseCase, field: 'balance_security_id' },
    { testCase: stockRepurchaseCase, field: 'consideration_text' },
  ] as const;

  it.each(optionalFields)(
    '$testCase.entityType accepts omitted $field through generated null defaults',
    async ({ testCase, field }) => {
      const data = testCase.validData();
      delete data[field];
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      const event = result.event as unknown as Record<string, unknown>;
      expect(event[field]).toBeUndefined();
      expect(field in event).toBe(false);
    }
  );

  it.each(optionalFields)('$testCase.entityType omits null $field canonically', async ({ testCase, field }) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: null });

    const result = await testCase.invoke(client);
    const event = result.event as unknown as Record<string, unknown>;
    expect(event[field]).toBeUndefined();
    expect(field in event).toBe(false);
  });

  it.each(optionalFields)('$testCase.entityType rejects a present empty Text $field', async ({ testCase, field }) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: '' });

    const error = (await captureRejection(testCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe(`${testCase.entityType}.${field}`);
  });

  it.each(optionalFields)(
    '$testCase.entityType rejects malformed optional $field losslessly',
    async ({ testCase, field }) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        [field]: { malformed: true },
      });

      const error = await captureRejection(testCase.invoke(client));
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(parseError.context).toMatchObject({
        entityType: testCase.entityType,
        decoderPath: `input.${ENTITY_DATA_FIELD_MAP[testCase.entityType]}.${field}`,
        decoderMessage: 'raw object was decoded and encoded as null',
      });
    }
  );
});

describe('stock consolidation, reissuance, and repurchase invariants', () => {
  it('rejects a consolidation with no source securities', async () => {
    const { client } = createMockClient(stockConsolidationCase, {
      ...stockConsolidationData(),
      security_ids: [],
    });

    const error = await captureRejection(stockConsolidationCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    const validationError = error as OcpValidationError;
    expect(validationError.code).toBe(OcpErrorCodes.OUT_OF_RANGE);
    expect(validationError.fieldPath).toBe('stockConsolidation.security_ids');
  });

  it('rejects duplicate consolidation source securities', async () => {
    const { client } = createMockClient(stockConsolidationCase, {
      ...stockConsolidationData(),
      security_ids: ['security-old-1', 'security-old-1'],
    });

    const error = await captureRejection(stockConsolidationCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    const validationError = error as OcpValidationError;
    expect(validationError.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(validationError.fieldPath).toBe('stockConsolidation.security_ids[1]');
  });

  it('rejects a reissuance with no resulting securities', async () => {
    const { client } = createMockClient(stockReissuanceCase, {
      ...stockReissuanceData(),
      resulting_security_ids: [],
    });

    const error = (await captureRejection(stockReissuanceCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.OUT_OF_RANGE);
    expect(error.fieldPath).toBe('stockReissuance.resulting_security_ids');
  });

  it('rejects a consolidation whose source security is an empty Text value', async () => {
    const { client } = createMockClient(stockConsolidationCase, {
      ...stockConsolidationData(),
      security_ids: [''],
      resulting_security_id: '',
    });

    const error = (await captureRejection(stockConsolidationCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe('stockConsolidation.security_ids[0]');
  });

  it('rejects duplicate empty consolidation source securities at the duplicate index', async () => {
    const { client } = createMockClient(stockConsolidationCase, {
      ...stockConsolidationData(),
      security_ids: ['', ''],
    });

    const error = await captureRejection(stockConsolidationCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    const validationError = error as OcpValidationError;
    expect(validationError.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(validationError.fieldPath).toBe('stockConsolidation.security_ids[0]');
  });

  it('rejects duplicate reissuance result security IDs', async () => {
    const { client } = createMockClient(stockReissuanceCase, {
      ...stockReissuanceData(),
      resulting_security_ids: ['duplicate', 'duplicate'],
    });

    const error = (await captureRejection(stockReissuanceCase.invoke(client))) as OcpValidationError;
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.code).toBe(OcpErrorCodes.INVALID_FORMAT);
    expect(error.fieldPath).toBe('stockReissuance.resulting_security_ids[1]');
  });

  it('normalizes both repurchase quantity and price without conflating them', async () => {
    const { client } = createMockClient(stockRepurchaseCase, {
      ...stockRepurchaseData(),
      quantity: '125.0000000000',
      price: { amount: '7.5000000000', currency: 'EUR' },
    });

    const result = await stockRepurchaseCase.invoke(client);
    expect(result.event).toMatchObject({
      object_type: 'TX_STOCK_REPURCHASE',
      quantity: '125',
      price: { amount: '7.5', currency: 'EUR' },
    });
  });
});
