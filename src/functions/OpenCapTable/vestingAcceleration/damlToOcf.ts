/**
 * DAML to OCF converters for VestingAcceleration entities.
 */

import type { OcfVestingAcceleration } from '../../../types';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

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
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
