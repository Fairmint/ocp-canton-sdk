import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';

/** Encode a required DAML Text value. */
export function requiredTextToDaml(value: unknown, fieldPath: string): string {
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

/** Encode required DAML Text whose template invariant rejects an empty value. */
export function requiredNonEmptyTextToDaml(value: unknown, fieldPath: string): string {
  const text = requiredTextToDaml(value, fieldPath);
  if (text.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a non-empty string`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return text;
}

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

/** Encode optional DAML Text whose present value must be non-empty. */
export function optionalNonEmptyTextToDaml(value: unknown, fieldPath: string): string | null {
  const text = canonicalOptionalTextToDaml(value, fieldPath);
  if (text === '') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be non-empty when present`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string or omitted property',
      receivedValue: value,
    });
  }
  return text;
}

/** Encode optional OCF text while rejecting the empty `Some ""` forbidden by pinned v35 issuance validators. */
export function canonicalOptionalNonEmptyTextToDaml(value: unknown, fieldPath: string): string | null {
  return optionalNonEmptyTextToDaml(value, fieldPath);
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
