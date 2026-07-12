import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { boundedDiagnosticPath, diagnosticPropertyPath } from '../../../errors/diagnosticValue';
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

/**
 * Reject JavaScript Proxy values before any operation that can invoke a Proxy
 * trap (or throw on a revoked Proxy). Proxies are not JSON values and retaining
 * the Proxy itself in diagnostics would make later error serialization unsafe.
 */
export function assertNotRuntimeProxy(value: unknown, fieldPath: string, expectedType: string): void {
  if (!nodeUtilTypes.isProxy(value)) return;
  throw new OcpValidationError(fieldPath, `${fieldPath} cannot be a JavaScript Proxy`, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    expectedType,
    receivedValue: 'JavaScript Proxy',
  });
}

/** Reject object structure that cannot be represented by an exact OCF JSON record. */
export function assertExactObjectFields(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  fieldPath: string
): void {
  assertNotRuntimeProxy(record, fieldPath, 'plain OCF object');
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
    const propertyPath = diagnosticPropertyPath(fieldPath, key);
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new OcpValidationError(propertyPath, `${propertyPath} must be a data property`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'own data property',
        receivedValue: 'accessor property',
      });
    }
    if (descriptor.enumerable !== true) {
      throw new OcpValidationError(propertyPath, `${propertyPath} must be enumerable`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'enumerable own data property',
        receivedValue: 'non-enumerable property',
      });
    }
    if (!allowed.has(key)) {
      throw new OcpValidationError(propertyPath, `${propertyPath} is not supported`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'absent property',
        receivedValue: descriptor.value,
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
      const propertyPath = diagnosticPropertyPath(fieldPath, key);
      throw new OcpValidationError(propertyPath, `${propertyPath} is inherited rather than own`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'own property or absent optional property',
        receivedValue: 'inherited property',
      });
    }
  }
}

interface PendingJsonValue {
  readonly path: string;
  readonly value: unknown;
  readonly release?: object;
}

interface CanonicalJsonGraphOptions {
  /** Reject present properties whose value is `undefined`; omitted properties remain valid. */
  readonly rejectUndefined?: boolean;
}

/**
 * Descriptor-only preflight for values crossing OCF/DAML JavaScript boundaries.
 * It rejects traps, accessors, non-enumerable data, custom prototypes, symbols,
 * sparse arrays, BigInts, and functions before any converter dereference.
 */
