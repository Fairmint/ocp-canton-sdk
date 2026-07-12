import { damlVestingAccelerationToNative } from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import { vestingAccelerationDataToDaml } from '../../src/functions/OpenCapTable/vestingAcceleration/vestingAccelerationDataToDaml';
import { damlVestingEventToNative } from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import { vestingEventDataToDaml } from '../../src/functions/OpenCapTable/vestingEvent/vestingEventDataToDaml';
import { damlVestingStartToNative } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

describe('vesting conversion ownership', () => {
  it.each([
    {
      name: 'vestingStart',
      input: {
        object_type: 'TX_VESTING_START',
        id: 'start',
        date: '2026-07-10',
        security_id: 'security',
        vesting_condition_id: 'condition',
        comments: ['original'],
      },
      write: vestingStartDataToDaml,
      read: damlVestingStartToNative,
    },
    {
      name: 'vestingEvent',
      input: {
        object_type: 'TX_VESTING_EVENT',
        id: 'event',
        date: '2026-07-10',
        security_id: 'security',
        vesting_condition_id: 'condition',
        comments: ['original'],
      },
      write: vestingEventDataToDaml,
      read: damlVestingEventToNative,
    },
    {
      name: 'vestingAcceleration',
      input: {
        object_type: 'TX_VESTING_ACCELERATION',
        id: 'acceleration',
        date: '2026-07-10',
        security_id: 'security',
        quantity: '1',
        reason_text: 'reason',
        comments: ['original'],
      },
      write: vestingAccelerationDataToDaml,
      read: damlVestingAccelerationToNative,
    },
  ] as const)('$name readers and writers own their comments arrays', (testCase) => {
    const input = JSON.parse(JSON.stringify(testCase.input)) as typeof testCase.input;
    const written = testCase.write(input as never);
    expect(written.comments).not.toBe(input.comments);
    (input.comments as unknown as string[])[0] = 'mutated input';
    expect(written.comments).toEqual(['original']);

    const read = testCase.read(written as never);
    expect(read.comments).not.toBe(written.comments);
    written.comments[0] = 'mutated DAML';
    expect(read.comments).toEqual(['original']);
    if (read.comments === undefined) throw new Error('Expected comments fixture');
    read.comments[0] = 'mutated result';
    expect(written.comments).toEqual(['mutated DAML']);
  });

  it('VestingTerms owns comments, conditions, and next-condition arrays on both boundaries', () => {
    const input = {
      object_type: 'VESTING_TERMS' as const,
      id: 'terms',
      name: 'Terms',
      description: 'Ownership fixture',
      allocation_type: 'CUMULATIVE_ROUNDING' as const,
      vesting_conditions: [
        {
          id: 'first',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' as const },
          next_condition_ids: ['second'],
        },
        {
          id: 'second',
          quantity: '1',
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE' as const,
            relative_to_condition_id: 'first',
            period: { type: 'DAYS' as const, length: 1, occurrences: 1 },
          },
          next_condition_ids: [],
        },
      ] as const,
      comments: ['original'],
    };

    const written = vestingTermsDataToDaml(input as never);
    expect(written.comments).not.toBe(input.comments);
    expect(written.vesting_conditions).not.toBe(input.vesting_conditions);
    expect(written.vesting_conditions[0]?.next_condition_ids).not.toBe(input.vesting_conditions[0].next_condition_ids);

    const read = damlVestingTermsDataToNative(written);
    expect(read.comments).not.toBe(written.comments);
    expect(read.vesting_conditions).not.toBe(written.vesting_conditions);
    expect(read.vesting_conditions[0].next_condition_ids).not.toBe(written.vesting_conditions[0]!.next_condition_ids);

    written.comments[0] = 'mutated DAML';
    written.vesting_conditions[0]!.next_condition_ids[0] = 'mutated-reference';
    expect(read.comments).toEqual(['original']);
    expect(read.vesting_conditions[0].next_condition_ids).toEqual(['second']);
  });
});
