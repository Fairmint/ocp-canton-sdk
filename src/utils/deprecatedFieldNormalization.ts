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

// ===== Batch Verification Helpers =====

/**
 * Item with an identifier for tracking in batch operations.
 */
export interface IdentifiableItem {
  /** Unique identifier for the item */
  id?: string;
  /** Index in the original array (for items without id) */
  index?: number;
}

/**
 * Result of checking a single object in a batch operation.
 */
export interface BatchItemResult extends DeprecatedFieldUsageResult {
  /** Identifier for the item (id or index-based) */
  itemId: string;
  /** The object type that was checked */
  objectType: string;
}

/**
 * Aggregated result of checking multiple objects for deprecated field usage.
 */
export interface BatchDeprecatedFieldsResult {
  /** Total number of objects checked */
  totalChecked: number;
  /** Number of objects with deprecated fields */
  objectsWithDeprecatedFields: number;
  /** Number of objects without deprecated fields */
  objectsWithoutDeprecatedFields: number;
  /** Whether any deprecated fields were found */
  hasDeprecatedFields: boolean;
  /** Per-item results for objects that have deprecated fields */
  itemsWithDeprecatedFields: BatchItemResult[];
  /** Summary of deprecated field usage by field name */
  deprecatedFieldSummary: Record<string, number>;
  /** Summary of deprecated field usage by object type */
  objectTypeSummary: Record<string, { total: number; withDeprecated: number }>;
}

/**
 * Input item for batch verification.
 */
export interface BatchVerificationItem {
  /** The OCF object type (e.g., 'StockPlan') */
  objectType: string;
  /** The data to check */
  data: Record<string, unknown>;
  /** Optional identifier for the item */
  id?: string;
}

/**
 * Check multiple objects for deprecated field usage in a single batch operation.
 *
 * @param items - Array of items to check, each with objectType and data
 * @returns Aggregated result with summary statistics and per-item details
 *
 * @example
 *   ```typescript
 *   const result = checkDeprecatedFieldsBatch([
 *     { objectType: 'StockPlan', data: { stock_class_id: 'sc-1', plan_name: 'Plan A' }, id: 'plan-1' },
 *     { objectType: 'StockPlan', data: { stock_class_ids: ['sc-2'], plan_name: 'Plan B' }, id: 'plan-2' },
 *   ]);
 *   // result.objectsWithDeprecatedFields === 1
 *   // result.deprecatedFieldSummary === { stock_class_id: 1 }
 *   ```
 */
export function checkDeprecatedFieldsBatch(items: BatchVerificationItem[]): BatchDeprecatedFieldsResult {
  const itemsWithDeprecatedFields: BatchItemResult[] = [];
  const deprecatedFieldSummary: Record<string, number> = {};
  const objectTypeSummary: Record<string, { total: number; withDeprecated: number }> = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = item.id ?? `index:${i}`;
    const result = checkDeprecatedFields(item.objectType, item.data);

    // Update object type summary
    objectTypeSummary[item.objectType] ??= { total: 0, withDeprecated: 0 };
    objectTypeSummary[item.objectType].total++;

    if (result.hasDeprecatedFields) {
      objectTypeSummary[item.objectType].withDeprecated++;
      itemsWithDeprecatedFields.push({
        itemId,
        objectType: item.objectType,
        ...result,
      });

      // Update field summary
      for (const field of result.deprecatedFieldsUsed) {
        deprecatedFieldSummary[field] = (deprecatedFieldSummary[field] ?? 0) + 1;
      }
    }
  }

  return {
    totalChecked: items.length,
    objectsWithDeprecatedFields: itemsWithDeprecatedFields.length,
    objectsWithoutDeprecatedFields: items.length - itemsWithDeprecatedFields.length,
    hasDeprecatedFields: itemsWithDeprecatedFields.length > 0,
    itemsWithDeprecatedFields,
    deprecatedFieldSummary,
    objectTypeSummary,
  };
}

/**
 * Check an array of objects of the same type for deprecated field usage.
 *
 * @param objectType - The OCF object type for all items
 * @param items - Array of data objects to check
 * @returns Aggregated result with summary statistics
 *
 * @example
 *   ```typescript
 *   const stockPlans = [
 *     { id: 'plan-1', stock_class_id: 'sc-1', plan_name: 'Plan A' },
 *     { id: 'plan-2', stock_class_ids: ['sc-2'], plan_name: 'Plan B' },
 *   ];
 *   const result = checkDeprecatedFieldsForType('StockPlan', stockPlans);
 *   ```
 */
