/**
 * DAML to OCF converters for StakeholderRelationshipChangeEvent entities.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent, StakeholderRelationshipType } from '../../../types';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';
import {
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
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
  comments: string[];
}

/** Decode a generated DAML Optional relationship without treating malformed values as absence. */
export function damlOptionalStakeholderRelationshipToNative(
  value: unknown,
  fieldPath: string
): StakeholderRelationshipType | undefined {
  // Generated DAML Optional decoders normalize an omitted JSON key to null.
  if (value === undefined || value === null) return undefined;
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
  const rootPath = 'stakeholderRelationshipChangeEvent';
  assertSafeGeneratedDamlJson(d, rootPath);
  const source = requireGeneratedRecord(d, rootPath);
  rejectUnknownGeneratedFields(source, rootPath, [
    'id',
    'date',
    'stakeholder_id',
    'comments',
    'relationship_ended',
    'relationship_started',
  ]);
  for (const field of ['id', 'date', 'stakeholder_id'] as const) {
    requireGeneratedString(source[field], `${rootPath}.${field}`);
  }
  requireGeneratedStringArray(source.comments, `${rootPath}.comments`);
  for (const field of ['relationship_started', 'relationship_ended'] as const) {
    if (source[field] !== null && source[field] !== undefined) {
      requireGeneratedString(source[field], `${rootPath}.${field}`);
    }
  }
  const relationshipStarted = damlOptionalStakeholderRelationshipToNative(
    source.relationship_started,
    `${rootPath}.relationship_started`
  );
  const relationshipEnded = damlOptionalStakeholderRelationshipToNative(
    source.relationship_ended,
    `${rootPath}.relationship_ended`
  );
  const decoded = decodeGeneratedDaml(
    d,
    {
      decode: (value) =>
        Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData.decoder.runWithException(
          value
        ),
      encode: (value) =>
        Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData.encode(
          value
        ),
    },
    rootPath
  );
  const common = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: decoded.id,
    date: damlTimeToDateString(decoded.date, 'stakeholderRelationshipChangeEvent.date'),
    stakeholder_id: decoded.stakeholder_id,
    ...(decoded.comments.length > 0 ? { comments: [...decoded.comments] } : {}),
  } as const;
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
      receivedValue: decoded,
    }
  );
}
