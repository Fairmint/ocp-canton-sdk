import type { CompensationType } from '../types/native';
import { normalizeNumericString } from './typeConversions';

const RETIRED_PLAN_SECURITY_OBJECT_TYPE_PREFIX = 'TX_PLAN_SECURITY_';

type OptionGrantType = 'NSO' | 'ISO' | 'INTL';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasStakeholderPayloadShape(value: Record<string, unknown>): boolean {
  const { name } = value;
  return (
    isNonEmptyString(value.id) &&
    typeof name === 'object' &&
    name !== null &&
    isNonEmptyString((name as Record<string, unknown>).legal_name) &&
    typeof value.stakeholder_type === 'string' &&
    ['INDIVIDUAL', 'INSTITUTION'].includes(value.stakeholder_type)
  );
}

function hasStockPlanPayloadShape(value: Record<string, unknown>): boolean {
  const hasStockClassIds = Array.isArray(value.stock_class_ids) && value.stock_class_ids.length > 0;
  const hasDeprecatedStockClassId = isNonEmptyString(value.stock_class_id);
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.plan_name) &&
    isNonEmptyString(value.initial_shares_reserved) &&
    (hasStockClassIds || hasDeprecatedStockClassId)
  );
}

function mapOptionGrantTypeToCompensationType(optionGrantType: OptionGrantType): CompensationType {
  switch (optionGrantType) {
    case 'NSO':
      return 'OPTION_NSO';
    case 'ISO':
      return 'OPTION_ISO';
    case 'INTL':
      return 'OPTION';
  }
}

function isObjectTypeEquityCompensationIssuance(objectType: unknown): boolean {
  return objectType === 'TX_EQUITY_COMPENSATION_ISSUANCE';
}

/**
 * Canonicalize deprecated `option_grant_type` to `compensation_type`.
 *
 * Behavior:
 * - If only `option_grant_type` exists, derive `compensation_type`.
 * - If both exist and are compatible, keep canonical `compensation_type`.
 * - If both exist and conflict, throw.
 * - Always strip deprecated `option_grant_type` from canonical output.
 */
function normalizeOptionGrantType(data: Record<string, unknown>): Record<string, unknown> {
  if (!isObjectTypeEquityCompensationIssuance(data.object_type)) return data;

  const optionGrantTypeValue = data.option_grant_type;
  if (optionGrantTypeValue === undefined || optionGrantTypeValue === null) return data;
  if (typeof optionGrantTypeValue !== 'string') {
    throw new Error(`Invalid option_grant_type: expected string, got ${typeof optionGrantTypeValue}`);
  }

  const normalizedOptionGrantType = optionGrantTypeValue.trim().toUpperCase();
  if (
    normalizedOptionGrantType !== 'NSO' &&
    normalizedOptionGrantType !== 'ISO' &&
    normalizedOptionGrantType !== 'INTL'
  ) {
    throw new Error(`Invalid option_grant_type: unsupported value "${optionGrantTypeValue}"`);
  }

  const derivedCompensationType = mapOptionGrantTypeToCompensationType(normalizedOptionGrantType);
  const compensationTypeValue = data.compensation_type;
  if (compensationTypeValue !== undefined && compensationTypeValue !== null) {
    if (typeof compensationTypeValue !== 'string') {
      throw new Error(`Invalid compensation_type: expected string, got ${typeof compensationTypeValue}`);
    }

    const normalizedCompensationType = compensationTypeValue.trim().toUpperCase();

    // Allow generic OPTION with ISO/NSO to be upgraded to specific option type.
    const canonicalCompensationType =
      normalizedCompensationType === 'OPTION' &&
      (normalizedOptionGrantType === 'NSO' || normalizedOptionGrantType === 'ISO')
        ? derivedCompensationType
        : normalizedCompensationType;

    if (canonicalCompensationType !== derivedCompensationType) {
      throw new Error(
        `Deprecated option_grant_type "${normalizedOptionGrantType}" conflicts with compensation_type "${compensationTypeValue}"`
      );
    }
  }

  const { option_grant_type: _, ...rest } = data;
  return {
    ...rest,
    compensation_type: derivedCompensationType,
  };
}

