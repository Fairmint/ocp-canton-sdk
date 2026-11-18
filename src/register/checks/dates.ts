/**
 * The ledger date (design, "What moves off the ledger"): hold placements and draws are dated on the ledger date, and
 * the events on a stock security are recorded in date order, so an event dated after the ledger date would leave its
 * lot taking no hold, stop or draw until that date. Against the writer's clock (its UTC date), the writer refuses every
 * `CapTable_Apply` or `CapTable_Restate` record that would date a stock security's state after it (a primary issuance,
 * an event on the security with its output issuances, a vesting record or snapshot on a stock lot, a restated state's
 * last event date), and a hold cancellation dated after it. Splits and the records of other instruments block no lot.
 */

import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { RegisterCheckViolation } from '../../types/register';
import { recordDate, textField, type CheckedWrite, type CheckRecord } from './book';

/** The records that are events on a stock security's state, or create one. */
const STOCK_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'stockAcceptance',
  'stockRetraction',
  'stockTransfer',
  'stockCancellation',
  'stockRepurchase',
  'stockConversion',
  'stockReissuance',
  'stockConsolidation',
]);

const VESTING_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'vestingStart',
  'vestingEvent',
  'vestingAcceleration',
]);

function isStockSecurity(write: CheckedWrite, securityId: string): boolean {
  if (write.before.state(securityId) !== null || write.after.state(securityId) !== null) return true;
  return write.after
    .recordsNaming(securityId)
    .some((record) => record.entityType === 'stockIssuance' && textField(record, 'security_id') === securityId);
}

function onStockSecurity(write: CheckedWrite, record: CheckRecord): string | null {
  if (STOCK_RECORDS.has(record.entityType)) {
    if (record.entityType === 'stockConsolidation') return record.securityIds[0] ?? null;
    return textField(record, 'security_id');
  }
  if (!VESTING_RECORDS.has(record.entityType)) return null;
  const securityId = textField(record, 'security_id');
  return securityId !== null && isStockSecurity(write, securityId) ? securityId : null;
}

function futureDated(
  subject: string,
  recordId: string,
  what: string,
  date: string,
  today: string,
  operation: number
): RegisterCheckViolation {
  return {
    check: 'dates',
    rule: 'future_dated',
    message: `${what} is dated ${date}, after the ledger date ${today}: stock security ${subject} would take no hold, stop or draw until then`,
    subject,
    operation,
    recordIds: [recordId],
  };
}

/**
 * The dates check of a write against the ledger date `today` (`YYYY-MM-DD`): one violation per operation that dates a
 * stock security after it.
 */
export function checkDates(write: CheckedWrite, today: string): RegisterCheckViolation[] {
  const violations: RegisterCheckViolation[] = [];
  const reported = new Set<number>();
  const report = (found: RegisterCheckViolation): void => {
    if (found.operation !== null && reported.has(found.operation)) return;
    if (found.operation !== null) reported.add(found.operation);
    violations.push(found);
  };
  const { write: bookWrite } = write;
  for (const record of write.written) {
    const securityId = onStockSecurity(write, record);
    const date = recordDate(record);
    if (securityId === null || date === null || date <= today) continue;
    const what = `${record.objectType} ${record.objectId}`;
    report(futureDated(securityId, record.objectId, what, date, today, record.operation ?? 0));
  }
  switch (bookWrite.kind) {
    case 'apply':
      for (const [operation, op] of bookWrite.operations.entries()) {
        if (op.kind !== 'vestingSnapshot' || op.asOf <= today) continue;
        const what = `The vesting snapshot of ${op.securityId}`;
        report(futureDated(op.securityId, op.securityId, what, op.asOf, today, operation));
      }
      break;
    case 'restate':
      for (const [operation, op] of bookWrite.operations.entries()) {
        if (op.kind !== 'setState' || op.state.last_event_date <= today) continue;
        const { security_id: securityId, last_event_date: date } = op.state;
        report(futureDated(securityId, securityId, `The restated state of ${securityId}`, date, today, operation));
      }
      break;
    case 'cancelHolds':
      if (bookWrite.date <= today) break;
      for (const [operation, hold] of bookWrite.holds.entries()) {
        const what = `The cancellation of hold ${hold.hold_id}`;
        report(futureDated(hold.security_id, hold.hold_id, what, bookWrite.date, today, operation));
      }
      break;
    case 'placeHolds':
    case 'settle':
      // The ledger refuses a placement or draw not dated on the ledger date (`assertLedgerDate`).
      break;
  }
  return violations;
}
