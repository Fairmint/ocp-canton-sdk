/**
 * A replication's source records, as the planner reads them: normalized once (plan-security aliases, deprecated
 * fields, numeric strings), each with its entity kind and object ID, and the record facts the planner needs in native
 * OCF terms.
 */

import { OcpErrorCodes, OcpValidationError } from '../../errors';
import {
  isOcfEntityType,
  mapOcfObjectTypeToEntityType,
  type OcfEntityType,
} from '../../functions/OpenCapTable/capTable/entityTypes';
import type { OcfManifest } from '../../utils/cantonOcfExtractor';
import { normalizeEntityType, normalizeObjectType, normalizeOcfData } from '../../utils/planSecurityAliases';
import type { SourceReplicationItem } from '../../utils/replicationHelpers';
import type { ReplicationSource } from './types';

/** One normalized source record. */
export interface SourceRecord {
  entityType: OcfEntityType;
  id: string;
  data: Record<string, unknown>;
}

/** The manifest's categories with the object type a record without one has. */
const MANIFEST_CATEGORIES = [
  ['stakeholders', 'STAKEHOLDER'],
  ['stockClasses', 'STOCK_CLASS'],
  ['stockPlans', 'STOCK_PLAN'],
  ['vestingTerms', 'VESTING_TERMS'],
  ['valuations', 'VALUATION'],
  ['documents', 'DOCUMENT'],
  ['financings', 'FINANCING'],
  ['stockLegendTemplates', 'STOCK_LEGEND_TEMPLATE'],
] as const;

/** The issuances, of every instrument, that carry a security ID. */
export const ISSUANCE_ENTITY_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
]);

/** The stock records that end the securities they name (`Restate.consumedSecurities`). */
const CONSUMING: Readonly<Partial<Record<OcfEntityType, 'security_id' | 'security_ids'>>> = {
  stockTransfer: 'security_id',
  stockCancellation: 'security_id',
  stockRepurchase: 'security_id',
  stockRetraction: 'security_id',
  stockConversion: 'security_id',
  stockReissuance: 'security_id',
  stockConsolidation: 'security_ids',
};

function normalized(data: unknown, fieldPath: string): Record<string, unknown> {
  try {
    return normalizeOcfData(data);
  } catch (error) {
    throw new OcpValidationError(fieldPath, error instanceof Error ? error.message : String(error), {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: data,
    });
  }
}

function record(entityType: OcfEntityType, data: Record<string, unknown>, fieldPath: string): SourceRecord {
  const { id } = data;
  if (typeof id !== 'string' || id === '') {
    throw new OcpValidationError(`${fieldPath}.id`, 'Every source record needs its object ID', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  return { entityType, id, data };
}

function fromManifestObject(value: unknown, fallbackType: string, fieldPath: string): SourceRecord {
  const data = normalized(value, fieldPath);
  const declared = typeof data.object_type === 'string' ? data.object_type : fallbackType;
  const entityType = mapOcfObjectTypeToEntityType(normalizeObjectType(declared));
  if (entityType === null) {
    throw new OcpValidationError(`${fieldPath}.object_type`, `Unknown OCF object type ${declared}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      receivedValue: declared,
    });
  }
  return record(entityType, data, fieldPath);
}

/**
 * The source's records, normalized, in source order.
 *
 * @throws OcpValidationError for a record that is not an object, has no object ID or names an unknown kind
 */
export function readSource(source: ReplicationSource): SourceRecord[] {
  if (Array.isArray(source)) {
    return (source as readonly SourceReplicationItem[]).map((item, position) => {
      const fieldPath = `source[${position}]`;
      const entityType: string = normalizeEntityType(item.entityType);
      if (!isOcfEntityType(entityType)) {
        throw new OcpValidationError(`${fieldPath}.entityType`, `Unknown OCF entity kind ${item.entityType}`, {
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          receivedValue: item.entityType,
        });
      }
      return record(entityType, normalized(item.data, `${fieldPath}.data`), fieldPath);
    });
  }
  const manifest = source as OcfManifest;
  const records: SourceRecord[] = [];
  if (manifest.issuer !== null) records.push(fromManifestObject(manifest.issuer, 'ISSUER', 'source.issuer'));
  for (const [category, objectType] of MANIFEST_CATEGORIES) {
    // A manifest of another tool may leave out a category it has nothing in.
    const values: unknown = manifest[category];
    if (!Array.isArray(values)) continue;
    for (const [position, value] of (values as readonly unknown[]).entries()) {
      records.push(fromManifestObject(value, objectType, `source.${category}[${position}]`));
    }
  }
  for (const [position, value] of manifest.transactions.entries()) {
    records.push(fromManifestObject(value, '', `source.transactions[${position}]`));
  }
  return records;
}

/** The source as `computeReplicationDiff` takes it. */
export function sourceItems(records: readonly SourceRecord[]): SourceReplicationItem[] {
  return records.map(({ entityType, data }) => ({ entityType, data }));
}

/** A text field of a record's native data, or `null`. */
export function textOf(data: Readonly<Record<string, unknown>> | null, field: string): string | null {
  const value = data?.[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The date a record is dated on, or `null` for an undated one. */
export function dateOfRecord(data: Readonly<Record<string, unknown>> | null): string | null {
  const value = textOf(data, 'date');
  return value === null ? null : value.slice(0, 10);
}

/** The security an issuance carries, or `null` for any other record. */
export function issuedSecurity(
  entityType: OcfEntityType,
  data: Readonly<Record<string, unknown>> | null
): string | null {
  return ISSUANCE_ENTITY_TYPES.has(entityType) ? textOf(data, 'security_id') : null;
}

/** The stock securities a record ends (a stock event's source, a consolidation's sources). */
export function consumedSecurityIds(
  entityType: OcfEntityType,
  data: Readonly<Record<string, unknown>> | null
): string[] {
  const field = CONSUMING[entityType];
  if (field === undefined || data === null) return [];
  if (field === 'security_id') {
    const securityId = textOf(data, 'security_id');
    return securityId === null ? [] : [securityId];
  }
  const value = data[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
