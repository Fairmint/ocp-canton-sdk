/**
 * OCF to DAML converter for VestingStart entities.
 */

import type { OcfVestingStart } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';

/**
 * Convert native OCF VestingStart data to DAML format.
 *
 * @param d - The native OCF vesting start data object
 * @returns The DAML-formatted vesting start data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingStartDataToDaml(d: OcfVestingStart): Record<string, unknown> {
  validateRequiredString(d.id, 'vestingStart.id');
  validateRequiredString(d.security_id, 'vestingStart.security_id');
  validateRequiredString(d.vesting_condition_id, 'vestingStart.vesting_condition_id');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'vestingStart.date'),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}
