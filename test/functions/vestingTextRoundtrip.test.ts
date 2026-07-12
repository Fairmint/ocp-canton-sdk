import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlVestingAccelerationToNative } from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import { vestingAccelerationDataToDaml } from '../../src/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import { damlVestingEventToNative } from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import { vestingEventDataToDaml } from '../../src/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import { damlVestingStartToNative } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

type VestingEntityType = Extract<
  OcfEntityType,
  'vestingAcceleration' | 'vestingEvent' | 'vestingStart' | 'vestingTerms'
>;

interface VestingTextCase {
  readonly entityType: VestingEntityType;
  readonly validOcf: Readonly<Record<string, unknown>>;
  readonly write: (value: unknown) => Record<string, unknown>;
  readonly read: (value: unknown) => unknown;
  readonly mutations: ReadonlyArray<{
    readonly fieldPath: string;
    readonly mutate: (value: Record<string, unknown>) => void;
  }>;
}

const cases: readonly VestingTextCase[] = [
  {
    entityType: 'vestingStart',
    validOcf: {
      object_type: 'TX_VESTING_START',
      id: 'start',
      date: '2026-07-10',
      security_id: 'security',
      vesting_condition_id: 'condition',
      comments: ['started'],
    },
    write: (value) => vestingStartDataToDaml(value as never),
    read: (value) => damlVestingStartToNative(value as never),
    mutations: [
      { fieldPath: 'vestingStart.id', mutate: (value) => void (value.id = '') },
      { fieldPath: 'vestingStart.security_id', mutate: (value) => void (value.security_id = '') },
      {
        fieldPath: 'vestingStart.vesting_condition_id',
        mutate: (value) => void (value.vesting_condition_id = ''),
      },
      {
        fieldPath: 'vestingStart.comments[0]',
        mutate: (value) => void ((value.comments as string[])[0] = ''),
      },
    ],
  },
  {
    entityType: 'vestingEvent',
    validOcf: {
      object_type: 'TX_VESTING_EVENT',
      id: 'event',
      date: '2026-07-10',
      security_id: 'security',
      vesting_condition_id: 'condition',
      comments: ['met'],
    },
    write: (value) => vestingEventDataToDaml(value as never),
    read: (value) => damlVestingEventToNative(value as never),
    mutations: [
      { fieldPath: 'vestingEvent.id', mutate: (value) => void (value.id = '') },
      { fieldPath: 'vestingEvent.security_id', mutate: (value) => void (value.security_id = '') },
      {
        fieldPath: 'vestingEvent.vesting_condition_id',
        mutate: (value) => void (value.vesting_condition_id = ''),
      },
      {
        fieldPath: 'vestingEvent.comments[0]',
        mutate: (value) => void ((value.comments as string[])[0] = ''),
      },
    ],
  },
  {
    entityType: 'vestingAcceleration',
    validOcf: {
      object_type: 'TX_VESTING_ACCELERATION',
      id: 'acceleration',
      date: '2026-07-10',
      security_id: 'security',
      quantity: '1',
      reason_text: 'change of control',
      comments: ['approved'],
    },
    write: (value) => vestingAccelerationDataToDaml(value as never),
    read: (value) => damlVestingAccelerationToNative(value as never),
    mutations: [
      { fieldPath: 'vestingAcceleration.id', mutate: (value) => void (value.id = '') },
      { fieldPath: 'vestingAcceleration.security_id', mutate: (value) => void (value.security_id = '') },
      { fieldPath: 'vestingAcceleration.reason_text', mutate: (value) => void (value.reason_text = '') },
      {
        fieldPath: 'vestingAcceleration.comments[0]',
        mutate: (value) => void ((value.comments as string[])[0] = ''),
      },
    ],
  },
  {
    entityType: 'vestingTerms',
    validOcf: {
      object_type: 'VESTING_TERMS',
      id: 'terms',
      name: 'Standard vesting',
      description: 'Four year schedule',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition',
          description: 'Initial condition',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
        },
      ],
      comments: ['approved'],
    },
    write: (value) => vestingTermsDataToDaml(value as never),
    read: (value) => damlVestingTermsDataToNative(value as never),
    mutations: [
      { fieldPath: 'vestingTerms.id', mutate: (value) => void (value.id = '') },
      { fieldPath: 'vestingTerms.name', mutate: (value) => void (value.name = '') },
      { fieldPath: 'vestingTerms.description', mutate: (value) => void (value.description = '') },
      {
        fieldPath: 'vestingTerms.comments[0]',
        mutate: (value) => void ((value.comments as string[])[0] = ''),
      },
      {
        fieldPath: 'vestingTerms.vesting_conditions[0].id',
        mutate: (value) => void ((value.vesting_conditions as Array<Record<string, unknown>>)[0]!.id = ''),
      },
      {
        fieldPath: 'vestingTerms.vesting_conditions[0].description',
        mutate: (value) => void ((value.vesting_conditions as Array<Record<string, unknown>>)[0]!.description = ''),
      },
    ],
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('pinned DAML vesting Text invariants', () => {
  it.each(cases)('$entityType rejects every present empty Text on direct and dispatcher writes', (testCase) => {
    for (const mutation of testCase.mutations) {
      const invalid: Record<string, unknown> = { ...clone(testCase.validOcf) };
      mutation.mutate(invalid);

      for (const write of [testCase.write, (value: unknown) => convertToDaml(testCase.entityType, value as never)]) {
        expect(() => write(invalid)).toThrow(
          expect.objectContaining({
            name: OcpValidationError.name,
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: mutation.fieldPath,
          })
        );
      }
    }
  });

  it.each(cases)('$entityType rejects every present empty Text on direct and dispatcher reads', (testCase) => {
    const validDaml = testCase.write(testCase.validOcf);
    for (const mutation of testCase.mutations) {
      const invalid = clone(validDaml);
      mutation.mutate(invalid);

      for (const read of [testCase.read, (value: unknown) => convertToOcf(testCase.entityType, value as never)]) {
        expect(() => read(invalid)).toThrow(
          expect.objectContaining({
            name: OcpParseError.name,
            code: OcpErrorCodes.INVALID_FORMAT,
            source: mutation.fieldPath,
          })
        );
      }
    }
  });

  it.each(cases)('$entityType still accepts an omitted comments property and emits an empty DAML list', (testCase) => {
    const withoutComments: Record<string, unknown> = { ...clone(testCase.validOcf) };
    delete withoutComments.comments;
    expect(testCase.write(withoutComments)).toMatchObject({ comments: [] });
  });
});
