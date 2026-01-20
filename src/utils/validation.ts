/**
 * Centralized input validation utilities for OCF operations.
 *
 * These utilities provide consistent, actionable error messages and
 * reduce duplicated validation logic across the codebase.
 *
 * @example
 *   ```typescript
 *   import { validateRequiredString, validateRequiredNumeric, ValidationError } from './validation';
 *
 *   function createStakeholder(params: CreateStakeholderParams) {
 *     validateRequiredString(params.data.id, 'stakeholder.id');
 *     validateRequiredString(params.data.name.legal_name, 'stakeholder.name.legal_name');
 *     // ...
 *   }
 *   ```
 */

/**
 * Custom error class for validation failures.
 * Includes the field path for easier debugging.
 */
export class ValidationError extends Error {
  /** The field path that failed validation (e.g., "stakeholder.name.legal_name") */
  public readonly fieldPath: string;
  /** The expected type or format */
  public readonly expected: string;
  /** The actual value received (stringified for display) */
  public readonly received: string;

  constructor(fieldPath: string, expected: string, received: unknown) {
    const receivedStr = received === undefined ? 'undefined' : received === null ? 'null' : JSON.stringify(received);
    const message = `Validation failed for '${fieldPath}': expected ${expected}, received ${receivedStr}`;
    super(message);
    this.name = 'ValidationError';
    this.fieldPath = fieldPath;
    this.expected = expected;
    this.received = receivedStr;
  }
}

// ===== String Validation =====

/**
 * Validate that a value is a non-empty string.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages (e.g., "stakeholder.id")
 * @throws {ValidationError} if the value is not a non-empty string
 */
export function validateRequiredString(value: unknown, fieldPath: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError(fieldPath, 'non-empty string', value);
  }
  if (value.length === 0) {
    throw new ValidationError(fieldPath, 'non-empty string', '""');
  }
}

/**
 * Validate that a value is a string or undefined/null.
 * Returns the string or null for DAML optional fields.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The string value or null
 * @throws {ValidationError} if the value is not a string, undefined, or null
 */
export function validateOptionalString(value: unknown, fieldPath: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(fieldPath, 'string, undefined, or null', value);
  }
  return value.length > 0 ? value : null;
}

// ===== Numeric Validation =====

/**
 * Validate that a value is a valid numeric (number or numeric string).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a valid numeric
 */
export function validateRequiredNumeric(value: unknown, fieldPath: string): asserts value is string | number {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      throw new ValidationError(fieldPath, 'valid number', 'NaN');
    }
    return;
  }
  if (typeof value === 'string') {
    if (value.length === 0) {
      throw new ValidationError(fieldPath, 'non-empty numeric string', '""');
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new ValidationError(fieldPath, 'valid numeric string', value);
    }
    return;
  }
  throw new ValidationError(fieldPath, 'number or numeric string', value);
}

/**
 * Validate and convert a numeric value to string for DAML.
 * Returns null for undefined/null values.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The numeric value as a string, or null
 */
export function validateOptionalNumeric(value: unknown, fieldPath: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateRequiredNumeric(value, fieldPath);
  return typeof value === 'number' ? value.toString() : value;
}

/**
 * Validate that a numeric value is within a range (inclusive).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @throws {ValidationError} if the value is outside the range
 */
export function validateNumericRange(value: number | string, fieldPath: string, min: number, max: number): void {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num < min || num > max) {
    throw new ValidationError(fieldPath, `number between ${min} and ${max}`, num);
  }
}

/**
 * Validate that a numeric value is positive (> 0).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not positive
 */
export function validatePositiveNumeric(value: number | string, fieldPath: string): void {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num <= 0) {
    throw new ValidationError(fieldPath, 'positive number (> 0)', num);
  }
}

/**
 * Validate that a numeric value is non-negative (>= 0).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is negative
 */
export function validateNonNegativeNumeric(value: number | string, fieldPath: string): void {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num < 0) {
    throw new ValidationError(fieldPath, 'non-negative number (>= 0)', num);
  }
}

// ===== Date Validation =====

/**
 * Validate that a value is a valid ISO date string (YYYY-MM-DD).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a valid ISO date string
 */
export function validateRequiredDate(value: unknown, fieldPath: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError(fieldPath, 'ISO date string (YYYY-MM-DD)', value);
  }
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) {
    throw new ValidationError(fieldPath, 'ISO date string (YYYY-MM-DD)', value);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(fieldPath, 'valid date', value);
  }
}

/**
 * Validate that a value is a valid ISO date string or undefined/null.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The date string or null
 */
export function validateOptionalDate(value: unknown, fieldPath: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateRequiredDate(value, fieldPath);
  return value;
}

// ===== Enum Validation =====

/**
 * Validate that a value is one of the allowed enum values.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @param allowedValues - Array of allowed values
 * @throws {ValidationError} if the value is not in the allowed list
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldPath: string,
  allowedValues: readonly T[]
): asserts value is T {
  if (typeof value !== 'string') {
    throw new ValidationError(fieldPath, `one of: ${allowedValues.join(', ')}`, value);
  }
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(fieldPath, `one of: ${allowedValues.join(', ')}`, value);
  }
}

/**
 * Validate an optional enum value.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @param allowedValues - Array of allowed values
 * @returns The value or null
 */
