/**
 * Runtime type guards for OCF objects.
 *
 * These utilities enable safer type narrowing without unsafe casts.
 * Use them when receiving data from external sources or when type information
 * may be lost (e.g., deserialization).
 *
 * @example
 *   ```typescript
 *   const data: unknown = await fetchFromApi();
 *   if (isOcfIssuer(data)) {
 *     // TypeScript knows data is OcfIssuer here
 *     console.log(data.legal_name);
 *   }
 *   ```
 */

import type {
  OcfConvertibleCancellation,
  OcfConvertibleIssuance,
  OcfDocument,
  OcfEquityCompensationCancellation,
  OcfEquityCompensationExercise,
  OcfEquityCompensationIssuance,
  OcfIssuer,
  OcfStakeholder,
  OcfStockCancellation,
  OcfStockClass,
  OcfStockIssuance,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfStockRepurchase,
  OcfStockTransfer,
  OcfValuation,
  OcfVestingTerms,
  OcfWarrantCancellation,
  OcfWarrantIssuance,
} from '../types/native';

// ===== Primitive Type Guards =====

/**
 * Check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if a value is a valid numeric string or number.
 */
export function isNumericValue(value: unknown): value is string | number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return true;
  }
  if (typeof value === 'string' && value.length > 0) {
    const num = Number(value);
    return !Number.isNaN(num);
  }
  return false;
}

/**
 * Check if a value is a valid ISO date string (YYYY-MM-DD format).
 */
export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/**
 * Check if a value is a valid Monetary object.
 */
export function isMonetary(value: unknown): value is { amount: string | number; currency: string } {
  if (!isObject(value)) return false;
  return (
    ('amount' in value && isNumericValue(value.amount)) ||
    (typeof value.amount === 'string' && 'currency' in value && typeof value.currency === 'string')
  );
}

// ===== OCF Object Type Guards =====

/**
 * Type guard for OcfIssuer objects.
 *
 * @example
 *   ```typescript
 *   const result = await ocp.OpenCapTable.issuer.getIssuerAsOcf({ contractId });
 *   if (isOcfIssuer(result.issuer)) {
 *     console.log(result.issuer.legal_name);
 *   }
 *   ```
 */
export function isOcfIssuer(value: unknown): value is OcfIssuer {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.legal_name) &&
    isNonEmptyString(value.formation_date) &&
    isNonEmptyString(value.country_of_formation)
  );
}

/**
 * Type guard for OcfStakeholder objects.
 */
export function isOcfStakeholder(value: unknown): value is OcfStakeholder {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isObject(value.name) &&
    isNonEmptyString(value.name.legal_name) &&
    typeof value.stakeholder_type === 'string' &&
    ['INDIVIDUAL', 'INSTITUTION'].includes(value.stakeholder_type)
  );
}

/**
 * Type guard for OcfStockClass objects.
 */
export function isOcfStockClass(value: unknown): value is OcfStockClass {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.default_id_prefix) &&
    typeof value.class_type === 'string' &&
    ['COMMON', 'PREFERRED'].includes(value.class_type) &&
    isNumericValue(value.initial_shares_authorized) &&
    isNumericValue(value.votes_per_share) &&
    isNumericValue(value.seniority)
  );
}

/**
 * Type guard for OcfStockIssuance objects.
 */
export function isOcfStockIssuance(value: unknown): value is OcfStockIssuance {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNonEmptyString(value.custom_id) &&
    isNonEmptyString(value.stakeholder_id) &&
    isNonEmptyString(value.stock_class_id) &&
    isNumericValue(value.quantity) &&
    isMonetary(value.share_price)
  );
}

/**
 * Type guard for OcfStockTransfer objects.
 */
export function isOcfStockTransfer(value: unknown): value is OcfStockTransfer {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    Array.isArray(value.resulting_security_ids)
  );
}

/**
 * Type guard for OcfStockCancellation objects.
 */
export function isOcfStockCancellation(value: unknown): value is OcfStockCancellation {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    isNonEmptyString(value.reason_text)
  );
}

/**
 * Type guard for OcfStockRepurchase objects.
 */
export function isOcfStockRepurchase(value: unknown): value is OcfStockRepurchase {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    isMonetary(value.price)
  );
}

/**
 * Type guard for OcfStockLegendTemplate objects.
 */
export function isOcfStockLegendTemplate(value: unknown): value is OcfStockLegendTemplate {
  if (!isObject(value)) return false;
  return isNonEmptyString(value.id) && isNonEmptyString(value.name) && isNonEmptyString(value.text);
}

/**
 * Type guard for OcfStockPlan objects.
 */
export function isOcfStockPlan(value: unknown): value is OcfStockPlan {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.plan_name) &&
    isNumericValue(value.initial_shares_reserved) &&
    Array.isArray(value.stock_class_ids)
  );
}

