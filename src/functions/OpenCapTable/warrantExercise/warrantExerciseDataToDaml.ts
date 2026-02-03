/**
 * OCF to DAML converter for WarrantExercise entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfWarrantExercise } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF WarrantExercise data to DAML format.
 *
 * @param d - The native OCF warrant exercise data object
 * @returns The DAML-formatted warrant exercise data
 * @throws OcpValidationError if required fields are missing
 */
export function warrantExerciseDataToDaml(d: OcfWarrantExercise): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('warrantExercise.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  if (!d.trigger_id) {
    throw new OcpValidationError('warrantExercise.trigger_id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.trigger_id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
