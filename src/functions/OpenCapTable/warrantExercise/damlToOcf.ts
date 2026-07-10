/**
 * DAML to OCF converters for WarrantExercise entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfWarrantExercise } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

export type DamlWarrantExerciseData = DamlDataTypeFor<'warrantExercise'>;

/**
 * Convert DAML WarrantExercise data to native OCF format.
 * Used by both getWarrantExerciseAsOcf and the damlToOcf dispatcher.
 *
 * @param d - The generated DAML warrant exercise data object
 * @returns The native OCF WarrantExercise object
 */
export function damlWarrantExerciseToNative(d: DamlWarrantExerciseData): OcfWarrantExercise {
  // Validate resulting_security_ids
  if (d.resulting_security_ids.length === 0) {
    throw new OcpValidationError('warrantExercise.resulting_security_ids', 'Required field must be a non-empty array', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.resulting_security_ids,
    });
  }

  // Validate trigger_id
  if (d.trigger_id.length === 0) {
    throw new OcpValidationError('warrantExercise.trigger_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.trigger_id,
    });
  }

  return {
    object_type: 'TX_WARRANT_EXERCISE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'warrantExercise.date'),
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
