import { OcpContractError, OcpErrorCodes } from '../../../errors';
import { moduleEntityOf } from '../../../register/templates';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';

/** Which exercised event of a transaction to read the result of. */
export interface ExerciseResultQuery {
  /** The template that defines the choice, in any template-ID form (only its module and entity are compared) */
  templateId: string;
  choice: string;
  /** The contract the choice was exercised on, when the transaction exercises the choice more than once */
  contractId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The `exerciseResult` of every exercised event of a ledger-effects transaction that matches the query, in order.
 * Events without a result are left out.
 */
export function findExerciseResults(
  response: SubmitAndWaitForTransactionResponse,
  query: ExerciseResultQuery
): unknown[] {
  const { events } = response.transaction;
  if (!Array.isArray(events)) return [];
  const expectedModuleEntity = moduleEntityOf(query.templateId);
  const results: unknown[] = [];
  for (const event of events as unknown[]) {
    if (!isRecord(event) || !isRecord(event.ExercisedEvent)) continue;
    const exercised = event.ExercisedEvent;
    if (exercised.choice !== query.choice) continue;
    if (query.contractId !== undefined && exercised.contractId !== query.contractId) continue;
    if (typeof exercised.templateId !== 'string' || moduleEntityOf(exercised.templateId) !== expectedModuleEntity) {
      continue;
    }
    if (exercised.exerciseResult === undefined) continue;
    results.push(exercised.exerciseResult);
  }
  return results;
}

/**
 * The `exerciseResult` of the one exercised event that matches the query.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction holds no such event with a result, for example
 * because it was read in a shape that leaves out exercised events
 * @throws OcpContractError (`SCHEMA_MISMATCH`) when more than one event matches
 */
export function requireExerciseResult(
  response: SubmitAndWaitForTransactionResponse,
  query: ExerciseResultQuery
): unknown {
  const results = findExerciseResults(response, query);
  if (results.length === 0) {
    throw new OcpContractError(`${query.choice} result not found in transaction`, {
      ...(query.contractId !== undefined ? { contractId: query.contractId } : {}),
      templateId: query.templateId,
      choice: query.choice,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
      classification: 'missing_exercise_result',
    });
  }
  if (results.length > 1) {
    throw new OcpContractError(`${query.choice} was exercised ${results.length} times in the transaction`, {
      ...(query.contractId !== undefined ? { contractId: query.contractId } : {}),
      templateId: query.templateId,
      choice: query.choice,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'ambiguous_exercise_result',
    });
  }
  return results[0];
}
