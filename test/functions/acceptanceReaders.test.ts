/** Direct ledger-reader contracts shared by all four OCF acceptance families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
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

function createArgumentRoot(testCase: AcceptanceReaderCase): string {
  return `damlToOcf.${testCase.entityType}.createArgument`;
}

function ledgerCreateArgumentRoot(testCase: AcceptanceReaderCase): string {
  return `contract ${testCase.contractId}.eventsResponse.created.createdEvent.createArgument`;
}

function expectSingleLedgerRead(client: LedgerJsonApiClient): void {
  expect(client.getEventsByContractId).toHaveBeenCalledTimes(1);
}

async function captureRejection(promise: Promise<unknown>, message: string): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error(message);
}

describe('decoder-backed acceptance readers', () => {
  it.each(acceptanceReaderCases)('$entityType returns the exact canonical event shape', async (testCase) => {
    const client = createMockClient(testCase, testCase.validData());

    await expect(testCase.invoke(client)).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
    expectSingleLedgerRead(client);
  });

  it.each(acceptanceReaderCases)(
    '$entityType returns the same exact shape through the generic reader',
    async (testCase) => {
      const client = createMockClient(testCase, testCase.validData());

      await expect(getEntityAsOcf(client, testCase.entityType, testCase.contractId)).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      expectSingleLedgerRead(client);
    }
  );

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
      expectSingleLedgerRead(client);
    }
  });

  it.each(acceptanceReaderCases)(
    '$entityType rejects zero-length identifiers once in dedicated and generic readers',
    async (testCase) => {
      for (const field of ['id', 'security_id'] as const) {
        const invalidData = { ...testCase.validData(), [field]: '' };
        const expectedFieldPath = `${createArgumentRoot(testCase)}.acceptance_data.${field}`;
        const dedicatedClient = createMockClient(testCase, invalidData);
        const dedicatedError = await captureRejection(
          testCase.invoke(dedicatedClient),
          `Expected ${testCase.entityType} dedicated reader to reject empty ${field}`
        );

        expect(dedicatedError).toMatchObject({
          name: 'OcpValidationError',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: expectedFieldPath,
          expectedType: 'non-empty string',
          receivedValue: '',
        });
        expectSingleLedgerRead(dedicatedClient);

        const genericClient = createMockClient(testCase, invalidData);
        const genericError = await captureRejection(
          getEntityAsOcf(genericClient, testCase.entityType, testCase.contractId),
          `Expected ${testCase.entityType} generic reader to reject empty ${field}`
        );

        expect(genericError).toMatchObject({
          name: 'OcpValidationError',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: expectedFieldPath,
          expectedType: 'non-empty string',
          receivedValue: '',
        });
        expectSingleLedgerRead(genericClient);
      }
    }
  );

  it.each(acceptanceReaderCases)(
    '$entityType preserves non-empty whitespace and padded identifiers',
    async (testCase) => {
      const paddedData = {
        ...testCase.validData(),
        id: '  acceptance-id  ',
        security_id: '   ',
      };
      const expectedEvent = {
        ...testCase.expectedEvent,
        id: '  acceptance-id  ',
        security_id: '   ',
      };
      const dedicatedClient = createMockClient(testCase, paddedData);

      await expect(testCase.invoke(dedicatedClient)).resolves.toEqual({
        event: expectedEvent,
        contractId: testCase.contractId,
      });
      expectSingleLedgerRead(dedicatedClient);

      const genericClient = createMockClient(testCase, paddedData);
      await expect(getEntityAsOcf(genericClient, testCase.entityType, testCase.contractId)).resolves.toEqual({
        data: expectedEvent,
        contractId: testCase.contractId,
      });
      expectSingleLedgerRead(genericClient);
    }
  );

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
      classification: 'invalid_create_argument_json',
      source: ledgerCreateArgumentRoot(testCase),
      context: {
        contractId: testCase.contractId,
        issueKind: 'custom_prototype',
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
      classification: 'invalid_generated_create_argument',
      source: createArgumentRoot(testCase),
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context.issuer',
        decoderMessage: 'expected a string, got a number',
      },
    });
  });

  it.each(acceptanceReaderCases)(
    '$entityType validates semantic Party IDs in the generated context',
    async (testCase) => {
      const cases = [
        ['issuer', '', OcpErrorCodes.REQUIRED_FIELD_MISSING],
        ['issuer', 'issuer party', OcpErrorCodes.INVALID_FORMAT],
        ['system_operator', '', OcpErrorCodes.REQUIRED_FIELD_MISSING],
        ['system_operator', 'system operator', OcpErrorCodes.INVALID_FORMAT],
      ] as const;

      for (const [field, value, code] of cases) {
        const context = { ...VALID_CONTEXT, [field]: value };
        const client = createMockClient(testCase, testCase.validData(), {
          createArgument: {
            context,
            [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.validData(),
          },
        });

        await expect(testCase.invoke(client)).rejects.toMatchObject({
          name: OcpValidationError.name,
          code,
          fieldPath: `${createArgumentRoot(testCase)}.context.${field}`,
        });
        expectSingleLedgerRead(client);
      }
    }
  );

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
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.context`,
      context: {
        contractId: testCase.contractId,
        issueKind: 'custom_prototype',
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
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data`,
      context: {
        contractId: testCase.contractId,
        issueKind: 'custom_prototype',
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
      classification: 'invalid_generated_create_argument',
      source: createArgumentRoot(testCase),
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'acceptance_data' is required"),
      },
    });
  });

  it.each(acceptanceReaderCases)(
    '$entityType rejects ordinary extra fields at every generated wrapper level',
    async (testCase) => {
      const validData = testCase.validData();
      const rootPath = createArgumentRoot(testCase);
      const cases = [
        [
          'wrapper',
          { context: VALID_CONTEXT, acceptance_data: validData, unexpected_wrapper: true },
          `${rootPath}.unexpected_wrapper`,
        ],
        [
          'context',
          {
            context: { ...VALID_CONTEXT, unexpected_context: true },
            acceptance_data: validData,
          },
          `${rootPath}.context.unexpected_context`,
        ],
        [
          'acceptance data',
          {
            context: VALID_CONTEXT,
            acceptance_data: { ...validData, unexpected_acceptance_data: true },
          },
          `${rootPath}.acceptance_data.unexpected_acceptance_data`,
        ],
      ] as const;

      for (const [level, createArgument, expectedSource] of cases) {
        const client = createMockClient(testCase, validData, { createArgument });
        let error: unknown;

        try {
          await testCase.invoke(client);
          throw new Error(`Expected ${testCase.entityType} to reject an extra ${level} field`);
        } catch (caughtError: unknown) {
          error = caughtError;
        }

        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'lossy_daml_decode',
          source: expectedSource,
          context: {
            entityType: testCase.entityType,
            expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
            fieldPath: expectedSource,
          },
        });
        expectSingleLedgerRead(client);
      }
    }
  );

  it.each(acceptanceReaderCases)(
    '$entityType rejects a malformed lexical date with its exact field path',
    async (testCase) => {
      const client = createMockClient(testCase, {
        ...testCase.validData(),
        date: 'not-a-date',
      });

      const error = await captureRejection(
        testCase.invoke(client),
        `Expected ${testCase.entityType} reader to reject a malformed date`
      );

      expect(error).toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.date`,
        receivedValue: 'not-a-date',
      });
      expect(error).toBeInstanceOf(OcpValidationError);
      expectSingleLedgerRead(client);
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
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data.comments[0]`,
      context: {
        contractId: testCase.contractId,
        issueKind: 'sparse_array',
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
        classification: 'invalid_create_argument_json',
        source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data.comments`,
        context: {
          contractId: testCase.contractId,
          issueKind: 'custom_prototype',
        },
      });
    }
  );

  it.each(acceptanceReaderCases)(
    '$entityType rejects nested custom array fields before generated decoding',
    async (testCase) => {
      const comments = ['accepted'];
      Object.defineProperty(comments, 'unexpected', {
        configurable: true,
        enumerable: true,
        value: true,
      });
      const client = createMockClient(testCase, { ...testCase.validData(), comments });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_create_argument_json',
        source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data.comments[unexpected]`,
        context: {
          contractId: testCase.contractId,
          issueKind: 'custom_array_property',
        },
      });
    }
  );

  it.each(acceptanceReaderCases)(
    '$entityType rejects proxy create arguments without invoking traps',
    async (testCase) => {
      const getTrap = jest.fn(() => {
        throw new Error('proxy get trap must not run');
      });
      const ownKeysTrap = jest.fn(() => {
        throw new Error('proxy ownKeys trap must not run');
      });
      const createArgument = new Proxy(
        { context: VALID_CONTEXT, acceptance_data: testCase.validData() },
        { get: getTrap, ownKeys: ownKeysTrap }
      );
      const client = createMockClient(testCase, testCase.validData(), { createArgument });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_create_argument_json',
        source: ledgerCreateArgumentRoot(testCase),
        context: {
          contractId: testCase.contractId,
          issueKind: 'proxy',
        },
      });
      expect(getTrap).not.toHaveBeenCalled();
      expect(ownKeysTrap).not.toHaveBeenCalled();
    }
  );

  it.each(acceptanceReaderCases)(
    '$entityType rejects accessor payload fields without invoking getters',
    async (testCase) => {
      const getter = jest.fn(() => {
        throw new Error('acceptance accessor must not run');
      });
      const data = testCase.validData();
      Object.defineProperty(data, 'id', { configurable: true, enumerable: true, get: getter });
      const client = createMockClient(testCase, data);

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_create_argument_json',
        source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data.id`,
        context: {
          contractId: testCase.contractId,
          issueKind: 'accessor',
        },
      });
      expect(getter).not.toHaveBeenCalled();
    }
  );

  it.each(acceptanceReaderCases)('$entityType rejects cyclic payload graphs at their exact path', async (testCase) => {
    const data = { ...testCase.validData() };
    data.self = data;
    const client = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_json',
      source: `${ledgerCreateArgumentRoot(testCase)}.acceptance_data.self`,
      context: {
        contractId: testCase.contractId,
        issueKind: 'cycle',
      },
    });
  });

  it('bounds hostile acceptance diagnostic paths and serialized values', async () => {
    const testCase = acceptanceReaderCases[0];
    if (testCase === undefined) throw new Error('Expected at least one acceptance reader case');
    const hostileField = `hostile_${'x'.repeat(10_000)}`;
    const createArgument = {
      context: VALID_CONTEXT,
      acceptance_data: testCase.validData(),
      [hostileField]: 'y'.repeat(10_000),
    };
    const client = createMockClient(testCase, testCase.validData(), { createArgument });

    try {
      await testCase.invoke(client);
      throw new Error('Expected hostile acceptance diagnostics to be rejected');
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

  it.each(acceptanceReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId =
      testCase.entityType === 'stockAcceptance'
        ? ENTITY_TEMPLATE_ID_MAP.warrantAcceptance
        : ENTITY_TEMPLATE_ID_MAP.stockAcceptance;
    const client = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    const error = await captureRejection(
      testCase.invoke(client),
      `Expected ${testCase.entityType} reader to reject a wrong-template contract`
    );

    expect(error).toMatchObject({
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
    expect(error).toBeInstanceOf(OcpContractError);
    expectSingleLedgerRead(client);
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