export function validateOptionalEnum<T extends string>(
  value: unknown,
  fieldPath: string,
  allowedValues: readonly T[]
): T | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateEnum(value, fieldPath, allowedValues);
  return value;
}

// ===== Array Validation =====

/**
 * Validate that a value is a non-empty array.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a non-empty array
 */
export function validateRequiredArray<T>(value: unknown, fieldPath: string): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(fieldPath, 'non-empty array', value);
  }
  if (value.length === 0) {
    throw new ValidationError(fieldPath, 'non-empty array', '[]');
  }
}

/**
 * Validate an optional array (can be undefined/null or array with items).
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The array or null
 */
export function validateOptionalArray<T>(value: unknown, fieldPath: string): T[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new ValidationError(fieldPath, 'array, undefined, or null', value);
  }
  return value.length > 0 ? value : null;
}

// ===== Object Validation =====

/**
 * Validate that a value is a non-null object.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a non-null object
 */
export function validateRequiredObject(value: unknown, fieldPath: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(fieldPath, 'non-null object', value);
  }
}

/**
 * Validate an optional object.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The object or null
 */
export function validateOptionalObject(value: unknown, fieldPath: string): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateRequiredObject(value, fieldPath);
  return value;
}

// ===== Monetary Validation =====

/**
 * Monetary object structure for validation.
 */
export interface ValidatedMonetary {
  amount: string;
  currency: string;
}

/**
 * Validate that a value is a valid Monetary object.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a valid Monetary object
 */
export function validateRequiredMonetary(value: unknown, fieldPath: string): asserts value is ValidatedMonetary {
  validateRequiredObject(value, fieldPath);
  const obj = value;
  validateRequiredNumeric(obj.amount, `${fieldPath}.amount`);
  validateRequiredString(obj.currency, `${fieldPath}.currency`);
}

/**
 * Validate an optional Monetary object.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @returns The validated monetary object or null
 */
export function validateOptionalMonetary(value: unknown, fieldPath: string): ValidatedMonetary | null {
  if (value === undefined || value === null) {
    return null;
  }
  validateRequiredMonetary(value, fieldPath);
  const obj = value as { amount: string | number; currency: string };
  return {
    amount: typeof obj.amount === 'number' ? obj.amount.toString() : obj.amount,
    currency: obj.currency,
  };
}

// ===== Contract ID Validation =====

/**
 * Validate that a value is a valid Canton contract ID.
 * Contract IDs are typically in format: hexdigits:hexdigits or just hexdigits.
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a valid contract ID
 */
export function validateContractId(value: unknown, fieldPath: string): asserts value is string {
  validateRequiredString(value, fieldPath);
  // Contract IDs should be non-empty strings; the exact format is flexible
  // but they should not contain whitespace
  if (/\s/.test(value)) {
    throw new ValidationError(fieldPath, 'contract ID without whitespace', value);
  }
}

// ===== Party ID Validation =====

/**
 * Validate that a value is a valid Canton party ID.
 * Party IDs typically follow the format: identifier::fingerprint
 *
 * @param value - The value to validate
 * @param fieldPath - Dot-notation path for error messages
 * @throws {ValidationError} if the value is not a valid party ID
 */
export function validatePartyId(value: unknown, fieldPath: string): asserts value is string {
  validateRequiredString(value, fieldPath);
  // Basic validation - party IDs should not contain whitespace
  if (/\s/.test(value)) {
    throw new ValidationError(fieldPath, 'party ID without whitespace', value);
  }
}

// ===== Composite Validators =====

/**
 * Validate all items in an array using a validator function.
 *
 * @param items - The array of items to validate
 * @param fieldPath - Base path for error messages
 * @param itemValidator - Function to validate each item
 */
export function validateArrayItems<T>(
  items: unknown[],
  fieldPath: string,
  itemValidator: (item: unknown, itemPath: string) => asserts item is T
): asserts items is T[] {
  for (let i = 0; i < items.length; i++) {
    itemValidator(items[i], `${fieldPath}[${i}]`);
  }
}

/**
 * Create a composite validator that runs multiple validations.
 *
 * @example
 *   ```typescript
 *   const validateStakeholder = createValidator<OcfStakeholder>(
 *     (value, path) => {
 *       validateRequiredString(value.id, `${path}.id`);
 *       validateRequiredObject(value.name, `${path}.name`);
 *       validateRequiredString(value.name?.legal_name, `${path}.name.legal_name`);
 *       validateEnum(value.stakeholder_type, `${path}.stakeholder_type`, ['INDIVIDUAL', 'INSTITUTION']);
 *     }
 *   );
 *
 *   validateStakeholder(data, 'stakeholder');
 *   ```
 */
export function createValidator<T>(
  validatorFn: (value: Record<string, unknown>, fieldPath: string) => void
): (value: unknown, fieldPath: string) => asserts value is T {
  return (value: unknown, fieldPath: string): asserts value is T => {
    validateRequiredObject(value, fieldPath);
    validatorFn(value, fieldPath);
  };
}
