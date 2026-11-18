/**
 * The vesting rules the register enforces on stock states: vested quantities, draws from the earliest vested
 * tranches, accelerations, and outputs that never vest ahead of their source (a port of
 * `Fairmint.OpenCapTable.VestingState` and the vesting queries of `Fairmint.OpenCapTable.State`).
 *
 * Quantities are computed exactly in units of 10^-10, and a refusal carries the ledger's own message.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/VestingState.daml
 */

import type { Vesting } from '../types/native';
import type {
  OutputVesting,
  RegisterCheckResult,
  RegisterResult,
  StockSecurityState,
  StockVesting,
} from '../types/register';
import { addDays, requireDate } from './dates';
import { fromUnits, showDaml, toUnits } from './numeric';

interface UnitTranche {
  date: string;
  amount: bigint;
}

interface UnitOutput {
  quantity: bigint;
  vestings: UnitTranche[];
  onTerms: boolean;
}

/** A cumulative vested amount from a date `d` on: its value at `d` and its increases at later dates. */
interface VestingSteps {
  atD: bigint;
  increases: Array<[string, bigint]>;
}

interface VestingFailure {
  date: string;
  source: bigint;
  output: bigint;
}

const CHECK_PASSED: RegisterCheckResult = { ok: true };

function toUnitTranches(tranches: readonly Vesting[], fieldPath: string): UnitTranche[] {
  return tranches.map((tranche, index) => ({
    date: requireDate(tranche.date, `${fieldPath}[${index}].date`),
    amount: toUnits(tranche.amount, `${fieldPath}[${index}].amount`),
  }));
}

function fromUnitTranches(tranches: readonly UnitTranche[]): Vesting[] {
  return tranches.map((tranche) => ({ date: tranche.date, amount: fromUnits(tranche.amount) }));
}

function toUnitOutput(output: OutputVesting, fieldPath: string): UnitOutput {
  return {
    quantity: toUnits(output.quantity, `${fieldPath}.quantity`),
    vestings: toUnitTranches(output.vestings, `${fieldPath}.vestings`),
    onTerms: output.on_terms,
  };
}

function totalOf(tranches: readonly UnitTranche[]): bigint {
  return tranches.reduce((total, tranche) => total + tranche.amount, 0n);
}

function vestedByUnits(date: string, tranches: readonly UnitTranche[]): bigint {
  return totalOf(tranches.filter((tranche) => tranche.date <= date));
}

