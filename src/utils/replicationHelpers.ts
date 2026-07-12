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

import { types as nodeUtilTypes } from 'node:util';

import { OcpErrorCodes } from '../errors/codes';
import { toSafeDiagnosticText } from '../errors/OcpError';
import { OcpValidationError } from '../errors/OcpValidationError';
import {
  isOcfEntityType,
  mapOcfObjectTypeToEntityType,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfEntityDataMap,
  type OcfEntityType,
  type OcfReadDataTypeFor,
} from '../functions/OpenCapTable/capTable/entityTypes';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import type { OcfManifest } from './cantonOcfExtractor';
import { DEFAULT_DEPRECATED_FIELDS, DEFAULT_INTERNAL_FIELDS, ocfDeepEqual } from './ocfComparison';
import { assertSafeOcfJson } from './ocfJsonValidation';
import { normalizeOcfData } from './ocfNormalization';

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
 *
 * Derived from the canonical object-type registry so categorized legacy reads
 * cannot drift from the exact manifest and reader inventory.
 */
function buildTransactionSubtypeMap(): Readonly<Record<string, OcfEntityType>> {
  const transactionTypes: Record<string, OcfEntityType> = {};
  for (const [objectType, entityType] of Object.entries(OCF_OBJECT_TYPE_TO_ENTITY_TYPE)) {
    if (objectType.startsWith('TX_') || objectType.startsWith('CE_')) {
      transactionTypes[objectType] = entityType;
    }
  }
  return Object.freeze(transactionTypes);
}

export const TRANSACTION_SUBTYPE_MAP = buildTransactionSubtypeMap();

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

const diagnosticText = (value: unknown): string => toSafeDiagnosticText(value, 128);
const diagnosticLiteral = (value: unknown): string =>
  typeof value === 'string' ? JSON.stringify(diagnosticText(value)) : diagnosticText(value);

