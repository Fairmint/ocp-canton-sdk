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

import { OcpValidationError } from '../errors';
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
import { getOcfSchema } from './ocfZodSchemas';

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
 * Check if a value is a valid numeric string (decimal format, no whitespace or scientific notation).
 */
export function isNumericValue(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  return /^-?\d+(\.\d+)?$/.test(value);
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
 * Check if a value is a valid Monetary object (amount must be a numeric string).
 */
export function isMonetary(value: unknown): value is { amount: string; currency: string } {
  if (!isObject(value)) return false;
  return 'amount' in value && isNumericValue(value.amount) && 'currency' in value && typeof value.currency === 'string';
}

/** Validate an unknown value against the canonical OCF schema without throwing. */
function isStrictOcfObject<T extends { readonly object_type: string }>(
  value: unknown,
  objectType: T['object_type']
): value is T {
  if (!isObject(value) || Array.isArray(value) || value.object_type !== objectType) return false;

  try {
    return getOcfSchema(objectType).safeParse(value).success;
  } catch {
    return false;
  }
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
  return isStrictOcfObject<OcfIssuer>(value, 'ISSUER');
}

/**
 * Type guard for OcfStakeholder objects.
 */
export function isOcfStakeholder(value: unknown): value is OcfStakeholder {
  return isStrictOcfObject<OcfStakeholder>(value, 'STAKEHOLDER');
}

/**
 * Type guard for OcfStockClass objects.
 */
export function isOcfStockClass(value: unknown): value is OcfStockClass {
  return isStrictOcfObject<OcfStockClass>(value, 'STOCK_CLASS');
}

/**
 * Type guard for OcfStockIssuance objects.
 */
export function isOcfStockIssuance(value: unknown): value is OcfStockIssuance {
  return isStrictOcfObject<OcfStockIssuance>(value, 'TX_STOCK_ISSUANCE');
}

/**
 * Type guard for OcfStockTransfer objects.
 */
export function isOcfStockTransfer(value: unknown): value is OcfStockTransfer {
  return isStrictOcfObject<OcfStockTransfer>(value, 'TX_STOCK_TRANSFER');
}

/**
 * Type guard for OcfStockCancellation objects.
 */
export function isOcfStockCancellation(value: unknown): value is OcfStockCancellation {
  return isStrictOcfObject<OcfStockCancellation>(value, 'TX_STOCK_CANCELLATION');
}

/**
 * Type guard for OcfStockRepurchase objects.
 */
export function isOcfStockRepurchase(value: unknown): value is OcfStockRepurchase {
  return isStrictOcfObject<OcfStockRepurchase>(value, 'TX_STOCK_REPURCHASE');
}

/**
 * Type guard for OcfStockLegendTemplate objects.
 */
export function isOcfStockLegendTemplate(value: unknown): value is OcfStockLegendTemplate {
  return isStrictOcfObject<OcfStockLegendTemplate>(value, 'STOCK_LEGEND_TEMPLATE');
}

/**
 * Type guard for OcfStockPlan objects.
 * Accepts either `stock_class_ids` (array) or deprecated `stock_class_id` (string)
 * per the OCF StockPlan schema oneOf.
 */
export function isOcfStockPlan(value: unknown): value is OcfStockPlan {
  return isStrictOcfObject<OcfStockPlan>(value, 'STOCK_PLAN');
}

/**
 * Type guard for OcfVestingTerms objects.
 */
export function isOcfVestingTerms(value: unknown): value is OcfVestingTerms {
  return isStrictOcfObject<OcfVestingTerms>(value, 'VESTING_TERMS');
}

/**
 * Type guard for OcfEquityCompensationIssuance objects.
 */
export function isOcfEquityCompensationIssuance(value: unknown): value is OcfEquityCompensationIssuance {
  return isStrictOcfObject<OcfEquityCompensationIssuance>(value, 'TX_EQUITY_COMPENSATION_ISSUANCE');
}

/**
 * Type guard for OcfEquityCompensationExercise objects.
 */
export function isOcfEquityCompensationExercise(value: unknown): value is OcfEquityCompensationExercise {
  return isStrictOcfObject<OcfEquityCompensationExercise>(value, 'TX_EQUITY_COMPENSATION_EXERCISE');
}

/**
 * Type guard for OcfEquityCompensationCancellation objects.
 */
export function isOcfEquityCompensationCancellation(value: unknown): value is OcfEquityCompensationCancellation {
  return isStrictOcfObject<OcfEquityCompensationCancellation>(value, 'TX_EQUITY_COMPENSATION_CANCELLATION');
}

/**
 * Type guard for OcfWarrantIssuance objects.
 */
export function isOcfWarrantIssuance(value: unknown): value is OcfWarrantIssuance {
  return isStrictOcfObject<OcfWarrantIssuance>(value, 'TX_WARRANT_ISSUANCE');
}

/**
 * Type guard for OcfWarrantCancellation objects.
 */
export function isOcfWarrantCancellation(value: unknown): value is OcfWarrantCancellation {
  return isStrictOcfObject<OcfWarrantCancellation>(value, 'TX_WARRANT_CANCELLATION');
}

/**
 * Type guard for OcfConvertibleIssuance objects.
 */
export function isOcfConvertibleIssuance(value: unknown): value is OcfConvertibleIssuance {
  return isStrictOcfObject<OcfConvertibleIssuance>(value, 'TX_CONVERTIBLE_ISSUANCE');
}

/**
 * Type guard for OcfConvertibleCancellation objects.
 */
export function isOcfConvertibleCancellation(value: unknown): value is OcfConvertibleCancellation {
  return isStrictOcfObject<OcfConvertibleCancellation>(value, 'TX_CONVERTIBLE_CANCELLATION');
}

/**
 * Type guard for OcfValuation objects.
 */
export function isOcfValuation(value: unknown): value is OcfValuation {
  return isStrictOcfObject<OcfValuation>(value, 'VALUATION');
}

/**
 * Type guard for OcfDocument objects.
 */
export function isOcfDocument(value: unknown): value is OcfDocument {
  return isStrictOcfObject<OcfDocument>(value, 'DOCUMENT');
}

// ===== Generic OCF Object Type Detection =====

/**
 * Detected OCF object types from runtime type guards.
 *
 * Legacy category names returned by {@link detectOcfObjectType}, plus `UNKNOWN`.
 * Prefer the canonical `object_type` literal on the narrowed OCF object itself.
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
  // A discriminator identifies the candidate schema, but detection succeeds only
  // after the complete object passes the corresponding sound type guard.
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
    throw new OcpValidationError('issuer', message ?? 'Expected OcfIssuer object', {
      expectedType: 'OcfIssuer',
      receivedValue: value,
    });
  }
}

export function assertOcfStakeholder(value: unknown, message?: string): asserts value is OcfStakeholder {
  if (!isOcfStakeholder(value)) {
    throw new OcpValidationError('stakeholder', message ?? 'Expected OcfStakeholder object', {
      expectedType: 'OcfStakeholder',
      receivedValue: value,
    });
  }
}

export function assertOcfStockClass(value: unknown, message?: string): asserts value is OcfStockClass {
  if (!isOcfStockClass(value)) {
    throw new OcpValidationError('stockClass', message ?? 'Expected OcfStockClass object', {
      expectedType: 'OcfStockClass',
      receivedValue: value,
    });
  }
}
