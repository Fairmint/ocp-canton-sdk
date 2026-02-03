/**
 * Utility functions to convert between DAML types and TypeScript-native types
 *
 * This file contains ONLY shared helper functions used by multiple entity conversion files. Entity-specific conversions
 * have been moved to their respective function files.
 */

import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../errors';
import type { Address, AddressType, Monetary } from '../types/native';

// ===== Date and Time Conversion Helpers =====

/**
 * Convert a date string (YYYY-MM-DD) to DAML Time format (ISO string with 0 timestamp) DAML Time expects a string in
 * the format YYYY-MM-DDTHH:MM:SS.000Z Since we only care about the date, we use 00:00:00.000Z for the time portion If
 * the date already has a time portion, return it as-is
 */
export function dateStringToDAMLTime(dateString: string): string {
  // If already has time portion, return as-is
  if (dateString.includes('T')) {
    return dateString;
  }
  return `${dateString}T00:00:00.000Z`;
}

/**
 * Convert a RelTime value (as microseconds string) to DAML RelTime format DAML RelTime is serialized as an object with
 * a microseconds field
 */
export function relTimeToDAML(microseconds: string): { microseconds: string } {
  return { microseconds };
}

/** Convert a DAML Time string back to a date string (YYYY-MM-DD) Extract only the date portion and return as string */
export function damlTimeToDateString(timeString: string): string {
  // Extract just the date portion (YYYY-MM-DD)
  return timeString.split('T')[0];
}

/** Convert a number or string to a string Used for DAML numeric fields that require string values */
export function numberToString(value: number | string): string {
  return typeof value === 'number' ? value.toString() : value;
}

/**
 * Normalize a numeric string by removing trailing zeros after the decimal point. DAML returns numbers like
 * "5000000.0000000000" but OCF expects "5000000". Also handles removing the decimal point if all fractional digits are
 * zeros.
 *
 * @throws OcpValidationError if the string contains scientific notation (e.g., "1.5e10") or is not a valid numeric string
 */
