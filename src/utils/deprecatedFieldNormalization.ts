/**
 * Utilities for normalizing deprecated OCF fields to their current equivalents.
 *
 * OCF schema evolves over time, and some fields are deprecated in favor of new ones.
 * These utilities provide type-safe normalization and verification helpers.
 *
 * @example
 *   ```typescript
 *   import { normalizeSingularToArray, normalizeDeprecatedStockPlanFields } from './deprecatedFieldNormalization';
 *
 *   // Generic singular → array normalization
 *   const stockClassIds = normalizeSingularToArray({
 *     singularValue: data.stock_class_id,
 *     arrayValue: data.stock_class_ids,
 *   });
 *
 *   // Stock plan specific helper
 *   const normalized = normalizeDeprecatedStockPlanFields(inputData);
 *   ```
 */

// ===== Deprecation Warning Configuration =====

/**
 * Configuration for deprecation warnings.
 * Can be customized for testing or production environments.
 */
export interface DeprecationWarningConfig {
  /** Whether to emit console warnings for deprecated field usage (default: true in development) */
  enabled: boolean;
  /** Custom warning handler (default: console.warn) */
  handler?: (message: string, details: DeprecationDetails) => void;
}

/**
 * Details about a deprecated field usage.
 */
export interface DeprecationDetails {
  /** Name of the deprecated field */
  deprecatedField: string;
  /** Name of the replacement field */
  replacementField: string;
  /** The deprecated value that was provided */
  deprecatedValue: unknown;
  /** Context about where the deprecation occurred */
  context?: string;
}

/**
 * Global deprecation warning configuration.
 * Can be modified for testing or to customize warning behavior.
 */
export const deprecationWarningConfig: DeprecationWarningConfig = {
  enabled: process.env.NODE_ENV !== 'test',
  handler: undefined,
};

/**
 * Emit a deprecation warning.
 *
 * @param details - Details about the deprecated field usage
 */
export function emitDeprecationWarning(details: DeprecationDetails): void {
  if (!deprecationWarningConfig.enabled) {
    return;
  }

  const message =
    `[OCF Deprecation] Field '${details.deprecatedField}' is deprecated. ` +
    `Use '${details.replacementField}' instead.${details.context ? ` Context: ${details.context}` : ''}`;

  if (deprecationWarningConfig.handler) {
    deprecationWarningConfig.handler(message, details);
  } else {
    // eslint-disable-next-line no-console -- Intentional deprecation warning to help developers migrate to current API
    console.warn(message);
  }
}

// ===== Generic Normalization Helpers =====

/**
 * Parameters for normalizing a singular deprecated field to an array field.
 */
export interface SingularToArrayParams<T> {
  /** The deprecated singular value (may be undefined) */
  singularValue: T | undefined;
  /** The current array value (may be undefined or empty) */
  arrayValue: T[] | undefined;
  /** Name of the deprecated field (for warnings) */
  deprecatedFieldName?: string;
  /** Name of the replacement field (for warnings) */
  replacementFieldName?: string;
  /** Context for the warning message */
  context?: string;
}

/**
 * Normalize a deprecated singular field to an array field.
 *
 * When both singular and array values are provided, the array takes precedence.
 * If the array is empty/undefined but singular has a value, wraps it in an array.
 *
 * @param params - Parameters for the normalization
 * @returns The normalized array value (empty array if both inputs are empty/undefined)
 *
 * @example
 *   ```typescript
 *   // Only deprecated field provided
 *   normalizeSingularToArray({
 *     singularValue: 'class-1',
 *     arrayValue: undefined,
 *   }); // Returns ['class-1']
 *
 *   // Both provided - array takes precedence
 *   normalizeSingularToArray({
 *     singularValue: 'class-1',
 *     arrayValue: ['class-2', 'class-3'],
 *   }); // Returns ['class-2', 'class-3']
 *
 *   // Neither provided
 *   normalizeSingularToArray({
 *     singularValue: undefined,
 *     arrayValue: undefined,
 *   }); // Returns []
 *   ```
 */
