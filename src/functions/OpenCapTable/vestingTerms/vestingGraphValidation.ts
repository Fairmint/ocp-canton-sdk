import type { VestingCondition } from '../../../types/native';

export interface VestingGraphIssue {
  readonly fieldPath: string;
  readonly message: string;
  readonly expectedType: string;
  readonly receivedValue: string;
  readonly context: Readonly<Record<string, string | number>>;
}

function getArrayItem<T>(values: readonly T[], index: number): T | undefined {
  return index >= 0 && index < values.length ? values[index] : undefined;
}

/**
 * Find the first integrity error in an otherwise shape-valid vesting graph.
 *
 * OCF models `next_condition_ids` as directed graph edges and requires condition
 * IDs to identify nodes within the containing VestingTerms object. Its vesting
 * explainer specifies that these graphs are acyclic. Relative triggers may point
 * to any other existing condition, so they are checked for referential integrity but
 * are not treated as graph edges.
 */
export function findVestingGraphIssue(conditions: readonly VestingCondition[]): VestingGraphIssue | undefined {
  const conditionEntries = new Map<string, { readonly condition: VestingCondition; readonly index: number }>();

  for (const [index, condition] of conditions.entries()) {
    const firstEntry = conditionEntries.get(condition.id);
    if (firstEntry !== undefined) {
      return {
        fieldPath: `vestingTerms.vesting_conditions[${index}].id`,
        message: 'Vesting condition IDs must be unique within vesting terms',
        expectedType: 'unique vesting condition ID',
        receivedValue: condition.id,
        context: { firstIndex: firstEntry.index },
      };
    }
    conditionEntries.set(condition.id, { condition, index });
  }

  for (const [conditionIndex, condition] of conditions.entries()) {
    for (const [nextIndex, nextConditionId] of condition.next_condition_ids.entries()) {
      if (!conditionEntries.has(nextConditionId)) {
        return {
          fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].next_condition_ids[${nextIndex}]`,
          message: 'next_condition_ids must reference a condition in the same vesting terms',
          expectedType: 'existing vesting condition ID',
          receivedValue: nextConditionId,
          context: { conditionId: condition.id },
        };
      }
    }

    if (
      condition.trigger.type === 'VESTING_SCHEDULE_RELATIVE' &&
      condition.trigger.relative_to_condition_id === condition.id
    ) {
      return {
        fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].trigger.relative_to_condition_id`,
        message: 'relative_to_condition_id must reference a different condition in the same vesting terms',
        expectedType: 'existing vesting condition ID different from the current condition',
        receivedValue: condition.trigger.relative_to_condition_id,
        context: { conditionId: condition.id },
      };
    }

    if (
      condition.trigger.type === 'VESTING_SCHEDULE_RELATIVE' &&
      !conditionEntries.has(condition.trigger.relative_to_condition_id)
    ) {
      return {
        fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].trigger.relative_to_condition_id`,
        message: 'relative_to_condition_id must reference a condition in the same vesting terms',
        expectedType: 'existing vesting condition ID',
        receivedValue: condition.trigger.relative_to_condition_id,
        context: { conditionId: condition.id },
      };
    }
  }

  // Iterative depth-first traversal avoids recursive stack growth for large but
  // otherwise JSON-safe condition arrays. A gray-to-gray edge is a cycle.
  const state = new Map<string, 'visiting' | 'visited'>();
  for (const condition of conditions) {
    if (state.has(condition.id)) continue;
    state.set(condition.id, 'visiting');
    const stack: Array<{ conditionId: string; nextIndex: number }> = [{ conditionId: condition.id, nextIndex: 0 }];

    while (stack.length > 0) {
      const frame = getArrayItem(stack, stack.length - 1);
      if (frame === undefined) break;
      const currentEntry = conditionEntries.get(frame.conditionId);
      if (currentEntry === undefined) break;
      const { condition: current, index: conditionIndex } = currentEntry;

      if (frame.nextIndex >= current.next_condition_ids.length) {
        state.set(frame.conditionId, 'visited');
        stack.pop();
        continue;
      }

      const { nextIndex } = frame;
      frame.nextIndex += 1;
      const nextConditionId = getArrayItem(current.next_condition_ids, nextIndex);
      if (nextConditionId === undefined) continue;
      const nextState = state.get(nextConditionId);
      if (nextState === 'visiting') {
        return {
          fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].next_condition_ids[${nextIndex}]`,
          message: 'Vesting condition graph must be acyclic',
          expectedType: 'edge to a condition outside the active traversal path',
          receivedValue: nextConditionId,
          context: { conditionId: current.id, targetConditionId: nextConditionId },
        };
      }
      if (nextState === undefined) {
        state.set(nextConditionId, 'visiting');
        stack.push({ conditionId: nextConditionId, nextIndex: 0 });
      }
    }
  }

  return undefined;
}
