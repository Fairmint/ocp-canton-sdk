/** OCF to DAML conversion for StakeholderRelationshipChangeEvent data. */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import { isStakeholderRelationshipType, stakeholderRelationshipTypeToDaml } from '../../../utils/enumConversions';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { requiredNonEmptyTextToDaml } from '../shared/damlText';
import {
  nonEmptyCommentsToDaml,
  requireExactWriterInput,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';

const ROOT_FIELDS = [
  'comments',
  'date',
  'id',
  'object_type',
  'relationship_ended',
  'relationship_started',
  'stakeholder_id',
] as const;

function relationshipToDaml(value: unknown, fieldPath: string) {
  if (!isStakeholderRelationshipType(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a canonical stakeholder relationship`, {
      code: typeof value === 'string' ? OcpErrorCodes.UNKNOWN_ENUM_VALUE : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'StakeholderRelationshipType',
      receivedValue: value,
    });
  }
  return stakeholderRelationshipTypeToDaml(value);
}

/** Validate canonical OCF and encode the exact generated relationship-event payload. */
export function stakeholderRelationshipChangeEventDataToDaml(
  data: OcfStakeholderRelationshipChangeEvent
): DamlDataTypeFor<'stakeholderRelationshipChangeEvent'> {
  const path = 'stakeholderRelationshipChangeEvent';
  const input = requireExactWriterInput(data, path, ROOT_FIELDS);
  const relationshipStarted = input.relationship_started;
  const relationshipEnded = input.relationship_ended;

  if (relationshipStarted === null) {
    throw new OcpValidationError(`${path}.relationship_started`, 'relationship_started cannot be null', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'StakeholderRelationshipType or omitted property',
      receivedValue: relationshipStarted,
    });
  }
  if (relationshipEnded === null) {
    throw new OcpValidationError(`${path}.relationship_ended`, 'relationship_ended cannot be null', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'StakeholderRelationshipType or omitted property',
      receivedValue: relationshipEnded,
    });
  }
  if (relationshipStarted === undefined && relationshipEnded === undefined) {
    throw new OcpValidationError(path, 'At least one relationship change is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'relationship_started and/or relationship_ended',
      receivedValue: input,
    });
  }

  const result = {
    id: requiredNonEmptyTextToDaml(input.id, `${path}.id`),
    date: dateStringToDAMLTime(input.date, `${path}.date`),
    stakeholder_id: requiredNonEmptyTextToDaml(input.stakeholder_id, `${path}.stakeholder_id`),
    relationship_started:
      relationshipStarted === undefined
        ? null
        : relationshipToDaml(relationshipStarted, `${path}.relationship_started`),
    relationship_ended:
      relationshipEnded === undefined ? null : relationshipToDaml(relationshipEnded, `${path}.relationship_ended`),
    comments: nonEmptyCommentsToDaml(input.comments, `${path}.comments`),
  } satisfies DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>;

  validateCanonicalWriterInput('stakeholderRelationshipChangeEvent', 'CE_STAKEHOLDER_RELATIONSHIP', input, path);
  return result;
}