function sortUnitTranches(tranches: readonly UnitTranche[]): UnitTranche[] {
  return [...tranches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function vestedAtUnits(state: StockSecurityState, date: string): bigint {
  switch (state.vesting.kind) {
    case 'none':
      return toUnits(state.quantity, 'state.quantity');
    case 'tranches':
      return vestedByUnits(date, toUnitTranches(state.vesting.tranches, 'state.vesting.tranches'));
    case 'on_terms':
      return state.snapshot === null ? 0n : toUnits(state.snapshot.vested, 'state.snapshot.vested');
  }
}

/** The total amount of explicit tranches. */
export function trancheTotal(tranches: readonly Vesting[]): string {
  return fromUnits(totalOf(toUnitTranches(tranches, 'tranches')));
}

/** Whether a security vests on vesting terms, its vested quantity the TA's snapshot. */
export function isOnTerms(vesting: StockVesting): boolean {
  return vesting.kind === 'on_terms';
}

/** The amount of explicit tranches dated on or before a date. */
export function vestedBy(date: string, tranches: readonly Vesting[]): string {
  return fromUnits(vestedByUnits(requireDate(date, 'date'), toUnitTranches(tranches, 'tranches')));
}

/**
 * Vested shares at a date: all of them with no vesting, the tranches dated on or before it, or the snapshot's vested
 * quantity on vesting terms (none without a snapshot).
 */
export function vestedAt(state: StockSecurityState, date: string): string {
  return fromUnits(vestedAtUnits(state, requireDate(date, 'date')));
}

/**
 * Whether explicit tranches, if any, cover the whole quantity. A security whose tranches cover less takes no
 * settlement hold, draw or partial terminal event.
 */
export function fullyCovered(state: StockSecurityState): boolean {
  if (state.vesting.kind !== 'tranches') return true;
  return (
    totalOf(toUnitTranches(state.vesting.tranches, 'state.vesting.tranches')) ===
    toUnits(state.quantity, 'state.quantity')
  );
}

/** Tranches in date order; tranches of one date keep their order. */
export function sortTranches(tranches: readonly Vesting[]): Vesting[] {
  return fromUnitTranches(sortUnitTranches(toUnitTranches(tranches, 'tranches')));
}

function drawSorted(quantity: bigint, tranches: readonly UnitTranche[]): UnitTranche[] {
  let remaining = quantity;
  for (const [index, tranche] of tranches.entries()) {
    if (remaining <= 0n) return tranches.slice(index);
    if (tranche.amount > remaining) {
      return [{ date: tranche.date, amount: tranche.amount - remaining }, ...tranches.slice(index + 1)];
    }
    remaining -= tranche.amount;
  }
  return [];
}

/**
 * Takes `quantity` from the earliest tranches, in date order, dropping emptied tranches. A partial settlement draw
 * takes vested shares this way, so the balance keeps the later tranches.
 */
export function drawTranches(quantity: string, tranches: readonly Vesting[]): Vesting[] {
  return fromUnitTranches(
    drawSorted(toUnits(quantity, 'quantity'), sortUnitTranches(toUnitTranches(tranches, 'tranches')))
  );
}

/**
 * Accelerates `quantity` shares of a tranche lot at `date`: requires 0 < quantity <= the state's quantity − vested
 * by `date`, and moves the quantity to `date` from the earliest tranches dated after it, then, if those are short,
 * from the shares no tranche covers. Taking the earliest unvested tranches first never overstates vested shares at
 * any later date.
 *
 * @returns the accelerated tranches, or the ledger's refusal when the quantity is out of bounds
 */
export function accelerateTranches(
  date: string,
  quantity: string,
  state: StockSecurityState,
  tranches: readonly Vesting[]
): RegisterResult<Vesting[]> {
  requireDate(date, 'date');
  const q = toUnits(quantity, 'quantity');
  const sorted = sortUnitTranches(toUnitTranches(tranches, 'tranches'));
  const unvested = toUnits(state.quantity, 'state.quantity') - vestedByUnits(date, sorted);
  if (q <= 0n || q > unvested) {
    return {
      ok: false,
      message: `acceleration of ${showDaml(q)} on security ${state.security_id} must be positive and at most its unvested quantity ${showDaml(unvested)}`,
    };
  }
  const onOrBefore = sorted.filter((tranche) => tranche.date <= date);
  const later = sorted.filter((tranche) => tranche.date > date);
  const after = drawSorted(q, later);
  const atDate = totalOf(onOrBefore.filter((tranche) => tranche.date === date)) + q;
  const before = onOrBefore.filter((tranche) => tranche.date < date);
  return { ok: true, value: fromUnitTranches([...before, { date, amount: atDate }, ...after]) };
}

// Cumulative vested quantity of an output at a date: its explicit tranches dated on or before it, nothing on vesting
// terms, everything if it carries no vesting.
function outputVestedBy(date: string, output: UnitOutput): bigint {
  if (output.vestings.length > 0) return vestedByUnits(date, output.vestings);
  return output.onTerms ? 0n : output.quantity;
}

function trancheSteps(date: string, tranches: readonly UnitTranche[]): VestingSteps {
  return {
    atD: vestedByUnits(date, tranches),
    increases: tranches.filter((tranche) => tranche.date > date).map((tranche) => [tranche.date, tranche.amount]),
  };
}

function outputSteps(date: string, output: UnitOutput): VestingSteps {
  if (output.vestings.length > 0) return trancheSteps(date, output.vestings);
  return { atD: output.onTerms ? 0n : output.quantity, increases: [] };
}

// The first date from `date` on at which `bad` holds of the sources' and the outputs' cumulative vested amounts, with
// both: `date` itself, then each later date either changes on, in one sweep over the sorted changes.
function firstVestingFailure(
  bad: (source: bigint, output: bigint) => boolean,
  date: string,
  sources: readonly VestingSteps[],
  outputs: readonly VestingSteps[]
): VestingFailure | null {
  let source = sources.reduce((total, steps) => total + steps.atD, 0n);
  let output = outputs.reduce((total, steps) => total + steps.atD, 0n);
  if (bad(source, output)) return { date, source, output };
  const changes: Array<[string, bigint, bigint]> = [
    ...sources.flatMap((steps) => steps.increases.map(([t, a]): [string, bigint, bigint] => [t, a, 0n])),
    ...outputs.flatMap((steps) => steps.increases.map(([t, a]): [string, bigint, bigint] => [t, 0n, a])),
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  // Each date is checked once all of its changes are counted.
  let current: string | null = null;
  for (const [changeDate, sourceIncrease, outputIncrease] of changes) {
    if (current !== null && changeDate !== current && bad(source, output)) return { date: current, source, output };
    current = changeDate;
    source += sourceIncrease;
    output += outputIncrease;
  }
  if (current !== null && bad(source, output)) return { date: current, source, output };
  return null;
}

/**
 * No output of a terminal event becomes more vested than its sources at any date from the event on. At the event
 * date the outputs together vest at most what the sources have vested; at every later tranche date of a source or an
 * output, at most what the sources will have vested by then (a source on vesting terms counts at most its whole
 * quantity after the event date, since its schedule is the TA's). Outputs in another class (conversions) are not
 * passed in: their units differ and the arithmetic is the writer's.
 *
 * @param label names the event in the refusal, as the ledger's does
 * @returns the ledger's refusal at the first date an output vests ahead
 */
export function checkOutputsVesting(
  date: string,
  label: string,
  sources: readonly StockSecurityState[],
  outputs: readonly OutputVesting[]
): RegisterCheckResult {
  requireDate(date, 'date');
  const sourceSteps = sources.map((state): VestingSteps => {
    const quantity = toUnits(state.quantity, 'state.quantity');
    switch (state.vesting.kind) {
      case 'tranches':
        return trancheSteps(date, toUnitTranches(state.vesting.tranches, 'state.vesting.tranches'));
      case 'none':
        return { atD: quantity, increases: [] };
      case 'on_terms': {
        const vested = vestedAtUnits(state, date);
        return { atD: vested, increases: [[addDays(date, 1), quantity - vested]] };
      }
    }
  });
  const failure = firstVestingFailure(
    (source, output) => output > source,
    date,
    sourceSteps,
    outputs.map((output, index) => outputSteps(date, toUnitOutput(output, `outputs[${index}]`)))
  );
  if (failure === null) return CHECK_PASSED;
  return {
    ok: false,
    message: `the outputs of ${label} vest ${showDaml(failure.output)} shares by ${failure.date}, more than the ${showDaml(failure.source)} their source has vested by then`,
  };
}

/**
 * A free transfer conserves vesting, beyond never vesting ahead of its source. From a lot with tranches or no
 * vesting, it splits tranches, so each date's cumulative vested amount is the same for the outputs together as for
 * the source at the event date and every later tranche date; no output replaces tranches with vesting terms. From a
 * lot on vesting terms, the balance's tranches dated on or before the event equal the vested quantity it keeps: the
 * source's vested quantity less what the resulting issuances vest at the event date. A whole transfer from such a
 * lot leaves no balance.
 *
 * @param balance the balance issuance's vesting, or `null` when the transfer leaves no balance
 * @returns the ledger's refusal when the outputs do not conserve the source's vesting
 */
export function checkTransferVesting(
  date: string,
  label: string,
  state: StockSecurityState,
  resulting: readonly OutputVesting[],
  balance: OutputVesting | null
): RegisterCheckResult {
  requireDate(date, 'date');
  const resultingUnits = resulting.map((output, index) => toUnitOutput(output, `resulting[${index}]`));
  const balanceUnits = balance === null ? null : toUnitOutput(balance, 'balance');
  if (state.vesting.kind === 'on_terms') {
    if (balanceUnits === null) return CHECK_PASSED;
    const kept =
      vestedAtUnits(state, date) - resultingUnits.reduce((total, output) => total + outputVestedBy(date, output), 0n);
    const balanceVested = vestedByUnits(date, balanceUnits.vestings);
    if (balanceVested === kept) return CHECK_PASSED;
    return {
      ok: false,
      message: `the balance of ${label} vests ${showDaml(balanceVested)} shares by ${date}, but keeps ${showDaml(kept)} vested shares of security ${state.security_id}`,
    };
  }
  const outputs = balanceUnits === null ? resultingUnits : [...resultingUnits, balanceUnits];
  const source: VestingSteps =
    state.vesting.kind === 'tranches'
      ? trancheSteps(date, toUnitTranches(state.vesting.tranches, 'state.vesting.tranches'))
      : { atD: toUnits(state.quantity, 'state.quantity'), increases: [] };
  if (outputs.some((output) => output.onTerms)) {
    return {
      ok: false,
      message: `the outputs of ${label} split security ${state.security_id}'s tranches; none of them replaces them with vesting terms`,
    };
  }
  const failure = firstVestingFailure(
    (sourceVested, outputVested) => sourceVested !== outputVested,
    date,
    [source],
    outputs.map((output) => outputSteps(date, output))
  );
  if (failure === null) return CHECK_PASSED;
  return {
    ok: false,
    message: `the outputs of ${label} vest ${showDaml(failure.output)} shares by ${failure.date}, but security ${state.security_id} has vested ${showDaml(failure.source)} by then`,
  };
}

/**
 * A balance carries its remaining vesting as explicit tranches that sum to exactly its quantity when its source has
 * tranches or vesting terms, and no vesting when its source has none, so it can be audited from OCF alone.
 *
 * @returns the ledger's refusal when the balance's vesting does not match its source's
 */
export function checkBalanceVesting(state: StockSecurityState, balance: OutputVesting): RegisterCheckResult {
  const output = toUnitOutput(balance, 'balance');
  if (state.vesting.kind === 'none') {
    if (output.vestings.length === 0 && !output.onTerms) return CHECK_PASSED;
    return { ok: false, message: `the balance of fully vested security ${state.security_id} must carry no vesting` };
  }
  if (output.vestings.length > 0 && totalOf(output.vestings) === output.quantity) return CHECK_PASSED;
  return {
    ok: false,
    message: `the balance of security ${state.security_id} must carry explicit vestings that sum to its quantity ${showDaml(output.quantity)}`,
  };
}
