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
  isRegistryRecord,
} from '../functions/OpenCapTable/positions/positionLedger';
import type { CapTablePositionState } from '../functions/OpenCapTable/positions/positionTypes';
import {
  checkPositionRecordVersion,
  checkPositionVestingTermsWrite,
  checkStockClassDelete,
  isPositionGuardedEntityType,
  listSome,
  positionRecordRefs,
  securitiesNeedingStockClass,
  type PositionRecordRefs,
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
 * An operation the position guard withheld: one the ledger's root guard would reject, one that names a security a
 * registry issued, one that would edit or delete what positions and registry-written records still reference, an
 * edit or delete of a stakeholder in `options.protectedStakeholderIds`, or one OCP would reject because the guard
 * withholds another.
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
   * (position-managed stock issuances, splits and ratio adjustments; records naming securities whose root issuance is
   * in a position-managed class, migrated ones included; deletes of position-managed stock classes; edits and deletes
   * of vesting terms a root stock issuance of a position-managed class names, and vesting-terms edits that drop a
   * condition ID), never creates or edits a record naming a security that a registry issued, never edits or deletes
   * records a registry wrote, never edits or deletes a stakeholder that a position or registry-written record
   * references, never deletes a legend template or stock plan they reference nor edits or deletes vesting terms they
   * reference, and never deletes what a root record whose edit or delete it withholds still names, nor edits the
   * issuance of a security such a record draws on or results in, nor changes the security ID of one it lists. Nor
   * does it submit a write that OCP would check against what a withheld write leaves on the root: a record naming a
   * security or record only a withheld create or edit would add, a vesting start or event, warrant exercise or
   * convertible conversion whose condition or trigger the root would lack, or an issuance of a security that a
   * withheld write keeps on another issuance. Withheld operations are reported in `skipped` with their reasons.
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
  // The source's records the diff reads, by type (for the position guard): the book the diff would write
  const sourceRecords = new Map<OcfEntityType, Map<string, Record<string, unknown>>>();

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

    if (positionState !== null) {
      let records = sourceRecords.get(entityType);
      if (records === undefined) {
        records = new Map();
        sourceRecords.set(entityType, records);
      }
      records.set(objectId, sourceData);
    }

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
      cantonOcfData,
      cantonState.entities.get('stockIssuance') ?? new Set(),
      sourceRecords
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

/**
 * A proposed record version that names a security only a registry-written stock issuance carries. The root does not
 * list that issuance, so the ledger guard never sees its class and OCP's reference checks reject the record (all but a
 * stock plan return to pool, which the ledger accepts); the lot's history is the registry's to record.
 */
function registrySecurityViolations(state: CapTablePositionState, refs: PositionRecordRefs): PositionWriteViolation[] {
  return securitiesNeedingStockClass(refs)
    .filter((securityId) => state.registrySecurityIds.has(securityId))
    .map((securityId) => ({
      reason: 'registry_security',
      version: 'proposed',
      securityId,
      message:
        `${refs.label} (proposed) references security ${securityId}, which a position registry issued outside the ` +
        'CapTable root',
    }));
}

function registryRecordViolations(state: CapTablePositionState, item: ReplicationItem): PositionWriteViolation[] {
  if (!isRegistryRecord(state, item.entityType, item.id)) return [];
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
  // OCP's validatePositionVestingTerms leaves the terms only registry-issued lots name to root writers, edits too.
  if (
    (item.operation === 'delete' && (item.entityType === 'stockLegendTemplate' || item.entityType === 'stockPlan')) ||
    item.entityType === 'vestingTerms'
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

/**
 * What a reference field names: a record type; `security`, a security of any instrument that the record draws on or
 * results in; or `listedSecurity`, a security of any instrument that a capitalization definition lists.
 */
type ReferenceTarget = OcfEntityType | 'security' | 'listedSecurity';

/**
 * Fields whose values name other root records, at any depth of a record's data, as OCP's final reference validations
 * read them. OCP looks a `security` up in its type's `*_issuances_by_security_id` map (the source, balance and
 * resulting securities of a stock, warrant, convertible or equity compensation transaction, the security of a vesting
 * record or return to pool), and checks a source security's balance and dates against that issuance. A convertible
 * conversion's capitalization definition lists securities, stock classes and stock plans
 * (`validateCapitalizationDefinitionReferences`): a `listedSecurity` needs only some issuance to carry it. A stock
 * reissuance's split must exist, in any class (`validateStockReissuanceSplitReferences`).
 */
const REFERENCE_FIELDS: ReadonlyMap<string, ReferenceTarget> = new Map<string, ReferenceTarget>([
  ['stakeholder_id', 'stakeholder'],
  ['stock_class_id', 'stockClass'],
  ['stock_class_ids', 'stockClass'],
  ['converts_to_stock_class_id', 'stockClass'],
  ['include_stock_class_ids', 'stockClass'],
  ['stock_legend_ids', 'stockLegendTemplate'],
  ['stock_plan_id', 'stockPlan'],
  ['include_stock_plans_ids', 'stockPlan'],
  ['vesting_terms_id', 'vestingTerms'],
  ['split_transaction_id', 'stockClassSplit'],
  ['security_id', 'security'],
  ['security_ids', 'security'],
  ['balance_security_id', 'security'],
  ['resulting_security_id', 'security'],
  ['resulting_security_ids', 'security'],
  ['include_security_ids', 'listedSecurity'],
  ['exclude_security_ids', 'listedSecurity'],
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
  ...[...REFERENCE_FIELDS.values()].filter(
    (target): target is OcfEntityType => target !== 'security' && target !== 'listedSecurity'
  ),
  ...ISSUANCE_ENTITY_TYPES,
]);

/** `target:id` (`entityType:id`, `security:id` or `listedSecurity:id`) of all a record's data names. */
function referencedRecordKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const element of value) referencedRecordKeys(element, keys);
  } else if (value !== null && typeof value === 'object') {
    for (const [field, fieldValue] of Object.entries(value)) {
      const target = REFERENCE_FIELDS.get(field);
      if (target === undefined) {
        referencedRecordKeys(fieldValue, keys);
        continue;
      }
      for (const id of [fieldValue].flat()) {
        if (typeof id === 'string' && id.length > 0) keys.add(`${target}:${id}`);
      }
    }
  }
  return keys;
}

