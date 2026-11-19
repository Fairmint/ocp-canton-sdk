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
 * IDs to identify nodes within the containing VestingTerms object. The checks are
 * the ones the OpenCapTable register makes (`validateOcfVestingConditionGraph`):
 * unique IDs, references to conditions that exist, no relative trigger on itself,
 * and no cycle once each relative trigger is an edge from its target. The vesting
 * explainer's prose that a relative target "has already been met" is not a schema
 * rule, so a target outside the `next_condition_ids` ancestry is accepted.
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

  // The register's graph (OpenCapTable validateOcfVestingConditionGraph) has an edge for every next_condition_ids
  // entry and one from each relative trigger's target to the condition that waits on it, and must be acyclic. OCF's
  // schema sets nothing more: a relative trigger may name a sibling or an unrelated condition, so that is accepted.
  const edges = new Map<
    string,
    Array<{
      /** The node the traversal moves to. */
      readonly targetId: string;
      readonly fieldPath: string;
      /** The condition whose field holds the reference, and the id that field names (the reference's own direction). */
      readonly referencingId: string;
      readonly referencedId: string;
    }>
  >();
  for (const [conditionIndex, condition] of conditions.entries()) {
    const outgoing = edges.get(condition.id) ?? [];
    edges.set(condition.id, outgoing);
    for (const [nextIndex, nextConditionId] of condition.next_condition_ids.entries()) {
      outgoing.push({
        targetId: nextConditionId,
        fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].next_condition_ids[${nextIndex}]`,
        referencingId: condition.id,
        referencedId: nextConditionId,
      });
    }
  }
  for (const [conditionIndex, condition] of conditions.entries()) {
    if (condition.trigger.type !== 'VESTING_SCHEDULE_RELATIVE') continue;
    edges.get(condition.trigger.relative_to_condition_id)?.push({
      targetId: condition.id,
      fieldPath: `vestingTerms.vesting_conditions[${conditionIndex}].trigger.relative_to_condition_id`,
      referencingId: condition.id,
      referencedId: condition.trigger.relative_to_condition_id,
    });
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
      const outgoing = edges.get(frame.conditionId) ?? [];

      if (frame.nextIndex >= outgoing.length) {
        state.set(frame.conditionId, 'visited');
        stack.pop();
        continue;
      }

      const edge = getArrayItem(outgoing, frame.nextIndex);
      frame.nextIndex += 1;
      if (edge === undefined) continue;
      const nextState = state.get(edge.targetId);
      if (nextState === 'visiting') {
        return {
          fieldPath: edge.fieldPath,
          message: 'Vesting condition graph must be acyclic',
          expectedType: 'edge to a condition outside the active traversal path',
          receivedValue: edge.referencedId,
          context: { conditionId: edge.referencingId, targetConditionId: edge.referencedId },
        };
      }
      if (nextState === undefined) {
        state.set(edge.targetId, 'visiting');
        stack.push({ conditionId: edge.targetId, nextIndex: 0 });
      }
    }
  }

  return undefined;
}
