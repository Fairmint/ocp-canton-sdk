/**
 * Ceilings (design, "What moves off the ledger"): a write must not leave a stock class's outstanding shares above the
 * class's authorized shares, the book's outstanding shares above the issuer's, or a stock plan's grants and plan stock
 * above its pool. The ledger keeps no running totals, so the writer checks them under the scopes `writeScopes` takes
 * (the class, the plan, or the whole book while the issuer's ceiling is finite), which no other write can change
 * before the command's outcome is known: two 10-share issuances against 90 of 100 authorized shares never both pass.
 *
 * Each ceiling is compared on one date D: the latest date among the write's records on its subject and the last event
 * dates of the subject's stock states, so every quantity can be brought forward to D's units. Writes are dated in
 * order (replication) or on the ledger date (ta-service), so D is the write's date. The formulas, with their OCF
 * sources (`schema/objects/...`):
 *
 * - Outstanding shares of class C on D: the quantity of every active stock state of C, brought from its last event
 *   date to D's units through C's splits with the shared floor function (`scaleQuantityAcross`, as the ledger applies
 *   them at the state's next event). A security is outstanding from its issuance until a transaction consumes it in
 *   full (`docs/explainers/TraversingTransactions.md`); the register keeps exactly one state per outstanding security.
 * - Authorized shares of C on D: `new_shares_authorized` of the latest `TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT` of
 *   C dated on or before D ("the new number of shares authorized for this stock class as of the event of this
 *   transaction", `transactions/adjustment/StockClassAuthorizedSharesAdjustment`), else the class's
 *   `initial_shares_authorized` (`StockClass`). `UNLIMITED` and `NOT APPLICABLE` (`enums/AuthorizedShares`) set no
 *   ceiling. A split changes neither: OCF records a change of authorized shares as an adjustment.
 * - The issuer: the outstanding shares of every class on D, together, against `new_shares_authorized` of the latest
 *   `TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT` dated on or before D (`transactions/adjustment/IssuerAuthorizedSharesAdjustment`),
 *   else the issuer's `initial_shares_authorized` (`Issuer`; absent, no ceiling).
 * - The pool of plan P on D: the reserve is `shares_reserved` of the latest `TX_STOCK_PLAN_POOL_ADJUSTMENT` of P dated
 *   on or before D ("the number of shares reserved in the pool ... as of the effective date of this pool adjustment",
 *   `transactions/adjustment/StockPlanPoolAdjustment`), else P's `initial_shares_reserved` (`StockPlan`); plus the
 *   `quantity` of each `TX_STOCK_PLAN_RETURN_TO_POOL` into P dated after that and on or before D of a security issued
 *   from another plan (or none), less each one out of P into another plan
 *   (`transactions/return_to_pool/StockPlanReturnToPool`: the pool "does not have to be the same pool the securities
 *   were issued from"). The pool's use is the remaining quantity of every equity-compensation grant under P not yet
 *   retired (its quantity less exercises and releases; a cancellation, transfer or retraction retires it, and its
 *   balance or resulting grants count on their own), plus every outstanding stock security issued under P
 *   (`stock_plan_id`). A retired grant's shares leave the pool's use when it retires, as apiv2's plan accounting reads
 *   cancellations, so a return into the plan the security came from changes nothing. A one-class plan's reserve and
 *   returns follow its class's splits from their dates (the plan's board approval date for the initial reserve; none
 *   known, as recorded); a grant follows its class (`stock_class_id`, else its plan's only class).
 *
 * A check refuses only what the write makes worse: the excess over a ceiling after the write must be no larger than
 * before it, so a book already over a ceiling still takes the cancellations and adjustments that cure it.
 */

import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type {
  RecordedSplit,
  RegisterCheckRule,
  RegisterCheckViolation,
  StockSecurityState,
} from '../../types/register';
import { fromUnits, toUnits } from '../numeric';
import { scaleQuantityAcross } from '../splits';
import { recordDate, textField, textList, type BookSide, type CheckedWrite, type CheckRecord } from './book';
import { trackInstrument } from './instruments';

/** OCF's `AuthorizedShares` values (and the Daml-style spelling), which set no ceiling. */
const UNBOUNDED: ReadonlySet<string> = new Set(['UNLIMITED', 'NOT APPLICABLE', 'NOT_APPLICABLE']);

/** The records that bound or fill a stock class, by the field that names it. */
const CLASS_FIELDS: Readonly<Partial<Record<OcfEntityType, string>>> = {
  stockClass: 'id',
  stockClassAuthorizedSharesAdjustment: 'stock_class_id',
  stockClassSplit: 'stock_class_id',
  stockIssuance: 'stock_class_id',
};

