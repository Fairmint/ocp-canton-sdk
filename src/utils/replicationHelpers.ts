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

import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import {
  assertNoConflictingPositionRecords,
  isCompletePositionState,
} from '../functions/OpenCapTable/positions/positionLedger';
import type { CapTablePositionState } from '../functions/OpenCapTable/positions/positionTypes';
import {
  checkPositionRecordVersion,
  checkStockClassDelete,
  isPositionGuardedEntityType,
  positionRecordRefs,
  type PositionWriteViolation,
} from '../functions/OpenCapTable/positions/positionWriteGuard';
import type { OcfManifest } from './cantonOcfExtractor';
import { DEFAULT_DEPRECATED_FIELDS, DEFAULT_INTERNAL_FIELDS, ocfDeepEqual } from './ocfComparison';
import { normalizeObjectType, normalizeOcfData } from './planSecurityAliases';

// Preserve the public utils import path while keeping the protocol-native guard implementation centralized.
export { isOcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';

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
  FINANCING: 'financing',
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
  CE_STAKEHOLDER_RELATIONSHIP: 'stakeholderRelationshipChangeEvent',
  CE_STAKEHOLDER_STATUS: 'stakeholderStatusChangeEvent',
};

/** Read only mappings owned by the registry object, never inherited prototype properties. */
function getOwnEntityType(mapping: Readonly<Record<string, OcfEntityType>>, key: string): OcfEntityType | undefined {
  return Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : undefined;
}

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
  const directType = getOwnEntityType(DIRECT_TYPE_MAP, categoryType);
  if (directType !== undefined) {
    return directType;
  }

  // Object subtypes
  if (categoryType === 'OBJECT' && subtype) {
    return getOwnEntityType(OBJECT_SUBTYPE_MAP, subtype) ?? null;
  }

  // Transaction subtypes
  if (categoryType === 'TRANSACTION' && subtype) {
    return getOwnEntityType(TRANSACTION_SUBTYPE_MAP, subtype) ?? null;
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
  financing: ['Financing', 'Financings'],
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
 * @returns Map of entityType → Map of canonical object ID → OCF data object
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
  for (const financing of manifest.financings) {
    addItem('financing', financing, 'financing');
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
    // Canton can return schema-supported PlanSecurity types that map to EquityCompensation
    const normalizedObjectType = normalizeObjectType(objectType);

    // Check if the normalized object type is a known transaction type
    const entityType = getOwnEntityType(TRANSACTION_SUBTYPE_MAP, normalizedObjectType);
    if (entityType === undefined) {
      throw new Error(`Unsupported transaction object_type: ${objectType}`);
    }
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
  /** Canonical OCF object ID */
  id: string;
  /** Entity type (SDK format) */
  entityType: OcfEntityType;
  /** Operation to perform */
  operation: 'create' | 'edit' | 'delete';
  /** OCF data for create/edit operations */
  data?: unknown;
}

/**
 * A source item representing the desired OCF state.
 *
 * Canonical identity is derived from `data.id`, not passed separately.
 */
export interface SourceReplicationItem {
  /** Entity type (SDK format) */
  entityType: OcfEntityType;
  /** OCF data containing the canonical object ID at `data.id` */
  data: unknown;
}

/**
 * A security_id conflict detected during diff computation.
 * This occurs when a proposed CREATE has a security_id that already exists
 * on Canton under a different object ID.
 */
export interface SecurityIdConflict {
  /** The canonical OCF object ID of the source item that would conflict */
  id: string;
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
  /**
   * Operations the position guard withheld from `creates`, `edits` and `deletes`, each with every reason. Present
   * only when a position state is in effect (a Canton cap table with position registries) or
   * `options.protectedStakeholderIds` names a stakeholder; `total` and `conflicts` cover the remaining operations
   * only.
   */
  skipped?: SkippedReplicationItem[];
}

/**
 * An operation the position guard withheld: one the ledger's root guard would reject, one that would edit or delete
 * what positions and registry-written records still reference, or an edit or delete of a stakeholder in
 * `options.protectedStakeholderIds`.
 */
export interface SkippedReplicationItem extends ReplicationItem {
  /** Every reason the guard found. */
  reasons: PositionWriteViolation[];
}

/**
 * Canton OCF data map for deep comparison.
 * Maps entityType to a map of canonical object ID to OCF data object.
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
   * The map should be structured as: Map<OcfEntityType, Map<objectId, ocfDataObject>>
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

  /**
   * Position-managed state of the Canton cap table. Defaults to `cantonState.positionState`, which
   * `getCapTableState` sets on every state it returns (`null` for a CapTable without position fields), so the guard
   * cannot be left out for a cap table with positions. Needed only for a `cantonState` that lacks the field; when
   * both are given they must be the same snapshot.
   *
   * With a position state, the diff never creates, edits or deletes what the ledger's root guard would reject
   * (position-managed stock issuances, splits and ratio adjustments; records naming migrated, ancestor or
   * position-managed securities; deletes of position-managed stock classes), never edits or deletes records a
   * registry wrote, never edits or deletes a stakeholder that a position or registry-written record references,
   * never deletes a legend template, stock plan or vesting terms they reference, and never deletes what a root
   * record whose edit or delete it withholds still names. Withheld operations are reported in `skipped` with their
   * reasons.
   */
  positionState?: CapTablePositionState;

  /**
   * Stakeholders the diff must neither edit nor delete, besides those the position state references. Required for a
   * cap table with positions: pass an empty list when no trade is open.
   *
   * Pass the seller and buyer stakeholder (`terms.sellerStakeholderId`, `terms.buyerStakeholderId`) of every open
   * trade, that is of every active TradeSettlement-v01 contract of the issuer that carries the trade's `Terms`
   * (`SellerInstructionProposal`, `SellerInstruction`, `TradeTerms`, `BuyerAcceptanceProposal`, `BuyerAcceptance`,
   * `TradeCashCleanup`), read at the offset of the Canton state. A trade to a new buyer creates the buyer's stakeholder
   * on the root before settlement, which the source may not have yet; until `Registry_Transfer` runs at settlement no
   * position or registry-written record names it, so only these contracts do. This SDK does not read them: they
   * belong to Fairmint's trade package, not to OCP.
   *
   * Edits and deletes of these stakeholders are reported in `skipped` (reason `protected_stakeholder`), on any cap
   * table.
   */
  protectedStakeholderIds?: Iterable<string>;
}

