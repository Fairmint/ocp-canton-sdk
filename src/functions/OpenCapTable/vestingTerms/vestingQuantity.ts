import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { canonicalizeDamlNumeric10, damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { canonicalizeOcfNumeric10 } from '../../../utils/numeric10';

function requireNonnegative(value: unknown, fieldPath: string, expectedType: string): string {
  const normalized = canonicalizeDamlNumeric10(value, fieldPath, expectedType);
  if (normalized.startsWith('-')) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be nonnegative`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return normalized;
}

function requirePositive(normalized: string, receivedValue: unknown, fieldPath: string, expectedType: string): string {
  if (damlNumeric10ToScaledBigInt(normalized) <= 0n) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be greater than zero`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType,
      receivedValue,
    });
  }
  return normalized;
}

/** Validate a nonnegative Numeric(10) wire string emitted by a generated DAML codec. */
export function damlVestingNumericToNative(value: unknown, fieldPath: string): string {
  return requireNonnegative(value, fieldPath, 'DAML Numeric 10 string');
}

/** Validate a strictly positive Numeric(10) wire string emitted by a generated DAML codec. */
export function damlPositiveVestingNumericToNative(value: unknown, fieldPath: string): string {
  return requirePositive(
    damlVestingNumericToNative(value, fieldPath),
    value,
    fieldPath,
    'positive generated DAML Numeric(10) string'
  );
}

/** Decode an optional generated DAML vesting-condition quantity. */
export function damlVestingConditionQuantityToNative(
  value: unknown,
  fieldPath = 'vestingCondition.quantity'
): string | undefined {
  if (value === null || value === undefined) return undefined;
  return damlVestingNumericToNative(value, fieldPath);
}

/** Convert an OCF fixed-point Numeric into the canonical DAML Numeric(10) representation. */
export function ocfVestingConditionQuantityToDaml(value: unknown, fieldPath = 'vestingCondition.quantity'): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be an OCF Numeric string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }
  const numeric = canonicalizeOcfNumeric10(value);
  if (!numeric.ok) {
    throw new OcpValidationError(fieldPath, numeric.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }
  const normalized = numeric.value;
  if (normalized.startsWith('-')) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be nonnegative`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'OCF Numeric string',
      receivedValue: value,
    });
  }
  return normalized;
}

/** Validate a strictly positive OCF Numeric before writing it to DAML. */
export function ocfPositiveVestingNumericToDaml(value: unknown, fieldPath: string): string {
  return requirePositive(
    ocfVestingConditionQuantityToDaml(value, fieldPath),
    value,
    fieldPath,
    'positive fixed-point OCF Numeric string'
  );
}
