import { OcpErrorCodes, OcpValidationError } from '../errors';

export const DAML_NUMERIC_10_SCALE = 10;
export const DAML_NUMERIC_10_INTEGER_DIGITS = 28;

const MAX_NUMERIC_INPUT_LENGTH = 256;
const NUMERIC_10_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const SCALE_FACTOR = 10n ** BigInt(DAML_NUMERIC_10_SCALE);

/** Validate and canonicalize the exact fixed-point string accepted by DAML Numeric(10). */
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

  if (value.length > MAX_NUMERIC_INPUT_LENGTH) {
    return invalid(`${fieldPath} is unreasonably long`);
  }

  const match = NUMERIC_10_PATTERN.exec(value);
  const sign = match?.[1];
  const rawInteger = match?.[2];
  const rawFraction = match?.[3] ?? '';
  if (sign === undefined || rawInteger === undefined) {
    return invalid(`${fieldPath} must be a fixed-point decimal string`);
  }
  if (rawFraction.length > DAML_NUMERIC_10_SCALE) {
    return invalid(`${fieldPath} must not exceed ${DAML_NUMERIC_10_SCALE} fractional digits`);
  }

  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  if (integer.length > DAML_NUMERIC_10_INTEGER_DIGITS) {
    return invalid(`${fieldPath} must not exceed ${DAML_NUMERIC_10_INTEGER_DIGITS} integral digits`);
  }

  const fraction = rawFraction.replace(/0+$/, '');
  if (integer === '0' && fraction.length === 0) return '0';

  return `${sign === '-' ? '-' : ''}${integer}${fraction.length > 0 ? `.${fraction}` : ''}`;
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

/** Convert an already validated Numeric(10) value to its exact scaled integer representation. */
export function damlNumeric10ToScaledBigInt(value: string): bigint {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const scaled = BigInt(integer) * SCALE_FACTOR + BigInt(fraction.padEnd(DAML_NUMERIC_10_SCALE, '0'));
  return negative ? -scaled : scaled;
}