/** The records that bound or fill a stock plan's pool, by the field that names it. */
const PLAN_FIELDS: Readonly<Partial<Record<OcfEntityType, string>>> = {
  stockPlan: 'id',
  stockPlanPoolAdjustment: 'stock_plan_id',
  stockPlanReturnToPool: 'stock_plan_id',
  stockIssuance: 'stock_plan_id',
  equityCompensationIssuance: 'stock_plan_id',
};

/** The records that bound the issuer's authorized shares. */
const ISSUER_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'issuer',
  'issuerAuthorizedSharesAdjustment',
]);

/** A ceiling on one side of the write: its limit in units (`null` for none) and the record that set it. */
interface Ceiling {
  units: bigint | null;
  source: string;
}

/** What one side of the write puts against a ceiling. */
interface Measure {
  used: bigint;
  ceiling: Ceiling;
}

function ceilingOf(value: unknown, source: string): Ceiling {
  if (typeof value !== 'string' || value === '' || UNBOUNDED.has(value)) return { units: null, source };
  try {
    return { units: toUnits(value), source };
  } catch {
    // A value the ledger's codec accepted but the floor function cannot read: no ceiling the SDK can enforce.
    return { units: null, source };
  }
}

/** The latest record dated on or before `date`, by date then by the order written; `null` when none is. */
function latestOnOrBefore(records: readonly CheckRecord[], date: string): CheckRecord | null {
  let latest: CheckRecord | null = null;
  let latestDate = '';
  for (const record of records) {
    const recorded = recordDate(record);
    if (recorded === null || recorded > date) continue;
    if (latest === null || recorded > latestDate || (recorded === latestDate && record.order > latest.order)) {
      latest = record;
      latestDate = recorded;
    }
  }
  return latest;
}

function maxOf(dates: Iterable<string | null>): string | null {
  let max: string | null = null;
  for (const date of dates) if (date !== null && (max === null || date > max)) max = date;
  return max;
}

function scaled(state: StockSecurityState, splits: readonly RecordedSplit[], date: string): bigint {
  const from = state.last_event_date;
  return toUnits(
    from >= date || splits.length === 0 ? state.quantity : scaleQuantityAcross(state.quantity, splits, from, date)
  );
}

function outstanding(states: readonly StockSecurityState[], splits: readonly RecordedSplit[], date: string): bigint {
  let total = 0n;
  for (const state of states) total += scaled(state, splits, date);
  return total;
}

/** By how much a measure exceeds its ceiling; `null` when it is within it or has none. */
function excess(measure: Measure): bigint | null {
  const { units } = measure.ceiling;
  return units === null || measure.used <= units ? null : measure.used - units;
}

/** Whether the write makes the excess over a ceiling grow. */
function worsens(before: Measure, after: Measure): boolean {
  const over = excess(after);
  if (over === null) return false;
  const was = excess(before);
  return was === null || over > was;
}

/** The records of one kind on a side that name a subject in a field. */
function recordsFor(side: BookSide, entityType: OcfEntityType, field: string, subject: string): CheckRecord[] {
  return side.recordsOf(entityType).filter((record) => textField(record, field) === subject);
}

function violation(
  rule: RegisterCheckRule,
  subject: string,
  message: string,
  operation: number | null,
  recordIds: string[]
): RegisterCheckViolation {
  return { check: 'ceilings', rule, message, subject, operation, recordIds };
}

function ceilingMessage(what: string, used: string, date: string, ceiling: Ceiling, limit: string): string {
  return `${what} would have ${used} on ${date}, over its ${fromUnits(ceiling.units ?? 0n)} ${limit} (${ceiling.source})`;
}

/** The write's records and states, grouped by what they touch. */
interface Touched {
  /** By stock class: the dates of the write's records in it and the first operation touching it */
  classes: Map<string, { dates: string[]; operation: number | null; recordIds: string[] }>;
  plans: Map<string, { dates: string[]; operation: number | null; recordIds: string[] }>;
  issuer: { touched: boolean; dates: string[]; operation: number | null; recordIds: string[] };
}

function touch(
  map: Touched['classes'],
  subject: string | null,
  date: string | null,
  operation: number | null,
  recordId: string | null
): void {
  if (subject === null) return;
  let entry = map.get(subject);
  if (entry === undefined) {
    entry = { dates: [], operation, recordIds: [] };
    map.set(subject, entry);
  }
  entry.operation ??= operation;
  if (date !== null) entry.dates.push(date);
  if (recordId !== null && !entry.recordIds.includes(recordId)) entry.recordIds.push(recordId);
}

