import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { canonicalizeDamlNumeric10, damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { isRecord } from '../../../utils/typeConversions';

interface DecimalRange {
  minimum?: number;
  minimumInclusive?: boolean;
  maximum?: number;
  maximumInclusive?: boolean;
  expectedType: string;
}

/** Reject object structure that cannot be represented by an exact OCF JSON record. */
export function assertExactObjectFields(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  fieldPath: string
): void {
  const prototype = Object.getPrototypeOf(record) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a plain OCF object`, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      expectedType: 'plain object',
      receivedValue: 'custom prototype',
    });
  }

  const allowed = new Set(allowedFields);
  for (const key of Object.getOwnPropertyNames(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) {
      throw new OcpValidationError(`${fieldPath}.${key}`, `${fieldPath}.${key} must be a data property`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'own data property',
        receivedValue: 'accessor property',
      });
    }
    if (!allowed.has(key)) {
      throw new OcpValidationError(`${fieldPath}.${key}`, `${fieldPath}.${key} is not supported`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'absent property',
        receivedValue: descriptor?.value,
      });
    }
  }

  const symbol = Object.getOwnPropertySymbols(record)[0];
  if (symbol !== undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} contains an unsupported symbol property`, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      expectedType: 'plain OCF object without symbol properties',
      receivedValue: symbol,
    });
  }

  for (const key of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(record, key) && key in record) {
      throw new OcpValidationError(`${fieldPath}.${key}`, `${fieldPath}.${key} is inherited rather than own`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'own property or absent optional property',
        receivedValue: 'inherited property',
      });
    }
  }
}

const LEADING_DECIMAL_PERCENTAGE_PATTERN = /^\.\d{1,10}$/;

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

function enforceDecimalRange(
  normalized: string,
  receivedValue: unknown,
  fieldPath: string,
  range: DecimalRange
): string {
  const numericValue = damlNumeric10ToScaledBigInt(normalized);
  const scaleFactor = 10n ** 10n;
  const minimum = range.minimum === undefined ? undefined : BigInt(range.minimum) * scaleFactor;
  const maximum = range.maximum === undefined ? undefined : BigInt(range.maximum) * scaleFactor;
  const belowMinimum =
    minimum !== undefined && (range.minimumInclusive === false ? numericValue <= minimum : numericValue < minimum);
  const aboveMaximum =
    maximum !== undefined && (range.maximumInclusive === false ? numericValue >= maximum : numericValue > maximum);

  if (belowMinimum || aboveMaximum) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is outside the permitted range`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: range.expectedType,
      receivedValue,
    });
  }

  return normalized;
}

/** Require the canonical string representation used for DAML Numeric values. */
export function requireDecimalString(value: unknown, fieldPath: string, range?: DecimalRange): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'decimal string', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'decimal string', value);

  const normalized = canonicalizeDamlNumeric10(value, fieldPath);
  return range === undefined ? normalized : enforceDecimalRange(normalized, value, fieldPath, range);
}

/**
 * OCF Percentage permits a leading decimal point, unlike general OCF Numeric.
 * Normalize only that schema-specific form before applying DAML Numeric(10).
 */
function requirePercentageString(value: unknown, fieldPath: string, range: DecimalRange): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'percentage decimal string', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'percentage decimal string', value);

  const damlInput = LEADING_DECIMAL_PERCENTAGE_PATTERN.test(value) ? `0${value}` : value;
  const normalized = canonicalizeDamlNumeric10(damlInput, fieldPath);
  return enforceDecimalRange(normalized, value, fieldPath, range);
}

/** OCF Percentage: a decimal in the inclusive [0, 1] range. */
export function requirePercentage(value: unknown, fieldPath: string): string {
  return requirePercentageString(value, fieldPath, {
    minimum: 0,
    maximum: 1,
    expectedType: 'decimal string between 0 and 1 inclusive',
  });
}

/** Conversion percentages that must be non-zero: a decimal in the (0, 1] range. */
export function requirePositivePercentage(value: unknown, fieldPath: string): string {
  return requirePercentageString(value, fieldPath, {
    minimum: 0,
    minimumInclusive: false,
    maximum: 1,
    expectedType: 'decimal string greater than 0 and at most 1',
  });
}

/** SAFE and note discounts: a decimal in the [0, 1) range. */
export function requireDiscount(value: unknown, fieldPath: string): string {
  return requirePercentageString(value, fieldPath, {
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

/** Require an ordinary dense runtime array and attribute holes to their exact indexes. */
export function requireDenseArray(value: unknown, fieldPath: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'array', value);
  if (!Array.isArray(value)) throw invalidType(fieldPath, 'array', value);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      throw requiredMissing(`${fieldPath}.${index}`, 'array item', undefined);
    }
  }
  return value;
}

/** Require a dense array whose values are strings, preserving schema-valid empty strings. */
export function requireStringArray(value: unknown, fieldPath: string): string[] {
  if (value === null) throw invalidType(fieldPath, 'array of strings', value);
  return requireDenseArray(value, fieldPath).map((item, index) => {
    if (typeof item !== 'string') {
      throw invalidType(`${fieldPath}.${index}`, 'string', item);
    }
    return item;
  });
}

/** Encode an optional OCF string array without dropping malformed or falsy values. */
export function optionalStringArrayToDaml(value: unknown, fieldPath: string): string[] {
  if (value === undefined) return [];
  if (value === null) throw invalidType(fieldPath, 'array of strings or omitted property', value);
  return requireStringArray(value, fieldPath);
}

/** Require a non-empty runtime array while preserving the caller's exact field path. */
export function requireNonEmptyArray(value: unknown, fieldPath: string): [unknown, ...unknown[]] {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'non-empty array', value);
  if (!Array.isArray(value)) throw invalidType(fieldPath, 'non-empty array', value);
  const values = requireDenseArray(value, fieldPath);
  if (values.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must contain at least one item`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-empty array',
      receivedValue: values,
    });
  }
  return values as [unknown, ...unknown[]];
}
