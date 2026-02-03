/**
 * DAML to OCF converters for StakeholderStatusChangeEvent entities.
 */

import type { OcfStakeholderStatusChangeEvent, StakeholderStatus } from '../../../types';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML StakeholderStatusChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStakeholderStatusChangeData {
  id: string;
  date: string;
  stakeholder_id: string;
  new_status: string;
  comments: string[];
}

/**
 * Convert DAML StakeholderStatusChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder status change event data object
 * @returns The native OCF StakeholderStatusChangeEvent object
 */
export function damlStakeholderStatusChangeEventToNative(
  d: DamlStakeholderStatusChangeData
): OcfStakeholderStatusChangeEvent {
  const nativeStatus = damlStakeholderStatusToNative(d.new_status);
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    stakeholder_id: d.stakeholder_id,
    new_status: (nativeStatus ?? d.new_status) as StakeholderStatus,
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