export function normalizeSingularToArray<T>(params: SingularToArrayParams<T>): T[] {
  const { singularValue, arrayValue, deprecatedFieldName, replacementFieldName, context } = params;

  // If array has values, use it (ignoring deprecated singular)
  if (Array.isArray(arrayValue) && arrayValue.length > 0) {
    return arrayValue;
  }

  // If singular value exists, convert to array and emit warning
  // Also exclude empty strings to match original truthy-check behavior
  if (singularValue !== undefined && singularValue !== null && singularValue !== '') {
    if (deprecatedFieldName && replacementFieldName) {
      emitDeprecationWarning({
        deprecatedField: deprecatedFieldName,
        replacementField: replacementFieldName,
        deprecatedValue: singularValue,
        context,
      });
    }
    return [singularValue];
  }

  // Neither provided - return empty array
  return [];
}

// ===== Stock Plan Specific Helpers =====

/**
 * Input type that may contain deprecated stock_class_id field.
 * This matches OCF data that may come from older schemas.
 *
 * Note: Fields can be null (not just undefined) when parsing JSON data from external sources.
 */
export interface StockPlanDataWithDeprecatedField {
  /** The current array field for stock class associations */
  stock_class_ids?: string[] | null;
  /** @deprecated Use stock_class_ids instead. Deprecated field from older OCF versions. */
  stock_class_id?: string | null;
}

/**
 * Result of normalizing deprecated stock plan fields.
 */
export interface NormalizedStockPlanFields {
  /** Normalized array of stock class IDs */
  stock_class_ids: string[];
  /** Whether a deprecated field was used */
  usedDeprecatedField: boolean;
}

/**
 * Normalize deprecated stock plan fields.
 *
 * Handles the OCF deprecation of `stock_class_id` (singular) → `stock_class_ids` (array).
 *
 * @param data - Stock plan data that may contain deprecated fields
 * @param context - Optional context for deprecation warnings (e.g., "stockPlan.create")
 * @returns Object containing normalized stock_class_ids and deprecation usage flag
 *
 * @example
 *   ```typescript
 *   // Old format (deprecated)
 *   const result = normalizeDeprecatedStockPlanFields({
 *     stock_class_id: 'sc-1',
 *   });
 *   // Returns { stock_class_ids: ['sc-1'], usedDeprecatedField: true }
 *
 *   // New format
 *   const result = normalizeDeprecatedStockPlanFields({
 *     stock_class_ids: ['sc-1', 'sc-2'],
 *   });
 *   // Returns { stock_class_ids: ['sc-1', 'sc-2'], usedDeprecatedField: false }
 *   ```
 */
export function normalizeDeprecatedStockPlanFields(
  data: StockPlanDataWithDeprecatedField,
  context?: string
): NormalizedStockPlanFields {
  // Also exclude empty strings to match original truthy-check behavior
  const hasDeprecatedField =
    data.stock_class_id !== undefined && data.stock_class_id !== null && data.stock_class_id !== '';
  const hasCurrentField = Array.isArray(data.stock_class_ids) && data.stock_class_ids.length > 0;

  // Only count as using deprecated field if deprecated is present and current is not
  const usedDeprecatedField = hasDeprecatedField && !hasCurrentField;

  // Normalize null to undefined for the generic function, then filter results
  const singularValue = data.stock_class_id ?? undefined;
  const arrayValue = data.stock_class_ids ?? undefined;

  const stock_class_ids = normalizeSingularToArray({
    singularValue,
    arrayValue,
    deprecatedFieldName: 'stock_class_id',
    replacementFieldName: 'stock_class_ids',
    context: context ?? 'StockPlan',
  });

  return {
    stock_class_ids,
    usedDeprecatedField,
  };
}

// ===== Verification Helpers =====

/**
 * Result of checking for deprecated field usage.
 */
export interface DeprecatedFieldUsageResult {
  /** Whether any deprecated fields were detected */
  hasDeprecatedFields: boolean;
  /** List of deprecated fields that were used */
  deprecatedFieldsUsed: string[];
}

