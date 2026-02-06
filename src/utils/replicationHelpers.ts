/**
 * Replication helpers for cap table synchronization.
 *
 * Provides utilities for:
 * - Mapping categorized OCF types to SDK entity types
 * - Computing replication diffs between source and Canton state
 * - Human-readable labels for display
 *
 * @module replicationHelpers
 */

import type { OcfEntityType } from '../functions/OpenCapTable/capTable/batchTypes';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import type { OcfManifest } from './cantonOcfExtractor';
import { DEFAULT_DEPRECATED_FIELDS, DEFAULT_INTERNAL_FIELDS, ocfDeepEqual } from './ocfComparison';
import { normalizeEntityType, normalizeOcfData, normalizeObjectType } from './planSecurityAliases';

// ============================================================================
// OcfEntityType Validation
// ============================================================================

/**
 * Runtime set of all valid OcfEntityType values.
 * Used for runtime validation when entity types come from external sources.
 */
const VALID_OCF_ENTITY_TYPES: ReadonlySet<string> = new Set<OcfEntityType>([
  'convertibleAcceptance',
  'convertibleCancellation',
  'convertibleConversion',
  'convertibleIssuance',
  'convertibleRetraction',
  'convertibleTransfer',
  'document',
  'equityCompensationAcceptance',
  'equityCompensationCancellation',
  'equityCompensationExercise',
  'equityCompensationIssuance',
  'equityCompensationRelease',
  'equityCompensationRepricing',
  'equityCompensationRetraction',
  'equityCompensationTransfer',
  'issuer',
  'issuerAuthorizedSharesAdjustment',
  'planSecurityAcceptance',
  'planSecurityCancellation',
  'planSecurityExercise',
  'planSecurityIssuance',
  'planSecurityRelease',
  'planSecurityRetraction',
  'planSecurityTransfer',
  'stakeholder',
  'stakeholderRelationshipChangeEvent',
  'stakeholderStatusChangeEvent',
  'stockAcceptance',
  'stockCancellation',
  'stockClass',
  'stockClassAuthorizedSharesAdjustment',
  'stockClassConversionRatioAdjustment',
  'stockClassSplit',
  'stockConsolidation',
  'stockConversion',
  'stockIssuance',
  'stockLegendTemplate',
  'stockPlan',
  'stockPlanPoolAdjustment',
  'stockPlanReturnToPool',
  'stockReissuance',
  'stockRepurchase',
  'stockRetraction',
  'stockTransfer',
  'valuation',
  'vestingAcceleration',
  'vestingEvent',
  'vestingStart',
  'vestingTerms',
  'warrantAcceptance',
  'warrantCancellation',
  'warrantExercise',
  'warrantIssuance',
  'warrantRetraction',
  'warrantTransfer',
]);

/**
 * Runtime type guard for OcfEntityType.
 *
 * @param value - The value to check
 * @returns True if value is a valid OcfEntityType
 */
export function isOcfEntityType(value: string): value is OcfEntityType {
  return VALID_OCF_ENTITY_TYPES.has(value);
}

// ============================================================================
// Categorized Type Mapping
// ============================================================================

/**
 * Object type mappings shared between DIRECT_TYPE_MAP and OBJECT_SUBTYPE_MAP.
 * These types can be stored either directly (e.g., type='DOCUMENT') or
 * categorized (e.g., type='OBJECT', subtype='DOCUMENT').
 *
 * IMPORTANT: Add new object types here to ensure both direct and categorized
 * formats are supported consistently.
 */
const OBJECT_TYPES: Record<string, OcfEntityType> = {
  DOCUMENT: 'document',
  VESTING_TERMS: 'vestingTerms',
  STOCK_LEGEND_TEMPLATE: 'stockLegendTemplate',
  VALUATION: 'valuation',
};

/**
 * Direct category type to OcfEntityType mappings.
 * These types use the category directly as the type identifier.
 *
 * Note: Some databases store object types directly (DOCUMENT, VESTING_TERMS, etc.)
 * rather than using the OBJECT category with subtypes. Both formats are supported.
 */
const DIRECT_TYPE_MAP: Record<string, OcfEntityType> = {
  // Core entity types
  ISSUER: 'issuer',
  STAKEHOLDER: 'stakeholder',
  STOCK_CLASS: 'stockClass',
  STOCK_PLAN: 'stockPlan',
  // Object types (some DBs store these directly instead of OBJECT/subtype)
  ...OBJECT_TYPES,
};