export function checkDeprecatedFieldsForType(
  objectType: string,
  items: Array<Record<string, unknown>>
): BatchDeprecatedFieldsResult {
  const batchItems: BatchVerificationItem[] = items.map((data, index) => ({
    objectType,
    data,
    id: typeof data.id === 'string' ? data.id : `index:${index}`,
  }));

  return checkDeprecatedFieldsBatch(batchItems);
}

// ===== Data Migration/Transformation Helpers =====

/**
 * Result of migrating deprecated fields in an object.
 */
export interface MigrationResult<T> {
  /** The migrated data with deprecated fields converted to current format */
  data: T;
  /** Whether any migrations were performed */
  migrated: boolean;
  /** List of fields that were migrated */
  migratedFields: string[];
  /** List of warnings (e.g., both deprecated and current fields present) */
  warnings: string[];
}

/**
 * Migrate deprecated stock plan fields to their current equivalents.
 *
 * This function creates a new object with deprecated fields converted to current format.
 * The original object is not modified.
 *
 * @param data - Stock plan data that may contain deprecated fields
 * @returns Migration result with normalized data and migration details
 *
 * @example
 *   ```typescript
 *   const result = migrateStockPlanFields({
 *     id: 'plan-1',
 *     stock_class_id: 'sc-1', // deprecated
 *     plan_name: 'Equity Plan',
 *   });
 *   // result.data.stock_class_ids === ['sc-1']
 *   // result.migrated === true
 *   // result.migratedFields === ['stock_class_id']
 *   ```
 */
export function migrateStockPlanFields<T extends StockPlanDataWithDeprecatedField>(
  data: T
): MigrationResult<Omit<T, 'stock_class_id'> & { stock_class_ids: string[] }> {
  const warnings: string[] = [];
  const migratedFields: string[] = [];

  const hasDeprecatedField =
    data.stock_class_id !== undefined && data.stock_class_id !== null && data.stock_class_id !== '';
  const hasCurrentField = Array.isArray(data.stock_class_ids) && data.stock_class_ids.length > 0;

  // Check for both fields present
  if (hasDeprecatedField && hasCurrentField) {
    warnings.push(
      `Both 'stock_class_id' (deprecated) and 'stock_class_ids' are present. Using 'stock_class_ids' value.`
    );
  }

  // Normalize using existing helper
  const { stock_class_ids, usedDeprecatedField } = normalizeDeprecatedStockPlanFields(data);

  if (usedDeprecatedField) {
    migratedFields.push('stock_class_id');
  }

  // Create new object without the deprecated field
  const { stock_class_id: _removed, ...rest } = data;

  return {
    data: {
      ...rest,
      stock_class_ids,
    } as Omit<T, 'stock_class_id'> & { stock_class_ids: string[] },
    migrated: migratedFields.length > 0,
    migratedFields,
    warnings,
  };
}

/**
 * Batch result for migrating multiple objects.
 */
export interface BatchMigrationResult<T> {
  /** Migrated items */
  items: Array<MigrationResult<T>>;
  /** Total number of items processed */
  totalProcessed: number;
  /** Number of items that required migration */
  itemsMigrated: number;
  /** Number of items with warnings */
  itemsWithWarnings: number;
  /** Summary of migrated fields */
  migratedFieldsSummary: Record<string, number>;
}

/**
 * Migrate deprecated fields in multiple stock plan objects.
 *
 * @param items - Array of stock plan data objects
 * @returns Batch migration result with all migrated items
 *
 * @example
 *   ```typescript
 *   const plans = [
 *     { id: 'plan-1', stock_class_id: 'sc-1' },
 *     { id: 'plan-2', stock_class_ids: ['sc-2'] },
 *   ];
 *   const result = migrateStockPlanFieldsBatch(plans);
 *   // result.itemsMigrated === 1
 *   ```
 */
export function migrateStockPlanFieldsBatch<T extends StockPlanDataWithDeprecatedField>(
  items: T[]
): BatchMigrationResult<Omit<T, 'stock_class_id'> & { stock_class_ids: string[] }> {
  const migratedFieldsSummary: Record<string, number> = {};
  let itemsMigrated = 0;
  let itemsWithWarnings = 0;

  const migratedItems = items.map((item) => {
    const result = migrateStockPlanFields(item);

    if (result.migrated) {
      itemsMigrated++;
      for (const field of result.migratedFields) {
        migratedFieldsSummary[field] = (migratedFieldsSummary[field] ?? 0) + 1;
      }
    }

    if (result.warnings.length > 0) {
      itemsWithWarnings++;
    }

    return result;
  });

  return {
    items: migratedItems,
    totalProcessed: items.length,
    itemsMigrated,
    itemsWithWarnings,
    migratedFieldsSummary,
  };
}

