/** Exact ledger and conversion contracts shared by all four OCF cancellation families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertibleCancellationDataToDaml } from '../../src/functions/OpenCapTable/convertibleCancellation/createConvertibleCancellation';
import { getConvertibleCancellationAsOcf } from '../../src/functions/OpenCapTable/convertibleCancellation/getConvertibleCancellationAsOcf';
import { equityCompensationCancellationDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationCancellation/createEquityCompensationCancellation';
import { getEquityCompensationCancellationAsOcf } from '../../src/functions/OpenCapTable/equityCompensationCancellation/getEquityCompensationCancellationAsOcf';
import { stockCancellationDataToDaml } from '../../src/functions/OpenCapTable/stockCancellation/createStockCancellation';
import { getStockCancellationAsOcf } from '../../src/functions/OpenCapTable/stockCancellation/getStockCancellationAsOcf';
import { warrantCancellationDataToDaml } from '../../src/functions/OpenCapTable/warrantCancellation/createWarrantCancellation';
import { getWarrantCancellationAsOcf } from '../../src/functions/OpenCapTable/warrantCancellation/getWarrantCancellationAsOcf';
import type {
  PkgConvertibleCancellationOcfData,
  PkgEquityCompensationCancellationOcfData,
  PkgStockCancellationOcfData,
  PkgWarrantCancellationOcfData,
} from '../../src/types/daml';
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
  /** Literal ledger fixture: deliberately independent from the SDK writer under test. */
  readonly literalData: () => Record<string, unknown>;
  readonly expectedEvent: CancellationEvent;
  readonly writerData: () => unknown;
  readonly write: (event: unknown) => unknown;
  readonly encodeGeneratedWrapper: (data: Record<string, unknown>) => unknown;
  readonly invoke: (
    client: LedgerJsonApiClient
  ) => Promise<{ readonly event: CancellationEvent; readonly contractId: string }>;
}

