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
 * explainer specifies that these graphs are acyclic and that relative triggers
 * refer to a prior condition that has already been met. A relative target must
 * therefore be a strict ancestor in the `next_condition_ids` DAG.
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
        context: {
          conditionId: condition.id,
          targetConditionId: condition.trigger.relative_to_condition_id,
          referenceRelation: 'self',
        },
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
        context: {
          conditionId: condition.id,
          targetConditionId: condition.trigger.relative_to_condition_id,
          referenceRelation: 'dangling',
        },
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

  const predecessors = new Map<string, string[]>();
  for (const condition of conditions) {
    predecessors.set(condition.id, []);
  }
  for (const condition of conditions) {
    for (const nextConditionId of condition.next_condition_ids) {
      predecessors.get(nextConditionId)?.push(condition.id);
    }
  }

  const isStrictAncestor = (ancestorId: string, conditionId: string): boolean => {
    const visited = new Set<string>();
    const pending = [...(predecessors.get(conditionId) ?? [])];
    while (pending.length > 0) {
      const predecessorId = pending.pop();
      if (predecessorId === undefined || visited.has(predecessorId)) continue;
      if (predecessorId === ancestorId) return true;
      visited.add(predecessorId);
      pending.push(...(predecessors.get(predecessorId) ?? []));
    }
    return false;
  };

  const shareStrictAncestor = (leftConditionId: string, rightConditionId: string): boolean => {
    const leftAncestors = new Set<string>();
    const leftPending = [...(predecessors.get(leftConditionId) ?? [])];
    while (leftPending.length > 0) {
      const predecessorId = leftPending.pop();
      if (predecessorId === undefined || leftAncestors.has(predecessorId)) continue;
      leftAncestors.add(predecessorId);
      leftPending.push(...(predecessors.get(predecessorId) ?? []));
    }

    const rightVisited = new Set<string>();
    const rightPending = [...(predecessors.get(rightConditionId) ?? [])];
    while (rightPending.length > 0) {
      const predecessorId = rightPending.pop();
      if (predecessorId === undefined || rightVisited.has(predecessorId)) continue;
      if (leftAncestors.has(predecessorId)) return true;
      rightVisited.add(predecessorId);
      rightPending.push(...(predecessors.get(predecessorId) ?? []));
    }
    return false;
  };

  for (const [conditionIndex, condition] of conditions.entries()) {
    if (condition.trigger.type !== 'VESTING_SCHEDULE_RELATIVE') continue;
    const targetConditionId = condition.trigger.relative_to_condition_id;
    if (isStrictAncestor(targetConditionId, condition.id)) continue;

    const relation = isStrictAncestor(condition.id, targetConditionId)
      ? 'descendant'
      : shareStrictAncestor(condition.id, targetConditionId)
        ? 'sibling'
        : 'unreachable';
    return {
      fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].trigger.relative_to_condition_id`,
      message: 'relative_to_condition_id must reference a strict ancestor that has already been met',
      expectedType: 'strict ancestor vesting condition ID',
      receivedValue: targetConditionId,
      context: { conditionId: condition.id, targetConditionId, referenceRelation: relation },
    };
  }

  return undefined;
}
