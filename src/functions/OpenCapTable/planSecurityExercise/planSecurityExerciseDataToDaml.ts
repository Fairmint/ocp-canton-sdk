/**
 * OCF to DAML converter for PlanSecurityExercise entities.
 *
 * PlanSecurityExercise is an alias type that maps to the underlying EquityCompensationExercise DAML contract.
 * Note: balance_security_id is intentionally omitted because the underlying DAML
 * EquityCompensationExercise contract does not support this field.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfPlanSecurityExercise } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

/**
 * Convert native OCF PlanSecurityExercise data to DAML format.
 *
 * Note: balance_security_id is intentionally omitted because the underlying DAML
 * EquityCompensationExercise contract does not support this field. PlanSecurityExercise
 * maps to OcfCreateEquityCompensationExercise which matches the EquityCompensationExercise schema.
 *
 * @param d - The native OCF plan security exercise data object
 * @returns The DAML-formatted equity compensation exercise data
 * @throws OcpValidationError if required fields are missing
 */
export function planSecurityExerciseDataToDaml(d: OcfPlanSecurityExercise): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('planSecurityExercise.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
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
