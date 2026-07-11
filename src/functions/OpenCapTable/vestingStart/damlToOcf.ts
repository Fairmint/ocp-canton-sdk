/**
 * DAML to OCF converters for VestingStart entities.
 */

import type { OcfVestingStart } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';

/**
 * DAML VestingStart data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlVestingStartData {
  id: string;
  date: string;
  security_id: string;
  vesting_condition_id: string;
  comments: string[];
}

/**
 * Convert DAML VestingStart data to native OCF format.
 *
 * @param d - The DAML vesting start data object
 * @returns The native OCF VestingStart object
 */
export function damlVestingStartToNative(d: DamlVestingStartData): OcfVestingStart {
  validateRequiredString(d.id, 'vestingStart.id');
  validateRequiredString(d.security_id, 'vestingStart.security_id');
  validateRequiredString(d.vesting_condition_id, 'vestingStart.vesting_condition_id');
  d.comments.forEach((comment, index) => validateRequiredString(comment, `vestingStart.comments[${index}]`));

  return {
    object_type: 'TX_VESTING_START',
    id: d.id,
    date: damlTimeToDateString(d.date, 'vestingStart.date'),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
