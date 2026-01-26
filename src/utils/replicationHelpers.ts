/**
 * Replication helpers for cap table synchronization.
 *
 * Provides utilities for:
 * - Mapping database types to SDK entity types
 * - Computing replication diffs between DB and Canton state
 * - Human-readable labels for display
 *
 * @module replicationHelpers
 */

import type { OcfEntityType } from '../functions/OpenCapTable/capTable/batchTypes';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';

// ============================================================================
// DB Type Mapping
// ============================================================================

/**
 * Direct database type to OcfEntityType mappings.
 * These types are stored directly in the `type` column.
 */
const DIRECT_TYPE_MAP: Record<string, OcfEntityType> = {
  STAKEHOLDER: 'stakeholder',
  STOCK_CLASS: 'stockClass',
  STOCK_PLAN: 'stockPlan',
};

/**
 * OBJECT subtype to OcfEntityType mappings.
 * These are stored with type='OBJECT' and the actual type in subtype.
 */
const OBJECT_SUBTYPE_MAP: Record<string, OcfEntityType> = {
  DOCUMENT: 'document',
  VESTING_TERMS: 'vestingTerms',
  STOCK_LEGEND_TEMPLATE: 'stockLegendTemplate',
  VALUATION: 'valuation',
};

/**
 * TRANSACTION subtype to OcfEntityType mappings.
 * These are stored with type='TRANSACTION' and the actual type in subtype.
 * DB uses TX_ prefix with UPPER_SNAKE_CASE, SDK uses camelCase.
 */
const TRANSACTION_SUBTYPE_MAP: Record<string, OcfEntityType> = {
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
 * Map database type/subtype to OcfEntityType.
 *
 * The database schema uses:
 * - Direct types: STAKEHOLDER, STOCK_CLASS, STOCK_PLAN stored in `type` column
 * - Object subtypes: type='OBJECT', actual type in `subtype` column
 * - Transaction subtypes: type='TRANSACTION', actual type in `subtype` column (TX_ prefix)
 *
 * @param dbType - The database OCF type (STAKEHOLDER, OBJECT, TRANSACTION, etc.)
 * @param dbSubtype - The database subtype for OBJECT and TRANSACTION types
 * @returns The corresponding OcfEntityType, or null if not supported
 *
 * @example
 * ```typescript
 * mapDbTypeToEntityType('STAKEHOLDER', null); // 'stakeholder'
 * mapDbTypeToEntityType('OBJECT', 'DOCUMENT'); // 'document'
 * mapDbTypeToEntityType('TRANSACTION', 'TX_STOCK_ISSUANCE'); // 'stockIssuance'
 * ```
 */
export function mapDbTypeToEntityType(dbType: string, dbSubtype: string | null): OcfEntityType | null {
  // Direct mappings
  if (dbType in DIRECT_TYPE_MAP) {
    return DIRECT_TYPE_MAP[dbType];
  }

  // Object subtypes
  if (dbType === 'OBJECT' && dbSubtype) {
    return OBJECT_SUBTYPE_MAP[dbSubtype] ?? null;
  }

  // Transaction subtypes
  if (dbType === 'TRANSACTION' && dbSubtype) {
    return TRANSACTION_SUBTYPE_MAP[dbSubtype] ?? null;
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
  // Core Objects (7 types)
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
 * getOcfTypeLabel('stockClass', 1); // "1 Stock Class"
 * getOcfTypeLabel('stockClass', 3); // "3 Stock Classes"
 * getOcfTypeLabel('stakeholder', 0); // "0 Stakeholders"
 * ```
 */
export function getOcfTypeLabel(type: OcfEntityType, count: number): string {
  const labels = ENTITY_TYPE_LABELS[type];
  const [singular, plural] = labels;
  return `${count} ${count === 1 ? singular : plural}`;
}

// ============================================================================
// Replication Diff
// ============================================================================

/**
 * A single item to be synced from DB to Canton.
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
 * Result of comparing DB state (desired) to Canton state (actual).
 */
export interface ReplicationDiff {
  /** Items in DB but not in Canton - need to be created */
  creates: ReplicationItem[];
  /** Items in both - may need to be edited */
  edits: ReplicationItem[];
  /** Items in Canton but not in DB - may need to be deleted */
  deletes: ReplicationItem[];
  /** Total number of operations */
  total: number;
}

/**
 * Options for computing the replication diff.
 */
export interface ComputeReplicationDiffOptions {
  /**
   * Whether to include delete operations for items in Canton but not in DB.
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
 * Compute what needs to be synced from DB to Canton.
 *
 * Compares a list of DB items (desired state) against Canton state (actual state)
 * and returns operations needed to synchronize them.
 *
 * @param dbItems - OCF items from database (desired state)
 * @param cantonState - Current Canton state from getCapTableState()
 * @param options - Sync options
 * @returns Replication diff with creates, edits, and deletes
 *
 * @example
 * ```typescript
 * const dbItems = [
 *   { ocfId: 'stakeholder-1', entityType: 'stakeholder', data: {...} },
 *   { ocfId: 'stock-class-1', entityType: 'stockClass', data: {...} },
 * ];
 * const cantonState = await getCapTableState(client, issuerPartyId);
 * const diff = computeReplicationDiff(dbItems, cantonState, { syncDeletes: true });
 * // diff.creates = items in DB but not Canton
 * // diff.deletes = items in Canton but not DB
 * ```
 */
export function computeReplicationDiff(
  dbItems: Array<{ ocfId: string; entityType: OcfEntityType; data: unknown }>,
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions = {}
): ReplicationDiff {
  const { syncDeletes = false, alwaysEdit = false } = options;

  const creates: ReplicationItem[] = [];
  const edits: ReplicationItem[] = [];
  const deletes: ReplicationItem[] = [];

  // Track DB items by type for delete detection
  const dbIdsByType = new Map<OcfEntityType, Set<string>>();

  // Process each DB item
  for (const item of dbItems) {
    // Track for delete detection
    let typeIds = dbIdsByType.get(item.entityType);
    if (!typeIds) {
      typeIds = new Set();
      dbIdsByType.set(item.entityType, typeIds);
    }
    typeIds.add(item.ocfId);

    // Check if exists in Canton
    const cantonIds = cantonState.entities.get(item.entityType) ?? new Set();
    const existsInCanton = cantonIds.has(item.ocfId);

    if (!existsInCanton) {
      // Item in DB but not Canton → CREATE
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

  // Detect deletes (in Canton but not in DB)
  if (syncDeletes) {
    for (const [entityType, cantonIds] of cantonState.entities) {
      const dbIds = dbIdsByType.get(entityType) ?? new Set();
      for (const cantonId of cantonIds) {
        if (!dbIds.has(cantonId)) {
          // Item in Canton but not DB → DELETE
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