/**
 * Compute what needs to be synced to Canton.
 *
 * Compares a list of source items (desired state) against Canton state (actual state)
 * and returns operations needed to synchronize them. The database is the source of truth:
 * items in DB but not Canton are created, items in Canton but not DB are deleted.
 *
 * For a Canton cap table with position registries (`cantonState.positionState`), the position guard withholds every
 * operation the ledger's root guard would reject or that would break what positions reference, and reports it in
 * `skipped` (see {@link ComputeReplicationDiffOptions.positionState}). `cantonState.positionState` must say whether the
 * cap table has positions (`null` when it has none): a state without it is refused rather than read as "no
 * positions".
 *
 * @param sourceItems - OCF items from any source (desired state)
 * @param cantonState - Current Canton state from getCapTableState()
 * @param options - Sync options
 * @returns Replication diff with creates, edits, and deletes
 * @throws OcpValidationError when the position state is missing, incomplete, or from another CapTable or snapshot
 * @throws OcpContractError when position registries wrote records whose OCF IDs or security IDs are not unique
 *   ({@link CapTablePositionState.conflictingRecords})
 *
 * @example
 * ```typescript
 * const sourceItems = [
 *   { entityType: 'stakeholder', data: { id: 'stakeholder-1', ... } },
 *   { entityType: 'stockClass', data: { id: 'stock-class-1', ... } },
 * ];
 * const cantonState = await getCapTableState(client, issuerPartyId);
 * const diff = computeReplicationDiff(sourceItems, cantonState);
 * // diff.creates = items in source but not Canton
 * // diff.edits = items in both with data differences
 * // diff.deletes = items in Canton but not source
 * ```
 */

function describeSourceValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function getSourceDataObject(item: SourceReplicationItem): Record<string, unknown> {
  if (typeof item.data !== 'object' || item.data === null || Array.isArray(item.data)) {
    throw new Error(
      `Invalid source data for entityType="${item.entityType}": expected object, got ${describeSourceValue(item.data)}`
    );
  }

  return item.data as Record<string, unknown>;
}

