import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { damlMonetaryToNativeWithValidation, isRecord } from '../../../utils/typeConversions';

const DAML_NUMERIC_10_INTEGER_DIGITS = 28;
const DAML_NUMERIC_10_SCALE = 10;
const DAML_NUMERIC_10_PATTERN = /^([+-]?)(\d+)(?:\.(\d{1,10}))?$/;

const DAML_NUMERIC_10_EXPECTED_TYPE =
  'DAML Numeric(10) decimal string with at most 28 integral digits and 10 fractional digits';

function invalidNumeric(
  value: unknown,
  fieldPath: string,
  code: 'REQUIRED_FIELD_MISSING' | 'INVALID_TYPE' | 'INVALID_FORMAT'
): never {
  const message =
    code === 'REQUIRED_FIELD_MISSING'
      ? `${fieldPath} is required`
      : `${fieldPath} must be a valid ${DAML_NUMERIC_10_EXPECTED_TYPE}`;
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes[code],
    expectedType: DAML_NUMERIC_10_EXPECTED_TYPE,
    receivedValue: value,
  });
}

/**
 * Parse and canonicalize the fixed-point string representation of DAML Numeric 10.
 *
 * Generated DAML codecs only verify that Numeric values are strings, so ledger
 * JSON still needs an exact scale and magnitude check at the SDK boundary.
 */
export function parseDamlNumeric10(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) return invalidNumeric(value, fieldPath, 'REQUIRED_FIELD_MISSING');
  if (typeof value !== 'string') return invalidNumeric(value, fieldPath, 'INVALID_TYPE');

  const match = DAML_NUMERIC_10_PATTERN.exec(value);
  if (!match) return invalidNumeric(value, fieldPath, 'INVALID_FORMAT');

  const sign = match[1] ?? '';
  const rawIntegral = match[2];
  const rawFractional = match[3] ?? '';
  if (rawIntegral === undefined) return invalidNumeric(value, fieldPath, 'INVALID_FORMAT');

  const integral = rawIntegral.replace(/^0+(?=\d)/, '');
  if (integral.length > DAML_NUMERIC_10_INTEGER_DIGITS || rawFractional.length > DAML_NUMERIC_10_SCALE) {
    return invalidNumeric(value, fieldPath, 'INVALID_FORMAT');
  }

  const fractional = rawFractional.replace(/0+$/, '');
  const magnitude = fractional.length > 0 ? `${integral}.${fractional}` : integral;
  if (magnitude === '0') return '0';
  return sign === '-' ? `-${magnitude}` : magnitude;
}

/** Parse a DAML Numeric 10 that must also satisfy the canonical OCF Percentage range. */
export function parseDamlPercentage(value: unknown, fieldPath: string): string {
  const normalized = parseDamlNumeric10(value, fieldPath);
  if (!normalized.startsWith('-') && (normalized === '0' || normalized === '1' || normalized.startsWith('0.'))) {
    return normalized;
  }

  throw new OcpValidationError(fieldPath, `${fieldPath} must be between 0 and 1 inclusive`, {
    code: OcpErrorCodes.OUT_OF_RANGE,
    expectedType: 'DAML Numeric(10) percentage between 0 and 1 inclusive',
    receivedValue: value,
  });
}

/** Validate a nullable generated Monetary record using the strict Numeric 10 parser for its amount. */
export function damlNumeric10MonetaryToNative(value: unknown, fieldPath: string): Monetary | undefined {
  if (!isRecord(value)) return damlMonetaryToNativeWithValidation(value, fieldPath);
  const amount = parseDamlNumeric10(value.amount, `${fieldPath}.amount`);
  return damlMonetaryToNativeWithValidation({ ...value, amount }, fieldPath);
}