// ===== Deprecation Report Generation =====

/**
 * Detailed deprecation report for analysis and documentation.
 */
export interface DeprecationReport {
  /** Timestamp when the report was generated */
  generatedAt: string;
  /** Summary statistics */
  summary: {
    /** Total objects analyzed */
    totalObjects: number;
    /** Objects with deprecated fields */
    objectsWithDeprecatedFields: number;
    /** Percentage of objects with deprecated fields */
    deprecationPercentage: number;
    /** Total deprecated field usages */
    totalDeprecatedFieldUsages: number;
  };
  /** Breakdown by object type */
  byObjectType: Record<
    string,
    {
      total: number;
      withDeprecatedFields: number;
      deprecationPercentage: number;
      fieldsUsed: Record<string, number>;
    }
  >;
  /** Breakdown by deprecated field */
  byField: Record<
    string,
    {
      totalUsages: number;
      objectTypesAffected: string[];
      replacementField: string;
      deprecationType: string;
    }
  >;
  /** List of all affected items (optional, for detailed reports) */
  affectedItems?: Array<{
    itemId: string;
    objectType: string;
    deprecatedFieldsUsed: string[];
  }>;
}

/**
 * Options for generating a deprecation report.
 */
export interface DeprecationReportOptions {
  /** Whether to include detailed list of affected items (default: false for large datasets) */
  includeAffectedItems?: boolean;
  /** Maximum number of affected items to include (default: 100) */
  maxAffectedItems?: number;
}

/**
 * Generate a detailed deprecation report from batch verification results.
 *
 * @param batchResult - Result from checkDeprecatedFieldsBatch or checkDeprecatedFieldsForType
 * @param options - Options for report generation
 * @returns Detailed deprecation report
 *
 * @example
 *   ```typescript
 *   const items = [
 *     { objectType: 'StockPlan', data: { stock_class_id: 'sc-1' }, id: 'plan-1' },
 *   ];
 *   const batchResult = checkDeprecatedFieldsBatch(items);
 *   const report = generateDeprecationReport(batchResult);
 *   console.log(`${report.summary.deprecationPercentage}% of objects use deprecated fields`);
 *   ```
 */
export function generateDeprecationReport(
  batchResult: BatchDeprecatedFieldsResult,
  options: DeprecationReportOptions = {}
): DeprecationReport {
  const { includeAffectedItems = false, maxAffectedItems = 100 } = options;

  // Calculate summary
  const deprecationPercentage =
    batchResult.totalChecked > 0
      ? Math.round((batchResult.objectsWithDeprecatedFields / batchResult.totalChecked) * 10000) / 100
      : 0;

  const totalDeprecatedFieldUsages = Object.values(batchResult.deprecatedFieldSummary).reduce(
    (sum, count) => sum + count,
    0
  );

  // Build by-object-type breakdown
  const byObjectType: DeprecationReport['byObjectType'] = {};
  for (const [objectType, stats] of Object.entries(batchResult.objectTypeSummary)) {
    const fieldsUsed: Record<string, number> = {};

    // Count field usages for this object type
    for (const item of batchResult.itemsWithDeprecatedFields) {
      if (item.objectType === objectType) {
        for (const field of item.deprecatedFieldsUsed) {
          fieldsUsed[field] = (fieldsUsed[field] ?? 0) + 1;
        }
      }
    }

    byObjectType[objectType] = {
      total: stats.total,
      withDeprecatedFields: stats.withDeprecated,
      deprecationPercentage: stats.total > 0 ? Math.round((stats.withDeprecated / stats.total) * 10000) / 100 : 0,
      fieldsUsed,
    };
  }

  // Build by-field breakdown
  const byField: DeprecationReport['byField'] = {};
  for (const [field, count] of Object.entries(batchResult.deprecatedFieldSummary)) {
    const objectTypesAffected = new Set<string>();

    for (const item of batchResult.itemsWithDeprecatedFields) {
      if (item.deprecatedFieldsUsed.includes(field)) {
        objectTypesAffected.add(item.objectType);
      }
    }

    // Find the mapping for this field to get replacement info
    let foundMapping: DeprecatedFieldMapping | undefined;

    for (const objectType of objectTypesAffected) {
      const mapping = getFieldDeprecation(objectType, field);
      if (mapping) {
        foundMapping = mapping;
        break;
      }
    }

    const { replacementField = 'unknown', deprecationType = 'unknown' } = foundMapping ?? {};

    byField[field] = {
      totalUsages: count,
      objectTypesAffected: Array.from(objectTypesAffected),
      replacementField,
      deprecationType,
    };
  }

  // Build affected items list if requested
  let affectedItems: DeprecationReport['affectedItems'];
  if (includeAffectedItems) {
    affectedItems = batchResult.itemsWithDeprecatedFields.slice(0, maxAffectedItems).map((item) => ({
      itemId: item.itemId,
      objectType: item.objectType,
      deprecatedFieldsUsed: item.deprecatedFieldsUsed,
    }));
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalObjects: batchResult.totalChecked,
      objectsWithDeprecatedFields: batchResult.objectsWithDeprecatedFields,
      deprecationPercentage,
      totalDeprecatedFieldUsages,
    },
    byObjectType,
    byField,
    affectedItems,
  };
}

