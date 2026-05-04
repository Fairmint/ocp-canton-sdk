import type { CompensationType, OcfStakeholder, OcfStockPlan, StakeholderRelationshipType } from '../types/native';
import { normalizeNumericString } from './typeConversions';
import { isOcfStakeholder, isOcfStockPlan } from './typeGuards';

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

/**
 * Legacy object_type aliases from older OCF event naming.
 *
 * Canonical OCF v2 names:
 * - CE_STAKEHOLDER_RELATIONSHIP
 * - CE_STAKEHOLDER_STATUS
 */
export const LEGACY_OBJECT_TYPE_MAP = {
  TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT: 'CE_STAKEHOLDER_RELATIONSHIP',
  TX_STAKEHOLDER_STATUS_CHANGE_EVENT: 'CE_STAKEHOLDER_STATUS',
} as const;

/** PlanSecurity entity type string union */
export type PlanSecurityEntityType = keyof typeof PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP;

/** PlanSecurity object_type string union */
export type PlanSecurityObjectType = keyof typeof PLAN_SECURITY_OBJECT_TYPE_MAP;
export type LegacyObjectType = keyof typeof LEGACY_OBJECT_TYPE_MAP;

/**
 * Check if an entity type is a PlanSecurity alias.
 *
 * @param type - The entity type to check
 * @returns True if the type is a PlanSecurity alias
 */
export function isPlanSecurityEntityType(type: string): type is PlanSecurityEntityType {
  return Object.prototype.hasOwnProperty.call(PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP, type);
}

/**
 * Check if an object_type is a PlanSecurity alias.
 *
 * @param objectType - The object_type to check
 * @returns True if the object_type is a PlanSecurity alias
 */
export function isPlanSecurityObjectType(objectType: string): objectType is PlanSecurityObjectType {
  return Object.prototype.hasOwnProperty.call(PLAN_SECURITY_OBJECT_TYPE_MAP, objectType);
}

/**
 * Check if an object_type is a legacy alias.
 */
export function isLegacyObjectType(objectType: string): objectType is LegacyObjectType {
  return Object.prototype.hasOwnProperty.call(LEGACY_OBJECT_TYPE_MAP, objectType);
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
  if (isLegacyObjectType(objectType)) {
    return LEGACY_OBJECT_TYPE_MAP[objectType];
  }
  return objectType;
}

type OptionGrantType = 'NSO' | 'ISO' | 'INTL';
type PlanSecurityType = 'OPTION' | 'RSU' | 'OTHER';

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

function mapPlanSecurityTypeToCompensationType(planSecurityType: PlanSecurityType): CompensationType | undefined {
  switch (planSecurityType) {
    case 'OPTION':
      return 'OPTION';
    case 'RSU':
      return 'RSU';
    case 'OTHER':
      return undefined;
  }
}

