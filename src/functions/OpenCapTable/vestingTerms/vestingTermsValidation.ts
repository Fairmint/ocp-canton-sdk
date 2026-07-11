import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { VestingCondition } from '../../../types/native';

function conditionPath(index: number): string {
  return `vestingTerms.vesting_conditions[${index}]`;
}

/** Validate the cross-condition references that JSON Schema cannot express. */
export function validateVestingTermsGraph(conditions: readonly VestingCondition[]): void {
  const conditionIndexById = new Map<string, number>();
  const nextConditionIdsByIndex: string[][] = [];
  const graphEdgesByIndex: Array<Array<{ readonly targetId: string; readonly fieldPath: string }>> = [];

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    if (!condition || typeof condition !== 'object') {
      throw new OcpValidationError(conditionPath(index), 'Vesting condition must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'VestingCondition',
        receivedValue: condition,
      });
    }

    const { id }: { id: unknown } = condition;
    if (typeof id !== 'string' || id.length === 0) {
      throw new OcpValidationError(`${conditionPath(index)}.id`, 'Condition ID must be a non-empty string', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: id,
      });
    }

    const firstIndex = conditionIndexById.get(id);
    if (firstIndex !== undefined) {
      throw new OcpValidationError(`${conditionPath(index)}.id`, `Duplicate vesting condition ID '${id}'`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'unique condition ID',
        receivedValue: id,
        context: { firstConditionIndex: firstIndex },
      });
    }
    conditionIndexById.set(id, index);

    const rawCondition = condition as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rawCondition, 'description') && rawCondition.description !== undefined) {
      const { description } = rawCondition;
      if (typeof description !== 'string' || description.length === 0) {
        throw new OcpValidationError(
          `${conditionPath(index)}.description`,
          'Description must be non-empty when present',
          {
            code: typeof description === 'string' ? OcpErrorCodes.INVALID_FORMAT : OcpErrorCodes.INVALID_TYPE,
            expectedType: 'non-empty string or omitted',
            receivedValue: description,
          }
        );
      }
    }

    const nextConditionIds: unknown = condition.next_condition_ids;
    if (!Array.isArray(nextConditionIds)) {
      throw new OcpValidationError(
        `${conditionPath(index)}.next_condition_ids`,
        'Next-condition references must be an array',
        {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'string[]',
          receivedValue: nextConditionIds,
        }
      );
    }

    const seenNextIds = new Set<string>();
    const validatedNextIds: string[] = [];
    for (let referenceIndex = 0; referenceIndex < nextConditionIds.length; referenceIndex += 1) {
      const nextId: unknown = nextConditionIds[referenceIndex];
      const path = `${conditionPath(index)}.next_condition_ids[${referenceIndex}]`;
      if (typeof nextId !== 'string' || nextId.length === 0) {
        throw new OcpValidationError(path, 'Condition reference must be a non-empty string', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'non-empty string',
          receivedValue: nextId,
        });
      }
      if (seenNextIds.has(nextId)) {
        throw new OcpValidationError(path, `Duplicate next-condition reference '${nextId}'`, {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'unique condition reference',
          receivedValue: nextId,
        });
      }
      seenNextIds.add(nextId);
      validatedNextIds.push(nextId);
    }
    nextConditionIdsByIndex.push(validatedNextIds);
    graphEdgesByIndex.push(
      validatedNextIds.map((targetId, referenceIndex) => ({
        targetId,
        fieldPath: `${conditionPath(index)}.next_condition_ids[${referenceIndex}]`,
      }))
    );
  }

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    if (!condition) continue;

    const nextConditionIds = nextConditionIdsByIndex[index] ?? [];
    for (let referenceIndex = 0; referenceIndex < nextConditionIds.length; referenceIndex += 1) {
      const nextId = nextConditionIds[referenceIndex];
      if (nextId !== undefined && !conditionIndexById.has(nextId)) {
        throw new OcpValidationError(
          `${conditionPath(index)}.next_condition_ids[${referenceIndex}]`,
          `Unknown vesting condition reference '${nextId}'`,
          {
            code: OcpErrorCodes.INVALID_FORMAT,
            expectedType: 'ID of a condition in this vesting terms object',
            receivedValue: nextId,
          }
        );
      }
    }

    const { trigger }: { trigger: unknown } = condition;
    if (
      trigger !== null &&
      typeof trigger === 'object' &&
      'type' in trigger &&
      trigger.type === 'VESTING_SCHEDULE_RELATIVE' &&
      'relative_to_condition_id' in trigger &&
      typeof trigger.relative_to_condition_id === 'string'
    ) {
      const relativeId = trigger.relative_to_condition_id;
      const path = `${conditionPath(index)}.trigger.relative_to_condition_id`;
      if (!conditionIndexById.has(relativeId)) {
        throw new OcpValidationError(path, `Unknown relative vesting condition reference '${relativeId}'`, {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'ID of a condition in this vesting terms object',
          receivedValue: relativeId,
        });
      }
      if (relativeId === condition.id) {
        throw new OcpValidationError(path, 'A relative vesting condition cannot reference itself', {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'ID of a different condition',
          receivedValue: relativeId,
        });
      }

      const relativeIndex = conditionIndexById.get(relativeId);
      if (relativeIndex !== undefined) {
        const dependencyEdges = graphEdgesByIndex[relativeIndex] ?? [];
        if (!dependencyEdges.some(({ targetId }) => targetId === condition.id)) {
          dependencyEdges.push({ targetId: condition.id, fieldPath: path });
          graphEdgesByIndex[relativeIndex] = dependencyEdges;
        }
      }
    }
  }

  const visitState = new Array<number>(conditions.length).fill(0);
  const visit = (index: number): void => {
    visitState[index] = 1;
    const edges = graphEdgesByIndex[index] ?? [];
    for (const edge of edges) {
      const nextIndex = conditionIndexById.get(edge.targetId);
      if (nextIndex === undefined) continue;
      if (visitState[nextIndex] === 1) {
        throw new OcpValidationError(
          edge.fieldPath,
          `Vesting condition reference creates a cycle through '${edge.targetId}'`,
          {
            code: OcpErrorCodes.INVALID_FORMAT,
            expectedType: 'acyclic vesting dependency graph',
            receivedValue: edge.targetId,
          }
        );
      }
      if (visitState[nextIndex] === 0) visit(nextIndex);
    }
    visitState[index] = 2;
  };

  for (let index = 0; index < conditions.length; index += 1) {
    if (visitState[index] === 0) visit(index);
  }
}