/**
 * Type guard for OcfVestingTerms objects.
 */
export function isOcfVestingTerms(value: unknown): value is OcfVestingTerms {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    typeof value.allocation_type === 'string' &&
    Array.isArray(value.vesting_conditions)
  );
}

/**
 * Type guard for OcfEquityCompensationIssuance objects.
 */
export function isOcfEquityCompensationIssuance(value: unknown): value is OcfEquityCompensationIssuance {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNonEmptyString(value.custom_id) &&
    isNonEmptyString(value.stakeholder_id) &&
    typeof value.compensation_type === 'string' &&
    isNumericValue(value.quantity)
  );
}

/**
 * Type guard for OcfEquityCompensationExercise objects.
 */
export function isOcfEquityCompensationExercise(value: unknown): value is OcfEquityCompensationExercise {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    Array.isArray(value.resulting_security_ids)
  );
}

/**
 * Type guard for OcfEquityCompensationCancellation objects.
 */
export function isOcfEquityCompensationCancellation(value: unknown): value is OcfEquityCompensationCancellation {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    isNonEmptyString(value.reason_text)
  );
}

/**
 * Type guard for OcfWarrantIssuance objects.
 */
export function isOcfWarrantIssuance(value: unknown): value is OcfWarrantIssuance {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNonEmptyString(value.custom_id) &&
    isNonEmptyString(value.stakeholder_id) &&
    isMonetary(value.purchase_price) &&
    Array.isArray(value.exercise_triggers)
  );
}

/**
 * Type guard for OcfWarrantCancellation objects.
 */
export function isOcfWarrantCancellation(value: unknown): value is OcfWarrantCancellation {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNumericValue(value.quantity) &&
    isNonEmptyString(value.reason_text)
  );
}

/**
 * Type guard for OcfConvertibleIssuance objects.
 */
export function isOcfConvertibleIssuance(value: unknown): value is OcfConvertibleIssuance {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNonEmptyString(value.custom_id) &&
    isNonEmptyString(value.stakeholder_id) &&
    isMonetary(value.investment_amount) &&
    typeof value.convertible_type === 'string' &&
    Array.isArray(value.conversion_triggers)
  );
}

/**
 * Type guard for OcfConvertibleCancellation objects.
 */
export function isOcfConvertibleCancellation(value: unknown): value is OcfConvertibleCancellation {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    isNonEmptyString(value.security_id) &&
    isNonEmptyString(value.reason_text)
  );
}

/**
 * Type guard for OcfValuation objects.
 */
export function isOcfValuation(value: unknown): value is OcfValuation {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.stock_class_id) &&
    isNonEmptyString(value.effective_date) &&
    typeof value.valuation_type === 'string' &&
    isMonetary(value.price_per_share)
  );
}

/**
 * Type guard for OcfDocument objects.
 */
export function isOcfDocument(value: unknown): value is OcfDocument {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.md5) &&
    (value.path === undefined || typeof value.path === 'string') &&
    (value.uri === undefined || typeof value.uri === 'string')
  );
}

// ===== Generic OCF Object Type Detection =====

/**
 * Detected OCF object types from runtime type guards.
 *
 * This is similar to OcfObjectType from ocfMetadata but includes an 'UNKNOWN' case
 * for when the type cannot be determined from structure alone.
 */
export type DetectedOcfType =
  | 'ISSUER'
  | 'STAKEHOLDER'
  | 'STOCK_CLASS'
  | 'STOCK_ISSUANCE'
  | 'STOCK_TRANSFER'
  | 'STOCK_CANCELLATION'
  | 'STOCK_REPURCHASE'
  | 'STOCK_LEGEND_TEMPLATE'
  | 'STOCK_PLAN'
  | 'VESTING_TERMS'
  | 'EQUITY_COMPENSATION_ISSUANCE'
  | 'EQUITY_COMPENSATION_EXERCISE'
  | 'EQUITY_COMPENSATION_CANCELLATION'
  | 'WARRANT_ISSUANCE'
  | 'WARRANT_CANCELLATION'
  | 'CONVERTIBLE_ISSUANCE'
  | 'CONVERTIBLE_CANCELLATION'
  | 'VALUATION'
  | 'DOCUMENT'
  | 'UNKNOWN';

/**
 * Detect the OCF object type from an unknown value.
 *
 * This is useful when you receive data that could be any OCF type
 * and need to determine which type it is before processing.
 *
 * @example
 *   ```typescript
 *   const type = detectOcfObjectType(data);
 *   switch (type) {
 *     case 'ISSUER':
 *       // Handle issuer
 *       break;
 *     case 'STAKEHOLDER':
 *       // Handle stakeholder
 *       break;
 *     // ...
 *   }
 *   ```
 */