export function normalizeNumericString(value: string): string {
  // Validate: reject scientific notation
  if (value.toLowerCase().includes('e')) {
    throw new OcpValidationError('numericString', `Scientific notation is not supported`, {
      expectedType: 'string (decimal format)',
      receivedValue: value,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  // Validate: must be a valid numeric string (optional minus, digits, optional decimal and more digits)
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new OcpValidationError('numericString', `Invalid numeric string format`, {
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
 * Convert a number, string, null or undefined to a string or undefined Used for optional DAML numeric fields that
 * require string values
 */
export function optionalNumberToString(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'number' ? value.toString() : value;
}

/**
 * Convert an optional string to null if it's empty, null, or undefined Used for DAML optional text fields where empty
 * strings should be null This is critical because Daml's validateOptionalText rejects empty strings
 */
export function optionalString(value: string | null | undefined): string | null {
  return !value || value === '' ? null : value;
}

/**
 * Safely convert an unknown value to a string Returns empty string if value is null, undefined, or not a string/number
 * Used when parsing DAML values that might be in various formats
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  // For objects, try to get a meaningful string representation
  if (typeof value === 'object') {
    // Handle DAML tagged unions
    if ('tag' in value && typeof (value as { tag?: unknown }).tag === 'string') {
      return (value as { tag: string }).tag;
    }
  }
  return '';
}

// ===== Monetary Value Conversions =====

export function monetaryToDaml(monetary: Monetary): Fairmint.OpenCapTable.Types.Monetary.OcfMonetary {
  return {
    amount: typeof monetary.amount === 'number' ? monetary.amount.toString() : monetary.amount,
    currency: monetary.currency,
  };
}

export function damlMonetaryToNative(damlMonetary: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary): Monetary {
  return {
    amount: normalizeNumericString(damlMonetary.amount),
    currency: damlMonetary.currency,
  };
}

// ===== Initial Shares Authorized Conversions =====

/** DAML type for OcfInitialSharesAuthorized union */
type DamlInitialSharesAuthorized = Fairmint.OpenCapTable.Types.Stock.OcfInitialSharesAuthorized;

/** DAML type for OcfAuthorizedShares enum */
type DamlAuthorizedShares = Fairmint.OpenCapTable.Types.Stock.OcfAuthorizedShares;

/**
 * Convert initial_shares_authorized value to DAML tagged union format.
 * V30 DAML contracts use OcfInitialSharesAuthorized union type:
 * - OcfInitialSharesNumeric Decimal - for numeric values
 * - OcfInitialSharesEnum - for "UNLIMITED" or "NOT_APPLICABLE"
 *
 * @param value - Native value (number, numeric string, or "UNLIMITED"/"NOT_APPLICABLE")
 * @returns DAML-formatted discriminated union
 */
export function initialSharesAuthorizedToDaml(value: string | number): DamlInitialSharesAuthorized {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) {
    return {
      tag: 'OcfInitialSharesNumeric',
      value: typeof value === 'number' ? value.toString() : value,
    };
  }
  const enumValue: DamlAuthorizedShares =
    value === 'UNLIMITED' ? 'OcfAuthorizedSharesUnlimited' : 'OcfAuthorizedSharesNotApplicable';
  return { tag: 'OcfInitialSharesEnum', value: enumValue };
}

// ===== Address Conversions =====

function addressTypeToDaml(addressType: AddressType): Fairmint.OpenCapTable.Types.Monetary.OcfAddressType {
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

function damlAddressTypeToNative(damlType: Fairmint.OpenCapTable.Types.Monetary.OcfAddressType): AddressType {
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

export function addressToDaml(address: Address): Fairmint.OpenCapTable.Types.Monetary.OcfAddress {
  return {
    address_type: addressTypeToDaml(address.address_type),
    street_suite: optionalString(address.street_suite),
    city: optionalString(address.city),
    country_subdivision: optionalString(address.country_subdivision),
    country: address.country,
    postal_code: optionalString(address.postal_code),
  };
}

export function damlAddressToNative(damlAddress: Fairmint.OpenCapTable.Types.Monetary.OcfAddress): Address {
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

/** Remove empty string entries from comments array (mutates in place and returns the object) */
export function cleanComments(comments?: Array<string | null>): string[] {
  if (Array.isArray(comments)) {
    const filtered = comments.filter((c): c is string => typeof c === 'string' && c.trim() !== '');
    return filtered.length > 0 ? filtered : [];
  }

  return [];
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
  resulting_security_ids: string[];
  balance_security_id?: string;
  consideration_text?: string;
  comments?: string[];
}

/**
 * Convert DAML quantity-based transfer data to native OCF format.
 * Used by Stock, Warrant, and EquityCompensation transfer converters.
 *
 * @param d - The DAML transfer data object
 * @returns The native transfer object (without object_type)
 */
export function quantityTransferToNative(d: DamlQuantityTransferData): NativeQuantityTransferData {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
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
  id: string;
  date: string;
  security_id: string;
  quantity: string;
  reason_text: string;
  balance_security_id?: string;
  comments?: string[];
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

/**
 * Convert DAML quantity-based cancellation data to native OCF format.
 * Used by Stock, Warrant, and EquityCompensation cancellation converters.
 *
 * @param d - The DAML cancellation data object
 * @returns The native cancellation object (without object_type)
 */
export function quantityCancellationToNative(d: DamlQuantityCancellationData): NativeQuantityCancellationData {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    security_id: d.security_id,
    quantity: normalizeNumericString(d.quantity),
    reason_text: d.reason_text,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// ===== Transaction Response Helpers =====

/**
 * Extract updateId from a transaction tree response. The updateId can be at different paths depending on the Canton
 * version. This function checks both possible locations in a type-safe way.
 */
export function extractUpdateId(response: SubmitAndWaitForTransactionTreeResponse): string {
  const tree = response.transactionTree as Record<string, unknown>;

  // Try direct updateId first
  if (typeof tree.updateId === 'string') {
    return tree.updateId;
  }

  // Try transaction.updateId as fallback
  const transaction = tree.transaction as Record<string, unknown> | undefined;
  if (transaction && typeof transaction.updateId === 'string') {
    return transaction.updateId;
  }

  throw new OcpContractError('updateId not found in transaction tree', {
    code: OcpErrorCodes.RESULT_NOT_FOUND,
  });
}