// ===== Validation Pipeline Helpers =====

/**
 * Result of validating deprecated field usage.
 */
export interface DeprecationValidationResult {
  /** Whether validation passed (no deprecated fields, or within acceptable limits) */
  valid: boolean;
  /** Validation errors (if any) */
  errors: string[];
  /** Validation warnings (if any) */
  warnings: string[];
  /** The underlying check result */
  checkResult: DeprecatedFieldUsageResult;
}

/**
 * Options for deprecation validation.
 */
export interface DeprecationValidationOptions {
  /** Whether to treat deprecated field usage as an error (default: false, treated as warning) */
  treatAsError?: boolean;
  /** Specific deprecated fields to ignore in validation */
  ignoreFields?: string[];
  /** Custom error message prefix */
  errorMessagePrefix?: string;
}

/**
 * Validate an object for deprecated field usage.
 *
 * This is useful for validation pipelines where you want to:
 * - Warn users about deprecated field usage
 * - Optionally fail validation on deprecated fields
 * - Generate clear validation messages
 *
 * @param objectType - The OCF object type
 * @param data - The data to validate
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 *   ```typescript
 *   const result = validateDeprecatedFields('StockPlan', {
 *     stock_class_id: 'sc-1',
 *   }, { treatAsError: false });
 *
 *   if (!result.valid) {
 *     console.error(result.errors.join('\n'));
 *   } else if (result.warnings.length > 0) {
 *     console.warn(result.warnings.join('\n'));
 *   }
 *   ```
 */