export function assertCanonicalJsonGraph(
  value: unknown,
  fieldPath: string,
  options: CanonicalJsonGraphOptions = {}
): void {
  const pending: PendingJsonValue[] = [{ path: boundedDiagnosticPath(fieldPath), value }];
  const active = new WeakSet<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.release !== undefined) {
      active.delete(current.release);
      continue;
    }
    const currentValue = current.value;
    const valueType = typeof currentValue;
    if (currentValue === undefined && options.rejectUndefined === true) {
      throw new OcpValidationError(current.path, `${current.path} must be omitted rather than set to undefined`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'JSON value or omitted property',
        receivedValue: currentValue,
      });
    }
    if (currentValue === null || currentValue === undefined) continue;
    if (valueType === 'bigint' || valueType === 'symbol' || valueType === 'function') {
      throw new OcpValidationError(current.path, `${current.path} is not a JSON value`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'JSON value',
        receivedValue: currentValue,
      });
    }
    if (valueType !== 'object') continue;

    assertNotRuntimeProxy(currentValue, current.path, 'trap-free JSON value');
    const object = currentValue;
    if (active.has(object)) {
      throw new OcpValidationError(current.path, `${current.path} contains a circular object reference`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'acyclic JSON tree',
        receivedValue: 'circular object reference',
      });
    }
    active.add(object);
    pending.push({ path: current.path, value: undefined, release: object });

    if (Array.isArray(object)) {
      const values = requireDenseArray(object, current.path);
      for (let index = values.length - 1; index >= 0; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
        const itemPath = diagnosticPropertyPath(current.path, String(index));
        if (descriptor === undefined || !('value' in descriptor)) {
          throw new OcpValidationError(itemPath, `${itemPath} must be an own data property`, {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: 'enumerable own array item',
            receivedValue: 'missing or accessor array item',
          });
        }
        if (descriptor.enumerable !== true) {
          throw new OcpValidationError(itemPath, `${itemPath} must be enumerable`, {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: 'enumerable own array item',
            receivedValue: 'non-enumerable array item',
          });
        }
        pending.push({ path: itemPath, value: descriptor.value });
      }
      continue;
    }

    const prototype = Object.getPrototypeOf(object) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new OcpValidationError(current.path, `${current.path} must be a plain JSON object`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'plain object',
        receivedValue: 'custom prototype',
      });
    }

    const symbol = Object.getOwnPropertySymbols(object)[0];
    if (symbol !== undefined) {
      throw new OcpValidationError(
        diagnosticPropertyPath(current.path, symbol),
        `${current.path} contains a symbol key`,
        {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: 'plain object without symbol properties',
          receivedValue: symbol,
        }
      );
    }

    for (const key of Object.getOwnPropertyNames(object)) {
      const propertyPath = diagnosticPropertyPath(current.path, key);
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor === undefined || !('value' in descriptor)) {
        throw new OcpValidationError(propertyPath, `${propertyPath} must be an own data property`, {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: 'enumerable own data property',
          receivedValue: 'accessor property',
        });
      }
      if (descriptor.enumerable !== true) {
        throw new OcpValidationError(propertyPath, `${propertyPath} must be enumerable`, {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: 'enumerable own data property',
          receivedValue: 'non-enumerable property',
        });
      }
      pending.push({ path: propertyPath, value: descriptor.value });
    }

    for (const key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) {
        const propertyPath = diagnosticPropertyPath(current.path, key);
        throw new OcpValidationError(propertyPath, `${propertyPath} is inherited rather than own`, {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: 'own data property',
          receivedValue: 'inherited property',
        });
      }
    }
  }
}

const LEADING_DECIMAL_PERCENTAGE_PATTERN = /^\.\d{1,10}$/;
const OCF_PERCENTAGE_PATTERN = /^(?:0(?:\.\d{1,10})?|\.\d{1,10}|1(?:\.0{1,10})?)$/;

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

/**
 * Validate the exact OCF Percentage wire syntax before converting it to the
 * canonical DAML Numeric(10) representation.
 *
 * Generated DAML reads intentionally use {@link requirePercentageString}
 * instead: ledger Numeric values may contain a leading sign or redundant zeroes
 * that are valid DAML but not valid OCF Percentage JSON.
 */
function requireOcfPercentageString(value: unknown, fieldPath: string, range: DecimalRange): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'OCF percentage decimal string', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'OCF percentage decimal string', value);
  if (!OCF_PERCENTAGE_PATTERN.test(value)) {
    let normalizedNonOcfNumeric: string | undefined;
    try {
      normalizedNonOcfNumeric = canonicalizeDamlNumeric10(value, fieldPath);
    } catch {
      // Keep the OCF syntax diagnostic below for values that are not DAML Numeric(10) either.
    }
    if (normalizedNonOcfNumeric !== undefined) {
      // Preserve the more useful semantic diagnostic for fixed-point values
      // outside OCF Percentage's absolute [0, 1] range. Refinements such as
      // positive-only or discount-only ranges are applied only after the wire
      // syntax is valid, so in-range spellings such as +0.2, -0, and 00.2
      // continue to fail as INVALID_FORMAT below.
      enforceDecimalRange(normalizedNonOcfNumeric, value, fieldPath, {
        minimum: 0,
        maximum: 1,
        expectedType: range.expectedType,
      });
    }
    throw new OcpValidationError(fieldPath, `${fieldPath} must use canonical OCF Percentage syntax`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: range.expectedType,
      receivedValue: value,
    });
  }

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

/** Exact OCF Percentage writer boundary: a decimal in the inclusive [0, 1] range. */
export function requireOcfPercentage(value: unknown, fieldPath: string): string {
  return requireOcfPercentageString(value, fieldPath, {
    minimum: 0,
    maximum: 1,
    expectedType: 'canonical OCF percentage decimal string between 0 and 1 inclusive',
  });
}