function isObjectTypeEquityCompensationIssuance(objectType: unknown): boolean {
  return objectType === 'TX_EQUITY_COMPENSATION_ISSUANCE' || objectType === 'TX_PLAN_SECURITY_ISSUANCE';
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

/**
 * Canonicalize deprecated `plan_security_type` to `compensation_type`.
 *
 * Behavior:
 * - If only `plan_security_type` exists, derive `compensation_type` for supported values.
 * - Always strip deprecated `plan_security_type` from canonical output.
 */
function normalizePlanSecurityType(data: Record<string, unknown>): Record<string, unknown> {
  if (!isObjectTypeEquityCompensationIssuance(data.object_type)) return data;

  const planSecurityTypeValue = data.plan_security_type;
  if (planSecurityTypeValue === undefined || planSecurityTypeValue === null) return data;
  if (typeof planSecurityTypeValue !== 'string') {
    throw new Error(`Invalid plan_security_type: expected string, got ${typeof planSecurityTypeValue}`);
  }

  const normalizedPlanSecurityType = planSecurityTypeValue.trim().toUpperCase();
  if (
    normalizedPlanSecurityType !== 'OPTION' &&
    normalizedPlanSecurityType !== 'RSU' &&
    normalizedPlanSecurityType !== 'OTHER'
  ) {
    throw new Error(`Invalid plan_security_type: unsupported value "${planSecurityTypeValue}"`);
  }

  const { plan_security_type: _, ...rest } = data;
  const compensationTypeValue = data.compensation_type;
  if (compensationTypeValue !== undefined && compensationTypeValue !== null) {
    return rest;
  }

  const derivedCompensationType = mapPlanSecurityTypeToCompensationType(normalizedPlanSecurityType);
  if (!derivedCompensationType) {
    throw new Error(
      "plan_security_type 'OTHER' is not supported. DAML only supports 'OPTION' and 'RSU' types. Use EquityCompensationIssuance with a specific compensation_type instead."
    );
  }

  return {
    ...rest,
    compensation_type: derivedCompensationType,
  };
}

const VALID_STAKEHOLDER_RELATIONSHIPS: ReadonlySet<StakeholderRelationshipType> = new Set([
  'EMPLOYEE',
  'ADVISOR',
  'INVESTOR',
  'FOUNDER',
  'BOARD_MEMBER',
  'OFFICER',
  'OTHER',
]);

function isStakeholderRelationshipType(value: string): value is StakeholderRelationshipType {
  return VALID_STAKEHOLDER_RELATIONSHIPS.has(value as StakeholderRelationshipType);
}

/**
 * Canonicalize stakeholder relationship change events to latest OCF format.
 *
 * Latest schema fields:
 * - object_type: CE_STAKEHOLDER_RELATIONSHIP
 * - relationship_started?: StakeholderRelationship
 * - relationship_ended?: StakeholderRelationship
 *
 * Legacy compatibility:
 * - object_type: TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT
 * - new_relationships: StakeholderRelationship[]
 */
function normalizeStakeholderRelationshipChangeEvent<T extends Record<string, unknown>>(data: T): T {
  const normalizedObjectType = normalizeObjectType(typeof data.object_type === 'string' ? data.object_type : '');
  const isRelationshipEvent = normalizedObjectType === 'CE_STAKEHOLDER_RELATIONSHIP';
  if (!isRelationshipEvent) return data;

  const result: Record<string, unknown> = {
    ...data,
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
  };

  const legacyRelationships = result.new_relationships;
  if (legacyRelationships !== undefined) {
    if (!Array.isArray(legacyRelationships)) {
      throw new Error(`Invalid new_relationships: expected array, got ${typeof legacyRelationships}`);
    }

    const normalizedRelationships = legacyRelationships.map((relationship) => {
      if (typeof relationship !== 'string') {
        throw new Error(`Invalid new_relationships entry: expected string, got ${typeof relationship}`);
      }
      const trimmed = relationship.trim().toUpperCase();
      if (!trimmed) {
        throw new Error('Invalid new_relationships entry: empty string');
      }
      if (!isStakeholderRelationshipType(trimmed)) {
        throw new Error(`Invalid new_relationships entry: unknown relationship "${relationship}"`);
      }
      return trimmed;
    });

    if (
      normalizedRelationships.length > 1 &&
      result.relationship_started === undefined &&
      result.relationship_ended === undefined
    ) {
      throw new Error(
        'Invalid stakeholder relationship change event: legacy new_relationships with multiple entries is ambiguous; provide canonical relationship_started/relationship_ended fields'
      );
    }

    if (
      normalizedRelationships.length === 1 &&
      result.relationship_started === undefined &&
      result.relationship_ended === undefined
    ) {
      result.relationship_started = normalizedRelationships[0];
    }

    delete result.new_relationships;
  }

  const relationshipStarted = result.relationship_started;
  const relationshipEnded = result.relationship_ended;
  if (relationshipStarted === undefined && relationshipEnded === undefined) {
    throw new Error(
      'Invalid stakeholder relationship change event: one of relationship_started or relationship_ended is required'
    );
  }
  if (relationshipStarted !== undefined && typeof relationshipStarted !== 'string') {
    throw new Error(`Invalid relationship_started: expected string, got ${typeof relationshipStarted}`);
  }
  if (relationshipEnded !== undefined && typeof relationshipEnded !== 'string') {
    throw new Error(`Invalid relationship_ended: expected string, got ${typeof relationshipEnded}`);
  }
  if (typeof relationshipStarted === 'string') {
    const normalizedRelationshipStarted = relationshipStarted.trim().toUpperCase();
    if (!isStakeholderRelationshipType(normalizedRelationshipStarted)) {
      throw new Error(`Invalid relationship_started: unknown relationship "${relationshipStarted}"`);
    }
    result.relationship_started = normalizedRelationshipStarted;
  }
  if (typeof relationshipEnded === 'string') {
    const normalizedRelationshipEnded = relationshipEnded.trim().toUpperCase();
    if (!isStakeholderRelationshipType(normalizedRelationshipEnded)) {
      throw new Error(`Invalid relationship_ended: unknown relationship "${relationshipEnded}"`);
    }
    result.relationship_ended = normalizedRelationshipEnded;
  }

  return result as T;
}

/**
 * Canonicalize stakeholder status change events to latest OCF format.
 *
 * Latest schema fields:
 * - object_type: CE_STAKEHOLDER_STATUS
 * - new_status
 *
 * Legacy compatibility:
 * - object_type: TX_STAKEHOLDER_STATUS_CHANGE_EVENT
 * - reason_text (dropped during canonicalization)
 */
function normalizeStakeholderStatusChangeEvent<T extends Record<string, unknown>>(data: T): T {
  const normalizedObjectType = normalizeObjectType(typeof data.object_type === 'string' ? data.object_type : '');
  if (normalizedObjectType !== 'CE_STAKEHOLDER_STATUS') return data;

  const result: Record<string, unknown> = {
    ...data,
    object_type: 'CE_STAKEHOLDER_STATUS',
  };

  if (result.comments !== undefined && !Array.isArray(result.comments)) {
    throw new Error(
      `normalizeStakeholderStatusChangeEvent (CE_STAKEHOLDER_STATUS): comments must be an array of strings`
    );
  }
  const existingComments: string[] = [];
  if (Array.isArray(result.comments)) {
    for (const comment of result.comments) {
      if (typeof comment !== 'string') {
        throw new Error(
          `normalizeStakeholderStatusChangeEvent (CE_STAKEHOLDER_STATUS): comments must contain only strings, received value ${JSON.stringify(comment)} of type ${typeof comment}`
        );
      }
      existingComments.push(comment);
    }
  }

  if (typeof result.reason_text === 'string' && result.reason_text.trim().length > 0) {
    result.comments = [...existingComments, result.reason_text.trim()];
  }
  delete result.reason_text;

  return result as T;
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
function normalizeQuantitySource<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_WARRANT_ISSUANCE') {
    return data;
  }

  const { quantity, quantity_source: quantitySource } = data;

  // Case 1: Strip quantity_source if quantity is not present (null/undefined)
  // and quantity_source is 'UNSPECIFIED' (which is equivalent to "don't know")
  if ((quantity === null || quantity === undefined) && quantitySource === 'UNSPECIFIED') {
    const { quantity_source: _, ...rest } = data;
    return rest as T;
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
function stripDocumentNonDamlFields<T extends Record<string, unknown>>(data: T): T {
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
  return result as T;
}

/**
 * Normalize Stakeholder relationship fields for consistent comparison.
 *
 * OCF deprecated `current_relationship` in favor of `current_relationships`.
 * During round-trip, Canton data uses `current_relationships`, while source data
 * may still contain only the legacy field. This causes phantom edits where one
 * side appears empty/undefined.
 *
 * Rules:
 * - Apply only to Stakeholder objects.
 * - If `current_relationships` is an array, keep it authoritative and normalize
 *   ordering/duplicates for deterministic comparison.
 * - If `current_relationships` is missing and legacy `current_relationship` is
 *   a non-empty string, map it to `current_relationships: [value]`.
 */
function normalizeStakeholderRelationships(data: OcfStakeholder): OcfStakeholder;
function normalizeStakeholderRelationships<T extends Record<string, unknown>>(data: T): T;
function normalizeStakeholderRelationships<T extends Record<string, unknown>>(data: T): T {
  const isStakeholderObject = data.object_type === 'STAKEHOLDER' || isOcfStakeholder(data);
  if (!isStakeholderObject) return data;

  const relationshipsValue = data.current_relationships;
  if (relationshipsValue !== undefined && !Array.isArray(relationshipsValue)) {
    throw new Error(`Invalid stakeholder current_relationships: expected array, got ${typeof relationshipsValue}`);
  }

  if (Array.isArray(relationshipsValue)) {
    const normalizedRelationships: string[] = [];
    for (const value of relationshipsValue) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid stakeholder current_relationships entry: expected string, got ${typeof value}`);
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        throw new Error('Invalid stakeholder current_relationships entry: empty string');
      }
      normalizedRelationships.push(trimmed);
    }

    const uniqueSortedRelationships = Array.from(new Set(normalizedRelationships)).sort();
    const alreadyNormalized =
      uniqueSortedRelationships.length === relationshipsValue.length &&
      uniqueSortedRelationships.every((value, index) => value === relationshipsValue[index]);
    if (alreadyNormalized) return data;

    return {
      ...data,
      current_relationships: uniqueSortedRelationships,
    };
  }

  if (data.current_relationship !== undefined && typeof data.current_relationship !== 'string') {
    throw new Error(
      `Invalid stakeholder current_relationship: expected string, got ${typeof data.current_relationship}`
    );
  }
  if (typeof data.current_relationship !== 'string') return data;
  const legacyRelationship = data.current_relationship.trim();
  if (legacyRelationship.length === 0) {
    throw new Error('Invalid stakeholder current_relationship: empty string');
  }

  const { current_relationship: _, ...rest } = data;
  return {
    ...rest,
    current_relationships: [legacyRelationship],
  } as T;
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
function normalizeStockPlanClassIds(data: OcfStockPlan): OcfStockPlan;
function normalizeStockPlanClassIds<T extends Record<string, unknown>>(data: T): T;
function normalizeStockPlanClassIds<T extends Record<string, unknown>>(data: T): T {
  const isStockPlanObject = data.object_type === 'STOCK_PLAN' || isOcfStockPlan(data);
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
  } as T;
}

/**
 * Canonicalize stock consolidation resulting security identifier fields.
 *
 * OCF now uses singular `resulting_security_id`, while legacy payloads may still send
 * `resulting_security_ids` as an array.
 */
function normalizeStockConsolidationResultingSecurityId<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_STOCK_CONSOLIDATION') return data;

  const result: Record<string, unknown> = { ...data };
  const { resulting_security_id } = result;
  const { resulting_security_ids } = result;

  if (resulting_security_ids !== undefined) {
    if (!Array.isArray(resulting_security_ids)) {
      throw new Error(`Invalid resulting_security_ids: expected array, got ${typeof resulting_security_ids}`);
    }

    for (const id of resulting_security_ids) {
      if (typeof id !== 'string') {
        throw new Error(
          `Invalid resulting_security_ids: expected array of strings, found ${typeof id} (${JSON.stringify(id)})`
        );
      }
    }

    if (resulting_security_ids.length !== 1) {
      throw new Error(
        `Invalid resulting_security_ids: expected exactly one entry to map to resulting_security_id, got ${resulting_security_ids.length}`
      );
    }

    if (resulting_security_id !== undefined && typeof resulting_security_id !== 'string') {
      throw new Error(`Invalid resulting_security_id: expected string, got ${typeof resulting_security_id}`);
    }

    if (typeof resulting_security_id === 'string' && resulting_security_id !== resulting_security_ids[0]) {
      throw new Error(
        `Conflicting stock consolidation resulting security IDs: resulting_security_id="${resulting_security_id}" does not match resulting_security_ids[0]="${resulting_security_ids[0]}"`
      );
    }

    if (resulting_security_id === undefined) {
      result.resulting_security_id = resulting_security_ids[0];
    }
    delete result.resulting_security_ids;
  }

  return result as T;
}

/**
 * Canonicalize stock conversion quantity field.
 *
 * OCF now uses `quantity_converted`, while legacy payloads may still send `quantity`.
 */
function normalizeStockConversionQuantityConverted<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_STOCK_CONVERSION') return data;

  const result: Record<string, unknown> = { ...data };
  const quantityConverted = result.quantity_converted;
  const legacyQuantity = result.quantity;

  if (legacyQuantity !== undefined) {
    if (typeof legacyQuantity !== 'string' && typeof legacyQuantity !== 'number') {
      throw new Error(`Invalid stock conversion quantity: expected string or number, got ${typeof legacyQuantity}`);
    }
    const normalizedLegacyQuantity = normalizeNumericString(legacyQuantity);
    if (quantityConverted === undefined) {
      result.quantity_converted = normalizedLegacyQuantity;
    }
    delete result.quantity;
  }

  return result as T;
}

/**
 * Canonicalize stock class split ratio fields.
 *
 * OCF now uses nested `split_ratio`, while legacy payloads may still send
 * `split_ratio_numerator` / `split_ratio_denominator`.
 */
function normalizeStockClassSplitRatio<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_STOCK_CLASS_SPLIT') return data;

  const result: Record<string, unknown> = { ...data };
  const splitRatio = result.split_ratio;
  const legacyNumerator = result.split_ratio_numerator;
  const legacyDenominator = result.split_ratio_denominator;

  if (legacyNumerator !== undefined || legacyDenominator !== undefined) {
    if (legacyNumerator === undefined || legacyDenominator === undefined) {
      throw new Error(
        'Invalid stock class split legacy ratio fields: both split_ratio_numerator and split_ratio_denominator are required'
      );
    }
    if (
      (typeof legacyNumerator !== 'string' && typeof legacyNumerator !== 'number') ||
      (typeof legacyDenominator !== 'string' && typeof legacyDenominator !== 'number')
    ) {
      throw new Error(
        `Invalid stock class split legacy ratio fields: expected string or number values, got numerator=${typeof legacyNumerator}, denominator=${typeof legacyDenominator}`
      );
    }

    if (splitRatio === undefined) {
      result.split_ratio = {
        numerator: normalizeNumericString(legacyNumerator),
        denominator: normalizeNumericString(legacyDenominator),
      };
    }

    delete result.split_ratio_numerator;
    delete result.split_ratio_denominator;
  }

  return result as T;
}

/**
 * Canonicalize stock class conversion ratio adjustment fields.
 *
 * OCF now uses `new_ratio_conversion_mechanism`, while legacy payloads may still send
 * `new_ratio_numerator` / `new_ratio_denominator`.
 */
function normalizeStockClassConversionRatioAdjustmentMechanism<T extends Record<string, unknown>>(data: T): T {
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

  return result as T;
}

/**
 * Canonicalize stock reissuance optional split transaction identifier.
 *
 * Legacy exports may provide explicit `null` for omitted optional fields; convert to absent.
 */
function normalizeStockReissuanceSplitTransactionId<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_STOCK_REISSUANCE') return data;
  if (data.split_transaction_id !== null) return data;

  const { split_transaction_id: _, ...rest } = data;
  return rest as T;
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
export function deepNormalizeNumericStrings<T>(value: T): T {
  if (typeof value === 'string' && hasTrailingDecimalZeros(value)) {
    return normalizeNumericString(value) as T;
  }
  if (Array.isArray(value)) {
    const mapped = value.map(deepNormalizeNumericStrings);
    return (mapped.some((item, i) => item !== value[i]) ? mapped : value) as T;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    const normalized = entries.map(([k, v]) => [k, deepNormalizeNumericStrings(v)] as const);
    if (normalized.every(([, v], i) => v === entries[i][1])) return value;
    return Object.fromEntries(normalized) as T;
  }
  return value;
}

/**
 * Normalize OCF data for consistent comparison.
 *
 * This function applies normalizations to ensure semantically equivalent data compares as equal:
 * 1. Converts PlanSecurity object_type to EquityCompensation equivalent
 * 2. Normalizes quantity_source based on quantity presence (see normalizeQuantitySource)
 * 3. Strips Document fields that the DAML contract does not model (e.g. `date`)
 * 4. Canonicalizes deprecated issuance aliases (`plan_security_type`/`option_grant_type`)
 * 5. Canonicalizes Stakeholder relationships (`current_relationship` -> `current_relationships`)
 * 6. Canonicalizes StockPlan class IDs (`stock_class_id` -> `stock_class_ids`)
 * 7. Canonicalizes StockConversion quantity (`quantity` -> `quantity_converted`)
 * 8. Canonicalizes StockClassSplit legacy ratio fields
 * 9. Canonicalizes StockClassConversionRatioAdjustment legacy ratio fields
 * 10. Normalizes capitalization_definition_rules booleans for convertible issuances
 * 11. Normalizes numeric string formatting (strips trailing zeros from decimals)
 *
 * @param data - The OCF data object that may contain an object_type field
 * @returns The data with normalized fields (shallow copy if modified)
 *
 * @example
 * ```typescript
 * normalizeOcfData({ object_type: 'TX_PLAN_SECURITY_ISSUANCE', id: '123' })
 * // => { object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE', id: '123' }
 *
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
export function normalizeOcfData<T extends Record<string, unknown>>(data: T): T {
  // First normalize quantity_source for consistent comparison
  let result: Record<string, unknown> = normalizeQuantitySource(data);

  // Then normalize PlanSecurity object_type to EquityCompensation
  const objectType = result.object_type;
  if (typeof objectType === 'string' && isPlanSecurityObjectType(objectType)) {
    result = {
      ...result,
      object_type: PLAN_SECURITY_OBJECT_TYPE_MAP[objectType],
    };
  }

  // Strip Document fields that DAML cannot store (e.g. `date`)
  result = stripDocumentNonDamlFields(result);

  // Canonicalize deprecated plan_security_type to compensation_type
  result = normalizePlanSecurityType(result);

  // Canonicalize deprecated option_grant_type to compensation_type
  result = normalizeOptionGrantType(result);

  // Canonicalize deprecated/current stakeholder relationship fields
  result = normalizeStakeholderRelationships(result);

  // Canonicalize deprecated/current stock plan class ID fields
  result = normalizeStockPlanClassIds(result);

  // Canonicalize deprecated stock consolidation singular resulting security identifier
  result = normalizeStockConsolidationResultingSecurityId(result);

  // Canonicalize deprecated stock conversion quantity field
  result = normalizeStockConversionQuantityConverted(result);

  // Canonicalize deprecated stock class split ratio fields
  result = normalizeStockClassSplitRatio(result);

  // Canonicalize deprecated stock class conversion ratio adjustment fields
  result = normalizeStockClassConversionRatioAdjustmentMechanism(result);

  // Canonicalize stock reissuance optional fields exported as explicit nulls
  result = normalizeStockReissuanceSplitTransactionId(result);

  // Canonicalize stakeholder change events after object_type alias normalization above.
  // This ordering ensures TX_STAKEHOLDER_* aliases are converted before field upgrades.
  result = normalizeStakeholderRelationshipChangeEvent(result);
  result = normalizeStakeholderStatusChangeEvent(result);

  result = normalizeVestingTermsDefaults(result);

  result = normalizeConversionMechanismRoundTrip(result);

  result = normalizeCapitalizationDefinitionRules(result);

  result = deepNormalizeNumericStrings(result);

  return result as T;
}

/**
 * The 8 boolean fields in the DAML OcfCapitalizationDefinitionRules type.
 * When the DB has a partial object (e.g., only 6 of 8), the toDaml converter
 * fills missing ones with `false`. After round-trip, Canton has all 8 fields.
 * Normalizing missing booleans to `false` on the DB side prevents permanent
 * non-converging edits.
 */
const CAPITALIZATION_DEFINITION_RULES_BOOL_FIELDS = [
  'include_outstanding_shares',
  'include_outstanding_options',
  'include_outstanding_unissued_options',
  'include_this_security',
  'include_other_converting_securities',
  'include_option_pool_topup_for_promised_options',
  'include_additional_option_pool_topup',
  'include_new_money',
] as const;

/**
 * Normalize `capitalization_definition_rules` inside conversion triggers for
 * TX_CONVERTIBLE_ISSUANCE objects.
 *
 * The DAML type requires all 8 boolean fields. When the DB stores a partial
 * object (e.g., only 6 booleans), the toDaml converter defaults missing ones
 * to `false`. After round-trip, Canton has all 8 fields while the DB still
 * has the partial object. The comparison sees DB `undefined` vs Canton `false`
 * as a diff, causing a permanent non-converging edit.
 *
 * This function walks `conversion_triggers[*].conversion_right.conversion_mechanism
 * .capitalization_definition_rules` and sets any missing boolean field to `false`.
 */
function normalizeCapitalizationDefinitionRules<T extends Record<string, unknown>>(data: T): T {
  if (data.object_type !== 'TX_CONVERTIBLE_ISSUANCE') return data;

  const triggers = data.conversion_triggers;
  if (!Array.isArray(triggers) || triggers.length === 0) return data;

  const normalizedTriggers = triggers.map((trigger: unknown) => {
    if (!trigger || typeof trigger !== 'object' || Array.isArray(trigger)) return trigger;
    const t = trigger as Record<string, unknown>;
    const right = t.conversion_right;
    if (!right || typeof right !== 'object' || Array.isArray(right)) return trigger;
    const r = right as Record<string, unknown>;
    const mechanism = r.conversion_mechanism;
    if (!mechanism || typeof mechanism !== 'object' || Array.isArray(mechanism)) return trigger;
    const m = mechanism as Record<string, unknown>;
    const rules = m.capitalization_definition_rules;
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return trigger;

    const rulesObj = rules as Record<string, unknown>;
    const needsFill = CAPITALIZATION_DEFINITION_RULES_BOOL_FIELDS.some(
      (field) => rulesObj[field] === undefined || rulesObj[field] === null
    );
    if (!needsFill) return trigger;

    const normalizedRules: Record<string, unknown> = { ...rulesObj };
    for (const field of CAPITALIZATION_DEFINITION_RULES_BOOL_FIELDS) {
      normalizedRules[field] ??= false;
    }

    return {
      ...t,
      conversion_right: {
        ...r,
        conversion_mechanism: {
          ...m,
          capitalization_definition_rules: normalizedRules,
        },
      },
    };
  });

  const changed = normalizedTriggers.some((t, i) => t !== triggers[i]);
  if (!changed) return data;
  return { ...data, conversion_triggers: normalizedTriggers };
}

/**
 * Strip fields from conversion_mechanism objects that DAML does not store,
 * so DB-sourced and Canton-sourced data compare identically.
 *
 * The DAML StockClass contract stores conversion_mechanism as an enum string
 * with ratio and conversion_price as separate top-level optional fields.
 * Fields like rounding_type exist in the OCF schema but are not stored in
 * the DAML contract, so they cannot survive the round-trip.
 *
 * Schema-default equivalence: When conversion_rights has exactly one
 * RATIO_CONVERSION right with ratio 1:1, normalize to empty. The OCP Canton
 * SDK reader (getStockClassAsOcf) fills in { numerator: '1', denominator: '1' }
 * when DAML has no explicit ratio, while the DB omits conversion_rights for
 * 1:1 preferred stock. Both are semantically equivalent.
 */
function normalizeConversionMechanismRoundTrip(data: Record<string, unknown>): Record<string, unknown> {
  if (data.object_type !== 'STOCK_CLASS') return data;
  const rights = data.conversion_rights;
  if (!Array.isArray(rights) || rights.length === 0) return data;

  const normalized = (rights as Array<Record<string, unknown>>).map((right) => {
    const mechanism = right.conversion_mechanism;
    if (!mechanism || typeof mechanism !== 'object' || Array.isArray(mechanism)) return right;

    const mech = { ...(mechanism as Record<string, unknown>) };
    delete mech.rounding_type;

    return { ...right, conversion_mechanism: mech };
  });

  // Schema-default: single 1:1 RATIO_CONVERSION → empty (matches DB omission)
  if (normalized.length === 1) {
    const right = normalized[0];
    const mech = right.conversion_mechanism as Record<string, unknown> | undefined;
    if (mech?.type === 'RATIO_CONVERSION') {
      const ratio = mech.ratio as { numerator?: string | number; denominator?: string | number } | undefined;
      const num = ratio?.numerator;
      const den = ratio?.denominator;
      const isOneToOne = (num === '1' || num === 1) && (den === '1' || den === 1);
      if (isOneToOne && right.converts_to_future_round !== true) {
        return { ...data, conversion_rights: [] };
      }
    }
  }

  return { ...data, conversion_rights: normalized };
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