// ----------------------------------------------------------------------------
// Writes a withheld write strands
// ----------------------------------------------------------------------------

/** One record of a book: its type and canonical OCF ID. */
interface RecordRef {
  readonly entityType: OcfEntityType;
  readonly id: string;
}

type BookRecords = ReadonlyMap<OcfEntityType, ReadonlyMap<string, Record<string, unknown>>>;

/** A cap table book as OCP's final checks read it: its records, and the issuances that carry each security. */
interface Book {
  readonly record: (ref: RecordRef) => Record<string, unknown> | undefined;
  readonly carriers: (securityId: string) => readonly RecordRef[];
}

/** The book the source describes (the diff applied in full), indexed for the stranded-write checks. */
interface SourceBook extends Book {
  /** Root records of the types whose names {@link checkResolution} resolves through a security's issuance. */
  readonly resolving: readonly RecordRef[];
  /** For each {@link referencedRecordKeys} key, the root records that name it. */
  readonly namers: ReadonlyMap<string, readonly RecordRef[]>;
}

const recordKey = (ref: RecordRef): string => `${ref.entityType}:${ref.id}`;
const recordLabel = (ref: RecordRef): string => `${ref.entityType} ${ref.id}`;
const describeWrite = (item: ReplicationItem): string => `the ${item.operation} of ${item.entityType} ${item.id}`;

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values === undefined) map.set(key, [value]);
  else values.push(value);
}

/** The security an issuance record carries, if it is one. */
function carriedSecurity(entityType: OcfEntityType, data: Record<string, unknown> | undefined): string | undefined {
  const securityId = data?.security_id;
  return ISSUANCE_ENTITY_TYPES.has(entityType) && typeof securityId === 'string' && securityId.length > 0
    ? securityId
    : undefined;
}

