/** Direct ledger-reader contracts shared by administrative adjustment transactions. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import {
  damlIssuerAuthorizedSharesAdjustmentDataToNative,
  getIssuerAuthorizedSharesAdjustmentAsOcf,
} from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import {
  damlStockClassAuthorizedSharesAdjustmentDataToNative,
  getStockClassAuthorizedSharesAdjustmentAsOcf,
} from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import {
  damlStockPlanPoolAdjustmentDataToNative,
  getStockPlanPoolAdjustmentAsOcf,
} from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
import { OcpClient } from '../../src/OcpClient';
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

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

interface AdministrativeAdjustmentReaderCase {
  readonly entityType: AdministrativeAdjustmentEntityType;
  readonly contractId: string;
  readonly objectType:
    | 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_PLAN_POOL_ADJUSTMENT';
  readonly subjectField: 'issuer_id' | 'stock_class_id' | 'stock_plan_id';
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: AdministrativeAdjustment;
  readonly convert: (data: Record<string, unknown>) => AdministrativeAdjustment;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: AdministrativeAdjustment; readonly contractId: string }>;
}

const adjustmentReaderCases: readonly AdministrativeAdjustmentReaderCase[] = [
  {
    entityType: 'issuerAuthorizedSharesAdjustment',
    contractId: 'issuer-adjustment-cid',
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    subjectField: 'issuer_id',
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
    convert: (data) =>
      damlIssuerAuthorizedSharesAdjustmentDataToNative(
        data as unknown as Parameters<typeof damlIssuerAuthorizedSharesAdjustmentDataToNative>[0]
      ),
    invoke: async (client, readAs) =>
      getIssuerAuthorizedSharesAdjustmentAsOcf(client, {
        contractId: 'issuer-adjustment-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'stockClassAuthorizedSharesAdjustment',
    contractId: 'stock-class-adjustment-cid',
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    subjectField: 'stock_class_id',
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
    convert: (data) =>
      damlStockClassAuthorizedSharesAdjustmentDataToNative(
        data as unknown as Parameters<typeof damlStockClassAuthorizedSharesAdjustmentDataToNative>[0]
      ),
    invoke: async (client, readAs) =>
      getStockClassAuthorizedSharesAdjustmentAsOcf(client, {
        contractId: 'stock-class-adjustment-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'stockPlanPoolAdjustment',
    contractId: 'stock-plan-pool-adjustment-cid',
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    subjectField: 'stock_plan_id',
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
    convert: (data) =>
      damlStockPlanPoolAdjustmentDataToNative(
        data as unknown as Parameters<typeof damlStockPlanPoolAdjustmentDataToNative>[0]
      ),
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
    : { context: VALID_CONTEXT, [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
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
    source: `damlAdministrativeAdjustmentCreateArgument.${testCase.entityType}`,
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
    '$entityType succeeds through getEntityAsOcf, the OcpClient namespace, and getByObjectType',
    async (testCase) => {
      const { client } = createMockClient(testCase, testCase.validData());

      await expect(getEntityAsOcf(client, testCase.entityType, testCase.contractId)).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });

      const ocp = new OcpClient({ ledger: client });
      await expect(ocp.OpenCapTable[testCase.entityType].get({ contractId: testCase.contractId })).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      await expect(
        ocp.OpenCapTable.getByObjectType({ objectType: testCase.objectType, contractId: testCase.contractId })
      ).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType rejects whole-argument lookalikes outside the canonical wrapper',
    async (testCase) => {
      const canonicalData = testCase.validData();
      const createArgument = {
        context: VALID_CONTEXT,
        id: 'wrong-top-level-id',
        [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: canonicalData,
      };
      const { client } = createMockClient(testCase, canonicalData, { createArgument });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: {
          entityType: testCase.entityType,
          decoderPath: 'input.id',
          decoderMessage: 'raw field was discarded by the generated codec',
        },
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
      (['1e3', 'not-a-number', '1.12345678901'] as const).map((invalidValue) => ({ invalidValue, testCase }))
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

  it.each(adjustmentReaderCases)(
    '$entityType canonicalizes a schema-valid leading plus sign at its public reader boundary',
    async (testCase) => {
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        [testCase.numericField]: '+17.2500',
      });

      const result = await testCase.invoke(client);
      expect((result.event as unknown as Record<string, unknown>)[testCase.numericField]).toBe('17.25');
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType rejects a negative absolute share total with an exact field path',
    async (testCase) => {
      const invalidValue = '-0.01';
      const { client } = createMockClient(testCase, {
        ...testCase.validData(),
        [testCase.numericField]: invalidValue,
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: `${testCase.entityType}.${testCase.numericField}`,
        receivedValue: invalidValue,
      });
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType enforces non-empty IDs and comments through the direct converter',
    (testCase) => {
      expect(() => testCase.convert({ ...testCase.validData(), id: '' })).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `${testCase.entityType}.id`,
        })
      );
      expect(() => testCase.convert({ ...testCase.validData(), [testCase.subjectField]: '' })).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `${testCase.entityType}.${testCase.subjectField}`,
        })
      );
      expect(() => testCase.convert({ ...testCase.validData(), comments: [''] })).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `${testCase.entityType}.comments[0]`,
        })
      );
      expect(() => testCase.convert({ ...testCase.validData(), comments: {} })).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `${testCase.entityType}.comments`,
        })
      );
      expect(() => testCase.convert({ ...testCase.validData(), [testCase.numericField]: { amount: '1' } })).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `${testCase.entityType}.${testCase.numericField}`,
        })
      );
    }
  );

  it.each(adjustmentReaderCases)(
    '$entityType preserves semantic validation through every generic public read path',
    async (testCase) => {
      const emptyIdClient = createMockClient(testCase, { ...testCase.validData(), id: '' }).client;
      await expect(getEntityAsOcf(emptyIdClient, testCase.entityType, testCase.contractId)).rejects.toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: `${testCase.entityType}.id`,
      });

      const negativeTotalClient = createMockClient(testCase, {
        ...testCase.validData(),
        [testCase.numericField]: '-1',
      }).client;
      await expect(getEntityAsOcf(negativeTotalClient, testCase.entityType, testCase.contractId)).rejects.toMatchObject(
        {
          code: OcpErrorCodes.OUT_OF_RANGE,
          fieldPath: `${testCase.entityType}.${testCase.numericField}`,
          receivedValue: '-1',
        }
      );

      const emptySubjectClient = createMockClient(testCase, {
        ...testCase.validData(),
        [testCase.subjectField]: '',
      }).client;
      const subjectOcp = new OcpClient({ ledger: emptySubjectClient });
      await expect(
        subjectOcp.OpenCapTable[testCase.entityType].get({ contractId: testCase.contractId })
      ).rejects.toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: `${testCase.entityType}.${testCase.subjectField}`,
      });

      const emptyCommentClient = createMockClient(testCase, {
        ...testCase.validData(),
        comments: [''],
      }).client;
      const commentOcp = new OcpClient({ ledger: emptyCommentClient });
      await expect(
        commentOcp.OpenCapTable.getByObjectType({
          objectType: testCase.objectType,
          contractId: testCase.contractId,
        })
      ).rejects.toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: `${testCase.entityType}.comments[0]`,
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
          decoderPath: 'input.adjustment_data.board_approval_date',
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
        decoderPath: 'input.adjustment_data.unexpected_field',
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

  it.each(adjustmentReaderCases)('$entityType rejects a missing full-wrapper context', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { adjustment_data: testCase.validData() },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: "the key 'context' is required as an own property",
      },
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects malformed full-wrapper context data', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: [], adjustment_data: testCase.validData() },
    });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} to reject malformed context`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'context');
    }
  });

  it.each(adjustmentReaderCases)(
    '$entityType rejects missing and unknown context fields losslessly',
    async (testCase) => {
      const missingContextClient = createMockClient(testCase, testCase.validData(), {
        createArgument: {
          context: { issuer: VALID_CONTEXT.issuer },
          adjustment_data: testCase.validData(),
        },
      }).client;
      await expect(testCase.invoke(missingContextClient)).rejects.toMatchObject({
        context: {
          decoderPath: 'input.context',
          decoderMessage: "the key 'system_operator' is required as an own property",
        },
      });

      const unknownContextClient = createMockClient(testCase, testCase.validData(), {
        createArgument: {
          context: { ...VALID_CONTEXT, unexpected_field: true },
          adjustment_data: testCase.validData(),
        },
      }).client;
      await expect(testCase.invoke(unknownContextClient)).rejects.toMatchObject({
        context: {
          decoderPath: 'input.context.unexpected_field',
          decoderMessage: 'raw field was discarded by the generated codec',
        },
      });
    }
  );

  it.each(adjustmentReaderCases)('$entityType rejects inherited wrapper and payload fields', async (testCase) => {
    const inheritedWrapper = Object.assign(Object.create({ context: VALID_CONTEXT }), {
      adjustment_data: testCase.validData(),
    });
    const inheritedWrapperClient = createMockClient(testCase, testCase.validData(), {
      createArgument: inheritedWrapper,
    }).client;
    await expect(testCase.invoke(inheritedWrapperClient)).rejects.toMatchObject({
      context: {
        decoderPath: 'input',
        decoderMessage: "the key 'context' is required as an own property",
      },
    });

    const validData = testCase.validData();
    const inheritedPayload = Object.assign(Object.create({ id: validData.id }), validData);
    delete inheritedPayload.id;
    const inheritedPayloadClient = createMockClient(testCase, inheritedPayload).client;
    await expect(testCase.invoke(inheritedPayloadClient)).rejects.toMatchObject({
      context: {
        decoderPath: 'input.adjustment_data',
        decoderMessage: "the key 'id' is required as an own property",
      },
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects sparse comment lists', async (testCase) => {
    const sparseComments = new Array<string>(1);
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: sparseComments });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      context: {
        decoderPath: 'input.adjustment_data.comments[0]',
        decoderMessage: 'list element is missing or inherited rather than an own property',
      },
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects non-object nested adjustment data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(adjustmentReaderCases)('$entityType rejects a missing canonical wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: { context: VALID_CONTEXT } });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it('issuerAuthorizedSharesAdjustment no longer treats the whole createArgument as adjustment data', async () => {
    const testCase = adjustmentReaderCases[0];
    if (!testCase) throw new Error('Missing issuer adjustment reader case');
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: VALID_CONTEXT, ...testCase.validData() },
    });

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