function ownDataProperty(value: unknown, property: string): unknown {
  if (value === null || typeof value !== 'object' || nodeUtilTypes.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

/**
 * Build a CantonOcfDataMap from an OCF manifest.
 *
 * Converts the array-based manifest structure into a nested Map structure
 * that can be used for efficient lookup during replication diff computation.
 *
 * @param manifest - OCF manifest from extractCantonOcfManifest
 * @returns Map of entityType → Map of canonical object ID → OCF data object
 * @throws OcpValidationError if an object is missing a valid `id` or has an unsupported `object_type`
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
  const mutableData: MutableCantonOcfDataByEntity = {};

  // Helper to add an item to the map with validation
  const addItem = <EntityType extends OcfEntityType>(
    entityType: EntityType,
    item: OcfReadDataTypeFor<EntityType>,
    context: string
  ): void => {
    const safeContext = diagnosticText(context);
    const id = ownDataProperty(item, 'id');
    if (typeof id !== 'string' || id.length === 0) {
      throw new OcpValidationError(
        `${safeContext}.id`,
        `Invalid ${safeContext}: missing or invalid 'id' field. Got: ${diagnosticText(id)}`,
        {
          code: id === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
          expectedType: 'non-empty string',
          receivedValue: id,
        }
      );
    }

    const objectType = ownDataProperty(item, 'object_type');
    const mappedEntityType = typeof objectType === 'string' ? mapOcfObjectTypeToEntityType(objectType) : null;
    if (mappedEntityType !== entityType) {
      throw new OcpValidationError(
        `${safeContext}.object_type`,
        `Invalid ${safeContext}: object_type ${diagnosticLiteral(objectType)} maps to ` +
          `${diagnosticLiteral(mappedEntityType)}, not ${diagnosticLiteral(entityType)}`,
        {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: entityType,
          receivedValue: objectType,
        }
      );
    }

    // Indexed access through a generic mapped key is correlated on reads, but
    // TypeScript models a later write as the intersection of every bucket.
    let typeMap: Map<string, OcfReadDataTypeFor<EntityType>> | undefined = mutableData[entityType];
    if (!typeMap) {
      typeMap = new Map<string, OcfReadDataTypeFor<EntityType>>();
      // TypeScript loses mapped-key correlation for generic indexed writes. The
      // validated generic inputs above preserve it at this private builder boundary.
      Object.defineProperty(mutableData, entityType, {
        configurable: true,
        enumerable: true,
        value: typeMap,
        writable: true,
      });
    }

    if (typeMap.has(id)) {
      throw new OcpValidationError(
        `${safeContext}.id`,
        `Duplicate ${safeContext} id ${diagnosticLiteral(id)} for entity type ${diagnosticLiteral(entityType)}`,
        {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: `unique ${entityType} canonical object ID`,
          receivedValue: id,
          context: { entityType, duplicateId: id },
        }
      );
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

  // Process transactions using the canonical registry-backed object-type mapping.
  for (const tx of manifest.transactions) {
    const objectType = ownDataProperty(tx, 'object_type');
    if (typeof objectType !== 'string') {
      throw new OcpValidationError(
        'transaction.object_type',
        `Invalid transaction: missing or invalid 'object_type' field. Got: ${diagnosticText(objectType)}`,
        {
          code: objectType === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
          expectedType: 'canonical TX_ or CE_ discriminator',
          receivedValue: objectType,
        }
      );
    }

    // The manifest is canonical-only and this category accepts transactions only.
    // Legacy categorized inputs are handled by mapCategorizedTypeToEntityType
    // before they reach this typed boundary.
    if (!objectType.startsWith('TX_') && !objectType.startsWith('CE_')) {
      throw new OcpValidationError(
        'transaction.object_type',
        `Unsupported transaction object_type: ${diagnosticText(objectType)}`,
        {
          code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
          expectedType: 'canonical TX_ or CE_ discriminator',
          receivedValue: objectType,
        }
      );
    }
    const runtimeObjectType: string = objectType;
    const entityType = mapOcfObjectTypeToEntityType(runtimeObjectType);
    if (entityType === null) {
      throw new OcpValidationError(
        'transaction.object_type',
        `Unsupported transaction object_type: ${diagnosticText(objectType)}`,
        {
          code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
          expectedType: 'supported canonical transaction discriminator',
          receivedValue: objectType,
        }
      );
    }
    addItem(entityType, tx, `transaction (${objectType})`);
  }

  const result = new CantonOcfDataMap();
  for (const entityType of Object.keys(mutableData) as OcfEntityType[]) {
    const typeMap = mutableData[entityType];
    if (typeMap === undefined) continue;
    // `mutableData` is a correlated mapped object populated only through
    // `addItem`; iteration widens the key and value independently, so restore
    // that proven relationship at the public tuple boundary.
    result.set(...([entityType, typeMap] as unknown as CantonOcfDataEntry));
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

/** A source item whose entity discriminator determines its canonical OCF payload. */
export type SourceReplicationItem<EntityType extends OcfEntityType = OcfEntityType> = EntityType extends OcfEntityType
  ? Readonly<{
      /** Entity type (SDK format). */
      entityType: EntityType;
      /** Canonical OCF data containing the object identity at `data.id`. */
      data: OcfEntityDataMap[EntityType];
    }>
  : never;

/** A replication create whose entity discriminator determines its canonical OCF payload. */
export type ReplicationCreateItem<EntityType extends OcfEntityType = OcfEntityType> = EntityType extends OcfEntityType
  ? Readonly<{
      id: string;
      entityType: EntityType;
      operation: 'create';
      data: OcfEntityDataMap[EntityType];
    }>
  : never;

/** A replication edit whose entity discriminator determines its canonical OCF payload. */
export type ReplicationEditItem<EntityType extends OcfEntityType = OcfEntityType> = EntityType extends OcfEntityType
  ? Readonly<{
      id: string;
      entityType: EntityType;
      operation: 'edit';
      data: OcfEntityDataMap[EntityType];
    }>
  : never;

/** A replication delete. Deletes deliberately carry no stale OCF payload. */
export type ReplicationDeleteItem<EntityType extends OcfEntityType = OcfEntityType> = EntityType extends OcfEntityType
  ? Readonly<{
      id: string;
      entityType: EntityType;
      operation: 'delete';
    }>
  : never;

/** One entity-correlated replication operation. */
export type ReplicationItem<EntityType extends OcfEntityType = OcfEntityType> =
  | ReplicationCreateItem<EntityType>
  | ReplicationEditItem<EntityType>
  | ReplicationDeleteItem<EntityType>;

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
  creates: ReplicationCreateItem[];
  /** Items in both - may need to be edited */
  edits: ReplicationEditItem[];
  /** Items in Canton but not in source - need to be deleted */
  deletes: ReplicationDeleteItem[];
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
 * Maps entityType to a map of canonical object ID to OCF data object.
 */
type CantonOcfDataByEntity = {
  [EntityType in OcfEntityType]?: ReadonlyMap<string, ReadonlyOcfEntityData<EntityType>>;
};

type MutableCantonOcfDataByEntity = {
  [EntityType in OcfEntityType]?: Map<string, OcfReadDataTypeFor<EntityType>>;
};

type DeepReadonlyValue<Value> = Value extends object
  ? { readonly [Key in keyof Value]: DeepReadonlyValue<Value[Key]> }
  : Value;

/** Deeply readonly canonical OCF data returned by a Canton snapshot bucket. */
export type ReadonlyOcfEntityData<EntityType extends OcfEntityType> = DeepReadonlyValue<OcfEntityDataMap[EntityType]>;

/**
 * One entity-kind bucket accepted by {@link CantonOcfDataMap.set}.
 *
 * This is deliberately a distributive tuple union rather than two independent
 * generic parameters. A union-valued entity kind therefore cannot be paired
 * with a union-valued payload map and later observed through a narrower `get`.
 */
export type CantonOcfDataEntry<EntityType extends OcfEntityType = OcfEntityType> = EntityType extends OcfEntityType
  ? readonly [entityType: EntityType, data: ReadonlyMap<string, ReadonlyOcfEntityData<EntityType>>]
  : never;

function cloneAndFreezeJson<Value>(value: Value): DeepReadonlyValue<Value> {
  if (value === null || typeof value !== 'object') return value as DeepReadonlyValue<Value>;

  if (Array.isArray(value)) {
    const snapshot: unknown[] = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor)) {
        throw new Error('Invariant violation: validated JSON array item disappeared while snapshotting');
      }
      snapshot[index] = cloneAndFreezeJson(descriptor.value);
    }
    return Object.freeze(snapshot) as DeepReadonlyValue<Value>;
  }

  const snapshot = Object.create(Object.getPrototypeOf(value) as object | null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new Error('Invariant violation: validated JSON property disappeared while snapshotting');
    }
    Object.defineProperty(snapshot, key, {
      configurable: true,
      enumerable: true,
      value: cloneAndFreezeJson(descriptor.value),
      writable: true,
    });
  }
  return Object.freeze(snapshot) as DeepReadonlyValue<Value>;
}