/**
 * OBJECT subtype to OcfEntityType mappings.
 * These use category='OBJECT' with the actual type in the subtype field.
 */
const OBJECT_SUBTYPE_MAP: Record<string, OcfEntityType> = {
  ...OBJECT_TYPES,
};

/**
 * TRANSACTION subtype to OcfEntityType mappings.
 * These use category='TRANSACTION' with the actual type in the subtype field.
 * Subtypes use TX_ prefix with UPPER_SNAKE_CASE, SDK uses camelCase.
 *
 * Exported so that other modules can derive the inverse mapping programmatically
 * rather than maintaining duplicate data.
 */
export const TRANSACTION_SUBTYPE_MAP: Record<string, OcfEntityType> = {
  // Stock Transactions (9 types)
  TX_STOCK_ISSUANCE: 'stockIssuance',
  TX_STOCK_CANCELLATION: 'stockCancellation',
  TX_STOCK_TRANSFER: 'stockTransfer',
  TX_STOCK_ACCEPTANCE: 'stockAcceptance',
  TX_STOCK_CONVERSION: 'stockConversion',
  TX_STOCK_REPURCHASE: 'stockRepurchase',
  TX_STOCK_REISSUANCE: 'stockReissuance',
  TX_STOCK_RETRACTION: 'stockRetraction',
  TX_STOCK_CONSOLIDATION: 'stockConsolidation',

  // Equity Compensation (8 types)
  TX_EQUITY_COMPENSATION_ISSUANCE: 'equityCompensationIssuance',
  TX_EQUITY_COMPENSATION_CANCELLATION: 'equityCompensationCancellation',
  TX_EQUITY_COMPENSATION_TRANSFER: 'equityCompensationTransfer',
  TX_EQUITY_COMPENSATION_ACCEPTANCE: 'equityCompensationAcceptance',
  TX_EQUITY_COMPENSATION_EXERCISE: 'equityCompensationExercise',
  TX_EQUITY_COMPENSATION_RELEASE: 'equityCompensationRelease',
  TX_EQUITY_COMPENSATION_REPRICING: 'equityCompensationRepricing',
  TX_EQUITY_COMPENSATION_RETRACTION: 'equityCompensationRetraction',

  // Convertibles (6 types)
  TX_CONVERTIBLE_ISSUANCE: 'convertibleIssuance',
  TX_CONVERTIBLE_CANCELLATION: 'convertibleCancellation',
  TX_CONVERTIBLE_TRANSFER: 'convertibleTransfer',
  TX_CONVERTIBLE_ACCEPTANCE: 'convertibleAcceptance',
  TX_CONVERTIBLE_CONVERSION: 'convertibleConversion',
  TX_CONVERTIBLE_RETRACTION: 'convertibleRetraction',

  // Warrants (6 types)
  TX_WARRANT_ISSUANCE: 'warrantIssuance',
  TX_WARRANT_CANCELLATION: 'warrantCancellation',
  TX_WARRANT_TRANSFER: 'warrantTransfer',
  TX_WARRANT_ACCEPTANCE: 'warrantAcceptance',
  TX_WARRANT_EXERCISE: 'warrantExercise',
  TX_WARRANT_RETRACTION: 'warrantRetraction',

  // Stock Class Adjustments (4 types)
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: 'stockClassAuthorizedSharesAdjustment',
  TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT: 'stockClassConversionRatioAdjustment',
  TX_STOCK_CLASS_SPLIT: 'stockClassSplit',
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: 'issuerAuthorizedSharesAdjustment',

  // Stock Plan Events (2 types)
  TX_STOCK_PLAN_POOL_ADJUSTMENT: 'stockPlanPoolAdjustment',
  TX_STOCK_PLAN_RETURN_TO_POOL: 'stockPlanReturnToPool',

  // Vesting Events (3 types)
  TX_VESTING_ACCELERATION: 'vestingAcceleration',
  TX_VESTING_EVENT: 'vestingEvent',
  TX_VESTING_START: 'vestingStart',

  // Stakeholder Events (2 types)
  TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT: 'stakeholderRelationshipChangeEvent',
  TX_STAKEHOLDER_STATUS_CHANGE_EVENT: 'stakeholderStatusChangeEvent',
};

