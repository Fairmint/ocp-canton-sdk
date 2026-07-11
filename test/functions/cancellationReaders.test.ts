/** Direct ledger-reader contracts shared by the four OCF cancellation families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertibleCancellationDataToDaml } from '../../src/functions/OpenCapTable/convertibleCancellation/createConvertibleCancellation';
import { getConvertibleCancellationAsOcf } from '../../src/functions/OpenCapTable/convertibleCancellation/getConvertibleCancellationAsOcf';
import { equityCompensationCancellationDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationCancellation/createEquityCompensationCancellation';
import { getEquityCompensationCancellationAsOcf } from '../../src/functions/OpenCapTable/equityCompensationCancellation/getEquityCompensationCancellationAsOcf';
import { stockCancellationDataToDaml } from '../../src/functions/OpenCapTable/stockCancellation/createStockCancellation';
import { getStockCancellationAsOcf } from '../../src/functions/OpenCapTable/stockCancellation/getStockCancellationAsOcf';
import { warrantCancellationDataToDaml } from '../../src/functions/OpenCapTable/warrantCancellation/createWarrantCancellation';
import { getWarrantCancellationAsOcf } from '../../src/functions/OpenCapTable/warrantCancellation/getWarrantCancellationAsOcf';
import type {
  OcfConvertibleCancellation,
  OcfEquityCompensationCancellation,
  OcfStockCancellation,
  OcfWarrantCancellation,
} from '../../src/types/native';

type CancellationEntityType = Extract<
  OcfEntityType,
  'convertibleCancellation' | 'equityCompensationCancellation' | 'stockCancellation' | 'warrantCancellation'
>;
type CancellationEvent =
  | OcfConvertibleCancellation
  | OcfEquityCompensationCancellation
  | OcfStockCancellation
  | OcfWarrantCancellation;

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

interface CancellationReaderCase {
  readonly entityType: CancellationEntityType;
  readonly contractId: string;
  readonly numericField: 'amount' | 'quantity';
  readonly validData: () => Record<string, unknown>;
  readonly malformedNumericData: () => Record<string, unknown>;
  readonly expectedEvent: CancellationEvent;
  readonly invoke: (
    client: LedgerJsonApiClient
  ) => Promise<{ readonly event: CancellationEvent; readonly contractId: string }>;
}

const cancellationReaderCases: readonly CancellationReaderCase[] = [
  {
    entityType: 'stockCancellation',
    contractId: 'stock-cancellation-cid',
    numericField: 'quantity',
    validData: () =>
      stockCancellationDataToDaml({
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'stock-cancellation-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.50',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    malformedNumericData: () => ({
      ...stockCancellationDataToDaml({
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'stock-cancellation-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.50',
        reason_text: 'Cancelled',
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_STOCK_CANCELLATION',
      id: 'stock-cancellation-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5',
      reason_text: 'Cancelled',
      comments: ['cancelled'],
    },
    invoke: async (client) => getStockCancellationAsOcf(client, { contractId: 'stock-cancellation-cid' }),
  },
  {
    entityType: 'convertibleCancellation',
    contractId: 'convertible-cancellation-cid',
    numericField: 'amount',
    validData: () =>
      convertibleCancellationDataToDaml({
        object_type: 'TX_CONVERTIBLE_CANCELLATION',
        id: 'convertible-cancellation-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        amount: { amount: '250.00', currency: 'USD' },
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    malformedNumericData: () => ({
      ...convertibleCancellationDataToDaml({
        object_type: 'TX_CONVERTIBLE_CANCELLATION',
        id: 'convertible-cancellation-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        amount: { amount: '250.00', currency: 'USD' },
        reason_text: 'Cancelled',
      }),
      amount: { amount: 17, currency: 'USD' },
    }),
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_CANCELLATION',
      id: 'convertible-cancellation-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      amount: { amount: '250', currency: 'USD' },
      reason_text: 'Cancelled',
      comments: ['cancelled'],
    },
    invoke: async (client) => getConvertibleCancellationAsOcf(client, { contractId: 'convertible-cancellation-cid' }),
  },
  {
    entityType: 'equityCompensationCancellation',
    contractId: 'equity-compensation-cancellation-cid',
    numericField: 'quantity',
    validData: () =>
      equityCompensationCancellationDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
        id: 'equity-compensation-cancellation-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        quantity: '8.00',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    malformedNumericData: () => ({
      ...equityCompensationCancellationDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
        id: 'equity-compensation-cancellation-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        quantity: '8.00',
        reason_text: 'Cancelled',
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
      id: 'equity-compensation-cancellation-1',
      date: '2026-07-10',
      security_id: 'equity-compensation-security-1',
      quantity: '8',
      reason_text: 'Cancelled',
      comments: ['cancelled'],
    },
    invoke: async (client) =>
      getEquityCompensationCancellationAsOcf(client, { contractId: 'equity-compensation-cancellation-cid' }),
  },
  {
    entityType: 'warrantCancellation',
    contractId: 'warrant-cancellation-cid',
    numericField: 'quantity',
    validData: () =>
      warrantCancellationDataToDaml({
        object_type: 'TX_WARRANT_CANCELLATION',
        id: 'warrant-cancellation-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        quantity: '3.00',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    malformedNumericData: () => ({
      ...warrantCancellationDataToDaml({
        object_type: 'TX_WARRANT_CANCELLATION',
        id: 'warrant-cancellation-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        quantity: '3.00',
        reason_text: 'Cancelled',
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_WARRANT_CANCELLATION',
      id: 'warrant-cancellation-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      quantity: '3',
      reason_text: 'Cancelled',
      comments: ['cancelled'],
    },
    invoke: async (client) => getWarrantCancellationAsOcf(client, { contractId: 'warrant-cancellation-cid' }),
  },
];

interface MockContractOptions {
  readonly templateId?: string;
  readonly packageName?: string;
  readonly createArgument?: Record<string, unknown>;
}

function createMockClient(
  testCase: CancellationReaderCase,
  data: unknown,
  options: MockContractOptions = {}
): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          ...(options.packageName !== undefined ? { packageName: options.packageName } : {}),
          createArgument: options.createArgument ?? {
            context: VALID_CONTEXT,
            [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

function expectDecoderFailure(error: unknown, testCase: CancellationReaderCase, field: string): void {
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

describe('decoder-backed cancellation readers', () => {
  it.each(cancellationReaderCases)('$entityType returns the exact canonical event shape', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, testCase.validData()))).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed $numericField', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, testCase.malformedNumericData()));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${testCase.numericField}`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, testCase.numericField);
      expect(error).toMatchObject({
        context: {
          decoderPath:
            testCase.numericField === 'amount'
              ? 'input.cancellation_data.amount.amount'
              : 'input.cancellation_data.quantity',
        },
      });
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed required scalar fields', async (testCase) => {
    for (const [field, malformedData, decoderPath] of [
      ['id', { ...testCase.validData(), id: 17 }, 'input.cancellation_data.id'],
      ['date', { ...testCase.validData(), date: null }, 'input.cancellation_data.date'],
      [
        'security_id',
        Object.fromEntries(Object.entries(testCase.validData()).filter(([key]) => key !== 'security_id')),
        'input.cancellation_data',
      ],
      ['reason_text', { ...testCase.validData(), reason_text: null }, 'input.cancellation_data.reason_text'],
      ['comments', { ...testCase.validData(), comments: null }, 'input.cancellation_data.comments'],
    ] as const) {
      try {
        await testCase.invoke(createMockClient(testCase, malformedData));
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${field}`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, field);
        expect(error).toMatchObject({ context: { decoderPath } });
      }
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed reason_text', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), reason_text: 17 }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed reason_text`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'reason_text');
      expect(error).toMatchObject({ context: { decoderPath: 'input.cancellation_data.reason_text' } });
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed comment elements', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] }))
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.cancellation_data.comments[1]',
        decoderMessage: 'expected a string, got a number',
      },
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType rejects a createArgument missing generated context',
    async (testCase) => {
      const client = createMockClient(testCase, testCase.validData(), {
        createArgument: {
          [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
        },
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `damlCancellationCreateArgument.${testCase.entityType}`,
        context: {
          entityType: testCase.entityType,
          expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          decoderPath: 'input',
          decoderMessage: expect.stringContaining("key 'context' is required"),
        },
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType rejects an inherited generated wrapper', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: Object.create({
        context: VALID_CONTEXT,
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      }),
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'context' is required as an own property"),
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed generated context fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: { issuer: VALID_CONTEXT.issuer, system_operator: 17 },
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context.system_operator',
        decoderMessage: 'expected a string, got a number',
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects inherited generated context fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: Object.create(VALID_CONTEXT),
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context',
        decoderMessage: expect.stringContaining("key 'issuer' is required as an own property"),
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects inherited required payload fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: VALID_CONTEXT,
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: Object.create(testCase.validData()),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.cancellation_data',
        decoderMessage: expect.stringContaining("key 'id' is required as an own property"),
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects a wrong generated wrapper variant', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: VALID_CONTEXT,
        acceptance_data: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'cancellation_data' is required"),
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects a numeric balance_security_id', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: 17 }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed balance_security_id`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'balance_security_id');
      expect(error).toMatchObject({
        context: {
          decoderPath: 'input.cancellation_data.balance_security_id',
          fieldPath: `${testCase.entityType}.balance_security_id`,
          expectedType: 'string | null | undefined',
          receivedType: 'number',
        },
      });
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects an object balance_security_id', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: {} }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed balance_security_id`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'balance_security_id');
      expect(error).toMatchObject({
        context: {
          decoderPath: 'input.cancellation_data.balance_security_id',
          fieldPath: `${testCase.entityType}.balance_security_id`,
          expectedType: 'string | null | undefined',
          receivedType: 'object',
        },
      });
    }
  });

  it.each(cancellationReaderCases)('$entityType accepts a null balance_security_id as absent', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: null }))
    ).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType accepts an undefined balance_security_id as absent',
    async (testCase) => {
      await expect(
        testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: undefined }))
      ).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType preserves a valid balance_security_id', async (testCase) => {
    const balanceSecurityId = `${testCase.entityType}-balance-security-1`;

    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: balanceSecurityId }))
    ).resolves.toEqual({
      event: { ...testCase.expectedEvent, balance_security_id: balanceSecurityId },
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)('$entityType accepts a missing balance_security_id as absent', async (testCase) => {
    const data = Object.fromEntries(
      Object.entries(testCase.validData()).filter(([field]) => field !== 'balance_security_id')
    );

    await expect(testCase.invoke(createMockClient(testCase, data))).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects an inherited balance_security_id', async (testCase) => {
    const data = testCase.validData();
    delete data.balance_security_id;
    Object.setPrototypeOf(data, { balance_security_id: 'inherited-balance-id' });

    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.cancellation_data.balance_security_id',
        decoderMessage: "optional key 'balance_security_id' is inherited rather than an own property",
      },
    });
  });

  it('convertibleCancellation rejects inherited monetary members', async () => {
    const testCase = cancellationReaderCases.find(({ entityType }) => entityType === 'convertibleCancellation');
    if (testCase === undefined) throw new Error('Missing convertible cancellation reader case');
    const data = testCase.validData();
    const { amount } = data;
    if (amount === null || typeof amount !== 'object' || Array.isArray(amount)) {
      throw new Error('Convertible cancellation fixture amount must be an object');
    }
    data.amount = Object.create(amount);

    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'damlCancellationCreateArgument.convertibleCancellation',
      context: {
        entityType: 'convertibleCancellation',
        decoderPath: 'input.cancellation_data.amount',
        decoderMessage: expect.stringContaining("key 'amount' is required as an own property"),
      },
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType rejects a malformed lexical date with its exact field path',
    async (testCase) => {
      const client = createMockClient(testCase, {
        ...testCase.validData(),
        date: 'not-a-date',
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.date`,
        receivedValue: 'not-a-date',
      });
      await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    }
  );

  it.each(cancellationReaderCases)('$entityType omits only the canonical empty comments list', async (testCase) => {
    const client = createMockClient(testCase, {
      ...testCase.validData(),
      comments: [],
    });
    const expectedEvent = { ...testCase.expectedEvent };
    delete expectedEvent.comments;

    await expect(testCase.invoke(client)).resolves.toEqual({
      event: expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects sparse comments without dropping indexes', async (testCase) => {
    const comments = new Array<unknown>(2);
    comments[1] = 'second comment';
    const client = createMockClient(testCase, {
      ...testCase.validData(),
      comments,
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlCancellationCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.cancellation_data.comments[0]',
        decoderMessage: 'list element is missing or inherited rather than an own property',
      },
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType rejects comments inherited through an array prototype',
    async (testCase) => {
      class InheritedComments extends Array<unknown> {}
      Object.defineProperty(InheritedComments.prototype, 0, {
        configurable: true,
        value: 'inherited comment',
      });
      const comments = new InheritedComments(1);
      const client = createMockClient(testCase, {
        ...testCase.validData(),
        comments,
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `damlCancellationCreateArgument.${testCase.entityType}`,
        context: {
          entityType: testCase.entityType,
          decoderPath: 'input.cancellation_data.comments[0]',
          decoderMessage: 'list element is missing or inherited rather than an own property',
        },
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType rejects non-object nested cancellation data', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, []))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId =
      testCase.entityType === 'stockCancellation'
        ? ENTITY_TEMPLATE_ID_MAP.warrantCancellation
        : ENTITY_TEMPLATE_ID_MAP.stockCancellation;
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId }))
    ).rejects.toMatchObject({
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

  it.each(cancellationReaderCases)(
    '$entityType rejects the right module on the wrong package line',
    async (testCase) => {
      const expectedTemplateId = ENTITY_TEMPLATE_ID_MAP[testCase.entityType];
      const wrongTemplateId = expectedTemplateId.replace(/^#[^:]+/, '#OpenCapTable-wrong');
      const client = createMockClient(testCase, testCase.validData(), {
        templateId: wrongTemplateId,
        packageName: 'OpenCapTable-wrong',
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'package_name_mismatch',
        contractId: testCase.contractId,
        templateId: wrongTemplateId,
        context: {
          expectedTemplateId,
          actualTemplateId: wrongTemplateId,
          actualPackageName: 'OpenCapTable-wrong',
        },
      });
    }
  );
});
