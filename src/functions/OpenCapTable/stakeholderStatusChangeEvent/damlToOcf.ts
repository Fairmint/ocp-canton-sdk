/**
 * DAML to OCF converters for StakeholderStatusChangeEvent entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStakeholderStatusChangeEvent } from '../../../types';
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
  new_status: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType;
  comments?: string[];
}

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
    id: d.id,
    date: damlTimeToDateString(d.date),
    stakeholder_id: d.stakeholder_id,
    new_status: damlStakeholderStatusToNative(d.new_status),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
