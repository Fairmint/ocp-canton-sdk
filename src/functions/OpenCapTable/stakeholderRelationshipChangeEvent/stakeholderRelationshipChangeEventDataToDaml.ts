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

  const relationshipStarted = data.relationship_started;
  const relationshipEnded = data.relationship_ended;

  if (!relationshipStarted && !relationshipEnded) {
    throw new OcpValidationError(
      'stakeholderRelationshipChangeEvent.relationship_started',
      'At least one relationship change value is required (relationship_started or relationship_ended)',
      {
        expectedType: 'relationship_started or relationship_ended',
        receivedValue: {
          relationship_started: data.relationship_started,
          relationship_ended: data.relationship_ended,
        },
      }
    );
  }

  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date),
    stakeholder_id: data.stakeholder_id,
    relationship_started: relationshipStarted ? stakeholderRelationshipTypeToDaml(relationshipStarted) : null,
    relationship_ended: relationshipEnded ? stakeholderRelationshipTypeToDaml(relationshipEnded) : null,
    comments: cleanComments(data.comments),
  };
}