/**
 * Map categorized OCF type/subtype to OcfEntityType.
 *
 * OCF data may be organized into categories:
 * - Direct types: STAKEHOLDER, STOCK_CLASS, STOCK_PLAN as the category
 * - Object subtypes: category='OBJECT', actual type in subtype
 * - Transaction subtypes: category='TRANSACTION', actual type in subtype (TX_ prefix)
 *
 * @param categoryType - The OCF category (STAKEHOLDER, OBJECT, TRANSACTION, etc.)
 * @param subtype - The subtype for OBJECT and TRANSACTION categories
 * @returns The corresponding OcfEntityType, or null if not supported
 *
 * @example
 * ```typescript
 * mapCategorizedTypeToEntityType('STAKEHOLDER', null); // 'stakeholder'
 * mapCategorizedTypeToEntityType('DOCUMENT', null); // 'document' (direct type)
 * mapCategorizedTypeToEntityType('OBJECT', 'DOCUMENT'); // 'document' (categorized)
 * mapCategorizedTypeToEntityType('TRANSACTION', 'TX_STOCK_ISSUANCE'); // 'stockIssuance'
 * ```
 */
export function mapCategorizedTypeToEntityType(categoryType: string, subtype: string | null): OcfEntityType | null {
  // Direct mappings
  if (categoryType in DIRECT_TYPE_MAP) {
    return DIRECT_TYPE_MAP[categoryType];
  }

  // Object subtypes
  if (categoryType === 'OBJECT' && subtype) {
    return OBJECT_SUBTYPE_MAP[subtype] ?? null;
  }

  // Transaction subtypes
  if (categoryType === 'TRANSACTION' && subtype) {
    return TRANSACTION_SUBTYPE_MAP[subtype] ?? null;
  }

  return null;
}

// ============================================================================
// Human-Readable Labels
// ============================================================================

/**
 * Human-readable labels for each entity type: [singular, plural].
 */
