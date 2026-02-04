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
import { normalizeEntityType } from './planSecurityAliases';

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

  // Plan Security (7 types) - aliases for Equity Compensation in legacy OCF
  // These map to equityCompensation* types in Canton (planSecurity is an alias)
  TX_PLAN_SECURITY_ISSUANCE: 'planSecurityIssuance',
  TX_PLAN_SECURITY_CANCELLATION: 'planSecurityCancellation',
  TX_PLAN_SECURITY_TRANSFER: 'planSecurityTransfer',
  TX_PLAN_SECURITY_ACCEPTANCE: 'planSecurityAcceptance',
  TX_PLAN_SECURITY_EXERCISE: 'planSecurityExercise',
  TX_PLAN_SECURITY_RELEASE: 'planSecurityRelease',
  TX_PLAN_SECURITY_RETRACTION: 'planSecurityRetraction',
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

/**
 * @deprecated Use `mapCategorizedTypeToEntityType` instead. This alias will be removed in a future version.
 */
export const mapDbTypeToEntityType = mapCategorizedTypeToEntityType;

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
// Replication Diff
// ============================================================================

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
 * Result of comparing source state (desired) to Canton state (actual).
 */
export interface ReplicationDiff {
  /** Items in source but not in Canton - need to be created */
  creates: ReplicationItem[];
  /** Items in both - may need to be edited */
  edits: ReplicationItem[];
  /** Items in Canton but not in source - may need to be deleted */
  deletes: ReplicationItem[];
  /** Total number of operations */
  total: number;
}

/**
 * Options for computing the replication diff.
 */
export interface ComputeReplicationDiffOptions {
  /**
   * Whether to include delete operations for items in Canton but not in source.
   * Default: false (safer - doesn't delete data)
   */
  syncDeletes?: boolean;

  /**
   * Whether to always include edit operations for items that exist in both.
   * When true: All existing items are marked as edits (ensures sync)
   * When false: Only new items are marked as creates (existence check only)
   * Default: false
   */
  alwaysEdit?: boolean;
}

/**
 * Compute what needs to be synced to Canton.
 *
 * Compares a list of source items (desired state) against Canton state (actual state)
 * and returns operations needed to synchronize them.
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
 * const diff = computeReplicationDiff(sourceItems, cantonState, { syncDeletes: true });
 * // diff.creates = items in source but not Canton
 * // diff.deletes = items in Canton but not source
 * ```
 */
export function computeReplicationDiff(
  sourceItems: Array<{ ocfId: string; entityType: OcfEntityType; data: unknown }>,
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions = {}
): ReplicationDiff {
  const { syncDeletes = false, alwaysEdit = false } = options;

  const creates: ReplicationItem[] = [];
  const edits: ReplicationItem[] = [];
  const deletes: ReplicationItem[] = [];

  // Track source items by type for delete detection
  const sourceIdsByType = new Map<OcfEntityType, Set<string>>();

  // Track seen items to prevent duplicate create/edit operations
  const seenItems = new Set<string>();

  // Process each source item
  for (const item of sourceItems) {
    // Skip duplicate items (same ocfId + entityType)
    const itemKey = `${item.entityType}:${item.ocfId}`;
    if (seenItems.has(itemKey)) {
      continue;
    }
    seenItems.add(itemKey);

    // Normalize planSecurity types to equityCompensation for Canton lookup
    // Canton stores planSecurity items under equity_compensation_* fields
    const normalizedType = normalizeEntityType(item.entityType) as OcfEntityType;

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
    } else if (alwaysEdit) {
      // Item in both and alwaysEdit → EDIT
      edits.push({
        ocfId: item.ocfId,
        entityType: item.entityType,
        operation: 'edit',
        data: item.data,
      });
    }
    // If not alwaysEdit and exists in Canton, skip (already synced)
  }

  // Detect deletes (in Canton but not in source)
  if (syncDeletes) {
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
  }

  return {
    creates,
    edits,
    deletes,
    total: creates.length + edits.length + deletes.length,
  };
}
