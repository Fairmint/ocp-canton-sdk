/** Direct ledger-reader contracts shared by the four OCF cancellation families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
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

function createMockClient(
  testCase: CancellationReaderCase,
  data: unknown,
  templateId: string = ENTITY_TEMPLATE_ID_MAP[testCase.entityType]
): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId,
          createArgument: { [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data },
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
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed reason_text', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), reason_text: 17 }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed reason_text`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'reason_text');
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects malformed comment elements', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(cancellationReaderCases)('$entityType rejects non-object nested cancellation data', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, []))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(cancellationReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    await expect(
      testCase.invoke(createMockClient(testCase, testCase.validData(), wrongTemplateId))
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
});
