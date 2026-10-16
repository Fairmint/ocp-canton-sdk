/**
 * Client-side mirror of OCP's root guard for position-managed holdings (`validatePositionManagedWrites` in
 * OpenCapTable-v34 0.0.4 `CapTable.daml`), shared by `CapTableBatch` and the replication diff.
 *
 * The guard reads only the root's `position_registries`. It checks every record an `UpdateCapTable` batch writes in
 * its proposed version (creates and edits) and in its stored version (edits and deletes). No version may:
 *
 * - be a stock issuance, stock class split or conversion-ratio adjustment in a position-managed class;
 * - name a stock security whose root stock issuance is in a position-managed class (checked for records that do not
 *   themselves write into a class). A migrated security's root issuance is in one, so this covers it.
 *
 * A position-managed stock class cannot be deleted either, and vesting terms behind position lots stay as they are
 * (`validatePositionVestingTerms`, {@link checkPositionVestingTermsWrite}). The guard is inactive on a root without
 * registries.
 *
 * OCP generates its `*Refs` functions from `captable-config.yaml` (`generate-captable.ts`): a type is guarded on the
 * fields its validations check against `stock_issuances_by_security_id` (a stock issuance also on its own
 * `security_id`), the types in `position_class_writes` write into their `stock_class_id`, and a record's label is its
 * type name in lower-case words. The tables below mirror that config, and {@link positionRecordRefs} derives the
 * label by the same rule, so the SDK's refusal and the ledger's rejection name a record alike.
 *
 * @module positionWriteGuard
 */

import type { OcfEntityType } from '../capTable/entityTypes';
import type { CapTablePositionFields } from './positionTypes';

/** Why a root write is refused. */
export type PositionWriteViolationReason =
  /** A stock issuance, split or conversion-ratio adjustment in a position-managed class (ledger guard). */
  | 'managed_class_record'
  /** The record names a security whose stock issuance is in a position-managed class (ledger guard). */
  | 'managed_class_security'
  /** Deleting a position-managed stock class (ledger guard). */
  | 'managed_stock_class_delete'
  /** Editing or deleting vesting terms that a root stock issuance of a position-managed class names (ledger guard). */
  | 'managed_vesting_terms'
  /** Editing vesting terms so that they drop a condition ID, on a root with position-managed classes (ledger guard). */
  | 'removed_vesting_condition'
  /** The record was written by a position registry outside the root maps; `UpdateCapTable` cannot edit or delete it. */
  | 'registry_record'
  /**
   * The record names a security that only a registry-written stock issuance carries, which the root does not list
   * (replication; the ledger guard does not see it, and OCP's reference checks reject all but a return to pool).
   */
  | 'registry_security'
  /** Editing or deleting a stakeholder that a position or a registry-written record references (replication). */
  | 'referenced_stakeholder'
  /** Editing or deleting a stakeholder the caller protects, such as a party to an open trade (replication). */
  | 'protected_stakeholder'
  /**
   * Deleting a legend template, stock plan or vesting terms, or editing vesting terms, that a position lot or a
   * registry-written issuance references (replication; `CapTableBatch` for vesting terms, given a `capTableState`).
   */
  | 'referenced_object'
  /**
   * Deleting what a root record the guard keeps still references, editing the issuance of a security it draws on or
   * results in, or changing the security ID of an issuance it lists, which OCP's final reference and balance checks
   * would hold against the kept record (replication).
   */
  | 'retained_record_reference'
  /** The record's stored version is unknown, so the guard cannot prove the write is allowed (replication). */
  | 'stored_version_unknown'
  /** Replacing the issuer needs archiving the CapTable, which the ledger refuses while it has registries. */
  | 'cap_table_archive';

/** One reason a write is refused. */
export interface PositionWriteViolation {
  readonly reason: PositionWriteViolationReason;
  /** Which version of the record the reason comes from: the written data or the record on the ledger. */
  readonly version?: 'proposed' | 'stored';
  readonly stockClassId?: string;
  readonly securityId?: string;
  /** Human-readable reason; for the ledger guard's reasons, worded like the ledger's message. */
  readonly message: string;
}

/** A write that is refused, with every reason found. */
export interface PositionWriteRefusal {
  readonly operation: 'create' | 'edit' | 'delete';
  readonly entityType: OcfEntityType;
  /** Canonical OCF object ID. */
  readonly id: string;
  readonly violations: readonly PositionWriteViolation[];
}

/**
 * What one version of a root record says about position-managed holdings, as OCP's `*Refs` functions compute it:
 * the record's label, the stock class it writes into (stock issuances, splits and conversion-ratio adjustments) and
 * every stock security it names.
 */
