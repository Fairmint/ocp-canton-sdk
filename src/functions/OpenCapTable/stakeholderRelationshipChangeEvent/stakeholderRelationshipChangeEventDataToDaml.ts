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

  if (
    normalizedLegacyRelationships.length > 1 &&
    data.relationship_started === undefined &&
    data.relationship_ended === undefined
  ) {
    throw new OcpValidationError(
      'stakeholderRelationshipChangeEvent.new_relationships',
      'Legacy new_relationships with multiple entries is ambiguous; provide canonical relationship_started/relationship_ended fields',
      {
        expectedType: 'single-item array or canonical relationship_started/relationship_ended fields',
        receivedValue: data.new_relationships,
      }
    );
  }

  const legacyRelationshipStarted =
    normalizedLegacyRelationships.length === 1 ? normalizedLegacyRelationships[0] : undefined;

  const relationshipStarted = data.relationship_started ?? legacyRelationshipStarted;
  const relationshipEnded = data.relationship_ended;

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