const cancellationReaderCases: readonly CancellationReaderCase[] = [
  {
    entityType: 'stockCancellation',
    contractId: 'stock-cancellation-cid',
    numericField: 'quantity',
    literalData: () => ({
      id: 'stock-cancellation-1',
      date: '2026-07-10T00:00:00.000Z',
      security_id: 'stock-security-1',
      quantity: '12.5000000000',
      reason_text: 'Cancelled',
      balance_security_id: null,
      comments: ['cancelled'],
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
    writerData: () =>
      stockCancellationDataToDaml({
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'stock-cancellation-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.5000000000',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    write: (event) => stockCancellationDataToDaml(event as OcfStockCancellation),
    encodeGeneratedWrapper: (data) =>
      Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.encode({
        context: VALID_CONTEXT,
        cancellation_data: data as PkgStockCancellationOcfData,
      }),
    invoke: async (client) => getStockCancellationAsOcf(client, { contractId: 'stock-cancellation-cid' }),
  },
  {
    entityType: 'convertibleCancellation',
    contractId: 'convertible-cancellation-cid',
    numericField: 'amount',
    literalData: () => ({
      id: 'convertible-cancellation-1',
      date: '2026-07-10T00:00:00.000Z',
      security_id: 'convertible-security-1',
      amount: { amount: '250.0000000000', currency: 'USD' },
      reason_text: 'Cancelled',
      balance_security_id: null,
      comments: ['cancelled'],
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
    writerData: () =>
      convertibleCancellationDataToDaml({
        object_type: 'TX_CONVERTIBLE_CANCELLATION',
        id: 'convertible-cancellation-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        amount: { amount: '250.0000000000', currency: 'USD' },
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    write: (event) => convertibleCancellationDataToDaml(event as OcfConvertibleCancellation),
    encodeGeneratedWrapper: (data) =>
      Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.encode({
        context: VALID_CONTEXT,
        cancellation_data: data as PkgConvertibleCancellationOcfData,
      }),
    invoke: async (client) => getConvertibleCancellationAsOcf(client, { contractId: 'convertible-cancellation-cid' }),
  },
  {
    entityType: 'equityCompensationCancellation',
    contractId: 'equity-compensation-cancellation-cid',
    numericField: 'quantity',
    literalData: () => ({
      id: 'equity-compensation-cancellation-1',
      date: '2026-07-10T00:00:00.000Z',
      security_id: 'equity-compensation-security-1',
      quantity: '8.0000000000',
      reason_text: 'Cancelled',
      balance_security_id: null,
      comments: ['cancelled'],
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
    writerData: () =>
      equityCompensationCancellationDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
        id: 'equity-compensation-cancellation-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        quantity: '8.0000000000',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    write: (event) => equityCompensationCancellationDataToDaml(event as OcfEquityCompensationCancellation),
    encodeGeneratedWrapper: (data) =>
      Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.encode({
        context: VALID_CONTEXT,
        cancellation_data: data as PkgEquityCompensationCancellationOcfData,
      }),
    invoke: async (client) =>
      getEquityCompensationCancellationAsOcf(client, { contractId: 'equity-compensation-cancellation-cid' }),
  },
  {
    entityType: 'warrantCancellation',
    contractId: 'warrant-cancellation-cid',
    numericField: 'quantity',
    literalData: () => ({
      id: 'warrant-cancellation-1',
      date: '2026-07-10T00:00:00.000Z',
      security_id: 'warrant-security-1',
      quantity: '3.0000000000',
      reason_text: 'Cancelled',
      balance_security_id: null,
      comments: ['cancelled'],
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
    writerData: () =>
      warrantCancellationDataToDaml({
        object_type: 'TX_WARRANT_CANCELLATION',
        id: 'warrant-cancellation-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        quantity: '3.0000000000',
        reason_text: 'Cancelled',
        comments: ['cancelled'],
      }),
    write: (event) => warrantCancellationDataToDaml(event as OcfWarrantCancellation),
    encodeGeneratedWrapper: (data) =>
      Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.encode({
        context: VALID_CONTEXT,
        cancellation_data: data as PkgWarrantCancellationOcfData,
      }),
    invoke: async (client) => getWarrantCancellationAsOcf(client, { contractId: 'warrant-cancellation-cid' }),
  },
];

interface MockContractOptions {
  readonly eventContractId?: unknown;
  readonly includeEventContractId?: boolean;
  readonly templateId?: string;
  readonly packageName?: string;
  readonly createArgument?: unknown;
}

function createArgument(testCase: CancellationReaderCase, data: unknown): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
  };
}

function createMockClient(
  testCase: CancellationReaderCase,
  data: unknown,
  options: MockContractOptions = {}
): LedgerJsonApiClient {
  const includeEventContractId = options.includeEventContractId ?? true;
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          ...(includeEventContractId ? { contractId: options.eventContractId ?? testCase.contractId } : {}),
          templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          ...(options.packageName !== undefined ? { packageName: options.packageName } : {}),
          createArgument: options.createArgument ?? createArgument(testCase, data),
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

function createArgumentRoot(testCase: CancellationReaderCase): string {
  return `damlToOcf.${testCase.entityType}.createArgument`;
}

function ledgerCreateArgumentRoot(testCase: CancellationReaderCase): string {
  return `contract ${testCase.contractId}.eventsResponse.created.createdEvent.createArgument`;
}

describe('decoder-backed cancellation readers', () => {
  it.each(cancellationReaderCases)('$entityType maps to its exact generated template', (testCase) => {
    const generatedTemplateId = {
      stockCancellation: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
      convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
      equityCompensationCancellation:
        Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.templateId,
      warrantCancellation: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.templateId,
    }[testCase.entityType];

    expect(ENTITY_TEMPLATE_ID_MAP[testCase.entityType]).toBe(generatedTemplateId);
    expect(ENTITY_DATA_FIELD_MAP[testCase.entityType]).toBe('cancellation_data');
  });

  it.each(cancellationReaderCases)(
    '$entityType returns the exact native result from a literal fixture',
    async (testCase) => {
      await expect(testCase.invoke(createMockClient(testCase, testCase.literalData()))).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType has exact dedicated/generic reader parity', async (testCase) => {
    const dedicatedClient = createMockClient(testCase, testCase.literalData());
    const genericClient = createMockClient(testCase, testCase.literalData());

    await expect(testCase.invoke(dedicatedClient)).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
    await expect(getEntityAsOcf(genericClient, testCase.entityType, testCase.contractId)).resolves.toEqual({
      data: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType accepts its independently generated template wrapper',
    async (testCase) => {
      const generatedWrapper = testCase.encodeGeneratedWrapper(testCase.literalData());
      await expect(
        testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: generatedWrapper }))
      ).resolves.toEqual({ event: testCase.expectedEvent, contractId: testCase.contractId });
    }
  );

  it.each(cancellationReaderCases)(
    '$entityType writer emits exact generated data that round-trips',
    async (testCase) => {
      const writerData = testCase.writerData();
      await expect(testCase.invoke(createMockClient(testCase, writerData))).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType writer preserves canonical falsy values', (testCase) => {
    const written = testCase.write({
      ...testCase.expectedEvent,
      balance_security_id: `${testCase.entityType}-balance`,
      comments: ['', '0', 'false'],
    }) as Record<string, unknown>;

    expect(written.balance_security_id).toBe(`${testCase.entityType}-balance`);
    expect(written.comments).toEqual(['', '0', 'false']);
  });

  it.each(cancellationReaderCases)(
    '$entityType writer rejects explicit undefined and empty balance IDs',
    (testCase) => {
      for (const [value, code] of [
        [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
        ['', OcpErrorCodes.INVALID_FORMAT],
      ] as const) {
        try {
          testCase.write({ ...testCase.expectedEvent, balance_security_id: value });
          throw new Error(`Expected ${testCase.entityType} writer to reject its balance ID`);
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({
            code,
            fieldPath: `${testCase.entityType}.balance_security_id`,
            receivedValue: value,
          });
        }
      }
    }
  );

  it.each(cancellationReaderCases)('$entityType rejects malformed required scalar fields', async (testCase) => {
    for (const [field, value] of [
      ['id', 17],
      ['date', null],
      ['security_id', false],
      ['reason_text', {}],
      ['comments', null],
    ] as const) {
      const client = createMockClient(testCase, { ...testCase.literalData(), [field]: value });
      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_create_argument',
        source: createArgumentRoot(testCase),
        context: { entityType: testCase.entityType, decoderMessage: expect.any(String) },
      });
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects a missing generated context', async (testCase) => {
    const wrapper = { cancellation_data: testCase.literalData() };
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: wrapper }))
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_generated_create_argument',
      source: createArgumentRoot(testCase),
      context: {
        entityType: testCase.entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'context' is required"),
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed generated context fields', async (testCase) => {
    for (const [context, decoderPath] of [
      [{ issuer: 17, system_operator: VALID_CONTEXT.system_operator }, 'input.context.issuer'],
      [{ issuer: VALID_CONTEXT.issuer }, 'input.context'],
    ] as const) {
      const wrapper = { context, cancellation_data: testCase.literalData() };
      await expect(
        testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: wrapper }))
      ).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_create_argument',
        source: createArgumentRoot(testCase),
        context: {
          entityType: testCase.entityType,
          decoderPath,
          decoderMessage: expect.any(String),
        },
      });
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects the wrong generated wrapper family', async (testCase) => {
    const wrapper = { context: VALID_CONTEXT, acceptance_data: testCase.literalData() };
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: wrapper }))
    ).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_generated_create_argument',
      source: createArgumentRoot(testCase),
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'cancellation_data' is required"),
      },
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType losslessly rejects unknown wrapper, context, and payload fields',
    async (testCase) => {
      const data = testCase.literalData();
      const root = createArgumentRoot(testCase);
      const cases = [
        [{ context: VALID_CONTEXT, cancellation_data: data, unexpected_wrapper: true }, `${root}.unexpected_wrapper`],
        [
          { context: { ...VALID_CONTEXT, unexpected_context: true }, cancellation_data: data },
          `${root}.context.unexpected_context`,
        ],
        [
          { context: VALID_CONTEXT, cancellation_data: { ...data, unexpected_payload: true } },
          `${root}.cancellation_data.unexpected_payload`,
        ],
      ] as const;

      for (const [wrapper, expectedSource] of cases) {
        const dedicated = createMockClient(testCase, data, { createArgument: wrapper });
        const generic = createMockClient(testCase, data, { createArgument: wrapper });
        const expected = {
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'lossy_daml_decode',
          source: expectedSource,
          context: {
            entityType: testCase.entityType,
            expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
            fieldPath: expectedSource,
          },
        };
        await expect(testCase.invoke(dedicated)).rejects.toMatchObject(expected);
        await expect(getEntityAsOcf(generic, testCase.entityType, testCase.contractId)).rejects.toMatchObject(expected);
      }
    }
  );

  it('losslessly rejects an unknown nested monetary field at its exact path', async () => {
    const testCase = cancellationReaderCases[1];
    if (testCase === undefined) throw new Error('Missing convertible cancellation case');
    const data = testCase.literalData();
    data.amount = { ...(data.amount as Record<string, unknown>), unexpected_amount: true };
    const source = `${createArgumentRoot(testCase)}.cancellation_data.amount.unexpected_amount`;

    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source,
      context: { fieldPath: source, entityType: 'convertibleCancellation' },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects explicit undefined optionals', async (testCase) => {
    const client = createMockClient(testCase, {
      ...testCase.literalData(),
      balance_security_id: undefined,
    });
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_generated_daml_json',
      source: `${createArgumentRoot(testCase)}.cancellation_data.balance_security_id`,
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType accepts null or omitted balance IDs only as absent',
    async (testCase) => {
      const missing = testCase.literalData();
      delete missing.balance_security_id;
      for (const data of [{ ...testCase.literalData(), balance_security_id: null }, missing]) {
        await expect(testCase.invoke(createMockClient(testCase, data))).resolves.toEqual({
          event: testCase.expectedEvent,
          contractId: testCase.contractId,
        });
      }
    }
  );

  it.each(cancellationReaderCases)(
    '$entityType preserves a non-empty balance ID without truthiness drops',
    async (testCase) => {
      const balanceSecurityId = `${testCase.entityType}-balance`;
      await expect(
        testCase.invoke(
          createMockClient(testCase, { ...testCase.literalData(), balance_security_id: balanceSecurityId })
        )
      ).resolves.toEqual({
        event: { ...testCase.expectedEvent, balance_security_id: balanceSecurityId },
        contractId: testCase.contractId,
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType rejects an empty balance ID as noncanonical', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), balance_security_id: '' }))
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.balance_security_id`,
      receivedValue: '',
    });
  });

  it.each(cancellationReaderCases)('$entityType distinguishes malformed balance ID types', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), balance_security_id: 17 }))
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: `${createArgumentRoot(testCase)}.cancellation_data.balance_security_id`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.cancellation_data.balance_security_id',
      },
    });
  });

  it.each(cancellationReaderCases)('$entityType validates canonical Numeric(10) semantics', async (testCase) => {
    const replaceNumeric = (value: unknown): Record<string, unknown> => {
      const data = testCase.literalData();
      if (testCase.numericField === 'amount') {
        data.amount = { amount: value, currency: 'USD' };
      } else {
        data.quantity = value;
      }
      return data;
    };
    const fieldPath =
      testCase.numericField === 'amount' ? `${testCase.entityType}.amount.amount` : `${testCase.entityType}.quantity`;

    await expect(testCase.invoke(createMockClient(testCase, replaceNumeric(17)))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_generated_create_argument',
    });
    await expect(testCase.invoke(createMockClient(testCase, replaceNumeric('1.12345678901')))).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath,
      receivedValue: '1.12345678901',
    });
    await expect(testCase.invoke(createMockClient(testCase, replaceNumeric('-1')))).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath,
      receivedValue: '-1',
    });
  });

  it('validates canonical convertible monetary currency semantics', async () => {
    const testCase = cancellationReaderCases[1];
    if (testCase === undefined) throw new Error('Missing convertible cancellation case');
    const data = testCase.literalData();
    data.amount = { amount: '1', currency: 'usd' };
    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleCancellation.amount.currency',
      receivedValue: 'usd',
    });
  });

  it.each(cancellationReaderCases)('$entityType validates dates at the exact family path', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), date: 'not-a-date' }))
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.date`,
      receivedValue: 'not-a-date',
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType preserves falsy comments and omits only an empty list',
    async (testCase) => {
      const comments = ['', '0', 'false'];
      await expect(
        testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), comments }))
      ).resolves.toEqual({
        event: { ...testCase.expectedEvent, comments },
        contractId: testCase.contractId,
      });
      const expectedWithoutComments = { ...testCase.expectedEvent };
      delete expectedWithoutComments.comments;
      await expect(
        testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), comments: [] }))
      ).resolves.toEqual({ event: expectedWithoutComments, contractId: testCase.contractId });
    }
  );

  it.each(cancellationReaderCases)('$entityType rejects sparse arrays at the ledger path', async (testCase) => {
    const comments = new Array<unknown>(2);
    comments[1] = 'second';
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.literalData(), comments }))
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.cancellation_data.comments[0]`,
      context: { contractId: testCase.contractId, issueKind: 'sparse_array' },
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects proxies without invoking traps', async (testCase) => {
    const getTrap = jest.fn(() => {
      throw new Error('proxy get trap must not run');
    });
    const ownKeysTrap = jest.fn(() => {
      throw new Error('proxy ownKeys trap must not run');
    });
    const wrapper = new Proxy(createArgument(testCase, testCase.literalData()), {
      get: getTrap,
      ownKeys: ownKeysTrap,
    });

    await expect(
      testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: wrapper }))
    ).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_json',
      source: ledgerCreateArgumentRoot(testCase),
      context: { issueKind: 'proxy' },
    });
    expect(getTrap).not.toHaveBeenCalled();
    expect(ownKeysTrap).not.toHaveBeenCalled();
  });

  it.each(cancellationReaderCases)('$entityType rejects accessors without invoking getters', async (testCase) => {
    const getter = jest.fn(() => {
      throw new Error('cancellation accessor must not run');
    });
    const data = testCase.literalData();
    Object.defineProperty(data, 'id', { configurable: true, enumerable: true, get: getter });

    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.cancellation_data.id`,
      context: { issueKind: 'accessor' },
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(cancellationReaderCases)('$entityType rejects cyclic payloads at a bounded exact path', async (testCase) => {
    const data = testCase.literalData();
    data.self = data;
    await expect(testCase.invoke(createMockClient(testCase, data))).rejects.toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.cancellation_data.self`,
      context: { issueKind: 'cycle' },
    });
  });

  it('bounds hostile cancellation diagnostics and serialized values', async () => {
    const testCase = cancellationReaderCases[0];
    if (testCase === undefined) throw new Error('Missing cancellation case');
    const hostileField = `hostile_${'x'.repeat(10_000)}`;
    const wrapper = {
      context: VALID_CONTEXT,
      cancellation_data: testCase.literalData(),
      [hostileField]: 'y'.repeat(10_000),
    };

    try {
      await testCase.invoke(createMockClient(testCase, testCase.literalData(), { createArgument: wrapper }));
      throw new Error('Expected hostile cancellation input to be rejected');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.classification).toBe('invalid_create_argument_json');
      expect(parseError.context).toMatchObject({ issueKind: 'oversized_property_name' });
      expect(parseError.source?.length).toBeLessThanOrEqual(512);
      expect(parseError.message.length).toBeLessThanOrEqual(512);
      const serialized = JSON.stringify(parseError.toJSON());
      expect(serialized.length).toBeLessThanOrEqual(2_048);
      expect(serialized).not.toContain(hostileField);
    }
  });

  it.each(cancellationReaderCases)('$entityType correlates a present created-event contract ID', async (testCase) => {
    await expect(
      testCase.invoke(
        createMockClient(testCase, testCase.literalData(), { eventContractId: `${testCase.contractId}-wrong` })
      )
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'contract_id_mismatch',
      contractId: testCase.contractId,
      context: {
        expectedContractId: testCase.contractId,
        actualContractId: `${testCase.contractId}-wrong`,
      },
    });
  });

  it.each(cancellationReaderCases)(
    '$entityType rejects a malformed present created-event contract ID',
    async (testCase) => {
      await expect(
        testCase.invoke(createMockClient(testCase, testCase.literalData(), { eventContractId: 17 }))
      ).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.INVALID_RESPONSE,
        classification: 'invalid_created_contract_id',
        source: `contract ${testCase.contractId}.eventsResponse.created.createdEvent.contractId`,
      });
    }
  );

  it.each(cancellationReaderCases)('$entityType accepts an omitted created-event contract ID', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.literalData(), { includeEventContractId: false }))
    ).resolves.toEqual({ event: testCase.expectedEvent, contractId: testCase.contractId });
  });

  it.each(cancellationReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId =
      testCase.entityType === 'stockCancellation'
        ? ENTITY_TEMPLATE_ID_MAP.warrantCancellation
        : ENTITY_TEMPLATE_ID_MAP.stockCancellation;
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.literalData(), { templateId: wrongTemplateId }))
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
      await expect(
        testCase.invoke(
          createMockClient(testCase, testCase.literalData(), {
            templateId: wrongTemplateId,
            packageName: 'OpenCapTable-wrong',
          })
        )
      ).rejects.toMatchObject({
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

  it('uses the public structured error classes for cancellation failures', () => {
    expect(OcpContractError.prototype).toBeInstanceOf(Error);
    expect(OcpParseError.prototype).toBeInstanceOf(Error);
    expect(OcpValidationError.prototype).toBeInstanceOf(Error);
  });
});