const ENTITY_TYPE_LABELS: Record<OcfEntityType, [string, string]> = {
  // Core Objects (8 types)
  issuer: ['Issuer', 'Issuers'], // edit-only, not in CapTable maps
  stakeholder: ['Stakeholder', 'Stakeholders'],
  stockClass: ['Stock Class', 'Stock Classes'],
  stockPlan: ['Stock Plan', 'Stock Plans'],
  vestingTerms: ['Vesting Terms', 'Vesting Terms'],
  stockLegendTemplate: ['Stock Legend Template', 'Stock Legend Templates'],
  document: ['Document', 'Documents'],
  valuation: ['Valuation', 'Valuations'],

  // Stock Transactions (9 types)
  stockIssuance: ['Stock Issuance', 'Stock Issuances'],
  stockCancellation: ['Stock Cancellation', 'Stock Cancellations'],
  stockTransfer: ['Stock Transfer', 'Stock Transfers'],
  stockAcceptance: ['Stock Acceptance', 'Stock Acceptances'],
  stockConversion: ['Stock Conversion', 'Stock Conversions'],
  stockRepurchase: ['Stock Repurchase', 'Stock Repurchases'],
  stockReissuance: ['Stock Reissuance', 'Stock Reissuances'],
  stockRetraction: ['Stock Retraction', 'Stock Retractions'],
  stockConsolidation: ['Stock Consolidation', 'Stock Consolidations'],

  // Equity Compensation (8 types)
  equityCompensationIssuance: ['Equity Compensation Issuance', 'Equity Compensation Issuances'],
  equityCompensationCancellation: ['Equity Compensation Cancellation', 'Equity Compensation Cancellations'],
  equityCompensationTransfer: ['Equity Compensation Transfer', 'Equity Compensation Transfers'],
  equityCompensationAcceptance: ['Equity Compensation Acceptance', 'Equity Compensation Acceptances'],
  equityCompensationExercise: ['Equity Compensation Exercise', 'Equity Compensation Exercises'],
  equityCompensationRelease: ['Equity Compensation Release', 'Equity Compensation Releases'],
  equityCompensationRepricing: ['Equity Compensation Repricing', 'Equity Compensation Repricings'],
  equityCompensationRetraction: ['Equity Compensation Retraction', 'Equity Compensation Retractions'],

  // Plan Security aliases (use same labels as Equity Compensation)
  planSecurityIssuance: ['Plan Security Issuance', 'Plan Security Issuances'],
  planSecurityCancellation: ['Plan Security Cancellation', 'Plan Security Cancellations'],
  planSecurityTransfer: ['Plan Security Transfer', 'Plan Security Transfers'],
  planSecurityAcceptance: ['Plan Security Acceptance', 'Plan Security Acceptances'],
  planSecurityExercise: ['Plan Security Exercise', 'Plan Security Exercises'],
  planSecurityRelease: ['Plan Security Release', 'Plan Security Releases'],
  planSecurityRetraction: ['Plan Security Retraction', 'Plan Security Retractions'],

  // Convertibles (6 types)
  convertibleIssuance: ['Convertible Issuance', 'Convertible Issuances'],
  convertibleCancellation: ['Convertible Cancellation', 'Convertible Cancellations'],
  convertibleTransfer: ['Convertible Transfer', 'Convertible Transfers'],
  convertibleAcceptance: ['Convertible Acceptance', 'Convertible Acceptances'],
  convertibleConversion: ['Convertible Conversion', 'Convertible Conversions'],
  convertibleRetraction: ['Convertible Retraction', 'Convertible Retractions'],

  // Warrants (6 types)
  warrantIssuance: ['Warrant Issuance', 'Warrant Issuances'],
  warrantCancellation: ['Warrant Cancellation', 'Warrant Cancellations'],
  warrantTransfer: ['Warrant Transfer', 'Warrant Transfers'],
  warrantAcceptance: ['Warrant Acceptance', 'Warrant Acceptances'],
  warrantExercise: ['Warrant Exercise', 'Warrant Exercises'],
  warrantRetraction: ['Warrant Retraction', 'Warrant Retractions'],

  // Stock Class Adjustments (4 types)
  stockClassAuthorizedSharesAdjustment: [
    'Stock Class Authorized Shares Adjustment',
    'Stock Class Authorized Shares Adjustments',
  ],
  stockClassConversionRatioAdjustment: [
    'Stock Class Conversion Ratio Adjustment',
    'Stock Class Conversion Ratio Adjustments',
  ],
  stockClassSplit: ['Stock Class Split', 'Stock Class Splits'],
  issuerAuthorizedSharesAdjustment: ['Issuer Authorized Shares Adjustment', 'Issuer Authorized Shares Adjustments'],

  // Stock Plan Events (2 types)
  stockPlanPoolAdjustment: ['Stock Plan Pool Adjustment', 'Stock Plan Pool Adjustments'],
  stockPlanReturnToPool: ['Stock Plan Return to Pool', 'Stock Plan Returns to Pool'],

  // Vesting Events (3 types)
  vestingAcceleration: ['Vesting Acceleration', 'Vesting Accelerations'],
  vestingEvent: ['Vesting Event', 'Vesting Events'],
  vestingStart: ['Vesting Start', 'Vesting Starts'],

  // Stakeholder Events (2 types)
  stakeholderRelationshipChangeEvent: ['Stakeholder Relationship Change', 'Stakeholder Relationship Changes'],
  stakeholderStatusChangeEvent: ['Stakeholder Status Change', 'Stakeholder Status Changes'],
};

/**
 * Get a human-readable label for an entity type with count.
 *
 * @param type - The OcfEntityType
 * @param count - The count (determines singular vs plural)
 * @returns Human-readable string like "3 Stock Classes" or "1 Stakeholder"
 *
 * @example
 * ```typescript
 * getEntityTypeLabel('stockClass', 1); // "1 Stock Class"
 * getEntityTypeLabel('stockClass', 3); // "3 Stock Classes"
 * getEntityTypeLabel('stakeholder', 0); // "0 Stakeholders"
 * ```
 */
export function getEntityTypeLabel(type: OcfEntityType, count: number): string {
  const labels = ENTITY_TYPE_LABELS[type];
  const [singular, plural] = labels;
  return `${count} ${count === 1 ? singular : plural}`;
}

// ============================================================================
// Canton OCF Data Map Builder
// ============================================================================

/**
 * Build a CantonOcfDataMap from an OCF manifest.
 *
 * Converts the array-based manifest structure into a nested Map structure
 * that can be used for efficient lookup during replication diff computation.
 *
 * @param manifest - OCF manifest from extractCantonOcfManifest
 * @returns Map of entityType → Map of ocfId → OCF data object
 * @throws Error if any object is missing a valid 'id' field or has an unsupported object_type
 *
 * @example
 * ```typescript
 * import { extractCantonOcfManifest } from './cantonOcfExtractor';
 *
 * const manifest = await extractCantonOcfManifest(client, cantonState);
 * const cantonOcfData = buildCantonOcfDataMap(manifest);
 * const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });
 * ```
 */
