/** Direct ledger-reader contracts shared by administrative adjustment transactions. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { getIssuerAuthorizedSharesAdjustmentAsOcf } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { getStockClassAuthorizedSharesAdjustmentAsOcf } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { getStockPlanPoolAdjustmentAsOcf } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
import type {
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockPlanPoolAdjustment,
} from '../../src/types/native';

type AdministrativeAdjustmentEntityType = Extract<
  OcfEntityType,
  'issuerAuthorizedSharesAdjustment' | 'stockClassAuthorizedSharesAdjustment' | 'stockPlanPoolAdjustment'
>;
type AdministrativeAdjustment =
  | OcfIssuerAuthorizedSharesAdjustment
  | OcfStockClassAuthorizedSharesAdjustment
  | OcfStockPlanPoolAdjustment;

interface AdministrativeAdjustmentReaderCase {
  readonly entityType: AdministrativeAdjustmentEntityType;
  readonly contractId: string;
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: AdministrativeAdjustment;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: AdministrativeAdjustment; readonly contractId: string }>;
}

const adjustmentReaderCases: readonly AdministrativeAdjustmentReaderCase[] = [
  {
    entityType: 'issuerAuthorizedSharesAdjustment',
    contractId: 'issuer-adjustment-cid',
    numericField: 'new_shares_authorized',
    validData: () =>
      issuerAuthorizedSharesAdjustmentDataToDaml({
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'issuer-adjustment-1',
        date: '2026-07-10',
        issuer_id: 'issuer-1',
        new_shares_authorized: '1000.00',
        board_approval_date: '2026-07-09',
        stockholder_approval_date: '2026-07-08',
        comments: ['issuer authorization increased'],
      }),
    expectedEvent: {
      object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'issuer-adjustment-1',
      date: '2026-07-10',
      issuer_id: 'issuer-1',
      new_shares_authorized: '1000',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      comments: ['issuer authorization increased'],
    },
    invoke: async (client, readAs) =>
      getIssuerAuthorizedSharesAdjustmentAsOcf(client, {
        contractId: 'issuer-adjustment-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'stockClassAuthorizedSharesAdjustment',
    contractId: 'stock-class-adjustment-cid',
    numericField: 'new_shares_authorized',
    validData: () =>
      stockClassAuthorizedSharesAdjustmentDataToDaml({
        object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'stock-class-adjustment-1',
        date: '2026-07-10',
        stock_class_id: 'stock-class-1',
        new_shares_authorized: '2000.50',
        board_approval_date: '2026-07-09',
        stockholder_approval_date: '2026-07-08',
        comments: ['class authorization increased'],
      }),
    expectedEvent: {
      object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'stock-class-adjustment-1',
      date: '2026-07-10',
      stock_class_id: 'stock-class-1',
      new_shares_authorized: '2000.5',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      comments: ['class authorization increased'],
    },
    invoke: async (client, readAs) =>
      getStockClassAuthorizedSharesAdjustmentAsOcf(client, {
        contractId: 'stock-class-adjustment-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'stockPlanPoolAdjustment',
    contractId: 'stock-plan-pool-adjustment-cid',
    numericField: 'shares_reserved',
    validData: () =>
      stockPlanPoolAdjustmentDataToDaml({
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        id: 'stock-plan-pool-adjustment-1',
        date: '2026-07-10',
        stock_plan_id: 'stock-plan-1',
        shares_reserved: '3000.00',
        board_approval_date: '2026-07-09',
        stockholder_approval_date: '2026-07-08',
        comments: ['pool increased'],
      }),
    expectedEvent: {
      object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
      id: 'stock-plan-pool-adjustment-1',
      date: '2026-07-10',
      stock_plan_id: 'stock-plan-1',
      shares_reserved: '3000',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      comments: ['pool increased'],
    },
    invoke: async (client, readAs) =>
      getStockPlanPoolAdjustmentAsOcf(client, {
        contractId: 'stock-plan-pool-adjustment-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
];

interface MockClientOptions {
  readonly createArgument?: unknown;
  readonly templateId?: string;
}

function createMockClient(
  testCase: AdministrativeAdjustmentReaderCase,
  data: unknown,
  options: MockClientOptions = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : { [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        createArgument,
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: AdministrativeAdjustmentReaderCase, field: string): void {
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

describe('decoder-backed administrative adjustment readers', () => {
  it.each(adjustmentReaderCases)(
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

  it.each(adjustmentReaderCases)(
    '$entityType prefers the canonical wrapper over whole-argument lookalikes',
    async (testCase) => {
      const canonicalData = testCase.validData();
      const createArgument = {
        ...canonicalData,
        id: 'wrong-top-level-id',
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: canonicalData,
      };
      const { client } = createMockClient(testCase, canonicalData, { createArgument });

      await expect(testCase.invoke(client)).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType rejects numeric primitives at the generated boundary',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), [testCase.numericField]: 17 });

      try {
        await testCase.invoke(client);
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${testCase.numericField}`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, testCase.numericField);
      }
    }
  );

  it.each(
    adjustmentReaderCases.flatMap((testCase) =>
      (['1e3', 'not-a-number'] as const).map((invalidValue) => ({ invalidValue, testCase }))
    )
  )(
    '$testCase.entityType rejects semantically invalid numeric string $invalidValue at its exact field path',
    async ({ invalidValue, testCase }) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        [testCase.numericField]: invalidValue,
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.${testCase.numericField}`,
        receivedValue: invalidValue,
      });
    }
  );

  it.each(adjustmentReaderCases)('$entityType rejects semantically invalid transaction dates', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.date`,
    });
  });

  it.each(adjustmentReaderCases)(
    '$entityType rejects malformed optional approval dates losslessly',
    async (testCase) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        board_approval_date: { seconds: 1 },
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: {
          entityType: testCase.entityType,
          decoderPath: 'input.board_approval_date',
          decoderMessage: 'raw object was decoded and encoded as null',
        },
      });
    }
  );

  it.each(adjustmentReaderCases)('$entityType rejects invalid optional approval-date strings', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      board_approval_date: '2026-99-99',
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.board_approval_date`,
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects malformed nested comments', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(adjustmentReaderCases)('$entityType rejects a missing required comments list', async (testCase) => {
    const data = testCase.validData();
    delete data.comments;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject missing comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(adjustmentReaderCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
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

  it.each(adjustmentReaderCases)(
    '$entityType omits null approval dates and empty comments canonically',
    async (testCase) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
      });

      const result = await testCase.invoke(client);
      expect(result.event.board_approval_date).toBeUndefined();
      expect(result.event.stockholder_approval_date).toBeUndefined();
      expect(result.event.comments).toBeUndefined();
      expect('board_approval_date' in result.event).toBe(false);
      expect('stockholder_approval_date' in result.event).toBe(false);
      expect('comments' in result.event).toBe(false);
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType accepts omitted approval keys and applies generated null defaults',
    async (testCase) => {
      const data = testCase.validData();
      delete data.board_approval_date;
      delete data.stockholder_approval_date;
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      expect(result.event.board_approval_date).toBeUndefined();
      expect(result.event.stockholder_approval_date).toBeUndefined();
      expect('board_approval_date' in result.event).toBe(false);
      expect('stockholder_approval_date' in result.event).toBe(false);
    }
  );

  it.each(adjustmentReaderCases)('$entityType rejects non-object nested adjustment data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects a missing canonical wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: {} });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it('issuerAuthorizedSharesAdjustment no longer treats the whole createArgument as adjustment data', async () => {
    const testCase = adjustmentReaderCases[0];
    if (!testCase) throw new Error('Missing issuer adjustment reader case');
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: testCase.validData() });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining('adjustment_data'),
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
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
    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpContractError);
  });

  it.each(adjustmentReaderCases)('$entityType surfaces converter validation as typed OCP errors', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '' });
    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
  });
});