function getSourceObjectId(item: SourceReplicationItem, data: Record<string, unknown>): string {
  const { id } = data;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(
      `Invalid source data for entityType="${item.entityType}": missing or invalid canonical object id at "data.id"`
    );
  }

  return id;
}

export function computeReplicationDiff(
  sourceItems: SourceReplicationItem[],
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions = {}
): ReplicationDiff {
  const { cantonOcfData, reportDifferences = false, securityIds } = options;
  const positionState = resolvePositionState(cantonState, options);
  // A registry-written record that reuses an OCF ID or a security ID makes the diff ambiguous: which record would an
  // edit or delete of that ID, or a record naming that security, address?
  if (positionState !== null) assertNoConflictingPositionRecords(positionState, 'The replication diff');
  const protectedStakeholderIds = readProtectedStakeholderIds(options.protectedStakeholderIds);
  if (positionState !== null && protectedStakeholderIds === undefined) {
    throw new OcpValidationError(
      'options.protectedStakeholderIds',
      'The Canton cap table has positions: pass the stakeholders of its open trades as ' +
        'options.protectedStakeholderIds (an empty list when no trade is open)',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }

  const creates: ReplicationItem[] = [];
  const edits: ReplicationItem[] = [];
  const deletes: ReplicationItem[] = [];
  const conflicts: SecurityIdConflict[] = [];

  // Track source items by type for delete detection
  const sourceIdsByType = new Map<OcfEntityType, Set<string>>();

  // Track seen items to prevent duplicate create/edit operations
  const seenItems = new Set<string>();

  // Stock class of each security, from the source's stock issuances the diff keeps (for the position guard)
  const sourceStockClass = new Map<string, string>();

  // Comparison options for OCF deep equality
  const comparisonOptions = {
    ignoredFields: DEFAULT_INTERNAL_FIELDS,
    deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
    reportDifferences,
  };

  // Process each source item
  for (const item of sourceItems) {
    const sourceData = getSourceDataObject(item);
    const objectId = getSourceObjectId(item, sourceData);

    const { entityType } = item;

    // Skip duplicate items with the same canonical object ID and entity type.
    const itemKey = `${entityType}:${objectId}`;
    if (seenItems.has(itemKey)) {
      continue;
    }
    seenItems.add(itemKey);

    if (entityType === 'stockIssuance') {
      const { security_id: securityId, stock_class_id: stockClassId } = sourceData;
      if (typeof securityId === 'string' && typeof stockClassId === 'string' && !sourceStockClass.has(securityId)) {
        sourceStockClass.set(securityId, stockClassId);
      }
    }

    // Track for delete detection.
    let typeIds = sourceIdsByType.get(entityType);
    if (!typeIds) {
      typeIds = new Set();
      sourceIdsByType.set(entityType, typeIds);
    }
    typeIds.add(objectId);

    const cantonIds = cantonState.entities.get(entityType) ?? new Set();
    const existsInCanton = cantonIds.has(objectId);

    if (!existsInCanton) {
      // Item in source but not Canton → CREATE
      creates.push({
        id: objectId,
        entityType: item.entityType,
        operation: 'create',
        data: item.data,
      });

      // Check for security_id conflicts on issuance creates
      // The DAML contract enforces security_id uniqueness via *_by_security_id maps.
      // If the source has a new object ID but reuses a security_id already on Canton,
      // the create will be rejected. Detect this early with an actionable message.
      if (securityIds && ISSUANCE_ENTITY_TYPES.has(entityType)) {
        const securityId = typeof sourceData.security_id === 'string' ? sourceData.security_id : undefined;
        if (securityId) {
          const cantonSecurityIds = securityIds.get(entityType);
          if (cantonSecurityIds?.has(securityId)) {
            conflicts.push({
              id: objectId,
              entityType: item.entityType,
              securityId,
              message:
                `${getEntityTypeLabel(item.entityType, 1)} id="${objectId}" has ` +
                `security_id="${securityId}" which already exists on Canton under a different ` +
                `object ID. This indicates duplicate security_id values in the source data.`,
            });
          }
        }
      }
    } else if (cantonOcfData) {
      // Deep comparison: compare actual OCF data to detect changes
      const cantonTypeData = cantonOcfData.get(entityType);
      const cantonItemData = cantonTypeData?.get(objectId);

      if (cantonItemData === undefined) {
        // cantonOcfData was provided but this item's data wasn't found
        // This indicates cantonOcfData is incomplete or inconsistent with cantonState.entities
        throw new Error(
          `Inconsistent cantonOcfData: missing OCF data for entityType="${entityType}", ` +
            `id="${objectId}" even though the ID exists in cantonState.entities. ` +
            `Ensure cantonOcfData is built from the same Canton state.`
        );
      }

      // Normalize both objects before comparison:
      // - object_type aliases (TX_PLAN_SECURITY_* → TX_EQUITY_COMPENSATION_*)
      // - quantity_source defaults (add/strip UNSPECIFIED based on quantity presence)
      const normalizedSourceData = normalizeOcfData(sourceData);
      const normalizedCantonData = normalizeOcfData(cantonItemData);

      // Compare source data with Canton data using semantic OCF equality
      const isEqual = ocfDeepEqual(normalizedSourceData, normalizedCantonData, comparisonOptions);

      if (!isEqual) {
        // Data differs → EDIT
        edits.push({
          id: objectId,
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
          id: cantonId,
          entityType,
          operation: 'delete',
        });
      }
    }
  }

  if (positionState !== null) {
    return applyPositionGuard(
      { creates, edits, deletes, conflicts },
      positionState,
      protectedStakeholderIds ?? new Set(),
      sourceStockClass,
      cantonOcfData
    );
  }
  if (protectedStakeholderIds !== undefined && protectedStakeholderIds.size > 0) {
    const protectedOnly = (item: ReplicationItem) => protectedStakeholderViolations(protectedStakeholderIds, item);
    return withholdOperations(
      { creates, edits, deletes, conflicts },
      { create: () => [], edit: protectedOnly, delete: protectedOnly }
    );
  }

  return {
    creates,
    edits,
    deletes,
    total: creates.length + edits.length + deletes.length,
    conflicts,
  };
}

// ============================================================================
// Position guard
// ============================================================================

/** A position state the guard can run on: whole, and read from the CapTable the diff is computed against. */
function requireTrustedPositionState(
  state: unknown,
  fieldPath: string,
  cantonState: CapTableState
): CapTablePositionState {
  if (!isCompletePositionState(state)) {
    throw new OcpValidationError(
      fieldPath,
      'Position state is incomplete; read it with getCapTableState, the guard cannot run without it',
      { code: OcpErrorCodes.INVALID_FORMAT }
    );
  }
  if (state.capTableContractId !== cantonState.capTableContractId) {
    throw new OcpValidationError(
      fieldPath,
      `Position state was read from CapTable ${state.capTableContractId}, not ${cantonState.capTableContractId}`,
      { code: OcpErrorCodes.INVALID_FORMAT }
    );
  }
  return state;
}

/**
 * The position state the diff must respect, or `null` when the Canton cap table has no positions.
 *
 * `cantonState.positionState` says which (`getCapTableState` always sets it); `options.positionState` may stand in
 * for it on a state that lacks it. Fails closed when neither says whether the cap table has positions, when the two
 * disagree, when the state belongs to another CapTable, or when it is incomplete (for example deserialized from
 * JSON, which turns its maps into plain objects).
 */
function resolvePositionState(
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions
): CapTablePositionState | null {
  // Read as unknown: states built by hand or deserialized may lack the field the type requires.
  const fromCanton: unknown = (cantonState as { positionState?: unknown }).positionState;
  const fromOptions = options.positionState;
  if (fromOptions !== undefined) {
    const state = requireTrustedPositionState(fromOptions, 'options.positionState', cantonState);
    if (fromCanton === null) {
      throw new OcpValidationError(
        'options.positionState',
        'cantonState.positionState says the CapTable has no positions, but options.positionState has a position state for it',
        { code: OcpErrorCodes.INVALID_FORMAT }
      );
    }
    if (fromCanton !== undefined) {
      const canton = requireTrustedPositionState(fromCanton, 'cantonState.positionState', cantonState);
      if (state.offset !== canton.offset) {
        throw new OcpValidationError(
          'options.positionState',
          'Position state differs from cantonState.positionState; pass the state read with the Canton state',
          { code: OcpErrorCodes.INVALID_FORMAT }
        );
      }
    }
    return state;
  }
  if (fromCanton === undefined) {
    throw new OcpValidationError(
      'cantonState.positionState',
      'cantonState does not say whether the CapTable has positions; read it with getCapTableState, or set ' +
        'positionState to null for a CapTable without position fields',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  return fromCanton === null ? null : requireTrustedPositionState(fromCanton, 'cantonState.positionState', cantonState);
}

/** `options.protectedStakeholderIds` as a set, checked: an iterable of non-empty strings (a bare string is not). */
function readProtectedStakeholderIds(value: Iterable<string> | undefined): ReadonlySet<string> | undefined {
  if (value === undefined) return undefined;
  const iterable: unknown = value;
  if (
    typeof iterable === 'string' ||
    iterable === null ||
    typeof iterable !== 'object' ||
    typeof (iterable as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== 'function'
  ) {
    throw new OcpValidationError('options.protectedStakeholderIds', 'Expected a list of stakeholder IDs', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Iterable<string>',
      receivedValue: iterable,
    });
  }
  const ids = new Set<string>();
  for (const id of value as Iterable<unknown>) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new OcpValidationError('options.protectedStakeholderIds', 'Stakeholder IDs must be non-empty strings', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: id,
      });
    }
    ids.add(id);
  }
  return ids;
}

