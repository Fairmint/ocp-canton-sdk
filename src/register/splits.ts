/**
 * Lazy application of a class's recorded splits to one stock state at its next event, the units rule, reader-side
 * scaling and settlement holds voided by a split (a port of `Fairmint.OpenCapTable.Splits` and the hold queries of
 * `Fairmint.OpenCapTable.State`).
 *
 * A split touches no stock state when it is recorded. Each state applies it at its next event; untouched states and
 * equity compensation keep pre-split quantities, which readers scale on read with {@link scaleQuantityAcross}.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Splits.daml
 */

import type { Vesting } from '../types/native';
import type { OpenHold, RecordedSplit, RegisterResult, SplitRatio, StockSecurityState } from '../types/register';
import { maxDate, requireDate } from './dates';
import { floorMulDivUnits, fromUnits, scaleByRatio, toUnits } from './numeric';

/**
 * The number of the class's splits dated on or before a date. The epoch's splits are in date order, so the count
 * stops at the first split dated after it.
 */
export function splitsOnOrBefore(splits: readonly RecordedSplit[], date: string): number {
  requireDate(date, 'date');
  let count = 0;
  for (const split of splits) {
    if (split.date > date) break;
    count++;
  }
  return count;
}

/** The splits dated after `fromExclusive` and on or before `toInclusive`, in date order. */
export function splitsDatedIn(
  splits: readonly RecordedSplit[],
  fromExclusive: string,
  toInclusive: string
): RecordedSplit[] {
  requireDate(fromExclusive, 'fromExclusive');
  requireDate(toInclusive, 'toInclusive');
  return splits.filter((split) => split.date > fromExclusive && split.date <= toInclusive);
}

/**
 * The split epoch of a record dated `recordDate` under the units rule: a split dated D applies to records dated
 * before D, and records dated D or later are already in post-split units, so a record is in the units of the class's
 * splits dated on or before its date.
 */
export function unitsEpochOf(recordDate: string, splits: readonly RecordedSplit[]): number {
  return splitsOnOrBefore(splits, recordDate);
}

/**
 * Scales tranches cumulatively by a split ratio: the running totals are scaled and floored, then differenced, and
 * tranches that floor to zero are dropped. So the scaled schedule never vests more by any date than the floor of the
 * scaled original.
 */
export function scaleTranches(ratio: SplitRatio, tranches: readonly Vesting[]): Vesting[] {
  const numerator = toUnits(ratio.numerator, 'ratio.numerator');
  const denominator = toUnits(ratio.denominator, 'ratio.denominator');
  const scaled: Vesting[] = [];
  let total = 0n;
  let scaledBefore = 0n;
  for (const [index, tranche] of tranches.entries()) {
    total += toUnits(tranche.amount, `tranches[${index}].amount`);
    const scaledTotal = floorMulDivUnits(total, numerator, denominator, 'scaleTranches');
    const amount = scaledTotal - scaledBefore;
    scaledBefore = scaledTotal;
    if (amount > 0n) scaled.push({ date: tranche.date, amount: fromUnits(amount) });
  }
  return scaled;
}

function applyOne(split: RecordedSplit, state: StockSecurityState): RegisterResult<StockSecurityState> {
  const quantity = scaleByRatio(split.ratio, state.quantity);
  if (toUnits(quantity) <= 0n) {
    return {
      ok: false,
      message: `split ${split.split_id} floors security ${state.security_id} to zero; retire the fraction with a record dated before the split`,
    };
  }
  let { vesting } = state;
  if (vesting.kind === 'tranches') {
    const tranches = scaleTranches(split.ratio, vesting.tranches);
    if (tranches.length === 0) {
      return {
        ok: false,
        message: `split ${split.split_id} floors every vesting tranche of security ${state.security_id} to zero`,
      };
    }
    vesting = { kind: 'tranches', tranches };
  }
  return {
    ok: true,
    value: {
      ...state,
      quantity,
      vesting,
      snapshot:
        state.snapshot === null
          ? null
          : { ...state.snapshot, vested: scaleByRatio(split.ratio, state.snapshot.vested) },
      accelerated_since_snapshot:
        state.accelerated_since_snapshot === null ? null : scaleByRatio(split.ratio, state.accelerated_since_snapshot),
    },
  };
}

