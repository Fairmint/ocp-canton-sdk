/**
 * The lifecycle of warrants, convertibles and equity compensation (design, "What moves off the ledger"). They cannot
 * be held or traded, so the register keeps no state for them and the ledger cannot see a second exercise. The writer
 * checks, under the instrument's lock (`instrument:<security ID>`), that a write:
 *
 * - does not exercise, convert, release, cancel, transfer or retract a security after it was retired (exercised,
 *   converted, canceled, transferred or retracted, or an equity-compensation grant exercised or released in full),
 *   whatever the dates, so a warrant is never exercised twice;
 * - does not record an acceptance, a repricing or a vesting record on a security retired before the record's date, as
 *   v34 refused them (`CapTable.daml.template:1574-1608`, no repricing after retirement);
 * - does not exercise a security after its expiration date (a warrant's `warrant_expiration_date`, equity
 *   compensation's `expiration_date`);
 * - does not exercise, release, cancel or transfer more than remains (equity compensation's quantity less its
 *   exercises and releases, a warrant's quantity when it names one, a convertible's investment amount).
 *
 * Each security's history is tracked with the offline replay's instrument tracking: the book's records (and the
 * records a restatement edits, where they stand) in date order (on one date: records that change nothing first, then
 * partial uses, then retirements, each in the order written), then the records the write adds, in date order. A new
 * record is judged against the security's whole history, so an exercise backdated before an earlier one is still a
 * second exercise; only its date decides whether a record that changes nothing came before a retirement, and whether
 * an exercise came after the expiration date. Equity compensation keeps pre-split quantities on the ledger and its
 * records dated on or after a split are in post-split units, so a grant's remaining quantity steps through its class's
 * splits between events with the shared floor function (`scaleQuantityAcross`), and a new record dated before the
 * history's last split is brought to the units it is compared in.
 */

import { OcpErrorCodes, OcpValidationError } from '../../errors';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { InstrumentKind, InstrumentState, RecordedSplit, RegisterCheckViolation } from '../../types/register';
import { toUnits } from '../numeric';
import {
  instrumentEventSpec,
  instrumentOfIssuance,
  newInstrument,
  trackInstrumentEvent,
  vestingEventSpec,
  type InstrumentEventSpec,
} from '../replay/instruments';
import { ReplayRefusal, type ReplayRecord } from '../replay/records';
import { scaleQuantityAcross } from '../splits';
import { recordDate, textField, type BookSide, type CheckedWrite, type CheckRecord } from './book';

const VESTING_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'vestingStart',
  'vestingEvent',
  'vestingAcceleration',
]);

const EXERCISES: ReadonlySet<string> = new Set(['TX_WARRANT_EXERCISE', 'TX_EQUITY_COMPENSATION_EXERCISE']);

/** On one date: records that change nothing, then partial uses, then retirements. */
const EFFECT_RANK: Readonly<Record<InstrumentEventSpec['effect'], number>> = { none: 0, reduce: 1, retire: 2 };

/** A rule one record of a tracked history breaks. */
export interface InstrumentViolation {
  rule: 'after_retirement' | 'after_expiration' | 'exceeds_remaining';
  record: CheckRecord;
  message: string;
}

/** A security's lifecycle, tracked over one side of a write. */
export interface TrackedInstrument {
  kind: InstrumentKind;
  issuance: CheckRecord;
  /** After its last record; its remaining quantity is in the units of `lastDate` */
  state: InstrumentState;
  lastDate: string;
  /** The class whose splits its quantities follow: equity compensation's, or its plan's only class */
  stockClassId: string | null;
  violations: InstrumentViolation[];
}

function replayRecord(record: CheckRecord): ReplayRecord {
  return {
    objectType: record.objectType,
    entityType: record.entityType,
    id: record.objectId,
    data: record.data,
    position: record.order,
  };
}