function protectedStakeholderViolations(
  protectedIds: ReadonlySet<string>,
  item: ReplicationItem
): PositionWriteViolation[] {
  return item.entityType === 'stakeholder' && protectedIds.has(item.id)
    ? [
        {
          reason: 'protected_stakeholder',
          message: `stakeholder ${item.id} is in options.protectedStakeholderIds (a party to an open trade)`,
        },
      ]
    : [];
}

type ViolationsOf = (item: ReplicationItem) => PositionWriteViolation[];

/** Withhold every operation with a violation and report it in `skipped`; `total` and `conflicts` cover the rest. */
function withholdOperations(
  diff: Pick<ReplicationDiff, 'creates' | 'edits' | 'deletes' | 'conflicts'>,
  violations: { create: ViolationsOf; edit: ViolationsOf; delete: ViolationsOf }
): ReplicationDiff {
  const skipped: SkippedReplicationItem[] = [];
  const keep =
    (violationsOf: ViolationsOf) =>
    (item: ReplicationItem): boolean => {
      const reasons = violationsOf(item);
      if (reasons.length === 0) return true;
      skipped.push({ ...item, reasons });
      return false;
    };
  const creates = diff.creates.filter(keep(violations.create));
  const edits = diff.edits.filter(keep(violations.edit));
  const deletes = diff.deletes.filter(keep(violations.delete));
  const keptCreates = new Set(creates.map((item) => `${item.entityType}:${item.id}`));

  return {
    creates,
    edits,
    deletes,
    total: creates.length + edits.length + deletes.length,
    conflicts: diff.conflicts.filter((conflict) => keptCreates.has(`${conflict.entityType}:${conflict.id}`)),
    skipped,
  };
}

