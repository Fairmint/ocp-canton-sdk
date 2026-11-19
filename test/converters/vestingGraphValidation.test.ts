import { findVestingGraphIssue } from '../../src/functions/OpenCapTable/vestingTerms/vestingGraphValidation';
import type { VestingCondition } from '../../src/types/native';

const period = { type: 'DAYS', length: 1, occurrences: 1, day_of_month: '01' } as never;

function condition(id: string, next: string[], relativeTo?: string): VestingCondition {
  return {
    id,
    next_condition_ids: next,
    trigger:
      relativeTo === undefined
        ? { type: 'VESTING_START_DATE' }
        : { type: 'VESTING_SCHEDULE_RELATIVE', period, relative_to_condition_id: relativeTo },
  } as unknown as VestingCondition;
}

describe('findVestingGraphIssue cycle errors', () => {
  it('names the source, target and next_condition_ids path for a cycle closing on a next edge', () => {
    const issue = findVestingGraphIssue([condition('a', ['b']), condition('b', ['a'])]);
    expect(issue).toMatchObject({
      fieldPath: 'vestingTerms.vesting_conditions[1].next_condition_ids[0]',
      message: 'Vesting condition graph must be acyclic',
      receivedValue: 'a',
      context: { conditionId: 'b', targetConditionId: 'a' },
    });
  });

  it('reports the referenced id and the referencing condition when the cycle closes on a relative trigger', () => {
    // a -> b by next_condition_ids; a waits on b by relative_to_condition_id (edge b -> a), closing the cycle.
    const issue = findVestingGraphIssue([condition('a', ['b'], 'b'), condition('b', [])]);
    expect(issue).toMatchObject({
      fieldPath: 'vestingTerms.vesting_conditions[0].trigger.relative_to_condition_id',
      message: 'Vesting condition graph must be acyclic',
      receivedValue: 'b',
      context: { conditionId: 'a', targetConditionId: 'b' },
    });
  });
});
