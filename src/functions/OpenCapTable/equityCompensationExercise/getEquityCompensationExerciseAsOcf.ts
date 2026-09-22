import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationExercise } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * Converts DAML EquityCompensationExercise data to native OCF format.
 * Used by the dispatcher pattern in damlToOcf.ts
 */
export function damlEquityCompensationExerciseDataToNative(d: Record<string, unknown>): OcfEquityCompensationExercise {
  // Validate required fields
  if (d.id === undefined || d.id === null || typeof d.id !== 'string') {
    throw new OcpValidationError('equityCompensationExercise.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  }
  if (d.security_id === undefined || d.security_id === null || typeof d.security_id !== 'string') {
    throw new OcpValidationError('equityCompensationExercise.security_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.security_id,
    });
  }
  // Validate quantity
  if (d.quantity === undefined || d.quantity === null) {
    throw new OcpValidationError('equityCompensationExercise.quantity', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new OcpValidationError(
      'equityCompensationExercise.quantity',
      `Must be string or number, got ${typeof d.quantity}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: d.quantity,
      }
    );
  }

  return {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'equityCompensationExercise.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    ...(d.consideration_text ? { consideration_text: d.consideration_text as string } : {}),
    resulting_security_ids: Array.isArray(d.resulting_security_ids) ? (d.resulting_security_ids as string[]) : [],
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments as string[] } : {}),
  };
}

export interface GetEquityCompensationExerciseAsOcfParams extends GetByContractIdParams {}

export interface GetEquityCompensationExerciseAsOcfResult {
  event: OcfEquityCompensationExercise;
  contractId: string;
}

/**
 * Read a PlanSecurityExerciseEvent and return a generic OCF EquityCompensationExercise object. Schema:
 * https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/EquityCompensationExercise.schema.json
 */
export async function getEquityCompensationExerciseAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationExerciseAsOcfParams
): Promise<GetEquityCompensationExerciseAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationExerciseAsOcf',
  });

  const exerciseData = createArgument.exercise_data;
  if (!exerciseData || typeof exerciseData !== 'object' || Array.isArray(exerciseData)) {
    throw new OcpContractError('EquityCompensationExercise data not found in contract create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'missing_exercise_data',
      context: {
        operation: 'getEquityCompensationExerciseAsOcf',
      },
    });
  }
  const d = exerciseData as Record<string, unknown>;

  const native = damlEquityCompensationExerciseDataToNative(d);
  return { event: native, contractId: params.contractId };
}