function registryRecordViolations(state: CapTablePositionState, item: ReplicationItem): PositionWriteViolation[] {
  if (item.entityType !== 'stockIssuance' && item.entityType !== 'stockTransfer') return [];
  if (!state.registryRecords.get(item.entityType)?.has(item.id)) return [];
  return [
    {
      reason: 'registry_record',
      message:
        `${item.entityType} ${item.id} was written by a position registry outside the CapTable root; ` +
        `UpdateCapTable cannot ${item.operation} it`,
    },
  ];
}

function referencedObjectViolations(state: CapTablePositionState, item: ReplicationItem): PositionWriteViolation[] {
  if (item.entityType === 'stakeholder') {
    return state.referencedStakeholderIds.has(item.id)
      ? [
          {
            reason: 'referenced_stakeholder',
            message: `stakeholder ${item.id} is referenced by a position or a registry-written record`,
          },
        ]
      : [];
  }
  if (
    item.operation === 'delete' &&
    (item.entityType === 'stockLegendTemplate' || item.entityType === 'stockPlan' || item.entityType === 'vestingTerms')
  ) {
    return state.referencedObjectIds.get(item.entityType)?.has(item.id)
      ? [
          {
            reason: 'referenced_object',
            message: `${item.entityType} ${item.id} is referenced by a position lot or a registry-written issuance`,
          },
        ]
      : [];
  }
  return [];
}

