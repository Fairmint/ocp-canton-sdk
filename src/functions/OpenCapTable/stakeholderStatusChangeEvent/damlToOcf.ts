/**
 * DAML to OCF converters for StakeholderStatusChangeEvent entities.
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
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
  new_status: string;
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
  const nativeStatus = damlStakeholderStatusToNative(d.new_status);

  if (nativeStatus === undefined) {
    throw new OcpParseError(`Unknown stakeholder status: ${d.new_status}`, {
      source: 'stakeholderStatusChangeEvent.new_status',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }

  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    stakeholder_id: d.stakeholder_id,
    new_status: nativeStatus,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