export function buildCantonOcfDataMap(manifest: OcfManifest): CantonOcfDataMap {
  const result: CantonOcfDataMap = new Map();

  // Helper to add an item to the map with validation
  const addItem = (entityType: OcfEntityType, item: Record<string, unknown>, context: string): void => {
    const { id } = item;
    if (typeof id !== 'string') {
      throw new Error(`Invalid ${context}: missing or invalid 'id' field. Got: ${JSON.stringify(id)}`);
    }

    let typeMap = result.get(entityType);
    if (!typeMap) {
      typeMap = new Map();
      result.set(entityType, typeMap);
    }
    typeMap.set(id, item);
  };

  // Process issuer (special case - single item, not array)
  if (manifest.issuer) {
    addItem('issuer', manifest.issuer, 'issuer');
  }

  // Process core objects
  for (const stakeholder of manifest.stakeholders) {
    addItem('stakeholder', stakeholder, 'stakeholder');
  }
  for (const stockClass of manifest.stockClasses) {
    addItem('stockClass', stockClass, 'stockClass');
  }
  for (const stockPlan of manifest.stockPlans) {
    addItem('stockPlan', stockPlan, 'stockPlan');
  }
  for (const vestingTerms of manifest.vestingTerms) {
    addItem('vestingTerms', vestingTerms, 'vestingTerms');
  }
  for (const valuation of manifest.valuations) {
    addItem('valuation', valuation, 'valuation');
  }
  for (const document of manifest.documents) {
    addItem('document', document, 'document');
  }
  for (const stockLegendTemplate of manifest.stockLegendTemplates) {
    addItem('stockLegendTemplate', stockLegendTemplate, 'stockLegendTemplate');
  }

  // Process transactions - categorize by object_type using existing TRANSACTION_SUBTYPE_MAP
  for (const tx of manifest.transactions) {
    const objectType = tx['object_type'];
    if (typeof objectType !== 'string') {
      throw new Error(
        `Invalid transaction: missing or invalid 'object_type' field. Got: ${JSON.stringify(objectType)}`
      );
    }

    // Normalize TX_PLAN_SECURITY_* to TX_EQUITY_COMPENSATION_* for lookup
    // Canton can return legacy plan security types that need to be mapped to equity compensation
    const normalizedObjectType = normalizeObjectType(objectType);

    // Check if the normalized object type is a known transaction type
    if (!(normalizedObjectType in TRANSACTION_SUBTYPE_MAP)) {
      throw new Error(`Unsupported transaction object_type: ${objectType}`);
    }
    const entityType = TRANSACTION_SUBTYPE_MAP[normalizedObjectType];
    addItem(entityType, tx, `transaction (${objectType})`);
  }

  return result;
}

// ============================================================================
// Replication Diff
// ============================================================================

/**
 * Issuance entity types that enforce security_id uniqueness on Canton.
 * These types maintain a separate `*_by_security_id` map in the CapTable contract,
 * and creating two issuances with the same security_id will fail with
 * "security_id already exists".
 */
const ISSUANCE_ENTITY_TYPES: ReadonlySet<OcfEntityType> = new Set([
  'stockIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
  'warrantIssuance',
]);

/**
 * A single item to be synced to Canton.
 */
export interface ReplicationItem {
  /** OCF object ID */
  ocfId: string;
  /** Entity type (SDK format) */
  entityType: OcfEntityType;
  /** Operation to perform */
  operation: 'create' | 'edit' | 'delete';
  /** OCF data for create/edit operations */
  data?: unknown;
}

/**
 * A security_id conflict detected during diff computation.
 * This occurs when a proposed CREATE has a security_id that already exists
 * on Canton under a different object ID.
 */
export interface SecurityIdConflict {
  /** The OCF ID of the source item that would conflict */
  ocfId: string;
  /** The entity type of the conflicting item */
  entityType: OcfEntityType;
  /** The security_id value that already exists on Canton */
  securityId: string;
  /** Human-readable description of the conflict */
  message: string;
}

/**
 * Result of comparing source state (desired) to Canton state (actual).
 */
