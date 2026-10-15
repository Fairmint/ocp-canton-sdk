/**
 * Client-side mirror of OCP's root guard for position-managed holdings (`validatePositionManagedWrites` in
 * OpenCapTable-v34 0.0.4 `CapTable.daml`), shared by `CapTableBatch` and the replication diff.
 *
 * The ledger checks every record an `UpdateCapTable` batch writes in its proposed version (creates and edits) and in
 * its stored version (edits and deletes). No version may:
 *
 * - be a stock issuance, stock class split or conversion-ratio adjustment in a position-managed class;
 * - name, as its source, resulting or balance security, a migrated security or a security in the provenance (origin
 *   or ancestry) of a migrated lot;
 * - name a stock security whose stock issuance is in a position-managed class (checked for records that do not
 *   themselves write into a class).
 *
 * A position-managed stock class cannot be deleted either. The guard is inactive on a root without positions. The
 * record kinds and the securities each names follow OCP's `*Refs` functions exactly.
 *
 * @module positionWriteGuard
 */

import type { OcfEntityType } from '../capTable/entityTypes';
import type { CapTablePositionFields } from './positionTypes';

/** Why a root write is refused. */
export type PositionWriteViolationReason =
  /** A stock issuance, split or conversion-ratio adjustment in a position-managed class (ledger guard). */
  | 'managed_class_record'
  /** The record names a migrated security (ledger guard). */
  | 'migrated_security'
  /** The record names a security in the provenance of a migrated lot (ledger guard). */
  | 'ancestor_security'
  /** The record names a security whose stock issuance is in a position-managed class (ledger guard). */
  | 'managed_class_security'
  /** Deleting a position-managed stock class (ledger guard). */
  | 'managed_stock_class_delete'
  /** The record was written by a position registry outside the root maps; `UpdateCapTable` cannot edit or delete it. */
  | 'registry_record'
  /** Editing or deleting a stakeholder that a position or a registry-written record references (replication). */
  | 'referenced_stakeholder'
  /** Deleting a legend template, stock plan or vesting terms a position lot or registry record references (replication). */
  | 'referenced_object'
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
  /** Human-readable reason, worded like the ledger guard's message. */
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

/** Records that write into a stock class: `(label, Some stock_class_id, [issued security])`. */
const CLASS_RECORDS: Partial<Record<OcfEntityType, { label: string; securities: (data: RecordData) => string[] }>> = {
  stockIssuance: { label: 'stock issuance', securities: (d) => text(d, 'security_id') },
  stockClassSplit: { label: 'stock class split', securities: () => [] },
  stockClassConversionRatioAdjustment: { label: 'conversion ratio adjustment', securities: () => [] },
};

/** Records that name stock securities: `(label, None, securities)`. */
const SECURITY_RECORDS: Partial<Record<OcfEntityType, { label: string; securities: (data: RecordData) => string[] }>> =
  {
    stockTransfer: {
      label: 'stock transfer',
      securities: (d) => [
        ...text(d, 'security_id'),
        ...texts(d, 'resulting_security_ids'),
        ...text(d, 'balance_security_id'),
      ],
    },
    stockCancellation: {
      label: 'stock cancellation',
      securities: (d) => [...text(d, 'security_id'), ...text(d, 'balance_security_id')],
    },
    stockRepurchase: {
      label: 'stock repurchase',
      securities: (d) => [...text(d, 'security_id'), ...text(d, 'balance_security_id')],
    },
    stockRetraction: { label: 'stock retraction', securities: (d) => text(d, 'security_id') },
    stockReissuance: {
      label: 'stock reissuance',
      securities: (d) => [...text(d, 'security_id'), ...texts(d, 'resulting_security_ids')],
    },
    stockConversion: {
      label: 'stock conversion',
      securities: (d) => [
        ...text(d, 'security_id'),
        ...texts(d, 'resulting_security_ids'),
        ...text(d, 'balance_security_id'),
      ],
    },
    stockAcceptance: { label: 'stock acceptance', securities: (d) => text(d, 'security_id') },
    // OCF also carries a deprecated resulting_security_ids array; any security it names is checked too.
    stockConsolidation: {
      label: 'stock consolidation',
      securities: (d) => [
        ...text(d, 'resulting_security_id'),
        ...texts(d, 'resulting_security_ids'),
        ...texts(d, 'security_ids'),
      ],
    },
    warrantExercise: { label: 'warrant exercise', securities: (d) => texts(d, 'resulting_security_ids') },
    convertibleConversion: { label: 'convertible conversion', securities: (d) => texts(d, 'resulting_security_ids') },
    equityCompensationExercise: {
      label: 'equity compensation exercise',
      securities: (d) => texts(d, 'resulting_security_ids'),
    },
    equityCompensationRelease: {
      label: 'equity compensation release',
      securities: (d) => texts(d, 'resulting_security_ids'),
    },
    vestingStart: { label: 'vesting start', securities: (d) => text(d, 'security_id') },
    vestingEvent: { label: 'vesting event', securities: (d) => text(d, 'security_id') },
    vestingAcceleration: { label: 'vesting acceleration', securities: (d) => text(d, 'security_id') },
  };

/** Whether the ledger guard inspects records of this entity type (its stored version for edits and deletes). */
export function isPositionGuardedEntityType(entityType: OcfEntityType): boolean {
  return CLASS_RECORDS[entityType] !== undefined || SECURITY_RECORDS[entityType] !== undefined;
}

/**
 * The guard-relevant references of one version of a record, or `null` for entity types the guard ignores.
 *
 * Accepts OCF data and DAML record data alike: the fields the guard reads have the same names in both.
 */
export function positionRecordRefs(entityType: OcfEntityType, id: string, data: unknown): PositionRecordRefs | null {
  const record: RecordData =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as RecordData) : {};
  const classRecord = CLASS_RECORDS[entityType];
  if (classRecord !== undefined) {
    const [stockClassId] = text(record, 'stock_class_id');
    return {
      label: `${classRecord.label} ${id}`,
      writesInto: stockClassId ?? null,
      securityIds: [...new Set(classRecord.securities(record))],
    };
  }
  const securityRecord = SECURITY_RECORDS[entityType];
  if (securityRecord !== undefined) {
    return {
      label: `${securityRecord.label} ${id}`,
      writesInto: null,
      securityIds: [...new Set(securityRecord.securities(record))],
    };
  }
  return null;
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
  for (const securityId of refs.securityIds) {
    if (fields.migratedSecurityIds.has(securityId)) {
      violations.push({
        reason: 'migrated_security',
        version,
        securityId,
        message: `${prefix} references migrated security ${securityId}`,
      });
    }
    const migratedDescendant = fields.ancestorSecurityIds.get(securityId);
    if (migratedDescendant !== undefined) {
      violations.push({
        reason: 'ancestor_security',
        version,
        securityId,
        message: `${prefix} references security ${securityId} in the provenance of migrated security ${migratedDescendant}`,
      });
    }
    if (refs.writesInto === null) {
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

/** One line per refused write, for error messages and logs. */
export function describePositionWriteRefusal(refusal: PositionWriteRefusal): string {
  return `${refusal.operation} ${refusal.entityType} ${refusal.id}: ${refusal.violations
    .map((violation) => violation.message)
    .join('; ')}`;
}
