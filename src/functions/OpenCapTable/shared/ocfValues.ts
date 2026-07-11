import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { isRecord, normalizeNumericString } from '../../../utils/typeConversions';

interface DecimalRange {
  minimum?: number;
  minimumInclusive?: boolean;
  maximum?: number;
  maximumInclusive?: boolean;
  expectedType: string;
}

function requiredMissing(fieldPath: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(fieldPath: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

/** Require the canonical string representation used for DAML Numeric values. */
export function requireDecimalString(value: unknown, fieldPath: string, range?: DecimalRange): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'decimal string', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'decimal string', value);

  const normalized = normalizeNumericString(value, fieldPath);
  if (range !== undefined) {
    const numericValue = Number(normalized);
    const belowMinimum =
      range.minimum !== undefined &&
      (range.minimumInclusive === false ? numericValue <= range.minimum : numericValue < range.minimum);
    const aboveMaximum =
      range.maximum !== undefined &&
      (range.maximumInclusive === false ? numericValue >= range.maximum : numericValue > range.maximum);

    if (belowMinimum || aboveMaximum) {
      throw new OcpValidationError(fieldPath, `${fieldPath} is outside the permitted range`, {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: range.expectedType,
        receivedValue: value,
      });
    }
  }

  return normalized;
}

/** OCF Percentage: a decimal in the inclusive [0, 1] range. */
export function requirePercentage(value: unknown, fieldPath: string): string {
  return requireDecimalString(value, fieldPath, {
    minimum: 0,
    maximum: 1,
    expectedType: 'decimal string between 0 and 1 inclusive',
  });
}

/** Conversion percentages that must be non-zero: a decimal in the (0, 1] range. */
export function requirePositivePercentage(value: unknown, fieldPath: string): string {
  return requireDecimalString(value, fieldPath, {
    minimum: 0,
    minimumInclusive: false,
    maximum: 1,
    expectedType: 'decimal string greater than 0 and at most 1',
  });
}

/** SAFE and note discounts: a decimal in the [0, 1) range. */
export function requireDiscount(value: unknown, fieldPath: string): string {
  return requireDecimalString(value, fieldPath, {
    minimum: 0,
    maximum: 1,
    maximumInclusive: false,
    expectedType: 'decimal string greater than or equal to 0 and less than 1',
  });
}

/** Quantities and ratio components that DAML v34 requires to be strictly positive. */
export function requirePositiveDecimal(value: unknown, fieldPath: string): string {
  return requireDecimalString(value, fieldPath, {
    minimum: 0,
    minimumInclusive: false,
    expectedType: 'decimal string greater than 0',
  });
}

/** Monetary amounts cannot be negative in DAML v34. */
export function requireNonnegativeDecimal(value: unknown, fieldPath: string): string {
  return requireDecimalString(value, fieldPath, {
    minimum: 0,
    expectedType: 'decimal string greater than or equal to 0',
  });
}

/** OCF currency codes use the exact ISO-style three-uppercase-letter wire shape. */
export function requireCurrencyCode(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined)
    throw requiredMissing(fieldPath, 'three-letter uppercase currency code', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'three-letter uppercase currency code', value);
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must contain exactly three uppercase ASCII letters`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'three-letter uppercase currency code',
      receivedValue: value,
    });
  }
  return value;
}

/** Validate a complete OCF/DAML Monetary value without accepting compatibility scalar forms. */
export function requireMonetary(value: unknown, fieldPath: string): Monetary {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'Monetary object', value);
  if (!isRecord(value)) throw invalidType(fieldPath, 'Monetary object', value);
  return {
    amount: requireNonnegativeDecimal(value.amount, `${fieldPath}.amount`),
    currency: requireCurrencyCode(value.currency, `${fieldPath}.currency`),
  };
}

/** Require a non-empty runtime array while preserving the caller's exact field path. */
export function requireNonEmptyArray(value: unknown, fieldPath: string): [unknown, ...unknown[]] {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'non-empty array', value);
  if (!Array.isArray(value)) throw invalidType(fieldPath, 'non-empty array', value);
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must contain at least one item`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-empty array',
      receivedValue: value,
    });
  }
  return value as [unknown, ...unknown[]];
}
