/**
 * The lifecycle of warrants, convertibles and equity compensation in the offline replay. The register keeps no state
 * for them (they cannot be held or traded), so the SDK checks their lifecycle: not exercised or converted twice, the
 * remaining quantity or amount, exercises on or before expiration, no repricing after retirement. The replay tracks
 * what those checks read; it refuses only what the ledger refuses, an event whose security no issuance of its
 * instrument carries.
 */

import type { InstrumentEvent, InstrumentKind, InstrumentState } from '../../types/register';
import { fromUnits, toUnits } from '../numeric';
import {
  readDate,
  readDecimal,
  readOptionalDate,
  readOptionalDecimal,
  readOptionalMonetary,
  readOptionalText,
  readText,
  readTextList,
  type ReplayRecord,
} from './records';

/** The instrument an issuance object type issues. */
export const INSTRUMENT_OF_ISSUANCE: Readonly<Record<string, InstrumentKind>> = {
  TX_WARRANT_ISSUANCE: 'warrant',
  TX_CONVERTIBLE_ISSUANCE: 'convertible',
  TX_EQUITY_COMPENSATION_ISSUANCE: 'equityCompensation',
};

/** How an instrument event changes its security, and what it measures. */
export interface InstrumentEventSpec {
  kind: InstrumentKind;
  /** The label the ledger's reference check names the event by */
  label: string;
  effect: InstrumentEvent['effect'];
  measure: 'quantity' | 'amount' | 'none';
}

function spec(
  kind: InstrumentKind,
  label: string,
  effect: InstrumentEvent['effect'],
  measure: InstrumentEventSpec['measure'] = 'none'
): InstrumentEventSpec {
  return { kind, label, effect, measure };
}

/** The events on warrants, convertibles and equity compensation, by object type. */
export const INSTRUMENT_EVENTS: Readonly<Record<string, InstrumentEventSpec>> = {
  TX_WARRANT_ACCEPTANCE: spec('warrant', 'Warrant acceptance', 'none'),
  TX_WARRANT_CANCELLATION: spec('warrant', 'Warrant cancellation', 'retire', 'quantity'),
  TX_WARRANT_EXERCISE: spec('warrant', 'Warrant exercise', 'retire'),
  TX_WARRANT_RETRACTION: spec('warrant', 'Warrant retraction', 'retire'),
  TX_WARRANT_TRANSFER: spec('warrant', 'Warrant transfer', 'retire', 'quantity'),
  TX_CONVERTIBLE_ACCEPTANCE: spec('convertible', 'Convertible acceptance', 'none'),
  TX_CONVERTIBLE_CANCELLATION: spec('convertible', 'Convertible cancellation', 'retire', 'amount'),
  TX_CONVERTIBLE_CONVERSION: spec('convertible', 'Convertible conversion', 'retire'),
  TX_CONVERTIBLE_RETRACTION: spec('convertible', 'Convertible retraction', 'retire'),
  TX_CONVERTIBLE_TRANSFER: spec('convertible', 'Convertible transfer', 'retire', 'amount'),
  TX_EQUITY_COMPENSATION_ACCEPTANCE: spec('equityCompensation', 'Equity compensation acceptance', 'none'),
  TX_EQUITY_COMPENSATION_CANCELLATION: spec(
    'equityCompensation',
    'Equity compensation cancellation',
    'retire',
    'quantity'
  ),
  TX_EQUITY_COMPENSATION_EXERCISE: spec('equityCompensation', 'Equity compensation exercise', 'reduce', 'quantity'),
  TX_EQUITY_COMPENSATION_RELEASE: spec('equityCompensation', 'Equity compensation release', 'reduce', 'quantity'),
  TX_EQUITY_COMPENSATION_REPRICING: spec('equityCompensation', 'Equity compensation repricing', 'none'),
  TX_EQUITY_COMPENSATION_RETRACTION: spec('equityCompensation', 'Equity compensation retraction', 'retire'),
  TX_EQUITY_COMPENSATION_TRANSFER: spec('equityCompensation', 'Equity compensation transfer', 'retire', 'quantity'),
};

function own<T>(table: Readonly<Record<string, T>>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(table, key) ? (table[key] ?? null) : null;
}

/** The instrument an object type issues, or `null` for any other. */
export function instrumentOfIssuance(objectType: string): InstrumentKind | null {
  return own(INSTRUMENT_OF_ISSUANCE, objectType);
}

