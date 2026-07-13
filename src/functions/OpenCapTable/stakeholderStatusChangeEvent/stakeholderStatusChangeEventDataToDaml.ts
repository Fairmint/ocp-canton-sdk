/**
 * OCF to DAML converter for StakeholderStatusChangeEvent.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { stakeholderStatusToDaml } from '../../../utils/enumConversions';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF StakeholderStatusChangeEvent data to DAML format.
 *
 * @param data - The native OCF stakeholder status change event data
 * @returns The DAML-formatted data object
 */
export function stakeholderStatusChangeEventDataToDaml(data: OcfStakeholderStatusChangeEvent): Record<string, unknown> {
  if (!data.id) {
    throw new OcpValidationError('stakeholderStatusChangeEvent.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: data.id,
    });
  }
  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date),
    stakeholder_id: data.stakeholder_id,
    new_status: stakeholderStatusToDaml(data.new_status),
    comments: cleanComments(data.comments),
  };
}