export function validateDeprecatedFields(
  objectType: string,
  data: Record<string, unknown>,
  options: DeprecationValidationOptions = {}
): DeprecationValidationResult {
  const { treatAsError = false, ignoreFields = [], errorMessagePrefix = '' } = options;

  const checkResult = checkDeprecatedFields(objectType, data);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Filter out ignored fields
  const relevantFields = checkResult.deprecatedFieldsUsed.filter((field) => !ignoreFields.includes(field));

  if (relevantFields.length > 0) {
    const messages = relevantFields.map((field) => {
      const mapping = getFieldDeprecation(objectType, field);
      const replacement = mapping?.replacementField ?? 'unknown';
      const prefix = errorMessagePrefix ? `${errorMessagePrefix}: ` : '';
      return `${prefix}Field '${field}' is deprecated. Use '${replacement}' instead.`;
    });

    if (treatAsError) {
      errors.push(...messages);
    } else {
      warnings.push(...messages);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkResult: {
      hasDeprecatedFields: relevantFields.length > 0,
      deprecatedFieldsUsed: relevantFields,
    },
  };
}

/**
 * Create a validator function for use in validation pipelines.
 *
 * @param objectType - The OCF object type to validate
 * @param options - Validation options
 * @returns A validator function that returns DeprecationValidationResult
 *
 * @example
 *   ```typescript
 *   const validateStockPlan = createDeprecatedFieldsValidator('StockPlan', {
 *     treatAsError: false,
 *   });
 *
 *   // Use in a validation pipeline
 *   const result = validateStockPlan(stockPlanData);
 *   ```
 */
export function createDeprecatedFieldsValidator(
  objectType: string,
  options: DeprecationValidationOptions = {}
): (data: Record<string, unknown>) => DeprecationValidationResult {
  return (data: Record<string, unknown>) => validateDeprecatedFields(objectType, data, options);
}

/**
 * Assert that an object does not use deprecated fields.
 * Throws an error if deprecated fields are detected.
 *
 * @param objectType - The OCF object type
 * @param data - The data to check
 * @param options - Validation options (ignoreFields only)
 * @throws Error if deprecated fields are detected
 *
 * @example
 *   ```typescript
 *   try {
 *     assertNoDeprecatedFields('StockPlan', stockPlanData);
 *     // Proceed with operation
 *   } catch (error) {
 *     // Handle deprecated field usage
 *   }
 *   ```
 */
export function assertNoDeprecatedFields(
  objectType: string,
  data: Record<string, unknown>,
  options: Pick<DeprecationValidationOptions, 'ignoreFields'> = {}
): void {
  const result = validateDeprecatedFields(objectType, data, {
    ...options,
    treatAsError: true,
  });

  if (!result.valid) {
    throw new Error(`Deprecated field usage detected: ${result.errors.join('; ')}`);
  }
}

// ===== Helper to Register New Deprecations =====

/**
 * Register a new deprecated field mapping.
 *
 * This is useful for extending the built-in deprecation registry with
 * custom or newly discovered deprecations.
 *
 * @param objectType - The OCF object type
 * @param mapping - The deprecation mapping to register
 *
 * @example
 *   ```typescript
 *   // Register a new deprecation
 *   registerDeprecatedFieldMapping('SomeOcfType', {
 *     deprecatedField: 'old_field',
 *     replacementField: 'new_fields',
 *     deprecationType: 'singular_to_array',
 *   });
 *   ```
 */
export function registerDeprecatedFieldMapping(objectType: string, mapping: DeprecatedFieldMapping): void {
  OCF_DEPRECATED_FIELDS[objectType] ??= [];

  // Check if mapping already exists
  const existing = OCF_DEPRECATED_FIELDS[objectType].find((m) => m.deprecatedField === mapping.deprecatedField);

  if (!existing) {
    OCF_DEPRECATED_FIELDS[objectType].push(mapping);
  }
}

/**
 * Get all registered object types that have deprecated field mappings.
 *
 * @returns Array of object type names
 */
export function getRegisteredObjectTypes(): string[] {
  return Object.keys(OCF_DEPRECATED_FIELDS);
}

/**
 * Get all registered deprecated field mappings.
 *
 * @returns Copy of the deprecated fields registry
 */
export function getAllDeprecatedFieldMappings(): Record<string, DeprecatedFieldMapping[]> {
  // Return a deep copy to prevent external modification
  const result: Record<string, DeprecatedFieldMapping[]> = {};
  for (const [key, value] of Object.entries(OCF_DEPRECATED_FIELDS)) {
    result[key] = value.map((m) => ({ ...m }));
  }
  return result;
}

// ===== Automatic Normalization for SDK Integration =====

/**
 * Map from OcfEntityType (used in batch API) to the object type name used in deprecation registry.
 * This allows the SDK to automatically look up deprecations based on entity type.
 */
const ENTITY_TYPE_TO_OBJECT_TYPE: Record<string, string> = {
  stockPlan: 'StockPlan',
  // Add more mappings as deprecations are discovered for other types
};

/**
 * Result of automatic OCF data normalization.
 */
export interface NormalizedOcfDataResult<T> {
  /** The normalized data with deprecated fields converted */
  data: T;
  /** Whether any normalization was performed */
  normalized: boolean;
  /** List of deprecated fields that were normalized */
  normalizedFields: string[];
  /** Warnings generated during normalization */
  warnings: string[];
}

/**
 * Automatically normalize deprecated fields in OCF data based on entity type.
 *
 * This function is designed to be called by the SDK internally when processing
 * OCF data, making deprecated field handling transparent to end-users.
 *
 * @param entityType - The OCF entity type (e.g., 'stockPlan')
 * @param data - The OCF data that may contain deprecated fields
 * @param options - Optional configuration
 * @returns The normalized data with deprecated fields converted to current format
 *
 * @example
 *   ```typescript
 *   // SDK automatically normalizes deprecated fields
 *   const result = normalizeDeprecatedOcfFields('stockPlan', {
 *     id: 'plan-1',
 *     stock_class_id: 'sc-1', // deprecated, automatically converted
 *     plan_name: 'Equity Plan',
 *   });
 *   // result.data.stock_class_ids === ['sc-1']
 *   ```
 */
export function normalizeDeprecatedOcfFields<T extends Record<string, unknown>>(
  entityType: string,
  data: T,
  options: { emitWarnings?: boolean; context?: string } = {}
): NormalizedOcfDataResult<T> {
  const { emitWarnings = true, context } = options;

  // Look up the object type for this entity type
  const objectType = ENTITY_TYPE_TO_OBJECT_TYPE[entityType];

  // If no deprecation mappings exist for this type, return data unchanged
  if (!objectType) {
    return {
      data,
      normalized: false,
      normalizedFields: [],
      warnings: [],
    };
  }

  const mappings = getDeprecatedFieldMappings(objectType);
  if (mappings.length === 0) {
    return {
      data,
      normalized: false,
      normalizedFields: [],
      warnings: [],
    };
  }

  // Apply normalizations based on deprecation type
  const normalizedFields: string[] = [];
  const warnings: string[] = [];
  let result: T = { ...data };

  for (const mapping of mappings) {
    const deprecatedValue = data[mapping.deprecatedField];
    const hasDeprecated = deprecatedValue !== undefined && deprecatedValue !== null && deprecatedValue !== '';

    if (!hasDeprecated) {
      continue;
    }

    switch (mapping.deprecationType) {
      case 'singular_to_array': {
        const currentValue = data[mapping.replacementField];
        const hasCurrentArray = Array.isArray(currentValue) && currentValue.length > 0;

        if (!hasCurrentArray) {
          // Convert singular to array
          result = {
            ...result,
            [mapping.replacementField]: [deprecatedValue],
          };
          normalizedFields.push(mapping.deprecatedField);

          if (emitWarnings) {
            emitDeprecationWarning({
              deprecatedField: mapping.deprecatedField,
              replacementField: mapping.replacementField,
              deprecatedValue,
              context: context ?? `${entityType}.create`,
            });
          }
        } else {
          // Both present - current takes precedence, emit warning
          warnings.push(
            `Both '${mapping.deprecatedField}' (deprecated) and '${mapping.replacementField}' are present. ` +
              `Using '${mapping.replacementField}' value.`
          );
        }
        break;
      }

      case 'renamed': {
        const currentValue = data[mapping.replacementField];
        const hasCurrent = currentValue !== undefined && currentValue !== null;

        if (!hasCurrent) {
          // Copy deprecated value to new field
          result = {
            ...result,
            [mapping.replacementField]: deprecatedValue,
          };
          normalizedFields.push(mapping.deprecatedField);

          if (emitWarnings) {
            emitDeprecationWarning({
              deprecatedField: mapping.deprecatedField,
              replacementField: mapping.replacementField,
              deprecatedValue,
              context: context ?? `${entityType}.create`,
            });
          }
        } else {
          warnings.push(
            `Both '${mapping.deprecatedField}' (deprecated) and '${mapping.replacementField}' are present. ` +
              `Using '${mapping.replacementField}' value.`
          );
        }
        break;
      }

      case 'removed': {
        // Field is removed, just warn
        warnings.push(
          `Field '${mapping.deprecatedField}' is deprecated and will be ignored. ` +
            `It has been removed in the current schema.`
        );
        normalizedFields.push(mapping.deprecatedField);
        break;
      }
    }
  }

  // Remove deprecated fields from the result to keep data clean
  // (They've been migrated to their replacements)
  for (const mapping of mappings) {
    if (normalizedFields.includes(mapping.deprecatedField) && mapping.deprecationType !== 'removed') {
      const { [mapping.deprecatedField]: _removed, ...rest } = result;
      result = rest as T;
    }
  }

  return {
    data: result,
    normalized: normalizedFields.length > 0,
    normalizedFields,
    warnings,
  };
}

/**
 * Check if an entity type has registered deprecations.
 *
 * @param entityType - The OCF entity type (e.g., 'stockPlan')
 * @returns true if the entity type has deprecation mappings
 */
export function hasDeprecationsForEntityType(entityType: string): boolean {
  const objectType = ENTITY_TYPE_TO_OBJECT_TYPE[entityType];
  if (!objectType) {
    return false;
  }
  return getDeprecatedFieldMappings(objectType).length > 0;
}

/**
 * Register a mapping from entity type to object type for automatic normalization.
 *
 * @param entityType - The OcfEntityType used in batch API (e.g., 'stockPlan')
 * @param objectType - The object type name used in deprecation registry (e.g., 'StockPlan')
 */
export function registerEntityTypeMapping(entityType: string, objectType: string): void {
  ENTITY_TYPE_TO_OBJECT_TYPE[entityType] = objectType;
}
