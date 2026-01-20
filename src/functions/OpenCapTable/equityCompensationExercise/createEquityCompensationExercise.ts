import type { OcfEquityCompensationExercise } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert OCF equity compensation exercise data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('equityCompensationExercise', data).execute()` instead.
 *   This function will be removed in a future major version.
 */
export function equityCompensationExerciseDataToDaml(d: OcfEquityCompensationExercise): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    consideration_text: optionalString(d.consideration_text),
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}
