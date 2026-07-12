import type { VestingCondition } from '../../../types/native';

export interface VestingGraphIssue {
  readonly fieldPath: string;
  readonly message: string;
  readonly expectedType: string;
  readonly receivedValue: string;
  readonly context: Readonly<Record<string, string | number>>;
}

interface GraphEdge {
  readonly fieldPath: string;
  readonly targetId: string;
  readonly targetIndex: number;
}

interface RelativeQuery {
  readonly conditionId: string;
  readonly conditionIndex: number;
  readonly fieldPath: string;
  readonly targetId: string;
  readonly targetIndex: number;
}

function conditionPath(index: number): string {
  return `vestingTerms.vesting_conditions[${index}]`;
}

function cycleIssue(edge: GraphEdge, conditionId: string): VestingGraphIssue {
  return {
    fieldPath: edge.fieldPath,
    message: 'Vesting condition graph must be acyclic',
    expectedType: 'edge to a condition outside the active traversal path',
    receivedValue: edge.targetId,
    context: { conditionId, targetConditionId: edge.targetId },
  };
}

function markReachable(
  startIndex: number,
  edgesByIndex: ReadonlyArray<readonly GraphEdge[]>,
  marks: Int32Array,
  mark: number,
  stopIndexes?: ReadonlySet<number>
): void {
  let remainingStops = stopIndexes?.size ?? 0;
  const pending = [startIndex];
  marks[startIndex] = mark;
  while (pending.length > 0) {
    const index = pending.pop();
    if (index === undefined) break;
    if (stopIndexes?.has(index) === true) {
      remainingStops -= 1;
      if (remainingStops === 0) return;
    }
    for (const edge of edgesByIndex[index] ?? []) {
      if (marks[edge.targetIndex] === mark) continue;
      marks[edge.targetIndex] = mark;
      pending.push(edge.targetIndex);
    }
  }
}

function hasSharedStrictAncestor(
  leftIndex: number,
  rightIndex: number,
  predecessorsByIndex: ReadonlyArray<readonly number[]>,
  leftMarks: Int32Array,
  rightMarks: Int32Array
): boolean {
  const leftPending = [...(predecessorsByIndex[leftIndex] ?? [])];
  while (leftPending.length > 0) {
    const index = leftPending.pop();
    if (index === undefined || leftMarks[index] === 1) continue;
    leftMarks[index] = 1;
    leftPending.push(...(predecessorsByIndex[index] ?? []));
  }

  const rightPending = [...(predecessorsByIndex[rightIndex] ?? [])];
  while (rightPending.length > 0) {
    const index = rightPending.pop();
    if (index === undefined || rightMarks[index] === 1) continue;
    if (leftMarks[index] === 1) return true;
    rightMarks[index] = 1;
    rightPending.push(...(predecessorsByIndex[index] ?? []));
  }
  return false;
}

/**
 * Find the first integrity error in an otherwise shape-valid vesting graph.
 *
 * Node/edge validation and cycle detection are deterministic iterative O(V+E)
 * traversals. Relative-ancestor reachability is exact and grouped by referenced
 * target, so many far references to the same ancestor cost one traversal. Each
 * grouped traversal stops as soon as all queried descendants are reached, so
 * local references do not scan unrelated suffixes. The general DAG case is
 * still O(V+E + U(V+E)), where U is the number of distinct non-direct relative
 * targets; exact arbitrary DAG reachability cannot be represented by a single
 * DFS interval.
 */
