/**
 * Orphaned references (design, "What moves off the ledger"): the ledger checks a record's references when the record
 * is written and never again, so a restatement that edits or deletes a definition could leave a live record pointing at
 * nothing, or at a record that no longer satisfies it. The writer refuses such a restatement: for every record it edits
 * or deletes, each live record that points at it (the key index's reverse references, `RegisterIndex.referrersOf`, built
 * from `register.requirementsOf`) must still meet every requirement it met before, on the book as the restatement
 * leaves it. That covers, among others, a stock plan edited to drop the class of a grant under it, vesting terms
 * edited to drop the condition a vesting record names, a stock class edited to drop the ratio conversion right a ratio
 * adjustment needs, and a deleted stakeholder, issuance, plan or vesting terms that records still name.
 *
 * Stock states name their class and stakeholder without a reference the ledger checks, so the writer also refuses
 * deleting a stock class while any security of it is outstanding (the ledger would archive its epoch under them) and
 * deleting a stakeholder while it holds any.
 */

import type { RegisterCheckViolation, RegisterRequirement } from '../../types/register';
import { requirementsOf } from '../inputs';
import { checkRequirement } from '../references';
import type { CheckedWrite, CheckRecord } from './book';

const LISTED = 5;

function listed(ids: readonly string[]): string {
  return ids.length > LISTED ? `${ids.slice(0, LISTED).join(', ')} and ${ids.length - LISTED} more` : ids.join(', ');
}

function requirementsOfRecord(record: CheckRecord): RegisterRequirement[] {
  // The entity kind and the native data come from one record; the union cannot be re-correlated by type.
  return requirementsOf(record.entityType, record.data as never);
}

/**
 * The references check of a restatement: the live records that would point at nothing, or at a record that no longer
 * satisfies them, and the stock classes and stakeholders it deletes while stock is outstanding in them.
 *
 * @throws OcpValidationError when the index cannot list the records pointing at a definition (no payloads, or records
 * whose references it cannot read)
 */
export function checkReferences(write: CheckedWrite): RegisterCheckViolation[] {
  if (write.write.kind !== 'restate') return [];
  const violations: RegisterCheckViolation[] = [];
  const deleted = new Set(write.deleted.map(({ record }) => record.objectId));

  // Each live record pointing at a record the restatement edits or deletes, with the first operation that does.
  const referrers = new Map<string, { target: string; operation: number }>();
  for (const { before, operation } of write.touchedRecords()) {
    if (before === null) continue;
    for (const referrer of write.index.referrersOf(before.objectId)) {
      if (deleted.has(referrer.objectId) || referrers.has(referrer.objectId)) continue;
      referrers.set(referrer.objectId, { target: before.objectId, operation });
    }
  }
  for (const [objectId, { target, operation }] of referrers) {
    const record = write.after.record(objectId);
    if (record === null) continue;
    for (const requirement of requirementsOfRecord(record)) {
      const failure = checkRequirement(write.after.lookups, requirement);
      if (failure === null || checkRequirement(write.before.lookups, requirement) !== null) continue;
      violations.push({
        check: 'references',
        rule: 'orphaned_reference',
        message: `${record.objectType} ${objectId} would be left with a broken reference: ${failure}`,
        subject: target,
        operation,
        recordIds: [target, objectId],
      });
      break;
    }
  }

  for (const { record, operation } of write.deleted) {
    if (record.entityType === 'stockClass') {
      const outstanding = write.after.statesOfClass(record.objectId).map((state) => state.security_id);
      if (outstanding.length === 0) continue;
      violations.push({
        check: 'references',
        rule: 'class_has_stock',
        message:
          `Stock class ${record.objectId} still has ${outstanding.length} outstanding securities (${listed(outstanding)}): ` +
          'end or move them before deleting it',
        subject: record.objectId,
        operation,
        recordIds: [record.objectId],
      });
    } else if (record.entityType === 'stakeholder') {
      const held = write.after
        .states()
        .filter((state) => state.stakeholder_id === record.objectId)
        .map((state) => state.security_id);
      if (held.length === 0) continue;
      violations.push({
        check: 'references',
        rule: 'stakeholder_holds',
        message:
          `Stakeholder ${record.objectId} still holds ${held.length} outstanding stock securities (${listed(held)}): ` +
          'end or move them before deleting it',
        subject: record.objectId,
        operation,
        recordIds: [record.objectId],
      });
    }
  }
  return violations;
}