export function detectOcfObjectType(value: unknown): DetectedOcfType {
  // First check if the object has an explicit object_type field
  if (isObject(value) && 'object_type' in value && typeof value.object_type === 'string') {
    const objectType = value.object_type;
    // Map common OCF object_type values
    const knownTypes = [
      'ISSUER',
      'STAKEHOLDER',
      'STOCK_CLASS',
      'STOCK_LEGEND_TEMPLATE',
      'STOCK_PLAN',
      'VESTING_TERMS',
      'VALUATION',
      'DOCUMENT',
    ];
    if (knownTypes.includes(objectType)) {
      return objectType as DetectedOcfType;
    }
    // Transaction types often have TX_ prefix
    if (objectType.startsWith('TX_')) {
      const txType = objectType.substring(3); // Remove TX_ prefix
      if (txType.includes('STOCK_ISSUANCE')) return 'STOCK_ISSUANCE';
      if (txType.includes('STOCK_TRANSFER')) return 'STOCK_TRANSFER';
      if (txType.includes('STOCK_CANCELLATION')) return 'STOCK_CANCELLATION';
      if (txType.includes('STOCK_REPURCHASE')) return 'STOCK_REPURCHASE';
      if (txType.includes('EQUITY_COMPENSATION_ISSUANCE')) return 'EQUITY_COMPENSATION_ISSUANCE';
      if (txType.includes('EQUITY_COMPENSATION_EXERCISE')) return 'EQUITY_COMPENSATION_EXERCISE';
      if (txType.includes('EQUITY_COMPENSATION_CANCELLATION')) return 'EQUITY_COMPENSATION_CANCELLATION';
      if (txType.includes('WARRANT_ISSUANCE')) return 'WARRANT_ISSUANCE';
      if (txType.includes('WARRANT_CANCELLATION')) return 'WARRANT_CANCELLATION';
      if (txType.includes('CONVERTIBLE_ISSUANCE')) return 'CONVERTIBLE_ISSUANCE';
      if (txType.includes('CONVERTIBLE_CANCELLATION')) return 'CONVERTIBLE_CANCELLATION';
    }
  }

  // Fall back to structural detection using type guards
  if (isOcfIssuer(value)) return 'ISSUER';
  if (isOcfStakeholder(value)) return 'STAKEHOLDER';
  if (isOcfStockClass(value)) return 'STOCK_CLASS';
  if (isOcfStockIssuance(value)) return 'STOCK_ISSUANCE';
  if (isOcfStockTransfer(value)) return 'STOCK_TRANSFER';
  if (isOcfStockCancellation(value)) return 'STOCK_CANCELLATION';
  if (isOcfStockRepurchase(value)) return 'STOCK_REPURCHASE';
  if (isOcfStockLegendTemplate(value)) return 'STOCK_LEGEND_TEMPLATE';
  if (isOcfStockPlan(value)) return 'STOCK_PLAN';
  if (isOcfVestingTerms(value)) return 'VESTING_TERMS';
  if (isOcfEquityCompensationIssuance(value)) return 'EQUITY_COMPENSATION_ISSUANCE';
  if (isOcfEquityCompensationExercise(value)) return 'EQUITY_COMPENSATION_EXERCISE';
  if (isOcfEquityCompensationCancellation(value)) return 'EQUITY_COMPENSATION_CANCELLATION';
  if (isOcfWarrantIssuance(value)) return 'WARRANT_ISSUANCE';
  if (isOcfWarrantCancellation(value)) return 'WARRANT_CANCELLATION';
  if (isOcfConvertibleIssuance(value)) return 'CONVERTIBLE_ISSUANCE';
  if (isOcfConvertibleCancellation(value)) return 'CONVERTIBLE_CANCELLATION';
  if (isOcfValuation(value)) return 'VALUATION';
  if (isOcfDocument(value)) return 'DOCUMENT';

  return 'UNKNOWN';
}

/**
 * Assert that a value is of a specific OCF type, throwing if not.
 *
 * @example
 *   ```typescript
 *   const issuer = assertOcfIssuer(data); // Throws if not an OcfIssuer
 *   console.log(issuer.legal_name); // TypeScript knows this is valid
 *   ```
 */
export function assertOcfIssuer(value: unknown, message?: string): asserts value is OcfIssuer {
  if (!isOcfIssuer(value)) {
    throw new Error(message ?? 'Expected OcfIssuer object');
  }
}

export function assertOcfStakeholder(value: unknown, message?: string): asserts value is OcfStakeholder {
  if (!isOcfStakeholder(value)) {
    throw new Error(message ?? 'Expected OcfStakeholder object');
  }
}

export function assertOcfStockClass(value: unknown, message?: string): asserts value is OcfStockClass {
  if (!isOcfStockClass(value)) {
    throw new Error(message ?? 'Expected OcfStockClass object');
  }
}
