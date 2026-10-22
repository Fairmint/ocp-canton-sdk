/**
 * OCF to DAML converter for VestingAcceleration entities.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfVestingAcceleration } from '../../../types';
import type { PkgVestingAccelerationOcfData } from '../../../types/daml';
import { cleanComments, dateStringToDAMLDate, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Convert native OCF VestingAcceleration data to DAML format.
 *
 * @param d - The native OCF vesting acceleration data object
 * @returns The DAML-formatted vesting acceleration data
 * @throws OcpValidationError if required fields are missing
 */
export function vestingAccelerationDataToDaml(d: OcfVestingAcceleration): PkgVestingAccelerationOcfData {
  if (!d.id) {
    throw new OcpValidationError('vestingAcceleration.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: d.id,
    });
  }
  return {
    id: d.id,
    date: dateStringToDAMLDate(d.date, 'vestingAcceleration.date'),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}
