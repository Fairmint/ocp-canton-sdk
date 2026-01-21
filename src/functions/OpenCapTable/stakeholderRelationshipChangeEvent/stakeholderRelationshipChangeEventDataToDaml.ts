/**
 * OCF to DAML converter for StakeholderRelationshipChangeEvent.
 */

import { OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import { stakeholderRelationshipTypeToDaml } from '../../../utils/enumConversions';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';

/**
 * Convert native OCF StakeholderRelationshipChangeEvent data to DAML format.
 *
 * @param data - The native OCF stakeholder relationship change event data
 * @returns The DAML-formatted data object
 */
export function stakeholderRelationshipChangeEventDataToDaml(
  data: OcfStakeholderRelationshipChangeEvent
): Record<string, unknown> {
  if (!data.id) {
    throw new OcpValidationError('stakeholderRelationshipChangeEvent.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: data.id,
    });
  }
  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date),
    stakeholder_id: data.stakeholder_id,
    new_relationships: data.new_relationships.map(stakeholderRelationshipTypeToDaml),
    comments: cleanComments(data.comments),
  };
}