/** The issuance types OCP resolves a vesting start's or event's security in (`vestingTermsIdForSecurity`). */
const VESTING_ISSUANCE_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'equityCompensationIssuance',
]);

/** Types whose records name what OCP resolves through their security's issuance ({@link checkResolution}). */
const RESOLVING_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'vestingStart',
  'vestingEvent',
  'warrantExercise',
  'convertibleConversion',
]);

/** What a record names through its security's issuance, whether it resolves on a book, and the records it read. */
interface Resolution {
  /** What the record names, such as `vesting condition start`. */
  readonly names: string;
  /** Why it does not resolve on the book; `undefined` when it does. */
  readonly lacking: string | undefined;
  /** The records the resolution read: the issuances carrying the security and, for a vesting record, its terms. */
  readonly path: readonly RecordRef[];
}

function textField(data: Record<string, unknown> | undefined, field: string): string {
  const value = data?.[field];
  return typeof value === 'string' ? value : '';
}

function objectList(data: Record<string, unknown> | undefined, field: string): Array<Record<string, unknown>> {
  const value = data?.[field];
  return Array.isArray(value)
    ? value.filter((element): element is Record<string, unknown> => element !== null && typeof element === 'object')
    : [];
}

/**
 * OCP's final checks of what a record names through its security's issuance, on one book:
 * `validateVestingTransactionConditionReferences` (a vesting start's or event's condition, with its trigger type, in
 * the vesting terms of the one stock, warrant or equity compensation issuance carrying its security),
 * `validateWarrantExerciseTriggerReferences` and `validateConvertibleConversionTriggerReferences` (the trigger in the
 * warrant or convertible issuance carrying the security). `undefined` for other types.
 */
function checkResolution(book: Book, ref: RecordRef, data: Record<string, unknown>): Resolution | undefined {
  if (ref.entityType === 'vestingStart') return resolveVestingCondition(book, data, 'start');
  if (ref.entityType === 'vestingEvent') return resolveVestingCondition(book, data, 'event');
  if (ref.entityType === 'warrantExercise') {
    return resolveTrigger(book, data, 'warrantIssuance', 'exercise_triggers', 'exercise trigger');
  }
  if (ref.entityType === 'convertibleConversion') {
    return resolveTrigger(book, data, 'convertibleIssuance', 'conversion_triggers', 'conversion trigger');
  }
  return undefined;
}

/** A vesting start's or event's condition, with its trigger type, in the terms of its security's issuance. */
function resolveVestingCondition(book: Book, data: Record<string, unknown>, kind: 'start' | 'event'): Resolution {
  const securityId = textField(data, 'security_id');
  const conditionId = textField(data, 'vesting_condition_id');
  const names = `vesting condition ${conditionId}`;
  const carriers = book.carriers(securityId).filter((carrier) => VESTING_ISSUANCE_TYPES.has(carrier.entityType));
  const [issuance] = carriers;
  if (issuance === undefined) return { names, lacking: `no issuance carries security ${securityId}`, path: [] };
  if (carriers.length > 1) {
    return { names, lacking: `${carriers.length} issuances carry security ${securityId}`, path: carriers };
  }
  const termsId = textField(book.record(issuance), 'vesting_terms_id');
  if (termsId === '') return { names, lacking: `${recordLabel(issuance)} names no vesting terms`, path: carriers };
  const termsRef: RecordRef = { entityType: 'vestingTerms', id: termsId };
  const terms = book.record(termsRef);
  if (terms === undefined)
    return { names, lacking: `vestingTerms ${termsId} does not exist`, path: [issuance, termsRef] };
  const condition = objectList(terms, 'vesting_conditions').find((candidate) => candidate.id === conditionId);
  const trigger = condition?.trigger;
  const triggerType =
    trigger !== null && typeof trigger === 'object' ? (trigger as Record<string, unknown>).type : undefined;
  return {
    names,
    lacking:
      triggerType === (kind === 'start' ? 'VESTING_START_DATE' : 'VESTING_EVENT')
        ? undefined
        : `vestingTerms ${termsId} has no vesting ${kind} condition ${conditionId}`,
    path: [issuance, termsRef],
  };
}

