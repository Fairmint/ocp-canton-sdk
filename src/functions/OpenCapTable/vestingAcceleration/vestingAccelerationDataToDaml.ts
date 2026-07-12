/**
 * OCF to DAML converter for VestingAcceleration entities.
 */

import type { OcfVestingAcceleration } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredTextToDaml } from '../shared/damlText';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';
import { ocfPositiveVestingNumericToDaml } from '../vestingTerms/vestingQuantity';

/**
 * Convert native OCF VestingAcceleration data to DAML format.
 *
 * @param d - The native OCF vesting acceleration data object
 * @returns The DAML-formatted vesting acceleration data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingAccelerationDataToDaml(d: OcfVestingAcceleration): DamlDataTypeFor<'vestingAcceleration'> {
  const input = requirePlainWriterInput(d, 'vestingAcceleration');
  validateCanonicalWriterInput('vestingAcceleration', 'TX_VESTING_ACCELERATION', input, 'vestingAcceleration');
  return {
    id: requiredTextToDaml(input.id, 'vestingAcceleration.id'),
    date: dateStringToDAMLTime(input.date, 'vestingAcceleration.date'),
    security_id: requiredTextToDaml(input.security_id, 'vestingAcceleration.security_id'),
    quantity: ocfPositiveVestingNumericToDaml(input.quantity, 'vestingAcceleration.quantity'),
    reason_text: requiredTextToDaml(input.reason_text, 'vestingAcceleration.reason_text'),
    comments: commentsToDaml(input.comments, 'vestingAcceleration.comments'),
  } satisfies DamlDataTypeFor<'vestingAcceleration'>;
}
