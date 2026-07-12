import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { canonicalizeDamlNumeric10, damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';

const CANONICAL_DAML_VESTING_NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

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

/** Validate a nonnegative fixed-point Numeric(10) emitted by a generated DAML codec. */
export function damlVestingNumericToNative(value: unknown, fieldPath: string): string {
  if (typeof value === 'string' && !CANONICAL_DAML_VESTING_NUMERIC.test(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must use canonical fixed-point DAML Numeric 10 syntax`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'DAML Numeric 10 string',
      receivedValue: value,
    });
  }
  return requireNonnegative(value, fieldPath, 'DAML Numeric 10 string');
}

/** Validate a strictly positive fixed-point Numeric(10) emitted by a generated DAML codec. */
export function damlPositiveVestingNumericToNative(value: unknown, fieldPath: string): string {
  return requirePositive(
    damlVestingNumericToNative(value, fieldPath),
    value,
    fieldPath,
    'positive fixed-point DAML Numeric(10) string'
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
  return requireNonnegative(value, fieldPath, 'OCF Numeric string');
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