/** The plan a security was issued under, on a side: its issuance's `stock_plan_id`. */
function planOfSecurity(side: BookSide, securityId: string): string | null {
  const issuance = side
    .recordsNaming(securityId)
    .find(
      (record) =>
        textField(record, 'security_id') === securityId &&
        (record.entityType === 'stockIssuance' || record.entityType === 'equityCompensationIssuance')
    );
  return issuance === undefined ? null : textField(issuance, 'stock_plan_id');
}

function collectTouched(write: CheckedWrite): Touched {
  const touched: Touched = {
    classes: new Map(),
    plans: new Map(),
    issuer: { touched: false, dates: [], operation: null, recordIds: [] },
  };
  for (const { before, after, operation } of write.touchedRecords()) {
    for (const [record, side] of [
      [before, write.before],
      [after, write.after],
    ] as const) {
      if (record === null) continue;
      const date = recordDate(record);
      const { objectId } = record;
      const classField = CLASS_FIELDS[record.entityType];
      if (classField !== undefined) touch(touched.classes, textField(record, classField), date, operation, objectId);
      const planField = PLAN_FIELDS[record.entityType];
      if (planField !== undefined) touch(touched.plans, textField(record, planField), date, operation, objectId);
      // A return to pool, and an event on equity compensation, change the pool its security came from.
      const security = textField(record, 'security_id');
      const fromPlan =
        record.entityType === 'stockPlanReturnToPool' ||
        (record.entityType !== 'equityCompensationIssuance' && record.objectType.startsWith('TX_EQUITY_COMPENSATION_'));
      if (fromPlan && security !== null) {
        touch(touched.plans, planOfSecurity(side, security), date, operation, objectId);
      }
      if (ISSUER_RECORDS.has(record.entityType)) {
        touched.issuer.touched = true;
        if (date !== null) touched.issuer.dates.push(date);
        touched.issuer.operation ??= operation;
        touched.issuer.recordIds.push(objectId);
      }
    }
  }
  // Every stock state the write creates, changes or ends counts in its class, before and after.
  for (const [securityId, state] of write.changedStates()) {
    for (const current of [write.before.state(securityId), state]) {
      if (current === null) continue;
      touch(touched.classes, current.stock_class_id, current.last_event_date, null, null);
      const plan =
        planOfSecurity(write.after, current.security_id) ?? planOfSecurity(write.before, current.security_id);
      touch(touched.plans, plan, current.last_event_date, null, null);
    }
  }
  return touched;
}

// ----- Classes -----

function classAuthorized(side: BookSide, stockClassId: string, date: string): Ceiling {
  const adjustment = latestOnOrBefore(
    recordsFor(side, 'stockClassAuthorizedSharesAdjustment', 'stock_class_id', stockClassId),
    date
  );
  if (adjustment !== null) return ceilingOf(adjustment.data.new_shares_authorized, adjustment.objectId);
  const stockClass = side.record(stockClassId);
  return stockClass?.entityType === 'stockClass'
    ? ceilingOf(stockClass.data.initial_shares_authorized, stockClassId)
    : { units: null, source: stockClassId };
}

function checkClass(
  write: CheckedWrite,
  stockClassId: string,
  touched: { dates: string[]; operation: number | null; recordIds: string[] }
): RegisterCheckViolation | null {
  const beforeStates = write.before.statesOfClass(stockClassId);
  const afterStates = write.after.statesOfClass(stockClassId);
  const date = maxOf([
    ...touched.dates,
    ...beforeStates.map((state) => state.last_event_date),
    ...afterStates.map((state) => state.last_event_date),
  ]);
  if (date === null) return null;
  const after: Measure = {
    used: outstanding(afterStates, write.after.splits(stockClassId), date),
    ceiling: classAuthorized(write.after, stockClassId, date),
  };
  const before: Measure = {
    used: outstanding(beforeStates, write.before.splits(stockClassId), date),
    ceiling: classAuthorized(write.before, stockClassId, date),
  };
  if (!worsens(before, after)) return null;
  return violation(
    'class_ceiling',
    stockClassId,
    ceilingMessage(
      `Stock class ${stockClassId}`,
      `${fromUnits(after.used)} shares outstanding`,
      date,
      after.ceiling,
      'authorized shares'
    ),
    touched.operation,
    touched.recordIds
  );
}

