/**
 * DAML to OCF converters for VestingAcceleration entities.
 */

import type { OcfVestingAcceleration } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';
import { damlPositiveVestingNumericToNative } from '../vestingTerms/vestingQuantity';

/**
 * DAML VestingAcceleration data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlVestingAccelerationData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  comments: string[];
}

/**
 * Convert DAML VestingAcceleration data to native OCF format.
 *
 * @param d - The DAML vesting acceleration data object
 * @returns The native OCF VestingAcceleration object
 */
export function damlVestingAccelerationToNative(d: DamlVestingAccelerationData): OcfVestingAcceleration {
  validateRequiredString(d.id, 'vestingAcceleration.id');
  validateRequiredString(d.security_id, 'vestingAcceleration.security_id');
  validateRequiredString(d.reason_text, 'vestingAcceleration.reason_text');
  d.comments.forEach((comment, index) => validateRequiredString(comment, `vestingAcceleration.comments[${index}]`));

  return {
    object_type: 'TX_VESTING_ACCELERATION',
    id: d.id,
    date: damlTimeToDateString(d.date, 'vestingAcceleration.date'),
    security_id: d.security_id,
    quantity: damlPositiveVestingNumericToNative(d.quantity, 'vestingAcceleration.quantity'),
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