export interface ReplicationDiff {
  /** Items in source but not in Canton - need to be created */
  creates: ReplicationItem[];
  /** Items in both - may need to be edited */
  edits: ReplicationItem[];
  /** Items in Canton but not in source - need to be deleted */
  deletes: ReplicationItem[];
  /** Total number of operations (creates + edits + deletes) */
  total: number;
  /**
   * Security ID conflicts detected in proposed creates.
   * Each conflict indicates a CREATE that will fail because its security_id
   * is already taken by a different object on Canton. The conflicting items
   * are still included in `creates` (they represent real source-vs-Canton diffs),
   * but callers should handle conflicts before submitting to DAML.
   */
  conflicts: SecurityIdConflict[];
}

/**
 * Canton OCF data map for deep comparison.
 * Maps entityType to a map of ocfId to OCF data object.
 */
export type CantonOcfDataMap = Map<OcfEntityType, Map<string, Record<string, unknown>>>;

/**
 * Options for computing the replication diff.
 */
export interface ComputeReplicationDiffOptions {
  /**
   * Canton OCF data for deep comparison.
   * When provided, items that exist in both source and Canton are compared using
   * semantic OCF equality (ocfDeepEqual). Only items with actual data differences
   * are marked for edit.
   *
   * The map should be structured as: Map<OcfEntityType, Map<ocfId, ocfDataObject>>
   *
   * This enables propagating database corrections to Canton without blindly updating
   * all existing items.
   *
   * When not provided, only creates are detected (no edits).
   */
  cantonOcfData?: CantonOcfDataMap;

  /**
   * Enable detailed diff logging for diagnostics.
   * When true, logs field-level differences for items marked as edits.
   * Default: false (opt-in to avoid leaking sensitive data in production logs)
   */
  reportDifferences?: boolean;

  /**
   * Security IDs currently on Canton, grouped by issuance entity type.
   * When provided, creates for issuance types (stockIssuance, convertibleIssuance,
   * equityCompensationIssuance, warrantIssuance) are checked against this map
   * to detect security_id conflicts before DAML rejects them.
   *
   * Populated from `CapTableState.securityIds` (returned by `getCapTableState`).
   */
  securityIds?: Map<OcfEntityType, Set<string>>;
}

/**
 * Compute what needs to be synced to Canton.
 *
 * Compares a list of source items (desired state) against Canton state (actual state)
 * and returns operations needed to synchronize them. The database is the source of truth:
 * items in DB but not Canton are created, items in Canton but not DB are deleted.
 *
 * @param sourceItems - OCF items from any source (desired state)
 * @param cantonState - Current Canton state from getCapTableState()
 * @param options - Sync options
 * @returns Replication diff with creates, edits, and deletes
 *
 * @example
 * ```typescript
 * const sourceItems = [
 *   { ocfId: 'stakeholder-1', entityType: 'stakeholder', data: {...} },
 *   { ocfId: 'stock-class-1', entityType: 'stockClass', data: {...} },
 * ];
 * const cantonState = await getCapTableState(client, issuerPartyId);
 * const diff = computeReplicationDiff(sourceItems, cantonState);
 * // diff.creates = items in source but not Canton
 * // diff.edits = items in both with data differences
 * // diff.deletes = items in Canton but not source
 * ```
 */