function specOf(kind: InstrumentKind, record: CheckRecord): InstrumentEventSpec | null {
  const spec = instrumentEventSpec(record.objectType);
  if (spec !== null) return spec.kind === kind ? spec : null;
  return VESTING_RECORDS.has(record.entityType) && kind !== 'convertible'
    ? vestingEventSpec(kind, record.objectType)
    : null;
}

/** Read a record with the replay's field readers, refusing a malformed one as the build would. */
function readRecord<T>(record: CheckRecord, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof ReplayRefusal)) throw error;
    throw new OcpValidationError(
      record.operation === null ? `records.${record.objectId}` : `operations[${record.operation}]`,
      error.message,
      { code: OcpErrorCodes.INVALID_FORMAT, classification: 'malformed_record' }
    );
  }
}

/** The class an equity-compensation grant's quantities are in: its own, or its plan's only class. */
function grantClass(side: BookSide, issuance: CheckRecord): string | null {
  const own = textField(issuance, 'stock_class_id');
  if (own !== null) return own;
  const planId = textField(issuance, 'stock_plan_id');
  const plan = planId === null ? null : side.record(planId);
  const classes = plan?.entityType === 'stockPlan' ? plan.data.stock_class_ids : undefined;
  return Array.isArray(classes) && classes.length === 1 && typeof classes[0] === 'string' ? classes[0] : null;
}

function quantityText(event: InstrumentState['events'][number]): string {
  if (event.quantity !== null) return event.quantity;
  return event.amount === null ? '0' : `${event.amount.amount} ${event.amount.currency}`;
}

interface TrackedEvent {
  record: CheckRecord;
  spec: InstrumentEventSpec;
  date: string;
}

function byDate(a: TrackedEvent, b: TrackedEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    EFFECT_RANK[a.spec.effect] - EFFECT_RANK[b.spec.effect] ||
    a.record.order - b.record.order
  );
}

/** A record as tracked when it is compared in a later date's units: its quantity brought there. */
function inUnitsOf(
  record: CheckRecord,
  spec: InstrumentEventSpec,
  splits: readonly RecordedSplit[],
  date: string,
  to: string
): ReplayRecord {
  const tracked = replayRecord(record);
  const { quantity } = record.data;
  if (spec.measure !== 'quantity' || typeof quantity !== 'string' || date >= to || splits.length === 0) return tracked;
  return readRecord(record, () => ({
    ...tracked,
    data: { ...record.data, quantity: scaleQuantityAcross(quantity, splits, date, to) },
  }));
}

/**
 * A warrant's, convertible's or equity-compensation grant's lifecycle over one side of a write: `null` when no
 * issuance of an instrument carries the security there. Records whose object IDs are in `appended` (the ones a write
 * adds) are tracked after the rest of the history.
 */
