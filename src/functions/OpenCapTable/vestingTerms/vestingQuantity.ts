import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  canonicalizeNonnegativeDamlNumeric10,
  canonicalizeNonnegativeOcfNumeric10,
  damlNumeric10ToScaledBigInt,
} from '../../../utils/damlNumeric';

function requireNonnegative(value: unknown, fieldPath: string, expectedType: string): string {
  return canonicalizeNonnegativeDamlNumeric10(value, fieldPath, expectedType);
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
  return canonicalizeNonnegativeOcfNumeric10(value, fieldPath, 'OCF Numeric string');
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
