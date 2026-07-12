import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlVestingAccelerationToNative } from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import { getVestingAccelerationAsOcf } from '../../src/functions/OpenCapTable/vestingAcceleration/getVestingAccelerationAsOcf';
import { vestingAccelerationDataToDaml } from '../../src/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import { damlVestingEventToNative } from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import { getVestingEventAsOcf } from '../../src/functions/OpenCapTable/vestingEvent/getVestingEventAsOcf';
import { vestingEventDataToDaml } from '../../src/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import { damlVestingStartToNative } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import { getVestingStartAsOcf } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import {
  damlVestingTermsDataToNative,
  getVestingTermsAsOcf,
} from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

type VestingEntityType = Extract<
  OcfEntityType,
  'vestingAcceleration' | 'vestingEvent' | 'vestingStart' | 'vestingTerms'
>;

interface EmptyTextRoundTripCase {
  readonly entityType: VestingEntityType;
  readonly createDamlData: () => Record<string, unknown>;
  readonly direct: (damlData: Record<string, unknown>) => unknown;
  readonly ledger: (client: LedgerJsonApiClient) => Promise<unknown>;
  readonly expected: Readonly<Record<string, unknown>>;
}

const cases: readonly EmptyTextRoundTripCase[] = [
  {
    entityType: 'vestingStart',
    createDamlData: () =>
      vestingStartDataToDaml({
        object_type: 'TX_VESTING_START',
        id: '',
        date: '2026-07-10',
        security_id: '',
        vesting_condition_id: '',
        comments: [''],
      }),
    direct: (data) => damlVestingStartToNative(data as never),
    ledger: async (client) => (await getVestingStartAsOcf(client, { contractId: 'empty-text-contract' })).event,
    expected: {
      object_type: 'TX_VESTING_START',
      id: '',
      date: '2026-07-10',
      security_id: '',
      vesting_condition_id: '',
      comments: [''],
    },
  },
  {
    entityType: 'vestingEvent',
    createDamlData: () =>
      vestingEventDataToDaml({
        object_type: 'TX_VESTING_EVENT',
        id: '',
        date: '2026-07-10',
        security_id: '',
        vesting_condition_id: '',
        comments: [''],
      }),
    direct: (data) => damlVestingEventToNative(data as never),
    ledger: async (client) => (await getVestingEventAsOcf(client, { contractId: 'empty-text-contract' })).event,
    expected: {
      object_type: 'TX_VESTING_EVENT',
      id: '',
      date: '2026-07-10',
      security_id: '',
      vesting_condition_id: '',
      comments: [''],
    },
  },
  {
    entityType: 'vestingAcceleration',
    createDamlData: () =>
      vestingAccelerationDataToDaml({
        object_type: 'TX_VESTING_ACCELERATION',
        id: '',
        date: '2026-07-10',
        security_id: '',
        quantity: '1',
        reason_text: '',
        comments: [''],
      }),
    direct: (data) => damlVestingAccelerationToNative(data as never),
    ledger: async (client) => (await getVestingAccelerationAsOcf(client, { contractId: 'empty-text-contract' })).event,
    expected: {
      object_type: 'TX_VESTING_ACCELERATION',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity: '1',
      reason_text: '',
      comments: [''],
    },
  },
  {
    entityType: 'vestingTerms',
    createDamlData: () =>
      vestingTermsDataToDaml({
        object_type: 'VESTING_TERMS',
        id: '',
        name: '',
        description: '',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'condition',
            description: '',
            quantity: '1',
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
        comments: [''],
      }),
    direct: (data) => damlVestingTermsDataToNative(data as never),
    ledger: async (client) => (await getVestingTermsAsOcf(client, { contractId: 'empty-text-contract' })).event,
    expected: {
      object_type: 'VESTING_TERMS',
      id: '',
      name: '',
      description: '',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition',
          description: '',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
        },
      ],
      comments: [''],
    },
  },
];

const writerCases = [
  {
    entityType: 'vestingStart',
    input: {
      object_type: 'TX_VESTING_START',
      id: '',
      date: '2026-07-10',
      security_id: '',
      vesting_condition_id: '',
      comments: [''],
    },
    write: (input: unknown) => vestingStartDataToDaml(input as never),
  },
  {
    entityType: 'vestingEvent',
    input: {
      object_type: 'TX_VESTING_EVENT',
      id: '',
      date: '2026-07-10',
      security_id: '',
      vesting_condition_id: '',
      comments: [''],
    },
    write: (input: unknown) => vestingEventDataToDaml(input as never),
  },
  {
    entityType: 'vestingAcceleration',
    input: {
      object_type: 'TX_VESTING_ACCELERATION',
      id: '',
      date: '2026-07-10',
      security_id: '',
      quantity: '1',
      reason_text: '',
      comments: [''],
    },
    write: (input: unknown) => vestingAccelerationDataToDaml(input as never),
  },
  {
    entityType: 'vestingTerms',
    input: {
      object_type: 'VESTING_TERMS',
      id: '',
      name: '',
      description: '',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
        },
      ],
      comments: [''],
    },
    write: (input: unknown) => vestingTermsDataToDaml(input as never),
  },
] as const satisfies ReadonlyArray<{
  readonly entityType: VestingEntityType;
  readonly input: Readonly<Record<string, unknown>>;
  readonly write: (input: unknown) => unknown;
}>;

function wrapperFor(testCase: EmptyTextRoundTripCase, damlData: Record<string, unknown>): Record<string, unknown> {
  return {
    context: { issuer: 'issuer::party', system_operator: 'operator::party' },
    [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: damlData,
  };
}

function clientFor(testCase: EmptyTextRoundTripCase, createArgument: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: 'empty-text-contract',
          templateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          createArgument,
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('schema-valid empty vesting text roundtrips', () => {
  it.each(cases)('$entityType preserves empty text at every public boundary', async (testCase) => {
    const damlData = testCase.createDamlData();
    const wrapper = wrapperFor(testCase, damlData);

    expect(testCase.direct(damlData)).toEqual(testCase.expected);
    expect(convertToOcf(testCase.entityType, damlData as never)).toEqual(testCase.expected);
    expect(extractAndDecodeDamlEntityData(testCase.entityType, wrapper)).toEqual(damlData);
    await expect(testCase.ledger(clientFor(testCase, wrapper))).resolves.toEqual(testCase.expected);
  });

  it.each(writerCases)('$entityType requires its exact object_type on direct and dispatcher writes', (testCase) => {
    const missing: Record<string, unknown> = { ...testCase.input };
    delete missing.object_type;
    const wrong = { ...testCase.input, object_type: 'TX_STOCK_CANCELLATION' };

    for (const write of [testCase.write, (input: unknown) => convertToDaml(testCase.entityType, input as never)]) {
      expect(() => write(missing)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `${testCase.entityType}.object_type`,
        })
      );
      expect(() => write(wrong)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: `${testCase.entityType}.object_type`,
        })
      );
    }
  });
});
