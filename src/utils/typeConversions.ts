/**
 * Utility functions to convert between DAML types and TypeScript-native types
 *
 * This file contains ONLY shared helper functions used by multiple entity conversion files. Entity-specific conversions
 * have been moved to their respective function files.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../errors';
import type { Address, AddressType, ConversionTriggerType, Monetary, NonEmptyArray } from '../types/native';
import { canonicalizeNonnegativeDamlNumeric10 } from './damlNumeric';
import { assertSafeGeneratedDamlJson } from './generatedDamlValidation';

// Public conversion helpers use stable structural wire shapes. Generated DAML
// package declarations stay private to the ledger implementation boundary.
interface DamlMonetary {
  amount: string;
  currency: string;
}
type DamlAddressType = 'OcfAddressTypeLegal' | 'OcfAddressTypeContact' | 'OcfAddressTypeOther';
interface DamlAddress {
  address_type: DamlAddressType;
  country: string;
  city: string | null;
  country_subdivision: string | null;
  postal_code: string | null;
  street_suite: string | null;
}

// ===== Type Guards =====

/**
 * Type guard to check if a value is a plain object (not null and not an array).
 * Used for validating DAML contract response data before accessing properties.
 *
 * @param value - The value to check
 * @returns True if value is a non-null, non-array object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ===== Date and Time Conversion Helpers =====

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RFC3339_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const DATE_EXPECTED_TYPE = 'YYYY-MM-DD or RFC 3339 date-time string with Z or numeric offset';

function isValidCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2 ? (isLeapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= daysInMonth;
}

/**
 * Return the lexical date prefix for a valid OCF date or RFC 3339 date-time.
 *
 * This deliberately does not convert through `Date`: an offset timestamp such as
 * `2024-01-15T23:30:00-05:00` represents the OCF date `2024-01-15`, even though
 * its UTC representation falls on the following day.
 */
export function tryIsoDateToDateString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!DATE_ONLY_PATTERN.test(value) && !RFC3339_DATE_TIME_PATTERN.test(value)) return null;
  if (!isValidCalendarDate(value)) return null;
  return value.slice(0, 10);
}

function requireIsoDate(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Expected a date string', {
      expectedType: DATE_EXPECTED_TYPE,
      receivedValue: value,
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const date = tryIsoDateToDateString(value);
  if (date !== null) return date;

  throw new OcpValidationError(fieldPath, `Expected a valid ${DATE_EXPECTED_TYPE}`, {
    expectedType: DATE_EXPECTED_TYPE,
    receivedValue: value,
    code: OcpErrorCodes.INVALID_FORMAT,
  });
}

/**
 * Convert a valid OCF date to canonical DAML Time format.
 *
 * OCF dates are lexical calendar dates, even when callers provide an RFC 3339
 * date-time with an offset. Always encode the validated date prefix as UTC
 * midnight so ledger normalization cannot shift it to a different OCF date.
 */
export function dateStringToDAMLTime(value: unknown, fieldPath: string): string {
  const date = requireIsoDate(value, fieldPath);
  return `${date}T00:00:00.000Z`;
}

/**
 * Convert an optional OCF date to DAML Time. Only null and undefined mean
 * "absent"; every present runtime value is validated by the required
 * converter so malformed values cannot be silently discarded.
 */
export function optionalDateStringToDAMLTime(value: unknown, fieldPath: string): string | null {
  return value === null || value === undefined ? null : dateStringToDAMLTime(value, fieldPath);
}

/**
 * Convert a required-but-nullable OCF date to DAML Time. Explicit null is the
 * only absent representation; undefined and every other runtime value must
 * satisfy the required date validator.
 */
export function nullableDateStringToDAMLTime(value: unknown, fieldPath: string): string | null {
  return value === null ? null : dateStringToDAMLTime(value, fieldPath);
}

/**
 * Convert a RelTime value (as microseconds string) to DAML RelTime format DAML RelTime is serialized as an object with
 * a microseconds field
 */
export function relTimeToDAML(microseconds: string): { microseconds: string } {
  return { microseconds };
}

/**
 * Convert a DAML Time value to its OCF date prefix after validating the runtime value. Date-only values are accepted so
 * already-normalized data can safely cross the same boundary.
 */
