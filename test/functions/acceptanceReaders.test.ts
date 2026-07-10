/** Direct ledger-reader contracts shared by all four OCF acceptance families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertibleAcceptanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleAcceptance/convertibleAcceptanceDataToDaml';
import { getConvertibleAcceptanceAsOcf } from '../../src/functions/OpenCapTable/convertibleAcceptance/getConvertibleAcceptanceAsOcf';
import { equityCompensationAcceptanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
import { getEquityCompensationAcceptanceAsOcf } from '../../src/functions/OpenCapTable/equityCompensationAcceptance/getEquityCompensationAcceptanceAsOcf';
import { getStockAcceptanceAsOcf } from '../../src/functions/OpenCapTable/stockAcceptance/getStockAcceptanceAsOcf';
import { stockAcceptanceDataToDaml } from '../../src/functions/OpenCapTable/stockAcceptance/stockAcceptanceDataToDaml';
import { getWarrantAcceptanceAsOcf } from '../../src/functions/OpenCapTable/warrantAcceptance/getWarrantAcceptanceAsOcf';
import { warrantAcceptanceDataToDaml } from '../../src/functions/OpenCapTable/warrantAcceptance/warrantAcceptanceDataToDaml';
import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../src/types/native';

type AcceptanceEntityType = Extract<
  OcfEntityType,
  'convertibleAcceptance' | 'equityCompensationAcceptance' | 'stockAcceptance' | 'warrantAcceptance'
>;
type AcceptanceEvent =
  | OcfConvertibleAcceptance
  | OcfEquityCompensationAcceptance
  | OcfStockAcceptance
  | OcfWarrantAcceptance;

interface AcceptanceReaderCase {
  readonly entityType: AcceptanceEntityType;
  readonly contractId: string;
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: AcceptanceEvent;
  readonly invoke: (
    client: LedgerJsonApiClient
  ) => Promise<{ readonly event: AcceptanceEvent; readonly contractId: string }>;
}

const acceptanceReaderCases: readonly AcceptanceReaderCase[] = [
  {
    entityType: 'stockAcceptance',
    contractId: 'stock-acceptance-cid',
    validData: () =>
      stockAcceptanceDataToDaml({
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'stock-acceptance-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        comments: ['accepted'],
      }),
    expectedEvent: {
      object_type: 'TX_STOCK_ACCEPTANCE',
      id: 'stock-acceptance-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      comments: ['accepted'],
    },
    invoke: async (client) => getStockAcceptanceAsOcf(client, { contractId: 'stock-acceptance-cid' }),
  },
  {
    entityType: 'convertibleAcceptance',
    contractId: 'convertible-acceptance-cid',
    validData: () =>
      convertibleAcceptanceDataToDaml({
        object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
        id: 'convertible-acceptance-1',
        date: '2026-07-10',
        security_id: 'convertible-security-1',
        comments: ['accepted'],
      }),
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
      id: 'convertible-acceptance-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      comments: ['accepted'],
    },
    invoke: async (client) => getConvertibleAcceptanceAsOcf(client, { contractId: 'convertible-acceptance-cid' }),
  },
  {
    entityType: 'equityCompensationAcceptance',
    contractId: 'equity-compensation-acceptance-cid',
    validData: () =>
      equityCompensationAcceptanceDataToDaml({
        object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
        id: 'equity-compensation-acceptance-1',
        date: '2026-07-10',
        security_id: 'equity-compensation-security-1',
        comments: ['accepted'],
      }),
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
      id: 'equity-compensation-acceptance-1',
      date: '2026-07-10',
      security_id: 'equity-compensation-security-1',
      comments: ['accepted'],
    },
    invoke: async (client) =>
      getEquityCompensationAcceptanceAsOcf(client, { contractId: 'equity-compensation-acceptance-cid' }),
  },
  {
    entityType: 'warrantAcceptance',
    contractId: 'warrant-acceptance-cid',
    validData: () =>
      warrantAcceptanceDataToDaml({
        object_type: 'TX_WARRANT_ACCEPTANCE',
        id: 'warrant-acceptance-1',
        date: '2026-07-10',
        security_id: 'warrant-security-1',
        comments: ['accepted'],
      }),
    expectedEvent: {
      object_type: 'TX_WARRANT_ACCEPTANCE',
      id: 'warrant-acceptance-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      comments: ['accepted'],
    },
    invoke: async (client) => getWarrantAcceptanceAsOcf(client, { contractId: 'warrant-acceptance-cid' }),
  },
];

function createMockClient(
  testCase: AcceptanceReaderCase,
  data: Record<string, unknown>,
  templateId: string = ENTITY_TEMPLATE_ID_MAP[testCase.entityType]
): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: testCase.contractId,
          templateId,
          createArgument: {
            [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('decoder-backed acceptance readers', () => {
  it.each(acceptanceReaderCases)('$entityType returns the exact canonical event shape', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData());

    await expect(testCase.invoke(client)).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects malformed required fields', async (testCase) => {
    for (const [field, malformedData] of [
      ['id', { ...testCase.validData(), id: 17 }],
      [
        'security_id',
        Object.fromEntries(Object.entries(testCase.validData()).filter(([key]) => key !== 'security_id')),
      ],
    ] as const) {
      const client = createMockClient(testCase, malformedData);

      try {
        await testCase.invoke(client);
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${field}`);
      } catch (error: unknown) {
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
        expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(
          field
        );
      }
    }
  });

  it.each(acceptanceReaderCases)('$entityType rejects malformed comment elements', async (testCase) => {
    const client = createMockClient(testCase, {
      ...testCase.validData(),
      comments: ['valid comment', 17],
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: expect.stringContaining('comments'),
        decoderMessage: expect.any(String),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const client = createMockClient(testCase, testCase.validData(), wrongTemplateId);

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
    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpContractError);
  });
});
