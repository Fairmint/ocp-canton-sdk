import { OcpErrorCodes, OcpValidationError } from '../../../errors';

const MAX_SAFE_INTEGER_TEXT = Number.MAX_SAFE_INTEGER.toString();
const MAX_DAML_INTEGER_INPUT_LENGTH = 256;
const CANONICAL_INTEGER_PATTERN = /^(?:0|[1-9]\d*|-[1-9]\d*)$/;
const CANONICAL_NUMERIC_INTEGER_PATTERN = /^(?:0|[1-9]\d*|-[1-9]\d*)(?:\.0+)?$/;

export type DamlIntegerEncoding = 'int' | 'numeric';

/** Encode a native integer without allowing unsafe or coercive JavaScript number values. */
export function nativeSafeIntegerToDaml(value: unknown, fieldPath: string): string {
  const expectedType = 'safe integer number';
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }
  if (typeof value !== 'number') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a number`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be an integer`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  if (!Number.isSafeInteger(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be within the JavaScript safe integer range`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue: value,
    });
  }
  return value.toString();
}

/**
 * Parse a generated DAML integer-like string without allowing Number() coercions
 * that accept scientific notation or silently round values outside the safe range.
 * DAML Numeric values may include a zero-only fractional suffix; DAML Int values may not.
 */
export function parseDamlSafeInteger(value: unknown, fieldPath: string, encoding: DamlIntegerEncoding = 'int'): number {
  const pattern = encoding === 'int' ? CANONICAL_INTEGER_PATTERN : CANONICAL_NUMERIC_INTEGER_PATTERN;
  const expectedType =
    encoding === 'int'
      ? 'canonical integer string within the JavaScript safe integer range'
      : 'canonical decimal string representing an integer within the JavaScript safe integer range';

  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType,
      receivedValue: value,
    });
  }

  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }

  if (value.length > MAX_DAML_INTEGER_INPUT_LENGTH) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue: value,
    });
  }

  if (!pattern.test(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  const integerText = encoding === 'numeric' ? value.replace(/\.0+$/, '') : value;
  const magnitude = integerText.startsWith('-') ? integerText.slice(1) : integerText;
  if (
    magnitude.length > MAX_SAFE_INTEGER_TEXT.length ||
    (magnitude.length === MAX_SAFE_INTEGER_TEXT.length && magnitude > MAX_SAFE_INTEGER_TEXT)
  ) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue: value,
    });
  }

  return Number(integerText);
}
