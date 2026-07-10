/**
 * DAML to OCF converters for StakeholderStatusChangeEvent entities.
 */

import type { OcfStakeholderStatusChangeEvent } from '../../../types';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * DAML StakeholderStatusChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStakeholderStatusChangeData = DamlDataTypeFor<'stakeholderStatusChangeEvent'>;

/**
 * Convert DAML StakeholderStatusChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder status change event data object
 * @returns The native OCF StakeholderStatusChangeEvent object
 * @throws OcpParseError if the status is unknown
 */
export function damlStakeholderStatusChangeEventToNative(
  d: DamlStakeholderStatusChangeData
): OcfStakeholderStatusChangeEvent {
  return {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stakeholderStatusChangeEvent.date'),
    stakeholder_id: d.stakeholder_id,
    new_status: damlStakeholderStatusToNative(d.new_status),
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
