/** Full generated-wrapper contracts shared by the OCF vesting readers. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getVestingAccelerationAsOcf } from '../../src/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import { vestingAccelerationDataToDaml } from '../../src/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import { getVestingEventAsOcf } from '../../src/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import { vestingEventDataToDaml } from '../../src/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import { getVestingStartAsOcf } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart, OcfVestingTerms } from '../../src/types/native';

type VestingEntityType = Extract<
  OcfEntityType,
  'vestingAcceleration' | 'vestingEvent' | 'vestingStart' | 'vestingTerms'
>;
type VestingObject = OcfVestingAcceleration | OcfVestingEvent | OcfVestingStart | OcfVestingTerms;

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

interface VestingReaderCase {
  readonly entityType: VestingEntityType;
  readonly contractId: string;
  readonly legacyDataField?: string;
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: VestingObject;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: VestingObject; readonly contractId: string }>;
}

const vestingReaderCases: readonly VestingReaderCase[] = [
  {
    entityType: 'vestingStart',
    contractId: 'vesting-start-cid',
    legacyDataField: 'vesting_start_data',
    validData: () =>
      vestingStartDataToDaml({
        object_type: 'TX_VESTING_START',
        id: 'vesting-start-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        vesting_condition_id: 'vesting-condition-1',
        comments: ['vesting started'],
      }),
    expectedEvent: {
      object_type: 'TX_VESTING_START',
      id: 'vesting-start-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      vesting_condition_id: 'vesting-condition-1',
      comments: ['vesting started'],
    },
    invoke: async (client, readAs) =>
      getVestingStartAsOcf(client, {
        contractId: 'vesting-start-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'vestingEvent',
    contractId: 'vesting-event-cid',
    legacyDataField: 'vesting_event_data',
    validData: () =>
      vestingEventDataToDaml({
        object_type: 'TX_VESTING_EVENT',
        id: 'vesting-event-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        vesting_condition_id: 'vesting-condition-2',
        comments: ['vesting milestone reached'],
      }),
    expectedEvent: {
      object_type: 'TX_VESTING_EVENT',
      id: 'vesting-event-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      vesting_condition_id: 'vesting-condition-2',
      comments: ['vesting milestone reached'],
    },
    invoke: async (client, readAs) =>
      getVestingEventAsOcf(client, {
        contractId: 'vesting-event-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'vestingAcceleration',
    contractId: 'vesting-acceleration-cid',
    legacyDataField: 'vesting_acceleration_data',
    validData: () =>
      vestingAccelerationDataToDaml({
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'vesting-acceleration-1',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '12.50',
        reason_text: 'Change of control',
        comments: ['vesting accelerated'],
      }),
    expectedEvent: {
      object_type: 'TX_VESTING_ACCELERATION',
      id: 'vesting-acceleration-1',
      date: '2026-07-10',
      security_id: 'stock-security-1',
      quantity: '12.5',
      reason_text: 'Change of control',
      comments: ['vesting accelerated'],
    },
    invoke: async (client, readAs) =>
      getVestingAccelerationAsOcf(client, {
        contractId: 'vesting-acceleration-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'vestingTerms',
    contractId: 'vesting-terms-cid',
    validData: () =>
      vestingTermsDataToDaml({
        object_type: 'VESTING_TERMS',
        id: 'vesting-terms-1',
        name: 'Four year vesting',
        description: 'A representative schedule',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            portion: { numerator: '1', denominator: '4' },
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: ['monthly'],
          },
          {
            id: 'monthly',
            description: 'Monthly installments',
            quantity: '10.50',
            trigger: {
              type: 'VESTING_SCHEDULE_RELATIVE',
              relative_to_condition_id: 'start',
              period: {
                type: 'MONTHS',
                length: 1,
                occurrences: 36,
                day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
                cliff_installment: 1,
              },
            },
            next_condition_ids: [],
          },
        ],
        comments: ['board approved'],
      }),
    expectedEvent: {
      object_type: 'VESTING_TERMS',
      id: 'vesting-terms-1',
      name: 'Four year vesting',
      description: 'A representative schedule',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          portion: { numerator: '1', denominator: '4', remainder: false },
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['monthly'],
        },
        {
          id: 'monthly',
          description: 'Monthly installments',
          quantity: '10.5',
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE',
            relative_to_condition_id: 'start',
            period: {
              type: 'MONTHS',
              length: 1,
              occurrences: 36,
              day_of_month: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
              cliff_installment: 1,
            },
          },
          next_condition_ids: [],
        },
      ],
      comments: ['board approved'],
    },
    invoke: async (client, readAs) =>
      getVestingTermsAsOcf(client, {
        contractId: 'vesting-terms-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
];

interface MockContractOptions {
  readonly createArgument?: Record<string, unknown>;
  readonly packageName?: string;
  readonly templateId?: string;
}

function canonicalCreateArgument(testCase: VestingReaderCase, data: unknown): Record<string, unknown> {
  return {
    context: VALID_CONTEXT,
    [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
  };
}

function createMockClient(
  testCase: VestingReaderCase,
  data: unknown,
  options: MockContractOptions = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        ...(options.packageName !== undefined ? { packageName: options.packageName } : {}),
        createArgument: options.createArgument ?? canonicalCreateArgument(testCase, data),
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: VestingReaderCase, expectedPathFragment: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    source: `damlVestingCreateArgument.${testCase.entityType}`,
    context: {
      entityType: testCase.entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  const parseError = error as OcpParseError;
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(
    expectedPathFragment
  );
}

async function expectBoundaryFailure(
  result: Promise<unknown>,
  testCase: VestingReaderCase,
  decoderPath: string,
  messageFragment: string
): Promise<void> {
  try {
    await result;
    throw new Error(`Expected ${testCase.entityType} boundary to reject ${decoderPath}`);
  } catch (error) {
    expect(error).toBeInstanceOf(OcpParseError);
    const parseError = error as OcpParseError;
    expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
    if (parseError.source?.startsWith('contract ')) {
      expect(parseError.source).toContain('.eventsResponse.created.createdEvent.createArgument');
      return;
    }
    expect(parseError.source).toBe(`damlVestingCreateArgument.${testCase.entityType}`);
    expect(parseError.context?.decoderPath).toBe(decoderPath);
    expect(String(parseError.context?.decoderMessage)).toContain(messageFragment);
  }
}

function vestingTermsCase(): VestingReaderCase {
  const testCase = vestingReaderCases.find(({ entityType }) => entityType === 'vestingTerms');
  if (!testCase) throw new Error('Missing vestingTerms reader case');
  return testCase;
}

describe('decoder-backed vesting readers', () => {
  it.each(vestingReaderCases)(
    '$entityType returns the exact canonical event from its full wrapper',
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

  it.each(vestingReaderCases)('$entityType rejects a missing generated context', async (testCase) => {
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { [dataField]: testCase.validData() },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlVestingCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("key 'context' is required"),
      },
    });
  });

  it.each(vestingReaderCases)('$entityType rejects an inherited generated wrapper', async (testCase) => {
    const createArgument = Object.create(canonicalCreateArgument(testCase, testCase.validData())) as Record<
      string,
      unknown
    >;
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument });

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      'input.context',
      "key 'context' is inherited rather than an own property"
    );
  });

  it.each(vestingReaderCases)('$entityType rejects malformed generated context fields', async (testCase) => {
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: { issuer: 17, system_operator: VALID_CONTEXT.system_operator },
        [dataField]: testCase.validData(),
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlVestingCreateArgument.${testCase.entityType}`,
      context: {
        decoderPath: 'input.context.issuer',
        decoderMessage: 'expected a string, got a number',
      },
    });
  });

  it.each(vestingReaderCases)('$entityType rejects inherited generated context fields', async (testCase) => {
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: Object.create(VALID_CONTEXT) as Record<string, unknown>,
        [dataField]: testCase.validData(),
      },
    });

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      'input.context.issuer',
      "key 'issuer' is inherited rather than an own property"
    );
  });

  it.each(vestingReaderCases)('$entityType rejects inherited required payload fields', async (testCase) => {
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        context: VALID_CONTEXT,
        [dataField]: Object.create(testCase.validData()) as Record<string, unknown>,
      },
    });

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      `input.${dataField}.id`,
      "key 'id' is inherited rather than an own property"
    );
  });

  it.each(vestingReaderCases)('$entityType rejects malformed required payload fields', async (testCase) => {
    const data = { ...testCase.validData(), id: 17 };
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed id`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'id');
    }
  });

  it.each(vestingReaderCases)('$entityType preserves a schema-valid empty identifier', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), id: '' });

    await expect(testCase.invoke(client)).resolves.toMatchObject({
      event: { id: '' },
    });
  });

  it.each(vestingReaderCases)('$entityType preserves schema-valid empty comment elements', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: [''] });

    await expect(testCase.invoke(client)).resolves.toMatchObject({
      event: { comments: [''] },
    });
  });

  it.each(vestingReaderCases)('$entityType rejects fields discarded by the full generated codec', async (testCase) => {
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: {
        ...canonicalCreateArgument(testCase, testCase.validData()),
        unexpected_wrapper_field: true,
      },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlVestingCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.unexpected_wrapper_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });

    const { client: nestedClient } = createMockClient(testCase, {
      ...testCase.validData(),
      unexpected_payload_field: true,
    });
    await expect(testCase.invoke(nestedClient)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        decoderPath: `input.${dataField}.unexpected_payload_field`,
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(vestingReaderCases.filter(({ legacyDataField }) => legacyDataField !== undefined))(
    '$entityType rejects its legacy data-field alias',
    async (testCase) => {
      const { legacyDataField } = testCase;
      if (!legacyDataField) throw new Error(`Missing legacy field for ${testCase.entityType}`);
      const { client } = createMockClient(testCase, testCase.validData(), {
        createArgument: { context: VALID_CONTEXT, [legacyDataField]: testCase.validData() },
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `damlVestingCreateArgument.${testCase.entityType}`,
        context: {
          decoderPath: 'input',
          decoderMessage: expect.stringContaining(`key '${ENTITY_DATA_FIELD_MAP[testCase.entityType]}' is required`),
        },
      });
    }
  );

  it.each(vestingReaderCases.filter(({ legacyDataField }) => legacyDataField !== undefined))(
    '$entityType rejects a legacy alias even when canonical data is present',
    async (testCase) => {
      const { legacyDataField } = testCase;
      if (!legacyDataField) throw new Error(`Missing legacy field for ${testCase.entityType}`);
      const { client } = createMockClient(testCase, testCase.validData(), {
        createArgument: {
          ...canonicalCreateArgument(testCase, testCase.validData()),
          [legacyDataField]: testCase.validData(),
        },
      });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: {
          decoderPath: `input.${legacyDataField}`,
          decoderMessage: 'raw field was discarded by the generated codec',
        },
      });
    }
  );

  it.each(vestingReaderCases)('$entityType rejects sparse comments without dropping indexes', async (testCase) => {
    const comments = new Array<unknown>(2);
    comments[1] = 'second comment';
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments });
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      `input.${dataField}.comments[0]`,
      'list element is missing or inherited rather than an own property'
    );
  });

  it.each(vestingReaderCases)('$entityType rejects comments inherited through an array prototype', async (testCase) => {
    class InheritedComments extends Array<unknown> {}
    Object.defineProperty(InheritedComments.prototype, 0, {
      configurable: true,
      value: 'inherited comment',
    });
    const comments = new InheritedComments(1);
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments });
    const dataField = ENTITY_DATA_FIELD_MAP[testCase.entityType];

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      `input.${dataField}.comments`,
      'must use Array.prototype'
    );
  });

  it.each(vestingReaderCases.filter(({ entityType }) => entityType !== 'vestingTerms'))(
    '$entityType rejects a semantically invalid date after structural decoding',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

      await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
      await expect(testCase.invoke(client)).rejects.toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${
          testCase.entityType === 'vestingAcceleration'
            ? 'VestingAcceleration.createArgument.acceleration_data'
            : testCase.entityType === 'vestingEvent'
              ? 'VestingEvent.createArgument.vesting_data'
              : 'VestingStart.createArgument.vesting_data'
        }.date`,
      });
    }
  );

  it('vestingAcceleration rejects a semantically invalid numeric string after decoding', async () => {
    const testCase = vestingReaderCases.find(({ entityType }) => entityType === 'vestingAcceleration');
    if (!testCase) throw new Error('Missing vestingAcceleration reader case');
    const { client } = createMockClient(testCase, { ...testCase.validData(), quantity: '0.00000000001' });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'VestingAcceleration.createArgument.acceleration_data.quantity',
    });
  });

  it('vestingAcceleration rejects zero quantity on both write and read boundaries', async () => {
    expect(() =>
      vestingAccelerationDataToDaml({
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'vesting-acceleration-zero',
        date: '2026-07-10',
        security_id: 'stock-security-1',
        quantity: '0',
        reason_text: 'Invalid zero acceleration',
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'vestingAcceleration.quantity',
      })
    );

    const testCase = vestingReaderCases.find(({ entityType }) => entityType === 'vestingAcceleration');
    if (!testCase) throw new Error('Missing vestingAcceleration reader case');
    const { client } = createMockClient(testCase, { ...testCase.validData(), quantity: '0' });
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'VestingAcceleration.createArgument.acceleration_data.quantity',
    });
  });

  it('vestingTerms rejects unknown nested condition fields at their exact path', async () => {
    const testCase = vestingTermsCase();
    const data = testCase.validData();
    const conditions = data.vesting_conditions as Array<Record<string, unknown>>;
    const firstCondition = conditions[0];
    if (!firstCondition) throw new Error('Missing fixture condition');
    firstCondition.unexpected_condition_field = true;
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'damlVestingCreateArgument.vestingTerms',
      context: {
        decoderPath: 'input.vesting_terms_data.vesting_conditions[0].unexpected_condition_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it('vestingTerms rejects sparse nested condition-reference lists', async () => {
    const testCase = vestingTermsCase();
    const data = testCase.validData();
    const conditions = data.vesting_conditions as Array<Record<string, unknown>>;
    const firstCondition = conditions[0];
    if (!firstCondition) throw new Error('Missing fixture condition');
    const nextConditionIds = new Array<unknown>(2);
    nextConditionIds[1] = 'monthly';
    firstCondition.next_condition_ids = nextConditionIds;
    const { client } = createMockClient(testCase, data);

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      'input.vesting_terms_data.vesting_conditions[0].next_condition_ids[0]',
      'list element is missing or inherited rather than an own property'
    );
  });

  it('vestingTerms rejects inherited nested portion fields', async () => {
    const testCase = vestingTermsCase();
    const data = testCase.validData();
    const conditions = data.vesting_conditions as Array<Record<string, unknown>>;
    const firstCondition = conditions[0];
    if (!firstCondition) throw new Error('Missing fixture condition');
    firstCondition.portion = Object.create(firstCondition.portion as object) as Record<string, unknown>;
    const { client } = createMockClient(testCase, data);

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      'input.vesting_terms_data.vesting_conditions[0].portion.numerator',
      "key 'numerator' is inherited rather than an own property"
    );
  });

  it('vestingTerms rejects inherited nested relative-period fields', async () => {
    const testCase = vestingTermsCase();
    const data = testCase.validData();
    const conditions = data.vesting_conditions as Array<Record<string, unknown>>;
    const relativeCondition = conditions[1];
    const trigger = relativeCondition?.trigger as Record<string, unknown> | undefined;
    const triggerValue = trigger?.value as Record<string, unknown> | undefined;
    const period = triggerValue?.period as Record<string, unknown> | undefined;
    if (!period || !triggerValue) throw new Error('Missing fixture period');
    triggerValue.period = Object.create(period) as Record<string, unknown>;
    const { client } = createMockClient(testCase, data);

    await expectBoundaryFailure(
      testCase.invoke(client),
      testCase,
      'input.vesting_terms_data.vesting_conditions[1].trigger.value.period.tag',
      "key 'tag' is inherited rather than an own property"
    );
  });

  it.each(vestingReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
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

  it.each(vestingReaderCases)('$entityType rejects the right module on the wrong package line', async (testCase) => {
    const expectedTemplateId = ENTITY_TEMPLATE_ID_MAP[testCase.entityType];
    const wrongTemplateId = expectedTemplateId.replace(/^#[^:]+/, '#OpenCapTable-wrong');
    const { client } = createMockClient(testCase, testCase.validData(), {
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

  it.each(vestingReaderCases)(
    '$entityType rejects a hash-form template identity without packageName',
    async (testCase) => {
      const expectedTemplateId = ENTITY_TEMPLATE_ID_MAP[testCase.entityType];
      const hashTemplateId = expectedTemplateId.replace(/^#[^:]+/, '00deadbeef');
      const { client } = createMockClient(testCase, testCase.validData(), { templateId: hashTemplateId });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'missing_package_name',
        contractId: testCase.contractId,
        templateId: hashTemplateId,
        context: {
          expectedTemplateId,
          actualTemplateId: hashTemplateId,
        },
      });
    }
  );
});