/**
 * Runtime-immutable snapshot of a map.
 *
 * `ReadonlyMap` alone is only a compile-time view over a potentially mutable
 * `Map`. Keeping the mutable map behind this wrapper prevents both the input
 * alias and a value returned by `get` from poisoning a correlated bucket.
 */
class ImmutableMapSnapshot<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #data: ReadonlyMap<Key, Value>;

  constructor(entries: Iterable<readonly [Key, Value]>) {
    this.#data = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#data.size;
  }

  get(key: Key): Value | undefined {
    return this.#data.get(key);
  }

  has(key: Key): boolean {
    return this.#data.has(key);
  }

  forEach(callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void, thisArg?: unknown): void {
    this.#data.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }

  entries() {
    return this.#data.entries();
  }

  keys() {
    return this.#data.keys();
  }

  values() {
    return this.#data.values();
  }

  [Symbol.iterator]() {
    return this.#data[Symbol.iterator]();
  }
}

/**
 * Canonical Canton data grouped by its exact OCF entity kind.
 *
 * Generic accessors preserve the correlation between an entity key and the
 * canonical object shape stored under that key.
 */
export class CantonOcfDataMap {
  readonly #data: CantonOcfDataByEntity = {};

  /** Number of entity-kind buckets currently stored. */
  get size(): number {
    return Object.keys(this.#data).length;
  }

  get<EntityType extends OcfEntityType>(
    entityType: EntityType
  ): ReadonlyMap<string, ReadonlyOcfEntityData<EntityType>> | undefined {
    return this.#data[entityType];
  }

  set(...[entityType, data]: CantonOcfDataEntry): this {
    if (!isOcfEntityType(entityType)) {
      throw new OcpValidationError('cantonOcfData.entityType', 'Unsupported Canton OCF entity type', {
        code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
        expectedType: 'supported OCF entity type',
        receivedValue: entityType,
      });
    }
    if (nodeUtilTypes.isProxy(data) || (!(data instanceof Map) && !(data instanceof ImmutableMapSnapshot))) {
      throw new OcpValidationError(`cantonOcfData.${entityType}`, 'Canton OCF bucket must be a native Map snapshot', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'Map<string, canonical OCF object>',
        receivedValue: data,
      });
    }

    const sourceEntries = data instanceof Map ? Map.prototype.entries.call(data) : data.entries();
    const snapshotEntries: Array<readonly [string, ReadonlyOcfEntityData<OcfEntityType>]> = [];
    const seenKeys = new Set<string>();
    let entryIndex = 0;
    for (const [key, value] of sourceEntries) {
      const keyPath = `cantonOcfData.${entityType}.keys[${entryIndex}]`;
      const valuePath = `cantonOcfData.${entityType}.values[${entryIndex}]`;
      if (typeof key !== 'string' || key.length === 0) {
        throw new OcpValidationError(keyPath, 'Canton OCF map key must be a non-empty canonical object ID', {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'non-empty string',
          receivedValue: key,
        });
      }
      if (seenKeys.has(key)) {
        throw new OcpValidationError(keyPath, `Duplicate Canton OCF map key ${diagnosticLiteral(key)}`, {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: 'unique canonical object ID',
          receivedValue: key,
        });
      }

      assertSafeOcfJson(value, valuePath);
      const id = ownDataProperty(value, 'id');
      if (id !== key) {
        throw new OcpValidationError(`${valuePath}.id`, 'Canton OCF map key must equal the value canonical object ID', {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: key,
          receivedValue: id,
        });
      }

      const objectType = ownDataProperty(value, 'object_type');
      const mappedEntityType = typeof objectType === 'string' ? mapOcfObjectTypeToEntityType(objectType) : null;
      if (mappedEntityType !== entityType) {
        throw new OcpValidationError(
          `${valuePath}.object_type`,
          `Canton OCF object_type ${diagnosticLiteral(objectType)} maps to ${diagnosticLiteral(mappedEntityType)}, ` +
            `not ${diagnosticLiteral(entityType)}`,
          {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: entityType,
            receivedValue: objectType,
          }
        );
      }

      seenKeys.add(key);
      snapshotEntries.push([key, cloneAndFreezeJson(value) as ReadonlyOcfEntityData<OcfEntityType>]);
      entryIndex += 1;
    }

    const snapshot = new ImmutableMapSnapshot<string, ReadonlyOcfEntityData<OcfEntityType>>(snapshotEntries);
    Object.defineProperty(this.#data, entityType, {
      configurable: true,
      enumerable: true,
      value: snapshot,
      writable: true,
    });
    return this;
  }
}

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
   * Construct this value with `CantonOcfDataMap` so each entity-kind key stays
   * correlated with its exact canonical OCF object type.
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

