import { OcpErrorCodes, OcpValidationError } from '../errors';
import { canonicalizeNumeric10, canonicalizeOcfNumeric10 } from './numeric10';

export const DAML_NUMERIC_10_SCALE = 10;
export const DAML_NUMERIC_10_INTEGER_DIGITS = 28;

const SCALE_FACTOR = 10n ** BigInt(DAML_NUMERIC_10_SCALE);

/**
 * Validate and canonicalize a generated DAML Numeric(10) wire string.
 *
 * The generated `@daml/types` codec is a string identity codec and therefore
 * accepts exponent notation. Canonical OCF writers use the separate strict OCF
 * boundary and never call this reader-oriented helper.
 */
export function canonicalizeDamlNumeric10(
  value: unknown,
  fieldPath: string,
  expectedType = 'DAML Numeric(10) decimal string'
): string {
  const invalid = (message: string): never => {
    throw new OcpValidationError(fieldPath, message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  };

  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }

  const numeric = canonicalizeNumeric10(value, { allowExponent: true });
  if (!numeric.ok) return invalid(`${fieldPath} ${numeric.message}`);
  return numeric.value;
}

/** Validate a nonnegative Numeric(10) while preserving exact structured diagnostics. */
export function canonicalizeNonnegativeDamlNumeric10(
  value: unknown,
  fieldPath: string,
  expectedType = 'nonnegative DAML Numeric(10) decimal string'
): string {
  const normalized = canonicalizeDamlNumeric10(value, fieldPath, expectedType);
  if (normalized.startsWith('-')) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be nonnegative`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue: value,
    });
  }
  return normalized;
}

/** Validate a nonnegative OCF Numeric before encoding it as DAML Numeric(10). */
export function canonicalizeNonnegativeOcfNumeric10(
  value: unknown,
  fieldPath: string,
  expectedType = 'nonnegative OCF Numeric string'
): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType,
      receivedValue: value,
    });
  }

  const numeric = canonicalizeOcfNumeric10(value);
  if (!numeric.ok) {
    throw new OcpValidationError(fieldPath, `${fieldPath} ${numeric.message}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  if (numeric.value.startsWith('-')) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be nonnegative`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue: value,
    });
  }
  return numeric.value;
}

/** Convert an already validated Numeric(10) value to its exact scaled integer representation. */
export function damlNumeric10ToScaledBigInt(value: string): bigint {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const scaled = BigInt(integer) * SCALE_FACTOR + BigInt(fraction.padEnd(DAML_NUMERIC_10_SCALE, '0'));
  return negative ? -scaled : scaled;
}