export function findVestingGraphIssue(conditions: readonly VestingCondition[]): VestingGraphIssue | undefined {
  const indexById = new Map<string, number>();
  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    if (condition === undefined) continue;
    const firstIndex = indexById.get(condition.id);
    if (firstIndex !== undefined) {
      return {
        fieldPath: `${conditionPath(index)}.id`,
        message: 'Vesting condition IDs must be unique within vesting terms',
        expectedType: 'unique vesting condition ID',
        receivedValue: condition.id,
        context: { firstIndex },
      };
    }
    indexById.set(condition.id, index);
  }

  const edgesByIndex: GraphEdge[][] = Array.from({ length: conditions.length }, () => []);
  const directTargetsByIndex: Array<Set<number>> = Array.from({ length: conditions.length }, () => new Set<number>());
  const predecessorsByIndex: number[][] = Array.from({ length: conditions.length }, () => []);
  const relativeQueries: RelativeQuery[] = [];

  for (let conditionIndex = 0; conditionIndex < conditions.length; conditionIndex += 1) {
    const condition = conditions[conditionIndex];
    if (condition === undefined) continue;
    const seenTargets = new Map<string, number>();
    for (let edgeIndex = 0; edgeIndex < condition.next_condition_ids.length; edgeIndex += 1) {
      const targetId = condition.next_condition_ids[edgeIndex];
      if (targetId === undefined) continue;
      const fieldPath = `${conditionPath(conditionIndex)}.next_condition_ids[${edgeIndex}]`;
      const firstEdgeIndex = seenTargets.get(targetId);
      if (firstEdgeIndex !== undefined) {
        return {
          fieldPath,
          message: 'next_condition_ids must not contain duplicate references',
          expectedType: 'unique vesting condition reference',
          receivedValue: targetId,
          context: { conditionId: condition.id, firstEdgeIndex },
        };
      }
      seenTargets.set(targetId, edgeIndex);

      const targetIndex = indexById.get(targetId);
      if (targetIndex === undefined) {
        return {
          fieldPath,
          message: 'next_condition_ids must reference a condition in the same vesting terms',
          expectedType: 'existing vesting condition ID',
          receivedValue: targetId,
          context: { conditionId: condition.id },
        };
      }
      edgesByIndex[conditionIndex]?.push({ fieldPath, targetId, targetIndex });
      directTargetsByIndex[conditionIndex]?.add(targetIndex);
      predecessorsByIndex[targetIndex]?.push(conditionIndex);
    }

    if (condition.trigger.type !== 'VESTING_SCHEDULE_RELATIVE') continue;
    const targetId = condition.trigger.relative_to_condition_id;
    const fieldPath = `${conditionPath(conditionIndex)}.trigger.relative_to_condition_id`;
    const targetIndex = indexById.get(targetId);
    if (targetIndex === conditionIndex) {
      return {
        fieldPath,
        message: 'relative_to_condition_id must reference a different condition in the same vesting terms',
        expectedType: 'existing vesting condition ID different from the current condition',
        receivedValue: targetId,
        context: { conditionId: condition.id, targetConditionId: targetId, referenceRelation: 'self' },
      };
    }
    if (targetIndex === undefined) {
      return {
        fieldPath,
        message: 'relative_to_condition_id must reference a condition in the same vesting terms',
        expectedType: 'existing vesting condition ID',
        receivedValue: targetId,
        context: { conditionId: condition.id, targetConditionId: targetId, referenceRelation: 'dangling' },
      };
    }
    relativeQueries.push({ conditionId: condition.id, conditionIndex, fieldPath, targetId, targetIndex });
  }

  const state = new Uint8Array(conditions.length);
  for (let startIndex = 0; startIndex < conditions.length; startIndex += 1) {
    if (state[startIndex] !== 0) continue;
    state[startIndex] = 1;
    const stack: Array<{ readonly nodeIndex: number; nextEdgeIndex: number }> = [
      { nodeIndex: startIndex, nextEdgeIndex: 0 },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;
      const edges = edgesByIndex[frame.nodeIndex] ?? [];
      const edge = edges[frame.nextEdgeIndex];
      if (edge === undefined) {
        state[frame.nodeIndex] = 2;
        stack.pop();
        continue;
      }
      frame.nextEdgeIndex += 1;
      if (state[edge.targetIndex] === 1) {
        return cycleIssue(edge, conditions[frame.nodeIndex]?.id ?? '');
      }
      if (state[edge.targetIndex] === 0) {
        state[edge.targetIndex] = 1;
        stack.push({ nodeIndex: edge.targetIndex, nextEdgeIndex: 0 });
      }
    }
  }

  const reachable = new Array<boolean>(relativeQueries.length).fill(false);
  const queriesByTarget = new Map<number, number[]>();
  for (let queryIndex = 0; queryIndex < relativeQueries.length; queryIndex += 1) {
    const query = relativeQueries[queryIndex];
    if (query === undefined) continue;
    if (directTargetsByIndex[query.targetIndex]?.has(query.conditionIndex) === true) {
      reachable[queryIndex] = true;
      continue;
    }
    const grouped = queriesByTarget.get(query.targetIndex);
    if (grouped === undefined) queriesByTarget.set(query.targetIndex, [queryIndex]);
    else grouped.push(queryIndex);
  }

  const reachabilityMarks = new Int32Array(conditions.length);
  let mark = 0;
  for (const [targetIndex, queryIndexes] of queriesByTarget) {
    mark += 1;
    const stopIndexes = new Set<number>();
    for (const queryIndex of queryIndexes) {
      const query = relativeQueries[queryIndex];
      if (query !== undefined) stopIndexes.add(query.conditionIndex);
    }
    markReachable(targetIndex, edgesByIndex, reachabilityMarks, mark, stopIndexes);
    for (const queryIndex of queryIndexes) {
      const query = relativeQueries[queryIndex];
      if (query !== undefined) reachable[queryIndex] = reachabilityMarks[query.conditionIndex] === mark;
    }
  }

  for (let queryIndex = 0; queryIndex < relativeQueries.length; queryIndex += 1) {
    if (reachable[queryIndex]) continue;
    const query = relativeQueries[queryIndex];
    if (query === undefined) continue;

    mark += 1;
    markReachable(query.conditionIndex, edgesByIndex, reachabilityMarks, mark);
    const relation =
      reachabilityMarks[query.targetIndex] === mark
        ? 'descendant'
        : hasSharedStrictAncestor(
              query.conditionIndex,
              query.targetIndex,
              predecessorsByIndex,
              new Int32Array(conditions.length),
              new Int32Array(conditions.length)
            )
          ? 'sibling'
          : 'unreachable';
    return {
      fieldPath: query.fieldPath,
      message: 'relative_to_condition_id must reference a strict ancestor that has already been met',
      expectedType: 'strict ancestor vesting condition ID',
      receivedValue: query.targetId,
      context: {
        conditionId: query.conditionId,
        targetConditionId: query.targetId,
        referenceRelation: relation,
      },
    };
  }

  return undefined;
}