/** How an instrument event's object type changes its security, or `null` for any other. */
export function instrumentEventSpec(objectType: string): InstrumentEventSpec | null {
  return own(INSTRUMENT_EVENTS, objectType);
}

/** A vesting record on a warrant or equity compensation: an event that changes neither. */
export function vestingEventSpec(kind: InstrumentKind, objectType: string): InstrumentEventSpec {
  return spec(kind, 'Vesting record', 'none', objectType === 'TX_VESTING_ACCELERATION' ? 'quantity' : 'none');
}

/** The state a warrant, convertible or equity-compensation issuance starts. */
export function newInstrument(record: ReplayRecord, kind: InstrumentKind): InstrumentState {
  const quantity =
    kind === 'equityCompensation'
      ? readDecimal(record, 'quantity')
      : kind === 'warrant'
        ? readOptionalDecimal(record, 'quantity')
        : null;
  const amount = kind === 'convertible' ? readOptionalMonetary(record, 'investment_amount') : null;
  return {
    kind,
    securityId: readText(record, 'security_id'),
    issuanceId: record.id,
    stakeholderId: readText(record, 'stakeholder_id'),
    issueDate: readDate(record, 'date'),
    expirationDate:
      kind === 'warrant'
        ? readOptionalDate(record, 'warrant_expiration_date')
        : kind === 'equityCompensation'
          ? readOptionalDate(record, 'expiration_date')
          : null,
    stockPlanId: kind === 'equityCompensation' ? readOptionalText(record, 'stock_plan_id') : null,
    stockClassId: kind === 'equityCompensation' ? readOptionalText(record, 'stock_class_id') : null,
    quantity,
    remainingQuantity: quantity,
    amount,
    remainingAmount: amount === null ? null : amount.amount,
    exercisedQuantity: '0',
    retired: null,
    events: [],
  };
}

function minus(a: string, b: string): string {
  return fromUnits(toUnits(a) - toUnits(b));
}

function exceeds(value: string | null, remaining: string | null): boolean {
  return value !== null && remaining !== null && toUnits(value) > toUnits(remaining);
}

/** The instrument after one event on it, with the event as tracked. */
export function trackInstrumentEvent(
  state: InstrumentState,
  record: ReplayRecord,
  eventSpec: InstrumentEventSpec
): InstrumentState {
  const date = readDate(record, 'date');
  const quantity = eventSpec.measure === 'quantity' ? readDecimal(record, 'quantity') : null;
  const amount = eventSpec.measure === 'amount' ? readOptionalMonetary(record, 'amount') : null;
  const balance = readOptionalText(record, 'balance_security_id');
  const event: InstrumentEvent = {
    recordId: record.id,
    objectType: record.objectType as InstrumentEvent['objectType'],
    date,
    quantity,
    amount,
    effect: eventSpec.effect,
    afterRetirement: state.retired !== null,
    afterExpiration: state.expirationDate !== null && date > state.expirationDate,
    exceedsRemaining:
      eventSpec.effect !== 'none' &&
      (exceeds(quantity, state.remainingQuantity) || exceeds(amount?.amount ?? null, state.remainingAmount)),
    resultingSecurityIds: [...readTextList(record, 'resulting_security_ids'), ...(balance === null ? [] : [balance])],
  };
  const next: InstrumentState = { ...state, events: [...state.events, event] };
  const retire = (): void => {
    next.retired ??= { recordId: record.id, objectType: event.objectType, date };
  };
  if (eventSpec.effect === 'reduce' && quantity !== null) {
    next.exercisedQuantity = fromUnits(toUnits(state.exercisedQuantity) + toUnits(quantity));
    if (state.remainingQuantity !== null) {
      next.remainingQuantity = minus(state.remainingQuantity, quantity);
      if (toUnits(next.remainingQuantity) <= 0n) retire();
    }
  } else if (eventSpec.effect === 'retire') {
    if (record.objectType === 'TX_WARRANT_EXERCISE' && state.retired === null && state.remainingQuantity !== null) {
      next.exercisedQuantity = fromUnits(toUnits(state.exercisedQuantity) + toUnits(state.remainingQuantity));
    }
    if (state.remainingQuantity !== null) next.remainingQuantity = '0';
    if (state.remainingAmount !== null) next.remainingAmount = '0';
    retire();
  }
  return next;
}
