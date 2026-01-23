/**
 * Plan Security to Equity Compensation alias mappings.
 *
 * OCF defines both "PlanSecurity" and "EquityCompensation" transaction types that are
 * semantically equivalent. This module provides utilities to normalize PlanSecurity
 * types to their EquityCompensation equivalents, allowing the SDK to accept both
 * type families transparently.
 *
 * Reference: The OCF standard includes both TX_PLAN_SECURITY_* and TX_EQUITY_COMPENSATION_*
 * object types in the OcfObjectReference schema.
 */

/**
 * Entity type aliases: maps PlanSecurity entity types to their EquityCompensation equivalents.
 */
export const PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP = {
  planSecurityIssuance: 'equityCompensationIssuance',
  planSecurityExercise: 'equityCompensationExercise',
  planSecurityCancellation: 'equityCompensationCancellation',
  planSecurityAcceptance: 'equityCompensationAcceptance',
  planSecurityRelease: 'equityCompensationRelease',
  planSecurityRetraction: 'equityCompensationRetraction',
  planSecurityTransfer: 'equityCompensationTransfer',
} as const;

/**
 * OCF object_type aliases: maps TX_PLAN_SECURITY_* to TX_EQUITY_COMPENSATION_* object types.
 */
export const PLAN_SECURITY_OBJECT_TYPE_MAP = {
  TX_PLAN_SECURITY_ISSUANCE: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  TX_PLAN_SECURITY_EXERCISE: 'TX_EQUITY_COMPENSATION_EXERCISE',
  TX_PLAN_SECURITY_CANCELLATION: 'TX_EQUITY_COMPENSATION_CANCELLATION',
  TX_PLAN_SECURITY_ACCEPTANCE: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
  TX_PLAN_SECURITY_RELEASE: 'TX_EQUITY_COMPENSATION_RELEASE',
  TX_PLAN_SECURITY_RETRACTION: 'TX_EQUITY_COMPENSATION_RETRACTION',
  TX_PLAN_SECURITY_TRANSFER: 'TX_EQUITY_COMPENSATION_TRANSFER',
} as const;

/** PlanSecurity entity type string union */
export type PlanSecurityEntityType = keyof typeof PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP;

/** PlanSecurity object_type string union */
export type PlanSecurityObjectType = keyof typeof PLAN_SECURITY_OBJECT_TYPE_MAP;

/**
 * Check if an entity type is a PlanSecurity alias.
 *
 * @param type - The entity type to check
 * @returns True if the type is a PlanSecurity alias
 */
export function isPlanSecurityEntityType(type: string): type is PlanSecurityEntityType {
  return type in PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP;
}

/**
 * Check if an object_type is a PlanSecurity alias.
 *
 * @param objectType - The object_type to check
 * @returns True if the object_type is a PlanSecurity alias
 */
export function isPlanSecurityObjectType(objectType: string): objectType is PlanSecurityObjectType {
  return objectType in PLAN_SECURITY_OBJECT_TYPE_MAP;
}

/**
 * Normalize a PlanSecurity entity type to its EquityCompensation equivalent.
 *
 * If the type is not a PlanSecurity alias, it is returned unchanged.
 *
 * @param type - The entity type to normalize
 * @returns The normalized entity type
 *
 * @example
 * ```typescript
 * normalizeEntityType('planSecurityIssuance') // => 'equityCompensationIssuance'
 * normalizeEntityType('stockIssuance') // => 'stockIssuance'
 * ```
 */
export function normalizeEntityType<T extends string>(type: T): string {
  if (isPlanSecurityEntityType(type)) {
    return PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP[type];
  }
  return type;
}

/**
 * Normalize a PlanSecurity object_type to its EquityCompensation equivalent.
 *
 * If the object_type is not a PlanSecurity alias, it is returned unchanged.
 *
 * @param objectType - The object_type to normalize
 * @returns The normalized object_type
 *
 * @example
 * ```typescript
 * normalizeObjectType('TX_PLAN_SECURITY_ISSUANCE') // => 'TX_EQUITY_COMPENSATION_ISSUANCE'
 * normalizeObjectType('TX_STOCK_ISSUANCE') // => 'TX_STOCK_ISSUANCE'
 * ```
 */
export function normalizeObjectType<T extends string>(objectType: T): string {
  if (isPlanSecurityObjectType(objectType)) {
    return PLAN_SECURITY_OBJECT_TYPE_MAP[objectType];
  }
  return objectType;
}

/**
 * Normalize OCF data by converting any PlanSecurity object_type to EquityCompensation.
 *
 * This function creates a shallow copy of the input with the normalized object_type.
 * If the object_type is not a PlanSecurity type, the original object is returned unchanged.
 *
 * @param data - The OCF data object that may contain an object_type field
 * @returns The data with normalized object_type (shallow copy if modified)
 *
 * @example
 * ```typescript
 * normalizeOcfData({ object_type: 'TX_PLAN_SECURITY_ISSUANCE', id: '123' })
 * // => { object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE', id: '123' }
 * ```
 */
export function normalizeOcfData<T extends Record<string, unknown>>(data: T): T {
  const objectType = data.object_type;
  if (typeof objectType === 'string' && isPlanSecurityObjectType(objectType)) {
    return {
      ...data,
      object_type: PLAN_SECURITY_OBJECT_TYPE_MAP[objectType],
    };
  }
  return data;
}
