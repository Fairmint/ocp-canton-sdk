/**
 * OCF to DAML converter for WarrantExercise entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpValidationError } from '../../../errors';
import type { OcfWarrantExercise } from '../../../types';
import { cleanComments, dateStringToDAMLTime, optionalString } from '../../../utils/typeConversions';

type DamlWarrantExerciseData = Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData;

/**
 * Convert native OCF WarrantExercise data to DAML format.
 *
 * @param d - The native OCF warrant exercise data object
 * @returns The DAML-formatted warrant exercise data
 * @throws OcpValidationError if required fields are missing
 */
export function warrantExerciseDataToDaml(d: OcfWarrantExercise): DamlWarrantExerciseData {
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
    date: dateStringToDAMLTime(d.date, 'warrantExercise.date'),
    security_id: d.security_id,
    trigger_id: d.trigger_id,
    // DAML retains this ledger-only field; canonical OCF has no corresponding input.
    quantity: null,
    resulting_security_ids: d.resulting_security_ids,
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}
