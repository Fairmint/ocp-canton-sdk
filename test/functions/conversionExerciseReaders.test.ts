/** Direct generated-decoder contracts for conversion and exercise readers. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { damlConvertibleConversionToNative } from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import { getConvertibleConversionAsOcf } from '../../src/functions/OpenCapTable/convertibleConversion/getConvertibleConversionAsOcf';
import { equityCompensationExerciseDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationExercise/createEquityCompensationExercise';
import {
  damlEquityCompensationExerciseDataToNative,
  getEquityCompensationExerciseAsOcf,
} from '../../src/functions/OpenCapTable/equityCompensationExercise/getEquityCompensationExerciseAsOcf';
import { damlStockConversionToNative } from '../../src/functions/OpenCapTable/stockConversion/damlToOcf';
import { getStockConversionAsOcf } from '../../src/functions/OpenCapTable/stockConversion/getStockConversionAsOcf';
import { stockConversionDataToDaml } from '../../src/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import { damlWarrantExerciseToNative } from '../../src/functions/OpenCapTable/warrantExercise/damlToOcf';
import { getWarrantExerciseAsOcf } from '../../src/functions/OpenCapTable/warrantExercise/getWarrantExerciseAsOcf';
import { warrantExerciseDataToDaml } from '../../src/functions/OpenCapTable/warrantExercise/warrantExerciseDataToDaml';
import type { DeepReadonly } from '../../src/types/common';
import type {
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfStockConversion,
  OcfWarrantExercise,
} from '../../src/types/native';

type ConversionExerciseEntityType = Extract<
  OcfEntityType,
  'convertibleConversion' | 'stockConversion' | 'equityCompensationExercise' | 'warrantExercise'
>;
type ConversionExerciseEvent = DeepReadonly<
  OcfConvertibleConversion | OcfStockConversion | OcfEquityCompensationExercise | OcfWarrantExercise
>;

function convertibleConversionData(): Record<string, unknown> {
  return convertibleConversionDataToDaml({
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: 'convertible-conversion-1',
    date: '2026-07-10',
    reason_text: 'Qualified financing',
    security_id: 'convertible-security-1',
    trigger_id: 'convertible-trigger-1',
    resulting_security_ids: ['stock-security-1'],
    balance_security_id: 'convertible-balance-1',
    quantity_converted: '12.50',
    comments: ['converted'],
  });
}

function stockConversionData(): Record<string, unknown> {
  return stockConversionDataToDaml({
    object_type: 'TX_STOCK_CONVERSION',
    id: 'stock-conversion-1',
    date: '2026-07-10',
    security_id: 'preferred-security-1',
    quantity_converted: '20.50',
    resulting_security_ids: ['common-security-1'],
    balance_security_id: 'preferred-balance-1',
    comments: ['converted'],
  });
}

function equityCompensationExerciseData(): Record<string, unknown> {
  return equityCompensationExerciseDataToDaml({
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: 'equity-compensation-exercise-1',
    date: '2026-07-10',
    security_id: 'option-security-1',
    quantity: '6.25',
    consideration_text: 'Cash exercise',
    resulting_security_ids: ['stock-security-2'],
    comments: ['exercised'],
  });
}

function warrantExerciseData(): Record<string, unknown> {
  return warrantExerciseDataToDaml({
    object_type: 'TX_WARRANT_EXERCISE',
    id: 'warrant-exercise-1',
    date: '2026-07-10',
    security_id: 'warrant-security-1',
    trigger_id: 'warrant-trigger-1',
    resulting_security_ids: ['stock-security-3'],
    consideration_text: 'Cash exercise',
    comments: ['exercised'],
  });
}

interface ConversionExerciseReaderCase {
  readonly entityType: ConversionExerciseEntityType;
  readonly contractId: string;
  readonly numericField: 'quantity_converted' | 'quantity';
  readonly optionalFields: readonly string[];
  readonly validData: () => Record<string, unknown>;
  readonly read: (data: never) => ConversionExerciseEvent;
  readonly expectedEvent: ConversionExerciseEvent;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: ConversionExerciseEvent; readonly contractId: string }>;
}

const readerCases: readonly ConversionExerciseReaderCase[] = [
  {
    entityType: 'convertibleConversion',
    contractId: 'convertible-conversion-cid',
    numericField: 'quantity_converted',
    optionalFields: ['balance_security_id', 'capitalization_definition', 'quantity_converted'],
    validData: convertibleConversionData,
    read: damlConvertibleConversionToNative,
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_CONVERSION',
      id: 'convertible-conversion-1',
      date: '2026-07-10',
      reason_text: 'Qualified financing',
      security_id: 'convertible-security-1',
      trigger_id: 'convertible-trigger-1',
      resulting_security_ids: ['stock-security-1'],
      balance_security_id: 'convertible-balance-1',
      quantity_converted: '12.5',
      comments: ['converted'],
    },
    invoke: async (client, readAs) =>
      getConvertibleConversionAsOcf(client, {
        contractId: 'convertible-conversion-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'stockConversion',
    contractId: 'stock-conversion-cid',
    numericField: 'quantity_converted',
    optionalFields: ['balance_security_id'],
    validData: stockConversionData,
    read: damlStockConversionToNative,
    expectedEvent: {
      object_type: 'TX_STOCK_CONVERSION',
      id: 'stock-conversion-1',
      date: '2026-07-10',
      security_id: 'preferred-security-1',
      quantity_converted: '20.5',
      resulting_security_ids: ['common-security-1'],
      balance_security_id: 'preferred-balance-1',
      comments: ['converted'],
    },
    invoke: async (client, readAs) =>
      getStockConversionAsOcf(client, {
        contractId: 'stock-conversion-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'equityCompensationExercise',
    contractId: 'equity-compensation-exercise-cid',
    numericField: 'quantity',
    optionalFields: ['consideration_text'],
    validData: equityCompensationExerciseData,
    read: damlEquityCompensationExerciseDataToNative,
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
      id: 'equity-compensation-exercise-1',
      date: '2026-07-10',
      security_id: 'option-security-1',
      quantity: '6.25',
      consideration_text: 'Cash exercise',
      resulting_security_ids: ['stock-security-2'],
      comments: ['exercised'],
    },
    invoke: async (client, readAs) =>
      getEquityCompensationExerciseAsOcf(client, {
        contractId: 'equity-compensation-exercise-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'warrantExercise',
    contractId: 'warrant-exercise-cid',
    numericField: 'quantity',
    optionalFields: ['consideration_text', 'quantity'],
    validData: warrantExerciseData,
    read: damlWarrantExerciseToNative,
    expectedEvent: {
      object_type: 'TX_WARRANT_EXERCISE',
      id: 'warrant-exercise-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      trigger_id: 'warrant-trigger-1',
      resulting_security_ids: ['stock-security-3'],
      consideration_text: 'Cash exercise',
      comments: ['exercised'],
    },
    invoke: async (client, readAs) =>
      getWarrantExerciseAsOcf(client, {
        contractId: 'warrant-exercise-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
];

interface MockOptions {
  readonly createArgument?: unknown;
  /** Null deliberately omits ledger template identity. */
  readonly templateId?: string | null;
}

