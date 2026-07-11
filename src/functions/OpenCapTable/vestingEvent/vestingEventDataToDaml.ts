/**
 * OCF to DAML converter for VestingEvent entities.
 */

import type { OcfVestingEvent } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';

/**
 * Convert native OCF VestingEvent data to DAML format.
 *
 * @param d - The native OCF vesting event data object
 * @returns The DAML-formatted vesting event data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingEventDataToDaml(d: OcfVestingEvent): Record<string, unknown> {
  validateRequiredString(d.id, 'vestingEvent.id');
  validateRequiredString(d.security_id, 'vestingEvent.security_id');
  validateRequiredString(d.vesting_condition_id, 'vestingEvent.vesting_condition_id');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'vestingEvent.date'),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}