// ----- The issuer -----

function issuerAuthorized(side: BookSide, date: string): Ceiling {
  const adjustment = latestOnOrBefore(side.recordsOf('issuerAuthorizedSharesAdjustment'), date);
  if (adjustment !== null) return ceilingOf(adjustment.data.new_shares_authorized, adjustment.objectId);
  const [issuer] = side.recordsOf('issuer');
  return issuer === undefined
    ? { units: null, source: 'issuer' }
    : ceilingOf(issuer.data.initial_shares_authorized, issuer.objectId);
}

function bookOutstanding(side: BookSide, states: readonly StockSecurityState[], date: string): bigint {
  const splits = new Map<string, readonly RecordedSplit[]>();
  let total = 0n;
  for (const state of states) {
    let classSplits = splits.get(state.stock_class_id);
    if (classSplits === undefined) {
      classSplits = side.splits(state.stock_class_id);
      splits.set(state.stock_class_id, classSplits);
    }
    total += scaled(state, classSplits, date);
  }
  return total;
}

/** Whether a side can bound the issuer at all: a finite initial ceiling, or any adjustment. */
function issuerBounded(side: BookSide): boolean {
  const [issuer] = side.recordsOf('issuer');
  if (issuer !== undefined && ceilingOf(issuer.data.initial_shares_authorized, '').units !== null) return true;
  return side.recordsOf('issuerAuthorizedSharesAdjustment').length > 0;
}

function checkIssuer(write: CheckedWrite, touched: Touched): RegisterCheckViolation | null {
  if (!touched.issuer.touched && touched.classes.size === 0) return null;
  // The sum runs over every state of the book: skip it when no ceiling can bind.
  if (!issuerBounded(write.after)) return null;
  const beforeStates = write.before.states();
  const afterStates = write.after.states();
  const date = maxOf([
    ...touched.issuer.dates,
    ...[...touched.classes.values()].flatMap((entry) => entry.dates),
    ...beforeStates.map((state) => state.last_event_date),
    ...afterStates.map((state) => state.last_event_date),
  ]);
  if (date === null) return null;
  const after: Measure = {
    used: bookOutstanding(write.after, afterStates, date),
    ceiling: issuerAuthorized(write.after, date),
  };
  const before: Measure = {
    used: bookOutstanding(write.before, beforeStates, date),
    ceiling: issuerAuthorized(write.before, date),
  };
  if (!worsens(before, after)) return null;
  const [first] = [...touched.classes.values()];
  const issuerId = write.after.recordsOf('issuer')[0]?.objectId ?? 'issuer';
  return violation(
    'issuer_ceiling',
    issuerId,
    ceilingMessage(
      'The issuer',
      `${fromUnits(after.used)} shares outstanding in all classes`,
      date,
      after.ceiling,
      'authorized shares'
    ),
    touched.issuer.operation ?? first?.operation ?? null,
    [...touched.issuer.recordIds, ...(first?.recordIds ?? [])]
  );
}

// ----- Plan pools -----

/** The plan's only class, whose splits its reserve follows; `null` for a plan of several. */
function planClass(plan: CheckRecord): string | null {
  const classes = textList(plan, 'stock_class_ids');
  return classes.length === 1 ? (classes[0] ?? null) : null;
}

function scaleFrom(quantity: string, splits: readonly RecordedSplit[], from: string | null, to: string): bigint {
  return toUnits(
    from === null || from >= to || splits.length === 0 ? quantity : scaleQuantityAcross(quantity, splits, from, to)
  );
}

function planReserve(side: BookSide, plan: CheckRecord, date: string): Ceiling {
  const planId = plan.objectId;
  const stockClassId = planClass(plan);
  const splits = stockClassId === null ? [] : side.splits(stockClassId);
  const adjustment = latestOnOrBefore(recordsFor(side, 'stockPlanPoolAdjustment', 'stock_plan_id', planId), date);
  const base = adjustment ?? plan;
  const baseValue = adjustment === null ? plan.data.initial_shares_reserved : adjustment.data.shares_reserved;
  const baseDate = adjustment === null ? recordDate(plan, 'board_approval_date') : recordDate(adjustment);
  if (typeof baseValue !== 'string') return { units: null, source: base.objectId };
  let units: bigint;
  try {
    units = scaleFrom(baseValue, splits, baseDate, date);
  } catch {
    return { units: null, source: base.objectId };
  }
  for (const returned of side.recordsOf('stockPlanReturnToPool')) {
    const returnedOn = recordDate(returned);
    const { quantity } = returned.data;
    if (returnedOn === null || returnedOn > date || typeof quantity !== 'string') continue;
    if (baseDate !== null && adjustment !== null && returnedOn <= baseDate) continue;
    const into = textField(returned, 'stock_plan_id');
    const security = textField(returned, 'security_id');
    const from = security === null ? null : planOfSecurity(side, security);
    if (into === from) continue;
    if (into === planId) units += scaleFrom(quantity, splits, returnedOn, date);
    else if (from === planId) units -= scaleFrom(quantity, splits, returnedOn, date);
  }
  return { units, source: base.objectId };
}

