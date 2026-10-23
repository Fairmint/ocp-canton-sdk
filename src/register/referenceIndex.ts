/**
 * The reverse of the references the ledger checks when a record is written (`References.requirementsOf`): for each
 * object and security ID, the live records whose requirements name it. The ledger checks a record's references only
 * when the record is written, so an edit or delete of a definition that would leave a live record pointing at nothing
 * is the SDK's to refuse (design, "What moves off the ledger"); this index finds the records to re-check.
 *
 * Internal: it reads each record's generated `OcfRecordData`, so it stays behind the package boundary.
 */

import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml } from '../functions/OpenCapTable/capTable/ocfToDaml';
import type { RegisterRecord, RegisterRequirement } from '../types/register';
import { requirementsOfRecord } from './references';

const ISSUANCE_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
]);

function objectKey(objectId: string): string {
  return `object:${objectId}`;
}

function securityKey(securityId: string): string {
  return `security:${securityId}`;
}

/** The IDs a requirement names, as keys: what a record must keep pointing at for the requirement to hold. */
export function requirementKeys(requirement: RegisterRequirement): string[] {
  switch (requirement.kind) {
    case 'object':
      return [objectKey(requirement.object_id)];
    case 'security':
    case 'trigger':
    case 'vesting_condition':
      return [securityKey(requirement.security_id)];
    case 'plan_includes_class':
      return [objectKey(requirement.stock_plan_id), objectKey(requirement.stock_class_id)];
    case 'ratio_conversion_right':
      return [objectKey(requirement.stock_class_id)];
    case 'split_of_class':
      return [objectKey(requirement.split_id), objectKey(requirement.stock_class_id)];
  }
}

/**
 * Every reference a record of the book makes (`requirementsOf` on its generated data), or `null` when its data does
 * not convert. The hold pair makes none.
 */
export function recordRequirements(record: RegisterRecord): RegisterRequirement[] | null {
  if (record.data === null) return null;
  if (record.entityType === 'stockHold' || record.entityType === 'stockHoldCancellation') return [];
  try {
    // The entity kind and the native data come from one admitted record; the union cannot be re-correlated.
    return requirementsOfRecord(convertToDaml(record.entityType, record.data as never));
  } catch {
    return null;
  }
}

/** How the reverse index reads the book it belongs to. */
export interface ReferrerLookups {
  record(objectId: string): RegisterRecord | null;
  recordById(contractId: string): RegisterRecord | null;
}

/**
 * The live records that point at each ID, kept current record by record. A record whose references cannot be read is
 * kept apart: no query can then prove that nothing points at a definition.
 */
export class ReferrerIndex {
  private readonly requirements = new Map<string, RegisterRequirement[]>();
  private readonly byKey = new Map<string, Set<string>>();
  private readonly unreadable = new Map<string, string>();

  /** Index a record's references. */
  add(record: RegisterRecord): void {
    this.remove(record.contractId);
    const requirements = recordRequirements(record);
    if (requirements === null) {
      this.unreadable.set(record.contractId, record.objectId);
      return;
    }
    this.requirements.set(record.contractId, requirements);
    for (const key of new Set(requirements.flatMap(requirementKeys))) {
      const referrers = this.byKey.get(key);
      if (referrers === undefined) this.byKey.set(key, new Set([record.contractId]));
      else referrers.add(record.contractId);
    }
  }

  /** Drop an archived record's references. */
  remove(contractId: string): void {
    this.unreadable.delete(contractId);
    const requirements = this.requirements.get(contractId);
    if (requirements === undefined) return;
    this.requirements.delete(contractId);
    for (const key of new Set(requirements.flatMap(requirementKeys))) {
      const referrers = this.byKey.get(key);
      referrers?.delete(contractId);
      if (referrers?.size === 0) this.byKey.delete(key);
    }
  }

  /** The object IDs of records whose references could not be read. */
  unreadableRecords(): string[] {
    return [...this.unreadable.values()];
  }

  /**
   * The contracts of the live records that point at an object: by its object ID, through the security an issuance
   * carries (events, triggers, vesting conditions on it), and, for vesting terms, the vesting records on the securities
   * of the issuances that name them. The object itself is left out.
   */
  referrersOf(objectId: string, lookups: ReferrerLookups): string[] {
    const found = new Set(this.byKey.get(objectKey(objectId)) ?? []);
    const target = lookups.record(objectId);
    if (target !== null && ISSUANCE_TYPES.has(target.entityType)) {
      for (const securityId of target.securityIds) {
        for (const contractId of this.byKey.get(securityKey(securityId)) ?? []) found.add(contractId);
      }
    }
    if (target?.entityType === 'vestingTerms') {
      for (const contractId of [...found]) {
        const issuance = lookups.recordById(contractId);
        if (issuance === null || !ISSUANCE_TYPES.has(issuance.entityType)) continue;
        for (const securityId of issuance.securityIds) {
          for (const candidate of this.byKey.get(securityKey(securityId)) ?? []) {
            const names = this.requirements
              .get(candidate)
              ?.some(
                (requirement) => requirement.kind === 'vesting_condition' && requirement.security_id === securityId
              );
            if (names === true) found.add(candidate);
          }
        }
      }
    }
    if (target !== null) found.delete(target.contractId);
    return [...found];
  }
}