export function trackInstrument(
  side: BookSide,
  securityId: string,
  appended: ReadonlySet<string> = new Set()
): TrackedInstrument | null {
  const named = side.recordsNaming(securityId).filter((record) => textField(record, 'security_id') === securityId);
  const issuance = named.find((record) => instrumentOfIssuance(record.objectType) !== null);
  const kind = issuance === undefined ? null : instrumentOfIssuance(issuance.objectType);
  if (issuance === undefined || kind === null) return null;
  const events = named
    .filter((record) => record !== issuance)
    .flatMap((record): TrackedEvent[] => {
      const spec = specOf(kind, record);
      return spec === null ? [] : [{ record, spec, date: recordDate(record) ?? '' }];
    });
  const ordered = [
    ...events.filter((event) => !appended.has(event.record.objectId)).sort(byDate),
    ...events.filter((event) => appended.has(event.record.objectId)).sort(byDate),
  ];

  let state = readRecord(issuance, () => newInstrument(replayRecord(issuance), kind));
  const stockClassId = kind === 'equityCompensation' ? grantClass(side, issuance) : null;
  const splits = stockClassId === null ? [] : side.splits(stockClassId);
  let lastDate = state.issueDate;
  const violations: InstrumentViolation[] = [];
  for (const { record, spec, date } of ordered) {
    let current = state;
    const remaining = current.remainingQuantity;
    if (remaining !== null && toUnits(remaining) > 0n && date > lastDate && splits.length > 0) {
      current = { ...current, remainingQuantity: scaleQuantityAcross(remaining, splits, lastDate, date) };
    }
    const tracked = inUnitsOf(record, spec, splits, date, lastDate);
    state = readRecord(record, () => trackInstrumentEvent(current, tracked, spec));
    const comparedOn = lastDate;
    if (date > lastDate) lastDate = date;
    const event = state.events[state.events.length - 1];
    if (event === undefined) continue;
    const { retired } = current;
    if (event.afterRetirement && retired !== null && (event.effect !== 'none' || retired.date < event.date)) {
      violations.push({
        rule: 'after_retirement',
        record,
        message:
          `${spec.label} ${record.objectId} on security ${securityId} comes after it was retired by ` +
          `${retired.objectType} ${retired.recordId} (${retired.date})`,
      });
    } else if (event.exceedsRemaining) {
      const left = spec.measure === 'amount' ? current.remainingAmount : current.remainingQuantity;
      const own = record.data.quantity;
      const used =
        tracked.data !== record.data && typeof own === 'string'
          ? `${own} (${quantityText(event)} in the units of ${comparedOn})`
          : quantityText(event);
      violations.push({
        rule: 'exceeds_remaining',
        record,
        message: `${spec.label} ${record.objectId} of ${used} exceeds the ${left ?? '0'} remaining of security ${securityId}`,
      });
    }
    if (EXERCISES.has(record.objectType) && event.afterExpiration) {
      violations.push({
        rule: 'after_expiration',
        record,
        message:
          `${spec.label} ${record.objectId} is dated ${event.date}, after the expiration date ` +
          `${current.expirationDate ?? ''} of security ${securityId}`,
      });
    }
  }
  return { kind, issuance, state, lastDate, stockClassId, violations };
}

/** The securities of instruments a record touches: the one it is issued as or recorded on. */
function instrumentSecurity(record: CheckRecord): string | null {
  const isInstrument =
    instrumentOfIssuance(record.objectType) !== null ||
    instrumentEventSpec(record.objectType) !== null ||
    VESTING_RECORDS.has(record.entityType);
  return isInstrument ? textField(record, 'security_id') : null;
}

function violationKey(violation: InstrumentViolation): string {
  return `${violation.rule}:${violation.record.objectId}`;
}

/**
 * The instruments check of a write: what its records break in the lifecycle of each warrant, convertible and
 * equity-compensation security they touch, against what the book already broke before it.
 */
export function checkInstruments(write: CheckedWrite): RegisterCheckViolation[] {
  const securities = new Map<string, { operation: number; recordId: string }>();
  for (const { before, after, operation } of write.touchedRecords()) {
    for (const record of [after, before]) {
      const securityId = record === null ? null : instrumentSecurity(record);
      if (securityId !== null && record !== null && !securities.has(securityId)) {
        securities.set(securityId, { operation, recordId: record.objectId });
      }
    }
  }
  const added = new Set(write.written.filter((record) => !write.edited.has(record)).map((record) => record.objectId));
  const violations: RegisterCheckViolation[] = [];
  for (const [securityId, cause] of securities) {
    const after = trackInstrument(write.after, securityId, added);
    if (after === null) continue;
    const known = new Set((trackInstrument(write.before, securityId)?.violations ?? []).map(violationKey));
    for (const violation of after.violations) {
      if (known.has(violationKey(violation))) continue;
      const { record } = violation;
      violations.push({
        check: 'instruments',
        rule: violation.rule,
        message: violation.message,
        subject: securityId,
        operation: record.operation ?? cause.operation,
        // A record of the book that the write leaves broken is named after the write's record that breaks it.
        recordIds: record.operation === null ? [cause.recordId, record.objectId] : [record.objectId],
      });
    }
  }
  return violations;
}
