/** Direct ledger-reader contracts shared by all four OCF acceptance families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
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

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

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

interface MockContractOptions {
  readonly templateId?: string;
  readonly packageName?: string;
  readonly createArgument?: Record<string, unknown>;
}

function createMockClient(
  testCase: AcceptanceReaderCase,
  data: Record<string, unknown>,
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
      ['date', { ...testCase.validData(), date: null }],
      [
        'security_id',
        Object.fromEntries(Object.entries(testCase.validData()).filter(([key]) => key !== 'security_id')),
      ],
      ['comments', { ...testCase.validData(), comments: null }],
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
        decoderPath: 'input.acceptance_data.comments[1]',
        decoderMessage: expect.any(String),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects a createArgument missing generated context', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'context' is required"),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects an inherited generated wrapper', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: Object.create({
        context: VALID_CONTEXT,
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      }),
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'context' is required as an own property"),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects malformed generated context fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: { issuer: 17, system_operator: VALID_CONTEXT.system_operator },
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context.issuer',
        decoderMessage: 'expected a string, got a number',
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects inherited generated context fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: Object.create(VALID_CONTEXT),
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context',
        decoderMessage: expect.stringContaining("key 'issuer' is required as an own property"),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects inherited required payload fields', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: VALID_CONTEXT,
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: Object.create(testCase.validData()),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.acceptance_data',
        decoderMessage: expect.stringContaining("key 'id' is required as an own property"),
      },
    });
  });

  it.each(acceptanceReaderCases)('$entityType rejects a wrong generated wrapper variant', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: VALID_CONTEXT,
        cancellation_data: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'acceptance_data' is required"),
      },
    });
  });

  it.each(acceptanceReaderCases)(
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

  it.each(acceptanceReaderCases)('$entityType omits only the canonical empty comments list', async (testCase) => {
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

  it.each(acceptanceReaderCases)('$entityType rejects sparse comments without dropping indexes', async (testCase) => {
    const comments = new Array<unknown>(2);
    comments[1] = 'second comment';
    const client = createMockClient(testCase, {
      ...testCase.validData(),
      comments,
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.acceptance_data.comments[0]',
        decoderMessage: 'list element is missing or inherited rather than an own property',
      },
    });
  });

  it.each(acceptanceReaderCases)(
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
        source: `damlAcceptanceCreateArgument.${testCase.entityType}`,
        context: {
          entityType: testCase.entityType,
          decoderPath: 'input.acceptance_data.comments[0]',
          decoderMessage: 'list element is missing or inherited rather than an own property',
        },
      });
    }
  );

  it.each(acceptanceReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId =
      testCase.entityType === 'stockAcceptance'
        ? ENTITY_TEMPLATE_ID_MAP.warrantAcceptance
        : ENTITY_TEMPLATE_ID_MAP.stockAcceptance;
    const client = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

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

  it.each(acceptanceReaderCases)('$entityType rejects the right module on the wrong package line', async (testCase) => {
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
  });
});
