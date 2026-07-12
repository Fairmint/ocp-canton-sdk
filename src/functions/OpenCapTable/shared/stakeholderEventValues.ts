import { OcpErrorCodes, OcpParseError } from '../../../errors';
import {
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  type DamlStakeholderRelationshipType,
  type DamlStakeholderStatus,
} from '../../../utils/enumConversions';

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
