/**
 * OCF to DAML converter for VestingStart entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfVestingStart } from '../../../types';
import type { PkgVestingStartOcfData } from '../../../types/daml';
import { cleanComments, dateStringToDAMLDate } from '../../../utils/typeConversions';

/**
 * Convert native OCF VestingStart data to DAML format.
 *
 * @param d - The native OCF vesting start data object
 * @returns The DAML-formatted vesting start data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingStartDataToDaml(d: OcfVestingStart): PkgVestingStartOcfData {
  if (!d.id) {
    throw new OcpValidationError('vestingStart.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLDate(d.date, 'vestingStart.date'),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}
