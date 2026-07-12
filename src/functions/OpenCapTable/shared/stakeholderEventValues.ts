import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { DeepReadonly } from '../../../types/common';
import type { OcfStakeholderRelationshipChangeEvent, OcfStakeholderStatusChangeEvent } from '../../../types/native';
import {
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  type DamlStakeholderRelationshipType,
  type DamlStakeholderStatus,
} from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';

type StakeholderEventEntityType = 'stakeholderRelationshipChangeEvent' | 'stakeholderStatusChangeEvent';
type OcfStakeholderEvent = OcfStakeholderRelationshipChangeEvent | OcfStakeholderStatusChangeEvent;

function invalidStakeholderEventValue(
  fieldPath: string,
  message: string,
  receivedValue: unknown,
  expectedType: string
): never {
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

/**
 * Enforce the pinned v35 stakeholder-event `ensure` clauses that generated
 * TypeScript codecs cannot express. Malformed primitive types are deliberately
 * left to the generated decoder so its field-specific schema diagnostics remain
 * stable; correctly typed but contract-invalid values fail here.
 */
export function validateStakeholderEventDamlSemantics(
  entityType: StakeholderEventEntityType,
  value: Readonly<Record<string, unknown>>,
  rootPath: string
): void {
  for (const field of ['id', 'stakeholder_id'] as const) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string' && fieldValue.length === 0) {
      invalidStakeholderEventValue(
        `${rootPath}.${field}`,
        `${rootPath}.${field} must be a non-empty string`,
        fieldValue,
        'non-empty string'
      );
    }
  }

  damlTimeToDateString(value.date, `${rootPath}.date`);

  if (Array.isArray(value.comments)) {
    value.comments.forEach((comment, index) => {
      if (typeof comment === 'string' && comment.length === 0) {
        invalidStakeholderEventValue(
          `${rootPath}.comments[${index}]`,
          `${rootPath}.comments[${index}] must be a non-empty string`,
          comment,
          'non-empty string'
        );
      }
    });
  }

  if (
    entityType === 'stakeholderRelationshipChangeEvent' &&
    (value.relationship_started === null || value.relationship_started === undefined) &&
    (value.relationship_ended === null || value.relationship_ended === undefined)
  ) {
    throw new OcpValidationError(rootPath, 'At least one relationship change is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'relationship_started and/or relationship_ended',
      receivedValue: value,
    });
  }
}

/** Return an owned, recursively frozen snapshot of one canonical stakeholder event. */
export function freezeStakeholderEvent<T extends OcfStakeholderEvent>(event: T): DeepReadonly<T> {
  const comments = event.comments === undefined ? undefined : Object.freeze([...event.comments]);
  return Object.freeze({
    ...event,
    ...(comments === undefined ? {} : { comments }),
  }) as DeepReadonly<T>;
}

/** Validate a generated DAML Optional stakeholder relationship without treating malformed values as None. */
export function preflightOptionalDamlStakeholderRelationship(value: unknown, fieldPath: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    throw new OcpParseError('Generated DAML relationship must be an enum string or null', {
      source: fieldPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }
  try {
    damlStakeholderRelationshipToNative(value as DamlStakeholderRelationshipType);
  } catch {
    throw new OcpParseError(`Unknown generated DAML stakeholder relationship: ${value}`, {
      source: fieldPath,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      context: { receivedValue: value },
    });
  }
}

/** Validate one required generated DAML stakeholder status with an exact public field path. */
export function preflightDamlStakeholderStatus(value: unknown, fieldPath: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new OcpParseError('Generated DAML stakeholder status must be an enum string', {
      source: fieldPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }
  damlStakeholderStatusToNative(value as DamlStakeholderStatus, fieldPath);
}