function createMockClient(
  testCase: ConversionExerciseReaderCase,
  data: unknown,
  options: MockOptions = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : {
        context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
      };
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

function expectDecoderFailure(error: unknown, testCase: ConversionExerciseReaderCase, field: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType: testCase.entityType,
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  const parseError = error as OcpParseError;
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(field);
}

async function captureRejection(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

function expectBoundedSdkError(error: unknown): void {
  expect(error).toBeInstanceOf(OcpError);
  let serialized = '';
  expect(() => {
    serialized = JSON.stringify(error);
  }).not.toThrow();
  expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThan(8_192);
}

describe('decoder-backed conversion and exercise readers', () => {
  it.each(readerCases)(
    '$entityType composes direct and generic writers with direct and generic readers',
    (testCase) => {
      const writtenPayloads = [
        testCase.validData(),
        convertToDaml(testCase.entityType, { ...testCase.expectedEvent } as never),
      ];

      for (const payload of writtenPayloads) {
        for (const event of [testCase.read(payload as never), convertToOcf(testCase.entityType, payload as never)]) {
          expect(event).toEqual(testCase.expectedEvent);
          expect(Object.isFrozen(event)).toBe(true);
          expect(Object.isFrozen(event.resulting_security_ids)).toBe(true);
          if (event.comments !== undefined) expect(Object.isFrozen(event.comments)).toBe(true);
        }
      }
    }
  );

  it.each(readerCases)('$entityType returns its exact event and forwards readAs', async (testCase) => {
    const { client, getEventsByContractId } = createMockClient(testCase, testCase.validData());

    await expect(testCase.invoke(client, ['issuer::reader'])).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
    expect(getEventsByContractId).toHaveBeenCalledWith({
      contractId: testCase.contractId,
      readAs: ['issuer::reader'],
    });
  });

  it.each(readerCases)('$entityType rejects malformed numeric primitives', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), [testCase.numericField]: 17 });

    const error = await captureRejection(async () => testCase.invoke(client));
    if (testCase.entityType === 'convertibleConversion') {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'convertibleConversion.quantity_converted',
      });
    } else {
      expectDecoderFailure(error, testCase, testCase.numericField);
    }
  });

  it.each(readerCases)('$entityType rejects malformed date primitives', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: 17 });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject a malformed date`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'date');
    }
  });

  it.each(readerCases)('$entityType preserves semantic date validation', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(testCase.invoke(client)).rejects.toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT });
  });

  it.each(readerCases)('$entityType rejects malformed required scalars', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), security_id: 17 });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject a malformed security_id`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'security_id');
    }
  });

  it.each(readerCases)('$entityType rejects malformed list elements', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      resulting_security_ids: ['valid-security-id', 17],
    });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject malformed resulting_security_ids`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'resulting_security_ids');
    }
  });

  it.each(readerCases)('$entityType rejects malformed comment lists', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(readerCases)('$entityType rejects a missing required comments list', async (testCase) => {
    const data = testCase.validData();
    delete data.comments;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject missing comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(
    readerCases.flatMap((testCase) => testCase.optionalFields.map((optionalField) => ({ testCase, optionalField })))
  )(
    '$testCase.entityType accepts omitted $optionalField through generated null defaults',
    async ({ testCase, optionalField }) => {
      const data = testCase.validData();
      delete data[optionalField];
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      expect(result.event).not.toHaveProperty(optionalField);
      expect(optionalField in result.event).toBe(false);
    }
  );

  it.each(readerCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), unexpected_field: true });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.unexpected_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(readerCases)('$entityType rejects a missing entity-data wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: { issuer: 'issuer::party', system_operator: 'system-operator::party' } },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(readerCases)('$entityType rejects a non-object entity-data wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    const error = await captureRejection(async () => testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
    expect((error as OcpParseError).source).toContain(ENTITY_DATA_FIELD_MAP[testCase.entityType]);
  });

  it.each(readerCases)('$entityType rejects a missing ledger template identity', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: null });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'missing_template_id',
      contractId: testCase.contractId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
      },
    });
  });

  it.each(readerCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
      contractId: testCase.contractId,
      templateId: wrongTemplateId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        actualTemplateId: wrongTemplateId,
      },
    });
  });

  it.each(readerCases)('$entityType rejects proxied entity data without invoking traps', async (testCase) => {
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

    const error = await captureRejection(async () => testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
    expect(trapCalls).toBe(0);
  });

  it.each(readerCases)('$entityType rejects entity-data accessors without invoking getters', async (testCase) => {
    let getterCalls = 0;
    const data = testCase.validData();
    Object.defineProperty(data, 'id', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error('entity-data getter must not run');
      },
    });
    const { client } = createMockClient(testCase, data);

    const error = await captureRejection(async () => testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
    expect(getterCalls).toBe(0);
  });

  it.each(readerCases)('$entityType does not assimilate hostile response thenables', async (testCase) => {
    let thenGetterCalls = 0;
    const response = {
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          createArgument: {
            context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
            [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
          },
        },
      },
    };
    Object.defineProperty(response, 'then', {
      enumerable: true,
      configurable: true,
      get() {
        thenGetterCalls += 1;
        throw new Error('response then getter must not run');
      },
    });
    const client = {
      getEventsByContractId: jest.fn(() => response),
    } as unknown as LedgerJsonApiClient;

    const error = await captureRejection(async () => testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_RESPONSE });
    expect(thenGetterCalls).toBe(0);
  });

  it.each(readerCases)('$entityType keeps hostile scalar diagnostics bounded', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      [testCase.numericField]: '9'.repeat(100_000),
    });

    expectBoundedSdkError(await captureRejection(async () => testCase.invoke(client)));
  });

  it('rejects oversized and deeply nested payloads with bounded diagnostics', async () => {
    const testCase = readerCases[1];
    if (!testCase) throw new Error('Missing stock-conversion reader case');
    const oversizedResults = Array.from({ length: 100_001 }, () => 'security-id');
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 110; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }

    for (const data of [
      { ...testCase.validData(), resulting_security_ids: oversizedResults },
      { ...testCase.validData(), unexpected_deep_value: deep },
    ]) {
      const { client } = createMockClient(testCase, data);
      expectBoundedSdkError(await captureRejection(async () => testCase.invoke(client)));
    }
  });
});

describe('same-wrapper family isolation', () => {
  it.each([
    [0, stockConversionData],
    [1, convertibleConversionData],
    [2, warrantExerciseData],
    [3, equityCompensationExerciseData],
  ] as const)('reader case %i rejects its sibling family payload', async (caseIndex, siblingData) => {
    const testCase = readerCases[caseIndex];
    if (!testCase) throw new Error(`Missing reader case ${caseIndex}`);
    const { client } = createMockClient(testCase, siblingData());

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { entityType: testCase.entityType },
    });
  });
});

describe('preserved conversion and exercise semantic invariants', () => {
  it.each(readerCases.filter((testCase) => testCase.entityType !== 'equityCompensationExercise'))(
    '$entityType rejects an empty resulting_security_ids list',
    async (testCase) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        resulting_security_ids: [],
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: `${testCase.entityType}.resulting_security_ids`,
      });
    }
  );

  it('equityCompensationExercise preserves an empty resulting_security_ids list', async () => {
    const testCase = readerCases[2];
    if (!testCase) throw new Error('Missing equity-compensation reader case');
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      resulting_security_ids: [],
    });

    await expect(testCase.invoke(client)).resolves.toMatchObject({ event: { resulting_security_ids: [] } });
  });

  it.each(readerCases)('$entityType preserves duplicate non-empty result identifiers', async (testCase) => {
    const data = {
      ...testCase.validData(),
      resulting_security_ids: ['duplicate', 'duplicate'],
    };

    const { client } = createMockClient(testCase, data);
    const result = await testCase.invoke(client);
    expect(result.event).toMatchObject({ resulting_security_ids: ['duplicate', 'duplicate'] });
  });

  it.each(readerCases)('$entityType rejects empty required identifiers and list elements', async (testCase) => {
    for (const [field, value, fieldPath] of [
      ['id', '', `${testCase.entityType}.id`],
      ['security_id', '', `${testCase.entityType}.security_id`],
      ['resulting_security_ids', [''], `${testCase.entityType}.resulting_security_ids[0]`],
      ['comments', [''], `${testCase.entityType}.comments[0]`],
    ] as const) {
      const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: value });
      await expect(testCase.invoke(client)).rejects.toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath,
      });
    }
  });

  it.each([
    [0, 'reason_text', 'convertibleConversion.reason_text'],
    [0, 'trigger_id', 'convertibleConversion.trigger_id'],
    [0, 'balance_security_id', 'convertibleConversion.balance_security_id'],
    [1, 'balance_security_id', 'stockConversion.balance_security_id'],
    [2, 'consideration_text', 'equityCompensationExercise.consideration_text'],
    [3, 'trigger_id', 'warrantExercise.trigger_id'],
    [3, 'consideration_text', 'warrantExercise.consideration_text'],
  ] as const)('reader case %i rejects an empty %s', async (caseIndex, field, fieldPath) => {
    const testCase = readerCases[caseIndex];
    if (!testCase) throw new Error(`Missing reader case ${caseIndex}`);
    const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: '' });
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath,
    });
  });

  it.each(readerCases)('$entityType returns a detached deeply frozen snapshot', async (testCase) => {
    const source = testCase.validData();
    const sourceResults = source.resulting_security_ids as string[];
    const sourceComments = source.comments as string[];
    const { client } = createMockClient(testCase, source);
    const result = await testCase.invoke(client);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.event)).toBe(true);
    expect(Object.isFrozen(result.event.resulting_security_ids)).toBe(true);
    expect(Object.isFrozen(result.event.comments)).toBe(true);
    sourceResults[0] = 'mutated-result';
    sourceComments[0] = 'mutated-comment';
    expect(result.event.resulting_security_ids[0]).not.toBe('mutated-result');
    expect(result.event.comments?.[0]).not.toBe('mutated-comment');
  });

  it.each([
    [0, 'quantity_converted', 'convertibleConversion.quantity_converted'],
    [1, 'quantity_converted', 'stockConversion.quantity_converted'],
    [2, 'quantity', 'equityCompensationExercise.quantity'],
    [3, 'quantity', 'warrantExercise.quantity'],
  ] as const)('reader case %i rejects a semantically invalid %s', async (caseIndex, field, fieldPath) => {
    const testCase = readerCases[caseIndex];
    if (!testCase) throw new Error(`Missing reader case ${caseIndex}`);
    const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: 'NaN' });

    const error = await captureRejection(async () => testCase.invoke(client));
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT, fieldPath });
  });

  it.each([
    [0, 'quantity_converted', '0', 'convertibleConversion.quantity_converted'],
    [0, 'quantity_converted', '-1', 'convertibleConversion.quantity_converted'],
    [1, 'quantity_converted', '0', 'stockConversion.quantity_converted'],
    [1, 'quantity_converted', '-1', 'stockConversion.quantity_converted'],
    [3, 'quantity', '0', 'warrantExercise.quantity'],
    [3, 'quantity', '-1', 'warrantExercise.quantity'],
  ] as const)('reader case %i rejects non-positive %s value %s', async (caseIndex, field, value, fieldPath) => {
    const testCase = readerCases[caseIndex];
    if (!testCase) throw new Error(`Missing reader case ${caseIndex}`);
    const { client } = createMockClient(testCase, { ...testCase.validData(), [field]: value });
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath,
    });
  });

  it.each([
    ['0', '0'],
    ['-1.2500000000', '-1.25'],
  ] as const)('equityCompensationExercise permits and canonicalizes quantity %s', async (value, expected) => {
    const testCase = readerCases[2];
    if (!testCase) throw new Error('Missing equity-compensation reader case');
    const { client } = createMockClient(testCase, { ...testCase.validData(), quantity: value });
    await expect(testCase.invoke(client)).resolves.toMatchObject({ event: { quantity: expected } });
  });

  it('validates, detaches, and deeply freezes convertible capitalization identifiers', async () => {
    const testCase = readerCases[0];
    if (!testCase) throw new Error('Missing convertible-conversion reader case');
    const capitalizationDefinition = {
      include_stock_class_ids: ['preferred-class'],
      include_stock_plans_ids: [],
      include_security_ids: ['included-security'],
      exclude_security_ids: ['excluded-security'],
    };
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      capitalization_definition: capitalizationDefinition,
    });
    const result = await testCase.invoke(client);
    if (result.event.object_type !== 'TX_CONVERTIBLE_CONVERSION') {
      throw new Error('Expected a convertible-conversion result');
    }

    const decoded = result.event.capitalization_definition;
    expect(decoded).toEqual(capitalizationDefinition);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded?.include_stock_class_ids)).toBe(true);
    capitalizationDefinition.include_stock_class_ids[0] = 'mutated-class';
    expect(decoded?.include_stock_class_ids[0]).toBe('preferred-class');
  });

  it('rejects an empty nested convertible capitalization identifier', async () => {
    const testCase = readerCases[0];
    if (!testCase) throw new Error('Missing convertible-conversion reader case');
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      capitalization_definition: {
        include_stock_class_ids: [''],
        include_stock_plans_ids: [],
        include_security_ids: [],
        exclude_security_ids: [],
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleConversion.capitalization_definition.include_stock_class_ids[0]',
    });
  });
});
