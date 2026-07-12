/** Direct ledger-reader contracts shared by the four OCF transfer families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
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

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

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

interface MockContractOptions {
  readonly templateId?: string;
  readonly packageName?: string;
  readonly createArgument?: Record<string, unknown>;
}

function createArgument(testCase: TransferReaderCase, data: unknown): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
  };
}

function withoutFields(value: TransferEvent, fields: readonly string[]): Record<string, unknown> {
  const omitted = new Set(fields);
  return Object.fromEntries(Object.entries(value).filter(([field]) => !omitted.has(field)));
}

function createMockClient(
  testCase: TransferReaderCase,
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
          createArgument: options.createArgument ?? createArgument(testCase, data),
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

function ledgerJsonFailure(testCase: TransferReaderCase): Record<string, unknown> {
  return {
    name: OcpParseError.name,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_create_argument_json',
    source: expect.stringContaining(
      `contract ${testCase.contractId}.eventsResponse.created.createdEvent.createArgument`
    ),
  };
}

function expectDecoderFailure(error: unknown, testCase: TransferReaderCase, field: string): boolean {
  expect(error).toBeInstanceOf(OcpParseError);
  const parseError = error as OcpParseError;
  if (parseError.source !== `damlToOcf.${testCase.entityType}.createArgument`) {
    expect(error).toMatchObject(ledgerJsonFailure(testCase));
    return false;
  }
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    source: `damlToOcf.${testCase.entityType}.createArgument`,
    context: {
      entityType: testCase.entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(field);
  return true;
}

describe('decoder-backed transfer readers', () => {
  it.each(transferReaderCases)('$entityType returns the exact canonical event shape', async (testCase) => {
    await expect(testCase.invoke(createMockClient(testCase, testCase.validData()))).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(transferReaderCases)(
    '$entityType omits empty comments and preserves a balance security ID',
    async (testCase) => {
      const balanceSecurityId = `${testCase.entityType}-balance-security-1`;
      const expectedEvent = {
        ...withoutFields(testCase.expectedEvent, ['comments']),
        balance_security_id: balanceSecurityId,
      };

      await expect(
        testCase.invoke(
          createMockClient(testCase, {
            ...testCase.validData(),
            comments: [],
            balance_security_id: balanceSecurityId,
          })
        )
      ).resolves.toEqual({ event: expectedEvent, contractId: testCase.contractId });
    }
  );

  it.each(transferReaderCases)('$entityType rejects malformed $numericField', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, testCase.malformedNumericData()));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${testCase.numericField}`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, testCase.numericField);
      expect(error).toMatchObject({
        context: {
          decoderPath:
            testCase.entityType === 'convertibleTransfer'
              ? 'input.transfer_data.amount.amount'
              : 'input.transfer_data.quantity',
        },
      });
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
      expect(error).toMatchObject({ context: { decoderPath: 'input.transfer_data.resulting_security_ids[1]' } });
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed consideration_text', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), consideration_text: 17 }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed consideration_text`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'consideration_text');
      expect(error).toMatchObject({
        context: {
          decoderPath: 'input.transfer_data.consideration_text',
          expectedType: 'string | null',
          receivedType: 'number',
        },
      });
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed comment elements', async (testCase) => {
    try {
      await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] }));
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
      expect(error).toMatchObject({ context: { decoderPath: 'input.transfer_data.comments[1]' } });
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed required payload fields', async (testCase) => {
    const missingSecurityId = { ...testCase.validData() };
    delete missingSecurityId.security_id;
    const malformedFields: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['id', { ...testCase.validData(), id: 17 }],
      ['date', { ...testCase.validData(), date: null }],
      ['security_id', missingSecurityId],
      ['comments', { ...testCase.validData(), comments: null }],
      ['resulting_security_ids', { ...testCase.validData(), resulting_security_ids: null }],
    ];

    for (const [field, data] of malformedFields) {
      try {
        await testCase.invoke(createMockClient(testCase, data));
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${field}`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, field);
      }
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed balance_security_id values', async (testCase) => {
    for (const [value, receivedType] of [
      [17, 'number'],
      [{ value: 'not-text' }, 'object'],
    ] as const) {
      try {
        await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), balance_security_id: value }));
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed balance_security_id`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, 'balance_security_id');
        expect(error).toMatchObject({
          context: {
            decoderPath: 'input.transfer_data.balance_security_id',
            fieldPath: `${testCase.entityType}.balance_security_id`,
            expectedType: 'string | null',
            receivedType,
          },
        });
      }
    }
  });

  it.each(transferReaderCases)('$entityType rejects explicit undefined DAML optionals', async (testCase) => {
    for (const field of ['balance_security_id', 'consideration_text'] as const) {
      try {
        await testCase.invoke(createMockClient(testCase, { ...testCase.validData(), [field]: undefined }));
        throw new Error(`Expected ${testCase.entityType} reader to reject explicit undefined ${field}`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, field);
        expect(error).toMatchObject({
          context: {
            decoderPath: `input.transfer_data.${field}`,
            fieldPath: `${testCase.entityType}.${field}`,
            expectedType: 'string | null',
            receivedType: 'undefined',
          },
        });
      }
    }
  });

  it.each(transferReaderCases)('$entityType accepts null or omitted DAML optionals as absent', async (testCase) => {
    const expectedEvent = withoutFields(testCase.expectedEvent, ['balance_security_id', 'consideration_text']);
    const omitted = { ...testCase.validData() };
    delete omitted.balance_security_id;
    delete omitted.consideration_text;

    await expect(
      testCase.invoke(
        createMockClient(testCase, { ...testCase.validData(), balance_security_id: null, consideration_text: null })
      )
    ).resolves.toEqual({ event: expectedEvent, contractId: testCase.contractId });
    await expect(testCase.invoke(createMockClient(testCase, omitted))).resolves.toEqual({
      event: expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(transferReaderCases)(
    '$entityType preserves present empty optional strings without dropping data',
    async (testCase) => {
      const expectedEvent = {
        ...withoutFields(testCase.expectedEvent, ['balance_security_id', 'consideration_text']),
        balance_security_id: '',
        consideration_text: '',
      };

      await expect(
        testCase.invoke(
          createMockClient(testCase, { ...testCase.validData(), balance_security_id: '', consideration_text: '' })
        )
      ).resolves.toEqual({ event: expectedEvent, contractId: testCase.contractId });
    }
  );

  it.each(transferReaderCases)('$entityType rejects inherited DAML optional fields', async (testCase) => {
    for (const field of ['balance_security_id', 'consideration_text'] as const) {
      const data = { ...testCase.validData() };
      delete data[field];
      Object.setPrototypeOf(data, { [field]: 'inherited-value' });

      try {
        await testCase.invoke(createMockClient(testCase, data));
        throw new Error(`Expected ${testCase.entityType} reader to reject inherited ${field}`);
      } catch (error: unknown) {
        if (expectDecoderFailure(error, testCase, field)) {
          expect(error).toMatchObject({
            context: {
              decoderPath: `input.transfer_data.${field}`,
              decoderMessage: `the key '${field}' is inherited rather than an own property`,
            },
          });
        }
      }
    }
  });

  it.each(transferReaderCases)('$entityType requires own full-wrapper fields', async (testCase) => {
    const validArgument = createArgument(testCase, testCase.validData());
    const malformedArguments: ReadonlyArray<readonly [Record<string, unknown>, string, string]> = [
      [{ transfer_data: testCase.validData() }, 'context', 'input'],
      [{ context: VALID_CONTEXT }, 'transfer_data', 'input'],
      [Object.create(validArgument) as Record<string, unknown>, 'context', 'input.context'],
    ];

    for (const [createArgumentValue, field, decoderPath] of malformedArguments) {
      try {
        await testCase.invoke(
          createMockClient(testCase, testCase.validData(), { createArgument: createArgumentValue })
        );
        throw new Error(`Expected ${testCase.entityType} reader to reject non-own ${field}`);
      } catch (error: unknown) {
        if (expectDecoderFailure(error, testCase, field)) {
          expect(error).toMatchObject({ context: { decoderPath } });
        }
      }
    }
  });

  it.each(transferReaderCases)('$entityType requires own context and payload fields', async (testCase) => {
    const inheritedContext = Object.create(VALID_CONTEXT) as Record<string, unknown>;
    const inheritedPayload = { ...testCase.validData() };
    const inheritedId = inheritedPayload.id;
    delete inheritedPayload.id;
    Object.setPrototypeOf(inheritedPayload, { id: inheritedId });

    for (const [createArgumentValue, field, decoderPath] of [
      [{ context: inheritedContext, transfer_data: testCase.validData() }, 'issuer', 'input.context.issuer'],
      [{ context: VALID_CONTEXT, transfer_data: inheritedPayload }, 'id', 'input.transfer_data.id'],
    ] as const) {
      try {
        await testCase.invoke(
          createMockClient(testCase, testCase.validData(), { createArgument: createArgumentValue })
        );
        throw new Error(`Expected ${testCase.entityType} reader to reject inherited ${field}`);
      } catch (error: unknown) {
        if (expectDecoderFailure(error, testCase, field)) {
          expect(error).toMatchObject({ context: { decoderPath } });
        }
      }
    }
  });

  it.each(transferReaderCases)('$entityType rejects malformed context values at the exact path', async (testCase) => {
    try {
      await testCase.invoke(
        createMockClient(testCase, testCase.validData(), {
          createArgument: {
            context: { ...VALID_CONTEXT, system_operator: 17 },
            transfer_data: testCase.validData(),
          },
        })
      );
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed system_operator`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'system_operator');
      expect(error).toMatchObject({ context: { decoderPath: 'input.context.system_operator' } });
    }
  });

  it.each(transferReaderCases)('$entityType rejects lossy fields at every full-wrapper level', async (testCase) => {
    const validData = testCase.validData();
    const mutations: ReadonlyArray<readonly [Record<string, unknown>, string]> = [
      [{ ...createArgument(testCase, validData), unexpected_wrapper_field: true }, 'input.unexpected_wrapper_field'],
      [
        {
          ...createArgument(testCase, validData),
          context: { ...VALID_CONTEXT, unexpected_context_field: true },
        },
        'input.context.unexpected_context_field',
      ],
      [
        createArgument(testCase, { ...validData, unexpected_payload_field: true }),
        'input.transfer_data.unexpected_payload_field',
      ],
    ];

    for (const [createArgumentValue, decoderPath] of mutations) {
      try {
        await testCase.invoke(
          createMockClient(testCase, testCase.validData(), { createArgument: createArgumentValue })
        );
        throw new Error(`Expected ${testCase.entityType} reader to reject ${decoderPath}`);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: {
            entityType: testCase.entityType,
            decoderPath,
            decoderMessage: 'raw field was discarded by the generated codec',
          },
        });
      }
    }
  });

  it.each(transferReaderCases)('$entityType rejects sparse comments and resulting security IDs', async (testCase) => {
    for (const field of ['comments', 'resulting_security_ids'] as const) {
      const values = new Array<unknown>(2);
      values[1] = 'owned-value';

      await expect(
        testCase.invoke(createMockClient(testCase, { ...testCase.validData(), [field]: values }))
      ).rejects.toMatchObject(ledgerJsonFailure(testCase));
    }
  });

  it.each(transferReaderCases)(
    '$entityType rejects comments and resulting security IDs inherited through array prototypes',
    async (testCase) => {
      for (const field of ['comments', 'resulting_security_ids'] as const) {
        class InheritedList extends Array<unknown> {}
        Object.defineProperty(InheritedList.prototype, 0, {
          configurable: true,
          enumerable: true,
          value: 'inherited-value',
        });
        const values = new InheritedList(1);

        await expect(
          testCase.invoke(createMockClient(testCase, { ...testCase.validData(), [field]: values }))
        ).rejects.toMatchObject(ledgerJsonFailure(testCase));
      }
    }
  );

  it.each(transferReaderCases)('$entityType rejects named fields attached to arrays', async (testCase) => {
    const resultingSecurityIds = ['result-1'];
    Object.defineProperty(resultingSecurityIds, 'unexpected', { enumerable: true, value: 'discarded' });

    await expect(
      testCase.invoke(
        createMockClient(testCase, { ...testCase.validData(), resulting_security_ids: resultingSecurityIds })
      )
    ).rejects.toMatchObject(ledgerJsonFailure(testCase));
  });

  it('convertibleTransfer rejects inherited monetary members', async () => {
    const testCase = transferReaderCases.find(({ entityType }) => entityType === 'convertibleTransfer');
    if (testCase === undefined) throw new Error('Missing convertible transfer reader case');
    const data = testCase.validData();
    const amount = { ...(data.amount as Record<string, unknown>) };
    const { currency } = amount;
    delete amount.currency;
    Object.setPrototypeOf(amount, { currency });

    await expect(testCase.invoke(createMockClient(testCase, { ...data, amount }))).rejects.toMatchObject(
      ledgerJsonFailure(testCase)
    );
  });

  it.each(transferReaderCases)(
    '$entityType rejects invalid numeric grammar and precision at its exact path',
    async (testCase) => {
      const fieldPath =
        testCase.entityType === 'convertibleTransfer'
          ? 'convertibleTransfer.amount.amount'
          : `${testCase.entityType}.quantity`;

      for (const value of ['not-a-number', '1.12345678901']) {
        const data = testCase.validData();
        const malformed =
          testCase.entityType === 'convertibleTransfer'
            ? { ...data, amount: { ...(data.amount as Record<string, unknown>), amount: value } }
            : { ...data, quantity: value };

        await expect(testCase.invoke(createMockClient(testCase, malformed))).rejects.toMatchObject({
          name: 'OcpValidationError',
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath,
        });
      }
    }
  );

  it('convertibleTransfer validates the OCF currency code at the exact path', async () => {
    const testCase = transferReaderCases.find(({ entityType }) => entityType === 'convertibleTransfer');
    if (testCase === undefined) throw new Error('Missing convertible transfer reader case');
    const data = testCase.validData();

    await expect(
      testCase.invoke(
        createMockClient(testCase, {
          ...data,
          amount: { ...(data.amount as Record<string, unknown>), currency: 'usd' },
        })
      )
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleTransfer.amount.currency',
    });
  });

  it.each(transferReaderCases)(
    '$entityType rejects duplicate resulting security IDs at the duplicate index',
    async (testCase) => {
      await expect(
        testCase.invoke(
          createMockClient(testCase, {
            ...testCase.validData(),
            resulting_security_ids: ['duplicate-result', 'duplicate-result'],
          })
        )
      ).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.resulting_security_ids.1`,
        context: {
          duplicateIndex: 1,
          duplicateOfIndex: 0,
        },
      });
    }
  );

  it.each(transferReaderCases)(
    '$entityType rejects malformed lexical dates at the entity-specific path',
    async (testCase) => {
      await expect(
        testCase.invoke(createMockClient(testCase, { ...testCase.validData(), date: '2026-02-30' }))
      ).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${testCase.entityType}.date`,
      });
    }
  );

  it.each(transferReaderCases)('$entityType rejects an incompatible generated transfer variant', async (testCase) => {
    const incompatibleCase = transferReaderCases.find(({ entityType }) =>
      testCase.entityType === 'convertibleTransfer'
        ? entityType === 'stockTransfer'
        : entityType === 'convertibleTransfer'
    );
    if (incompatibleCase === undefined) throw new Error('Missing incompatible transfer reader case');

    try {
      await testCase.invoke(
        createMockClient(testCase, testCase.validData(), {
          createArgument: createArgument(testCase, incompatibleCase.validData()),
        })
      );
      throw new Error(`Expected ${testCase.entityType} reader to reject incompatible transfer variant`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, testCase.numericField);
    }
  });

  it.each(transferReaderCases)('$entityType preserves the non-empty OCF result invariant', async (testCase) => {
    await expect(
      testCase.invoke(createMockClient(testCase, { ...testCase.validData(), resulting_security_ids: [] }))
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: `${testCase.entityType}.resulting_security_ids`,
    });
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

  it.each(transferReaderCases)('$entityType rejects a sibling transfer template', async (testCase) => {
    const siblingEntityType = testCase.entityType === 'stockTransfer' ? 'warrantTransfer' : 'stockTransfer';
    const siblingTemplateId = ENTITY_TEMPLATE_ID_MAP[siblingEntityType];

    await expect(
      testCase.invoke(createMockClient(testCase, testCase.validData(), { templateId: siblingTemplateId }))
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
      contractId: testCase.contractId,
      templateId: siblingTemplateId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        actualTemplateId: siblingTemplateId,
      },
    });
  });

  it.each(transferReaderCases)('$entityType rejects the right module on the wrong package line', async (testCase) => {
    const expectedTemplateId = ENTITY_TEMPLATE_ID_MAP[testCase.entityType];
    const wrongTemplateId = expectedTemplateId.replace(/^#[^:]+/, '#OpenCapTable-wrong');

    await expect(
      testCase.invoke(createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId }))
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'package_name_mismatch',
      contractId: testCase.contractId,
      templateId: wrongTemplateId,
      context: {
        expectedTemplateId,
        actualTemplateId: wrongTemplateId,
      },
    });
  });
});
