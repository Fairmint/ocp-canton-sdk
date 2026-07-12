import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { NonEmptyArray } from '../../../types/native';
import { toNonEmptyStringArray } from '../../../utils/typeConversions';

/** Require a generated DAML Text field while preserving schema-valid empty identifiers. */
export function requiredTransferTextToDaml(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

/** Encode the required unique result identifiers shared by every transfer writer. */
export function resultingSecurityIdsToDaml(value: unknown, fieldPath: string): NonEmptyArray<string> {
  return toNonEmptyStringArray(value, fieldPath, { uniqueItems: true });
}
