import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';

/** Encode an optional OCF string without conflating a present empty string with absence. */
export function canonicalOptionalTextToDaml(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must be a string when present; omit the property when absent`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string or omitted property',
        receivedValue: value,
      }
    );
  }
  return value;
}

/** Encode an optional OCF boolean while rejecting explicit null. */
export function canonicalOptionalBooleanToDaml(value: unknown, fieldPath: string): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must be a boolean when present; omit the property when absent`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'boolean or omitted property',
        receivedValue: value,
      }
    );
  }
  return value;
}

/** Encode an optional OCF date while rejecting explicit null rather than treating it as omission. */
export function canonicalOptionalDateToDaml(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (value === null) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must be a date string when present; omit the property when absent`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'date string or omitted property',
        receivedValue: value,
      }
    );
  }
  return dateStringToDAMLTime(value, fieldPath);
}