function getSourceEntityType(item: SourceReplicationItem, sourceIndex: number): OcfEntityType {
  const entityType = ownDataProperty(item, 'entityType');
  if (typeof entityType !== 'string' || !isOcfEntityType(entityType)) {
    throw new OcpValidationError(`sourceItems[${sourceIndex}].entityType`, 'Unsupported source entity type', {
      code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
      expectedType: 'supported OCF entity type',
      receivedValue: entityType,
    });
  }
  return entityType;
}

function getSourceDataObject(
  item: SourceReplicationItem,
  entityType: OcfEntityType,
  sourceIndex: number
): Record<string, unknown> {
  const data = ownDataProperty(item, 'data');
  const fieldPath = `sourceItems[${sourceIndex}].data`;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new OcpValidationError(
      fieldPath,
      `Invalid source data for entityType="${entityType}": expected object, got ${describeSourceValue(data)}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'canonical OCF object',
        receivedValue: data,
      }
    );
  }

  assertSafeOcfJson(data, fieldPath);
  return data as Record<string, unknown>;
}

function getSourceObjectId(data: Record<string, unknown>, entityType: OcfEntityType, sourceIndex: number): string {
  const id = ownDataProperty(data, 'id');

  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError(
      `sourceItems[${sourceIndex}].data.id`,
      `Invalid source data for entityType="${entityType}": missing or invalid canonical object id at "data.id"`,
      {
        code: id === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
        expectedType: 'non-empty string',
        receivedValue: id,
      }
    );
  }

  return id;
}

function assertSourceEntityCorrelation(
  data: Record<string, unknown>,
  entityType: OcfEntityType,
  sourceIndex: number
): void {
  const objectType = ownDataProperty(data, 'object_type');
  const mappedEntityType = typeof objectType === 'string' ? mapOcfObjectTypeToEntityType(objectType) : null;
  if (mappedEntityType !== entityType) {
    throw new OcpValidationError(
      `sourceItems[${sourceIndex}].data.object_type`,
      `Source object_type ${diagnosticLiteral(objectType)} maps to ${diagnosticLiteral(mappedEntityType)}, ` +
        `not ${diagnosticLiteral(entityType)}`,
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        expectedType: entityType,
        receivedValue: objectType,
      }
    );
  }
}

function toReplicationCreate(
  entityType: OcfEntityType,
  data: Record<string, unknown>,
  id: string
): ReplicationCreateItem {
  // Runtime validation above proves the discriminator/payload relationship that
  // a widened indexed-access union cannot express inside this constructor.
  return { data, entityType, id, operation: 'create' } as ReplicationCreateItem;
}

function toReplicationEdit(entityType: OcfEntityType, data: Record<string, unknown>, id: string): ReplicationEditItem {
  return { data, entityType, id, operation: 'edit' } as ReplicationEditItem;
}

function toReplicationDelete<EntityType extends OcfEntityType>(
  entityType: EntityType,
  id: string
): ReplicationDeleteItem<EntityType> {
  return { entityType, id, operation: 'delete' } as ReplicationDeleteItem<EntityType>;
}

export function computeReplicationDiff(
  sourceItems: readonly SourceReplicationItem[],
  cantonState: CapTableState,
  options: ComputeReplicationDiffOptions = {}
): ReplicationDiff {
  const { cantonOcfData, reportDifferences = false, securityIds } = options;

  const creates: ReplicationCreateItem[] = [];
  const edits: ReplicationEditItem[] = [];
  const deletes: ReplicationDeleteItem[] = [];
  const conflicts: SecurityIdConflict[] = [];

  // Track source items by type for delete detection
  const sourceIdsByType = new Map<OcfEntityType, Set<string>>();

  // Track source identity explicitly so contradictory duplicate payloads cannot
  // silently select a first or last winner.
  const sourceIndexesByType = new Map<OcfEntityType, Map<string, number>>();

  // Comparison options for OCF deep equality
  const comparisonOptions = {
    ignoredFields: DEFAULT_INTERNAL_FIELDS,
    deprecatedFields: DEFAULT_DEPRECATED_FIELDS,
    reportDifferences,
  };

  // Process each source item
  for (const [sourceIndex, item] of sourceItems.entries()) {
    const entityType = getSourceEntityType(item, sourceIndex);
    const sourceData = getSourceDataObject(item, entityType, sourceIndex);
    const objectId = getSourceObjectId(sourceData, entityType, sourceIndex);
    assertSourceEntityCorrelation(sourceData, entityType, sourceIndex);

    let sourceIndexes = sourceIndexesByType.get(entityType);
    if (!sourceIndexes) {
      sourceIndexes = new Map();
      sourceIndexesByType.set(entityType, sourceIndexes);
    }
    const firstSourceIndex = sourceIndexes.get(objectId);
    if (firstSourceIndex !== undefined) {
      throw new OcpValidationError(
        `sourceItems[${sourceIndex}].data.id`,
        `Duplicate source id ${diagnosticLiteral(objectId)} for entity type ${diagnosticLiteral(entityType)}`,
        {
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          expectedType: `unique ${entityType} canonical object ID`,
          receivedValue: objectId,
          context: { duplicateIndex: sourceIndex, entityType, firstIndex: firstSourceIndex },
        }
      );
    }
    sourceIndexes.set(objectId, sourceIndex);

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
      creates.push(toReplicationCreate(entityType, sourceData, objectId));

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
              entityType,
              securityId,
              message:
                `${getEntityTypeLabel(entityType, 1)} id="${objectId}" has ` +
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

      // Normalize both objects before comparison, including quantity_source defaults.
      const normalizedSourceData = normalizeOcfData(sourceData);
      const normalizedCantonData = normalizeOcfData(cantonItemData);

      // Compare source data with Canton data using semantic OCF equality
      const isEqual = ocfDeepEqual(normalizedSourceData, normalizedCantonData, comparisonOptions);

      if (!isEqual) {
        // Data differs → EDIT
        edits.push(toReplicationEdit(entityType, sourceData, objectId));
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
        deletes.push(toReplicationDelete(entityType, cantonId));
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
