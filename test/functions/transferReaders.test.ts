/** Direct ledger-reader contracts shared by the four OCF transfer families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertibleTransferDataToDaml } from '../../src/functions/OpenCapTable/convertibleTransfer/convertibleTransferDataToDaml';
import { getConvertibleTransferAsOcf } from '../../src/functions/OpenCapTable/convertibleTransfer/getConvertibleTransferAsOcf';
import { equityCompensationTransferDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationTransfer/equityCompensationTransferDataToDaml';
import { getEquityCompensationTransferAsOcf } from '../../src/functions/OpenCapTable/equityCompensationTransfer/getEquityCompensationTransferAsOcf';
import { stockTransferDataToDaml } from '../../src/functions/OpenCapTable/stockTransfer/createStockTransfer';
import { getStockTransferAsOcf } from '../../src/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';
import { getWarrantTransferAsOcf } from '../../src/functions/OpenCapTable/warrantTransfer/getWarrantTransferAsOcf';
import { warrantTransferDataToDaml } from '../../src/functions/OpenCapTable/warrantTransfer/warrantTransferDataToDaml';
import type {
  OcfConvertibleTransfer,
  OcfEquityCompensationTransfer,
  OcfStockTransfer,
  OcfWarrantTransfer,
} from '../../src/types/native';

type TransferEntityType = Extract<
  OcfEntityType,
  'convertibleTransfer' | 'equityCompensationTransfer' | 'stockTransfer' | 'warrantTransfer'
>;
type TransferEvent = OcfConvertibleTransfer | OcfEquityCompensationTransfer | OcfStockTransfer | OcfWarrantTransfer;

interface TransferReaderCase {
  readonly entityType: TransferEntityType;
  readonly contractId: string;
  readonly numericField: 'amount' | 'quantity';
  readonly validData: () => Record<string, unknown>;
  readonly malformedNumericData: () => Record<string, unknown>;
  readonly expectedEvent: TransferEvent;
  readonly invoke: (
    client: LedgerJsonApiClient
  ) => Promise<{ readonly event: TransferEvent; readonly contractId: string }>;
}

const transferReaderCases: readonly TransferReaderCase[] = [
  {
    entityType: 'stockTransfer',
    contractId: 'stock-transfer-cid',
    numericField: 'quantity',
    validData: () =>
      stockTransferDataToDaml({
        object_type: 'TX_STOCK_TRANSFER',
        id: 'stock-transfer-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.50',
        resulting_security_ids: ['stock-result-1'],
        consideration_text: 'Consideration',
        comments: ['transferred'],
      }),
    malformedNumericData: () => ({
      ...stockTransferDataToDaml({
        object_type: 'TX_STOCK_TRANSFER',
        id: 'stock-transfer-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.50',
        resulting_security_ids: ['stock-result-1'],
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_STOCK_TRANSFER',
      id: 'stock-transfer-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5',
      resulting_security_ids: ['stock-result-1'],
      consideration_text: 'Consideration',
      comments: ['transferred'],
    },
    invoke: async (client) => getStockTransferAsOcf(client, { contractId: 'stock-transfer-cid' }),
  },
  {
    entityType: 'convertibleTransfer',
    contractId: 'convertible-transfer-cid',
    numericField: 'amount',
    validData: () =>
      convertibleTransferDataToDaml({
        object_type: 'TX_CONVERTIBLE_TRANSFER',
        id: 'convertible-transfer-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        amount: { amount: '250.00', currency: 'USD' },
        resulting_security_ids: ['convertible-result-1'],
        consideration_text: 'Consideration',
        comments: ['transferred'],
      }),
    malformedNumericData: () => ({
      ...convertibleTransferDataToDaml({
        object_type: 'TX_CONVERTIBLE_TRANSFER',
        id: 'convertible-transfer-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        amount: { amount: '250.00', currency: 'USD' },
        resulting_security_ids: ['convertible-result-1'],
      }),
      amount: { amount: 17, currency: 'USD' },
    }),
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_TRANSFER',
      id: 'convertible-transfer-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      amount: { amount: '250', currency: 'USD' },
      resulting_security_ids: ['convertible-result-1'],
      consideration_text: 'Consideration',
      comments: ['transferred'],
    },
    invoke: async (client) => getConvertibleTransferAsOcf(client, { contractId: 'convertible-transfer-cid' }),
  },
  {
    entityType: 'equityCompensationTransfer',
    contractId: 'equity-compensation-transfer-cid',
    numericField: 'quantity',
    validData: () =>
      equityCompensationTransferDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
        id: 'equity-compensation-transfer-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        quantity: '8.00',
        resulting_security_ids: ['equity-compensation-result-1'],
        consideration_text: 'Consideration',
        comments: ['transferred'],
      }),
    malformedNumericData: () => ({
      ...equityCompensationTransferDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
        id: 'equity-compensation-transfer-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        quantity: '8.00',
        resulting_security_ids: ['equity-compensation-result-1'],
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_TRANSFER',
      id: 'equity-compensation-transfer-1',
      date: '2026-07-10',
      security_id: 'equity-compensation-security-1',
      quantity: '8',
      resulting_security_ids: ['equity-compensation-result-1'],
      consideration_text: 'Consideration',
      comments: ['transferred'],
    },
    invoke: async (client) =>
      getEquityCompensationTransferAsOcf(client, { contractId: 'equity-compensation-transfer-cid' }),
  },
  {
    entityType: 'warrantTransfer',
    contractId: 'warrant-transfer-cid',
    numericField: 'quantity',
    validData: () =>
      warrantTransferDataToDaml({
        object_type: 'TX_WARRANT_TRANSFER',
        id: 'warrant-transfer-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        quantity: '3.00',
        resulting_security_ids: ['warrant-result-1'],
        consideration_text: 'Consideration',
        comments: ['transferred'],
      }),
    malformedNumericData: () => ({
      ...warrantTransferDataToDaml({
        object_type: 'TX_WARRANT_TRANSFER',
        id: 'warrant-transfer-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        quantity: '3.00',
        resulting_security_ids: ['warrant-result-1'],
      }),
      quantity: 17,
    }),
    expectedEvent: {
      object_type: 'TX_WARRANT_TRANSFER',
      id: 'warrant-transfer-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      quantity: '3',
      resulting_security_ids: ['warrant-result-1'],
      consideration_text: 'Consideration',
      comments: ['transferred'],
    },
    invoke: async (client) => getWarrantTransferAsOcf(client, { contractId: 'warrant-transfer-cid' }),
  },
];

function createMockClient(
  testCase: TransferReaderCase,
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

function expectDecoderFailure(error: unknown, testCase: TransferReaderCase, field: string): void {
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

describe('decoder-backed transfer readers', () => {
  it.each(transferReaderCases)('$entityType returns the exact canonical event shape', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, testCase.validData()))).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(transferReaderCases)('$entityType rejects malformed $numericField', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, testCase.malformedNumericData()));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${testCase.numericField}`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, testCase.numericField);
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed resulting security IDs', async (testCase) => {
    try {
      await testCase.invoke(
        createMockClient(testCase, { ...testCase.validData(), resulting_security_ids: ['valid', 17] })
      );
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed resulting_security_ids`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'resulting_security_ids');
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed consideration_text', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), consideration_text: 17 }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed consideration_text`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'consideration_text');
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed comment elements', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(transferReaderCases)('$entityType preserves the non-empty OCF result invariant', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.validData(), resulting_security_ids: [] }))
    ).rejects.toBeInstanceOf(OcpValidationError);
  });

  it.each(transferReaderCases)('$entityType rejects non-object nested transfer data', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, []))).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(transferReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
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