export function computeReplicationDiff(
  sourceItems: Array<{ ocfId: string; entityType: OcfEntityType; data: unknown }>,
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions = {}
): ReplicationDiff {
  const { cantonOcfData, reportDifferences = false, securityIds } = options;

  const creates: ReplicationItem[] = [];
  const edits: ReplicationItem[] = [];
  const deletes: ReplicationItem[] = [];
  const conflicts: SecurityIdConflict[] = [];

  // Track source items by type for delete detection
  const sourceIdsByType = new Map<OcfEntityType, Set<string>>();

  // Track seen items to prevent duplicate create/edit operations
  const seenItems = new Set<string>();

  // Comparison options for OCF deep equality
  const comparisonOptions = {
    ignoredFields: DEFAULT_INTERNAL_FIELDS,
    deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
    reportDifferences,
  };

  // Process each source item
  for (const item of sourceItems) {
    // Normalize planSecurity types to equityCompensation for Canton lookup
    // Canton stores planSecurity items under equity_compensation_* fields
    const normalizedType = normalizeEntityType(item.entityType) as OcfEntityType;

    // Skip duplicate items (same ocfId + normalized entityType)
    // Use normalized type because aliased types (e.g., planSecurityIssuance and
    // equityCompensationIssuance) map to the same Canton entity
    const itemKey = `${normalizedType}:${item.ocfId}`;
    if (seenItems.has(itemKey)) {
      continue;
    }
    seenItems.add(itemKey);

    // Track for delete detection (using normalized type to match Canton's storage)
    let typeIds = sourceIdsByType.get(normalizedType);
    if (!typeIds) {
      typeIds = new Set();
      sourceIdsByType.set(normalizedType, typeIds);
    }
    typeIds.add(item.ocfId);

    // Check if exists in Canton (using normalized type)
    const cantonIds = cantonState.entities.get(normalizedType) ?? new Set();
    const existsInCanton = cantonIds.has(item.ocfId);

    if (!existsInCanton) {
      // Item in source but not Canton → CREATE
      creates.push({
        ocfId: item.ocfId,
        entityType: item.entityType,
        operation: 'create',
        data: item.data,
      });

      // Check for security_id conflicts on issuance creates
      // The DAML contract enforces security_id uniqueness via *_by_security_id maps.
      // If the source has a new object ID but reuses a security_id already on Canton,
      // the create will be rejected. Detect this early with an actionable message.
      if (securityIds && ISSUANCE_ENTITY_TYPES.has(normalizedType)) {
        const dataObj = item.data as Record<string, unknown> | null | undefined;
        const securityId = typeof dataObj?.security_id === 'string' ? dataObj.security_id : undefined;
        if (securityId) {
          const cantonSecurityIds = securityIds.get(normalizedType);
          if (cantonSecurityIds?.has(securityId)) {
            conflicts.push({
              ocfId: item.ocfId,
              entityType: normalizedType,
              securityId,
              message:
                `${getEntityTypeLabel(normalizedType, 1)} id="${item.ocfId}" has ` +
                `security_id="${securityId}" which already exists on Canton under a different ` +
                `object ID. This indicates duplicate security_id values in the source data.`,
            });
          }
        }
      }
    } else if (cantonOcfData) {
      // Deep comparison: compare actual OCF data to detect changes
      const cantonTypeData = cantonOcfData.get(normalizedType);
      const cantonItemData = cantonTypeData?.get(item.ocfId);

      if (cantonItemData === undefined) {
        // cantonOcfData was provided but this item's data wasn't found
        // This indicates cantonOcfData is incomplete or inconsistent with cantonState.entities
        throw new Error(
          `Inconsistent cantonOcfData: missing OCF data for entityType="${normalizedType}", ` +
            `ocfId="${item.ocfId}" even though the ID exists in cantonState.entities. ` +
            `Ensure cantonOcfData is built from the same Canton state.`
        );
      }

      // Validate item.data is a proper object before comparison (fail-fast)
      if (typeof item.data !== 'object' || item.data === null || Array.isArray(item.data)) {
        throw new Error(
          `Invalid source data for entityType="${item.entityType}", ocfId="${item.ocfId}": ` +
            `expected object, got ${item.data === null ? 'null' : Array.isArray(item.data) ? 'array' : typeof item.data}`
        );
      }

      // Normalize object_type aliases (e.g., TX_PLAN_SECURITY_* → TX_EQUITY_COMPENSATION_*)
      // before comparison to prevent false-positive diffs from alias variants
      const normalizedSourceData = normalizeOcfData(item.data as Record<string, unknown>);
      const normalizedCantonData = normalizeOcfData(cantonItemData);

      // Compare source data with Canton data using semantic OCF equality
      const isEqual = ocfDeepEqual(normalizedSourceData, normalizedCantonData, comparisonOptions);

      if (!isEqual) {
        // Data differs → EDIT
        edits.push({
          ocfId: item.ocfId,
          entityType: item.entityType,
          operation: 'edit',
          data: item.data,
        });
      }
      // If equal, skip (data is already in sync)
    }
    // If no cantonOcfData provided and item exists in Canton, skip (no edit detection)
  }

  // Detect deletes (in Canton but not in source)
  // DB is source of truth - anything on Canton but not in DB must be removed
  for (const [entityType, cantonIds] of cantonState.entities) {
    const sourceIds = sourceIdsByType.get(entityType) ?? new Set();
    for (const cantonId of cantonIds) {
      if (!sourceIds.has(cantonId)) {
        // Item in Canton but not source → DELETE
        deletes.push({
          ocfId: cantonId,
          entityType,
          operation: 'delete',
        });
      }
    }
  }

  return {
    creates,
    edits,
    deletes,
    total: creates.length + edits.length + deletes.length,
    conflicts,
  };
}
