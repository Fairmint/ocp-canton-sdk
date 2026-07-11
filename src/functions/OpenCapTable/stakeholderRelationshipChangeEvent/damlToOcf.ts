/**
 * DAML to OCF converters for StakeholderRelationshipChangeEvent entities.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent, StakeholderRelationshipType } from '../../../types';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML StakeholderRelationshipChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStakeholderRelationshipChangeData {
  id: string;
  date: string;
  stakeholder_id: string;
  relationship_started: DamlStakeholderRelationshipType | null;
  relationship_ended: DamlStakeholderRelationshipType | null;
  comments?: string[];
}

/** Decode a generated DAML Optional relationship without treating malformed strings as absence. */
export function damlOptionalStakeholderRelationshipToNative(
  value: unknown,
  fieldPath: string
): StakeholderRelationshipType | undefined {
  if (value === undefined) {
    throw new OcpParseError('Required generated DAML relationship field is missing', {
      source: fieldPath,
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      context: { receivedValue: value },
    });
  }
  if (value === null) return undefined;
  if (typeof value !== 'string') {
    throw new OcpParseError('Generated DAML relationship must be an enum string or null', {
      source: fieldPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }

  try {
    return damlStakeholderRelationshipToNative(value as DamlStakeholderRelationshipType);
  } catch {
    throw new OcpParseError(`Unknown generated DAML stakeholder relationship: ${value}`, {
      source: fieldPath,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      context: { receivedValue: value },
    });
  }
}

/**
 * Convert DAML StakeholderRelationshipChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder relationship change event data object
 * @returns The native OCF StakeholderRelationshipChangeEvent object
 */
export function damlStakeholderRelationshipChangeEventToNative(
  d: DamlStakeholderRelationshipChangeData
): OcfStakeholderRelationshipChangeEvent {
  const common = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stakeholderRelationshipChangeEvent.date'),
    stakeholder_id: d.stakeholder_id,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  } as const;
  const relationshipStarted = damlOptionalStakeholderRelationshipToNative(
    d.relationship_started,
    'stakeholderRelationshipChangeEvent.relationship_started'
  );
  const relationshipEnded = damlOptionalStakeholderRelationshipToNative(
    d.relationship_ended,
    'stakeholderRelationshipChangeEvent.relationship_ended'
  );

  if (relationshipStarted) {
    return {
      ...common,
      relationship_started: relationshipStarted,
      ...(relationshipEnded ? { relationship_ended: relationshipEnded } : {}),
    };
  }
  if (relationshipEnded) return { ...common, relationship_ended: relationshipEnded };

  throw new OcpValidationError(
    'stakeholderRelationshipChangeEvent',
    'At least one relationship_started or relationship_ended value is required',
    {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d,
    }
  );
}