/** The pool's use on a side: unretired grants' remaining quantities and outstanding plan stock, in D's units. */
function planUse(side: BookSide, planId: string, date: string): bigint {
  let used = 0n;
  for (const grant of recordsFor(side, 'equityCompensationIssuance', 'stock_plan_id', planId)) {
    const securityId = textField(grant, 'security_id');
    const tracked = securityId === null ? null : trackInstrument(side, securityId);
    if (tracked?.state.retired !== null) continue;
    const remaining = tracked.state.remainingQuantity;
    if (remaining === null || toUnits(remaining) <= 0n) continue;
    const splits = tracked.stockClassId === null ? [] : side.splits(tracked.stockClassId);
    used += scaleFrom(remaining, splits, tracked.lastDate, date);
  }
  for (const issuance of recordsFor(side, 'stockIssuance', 'stock_plan_id', planId)) {
    const securityId = textField(issuance, 'security_id');
    const state = securityId === null ? null : side.state(securityId);
    if (state !== null) used += scaled(state, side.splits(state.stock_class_id), date);
  }
  return used;
}

function planDates(side: BookSide, planId: string): string[] {
  const dates: string[] = [];
  for (const grant of recordsFor(side, 'equityCompensationIssuance', 'stock_plan_id', planId)) {
    const securityId = textField(grant, 'security_id');
    const tracked = securityId === null ? null : trackInstrument(side, securityId);
    if (tracked !== null) dates.push(tracked.lastDate);
  }
  for (const issuance of recordsFor(side, 'stockIssuance', 'stock_plan_id', planId)) {
    const securityId = textField(issuance, 'security_id');
    const state = securityId === null ? null : side.state(securityId);
    if (state !== null) dates.push(state.last_event_date);
  }
  return dates;
}

function checkPlan(
  write: CheckedWrite,
  planId: string,
  touched: { dates: string[]; operation: number | null; recordIds: string[] }
): RegisterCheckViolation | null {
  const planAfter = write.after.record(planId);
  if (planAfter?.entityType !== 'stockPlan') return null;
  const date = maxOf([...touched.dates, ...planDates(write.before, planId), ...planDates(write.after, planId)]);
  if (date === null) return null;
  const planBefore = write.before.record(planId);
  const after: Measure = {
    used: planUse(write.after, planId, date),
    ceiling: planReserve(write.after, planAfter, date),
  };
  const before: Measure = {
    used: planUse(write.before, planId, date),
    ceiling:
      planBefore?.entityType === 'stockPlan'
        ? planReserve(write.before, planBefore, date)
        : { units: null, source: planId },
  };
  if (!worsens(before, after)) return null;
  return violation(
    'plan_pool',
    planId,
    ceilingMessage(
      `Stock plan ${planId}`,
      `${fromUnits(after.used)} shares granted or issued from its pool`,
      date,
      after.ceiling,
      'shares reserved'
    ),
    touched.operation,
    touched.recordIds
  );
}

/**
 * The ceilings check of a write: each stock class whose stock or authorized shares it changes, the issuer when it
 * changes any of them or the issuer's authorized shares, and each plan whose pool or grants it changes.
 */
export function checkCeilings(write: CheckedWrite): RegisterCheckViolation[] {
  if (write.write.kind !== 'apply' && write.write.kind !== 'restate') return [];
  const touched = collectTouched(write);
  const violations: RegisterCheckViolation[] = [];
  for (const [stockClassId, entry] of touched.classes) {
    const found = checkClass(write, stockClassId, entry);
    if (found !== null) violations.push(found);
  }
  const issuer = checkIssuer(write, touched);
  if (issuer !== null) violations.push(issuer);
  for (const [planId, entry] of touched.plans) {
    const found = checkPlan(write, planId, entry);
    if (found !== null) violations.push(found);
  }
  return violations;
}
