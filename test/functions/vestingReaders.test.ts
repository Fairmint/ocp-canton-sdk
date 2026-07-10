/** Direct ledger-reader contracts shared by the three OCF vesting transaction families. */

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
import type { OcfVestingAcceleration, OcfVestingEvent, OcfVestingStart } from '../../src/types/native';

type VestingEntityType = Extract<OcfEntityType, 'vestingAcceleration' | 'vestingEvent' | 'vestingStart'>;
type VestingTransaction = OcfVestingAcceleration | OcfVestingEvent | OcfVestingStart;

interface VestingReaderCase {
  readonly entityType: VestingEntityType;
  readonly contractId: string;
  readonly legacyDataField: string;
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: VestingTransaction;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: VestingTransaction; readonly contractId: string }>;
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
    invoke: async (client, readAs) => {
      const result = await getVestingStartAsOcf(client, {
        contractId: 'vesting-start-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      });
      return { event: result.vestingStart, contractId: result.contractId };
    },
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
    invoke: async (client, readAs) => {
      const result = await getVestingEventAsOcf(client, {
        contractId: 'vesting-event-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      });
      return { event: result.vestingEvent, contractId: result.contractId };
    },
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
    invoke: async (client, readAs) => {
      const result = await getVestingAccelerationAsOcf(client, {
        contractId: 'vesting-acceleration-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      });
      return { event: result.vestingAcceleration, contractId: result.contractId };
    },
  },
];

function createMockClient(
  testCase: VestingReaderCase,
  data: unknown,
  options: {
    readonly additionalDataFields?: Readonly<Record<string, unknown>>;
    readonly dataField?: string;
    readonly templateId?: string;
  } = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        createArgument: {
          ...options.additionalDataFields,
          [options.dataField ?? ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data,
        },
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: VestingReaderCase, field: string): void {
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

describe('decoder-backed vesting transaction readers', () => {
  it.each(vestingReaderCases)(
    '$entityType returns the exact canonical event from its canonical field',
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

  it.each(vestingReaderCases)(
    '$entityType preserves its registry-defined legacy data-field fallback',
    async (testCase) => {
      const { client } = createMockClient(testCase, testCase.validData(), { dataField: testCase.legacyDataField });

      await expect(testCase.invoke(client)).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(vestingReaderCases)('$entityType prefers canonical data when both wrappers are present', async (testCase) => {
    const canonicalData = testCase.validData();
    const legacyData = { ...testCase.validData(), id: `${testCase.entityType}-legacy-ignored` };
    const { client } = createMockClient(testCase, canonicalData, {
      additionalDataFields: { [testCase.legacyDataField]: legacyData },
    });

    await expect(testCase.invoke(client)).resolves.toEqual({
      event: testCase.expectedEvent,
      contractId: testCase.contractId,
    });
  });

  it.each(vestingReaderCases)(
    '$entityType fails closed when canonical data is malformed even if legacy data is valid',
    async (testCase) => {
      const malformedCanonicalData = { ...testCase.validData(), security_id: 17 };
      const { client } = createMockClient(testCase, malformedCanonicalData, {
        additionalDataFields: { [testCase.legacyDataField]: testCase.validData() },
      });

      try {
        await testCase.invoke(client);
        throw new Error(`Expected ${testCase.entityType} reader to reject malformed canonical data`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, 'security_id');
      }
    }
  );

  it.each(vestingReaderCases)('$entityType rejects malformed required fields', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), security_id: 17 });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed security_id`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'security_id');
    }
  });

  it.each(vestingReaderCases)('$entityType rejects a missing required comments list', async (testCase) => {
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

  it.each(vestingReaderCases)(
    '$entityType rejects null for the optional canonical comments property',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), comments: null });

      try {
        await testCase.invoke(client);
        throw new Error(`Expected ${testCase.entityType} reader to reject null comments`);
      } catch (error: unknown) {
        expectDecoderFailure(error, testCase, 'comments');
      }
    }
  );

  it.each(vestingReaderCases)('$entityType rejects malformed nested comment elements', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: ['valid', 17] });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(vestingReaderCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
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

  it.each(vestingReaderCases)(
    '$entityType rejects semantically invalid date strings after decoding',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'date',
      });
      await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    }
  );

  it('vestingAcceleration rejects a semantically invalid numeric string after decoding', async () => {
    const testCase = vestingReaderCases[2];
    if (!testCase) throw new Error('Missing vestingAcceleration reader case');
    const { client } = createMockClient(testCase, { ...testCase.validData(), quantity: '1e3' });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'numericString',
    });
  });

  it.each(vestingReaderCases)(
    '$entityType omits optional canonical comments when the DAML list is empty',
    async (testCase) => {
      const { client } = createMockClient(testCase, { ...testCase.validData(), comments: [] });

      const result = await testCase.invoke(client);
      expect(result.event.comments).toBeUndefined();
      expect('comments' in result.event).toBe(false);
    }
  );

  it.each(vestingReaderCases)('$entityType rejects non-object nested entity data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
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
});