/** A warrant exercise's or convertible conversion's trigger in the issuance of its type that carries its security. */
function resolveTrigger(
  book: Book,
  data: Record<string, unknown>,
  issuanceType: OcfEntityType,
  triggersField: string,
  what: string
): Resolution {
  const securityId = textField(data, 'security_id');
  const triggerId = textField(data, 'trigger_id');
  const names = `${what} ${triggerId}`;
  const carriers = book.carriers(securityId).filter((carrier) => carrier.entityType === issuanceType);
  const [issuance] = carriers;
  if (issuance === undefined) return { names, lacking: `no ${issuanceType} carries security ${securityId}`, path: [] };
  const triggers = objectList(book.record(issuance), triggersField);
  return {
    names,
    lacking: triggers.some((candidate) => candidate.trigger_id === triggerId)
      ? undefined
      : `${recordLabel(issuance)} has no ${names}`,
    path: carriers,
  };
}

/** Index the source's root records (registry-written ones are not in the root maps) for the stranded-write checks. */
function indexSourceBook(records: BookRecords, onRoot: (ref: RecordRef) => boolean): SourceBook {
  const carriers = new Map<string, RecordRef[]>();
  const namers = new Map<string, RecordRef[]>();
  const resolving: RecordRef[] = [];
  for (const [entityType, byId] of records) {
    for (const [id, data] of byId) {
      const ref: RecordRef = { entityType, id };
      if (!onRoot(ref)) continue;
      const own = carriedSecurity(entityType, data);
      if (own !== undefined) pushTo(carriers, own, ref);
      if (RESOLVING_TYPES.has(entityType)) resolving.push(ref);
      if (REFERENCE_FREE_TYPES.has(entityType)) continue;
      // An issuance's own security_id names no other record.
      for (const key of referencedRecordKeys(data)) if (key !== `security:${own}`) pushTo(namers, key, ref);
    }
  }
  return {
    record: (ref) => (onRoot(ref) ? records.get(ref.entityType)?.get(ref.id) : undefined),
    carriers: (securityId) => carriers.get(securityId) ?? [],
    resolving,
    namers,
  };
}

/** What the stranded-write checks read besides the diff. */
interface StrandedWriteContext {
  readonly items: readonly ReplicationItem[];
  readonly itemOf: (ref: RecordRef) => ReplicationItem | undefined;
  readonly source: SourceBook;
  readonly onRoot: (ref: RecordRef) => boolean;
  /** A record's Canton version, where `cantonOcfData` has it. */
  readonly stored: (ref: RecordRef) => Record<string, unknown> | undefined;
  /** The root issuances that carry a security on Canton. */
  readonly storedCarriers: (securityId: string) => readonly RecordRef[];
  readonly withheld: (item: ReplicationItem) => boolean;
}

/**
 * The writes the diff still submits that OCP's final checks would reject only because the guard withholds others.
 * The post-batch book has each withheld edit's and delete's record as stored, no withheld create's record, and the
 * source's version of every other record. Each case below fails there but passes on the book the source describes:
 *
 * - a record names (through {@link REFERENCE_FIELDS}) a security or record that only a withheld create or edit would
 *   put on the root, such as the new security ID of a withheld rename: the create or edit naming it is withheld, and
 *   for a record the diff leaves as it is, the delete or edit that took the stored carrier off the root;
 * - a vesting start or event names a condition, or a warrant exercise or convertible conversion a trigger, that the
 *   issuance or vesting terms its security resolves to lacks ({@link checkResolution}), for example because the edit
 *   that adds the condition is withheld: the create or edit of that record is withheld, and for a record the diff
 *   does not write (or keeps as stored), the edits and creates of the issuance and terms it resolves through;
 * - an issuance create or edit carries a security that a withheld edit or delete keeps on another issuance of its
 *   type, which OCP's `*_by_security_id` maps refuse.
 *
 * Each is reported as `retained_record_reference`. Withholding one can strand others, so the caller repeats this until
 * it finds nothing new.
 */
