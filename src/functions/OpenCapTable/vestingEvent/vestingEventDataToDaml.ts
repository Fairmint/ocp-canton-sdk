/**
 * OCF to DAML converter for VestingEvent entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfVestingEvent } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF VestingEvent data to DAML format.
 *
 * @param d - The native OCF vesting event data object
 * @returns The DAML-formatted vesting event data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingEventDataToDaml(d: OcfVestingEvent): Record<string, unknown> {
  if (!d.id) {
    throw new OcpValidationError('vestingEvent.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}