export interface PositionRecordRefs {
  readonly label: string;
  readonly writesInto: string | null;
  readonly securityIds: readonly string[];
}

type RecordData = Record<string, unknown>;

function text(data: RecordData, field: string): string[] {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function texts(data: RecordData, field: string): string[] {
  const value = data[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

/** The types that write into their `stock_class_id`: OCP's `position_class_writes`. */
const CLASS_WRITES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'stockClassSplit',
  'stockClassConversionRatioAdjustment',
]);

/**
 * The stock securities each type names: the fields its OCP validations check against `stock_issuances_by_security_id`,
 * a stock issuance's own `security_id`, and the fields OCP's `position_security_refs` lists.
 */
const NAMED_SECURITIES: Partial<Record<OcfEntityType, (data: RecordData) => string[]>> = {
  stockIssuance: (d) => text(d, 'security_id'),
  stockTransfer: (d) => [
    ...text(d, 'security_id'),
    ...texts(d, 'resulting_security_ids'),
    ...text(d, 'balance_security_id'),
  ],
  stockCancellation: (d) => [...text(d, 'security_id'), ...text(d, 'balance_security_id')],
  stockRepurchase: (d) => [...text(d, 'security_id'), ...text(d, 'balance_security_id')],
  stockRetraction: (d) => text(d, 'security_id'),
  stockReissuance: (d) => [...text(d, 'security_id'), ...texts(d, 'resulting_security_ids')],
  stockConversion: (d) => [
    ...text(d, 'security_id'),
    ...texts(d, 'resulting_security_ids'),
    ...text(d, 'balance_security_id'),
  ],
  stockAcceptance: (d) => text(d, 'security_id'),
  // OCF also carries a deprecated resulting_security_ids array; any security it names is checked too.
  stockConsolidation: (d) => [
    ...text(d, 'resulting_security_id'),
    ...texts(d, 'resulting_security_ids'),
    ...texts(d, 'security_ids'),
  ],
  warrantExercise: (d) => texts(d, 'resulting_security_ids'),
  convertibleConversion: (d) => texts(d, 'resulting_security_ids'),
  equityCompensationExercise: (d) => texts(d, 'resulting_security_ids'),
  equityCompensationRelease: (d) => texts(d, 'resulting_security_ids'),
  vestingStart: (d) => text(d, 'security_id'),
  vestingEvent: (d) => text(d, 'security_id'),
  vestingAcceleration: (d) => text(d, 'security_id'),
  // Not validated as a stock security (it may name an equity compensation security), but guarded all the same.
  stockPlanReturnToPool: (d) => text(d, 'security_id'),
};

/**
 * A type's label in the ledger guard's messages, derived as OCP's generator derives it: the type name in lower-case
 * words (`stockClassConversionRatioAdjustment` is "stock class conversion ratio adjustment").
 */
function recordLabel(entityType: OcfEntityType): string {
  return entityType.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/** Whether the ledger guard inspects records of this entity type (its stored version for edits and deletes). */
export function isPositionGuardedEntityType(entityType: OcfEntityType): boolean {
  return CLASS_WRITES.has(entityType) || NAMED_SECURITIES[entityType] !== undefined;
}

/**
 * The guard-relevant references of one version of a record, or `null` for entity types the guard ignores.
 *
 * Accepts OCF data and DAML record data alike: the fields the guard reads have the same names in both.
 */
export function positionRecordRefs(entityType: OcfEntityType, id: string, data: unknown): PositionRecordRefs | null {
  if (!isPositionGuardedEntityType(entityType)) return null;
  const record: RecordData =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as RecordData) : {};
  const [stockClassId] = CLASS_WRITES.has(entityType) ? text(record, 'stock_class_id') : [];
  return {
    label: `${recordLabel(entityType)} ${id}`,
    writesInto: stockClassId ?? null,
    securityIds: [...new Set(NAMED_SECURITIES[entityType]?.(record) ?? [])],
  };
}

/** Securities whose stock class the check of these references needs (named by a record outside any class). */
export function securitiesNeedingStockClass(refs: PositionRecordRefs): readonly string[] {
  return refs.writesInto === null ? refs.securityIds : [];
}

/**
 * Check one version of a record against the position fields, as the ledger guard does, and return every reason it
 * would be rejected.
 *
 * @param refs - The record version's references ({@link positionRecordRefs})
 * @param version - `proposed` for the data written, `stored` for the record on the ledger
 * @param fields - The CapTable's position fields
 * @param stockClassOfSecurity - The stock class of each security's stock issuance, where known
 */
export function checkPositionRecordVersion(
  refs: PositionRecordRefs,
  version: 'proposed' | 'stored',
  fields: CapTablePositionFields,
  stockClassOfSecurity: (securityId: string) => string | undefined
): PositionWriteViolation[] {
  if (!fields.enabled) return [];
  const prefix = `${refs.label} (${version})`;
  const violations: PositionWriteViolation[] = [];
  if (refs.writesInto !== null && fields.registries.has(refs.writesInto)) {
    violations.push({
      reason: 'managed_class_record',
      version,
      stockClassId: refs.writesInto,
      message: `${prefix} is in position-managed class ${refs.writesInto}`,
    });
  }
  // A record that writes into a class names only the security it issues there, and that class was checked above.
  for (const securityId of securitiesNeedingStockClass(refs)) {
    const stockClassId = stockClassOfSecurity(securityId);
    if (stockClassId !== undefined && fields.registries.has(stockClassId)) {
      violations.push({
        reason: 'managed_class_security',
        version,
        securityId,
        stockClassId,
        message: `${prefix} references security ${securityId} of position-managed class ${stockClassId}`,
      });
    }
  }
  return violations;
}

/** The ledger guard's check on deletes of stock classes: a position-managed class cannot be deleted. */
export function checkStockClassDelete(
  entityType: OcfEntityType,
  id: string,
  fields: CapTablePositionFields
): PositionWriteViolation[] {
  if (!fields.enabled || entityType !== 'stockClass' || !fields.registries.has(id)) return [];
  return [
    {
      reason: 'managed_stock_class_delete',
      stockClassId: id,
      message: `stock class ${id} is position-managed`,
    },
  ];
}

/** The condition IDs of one version of vesting terms (OCF or DAML data: `vesting_conditions[].id`). */
function vestingConditionIds(data: unknown): string[] {
  const conditions = data !== null && typeof data === 'object' ? (data as RecordData).vesting_conditions : undefined;
  if (!Array.isArray(conditions)) return [];
  return conditions.flatMap((condition: unknown) =>
    condition !== null && typeof condition === 'object' ? text(condition as RecordData, 'id') : []
  );
}

/**
 * The ledger guard's check on an edit or delete of vesting terms (`validatePositionVestingTerms`), on a root with
 * position-managed classes. A lot keeps its issuance's vesting terms, and the registry's vesting snapshots and records
 * follow them and name their conditions. So no root stock issuance of a managed class (as stored, migrated or not)
 * may name the terms, and an edit may drop none of the stored version's condition IDs.
 *
 * Accepts OCF data and DAML record data alike: the fields the check reads have the same names in both.
 *
 * @param write - The edit (with its proposed data) or delete of the vesting terms
 * @param fields - The CapTable's position fields
 * @param rootStockIssuances - Every stock issuance the root lists, as stored
 * @param stored - The vesting terms as stored, for an edit of terms the root lists
 */
export function checkPositionVestingTermsWrite(
  write: { readonly operation: 'edit' | 'delete'; readonly id: string; readonly data?: unknown },
  fields: CapTablePositionFields,
  rootStockIssuances: Iterable<unknown>,
  stored: unknown
): PositionWriteViolation[] {
  if (!fields.enabled) return [];
  const violations: PositionWriteViolation[] = [];
  for (const issuance of rootStockIssuances) {
    const record: RecordData = issuance !== null && typeof issuance === 'object' ? (issuance as RecordData) : {};
    const [stockClassId] = text(record, 'stock_class_id');
    if (stockClassId === undefined || !fields.registries.has(stockClassId)) continue;
    if (text(record, 'vesting_terms_id')[0] !== write.id) continue;
    const [securityId = ''] = text(record, 'security_id');
    violations.push({
      reason: 'managed_vesting_terms',
      stockClassId,
      securityId,
      message: `vesting terms ${write.id} are named by security ${securityId} of position-managed class ${stockClassId}`,
    });
  }
  if (write.operation === 'edit' && stored !== undefined) {
    const kept = new Set(vestingConditionIds(write.data));
    for (const conditionId of vestingConditionIds(stored)) {
      if (kept.has(conditionId)) continue;
      violations.push({
        reason: 'removed_vesting_condition',
        version: 'proposed',
        message: `vesting terms ${write.id} (proposed) removes vesting condition ${conditionId}`,
      });
    }
  }
  return violations;
}

/** One line per refused write, for error messages and logs. */
export function describePositionWriteRefusal(refusal: PositionWriteRefusal): string {
  return `${refusal.operation} ${refusal.entityType} ${refusal.id}: ${refusal.violations
    .map((violation) => violation.message)
    .join('; ')}`;
}