function strandedWrites(context: StrandedWriteContext): Map<ReplicationItem, PositionWriteViolation[]> {
  const { itemOf, source, onRoot, stored, withheld } = context;
  const withheldItem = (ref: RecordRef): ReplicationItem | undefined => {
    const item = itemOf(ref);
    return item !== undefined && withheld(item) ? item : undefined;
  };
  /** A create or edit the diff still submits. */
  const submitted = (ref: RecordRef): ReplicationItem | undefined => {
    const item = itemOf(ref);
    return item !== undefined && item.operation !== 'delete' && !withheld(item) ? item : undefined;
  };
  const postRecord = (ref: RecordRef): Record<string, unknown> | undefined => {
    if (!onRoot(ref)) return undefined;
    const item = withheldItem(ref);
    if (item !== undefined) return item.operation === 'create' ? undefined : stored(ref);
    return source.record(ref);
  };
  const postCarriers = new Map<string, RecordRef[]>();
  const carrying = new Set<string>();
  const carry = (ref: RecordRef): void => {
    const securityId = carriedSecurity(ref.entityType, postRecord(ref));
    if (securityId === undefined || carrying.has(recordKey(ref))) return;
    carrying.add(recordKey(ref));
    pushTo(postCarriers, securityId, ref);
  };
  const withheldRecords = context.items.filter((item) => withheld(item) && onRoot(item));
  for (const ref of withheldRecords) if (ref.operation !== 'create') carry(ref);
  const sourceCarriers = new Set<string>();
  const post: Book = {
    record: postRecord,
    carriers: (securityId) => {
      if (!sourceCarriers.has(securityId)) {
        sourceCarriers.add(securityId);
        for (const ref of source.carriers(securityId)) carry(ref);
      }
      return postCarriers.get(securityId) ?? [];
    },
  };

  const found = new Map<ReplicationItem, PositionWriteViolation[]>();
  const strand = (item: ReplicationItem, message: string): void => {
    if (withheld(item) || found.get(item)?.some((violation) => violation.message === message)) return;
    pushTo(found, item, { reason: 'retained_record_reference', message });
  };
  const because = (causes: readonly ReplicationItem[]): string =>
    `while the position guard withholds ${listSome([...new Set(causes)].map(describeWrite)) || 'other writes'}`;

  // Securities and records only a withheld create or edit would put on the root.
  for (const item of withheldRecords) {
    if (item.operation === 'delete') continue;
    const proposed = source.record(item);
    if (proposed === undefined) continue;
    const missing: Array<{ key: string; what: string; lacking: string; removers: () => ReplicationItem[] }> = [];
    if (item.operation === 'create' && REFERENCEABLE_TYPES.has(item.entityType)) {
      const what = recordLabel(item);
      missing.push({ key: recordKey(item), what, lacking: `${what} does not exist`, removers: () => [] });
    }
    const securityId = carriedSecurity(item.entityType, proposed);
    if (securityId !== undefined && post.carriers(securityId).length === 0) {
      const what = `security ${securityId}`;
      const removers = (): ReplicationItem[] =>
        context.storedCarriers(securityId).flatMap((carrier) => {
          const remover = itemOf(carrier);
          if (remover === undefined || withheld(remover) || remover.operation === 'create') return [];
          return remover.operation === 'delete' ||
            carriedSecurity(carrier.entityType, source.record(carrier)) !== securityId
            ? [remover]
            : [];
        });
      for (const key of [`security:${securityId}`, `listedSecurity:${securityId}`]) {
        missing.push({ key, what, lacking: `no issuance carries ${what}`, removers });
      }
    }
    for (const { key, what, lacking, removers } of missing) {
      for (const namer of source.namers.get(key) ?? []) {
        const namerItem = itemOf(namer);
        // A withheld record is kept as stored, or left off the root; the kept-record closure covers what it names.
        if (namerItem !== undefined && withheld(namerItem)) continue;
        const names = `${recordLabel(namer)} names ${what}`;
        if (namerItem !== undefined) {
          strand(namerItem, `${names}, but ${lacking} on the root ${because([item])}`);
          continue;
        }
        for (const remover of removers()) {
          strand(remover, `${names}, but after ${describeWrite(remover)} ${lacking} on the root ${because([item])}`);
        }
      }
    }
  }

  // Conditions and triggers that resolve on the source's book but not on the post-batch one.
  const resolving = [
    ...source.resolving,
    ...withheldRecords.filter((item) => item.operation === 'delete' && RESOLVING_TYPES.has(item.entityType)),
  ];
  for (const ref of resolving) {
    const data = postRecord(ref);
    if (data === undefined) continue;
    const after = checkResolution(post, ref, data);
    if (after?.lacking === undefined) continue;
    const sourceData = source.record(ref);
    const before = sourceData === undefined ? undefined : checkResolution(source, ref, sourceData);
    // The source's own version fails it too: not the guard's doing.
    if (before?.lacking !== undefined) continue;
    const causes = [ref, ...after.path, ...(before?.path ?? [])].flatMap((step) => withheldItem(step) ?? []);
    const names = `${recordLabel(ref)} names ${after.names}`;
    const item = submitted(ref);
    if (item !== undefined) {
      strand(item, `${names}, but ${after.lacking} on the root ${because(causes)}`);
      continue;
    }
    for (const step of after.path) {
      const write = submitted(step);
      if (write !== undefined) {
        strand(write, `${names}, but after ${describeWrite(write)} ${after.lacking} on the root ${because(causes)}`);
      }
    }
  }

  // A security a withheld edit or delete keeps on an issuance, which a submitted issuance of its type also carries.
  for (const kept of withheldRecords) {
    if (kept.operation === 'create') continue;
    const securityId = carriedSecurity(kept.entityType, postRecord(kept));
    if (securityId === undefined) continue;
    for (const carrier of post.carriers(securityId)) {
      const write = carrier.entityType === kept.entityType ? submitted(carrier) : undefined;
      if (write === undefined) continue;
      strand(
        write,
        `${recordLabel(carrier)} carries security ${securityId}, which ${recordLabel(kept)} also carries on the ` +
          `root ${because([kept])}`
      );
    }
  }
  return found;
}