/** Exact OCF conversion-percentage writer boundary: a decimal in the (0, 1] range. */
export function requirePositiveOcfPercentage(value: unknown, fieldPath: string): string {
  return requireOcfPercentageString(value, fieldPath, {
    minimum: 0,
    minimumInclusive: false,
    maximum: 1,
    expectedType: 'canonical OCF percentage decimal string greater than 0 and at most 1',
  });
}

/** Exact OCF SAFE/note discount writer boundary: a decimal in the [0, 1) range. */
export function requireOcfDiscount(value: unknown, fieldPath: string): string {
  return requireOcfPercentageString(value, fieldPath, {
    minimum: 0,
    maximum: 1,
    maximumInclusive: false,
    expectedType: 'canonical OCF percentage decimal string greater than or equal to 0 and less than 1',
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
  assertNotRuntimeProxy(value, fieldPath, 'Monetary object');
  if (!isRecord(value)) throw invalidType(fieldPath, 'Monetary object', value);
  return {
    amount: requireNonnegativeDecimal(value.amount, `${fieldPath}.amount`),
    currency: requireCurrencyCode(value.currency, `${fieldPath}.currency`),
  };
}

function arrayPropertyPath(fieldPath: string, key: string | symbol): string {
  return diagnosticPropertyPath(fieldPath, key);
}

function arrayShapeError(
  fieldPath: string,
  message: string,
  expectedType: string,
  receivedValue: unknown
): OcpValidationError {
  return new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    expectedType,
    receivedValue,
  });
}

/** Require an ordinary, lossless JSON array and attribute malformed structure to its exact path. */
export function requireDenseArray(value: unknown, fieldPath: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'array', value);
  assertNotRuntimeProxy(value, fieldPath, 'ordinary JSON array');
  if (!Array.isArray(value)) throw invalidType(fieldPath, 'array', value);

  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw arrayShapeError(
      fieldPath,
      `${fieldPath} must use the canonical Array prototype`,
      'ordinary JSON array',
      'custom array prototype'
    );
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    throw arrayShapeError(
      `${fieldPath}.length`,
      `${fieldPath}.length must be an own data property`,
      'own array length data property',
      'missing or accessor length property'
    );
  }
  const length = lengthDescriptor.value as number;
  const indices = new Set<number>();

  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'length') continue;
    const propertyPath = arrayPropertyPath(fieldPath, key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw arrayShapeError(
        propertyPath,
        `${propertyPath} must be an own data property`,
        'own array item data property',
        'accessor property'
      );
    }
    if (descriptor.enumerable !== true) {
      throw arrayShapeError(
        propertyPath,
        `${propertyPath} must be enumerable`,
        'enumerable own array item data property',
        'non-enumerable property'
      );
    }

    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= length) {
      throw arrayShapeError(
        propertyPath,
        `${propertyPath} is not a canonical array index`,
        'array index or length only',
        descriptor.value
      );
    }
    indices.add(index);
  }

  const symbol = Object.getOwnPropertySymbols(value)[0];
  if (symbol !== undefined) {
    const propertyPath = arrayPropertyPath(fieldPath, symbol);
    throw arrayShapeError(
      propertyPath,
      `${propertyPath} is not supported on an OCF array`,
      'array without symbol properties',
      symbol
    );
  }

  if (indices.size !== length) {
    let missingIndex = 0;
    while (indices.has(missingIndex)) {
      missingIndex += 1;
    }
    throw requiredMissing(arrayPropertyPath(fieldPath, String(missingIndex)), 'array item', undefined);
  }

  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      const propertyPath = arrayPropertyPath(fieldPath, key);
      throw arrayShapeError(
        propertyPath,
        `${propertyPath} is inherited rather than own`,
        'own array index',
        'inherited property'
      );
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
  assertNotRuntimeProxy(value, fieldPath, 'ordinary non-empty JSON array');
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
