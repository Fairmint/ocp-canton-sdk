/**
 * OCF to DAML converter for StakeholderRelationshipChangeEvent.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
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

  const rawData = data as unknown as Record<string, unknown>;
  const relationshipStarted = rawData.relationship_started;
  const relationshipEnded = rawData.relationship_ended;
  const basePath = 'stakeholderRelationshipChangeEvent';
  for (const [field, value] of [
    ['relationship_started', relationshipStarted],
    ['relationship_ended', relationshipEnded],
  ] as const) {
    if (value === null) {
      throw new OcpValidationError(`${basePath}.${field}`, `${field} cannot be null`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'stakeholder relationship or omitted',
        receivedValue: value,
      });
    }
  }
  if (relationshipStarted === undefined && relationshipEnded === undefined) {
    throw new OcpValidationError(basePath, 'At least one relationship change is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'relationship_started and/or relationship_ended',
      receivedValue: { relationship_started: relationshipStarted, relationship_ended: relationshipEnded },
    });
  }

  return {
    id: data.id,
    date: dateStringToDAMLTime(data.date, 'stakeholderRelationshipChangeEvent.date'),
    stakeholder_id: data.stakeholder_id,
    relationship_started:
      relationshipStarted !== undefined
        ? stakeholderRelationshipTypeToDaml(
            relationshipStarted as NonNullable<OcfStakeholderRelationshipChangeEvent['relationship_started']>
          )
        : null,
    relationship_ended:
      relationshipEnded !== undefined
        ? stakeholderRelationshipTypeToDaml(
            relationshipEnded as NonNullable<OcfStakeholderRelationshipChangeEvent['relationship_ended']>
          )
        : null,
    comments: cleanComments(data.comments),
  };
}
