import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { isRecord } from '../../../utils/typeConversions';
import { assertExactObjectFields, assertNotRuntimeProxy } from './ocfValues';

export type GeneratedDamlNumericRange = 'any' | 'nonnegative' | 'positive';

function requiredValue(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

/** Decode a generated DAML Numeric(10) string with exact range and exponent handling. */
export function requireGeneratedDamlNumeric10(
  value: unknown,
  fieldPath: string,
  range: GeneratedDamlNumericRange = 'any'
): string {
  const expectedType =
    range === 'positive'
      ? 'positive DAML Numeric(10) string'
      : range === 'nonnegative'
        ? 'nonnegative DAML Numeric(10) string'
        : 'DAML Numeric(10) string';

  if (value === null || value === undefined) requiredValue(fieldPath, expectedType, value);
  if (typeof value !== 'string') invalidType(fieldPath, expectedType, value);

  // The pinned generated @daml/types Numeric(10) codec accepts scientific
  // notation and preserves it on encode. Canonical OCF output remains fixed
  // point, while OCF writers continue to reject exponent syntax.
  const numeric = canonicalizeNumeric10(value, { allowExponent: true });
  if (!numeric.ok) {
    throw new OcpValidationError(fieldPath, numeric.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }

  const scaled = damlNumeric10ToScaledBigInt(numeric.value);
  const outsideRange = range === 'positive' ? scaled <= 0n : range === 'nonnegative' ? scaled < 0n : false;
  if (outsideRange) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must be ${range === 'positive' ? 'greater than zero' : 'nonnegative'}`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType,
        receivedValue: value,
      }
    );
  }

  return numeric.value;
}

function requireGeneratedCurrencyCode(value: unknown, fieldPath: string): string {
  const expectedType = 'three-letter uppercase ISO 4217 currency code';
  if (value === null || value === undefined) requiredValue(fieldPath, expectedType, value);
  if (typeof value !== 'string') invalidType(fieldPath, expectedType, value);
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new OcpValidationError(fieldPath, 'Currency must be exactly three uppercase ASCII letters', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return value;
}

/** Decode an exact generated DAML Monetary record without invoking traps or discarding fields. */
export function requireGeneratedDamlMonetary(
  value: unknown,
  fieldPath: string,
  amountRange: GeneratedDamlNumericRange = 'nonnegative'
): Monetary {
  const expectedType = 'exact generated DAML Monetary record';
  if (value === null || value === undefined) requiredValue(fieldPath, expectedType, value);
  assertNotRuntimeProxy(value, fieldPath, expectedType);
  if (!isRecord(value)) invalidType(fieldPath, expectedType, value);
  assertExactObjectFields(value, ['amount', 'currency'], fieldPath);

  return {
    amount: requireGeneratedDamlNumeric10(value.amount, `${fieldPath}.amount`, amountRange),
    currency: requireGeneratedCurrencyCode(value.currency, `${fieldPath}.currency`),
  };
}