/** Reject the removed non-schema PlanSecurity issuance field. */
function rejectPlanSecurityTypeField(data: Record<string, unknown>): Record<string, unknown> {
  if (!isObjectTypeEquityCompensationIssuance(data.object_type)) return data;
  if (!Object.prototype.hasOwnProperty.call(data, 'plan_security_type')) return data;
  throw new Error('plan_security_type is not supported; use canonical compensation_type');
}

/**
 * Normalize quantity_source field for OCF objects.
 *
 * Handles two scenarios to ensure consistent comparison:
 *
 * 1. When quantity is NOT present (null/undefined): quantity_source is meaningless
 *    and should be stripped if it's 'UNSPECIFIED'. This ensures:
 *    - DB with { quantity_source: 'UNSPECIFIED' } (no quantity)
 *    - Canton readback with {} (no quantity, no quantity_source)
 *    are treated as semantically equivalent.
 *
 * 2. When quantity IS present but quantity_source is missing: quantity_source should
 *    be set to 'UNSPECIFIED' because the OCF-to-DAML converter defaults to 'UNSPECIFIED'
 *    when quantity is present without quantity_source. This ensures:
 *    - DB with { quantity: '1000' } (no quantity_source)
 *    - Canton readback with { quantity: '1000', quantity_source: 'UNSPECIFIED' }
 *    are treated as semantically equivalent.
 *
 * @param data - OCF object that may have quantity and quantity_source fields
 * @returns Object with quantity_source normalized based on quantity presence
 */
function normalizeQuantitySource(data: Record<string, unknown>): Record<string, unknown> {
  if (data.object_type !== 'TX_WARRANT_ISSUANCE') {
    return data;
  }

  const { quantity, quantity_source: quantitySource } = data;

  // Case 1: Strip quantity_source if quantity is not present (null/undefined)
  // and quantity_source is 'UNSPECIFIED' (which is equivalent to "don't know")
  if ((quantity === null || quantity === undefined) && quantitySource === 'UNSPECIFIED') {
    const { quantity_source: _, ...rest } = data;
    return rest;
  }

  // Case 2: Add quantity_source: 'UNSPECIFIED' if quantity IS present but quantity_source is missing
  // This matches the OCF-to-DAML converter behavior that defaults to 'UNSPECIFIED'
  if (quantity !== null && quantity !== undefined && quantitySource === undefined) {
    return { ...data, quantity_source: 'UNSPECIFIED' };
  }

  return data;
}

/**
 * Fields on OCF Document objects that the DAML contract does not model.
 *
 * The OCF standard includes a `date` field on Document, but the DAML
 * DocumentOcfData type only stores: id, md5, path, uri, comments,
 * related_objects.  Because Canton never stores `date`, it will always
 * be absent from the Canton read-back, causing a phantom diff on every
 * replication run.  Stripping these fields during normalization keeps
 * both sides comparable.
 */
const DOCUMENT_NON_DAML_FIELDS: ReadonlySet<string> = new Set(['date']);

/**
 * Strip fields from Document OCF data that the DAML contract cannot store.
 *
 * @param data - OCF data object (only modified when object_type is DOCUMENT)
 * @returns Data with non-DAML Document fields removed (shallow copy if modified)
 */
