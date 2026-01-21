/**
 * DAML to OCF converters for VestingEvent entities.
 */

import type { OcfVestingEvent } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML VestingEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlVestingEventData {
  id: string;
  date: string;
  security_id: string;
  vesting_condition_id: string;
  comments: string[];
}

/**
 * Convert DAML VestingEvent data to native OCF format.
 *
 * @param d - The DAML vesting event data object
 * @returns The native OCF VestingEvent object
 */
export function damlVestingEventToNative(d: DamlVestingEventData): OcfVestingEvent {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