/** Fields whose values name other root records, at any depth of a record's data. */
const REFERENCE_FIELDS: ReadonlyMap<string, OcfEntityType> = new Map<string, OcfEntityType>([
  ['stakeholder_id', 'stakeholder'],
  ['stock_class_id', 'stockClass'],
  ['stock_class_ids', 'stockClass'],
  ['converts_to_stock_class_id', 'stockClass'],
  ['stock_legend_ids', 'stockLegendTemplate'],
  ['stock_plan_id', 'stockPlan'],
  ['vesting_terms_id', 'vestingTerms'],
]);

/** Types whose records name no other record. */
const REFERENCE_FREE_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'issuer',
  'stakeholder',
  'stockLegendTemplate',
  'vestingTerms',
]);

/** Types a record can name: through {@link REFERENCE_FIELDS}, and issuances through the securities they carry. */
const REFERENCEABLE_TYPES: ReadonlySet<OcfEntityType> = new Set([
  ...REFERENCE_FIELDS.values(),
  ...ISSUANCE_ENTITY_TYPES,
]);

/** `entityType:id` of every record a record's data names through {@link REFERENCE_FIELDS}. */
function referencedRecordKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const element of value) referencedRecordKeys(element, keys);
  } else if (value !== null && typeof value === 'object') {
    for (const [field, fieldValue] of Object.entries(value)) {
      const entityType = REFERENCE_FIELDS.get(field);
      if (entityType === undefined) {
        referencedRecordKeys(fieldValue, keys);
        continue;
      }
      for (const id of [fieldValue].flat()) {
        if (typeof id === 'string' && id.length > 0) keys.add(`${entityType}:${id}`);
      }
    }
  }
  return keys;
}

/**
 * Withhold every operation the position guard refuses and report it in `skipped`.
 *
 * Creates are checked in their proposed version, deletes in their stored version (from `cantonOcfData`) and edits in
 * both, as the ledger's root guard checks them. A security's class comes from the Canton records, else from the
 * stock issuances the diff takes from the source, duplicates skipped (so records naming a withheld issuance are
 * withheld too).
 *
 * A root record whose edit or delete is withheld stays as stored, and OCP checks the references of every record of
 * the resulting book, so the deletes of what its stored version names (stakeholder, stock class, legend templates,
 * stock plan, vesting terms, and the issuances of the securities it names) are withheld too, and so on for what
 * those keep. A kept record whose stored version is not in `cantonOcfData` may name any such record.
 */
