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

  const normalizedLegacyRelationships = Array.isArray(data.new_relationships) ? data.new_relationships : [];

  if (normalizedLegacyRelationships.length > 2) {
    throw new OcpValidationError(
      'stakeholderRelationshipChangeEvent.new_relationships',
      'At most two relationship values are supported (relationship_started and relationship_ended)',
      {
        expectedType: 'array with <= 2 elements',
        receivedValue: data.new_relationships,
      }
    );
  }

  const legacyRelationshipStarted =
    normalizedLegacyRelationships.length > 0 ? normalizedLegacyRelationships[0] : undefined;
  const legacyRelationshipEnded =
    normalizedLegacyRelationships.length > 1 ? normalizedLegacyRelationships[1] : undefined;

  const relationshipStarted = data.relationship_started ?? legacyRelationshipStarted;
  const relationshipEnded = data.relationship_ended ?? legacyRelationshipEnded;

  if (!relationshipStarted && !relationshipEnded) {
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
    relationship_started: relationshipStarted ? stakeholderRelationshipTypeToDaml(relationshipStarted) : null,
    relationship_ended: relationshipEnded ? stakeholderRelationshipTypeToDaml(relationshipEnded) : null,
    comments: cleanComments(data.comments),
  };
}
