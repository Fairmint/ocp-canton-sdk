import { OcpErrorCodes, OcpValidationError } from '../../../errors';

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const CANONICAL_INTEGER_PATTERN = /^(?:0|[1-9]\d*|-[1-9]\d*)$/;
const CANONICAL_NUMERIC_INTEGER_PATTERN = /^(?:0|[1-9]\d*|-[1-9]\d*)(?:\.0+)?$/;

export type DamlIntegerEncoding = 'int' | 'numeric';

/**
 * Parse a generated DAML integer-like string without allowing Number() coercions
 * that accept scientific notation or silently round values outside the safe range.
 * DAML Numeric values may include a zero-only fractional suffix; DAML Int values may not.
 */
export function parseDamlSafeInteger(value: unknown, fieldPath: string, encoding: DamlIntegerEncoding): number {
  const pattern = encoding === 'int' ? CANONICAL_INTEGER_PATTERN : CANONICAL_NUMERIC_INTEGER_PATTERN;
  const expectedType =
    encoding === 'int'
      ? 'canonical integer string within the JavaScript safe integer range'
      : 'canonical decimal string representing an integer within the JavaScript safe integer range';

  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  const integerText = encoding === 'numeric' ? value.replace(/\.0+$/, '') : value;
  const integer = BigInt(integerText);
  if (integer < MIN_SAFE_INTEGER || integer > MAX_SAFE_INTEGER) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a ${expectedType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  return Number(integer);
}