function stripDocumentNonDamlFields(data: Record<string, unknown>): Record<string, unknown> {
  const objectType = data.object_type;
  if (objectType !== 'DOCUMENT') return data;

  // Check if any non-DAML fields are present before copying
  const hasNonDamlFields = Object.keys(data).some((k) => DOCUMENT_NON_DAML_FIELDS.has(k));
  if (!hasNonDamlFields) return data;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!DOCUMENT_NON_DAML_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Normalize Stakeholder relationship fields for consistent comparison.
 *
 * Rules:
 * - Apply only to Stakeholder objects.
 * - Preserve canonical `current_relationships` exactly as supplied. The pinned
 *   schema does not declare the array unique or order-insensitive, so changing
 *   either would erase schema-valid information.
 * - Reject legacy `current_relationship` instead of silently upgrading it.
 */
function normalizeStakeholderRelationships(data: Record<string, unknown>): Record<string, unknown> {
  const isStakeholderObject = data.object_type === 'STAKEHOLDER' || hasStakeholderPayloadShape(data);
  if (!isStakeholderObject) return data;

  if (Object.prototype.hasOwnProperty.call(data, 'current_relationship')) {
    throw new Error('current_relationship is not supported; use canonical current_relationships');
  }

  const relationshipsValue = data.current_relationships;
  if (relationshipsValue !== undefined && !Array.isArray(relationshipsValue)) {
    throw new Error(`Invalid stakeholder current_relationships: expected array, got ${typeof relationshipsValue}`);
  }

  if (Array.isArray(relationshipsValue)) {
    for (const value of relationshipsValue) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid stakeholder current_relationships entry: expected string, got ${typeof value}`);
      }
      if (value.length === 0 || value !== value.trim()) {
        throw new Error('Invalid stakeholder current_relationships entry: expected a non-empty canonical value');
      }
    }
  }

  return data;
}

/**
 * Normalize StockPlan stock class ID fields for consistent comparison.
 *
 * OCF deprecated `stock_class_id` in favor of `stock_class_ids`.
 * During round-trip, Canton data uses `stock_class_ids`, while source data
 * may still contain only the legacy singular field. This causes phantom edits
 * where one side appears empty/undefined.
 *
 * Rules:
 * - Apply only to StockPlan objects.
 * - If `stock_class_ids` is an array, keep it authoritative.
 * - If `stock_class_ids` is missing and legacy `stock_class_id` is
 *   a non-empty string, map it to `stock_class_ids: [value]`.
 */
function normalizeStockPlanClassIds(data: Record<string, unknown>): Record<string, unknown> {
  const isStockPlanObject = data.object_type === 'STOCK_PLAN' || hasStockPlanPayloadShape(data);
  if (!isStockPlanObject) return data;

  const classIdsValue = data.stock_class_ids;

  // If modern field is already present as an array, nothing to normalize
  if (Array.isArray(classIdsValue)) return data;

  // If modern field is present but not an array (including null), that's invalid
  if (classIdsValue !== undefined) {
    throw new Error(`Invalid stock plan stock_class_ids: expected array, got ${typeof classIdsValue}`);
  }

  // Modern field is missing — check for deprecated singular field
  if (data.stock_class_id !== undefined && typeof data.stock_class_id !== 'string') {
    throw new Error(`Invalid stock plan stock_class_id: expected string, got ${typeof data.stock_class_id}`);
  }
  if (typeof data.stock_class_id !== 'string') return data;
  const legacyClassId = data.stock_class_id.trim();
  if (legacyClassId.length === 0) {
    throw new Error('Invalid stock plan stock_class_id: empty string');
  }

  const { stock_class_id: _, ...rest } = data;
  return {
    ...rest,
    stock_class_ids: [legacyClassId],
  };
}

/**
 * Canonicalize stock class conversion ratio adjustment fields.
 *
 * OCF now uses `new_ratio_conversion_mechanism`, while legacy payloads may still send
 * `new_ratio_numerator` / `new_ratio_denominator`.
 */
function normalizeStockClassConversionRatioAdjustmentMechanism(data: Record<string, unknown>): Record<string, unknown> {
  if (data.object_type !== 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT') return data;

  const result: Record<string, unknown> = { ...data };
  const ratioMechanism = result.new_ratio_conversion_mechanism;
  const legacyNumerator = result.new_ratio_numerator;
  const legacyDenominator = result.new_ratio_denominator;

  if (legacyNumerator !== undefined || legacyDenominator !== undefined) {
    if (legacyNumerator === undefined || legacyDenominator === undefined) {
      throw new Error(
        'Invalid stock class conversion ratio legacy fields: both new_ratio_numerator and new_ratio_denominator are required'
      );
    }
    if (
      (typeof legacyNumerator !== 'string' && typeof legacyNumerator !== 'number') ||
      (typeof legacyDenominator !== 'string' && typeof legacyDenominator !== 'number')
    ) {
      throw new Error(
        `Invalid stock class conversion ratio legacy fields: expected string or number values, got numerator=${typeof legacyNumerator}, denominator=${typeof legacyDenominator}`
      );
    }

    if (ratioMechanism === undefined) {
      result.new_ratio_conversion_mechanism = {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '0', currency: 'USD' },
        ratio: {
          numerator: normalizeNumericString(legacyNumerator),
          denominator: normalizeNumericString(legacyDenominator),
        },
        rounding_type: 'NORMAL',
      };
    }

    delete result.new_ratio_numerator;
    delete result.new_ratio_denominator;
  }

  return result;
}

/**
 * Canonicalize stock reissuance optional split transaction identifier.
 *
 * Legacy exports may provide explicit `null` for omitted optional fields; convert to absent.
 */
function normalizeStockReissuanceSplitTransactionId(data: Record<string, unknown>): Record<string, unknown> {
  if (data.object_type !== 'TX_STOCK_REISSUANCE') return data;
  if (data.split_transaction_id !== null) return data;

  const { split_transaction_id: _, ...rest } = data;
  return rest;
}

/** Matches a well-formed decimal number (no backtracking risk). */
const DECIMAL_NUMBER_PATTERN = /^-?\d+\.\d+$/;

function hasTrailingDecimalZeros(value: string): boolean {
  return value.endsWith('0') && DECIMAL_NUMBER_PATTERN.test(value);
}

/**
 * Recursively normalize numeric strings with trailing zeros in an OCF data object.
 *
 * Strips trailing zeros from decimal strings (e.g., "100000.00" -> "100000",
 * "0.10" -> "0.1") so semantically equivalent values compare as equal regardless
 * of source formatting.
 *
 * Only modifies string values that are decimal numbers ending in '0'.
 * Non-numeric strings (IDs, dates, enums, names) are never touched.
 */
export function deepNormalizeNumericStrings(value: string): string;
export function deepNormalizeNumericStrings(value: readonly unknown[]): readonly unknown[];
export function deepNormalizeNumericStrings(value: Record<string, unknown>): Record<string, unknown>;
export function deepNormalizeNumericStrings(value: unknown): unknown;
export function deepNormalizeNumericStrings(value: unknown): unknown {
  if (typeof value === 'string' && hasTrailingDecimalZeros(value)) {
    return normalizeNumericString(value);
  }
  if (Array.isArray(value)) {
    const mapped = value.map((item) => deepNormalizeNumericStrings(item));
    return mapped.some((item, i) => item !== value[i]) ? mapped : value;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    const normalized = entries.map(([k, v]) => {
      const normalizedValue = deepNormalizeNumericStrings(v);
      return { entry: [k, normalizedValue] as const, changed: normalizedValue !== v };
    });
    if (normalized.every(({ changed }) => !changed)) return value;
    return Object.fromEntries(normalized.map(({ entry }) => entry));
  }
  return value;
}

/**
 * Normalize OCF data for consistent comparison.
 *
 * This function applies normalizations to ensure semantically equivalent data compares as equal:
 * 1. Normalizes quantity_source based on quantity presence (see normalizeQuantitySource)
 * 2. Strips Document fields that the DAML contract does not model (e.g. `date`)
 * 3. Rejects removed PlanSecurity issuance fields and canonicalizes the schema-deprecated option_grant_type
 * 4. Rejects legacy Stakeholder relationships without changing canonical relationship arrays
 * 5. Canonicalizes StockPlan class IDs (`stock_class_id` -> `stock_class_ids`)
 * 6. Canonicalizes StockClassConversionRatioAdjustment legacy ratio fields
 * 7. Normalizes numeric string formatting (strips trailing zeros from decimals)
 *
 * @param data - The OCF data object that may contain an object_type field
 * @returns The data with normalized fields (shallow copy if modified)
 *
 * @example
 * ```typescript
 * normalizeOcfData({ quantity: '1000' })
 * // => { quantity: '1000', quantity_source: 'UNSPECIFIED' }
 *
 * normalizeOcfData({ object_type: 'DOCUMENT', id: 'doc-1', date: '2024-01-15' })
 * // => { object_type: 'DOCUMENT', id: 'doc-1' }
 *
 * normalizeOcfData({ object_type: 'STOCK_PLAN', stock_class_id: 'sc-1', id: 'sp-1', plan_name: 'Plan', initial_shares_reserved: '1000' })
 * // => { object_type: 'STOCK_PLAN', stock_class_ids: ['sc-1'], id: 'sp-1', plan_name: 'Plan', initial_shares_reserved: '1000' }
 * ```
 */
export function normalizeOcfData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Invalid OCF data: expected a plain object');
  }
  const prototype = Object.getPrototypeOf(data);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Invalid OCF data: expected a plain object');
  }
  const input = data as Record<string, unknown>;
  if (typeof input.object_type === 'string' && input.object_type.startsWith(RETIRED_PLAN_SECURITY_OBJECT_TYPE_PREFIX)) {
    throw new Error(`Unsupported legacy PlanSecurity object_type: ${input.object_type}`);
  }
  // First normalize quantity_source for consistent comparison
  let result: Record<string, unknown> = normalizeQuantitySource(input);

  // Strip Document fields that DAML cannot store (e.g. `date`)
  result = stripDocumentNonDamlFields(result);

  // Reject the removed, non-schema PlanSecurity issuance field.
  result = rejectPlanSecurityTypeField(result);

  // Canonicalize deprecated option_grant_type to compensation_type
  result = normalizeOptionGrantType(result);

  // Reject legacy stakeholder relationships without erasing canonical array distinctions.
  result = normalizeStakeholderRelationships(result);

  // Canonicalize deprecated/current stock plan class ID fields
  result = normalizeStockPlanClassIds(result);

  // Canonicalize deprecated stock class conversion ratio adjustment fields
  result = normalizeStockClassConversionRatioAdjustmentMechanism(result);

  // Canonicalize stock reissuance optional fields exported as explicit nulls
  result = normalizeStockReissuanceSplitTransactionId(result);

  result = normalizeVestingTermsDefaults(result);

  result = deepNormalizeNumericStrings(result);

  return result;
}

/**
 * Strip OCF schema-default values from VESTING_TERMS objects so that both DB-sourced
 * and Canton-sourced manifests compare identically after normalization.
 *
 * - `portion.remainder` defaults to `false` in the OCF schema; omitting it is equivalent.
 * - `comments` defaults to absent; an empty array is equivalent to omission.
 */
function normalizeVestingTermsDefaults(data: Record<string, unknown>): Record<string, unknown> {
  if (data.object_type !== 'VESTING_TERMS') return data;
  const result = { ...data };

  if (Array.isArray(result.comments) && (result.comments as unknown[]).length === 0) {
    delete result.comments;
  }

  if (Array.isArray(result.vesting_conditions)) {
    result.vesting_conditions = (result.vesting_conditions as Array<Record<string, unknown>>).map((vc) => {
      const condition = { ...vc };
      const { portion } = condition;
      if (portion && typeof portion === 'object' && !Array.isArray(portion)) {
        const p = { ...(portion as Record<string, unknown>) };
        if (p.remainder === false) {
          delete p.remainder;
        }
        condition.portion = p;
      }
      return condition;
    });
  }

  return result;
}
