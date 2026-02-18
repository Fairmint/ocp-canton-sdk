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

  const normalizedRelationships = Array.isArray(data.new_relationships)
    ? data.new_relationships
    : [data.relationship_started, data.relationship_ended].filter(
        (relationship): relationship is NonNullable<typeof relationship> =>
          typeof relationship === 'string' && relationship.trim().length > 0
      );

  if (!normalizedRelationships.length) {
    throw new OcpValidationError(
      'stakeholderRelationshipChangeEvent.relationship_started',
      'At least one relationship change value is required (relationship_started, relationship_ended, or new_relationships)',
      {
        expectedType: 'non-empty relationship list',
        receivedValue: {
          relationship_started: data.relationship_started,
          relationship_ended: data.relationship_ended,
          new_relationships: data.new_relationships,
        },
      }
    );
  }

  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date),
    stakeholder_id: data.stakeholder_id,
    new_relationships: normalizedRelationships.map(stakeholderRelationshipTypeToDaml),
    comments: cleanComments(data.comments),
  };
}