/**
 * Withhold every operation the position guard refuses and report it in `skipped`.
 *
 * Creates are checked in their proposed version, deletes in their stored version (from `cantonOcfData`) and edits in
 * both, as the ledger's root guard checks them. A security's class comes from its root stock issuance on Canton, as
 * the ledger guard reads it; a security no Canton issuance carries takes it from the stock issuance the diff takes
 * from the source, duplicates skipped (so records naming a withheld issuance are withheld too). A create or edit
 * naming a security that a registry-written issuance carries is withheld as `registry_security`. An edit or delete of
 * vesting terms is checked against the root's stock issuances as stored, as the ledger's `validatePositionVestingTerms`
 * reads them; while one of their Canton versions is not in `cantonOcfData`, it is withheld (`stored_version_unknown`).
 *
 * A root record whose edit or delete is withheld stays as stored, and OCP checks the references of every record of
 * the resulting book, and each source security's balance and dates against its issuance. So the deletes of what its
 * stored version names ({@link REFERENCE_FIELDS}: stakeholder, stock classes, legend templates, stock plans, vesting
 * terms, the split a stock reissuance cites, and the issuances of the securities it names, of any instrument) are
 * withheld too, and so are the edits of the issuances of the securities it draws on or results in, which the source
 * wrote against its own version of the kept record, and the edits that change the security ID of an issuance whose
 * security a capitalization definition of it lists; and so on for what those keep. A kept record whose stored
 * version is not in `cantonOcfData` may name any such record.
 *
 * The other direction: a write the diff still submits may need what a withheld write would have put on the root,
 * such as the new security ID of a withheld rename or a condition a withheld vesting-terms edit adds. Such writes
 * ({@link strandedWrites}) are withheld too, and the two closures run until neither withholds anything new. The guard
 * does not rerun OCP's balance checks: a create or edit of another record that draws on a security a kept record
 * draws on can still overdraw it.
 */
