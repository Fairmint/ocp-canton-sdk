/**
 * OCF to DAML converter for StakeholderRelationshipChangeEvent.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { STAKEHOLDER_RELATIONSHIP_TYPES, type OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import { stakeholderRelationshipTypeToDaml } from '../../../utils/enumConversions';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { validateEnum, validateRequiredString } from '../../../utils/validation';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * Convert native OCF StakeholderRelationshipChangeEvent data to DAML format.
 *
 * @param data - The native OCF stakeholder relationship change event data
 * @returns The DAML-formatted data object
 */
export function stakeholderRelationshipChangeEventDataToDaml(
  data: OcfStakeholderRelationshipChangeEvent
): DamlDataTypeFor<'stakeholderRelationshipChangeEvent'> {
  const path = 'stakeholderRelationshipChangeEvent';
  validateRequiredString(data.id, `${path}.id`);
  validateRequiredString(data.stakeholder_id, `${path}.stakeholder_id`);

  const relationshipStarted = data.relationship_started;
  const relationshipEnded = data.relationship_ended;
  const hasRelationshipStarted = relationshipStarted !== undefined;
  const hasRelationshipEnded = relationshipEnded !== undefined;

  if (!hasRelationshipStarted && !hasRelationshipEnded) {
    throw new OcpValidationError(path, 'One of relationship_started or relationship_ended is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'relationship_started or relationship_ended',
      receivedValue: data,
    });
  }
  if (hasRelationshipStarted) {
    validateEnum(relationshipStarted, `${path}.relationship_started`, STAKEHOLDER_RELATIONSHIP_TYPES);
  }
  if (hasRelationshipEnded) {
    validateEnum(relationshipEnded, `${path}.relationship_ended`, STAKEHOLDER_RELATIONSHIP_TYPES);
  }

  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date, `${path}.date`),
    stakeholder_id: data.stakeholder_id,
    relationship_started: hasRelationshipStarted ? stakeholderRelationshipTypeToDaml(relationshipStarted) : null,
    relationship_ended: hasRelationshipEnded ? stakeholderRelationshipTypeToDaml(relationshipEnded) : null,
    comments: cleanComments(data.comments),
  };
}