export function damlTimeToDateString(value: unknown, fieldPath: string): string {
  return requireIsoDate(value, fieldPath);
}

/**
 * Convert an optional DAML Time to an optional OCF date. Only null and
 * undefined mean "absent"; every present runtime value is validated.
 */
export function optionalDamlTimeToDateString(value: unknown, fieldPath: string): string | undefined {
  return value === null || value === undefined ? undefined : damlTimeToDateString(value, fieldPath);
}

/** Convert a required-but-nullable DAML Time; only explicit null is absent. */
export function nullableDamlTimeToDateString(value: unknown, fieldPath: string): string | null {
  return value === null ? null : damlTimeToDateString(value, fieldPath);
}

/**
 * Normalize a numeric string by removing trailing zeros after the decimal point. DAML returns numbers like
 * "5000000.0000000000" but OCF expects "5000000". Also handles removing the decimal point if all fractional digits are
 * zeros.
 *
 * @param fieldPath - Field path reported by validation errors. Defaults to the historical utility-level path.
 * @throws OcpValidationError if the string contains scientific notation (e.g., "1.5e10") or is not a valid numeric string
 */
export function normalizeNumericString(value: string | number, fieldPath = 'numericString'): string {
  // DAML Numeric values may arrive as JavaScript numbers at runtime
  // despite being typed as string in the generated package types.
  // Coerce to string at this boundary.
  if (typeof value === 'number') {
    return normalizeNumericString(value.toString(), fieldPath);
  }

  // Validate: reject scientific notation
  if (value.toLowerCase().includes('e')) {
    throw new OcpValidationError(fieldPath, `Scientific notation is not supported`, {
      expectedType: 'string (decimal format)',
      receivedValue: value,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  // Validate: must be a valid numeric string (optional minus, digits, optional decimal and more digits)
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new OcpValidationError(fieldPath, `Invalid numeric string format`, {
      expectedType: 'string (decimal format)',
      receivedValue: value,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  // If no decimal point, return as-is
  if (!value.includes('.')) {
    return value;
  }

  // Remove trailing zeros after decimal point
  const result = value.replace(/\.?0+$/, '');

  // If we ended up with just an empty string after the decimal, it means there was nothing before it
  // This shouldn't happen with valid numeric strings, but just in case:
  if (result === '') {
    return '0';
  }

  return result;
}

/**
 * Pass through an optional numeric string for DAML fields.
 * Returns null for null/undefined values (DAML optional field semantics).
 */
export function optionalNumberToString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value;
}

/**
 * Convert an optional string to null if it's empty, null, or undefined Used for DAML optional text fields where empty
 * strings should be null This is critical because Daml's validateOptionalText rejects empty strings
 */
export function optionalString(value: string | null | undefined): string | null {
  return !value || value === '' ? null : value;
}

/**
 * Convert an unknown value to a string, returning empty string for null/undefined.
 * Throws for non-string types (numbers, objects, etc.) to prevent silent coercion.
 *
 * Used internally for DAML optional enum fields where null means "not set".
 */
export function safeString(value: unknown, fieldPath = 'safeString'): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  throw new OcpValidationError(fieldPath, `Expected a string value, got ${typeof value}`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'string',
    receivedValue: value,
  });
}

// ===== DAML Enum Conversions =====

/**
 * Convert a DAML trigger type tag to OCF ConversionTriggerType enum value.
 * Used by WarrantIssuance and ConvertibleIssuance converters to map DAML variant tags
 * to the standardized OCF enum values.
 *
 * @param tag - The DAML trigger type tag (e.g., 'OcfTriggerTypeTypeAutomaticOnDate')
 * @param source - Contextual source path used when the tag is unknown
 * @returns The corresponding OCF ConversionTriggerType enum value
 */
export function mapDamlTriggerTypeToOcf(tag: string, source = 'triggerType.tag'): ConversionTriggerType {
  if (tag === 'OcfTriggerTypeTypeAutomaticOnDate') return 'AUTOMATIC_ON_DATE';
  if (tag === 'OcfTriggerTypeTypeAutomaticOnCondition') return 'AUTOMATIC_ON_CONDITION';
  if (tag === 'OcfTriggerTypeTypeElectiveInRange') return 'ELECTIVE_IN_RANGE';
  if (tag === 'OcfTriggerTypeTypeElectiveOnCondition') return 'ELECTIVE_ON_CONDITION';
  if (tag === 'OcfTriggerTypeTypeElectiveAtWill') return 'ELECTIVE_AT_WILL';
  if (tag === 'OcfTriggerTypeTypeUnspecified') return 'UNSPECIFIED';
  throw new OcpParseError(`Unknown trigger type tag: ${tag}`, {
    source,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

// ===== Monetary Value Conversions =====

/** Convert native Monetary to DAML, optionally attributing numeric errors to a caller field. */
export function monetaryToDaml(monetary: Monetary, fieldPath?: string): DamlMonetary {
  return {
    amount: normalizeNumericString(monetary.amount, fieldPath ? `${fieldPath}.amount` : 'numericString'),
    currency: monetary.currency,
  };
}

/** Convert DAML Monetary to native form, optionally attributing numeric errors to a caller field. */
export function damlMonetaryToNative(damlMonetary: DamlMonetary, fieldPath?: string): Monetary {
  return {
    amount: normalizeNumericString(damlMonetary.amount, fieldPath ? `${fieldPath}.amount` : 'numericString'),
    currency: damlMonetary.currency,
  };
}

/**
 * Convert DAML monetary data to native OCF format with validation.
 * Validates that amount and currency fields are present and correctly typed.
 *
 * @param monetary - The raw monetary value (or null/undefined)
 * @param fieldPath - Contextual field path used in structured validation errors
 * @returns The validated native monetary object, or undefined if input is null/undefined
 * @throws OcpValidationError if amount or currency are invalid
 */
export function damlMonetaryToNativeWithValidation(monetary: unknown, fieldPath = 'monetary'): Monetary | undefined {
  if (monetary === null || monetary === undefined) return undefined;
  if (!isRecord(monetary)) {
    throw new OcpValidationError(fieldPath, 'Monetary value must be a non-null object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object or null/undefined',
      receivedValue: monetary,
    });
  }

  // Validate amount exists and is string
  if (monetary.amount === undefined || monetary.amount === null) {
    throw new OcpValidationError(`${fieldPath}.amount`, 'Monetary amount is required but was undefined or null', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: monetary.amount,
    });
  }
  if (typeof monetary.amount !== 'string') {
    throw new OcpValidationError(
      `${fieldPath}.amount`,
      `Monetary amount must be a string, got ${typeof monetary.amount}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: monetary.amount,
      }
    );
  }

  // Validate currency exists and is string
  if (typeof monetary.currency !== 'string' || !monetary.currency) {
    throw new OcpValidationError(
      `${fieldPath}.currency`,
      'Monetary currency is required and must be a non-empty string',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'string',
        receivedValue: monetary.currency,
      }
    );
  }

  let amount: string;
  try {
    amount = normalizeNumericString(monetary.amount, `${fieldPath}.amount`);
  } catch (error) {
    if (error instanceof OcpValidationError) {
      throw new OcpValidationError(`${fieldPath}.amount`, 'Monetary amount must be a valid decimal string', {
        code: error.code,
        ...(error.expectedType !== undefined ? { expectedType: error.expectedType } : {}),
        receivedValue: error.receivedValue,
      });
    }
    throw error;
  }
  return { amount, currency: monetary.currency };
}

// ===== Initial Shares Authorized Conversions =====

/** DAML type for OcfInitialSharesAuthorized union */
type DamlInitialSharesAuthorized =
  | { tag: 'OcfInitialSharesNumeric'; value: string }
  | {
      tag: 'OcfInitialSharesEnum';
      value: 'OcfAuthorizedSharesNotApplicable' | 'OcfAuthorizedSharesUnlimited';
    };

/**
 * Convert initial_shares_authorized value to DAML tagged union format.
 * V30 DAML contracts use OcfInitialSharesAuthorized union type:
 * - OcfInitialSharesNumeric Decimal - for numeric values
 * - OcfInitialSharesEnum - for "UNLIMITED" or "NOT APPLICABLE"
 *
 * @param value - Numeric string, or "UNLIMITED"/"NOT APPLICABLE"
 * @returns DAML-formatted discriminated union
 */
export function initialSharesAuthorizedToDaml(
  value: string,
  fieldPath = 'initial_shares_authorized'
): DamlInitialSharesAuthorized {
  if (value === 'UNLIMITED') {
    return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesUnlimited' };
  }
  if (value === 'NOT APPLICABLE') {
    return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesNotApplicable' };
  }
  return {
    tag: 'OcfInitialSharesNumeric',
    value: canonicalizeNonnegativeDamlNumeric10(
      value,
      fieldPath,
      'nonnegative numeric string or "UNLIMITED"/"NOT APPLICABLE"'
    ),
  };
}

/** Decode the exact generated DAML initial-shares variant into canonical OCF. */
export function initialSharesAuthorizedFromDaml(value: unknown, fieldPath = 'initial_shares_authorized'): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'initial shares variant',
      receivedValue: value,
    });
  }
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'initial shares variant',
      receivedValue: value,
    });
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'tag')) {
    throw new OcpValidationError(`${fieldPath}.tag`, `${fieldPath}.tag is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'initial shares variant tag',
      receivedValue: value.tag,
    });
  }
  if (typeof value.tag !== 'string') {
    throw new OcpValidationError(`${fieldPath}.tag`, `${fieldPath}.tag has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'initial shares variant tag',
      receivedValue: value.tag,
    });
  }

  for (const key of Object.keys(value)) {
    if (key !== 'tag' && key !== 'value') {
      throw new OcpValidationError(`${fieldPath}.${key}`, `${fieldPath} contains a non-generated variant field`, {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: 'exact { tag, value } initial shares variant',
        receivedValue: value[key],
      });
    }
  }

  if (value.tag === 'OcfInitialSharesNumeric') {
    if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
      throw new OcpValidationError(`${fieldPath}.value`, `${fieldPath}.value is required`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'DAML Numeric(10) decimal string',
        receivedValue: value.value,
      });
    }
    if (typeof value.value !== 'string') {
      throw new OcpValidationError(`${fieldPath}.value`, `${fieldPath}.value has an invalid type`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'DAML Numeric(10) decimal string',
        receivedValue: value.value,
      });
    }
    return canonicalizeNonnegativeDamlNumeric10(value.value, `${fieldPath}.value`);
  }

  if (value.tag === 'OcfInitialSharesEnum') {
    if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
      throw new OcpValidationError(`${fieldPath}.value`, `${fieldPath}.value is required`, {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'authorized shares enum constructor',
        receivedValue: value.value,
      });
    }
    if (typeof value.value !== 'string') {
      throw new OcpValidationError(`${fieldPath}.value`, `${fieldPath}.value has an invalid type`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'authorized shares enum constructor',
        receivedValue: value.value,
      });
    }
    if (value.value === 'OcfAuthorizedSharesUnlimited') return 'UNLIMITED';
    if (value.value === 'OcfAuthorizedSharesNotApplicable') return 'NOT APPLICABLE';
    throw new OcpParseError(`Unknown initial_shares_authorized enum value: ${value.value}`, {
      source: `${fieldPath}.value`,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }

  throw new OcpParseError(`Unknown initial_shares_authorized variant: ${value.tag}`, {
    source: `${fieldPath}.tag`,
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

// ===== Address Conversions =====

function addressTypeToDaml(addressType: AddressType): DamlAddressType {
  switch (addressType) {
    case 'LEGAL':
      return 'OcfAddressTypeLegal';
    case 'CONTACT':
      return 'OcfAddressTypeContact';
    case 'OTHER':
      return 'OcfAddressTypeOther';
    default: {
      const exhaustiveCheck: never = addressType;
      throw new OcpParseError(`Unknown address type: ${exhaustiveCheck as string}`, {
        source: 'address.address_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function damlAddressTypeToNative(damlType: DamlAddressType): AddressType {
  switch (damlType) {
    case 'OcfAddressTypeLegal':
      return 'LEGAL';
    case 'OcfAddressTypeContact':
      return 'CONTACT';
    case 'OcfAddressTypeOther':
      return 'OTHER';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new OcpParseError(`Unknown DAML address type: ${exhaustiveCheck as string}`, {
        source: 'address.address_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

export function addressToDaml(address: Address): DamlAddress {
  return {
    address_type: addressTypeToDaml(address.address_type),
    street_suite: optionalString(address.street_suite),
    city: optionalString(address.city),
    country_subdivision: optionalString(address.country_subdivision),
    country: address.country,
    postal_code: optionalString(address.postal_code),
  };
}

export function damlAddressToNative(damlAddress: DamlAddress): Address {
  return {
    address_type: damlAddressTypeToNative(damlAddress.address_type),
    country: damlAddress.country,
    ...(damlAddress.street_suite && { street_suite: damlAddress.street_suite }),
    ...(damlAddress.city && { city: damlAddress.city }),
    ...(damlAddress.country_subdivision && {
      country_subdivision: damlAddress.country_subdivision,
    }),
    ...(damlAddress.postal_code && { postal_code: damlAddress.postal_code }),
  };
}

// ===== DAML Map Helpers =====

/**
 * Parse a DAML Map from JSON API v2 response.
 *
 * DAML Maps are serialized as arrays of key-value tuples:
 * `[[key1, value1], [key2, value2], ...]`
 *
 * @param data - Raw DAML Map data from JSON API response (array of tuples)
 * @param schema - Runtime schema used to validate and infer every tuple key and value
 * @returns Array of [key, value] tuples, or empty array if data is null/undefined
 * @throws OcpParseError if the data format is invalid
 *
 * @example
 * ```typescript
 * const arrayData = [['id1', 'contract1'], ['id2', 'contract2']];
 * const stringEntries = {
 *   key: {
 *     expectedType: 'string',
 *     is: (value: unknown): value is string => typeof value === 'string',
 *   },
 *   value: {
 *     expectedType: 'string',
 *     is: (value: unknown): value is string => typeof value === 'string',
 *   },
 * };
 * parseDamlMap(arrayData, stringEntries); // Returns [['id1', 'contract1'], ['id2', 'contract2']]
 *
 * const entries = parseDamlMap(data, stringEntries);
 * const map = new Map(entries);
 * ```
 */
export interface DamlMapElementSchema<Element> {
  /** Human-readable type used in parse diagnostics. */
  readonly expectedType: string;
  /** Runtime guard whose predicate also determines the returned element type. */
  readonly is: (value: unknown) => value is Element;
}

export interface DamlMapSchema<Key extends string, Value> {
  /** Runtime schema for every tuple key. */
  readonly key: DamlMapElementSchema<Key>;
  /** Runtime schema for every tuple value. */
  readonly value: DamlMapElementSchema<Value>;
  /** Optional ledger field/path used as the parse-error source. */
  readonly source?: string;
}

function damlMapReceivedType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function damlMapParseError(
  message: string,
  context: Record<string, unknown>,
  source: string | undefined
): OcpParseError {
  return new OcpParseError(message, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    ...(source !== undefined ? { source } : {}),
    context,
  });
}

export function parseDamlMap<Key extends string, Value>(
  data: unknown,
  schema: DamlMapSchema<Key, Value>
): Array<[Key, Value]> {
  if (data == null) {
    return [];
  }

  // Validate the complete graph before reading array lengths, tuple indexes, or
  // user-supplied guards. This rejects proxies, accessors, cycles, sparse or
  // oversized arrays, and custom prototypes without executing hostile code.
  assertSafeGeneratedDamlJson(data, schema.source ?? 'parseDamlMap');

  if (!Array.isArray(data)) {
    const receivedType = damlMapReceivedType(data);
    throw damlMapParseError(
      `parseDamlMap: Expected array of tuples, got ${receivedType}`,
      {
        location: 'map',
        expectedType: 'array of [string, value] tuples',
        receivedType,
      },
      schema.source
    );
  }

  const firstTupleIndexByKey = new Map<Key, number>();
  const result: Array<[Key, Value]> = [];

  for (let index = 0; index < data.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(data, index)) {
      throw damlMapParseError(
        `parseDamlMap: Invalid tuple at index ${index} - expected [key, value]`,
        {
          tupleIndex: index,
          expectedType: '[string, value] tuple',
          receivedType: 'missing',
        },
        schema.source
      );
    }

    const entry: unknown = data[index];
    const hasOwnKey = Array.isArray(entry) && Object.prototype.hasOwnProperty.call(entry, 0);
    const hasOwnValue = Array.isArray(entry) && Object.prototype.hasOwnProperty.call(entry, 1);
    if (!Array.isArray(entry) || entry.length !== 2 || !hasOwnKey || !hasOwnValue) {
      throw damlMapParseError(
        `parseDamlMap: Invalid tuple at index ${index} - expected [key, value]`,
        {
          tupleIndex: index,
          expectedType: '[string, value] tuple',
          receivedType: damlMapReceivedType(entry),
          ...(Array.isArray(entry) ? { receivedLength: entry.length } : {}),
          ...(Array.isArray(entry) && (!hasOwnKey || !hasOwnValue)
            ? {
                missingTuplePositions: [...(!hasOwnKey ? ['key'] : []), ...(!hasOwnValue ? ['value'] : [])],
              }
            : {}),
        },
        schema.source
      );
    }
    const key: unknown = entry[0];
    const value: unknown = entry[1];
    if (!schema.key.is(key)) {
      const receivedType = damlMapReceivedType(key);
      throw damlMapParseError(
        `parseDamlMap: Invalid key at tuple index ${index} - expected ${schema.key.expectedType}, got ${receivedType}`,
        {
          tupleIndex: index,
          tuplePosition: 'key',
          expectedType: schema.key.expectedType,
          receivedType,
        },
        schema.source
      );
    }

    const originalTupleIndex = firstTupleIndexByKey.get(key);
    if (originalTupleIndex !== undefined) {
      throw damlMapParseError(
        `parseDamlMap: Duplicate key at tuple index ${index}; first seen at tuple index ${originalTupleIndex}`,
        {
          tupleIndex: index,
          tuplePosition: 'key',
          tupleKey: key,
          duplicateTupleIndex: index,
          originalTupleIndex,
        },
        schema.source
      );
    }

    if (!schema.value.is(value)) {
      const receivedType = damlMapReceivedType(value);
      throw damlMapParseError(
        `parseDamlMap: Invalid value at tuple index ${index} - expected ${schema.value.expectedType}, got ${receivedType}`,
        {
          tupleIndex: index,
          tuplePosition: 'value',
          tupleKey: key,
          expectedType: schema.value.expectedType,
          receivedType,
        },
        schema.source
      );
    }

    firstTupleIndexByKey.set(key, index);
    result.push([key, value]);
  }

  return result;
}

// ===== Data Cleaning Helpers =====

/**
 * Ensure a value is an array, normalizing null/undefined to an empty array.
 *
 * This is useful for OCF fields that should be arrays but may come from raw data
 * where they are null or undefined. The SDK normalizes these to empty arrays
 * to satisfy DAML contract requirements.
 *
 * @param value - The value to normalize (may be undefined, null, or an array)
 * @returns The array value, or an empty array if the input was null/undefined
 *
 * @example
 *   ```typescript
 *   ensureArray([1, 2, 3]); // Returns [1, 2, 3]
 *   ensureArray(null); // Returns []
 *   ensureArray(undefined); // Returns []
 *   ```
 */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/** Return a non-empty tuple or fail when an external array violates its schema cardinality. */
export function toNonEmptyArray<T>(values: readonly T[], fieldPath: string): NonEmptyArray<T> {
  if (!Array.isArray(values)) {
    throw new OcpValidationError(fieldPath, 'Expected an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: values,
    });
  }
  if (values.length === 0) {
    throw new OcpValidationError(fieldPath, 'Array must contain at least one item', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'array with at least one item',
      receivedValue: values,
    });
  }
  const [first, ...rest] = values as unknown as readonly [T, ...T[]];
  return [first, ...rest];
}

/** Omit an optional array when empty; otherwise preserve its non-empty cardinality in the return type. */
export function nonEmptyArrayOrUndefined<T>(values: readonly T[], fieldPath: string): NonEmptyArray<T> | undefined {
  if (!Array.isArray(values)) {
    throw new OcpValidationError(fieldPath, 'Expected an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: values,
    });
  }
  if (values.length === 0) return undefined;
  const [first, ...rest] = values as unknown as readonly [T, ...T[]];
  return [first, ...rest];
}

/**
 * Filter out empty string entries from a comments array.
 * Defensively handles null values that may appear at runtime despite TypeScript types.
 */
export function cleanComments(comments?: Array<string | null>): string[] {
  const runtimeComments: unknown = comments;
  if (runtimeComments === undefined || runtimeComments === null) return [];
  if (!Array.isArray(runtimeComments)) {
    throw new OcpValidationError('comments', 'Comments must be an array when provided', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string[] or omitted',
      receivedValue: runtimeComments,
    });
  }
  return runtimeComments.filter((c): c is string => typeof c === 'string' && c.trim() !== '');
}

// ===== Shared DAML-to-Native Transfer/Cancellation Helpers =====

/**
 * Common DAML data structure for quantity-based transfers (Stock, Warrant, EquityCompensation).
 * All three share the same field structure for the transfer operation.
 */
export interface DamlQuantityTransferData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

/**
 * Common native output structure for quantity-based transfers.
 * The entity-specific converters will assert the correct return type.
 */
export interface NativeQuantityTransferData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  resulting_security_ids: NonEmptyArray<string>;
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

/**
 * Convert DAML quantity-based transfer data to native OCF format.
 * Used by Stock, Warrant, and EquityCompensation transfer converters.
 *
 * @param d - The DAML transfer data object
 * @param dateFieldPath - Contextual path for date validation failures
 * @returns The native transfer object (without object_type)
 */
export function quantityTransferToNative(
  d: DamlQuantityTransferData,
  dateFieldPath: string
): NativeQuantityTransferData {
  const fieldPathSeparator = dateFieldPath.lastIndexOf('.');
  const fieldPathPrefix = fieldPathSeparator >= 0 ? dateFieldPath.slice(0, fieldPathSeparator + 1) : '';

  return {
    id: d.id,
    date: damlTimeToDateString(d.date, dateFieldPath),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: toNonEmptyArray(d.resulting_security_ids, `${fieldPathPrefix}resulting_security_ids`),
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

/**
 * Common DAML data structure for quantity-based cancellations (Stock, Warrant, EquityCompensation).
 * All three share the same field structure for the cancellation operation.
 */
export interface DamlQuantityCancellationData {
  readonly id: string;
  readonly date: string;
  readonly security_id: string;
  readonly quantity: string;
  readonly reason_text: string;
  readonly balance_security_id: string | null;
  readonly comments: string[];
}

/**
 * Common native output structure for quantity-based cancellations.
 * The entity-specific converters will assert the correct return type.
 */
export interface NativeQuantityCancellationData {
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  balance_security_id?: string;
  comments?: string[];
}

/** Decode the generated DAML Optional used for cancellation balance securities without truthiness coercion. */
export function cancellationBalanceSecurityIdFromDaml(value: unknown, fieldPath: string): string | undefined {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be null or a non-empty string`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'null or non-empty string',
      receivedValue: value,
    });
  }
  if (value === null) return undefined;
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'null or non-empty string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must not be empty`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'null or non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** Encode an optional OCF cancellation balance security without collapsing an explicit empty identifier. */
export function cancellationBalanceSecurityIdToDaml(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string or omitted property',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must not be empty`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string or omitted property',
      receivedValue: value,
    });
  }
  return value;
}

/**
 * Convert DAML quantity-based cancellation data to native OCF format.
 * Used by Stock, Warrant, and EquityCompensation cancellation converters.
 *
 * @param d - The DAML cancellation data object
 * @param dateFieldPath - Contextual path for date validation failures
 * @returns The native cancellation object (without object_type)
 */
export function quantityCancellationToNative(
  d: DamlQuantityCancellationData,
  dateFieldPath: string
): NativeQuantityCancellationData {
  const fieldPathSeparator = dateFieldPath.lastIndexOf('.');
  const fieldPathPrefix = fieldPathSeparator >= 0 ? dateFieldPath.slice(0, fieldPathSeparator + 1) : '';
  const balanceSecurityId = cancellationBalanceSecurityIdFromDaml(
    d.balance_security_id,
    `${fieldPathPrefix}balance_security_id`
  );

  return {
    id: d.id,
    date: damlTimeToDateString(d.date, dateFieldPath),
    security_id: d.security_id,
    quantity: canonicalizeNonnegativeDamlNumeric10(d.quantity, `${fieldPathPrefix}quantity`),
    reason_text: d.reason_text,
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}