function applyPositionGuard(
  diff: Pick<ReplicationDiff, 'creates' | 'edits' | 'deletes' | 'conflicts'>,
  state: CapTablePositionState,
  protectedStakeholderIds: ReadonlySet<string>,
  sourceStockClass: ReadonlyMap<string, string>,
  cantonOcfData: CantonOcfDataMap | undefined,
  cantonStockIssuanceIds: ReadonlySet<string>,
  sourceRecords: BookRecords
): ReplicationDiff {
  const stockClassOf = (securityId: string): string | undefined =>
    state.stockClassBySecurityId.get(securityId) ??
    (state.registrySecurityIds.has(securityId) ? undefined : sourceStockClass.get(securityId));

  const proposed = (item: ReplicationItem): PositionWriteViolation[] => {
    const refs = positionRecordRefs(item.entityType, item.id, item.data);
    if (refs === null) return [];
    return [
      ...checkPositionRecordVersion(refs, 'proposed', state, stockClassOf),
      ...registrySecurityViolations(state, refs),
    ];
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
  // The root's stock issuances as stored, which OCP's validatePositionVestingTerms reads; registry-written ones are not
  // in the root maps.
  const rootStockIssuanceIds = [...cantonStockIssuanceIds].filter(
    (id) => !isRegistryRecord(state, 'stockIssuance', id)
  );
  const storedStockIssuances = cantonOcfData?.get('stockIssuance');
  const rootStockIssuances = rootStockIssuanceIds.flatMap((id) => storedStockIssuances?.get(id) ?? []);
  const unknownRootStockIssuances = rootStockIssuanceIds.filter((id) => storedStockIssuances?.get(id) === undefined);
  const unknownListed = listSome(unknownRootStockIssuances);
  const vestingTermsViolations = (item: ReplicationItem): PositionWriteViolation[] => {
    if (item.entityType !== 'vestingTerms' || item.operation === 'create') return [];
    const violations = checkPositionVestingTermsWrite(
      { operation: item.operation, id: item.id, data: item.data },
      state,
      rootStockIssuances,
      cantonOcfData?.get('vestingTerms')?.get(item.id)
    );
    if (state.enabled && unknownRootStockIssuances.length > 0) {
      violations.push({
        reason: 'stored_version_unknown',
        version: 'stored',
        message:
          `vestingTerms ${item.id}: the Canton versions of stock issuances ${unknownListed} ` +
          'are not in cantonOcfData, so the position guard cannot check that no issuance of a position-managed ' +
          'class names them',
      });
    }
    return violations;
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
      ...vestingTermsViolations(item),
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
      ...vestingTermsViolations(item),
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
    if (isRegistryRecord(state, item.entityType, item.id)) return;
    const label = `${item.entityType} ${item.id}`;
    const storedData = cantonOcfData?.get(item.entityType)?.get(item.id);
    if (storedData === undefined) {
      if (!REFERENCE_FREE_TYPES.has(item.entityType)) refer('unknown', label);
      return;
    }
    // An issuance's own security_id names no other record.
    const ownSecurity =
      ISSUANCE_ENTITY_TYPES.has(item.entityType) && typeof storedData.security_id === 'string'
        ? `security:${storedData.security_id}`
        : undefined;
    for (const key of referencedRecordKeys(storedData)) if (key !== ownSecurity) refer(key, label);
  };
  const dependencyViolations = (item: ReplicationItem): PositionWriteViolation[] => {
    if (!REFERENCEABLE_TYPES.has(item.entityType)) return [];
    const target = `${item.entityType} ${item.id}`;
    const named = [...(referrers.get(`${item.entityType}:${item.id}`) ?? [])];
    if (ISSUANCE_ENTITY_TYPES.has(item.entityType)) {
      const securityId = cantonOcfData?.get(item.entityType)?.get(item.id)?.security_id;
      if (typeof securityId === 'string') {
        named.push(...(referrers.get(`security:${securityId}`) ?? []));
        // A listed security needs only an issuance that carries it: no delete, and no edit of its security_id.
        const proposedSecurityId = (item.data as Record<string, unknown> | undefined)?.security_id;
        if (item.operation === 'delete' || proposedSecurityId !== securityId) {
          named.push(...(referrers.get(`listedSecurity:${securityId}`) ?? []));
        }
      } else {
        for (const [key, labels] of referrers) {
          if (key.startsWith('security:') || key.startsWith('listedSecurity:')) named.push(...labels);
        }
      }
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

  // A kept record keeps what it names as stored: no delete of it, and no edit of the issuance of a security it names.
  const dependsOnKept = (item: ReplicationItem): PositionWriteViolation[] =>
    item.operation === 'delete' || ISSUANCE_ENTITY_TYPES.has(item.entityType) ? dependencyViolations(item) : [];
  const closeOverKept = (): void => {
    let grew: boolean;
    do {
      grew = false;
      for (const item of [...diff.edits, ...diff.deletes]) {
        if (!kept.has(item) && dependsOnKept(item).length > 0) {
          keep(item);
          grew = true;
        }
      }
    } while (grew);
  };
  for (const [item, reasons] of [...editReasons, ...deleteReasons]) if (reasons.length > 0) keep(item);
  closeOverKept();

  // Writes that name what only a withheld write would put on the root, or that OCP would resolve against a record the
  // guard keeps as stored; withholding them can strand more, and keeps what they name as stored in turn.
  const createReasons = new Map(diff.creates.map((item) => [item, createViolations(item)]));
  const stranded = new Map<ReplicationItem, PositionWriteViolation[]>();
  const withheld = (item: ReplicationItem): boolean =>
    item.operation === 'create' ? (createReasons.get(item)?.length ?? 0) > 0 || stranded.has(item) : kept.has(item);
  const items = [...diff.creates, ...diff.edits, ...diff.deletes];
  if (items.some(withheld)) {
    const onRoot = (ref: RecordRef): boolean => !isRegistryRecord(state, ref.entityType, ref.id);
    const itemsByKey = new Map(items.map((item) => [recordKey(item), item]));
    const storedRecord = (ref: RecordRef) => cantonOcfData?.get(ref.entityType)?.get(ref.id);
    let storedCarriers: Map<string, RecordRef[]> | undefined;
    const context: StrandedWriteContext = {
      items,
      itemOf: (ref) => itemsByKey.get(recordKey(ref)),
      source: indexSourceBook(sourceRecords, onRoot),
      onRoot,
      stored: storedRecord,
      storedCarriers: (securityId) => {
        if (storedCarriers === undefined) {
          storedCarriers = new Map();
          for (const entityType of ISSUANCE_ENTITY_TYPES) {
            for (const [id, data] of cantonOcfData?.get(entityType) ?? []) {
              const carried = carriedSecurity(entityType, data);
              if (carried !== undefined && onRoot({ entityType, id }))
                pushTo(storedCarriers, carried, { entityType, id });
            }
          }
        }
        return storedCarriers.get(securityId) ?? [];
      },
      withheld,
    };
    for (;;) {
      const found = strandedWrites(context);
      if (found.size === 0) break;
      for (const [item, reasons] of found) {
        stranded.set(item, [...(stranded.get(item) ?? []), ...reasons]);
        if (item.operation !== 'create') keep(item);
      }
      closeOverKept();
    }
  }

  return withholdOperations(diff, {
    create: (item) => [...(createReasons.get(item) ?? []), ...(stranded.get(item) ?? [])],
    edit: (item) => [...(editReasons.get(item) ?? []), ...dependsOnKept(item), ...(stranded.get(item) ?? [])],
    delete: (item) => [...(deleteReasons.get(item) ?? []), ...dependsOnKept(item), ...(stranded.get(item) ?? [])],
  });
}
