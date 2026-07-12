import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { isRecord } from '../../../utils/typeConversions';
import { assertExactObjectFields, assertNotRuntimeProxy } from './ocfValues';

export type GeneratedDamlNumericRange = 'any' | 'nonnegative' | 'positive';

const GENERATED_DAML_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/;

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

/** Decode and canonicalize a generated DAML Numeric(10) string with exact range and exponent handling. */
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

function isValidGeneratedDamlCalendarDate(yearText: string, monthText: string, dayText: string): boolean {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= daysInMonth;
}

/** Validate the exact `YYYY-MM-DDThh:mm:ss[.ssssss]Z` wire form documented by `@daml/types`. */
export function requireGeneratedDamlTime(value: unknown, fieldPath: string): string {
  const expectedType = 'DAML Time string in YYYY-MM-DDThh:mm:ss[.ssssss]Z format';
  if (value === null || value === undefined) requiredValue(fieldPath, expectedType, value);
  if (typeof value !== 'string') invalidType(fieldPath, expectedType, value);

  const match = GENERATED_DAML_TIME_PATTERN.exec(value);
  const year = match?.[1];
  const month = match?.[2];
  const day = match?.[3];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !isValidGeneratedDamlCalendarDate(year, month, day)
  ) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must use the exact generated DAML Time wire format`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType,
      receivedValue: value,
    });
  }
  return value;
}

/** Convert one exact generated DAML Time to its lexical OCF calendar date. */
export function generatedDamlTimeToDateString(value: unknown, fieldPath: string): string {
  return requireGeneratedDamlTime(value, fieldPath).slice(0, 10);
}

/** Convert generated Optional Time, where only DAML `None` (`null`) is absent. */
export function optionalGeneratedDamlTimeToDateString(value: unknown, fieldPath: string): string | undefined {
  return value === null ? undefined : generatedDamlTimeToDateString(value, fieldPath);
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