/**
 * Check stock plan data for deprecated field usage without modifying the data.
 *
 * @param data - Stock plan data to check
 * @returns Result indicating whether deprecated fields were used
 *
 * @example
 *   ```typescript
 *   const result = checkStockPlanDeprecatedFieldUsage({
 *     stock_class_id: 'sc-1', // deprecated
 *   });
 *   // Returns { hasDeprecatedFields: true, deprecatedFieldsUsed: ['stock_class_id'] }
 *   ```
 */
export function checkStockPlanDeprecatedFieldUsage(data: StockPlanDataWithDeprecatedField): DeprecatedFieldUsageResult {
  const deprecatedFieldsUsed: string[] = [];

  // Check for deprecated stock_class_id field (exclude empty strings to match original truthy-check behavior)
  if (data.stock_class_id !== undefined && data.stock_class_id !== null && data.stock_class_id !== '') {
    deprecatedFieldsUsed.push('stock_class_id');
  }

  return {
    hasDeprecatedFields: deprecatedFieldsUsed.length > 0,
    deprecatedFieldsUsed,
  };
}

// ===== Generic Deprecated Field Detection =====

/**
 * Configuration for a deprecated field mapping.
 */
export interface DeprecatedFieldMapping {
  /** The deprecated field name */
  deprecatedField: string;
  /** The replacement field name */
  replacementField: string;
  /** The type of deprecation (singular_to_array, renamed, etc.) */
  deprecationType: 'singular_to_array' | 'renamed' | 'removed';
}

/**
 * Known OCF deprecated field mappings.
 * Add new deprecations here as they are discovered.
 */
export const OCF_DEPRECATED_FIELDS: Record<string, DeprecatedFieldMapping[]> = {
  StockPlan: [
    {
      deprecatedField: 'stock_class_id',
      replacementField: 'stock_class_ids',
      deprecationType: 'singular_to_array',
    },
  ],
};

/**
 * Get the list of deprecated field mappings for an OCF object type.
 *
 * @param objectType - The OCF object type name (e.g., 'StockPlan')
 * @returns Array of deprecated field mappings for the object type
 */
export function getDeprecatedFieldMappings(objectType: string): DeprecatedFieldMapping[] {
  return OCF_DEPRECATED_FIELDS[objectType] ?? [];
}

/**
 * Check if a specific field is deprecated for an OCF object type.
 *
 * @param objectType - The OCF object type name
 * @param fieldName - The field name to check
 * @returns The deprecation mapping if the field is deprecated, undefined otherwise
 */
export function getFieldDeprecation(objectType: string, fieldName: string): DeprecatedFieldMapping | undefined {
  const mappings = getDeprecatedFieldMappings(objectType);
  return mappings.find((m) => m.deprecatedField === fieldName);
}

/**
 * Check an object for any deprecated field usage based on known deprecations.
 *
 * @param objectType - The OCF object type name
 * @param data - The object data to check
 * @returns Result indicating which deprecated fields were used
 *
 * @example
 *   ```typescript
 *   const result = checkDeprecatedFields('StockPlan', {
 *     stock_class_id: 'sc-1', // deprecated
 *     plan_name: 'Equity Plan',
 *   });
 *   // Returns { hasDeprecatedFields: true, deprecatedFieldsUsed: ['stock_class_id'] }
 *   ```
 */
export function checkDeprecatedFields(objectType: string, data: Record<string, unknown>): DeprecatedFieldUsageResult {
  const mappings = getDeprecatedFieldMappings(objectType);
  const deprecatedFieldsUsed: string[] = [];

  for (const mapping of mappings) {
    const value = data[mapping.deprecatedField];
    // Also exclude empty strings to match original truthy-check behavior
    if (value !== undefined && value !== null && value !== '') {
      deprecatedFieldsUsed.push(mapping.deprecatedField);
    }
  }

  return {
    hasDeprecatedFields: deprecatedFieldsUsed.length > 0,
    deprecatedFieldsUsed,
  };
}