/**
 * Brings a state to an event dated `date`, exactly as the ledger does before every event on it. The state's
 * `split_epoch` must equal the number of the class's splits dated on or before its `last_event_date` (a stale one
 * fails closed); then every split dated after its last event and on or before `date` is applied in date order,
 * scaling the quantity, the tranches (cumulatively) and the snapshot and `accelerated_since_snapshot` with the shared
 * floor function. Hold quantities are never scaled: a split voids a settlement hold instead. The result is dated
 * max(`date`, `last_event_date`), because vesting starts and events may be backdated.
 *
 * @returns the state brought to the date, or the ledger's refusal: a stale epoch, or a split that floors the quantity
 *   or every tranche to zero
 */
export function applySplits(
  splits: readonly RecordedSplit[],
  date: string,
  state: StockSecurityState
): RegisterResult<StockSecurityState> {
  requireDate(date, 'date');
  const expected = splitsOnOrBefore(splits, state.last_event_date);
  if (state.split_epoch !== expected) {
    return {
      ok: false,
      message: `stale split epoch on security ${state.security_id}: ${state.split_epoch}, the class has ${expected} splits dated on or before ${state.last_event_date}`,
    };
  }
  const lastEventDate = maxDate(date, state.last_event_date);
  let scaled = state;
  for (const split of splitsDatedIn(splits, state.last_event_date, lastEventDate)) {
    const step = applyOne(split, scaled);
    if (!step.ok) return step;
    scaled = step.value;
  }
  return {
    ok: true,
    value: { ...scaled, last_event_date: lastEventDate, split_epoch: splitsOnOrBefore(splits, lastEventDate) },
  };
}

/**
 * Reader-side scaling: a quantity in the units of `fromExclusive` brought to the units of `toInclusive`, applying
 * each split dated in between in date order with the shared floor function, step by step as the ledger applies them
 * (never a product of the ratios). For a state no event has touched since a split, read at its `last_event_date`,
 * and for equity compensation, read through its class. A result of 0 is one the ledger refuses at the state's next
 * event.
 */
export function scaleQuantityAcross(
  quantity: string,
  splits: readonly RecordedSplit[],
  fromExclusive: string,
  toInclusive: string
): string {
  let units = toUnits(quantity, 'quantity');
  for (const split of splitsDatedIn(splits, fromExclusive, toInclusive)) {
    units = floorMulDivUnits(
      units,
      toUnits(split.ratio.numerator, 'ratio.numerator'),
      toUnits(split.ratio.denominator, 'ratio.denominator'),
      'scaleQuantityAcross'
    );
  }
  return fromUnits(units);
}

/** A state's settlement holds, current or voided. */
export function settlementHolds(state: StockSecurityState): OpenHold[] {
  return state.holds.filter((hold) => hold.hold_type === 'REGISTER_SETTLEMENT');
}

/** A state's stops. */
export function stopHolds(state: StockSecurityState): OpenHold[] {
  return state.holds.filter((hold) => hold.hold_type === 'STOP_TRANSFER');
}

/** A security is stopped while it carries an open `STOP_TRANSFER` hold. */
export function isStopped(state: StockSecurityState): boolean {
  return state.holds.some((hold) => hold.hold_type === 'STOP_TRANSFER');
}

/** A hold is current unless a split the state has applied voided it. */
export function isCurrentHold(state: StockSecurityState, hold: OpenHold): boolean {
  return hold.split_epoch === state.split_epoch;
}

/** The hold open on a state under a hold ID, or `null`. */
export function findHold(holdId: string, state: StockSecurityState): OpenHold | null {
  const found = state.holds.filter((hold) => hold.hold_id === holdId);
  return found.length === 1 && found[0] !== undefined ? found[0] : null;
}

/**
 * Whether a split voids a hold for a draw dated `asOf`: a `REGISTER_SETTLEMENT` hold can be drawn only while the
 * class's splits dated on or before the draw's date are those of its own `split_epoch`, so a split dated on or before
 * `asOf` and after the hold's date voids it. A voided hold keeps its quantity and its slot until the TA cancels it.
 * A stop is never voided.
 */
export function isVoidedHold(hold: OpenHold, splits: readonly RecordedSplit[], asOf: string): boolean {
  return hold.hold_type === 'REGISTER_SETTLEMENT' && hold.split_epoch !== splitsOnOrBefore(splits, asOf);
}
