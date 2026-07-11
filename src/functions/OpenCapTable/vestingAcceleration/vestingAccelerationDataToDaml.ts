/**
 * OCF to DAML converter for VestingAcceleration entities.
 */

import type { OcfVestingAcceleration } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';
import { ocfPositiveVestingNumericToDaml } from '../vestingTerms/vestingQuantity';

/**
 * Convert native OCF VestingAcceleration data to DAML format.
 *
 * @param d - The native OCF vesting acceleration data object
 * @returns The DAML-formatted vesting acceleration data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingAccelerationDataToDaml(d: OcfVestingAcceleration): Record<string, unknown> {
  validateRequiredString(d.id, 'vestingAcceleration.id');
  validateRequiredString(d.security_id, 'vestingAcceleration.security_id');
  validateRequiredString(d.reason_text, 'vestingAcceleration.reason_text');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'vestingAcceleration.date'),
    security_id: d.security_id,
    quantity: ocfPositiveVestingNumericToDaml(d.quantity, 'vestingAcceleration.quantity'),
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}