function applyPositionGuard(
  diff: Pick<ReplicationDiff, 'creates' | 'edits' | 'deletes' | 'conflicts'>,
  state: CapTablePositionState,
  protectedStakeholderIds: ReadonlySet<string>,
  sourceStockClass: ReadonlyMap<string, string>,
  cantonOcfData: CantonOcfDataMap | undefined
): ReplicationDiff {
  const stockClassOf = (securityId: string): string | undefined =>
    state.stockClassBySecurityId.get(securityId) ?? sourceStockClass.get(securityId);

  const proposed = (item: ReplicationItem): PositionWriteViolation[] => {
    const refs = positionRecordRefs(item.entityType, item.id, item.data);
    return refs === null ? [] : checkPositionRecordVersion(refs, 'proposed', state, stockClassOf);
  };
  const stored = (item: ReplicationItem): PositionWriteViolation[] => {
    if (!isPositionGuardedEntityType(item.entityType)) return [];
    const storedData = cantonOcfData?.get(item.entityType)?.get(item.id);
    if (storedData === undefined) {
      return [
        {
          reason: 'stored_version_unknown',
          version: 'stored',
          message: `${item.entityType} ${item.id}: its Canton version is not in cantonOcfData, so the position guard cannot check it`,
        },
      ];
    }
    const refs = positionRecordRefs(item.entityType, item.id, storedData);
    return refs === null ? [] : checkPositionRecordVersion(refs, 'stored', state, stockClassOf);
  };
  const archiveViolation: PositionWriteViolation = {
    reason: 'cap_table_archive',
    message:
      'replacing the issuer needs archiving the CapTable, which the ledger refuses while it has position registries',
  };
  const replacesIssuer = diff.deletes.some((item) => item.entityType === 'issuer');

  const createViolations = (item: ReplicationItem): PositionWriteViolation[] => [
    ...(item.entityType === 'issuer' && replacesIssuer ? [archiveViolation] : []),
    ...proposed(item),
  ];
  const editViolations = (item: ReplicationItem): PositionWriteViolation[] => {
    const registry = registryRecordViolations(state, item);
    if (registry.length > 0) return registry;
    return [
      ...referencedObjectViolations(state, item),
      ...protectedStakeholderViolations(protectedStakeholderIds, item),
      ...proposed(item),
      ...stored(item),
    ];
  };
  const deleteViolations = (item: ReplicationItem): PositionWriteViolation[] => {
    const registry = registryRecordViolations(state, item);
    if (registry.length > 0) return registry;
    return [
      ...(item.entityType === 'issuer' ? [archiveViolation] : []),
      ...checkStockClassDelete(item.entityType, item.id, state),
      ...referencedObjectViolations(state, item),
      ...protectedStakeholderViolations(protectedStakeholderIds, item),
      ...stored(item),
    ];
  };
  const editReasons = new Map(diff.edits.map((item) => [item, editViolations(item)]));
  const deleteReasons = new Map(diff.deletes.map((item) => [item, deleteViolations(item)]));

  // What the root records the guard keeps name: `entityType:id`, `security:id`, or `unknown` for a kept record whose
  // stored version is not in cantonOcfData, each with the records that name it.
  const referrers = new Map<string, string[]>();
  const refer = (key: string, referrer: string): void => {
    const known = referrers.get(key);
    if (known === undefined) referrers.set(key, [referrer]);
    else known.push(referrer);
  };
  const kept = new Set<ReplicationItem>();
  const keep = (item: ReplicationItem): void => {
    kept.add(item);
    // A registry-written record is not in the root maps, so OCP does not check its references.
    if (registryRecordViolations(state, item).length > 0) return;
    const label = `${item.entityType} ${item.id}`;
    const storedData = cantonOcfData?.get(item.entityType)?.get(item.id);
    if (storedData === undefined) {
      if (!REFERENCE_FREE_TYPES.has(item.entityType)) refer('unknown', label);
      return;
    }
    for (const key of referencedRecordKeys(storedData)) refer(key, label);
    if (item.entityType === 'stockIssuance') return; // its own security_id names no other record
    for (const securityId of positionRecordRefs(item.entityType, item.id, storedData)?.securityIds ?? []) {
      refer(`security:${securityId}`, label);
    }
  };
  const dependencyViolations = (item: ReplicationItem): PositionWriteViolation[] => {
    if (!REFERENCEABLE_TYPES.has(item.entityType)) return [];
    const target = `${item.entityType} ${item.id}`;
    const named = [...(referrers.get(`${item.entityType}:${item.id}`) ?? [])];
    if (ISSUANCE_ENTITY_TYPES.has(item.entityType)) {
      const securityId = cantonOcfData?.get(item.entityType)?.get(item.id)?.security_id;
      if (typeof securityId === 'string') named.push(...(referrers.get(`security:${securityId}`) ?? []));
      else for (const [key, labels] of referrers) if (key.startsWith('security:')) named.push(...labels);
    }
    const others = (labels: readonly string[]) => [...new Set(labels)].filter((label) => label !== target);
    const violations: PositionWriteViolation[] = [];
    const add = (message: string): void => {
      violations.push({ reason: 'retained_record_reference', message });
    };
    const namedBy = others(named);
    if (namedBy.length > 0) {
      add(`${target} is referenced by ${namedBy.join(', ')}, which the position guard keeps on the root`);
    }
    const unknownBy = others(referrers.get('unknown') ?? []);
    if (unknownBy.length > 0) {
      add(
        `${target} may be referenced by ${unknownBy.join(', ')}, which the position guard keeps on the root ` +
          'and whose Canton version is not in cantonOcfData'
      );
    }
    return violations;
  };

  for (const [item, reasons] of [...editReasons, ...deleteReasons]) if (reasons.length > 0) keep(item);
  let grew: boolean;
  do {
    grew = false;
    for (const item of diff.deletes) {
      if (!kept.has(item) && dependencyViolations(item).length > 0) {
        keep(item);
        grew = true;
      }
    }
  } while (grew);

  return withholdOperations(diff, {
    create: createViolations,
    edit: (item) => editReasons.get(item) ?? [],
    delete: (item) => [...(deleteReasons.get(item) ?? []), ...dependencyViolations(item)],
  });
}
