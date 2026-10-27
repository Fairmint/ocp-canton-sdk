/**
 * Offline replay of a book's OCF under the OpenCapTable-v35 rules: a port of the stock state machine of `Apply.daml`
 * with `Events.daml`, `Splits.daml` and `VestingState.daml` (and the hold rules of `Holds.daml` for an extended
 * export), run off the ledger for rollout preflight, the restatement checks and replication.
 *
 * One pass in replay order (`orderReplay`): a primary stock issuance starts a state in the units of its date; each
 * event on a security brings its state to the event's date (per-security date order, vesting starts and events
 * excepted, and lazy application of the class's splits dated after its last event) and then applies the ledger's
 * rules: acceptances, vesting records and accelerations replace the state; retractions end it; transfers,
 * cancellations, repurchases, conversions, reissuances and consolidations end it and start their output issuances'
 * states, with the balance named, holding the remainder, with the source's stakeholder and class, the quantity
 * conserved, outputs dated on the event, full tranche cover for a partial event and the three vesting checks. Each
 * accepted unit becomes a step with the `CapTable_Apply` operation that writes it; each refused one a violation with
 * its rule and the ledger's message. A refused unit changes nothing; the replay goes on, and a later record on what it
 * would have created is refused as missing its state.
 *
 * What the OCF cannot show:
 *
 * - Vested quantities on vesting terms are the TA's snapshots, which are not OCF records. When an event moves vested
 *   shares out of a lot on vesting terms, the replay writes the smallest snapshot that event needs as a `snapshot`
 *   step before it (the TA's own snapshot may be larger, and an acceleration's bound looser on the ledger than here
 *   never stricter). A consolidation of lots on vesting terms is checked as if they had fully vested.
 * - The `seq` of a state counts the replay's own steps, so it misses the TA's other snapshots and restatements. A
 *   record in this book's derived form is replayed as the ledger wrote it, whatever `seq` it was derived at.
 * - Holds, hold cancellations and a settlement's draws appear only in an extended export (the hold pair); a transfer
 *   on a lot with an open settlement hold is that settlement's draw when its ID has the book's derived form (or no
 *   cap table ID is given).
 * - Freezes are the split procedure's, not the OCF's: the replay records each split as the procedure does.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Apply.daml
 */

import { OcpValidationError } from '../../errors/OcpValidationError';
import type {
  HoldType,
  OcfObjectType,
  OcfStockCancellation,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockReissuance,
  OcfStockRepurchase,
  OcfStockTransfer,
  Vesting,
} from '../../types/native';
import type {
  ApplyOperation,
  ApplyRecordOperation,
  DerivedRole,
  IdNamespace,
  InstrumentState,
  OpenHold,
  OutputVesting,
  RecordedSplit,
  RegisterCheckResult,
  RegisterContext,
  ReplayedStockState,
  ReplayOcfOptions,
  ReplayResult,
  ReplayStep,
  ReplayStepKind,
  ReplayViolation,
  RetiredStockSecurity,
  StockSecurityState,
  StockVesting,
} from '../../types/register';
import type { OcfManifest } from '../../utils/cantonOcfExtractor';
import {
  MAX_HOLDS_PER_SECURITY,
  MAX_LOTS_PER_OPERATION,
  MAX_SPLITS_PER_CLASS,
  MAX_TRANCHES_PER_SECURITY,
} from '../caps';
import { deriveId, isDerivedForm } from '../ids';
import { fromUnits, showDaml, toUnits } from '../numeric';
import { showObjectType } from '../references';
import { applySplits, findHold, isStopped, settlementHolds, splitsOnOrBefore } from '../splits';
import {
  accelerateTranches,
  checkBalanceVesting,
  checkOutputsVesting,
  checkTransferVesting,
  drawTranches,
  fullyCovered,
  sortTranches,
  vestedAt,
  vestedBy,
} from '../vesting';
import {
  instrumentEventSpec,
  instrumentOfIssuance,
  newInstrument,
  trackInstrumentEvent,
  vestingEventSpec,
  type InstrumentEventSpec,
} from './instruments';
import { orderReplay, subjectSecurities, type ReplayOrder, type ReplayUnit } from './order';
import {
  dateOf,
  readDate,
  readDecimal,
  readOptionalDecimal,
  readOptionalText,
  readSplitRatio,
  readText,
  readTextList,
  readVestings,
  refuse,
  ReplayRefusal,
  type ReplayRecord,
} from './records';

/** A stock issuance as the rules read it. */
interface Issuance {
  record: ReplayRecord;
  id: string;
  date: string;
  security_id: string;
  stakeholder_id: string;
  stock_class_id: string;
  quantity: string;
  vestings: Vesting[];
  vesting_terms_id: string | null;
}

interface Retirement {
  securityId: string;
  recordId: string;
  date: string;
  state: StockSecurityState;
}

/** The replayed book: what the ledger's working set holds once every accepted unit is written. */
interface ReplayBook {
  states: Map<string, StockSecurityState>;
  splits: Map<string, RecordedSplit[]>;
  objectIds: Set<string>;
  securityIds: Set<string>;
  retired: Map<string, Retirement>;
  instruments: Map<string, InstrumentState>;
}

/** One unit's changes to the book, committed only when the unit is accepted (a refused write changes nothing). */
class Draft {
  readonly steps: ReplayStep[] = [];
  private readonly book: ReplayBook;
  private readonly states = new Map<string, StockSecurityState | null>();
  private readonly splitLists = new Map<string, RecordedSplit[]>();
  private readonly objectIds = new Set<string>();
  private readonly securityIds = new Set<string>();
  private readonly retirements = new Map<string, Retirement>();
  private readonly instrumentStates = new Map<string, InstrumentState>();

  constructor(book: ReplayBook) {
    this.book = book;
  }

  state(securityId: string): StockSecurityState | null {
    if (this.states.has(securityId)) return this.states.get(securityId) ?? null;
    return this.book.states.get(securityId) ?? null;
  }

  setState(state: StockSecurityState): void {
    this.states.set(state.security_id, state);
  }

  endState(state: StockSecurityState, recordId: string, date: string): void {
    this.states.set(state.security_id, null);
    this.retirements.set(state.security_id, { securityId: state.security_id, recordId, date, state });
  }

  retirement(securityId: string): Retirement | null {
    return this.retirements.get(securityId) ?? this.book.retired.get(securityId) ?? null;
  }

  splits(stockClassId: string): RecordedSplit[] | null {
    return this.splitLists.get(stockClassId) ?? this.book.splits.get(stockClassId) ?? null;
  }

  setSplits(stockClassId: string, splits: RecordedSplit[]): void {
    this.splitLists.set(stockClassId, splits);
  }

  /** Records that an ID is in use in its namespace; a second use is the ledger's "already used". */
  use(namespace: IdNamespace, id: string): void {
    const [mine, theirs] =
      namespace === 'security' ? [this.securityIds, this.book.securityIds] : [this.objectIds, this.book.objectIds];
    if (mine.has(id) || theirs.has(id)) {
      refuse('claimed_id', `${namespace === 'security' ? 'security ID' : 'ID'} already used: ${id}`);
    }
    mine.add(id);
  }

  instrument(securityId: string): InstrumentState | null {
    return this.instrumentStates.get(securityId) ?? this.book.instruments.get(securityId) ?? null;
  }

  setInstrument(state: InstrumentState): void {
    this.instrumentStates.set(state.securityId, state);
  }

  commit(): void {
    for (const [securityId, state] of this.states) {
      if (state === null) this.book.states.delete(securityId);
      else this.book.states.set(securityId, state);
    }
    for (const [stockClassId, splits] of this.splitLists) this.book.splits.set(stockClassId, splits);
    for (const id of this.objectIds) this.book.objectIds.add(id);
    for (const id of this.securityIds) this.book.securityIds.add(id);
    for (const [securityId, retirement] of this.retirements) this.book.retired.set(securityId, retirement);
    for (const [securityId, state] of this.instrumentStates) this.book.instruments.set(securityId, state);
  }
}

function check(result: RegisterCheckResult): void {
  if (!result.ok) refuse('vesting', result.message);
}

function readIssuance(record: ReplayRecord): Issuance {
  return {
    record,
    id: record.id,
    date: readDate(record, 'date'),
    security_id: readText(record, 'security_id'),
    stakeholder_id: readText(record, 'stakeholder_id'),
    stock_class_id: readText(record, 'stock_class_id'),
    quantity: readDecimal(record, 'quantity'),
    vestings: readVestings(record),
    vesting_terms_id: readOptionalText(record, 'vesting_terms_id'),
  };
}

/** How an issuance's security vests: explicit tranches first, else its vesting terms, else fully vested. */
function vestingOfIssuance(issuance: Issuance): StockVesting {
  if (issuance.vestings.length > 0) return { kind: 'tranches', tranches: sortTranches(issuance.vestings) };
  return issuance.vesting_terms_id === null
    ? { kind: 'none' }
    : { kind: 'on_terms', vesting_terms_id: issuance.vesting_terms_id };
}

function outputVesting(issuance: Issuance): OutputVesting {
  return {
    quantity: issuance.quantity,
    vestings: issuance.vestings,
    on_terms: issuance.vestings.length === 0 && issuance.vesting_terms_id !== null,
  };
}

/** What an output vests by a date: its tranches dated on or before it, nothing on terms, all of it with no vesting. */
function outputVestedUnits(date: string, output: OutputVesting): bigint {
  if (output.vestings.length > 0) return toUnits(vestedBy(date, output.vestings));
  return output.on_terms ? 0n : toUnits(output.quantity);
}

function sumUnits(values: readonly string[]): bigint {
  return values.reduce((total, value) => total + toUnits(value), 0n);
}

/** The state after a non-terminal event: one more event, the same holds, no delivery record. */
function successor(state: StockSecurityState): StockSecurityState {
  return { ...state, seq: state.seq + 1, delivery: null };
}

function requireNoHolds(state: StockSecurityState): void {
  if (state.holds.length > 0) {
    refuse('held', `security ${state.security_id} carries an open hold; the TA must cancel or lift it first`);
  }
}

function sameTranches(a: readonly Vesting[], b: readonly Vesting[]): boolean {
  return (
    a.length === b.length &&
    a.every((tranche, index) => tranche.date === b[index]?.date && toUnits(tranche.amount) === toUnits(b[index].amount))
  );
}

function withoutContext(state: StockSecurityState): ReplayedStockState {
  const { context: _context, ...rest } = state;
  return rest;
}

/** The records of a unit: the event first, then its outputs and a stop's companion. */
function unitRecordIds(unit: ReplayUnit): string[] {
  return [unit.record, ...unit.resulting, unit.balance, unit.companion].flatMap((record) =>
    record === null ? [] : [record.id]
  );
}

/** The securities a unit would create, so that later records on them name the refusal. */
function unitCreatedSecurities(unit: ReplayUnit): string[] {
  const { record } = unit;
  if (record.objectType === 'TX_STOCK_ISSUANCE' || instrumentOfIssuance(record.objectType) !== null) {
    const security = record.data['security_id'];
    return typeof security === 'string' ? [security] : [];
  }
  return [...unit.resulting, unit.balance].flatMap((output) => {
    const security = output?.data['security_id'];
    return typeof security === 'string' ? [security] : [];
  });
}

function recordOperation(record: ReplayRecord): ApplyRecordOperation {
  // The entity kind and the manifest's data are correlated by the record's object type.
  return { kind: 'record', type: record.entityType, data: record.data } as ApplyRecordOperation;
}

function nativeIssuance(issuance: Issuance): OcfStockIssuance {
  return issuance.record.data as unknown as OcfStockIssuance;
}

const NO_SECURITIES: readonly string[] = [];

class OcfReplay {
  private readonly order: ReplayOrder;
  private readonly capTableId: string | undefined;
  private readonly context: RegisterContext;
  private readonly book: ReplayBook = {
    states: new Map(),
    splits: new Map(),
    objectIds: new Set(),
    securityIds: new Set(),
    retired: new Map(),
    instruments: new Map(),
  };
  private readonly steps: ReplayStep[] = [];
  private readonly violations: ReplayViolation[] = [];
  private readonly accepted = new Set<ReplayUnit>();
  private readonly refusedCreations = new Map<string, string>();

  constructor(order: ReplayOrder, capTableId: string | undefined) {
    this.order = order;
    this.capTableId = capTableId;
    this.context = { cap_table_id: capTableId ?? '', issuer: '', system_operator: '', transfer_agent: '' };
  }

  run(): ReplayResult {
    for (const problem of this.order.problems) {
      this.violations.push({
        rule: 'malformed_record',
        message: problem.message,
        recordIds: problem.recordId === null ? [] : [problem.recordId],
        securityIds: [],
        date: null,
        step: 0,
      });
    }
    const { units } = this.order;
    for (let start = 0; start < units.length;) {
      const first = units[start];
      let end = start + 1;
      if (first?.date !== null && first?.date !== undefined) {
        while (end < units.length && units[end]?.date === first.date) end++;
      }
      this.replayDay(units.slice(start, end));
      start = end;
    }
    return {
      steps: this.steps,
      states: new Map([...this.book.states].map(([id, state]) => [id, withoutContext(state)])),
      retired: new Map(
        [...this.book.retired].map(([id, retirement]): [string, RetiredStockSecurity] => [
          id,
          {
            securityId: retirement.securityId,
            recordId: retirement.recordId,
            date: retirement.date,
            lastState: withoutContext(retirement.state),
          },
        ])
      ),
      splits: new Map([...this.book.splits].map(([id, splits]) => [id, [...splits]])),
      instruments: new Map(this.book.instruments),
      violations: this.violations,
    };
  }

  /**
   * One day's units in order. OCF dates are day-only, so a unit refused on its first try is retried after the rest
   * of its day, until a pass accepts nothing more; what is left is refused, in order. A record whose ID has this
   * book's derived form waits for the `seq` the ledger derived it at, so the register's own writes of one day (two
   * trades on one lot) replay in the ledger's order; it goes anyway once nothing else of the day can.
   */
  private replayDay(units: readonly ReplayUnit[]): void {
    let pending = units;
    let force = false;
    for (;;) {
      const refusals = new Map<ReplayUnit, ReplayRefusal>();
      let progressed = false;
      let waited = false;
      for (const unit of pending) {
        if (!force && this.waitsForItsSeq(unit)) {
          waited = true;
          continue;
        }
        const refusal = this.tryUnit(unit);
        if (refusal === null) progressed = true;
        else refusals.set(unit, refusal);
      }
      const left = pending.filter((unit) => !this.accepted.has(unit));
      if (left.length === 0) return;
      if (!progressed && !force && waited) {
        force = true;
      } else if (!progressed) {
        for (const unit of left) {
          const refusal = refusals.get(unit);
          if (refusal !== undefined) this.report(unit, refusal);
        }
        return;
      } else {
        force = false;
      }
      pending = left;
    }
  }

  /** Whether a unit's derived-form ID was derived at a later `seq` of its security than the replay has reached. */
  private waitsForItsSeq(unit: ReplayUnit): boolean {
    const { record } = unit;
    if (this.capTableId === undefined || !this.derivedForm(record.id)) return false;
    const [securityId] = subjectSecurities(record);
    const state = securityId === undefined ? undefined : this.book.states.get(securityId);
    if (state === undefined) return false;
    const role: DerivedRole =
      record.objectType === 'TX_STOCK_HOLD'
        ? 'hold'
        : record.objectType === 'TX_STOCK_HOLD_CANCELLATION'
          ? 'hold_cancellation'
          : 'event';
    return (
      record.id !==
      deriveId({ capTableId: this.capTableId, securityId: state.security_id, seq: state.seq, role, index: 0 })
    );
  }

  private tryUnit(unit: ReplayUnit): ReplayRefusal | null {
    const draft = new Draft(this.book);
    try {
      this.replayUnit(draft, unit);
    } catch (error) {
      if (error instanceof ReplayRefusal) return error;
      if (error instanceof OcpValidationError) {
        return new ReplayRefusal('malformed_record', `${unit.record.objectType} ${unit.record.id}: ${error.message}`);
      }
      throw error;
    }
    draft.commit();
    this.steps.push(...draft.steps);
    this.accepted.add(unit);
    return null;
  }

  private report(unit: ReplayUnit, refusal: ReplayRefusal): void {
    this.violations.push({
      rule: refusal.rule,
      message: refusal.message,
      recordIds: unitRecordIds(unit),
      securityIds: subjectSecurities(unit.record),
      date: unit.date,
      step: this.steps.length,
    });
    for (const security of unitCreatedSecurities(unit)) {
      if (!this.refusedCreations.has(security)) this.refusedCreations.set(security, unit.record.id);
    }
  }

  // ===== Dispatch =====

  private replayUnit(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const { objectType } = record;
    const instrumentKind = instrumentOfIssuance(objectType);
    const instrumentEvent = instrumentEventSpec(objectType);
    switch (objectType) {
      case 'ISSUER':
        this.claim(draft, 'object', record.id);
        this.step(draft, unit, 'issuer', null, NO_SECURITIES);
        return;
      case 'STOCK_CLASS':
        this.claim(draft, 'object', record.id);
        draft.setSplits(record.id, []);
        this.step(draft, unit, 'apply', recordOperation(record), NO_SECURITIES);
        return;
      case 'TX_STOCK_ISSUANCE':
        this.primaryIssuance(draft, unit);
        return;
      case 'TX_STOCK_CLASS_SPLIT':
        this.split(draft, unit);
        return;
      case 'TX_STOCK_ACCEPTANCE':
      case 'TX_STOCK_RETRACTION':
        this.acceptanceOrRetraction(draft, unit);
        return;
      case 'TX_VESTING_START':
      case 'TX_VESTING_EVENT':
      case 'TX_VESTING_ACCELERATION':
        this.vestingRecord(draft, unit);
        return;
      case 'TX_STOCK_TRANSFER':
        this.transfer(draft, unit);
        return;
      case 'TX_STOCK_CANCELLATION':
      case 'TX_STOCK_REPURCHASE':
        this.reduction(draft, unit);
        return;
      case 'TX_STOCK_CONVERSION':
        this.conversion(draft, unit);
        return;
      case 'TX_STOCK_REISSUANCE':
        this.reissuance(draft, unit);
        return;
      case 'TX_STOCK_CONSOLIDATION':
        this.consolidation(draft, unit);
        return;
      case 'TX_STOCK_HOLD':
        this.hold(draft, unit);
        return;
      case 'TX_STOCK_HOLD_CANCELLATION':
        this.holdCancellation(draft, unit);
        return;
      default:
        break;
    }
    if (instrumentKind !== null) {
      this.claim(draft, 'object', record.id);
      const instrument = newInstrument(record, instrumentKind);
      this.claim(draft, 'security', instrument.securityId);
      draft.setInstrument(instrument);
    } else if (instrumentEvent !== null) {
      this.claim(draft, 'object', record.id);
      this.trackInstrument(draft, record, instrumentEvent, readText(record, 'security_id'));
    } else {
      // Definitions, documents, class-, plan- and issuer-level records, stakeholder events and financings: no state.
      this.claim(draft, 'object', record.id);
    }
    this.step(draft, unit, 'apply', recordOperation(record), NO_SECURITIES);
  }

  // ===== IDs =====

  private derivedForm(id: string): boolean {
    return this.capTableId !== undefined && isDerivedForm(this.capTableId, id);
  }

  /** Claims a writer-chosen ID: not empty, not in this book's derived form, not used in its namespace. */
  private claim(draft: Draft, namespace: IdNamespace, id: string): void {
    if (id === '') refuse('claimed_id', 'an empty ID cannot be claimed');
    if (this.derivedForm(id)) {
      refuse('claimed_id', `ID ${id} has this cap table's derived form and cannot be claimed`);
    }
    draft.use(namespace, id);
  }

  /**
   * An ID an event on a state writes: one in this book's derived form needs no claim (the ledger derived it for the
   * event's role from the state's `seq`, which the replay may not see); any other ID is claimed.
   */
  private resolveId(draft: Draft, namespace: IdNamespace, id: string): void {
    if (this.derivedForm(id)) draft.use(namespace, id);
    else this.claim(draft, namespace, id);
  }

  /** The successor after a non-terminal event whose record took `id`, remembering a derived ID. */
  private successorAfter(state: StockSecurityState, id: string): StockSecurityState {
    return { ...successor(state), derived_ids: state.derived_ids || this.derivedForm(id) };
  }

  // ===== States =====

  private requireSplits(draft: Draft, stockClassId: string): RecordedSplit[] {
    return draft.splits(stockClassId) ?? refuse('missing_class', `no active epoch for stock class ${stockClassId}`);
  }

  /** The ledger's `ensure` on a state it creates. */
  private putState(draft: Draft, state: StockSecurityState): void {
    const quantity = toUnits(state.quantity);
    if (quantity <= 0n) {
      refuse(
        'state_invariant',
        `security ${state.security_id} must hold a positive quantity, not ${showDaml(quantity)}`
      );
    }
    if (state.vesting.kind === 'tranches') {
      const { tranches } = state.vesting;
      if (tranches.length > MAX_TRANCHES_PER_SECURITY) {
        refuse(
          'state_invariant',
          `security ${state.security_id} has ${tranches.length} vesting tranches; at most ${MAX_TRANCHES_PER_SECURITY}`
        );
      }
      if (tranches.some((tranche) => toUnits(tranche.amount) <= 0n)) {
        refuse('state_invariant', `security ${state.security_id} has a vesting tranche that is not positive`);
      }
      const total = sumUnits(tranches.map((tranche) => tranche.amount));
      if (total > quantity) {
        refuse(
          'state_invariant',
          `the vesting tranches of security ${state.security_id} total ${showDaml(total)}, more than its quantity ${showDaml(quantity)}`
        );
      }
    }
    draft.setState(state);
  }

  private addState(draft: Draft, state: StockSecurityState): StockSecurityState {
    if (draft.state(state.security_id) !== null) {
      refuse('claimed_id', `security ${state.security_id} already has a state`);
    }
    this.putState(draft, state);
    return state;
  }

  /** The state a stock issuance starts, in the units of `eventDate`: a primary issuance's date, or its event's. */
  private stateForIssuance(
    splits: readonly RecordedSplit[],
    eventDate: string,
    issuance: Issuance
  ): StockSecurityState {
    return {
      context: this.context,
      security_id: issuance.security_id,
      issue_date: issuance.date,
      last_event_date: eventDate,
      origin_transaction_id: issuance.id,
      quantity: issuance.quantity,
      seq: 0,
      split_epoch: splitsOnOrBefore(splits, eventDate),
      stakeholder_id: issuance.stakeholder_id,
      stock_class_id: issuance.stock_class_id,
      vesting: vestingOfIssuance(issuance),
      holds: [],
      delivery: null,
      snapshot: null,
      accelerated_since_snapshot: null,
      derived_ids: false,
    };
  }

  /** Why a security has no state: retired, its issuance refused, issued later, or never issued. */
  private missingState(draft: Draft, securityId: string, date: string): never {
    const retirement = draft.retirement(securityId);
    if (retirement !== null) {
      return refuse(
        'missing_state',
        `no active state for security ${securityId}: ${retirement.recordId} ended it on ${retirement.date}`
      );
    }
    const refusedBy = this.refusedCreations.get(securityId);
    if (refusedBy !== undefined) {
      return refuse(
        'missing_state',
        `no active state for security ${securityId}: ${refusedBy}, which issues it, was refused`
      );
    }
    const creator = this.order.creators.get(securityId);
    if (
      creator !== undefined &&
      !this.accepted.has(creator) &&
      instrumentOfIssuance(creator.record.objectType) === null &&
      creator.date !== null &&
      creator.date > date
    ) {
      return refuse(
        'date_order',
        `event dated ${date} precedes the last event on security ${securityId} (${creator.date})`
      );
    }
    return refuse('missing_state', `no active state for security ${securityId}`);
  }

  /** Brings a security's state to an event dated `date`, as `beginEvent` does. */
  private beginEvent(draft: Draft, securityId: string, date: string, backdatable: boolean): StockSecurityState {
    const state = draft.state(securityId) ?? this.missingState(draft, securityId, date);
    const splits = this.requireSplits(draft, state.stock_class_id);
    if (!backdatable && date < state.last_event_date) {
      refuse(
        'date_order',
        `event dated ${date} precedes the last event on security ${securityId} (${state.last_event_date})`
      );
    }
    const applied = applySplits(splits, date, state);
    if (!applied.ok) refuse('split', applied.message);
    return applied.value;
  }

  private endState(draft: Draft, state: StockSecurityState, recordId: string, date: string): void {
    draft.endState(state, recordId, date);
  }

  /**
   * Writes an output issuance of an event dated `date` and the state it starts: the issuance is dated on its event,
   * because its state starts at the event's date and split epoch and its quantity is in the event's units.
   */
  private addOutputIssuance(draft: Draft, date: string, issuance: Issuance): StockSecurityState {
    if (issuance.date !== date) {
      refuse(
        'output_date',
        `output issuance ${issuance.id} is dated ${issuance.date}, not on its event's date ${date}`
      );
    }
    this.resolveId(draft, 'object', issuance.id);
    this.resolveId(draft, 'security', issuance.security_id);
    const splits = this.requireSplits(draft, issuance.stock_class_id);
    return this.addState(draft, this.stateForIssuance(splits, date, issuance));
  }

  private writeOutputs(draft: Draft, date: string, resulting: readonly Issuance[], balance: Issuance | null): void {
    for (const issuance of resulting) this.addOutputIssuance(draft, date, issuance);
    if (balance !== null) this.addOutputIssuance(draft, date, balance);
  }

  // ===== Steps =====

  private step(
    draft: Draft,
    unit: ReplayUnit,
    kind: ReplayStepKind,
    operation: ApplyOperation | null,
    securityIds: readonly string[]
  ): void {
    const recordIds = unitRecordIds(unit);
    draft.steps.push({
      kind,
      operation,
      date: unit.date,
      recordIds,
      securityIds: [...securityIds],
      derivedForm: recordIds.some((id) => this.derivedForm(id)),
      impliedBy: null,
    });
  }

  /**
   * A lot on vesting terms vests what the TA's snapshot says, and the OCF has no snapshots. When an event's outputs
   * vest more by its date than the lot's replayed snapshot, the TA must have recorded one: the replay writes the
   * smallest the event needs (`exact`: a transfer with a balance needs the snapshot to equal what its outputs vest),
   * under the ledger's snapshot rules, as a step before the event. Returns the state the event then reads.
   */
  private snapshotFor(
    draft: Draft,
    state: StockSecurityState,
    date: string,
    outputs: readonly OutputVesting[],
    eventId: string,
    exact: boolean
  ): StockSecurityState {
    if (state.vesting.kind !== 'on_terms') return state;
    const implied = outputs.reduce((total, output) => total + outputVestedUnits(date, output), 0n);
    const previous = state.snapshot === null ? 0n : toUnits(state.snapshot.vested);
    if (implied <= previous) return state;
    const accelerated = state.accelerated_since_snapshot === null ? 0n : toUnits(state.accelerated_since_snapshot);
    const quantity = toUnits(state.quantity);
    const wanted = exact || implied > previous + accelerated ? implied : previous + accelerated;
    const vested = wanted > quantity ? quantity : wanted;
    if (vested <= previous) return state;
    if (vested < previous + accelerated) {
      refuse(
        'snapshot',
        `vesting snapshot for security ${state.security_id} of ${showDaml(vested)} leaves out the ${showDaml(accelerated)} accelerated since the last snapshot of ${showDaml(previous)}`
      );
    }
    const next: StockSecurityState = {
      ...successor(state),
      snapshot: { as_of: date, vested: fromUnits(vested) },
      accelerated_since_snapshot: null,
    };
    this.putState(draft, next);
    draft.steps.push({
      kind: 'snapshot',
      operation: { kind: 'vestingSnapshot', securityId: state.security_id, asOf: date, vested: fromUnits(vested) },
      date,
      recordIds: [],
      securityIds: [state.security_id],
      derivedForm: false,
      impliedBy: eventId,
    });
    return next;
  }

  // ===== Records with a state =====

  private primaryIssuance(draft: Draft, unit: ReplayUnit): void {
    const issuance = readIssuance(unit.record);
    const splits = this.requireSplits(draft, issuance.stock_class_id);
    this.claim(draft, 'object', issuance.id);
    this.claim(draft, 'security', issuance.security_id);
    this.addState(draft, this.stateForIssuance(splits, issuance.date, issuance));
    this.step(draft, unit, 'apply', recordOperation(unit.record), [issuance.security_id]);
  }

  /** A split touches no state: it is recorded on its class, dated after the class's latest split. */
  private split(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const stockClassId = readText(record, 'stock_class_id');
    const date = readDate(record, 'date');
    const ratio = readSplitRatio(record);
    const splits = this.requireSplits(draft, stockClassId);
    if (splits.length >= MAX_SPLITS_PER_CLASS) {
      refuse('split', `stock class ${stockClassId} already has ${MAX_SPLITS_PER_CLASS} splits`);
    }
    const latest = splits[splits.length - 1];
    if (latest !== undefined && date <= latest.date) {
      refuse('split', `split ${record.id} must be dated after the class's latest recorded split`);
    }
    this.claim(draft, 'object', record.id);
    if (toUnits(ratio.numerator) <= 0n || toUnits(ratio.denominator) <= 0n) {
      refuse('split', `split ${record.id} needs a positive ratio`);
    }
    draft.setSplits(stockClassId, [...splits, { split_id: record.id, date, ratio }]);
    this.step(draft, unit, 'apply', recordOperation(record), NO_SECURITIES);
  }

  private acceptanceOrRetraction(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const securityId = readText(record, 'security_id');
    const state = this.beginEvent(draft, securityId, readDate(record, 'date'), false);
    if (record.objectType === 'TX_STOCK_RETRACTION') {
      requireNoHolds(state);
      this.resolveId(draft, 'object', record.id);
      this.endState(draft, state, record.id, readDate(record, 'date'));
    } else {
      this.resolveId(draft, 'object', record.id);
      this.putState(draft, this.successorAfter(state, record.id));
    }
    this.step(draft, unit, 'apply', recordOperation(record), [securityId]);
  }

  /**
   * A vesting start, event or acceleration: an event on the security's stock state, or with none a record on a
   * warrant or equity compensation. Starts and events may be backdated; an acceleration follows date order.
   */
  private vestingRecord(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const securityId = readText(record, 'security_id');
    const date = readDate(record, 'date');
    if (draft.state(securityId) === null) {
      const creator = this.order.creators.get(securityId);
      const onStock = creator !== undefined && instrumentOfIssuance(creator.record.objectType) === null;
      if (onStock && draft.retirement(securityId) === null) this.missingState(draft, securityId, date);
      this.claim(draft, 'object', record.id);
      const instrument = draft.instrument(securityId);
      const label = 'Vesting record (no stock state in this write)';
      if (instrument === null || instrument.kind === 'convertible') return this.missingReference(label, securityId);
      this.trackInstrument(draft, record, vestingEventSpec(instrument.kind, record.objectType), securityId);
      this.step(draft, unit, 'apply', recordOperation(record), NO_SECURITIES);
      return;
    }
    if (record.objectType !== 'TX_VESTING_ACCELERATION') {
      const state = this.beginEvent(draft, securityId, date, true);
      this.resolveId(draft, 'object', record.id);
      this.putState(draft, this.successorAfter(state, record.id));
      this.step(draft, unit, 'apply', recordOperation(record), [securityId]);
      return;
    }
    const quantity = readDecimal(record, 'quantity');
    const state = this.beginEvent(draft, securityId, date, false);
    let { vesting } = state;
    let accelerated = state.accelerated_since_snapshot;
    switch (state.vesting.kind) {
      case 'none':
        return refuse('vesting', `security ${securityId} is fully vested and cannot be accelerated`);
      case 'tranches': {
        const result = accelerateTranches(date, quantity, state, state.vesting.tranches);
        if (!result.ok) refuse('vesting', result.message);
        vesting = { kind: 'tranches', tranches: result.value };
        break;
      }
      case 'on_terms': {
        // The TA's snapshot stays the vested quantity until the next one, which counts every acceleration since.
        const q = toUnits(quantity);
        const before = accelerated === null ? 0n : toUnits(accelerated);
        const unvested = toUnits(state.quantity) - toUnits(vestedAt(state, date)) - before;
        if (q > unvested) {
          refuse(
            'vesting',
            `acceleration of ${showDaml(q)} on security ${securityId} exceeds its unvested quantity ${showDaml(unvested)}`
          );
        }
        if (q <= 0n) refuse('vesting', `acceleration ${record.id} must accelerate a positive quantity`);
        accelerated = fromUnits(before + q);
        break;
      }
    }
    this.resolveId(draft, 'object', record.id);
    this.putState(draft, {
      ...this.successorAfter(state, record.id),
      vesting,
      accelerated_since_snapshot: accelerated,
    });
    this.step(draft, unit, 'apply', recordOperation(record), [securityId]);
  }

  // ===== Bundled stock events =====

  /** The event's resulting issuances, in the order of its resulting securities, each one found. */
  private resultingIssuances(unit: ReplayUnit, named: readonly string[]): Issuance[] {
    const found = unit.resulting.flatMap((record) => (record === null ? [] : [readIssuance(record)]));
    if (found.length !== named.length || found.some((issuance, index) => issuance.security_id !== named[index])) {
      refuse('resulting_securities', "the resulting issuances must be the event's resulting securities, in order");
    }
    return found;
  }

  /**
   * The checks every partial or whole terminal event with an optional balance shares: the quantity fits, the balance
   * exists exactly when shares remain and is named by the event, stays with the source's stakeholder and class, holds
   * exactly the remainder, and a partial event needs full tranche cover.
   */
  private checkBalance(
    state: StockSecurityState,
    quantity: string,
    namedBalance: string | null,
    balance: Issuance | null
  ): void {
    const q = toUnits(quantity);
    const total = toUnits(state.quantity);
    if (q > total) {
      refuse(
        'balance',
        `event quantity ${showDaml(q)} exceeds the ${showDaml(total)} of security ${state.security_id}`
      );
    }
    const remaining = total - q;
    if (remaining > 0n && balance !== null) {
      if (namedBalance !== balance.security_id) {
        refuse('balance', `the event must name its balance security ${balance.security_id}`);
      }
      if (toUnits(balance.quantity) !== remaining) {
        refuse('balance', `balance ${balance.security_id} must hold the remaining ${showDaml(remaining)}`);
      }
      if (balance.stakeholder_id !== state.stakeholder_id || balance.stock_class_id !== state.stock_class_id) {
        refuse('balance', `balance ${balance.security_id} must stay with the source's stakeholder and class`);
      }
      if (!fullyCovered(state)) {
        refuse(
          'tranche_cover',
          `security ${state.security_id} has tranches covering less than its quantity and takes no partial event`
        );
      }
      check(checkBalanceVesting(state, outputVesting(balance)));
    } else if (remaining > 0n) {
      refuse('balance', `a partial event on security ${state.security_id} needs a balance issuance`);
    } else if (balance !== null) {
      refuse('balance', `an event on the whole of security ${state.security_id} has no balance`);
    } else if (namedBalance !== null) {
      refuse('balance', 'the event names a balance security but writes none');
    }
  }

  private balanceOf(unit: ReplayUnit): Issuance | null {
    return unit.balance === null ? null : readIssuance(unit.balance);
  }

  private transfer(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const date = readDate(record, 'date');
    const securityId = readText(record, 'security_id');
    const quantity = readDecimal(record, 'quantity');
    const named = readTextList(record, 'resulting_security_ids');
    const namedBalance = readOptionalText(record, 'balance_security_id');
    let state = this.beginEvent(draft, securityId, date, false);
    if (settlementHolds(state).length > 0 && (this.capTableId === undefined || this.derivedForm(record.id))) {
      this.draw(draft, unit, state, { date, quantity, named, namedBalance });
      return;
    }
    requireNoHolds(state);
    const resulting = this.resultingIssuances(unit, named);
    const balance = this.balanceOf(unit);
    this.checkBalance(state, quantity, namedBalance, balance);
    if (!resulting.every((issuance) => issuance.stock_class_id === state.stock_class_id)) {
      refuse('class', "a stock transfer's resulting securities stay in the source's class");
    }
    if (sumUnits(resulting.map((issuance) => issuance.quantity)) !== toUnits(quantity)) {
      refuse(
        'conservation',
        `the resulting securities of transfer ${record.id} must hold exactly its quantity ${showDaml(toUnits(quantity))}`
      );
    }
    const resultingVesting = resulting.map(outputVesting);
    const balanceVesting = balance === null ? null : outputVesting(balance);
    const outputs = balanceVesting === null ? resultingVesting : [...resultingVesting, balanceVesting];
    state = this.snapshotFor(draft, state, date, outputs, record.id, balance !== null);
    const label = `transfer ${record.id}`;
    check(checkOutputsVesting(date, label, [state], outputs));
    check(checkTransferVesting(date, label, state, resultingVesting, balanceVesting));
    this.resolveId(draft, 'object', record.id);
    this.endState(draft, state, record.id, date);
    this.writeOutputs(draft, date, resulting, balance);
    const operation: ApplyOperation = {
      kind: 'stockTransfer',
      transfer: record.data as unknown as OcfStockTransfer,
      resulting: resulting.map(nativeIssuance),
      balance: balance === null ? null : nativeIssuance(balance),
    };
    this.step(draft, unit, 'apply', operation, this.bundleSecurities([securityId], resulting, balance));
  }

  /** Cancellations and repurchases retire part or all of a security and may leave a balance. */
  private reduction(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const date = readDate(record, 'date');
    const securityId = readText(record, 'security_id');
    const quantity = readDecimal(record, 'quantity');
    let state = this.beginEvent(draft, securityId, date, false);
    requireNoHolds(state);
    const balance = this.balanceOf(unit);
    this.checkBalance(state, quantity, readOptionalText(record, 'balance_security_id'), balance);
    const outputs = balance === null ? [] : [outputVesting(balance)];
    state = this.snapshotFor(draft, state, date, outputs, record.id, false);
    check(checkOutputsVesting(date, `event ${record.id}`, [state], outputs));
    this.resolveId(draft, 'object', record.id);
    this.endState(draft, state, record.id, date);
    this.writeOutputs(draft, date, [], balance);
    const nativeBalance = balance === null ? null : nativeIssuance(balance);
    const operation: ApplyOperation =
      record.objectType === 'TX_STOCK_CANCELLATION'
        ? {
            kind: 'stockCancellation',
            cancellation: record.data as unknown as OcfStockCancellation,
            balance: nativeBalance,
          }
        : { kind: 'stockRepurchase', repurchase: record.data as unknown as OcfStockRepurchase, balance: nativeBalance };
    this.step(draft, unit, 'apply', operation, this.bundleSecurities([securityId], [], balance));
  }

  /**
   * A conversion's arithmetic is the writer's: the ledger checks the converted quantity against the source, the
   * balance, and that same-class outputs never vest ahead of the source.
   */
  private conversion(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const date = readDate(record, 'date');
    const securityId = readText(record, 'security_id');
    let state = this.beginEvent(draft, securityId, date, false);
    requireNoHolds(state);
    const resulting = this.resultingIssuances(unit, readTextList(record, 'resulting_security_ids'));
    const balance = this.balanceOf(unit);
    this.checkBalance(
      state,
      readDecimal(record, 'quantity_converted'),
      readOptionalText(record, 'balance_security_id'),
      balance
    );
    const sameClass = resulting.filter((issuance) => issuance.stock_class_id === state.stock_class_id);
    const outputs = [...sameClass, ...(balance === null ? [] : [balance])].map(outputVesting);
    state = this.snapshotFor(draft, state, date, outputs, record.id, false);
    check(checkOutputsVesting(date, `conversion ${record.id}`, [state], outputs));
    this.resolveId(draft, 'object', record.id);
    this.endState(draft, state, record.id, date);
    this.writeOutputs(draft, date, resulting, balance);
    const operation: ApplyOperation = {
      kind: 'stockConversion',
      conversion: record.data as unknown as OcfStockConversion,
      resulting: resulting.map(nativeIssuance),
      balance: balance === null ? null : nativeIssuance(balance),
    };
    this.step(draft, unit, 'apply', operation, this.bundleSecurities([securityId], resulting, balance));
  }

  /**
   * A reissuance retires the whole security. Into its own class it conserves the quantity; one that names a split is
   * same-class and yields the post-split quantity, the split having been applied to the source first.
   */
  private reissuance(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const date = readDate(record, 'date');
    const securityId = readText(record, 'security_id');
    const splitId = readOptionalText(record, 'split_transaction_id');
    let state = this.beginEvent(draft, securityId, date, false);
    requireNoHolds(state);
    const resulting = this.resultingIssuances(unit, readTextList(record, 'resulting_security_ids'));
    const allSameClass = resulting.every((issuance) => issuance.stock_class_id === state.stock_class_id);
    if (splitId !== null && !allSameClass) {
      refuse('class', `reissuance ${record.id} names a split, so its resulting securities stay in the source's class`);
    }
    if (allSameClass && sumUnits(resulting.map((issuance) => issuance.quantity)) !== toUnits(state.quantity)) {
      refuse(
        'conservation',
        `same-class reissuance ${record.id} must conserve the quantity ${showDaml(toUnits(state.quantity))}`
      );
    }
    const outputs = resulting.filter((issuance) => issuance.stock_class_id === state.stock_class_id).map(outputVesting);
    state = this.snapshotFor(draft, state, date, outputs, record.id, false);
    check(checkOutputsVesting(date, `reissuance ${record.id}`, [state], outputs));
    this.resolveId(draft, 'object', record.id);
    this.endState(draft, state, record.id, date);
    this.writeOutputs(draft, date, resulting, null);
    if (splitId !== null) this.checkSplitOfClass(draft, `Stock reissuance ${record.id}`, splitId, state, date);
    const operation: ApplyOperation = {
      kind: 'stockReissuance',
      reissuance: record.data as unknown as OcfStockReissuance,
      resulting: resulting.map(nativeIssuance),
    };
    this.step(draft, unit, 'apply', operation, this.bundleSecurities([securityId], resulting, null));
  }

  /** The reference a reissuance's split must satisfy (`RequireSplitOfClass`). */
  private checkSplitOfClass(
    draft: Draft,
    label: string,
    splitId: string,
    state: StockSecurityState,
    onOrBefore: string
  ): void {
    const split = this.order.records.get(splitId);
    if (split?.objectType !== 'TX_STOCK_CLASS_SPLIT') {
      refuse('split_reference', `${label} split transaction not found: ${splitId}`);
    }
    const stockClassId = split.data['stock_class_id'];
    if (stockClassId !== state.stock_class_id) {
      refuse(
        'split_reference',
        `${label} split ${splitId} is of stock class ${String(stockClassId)}, not ${state.stock_class_id}`
      );
    }
    const splitDate = dateOf(split.data['date']);
    if (splitDate === null || splitDate > onOrBefore) {
      refuse('split_reference', `${label} split ${splitId} is dated after the reissuance`);
    }
    if (!(draft.splits(state.stock_class_id) ?? []).some((recorded) => recorded.split_id === splitId)) {
      refuse('split_reference', `${label} split ${splitId} is not recorded on its class's epoch`);
    }
  }

  /**
   * A consolidation retires up to 50 securities of one stakeholder and class into one resulting security of that
   * stakeholder and class that holds their sum. Its IDs derive from its first input.
   */
  private consolidation(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const date = readDate(record, 'date');
    const securityIds = readTextList(record, 'security_ids');
    const resultingId = readText(record, 'resulting_security_id');
    if (securityIds.length === 0) refuse('resulting_securities', 'a consolidation needs at least one security');
    if (securityIds.length > MAX_LOTS_PER_OPERATION) {
      refuse('resulting_securities', `a consolidation takes at most ${MAX_LOTS_PER_OPERATION} securities`);
    }
    if (new Set(securityIds).size !== securityIds.length) {
      refuse('resulting_securities', 'a consolidation names each security once');
    }
    const sources = securityIds.map((securityId) => this.beginEvent(draft, securityId, date, false));
    sources.forEach(requireNoHolds);
    const [first] = sources;
    if (first === undefined) return refuse('resulting_securities', 'a consolidation needs at least one security');
    if (!sources.every((source) => source.stock_class_id === first.stock_class_id)) {
      refuse('class', "a consolidation's securities share one class");
    }
    if (!sources.every((source) => source.stakeholder_id === first.stakeholder_id)) {
      refuse('class', "a consolidation's securities share one stakeholder");
    }
    const [resultingRecord] = unit.resulting;
    if (resultingRecord === undefined || resultingRecord === null) {
      return refuse(
        'resulting_securities',
        `consolidation ${record.id} must write its resulting security ${resultingId}`
      );
    }
    const resulting = readIssuance(resultingRecord);
    if (resulting.stock_class_id !== first.stock_class_id) {
      refuse('class', "a consolidation's resulting security stays in its inputs' class");
    }
    if (resulting.stakeholder_id !== first.stakeholder_id) {
      refuse('class', "a consolidation's resulting security stays with its inputs' stakeholder");
    }
    if (toUnits(resulting.quantity) !== sumUnits(sources.map((source) => source.quantity))) {
      refuse('conservation', `consolidation ${record.id} must yield the sum of its inputs`);
    }
    // Lots on vesting terms are checked as if the TA's snapshots said they had fully vested.
    const checked = sources.map((source) =>
      source.vesting.kind === 'on_terms' ? { ...source, snapshot: { as_of: date, vested: source.quantity } } : source
    );
    check(checkOutputsVesting(date, `consolidation ${record.id}`, checked, [outputVesting(resulting)]));
    this.resolveId(draft, 'object', record.id);
    for (const source of sources) this.endState(draft, source, record.id, date);
    this.addOutputIssuance(draft, date, resulting);
    const operation: ApplyOperation = {
      kind: 'stockConsolidation',
      consolidation: record.data as unknown as OcfStockConsolidation,
      resultingIssuance: nativeIssuance(resulting),
    };
    this.step(draft, unit, 'apply', operation, this.bundleSecurities(securityIds, [resulting], null));
  }

  private bundleSecurities(sources: readonly string[], resulting: readonly Issuance[], balance: Issuance | null) {
    return [
      ...sources,
      ...resulting.map((issuance) => issuance.security_id),
      ...(balance === null ? [] : [balance.security_id]),
    ];
  }

  // ===== The hold pair and draws (extended export) =====

  /** Only the register writes the hold pair, always under the book's derived IDs. */
  private requireRegisterWritten(record: ReplayRecord): void {
    if (this.capTableId !== undefined && !this.derivedForm(record.id)) {
      refuse(
        'hold',
        `${record.objectType} ${record.id} is not the register's: its ID lacks this cap table's derived form`
      );
    }
  }

  /** A hold placed by `CapTable_PlaceHolds`: a non-terminal event on the lot's state under a derived ID. */
  private hold(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const securityId = readText(record, 'security_id');
    const date = readDate(record, 'date');
    const holdType = readText(record, 'hold_type');
    if (holdType !== 'REGISTER_SETTLEMENT' && holdType !== 'STOP_TRANSFER') {
      refuse('malformed_record', `TX_STOCK_HOLD ${record.id}: hold_type must be REGISTER_SETTLEMENT or STOP_TRANSFER`);
    }
    const reference = readText(record, 'reference');
    const quantity = readOptionalDecimal(record, 'quantity');
    if (reference === '') refuse('hold', 'a hold needs a reference');
    this.requireRegisterWritten(record);
    const state = this.beginEvent(draft, securityId, date, false);
    if (state.holds.some((hold) => hold.reference === reference)) {
      refuse('hold', `reference ${reference} is already open on security ${securityId}`);
    }
    draft.use('object', record.id);
    let { holds } = state;
    if (holdType === 'REGISTER_SETTLEMENT') {
      if (isStopped(state)) refuse('hold', `security ${securityId} is stopped`);
      if (settlementHolds(state).length > 0) refuse('hold', `security ${securityId} already carries a settlement hold`);
      if (!fullyCovered(state)) {
        refuse('tranche_cover', `security ${securityId} has tranches covering less than its quantity`);
      }
      if (quantity === null) return refuse('hold', 'a settlement hold needs a quantity');
      // On vesting terms the vested quantity is the TA's snapshot, which the replay does not see.
      const vested = toUnits(vestedAt(state, date));
      const q = toUnits(quantity);
      if (q <= 0n || (state.vesting.kind !== 'on_terms' && q > vested)) {
        refuse(
          'hold',
          `settlement hold of ${showDaml(q)} on security ${securityId} must be positive and at most its vested ${showDaml(vested)}`
        );
      }
    } else {
      if (quantity !== null) refuse('hold', 'a stop holds the whole security and takes no quantity');
      const [settlement] = settlementHolds(state);
      const { companion } = unit;
      if (settlement !== undefined) {
        if (companion?.data['hold_id'] !== settlement.hold_id) {
          refuse(
            'hold',
            `stop ${record.id} cancels settlement hold ${settlement.hold_id}, whose cancellation is missing`
          );
        }
        draft.use('object', companion.id);
        holds = holds.filter((hold) => hold.hold_id !== settlement.hold_id);
      } else if (companion !== null) {
        refuse('hold', `hold ${String(companion.data['hold_id'])} is not open on security ${securityId}`);
      }
    }
    if (holds.length >= MAX_HOLDS_PER_SECURITY) {
      refuse('hold', `security ${securityId} already carries ${MAX_HOLDS_PER_SECURITY} holds`);
    }
    const hold: OpenHold = {
      hold_id: record.id,
      hold_type: holdType satisfies HoldType,
      reference,
      split_epoch: state.split_epoch,
      quantity,
    };
    this.putState(draft, { ...successor(state), holds: [...holds, hold], derived_ids: true });
    this.step(draft, unit, 'hold', null, [securityId]);
  }

  /** A hold canceled by `CapTable_CancelHolds` or a settlement: a non-terminal event on the lot's state. */
  private holdCancellation(draft: Draft, unit: ReplayUnit): void {
    const { record } = unit;
    const securityId = readText(record, 'security_id');
    const holdId = readText(record, 'hold_id');
    if (readText(record, 'reason_text') === '') refuse('hold', 'a hold cancellation needs a reason');
    this.requireRegisterWritten(record);
    const state = this.beginEvent(draft, securityId, readDate(record, 'date'), false);
    if (findHold(holdId, state) === null) refuse('hold', `hold ${holdId} is not open on security ${securityId}`);
    draft.use('object', record.id);
    this.putState(draft, {
      ...successor(state),
      holds: state.holds.filter((hold) => hold.hold_id !== holdId),
      derived_ids: true,
    });
    this.step(draft, unit, 'holdCancellation', null, [securityId]);
  }

  /**
   * A settlement's draw, as `CapTable_Settle` wrote it: a terminal event on a lot under its settlement hold, with the
   * buyer's issuance (fully vested, carrying the delivery record on its state) and the seller's balance.
   */
  private draw(
    draft: Draft,
    unit: ReplayUnit,
    state: StockSecurityState,
    transfer: { date: string; quantity: string; named: string[]; namedBalance: string | null }
  ): void {
    const { record } = unit;
    const { date } = transfer;
    const securityId = state.security_id;
    if (isStopped(state)) refuse('hold', `security ${securityId} is stopped`);
    const [hold] = settlementHolds(state);
    if (hold === undefined) return refuse('held', `security ${securityId} carries no settlement hold`);
    if (hold.split_epoch !== splitsOnOrBefore(this.requireSplits(draft, state.stock_class_id), date)) {
      refuse('hold', `a split of the class voided hold ${hold.hold_id}`);
    }
    if (!fullyCovered(state)) {
      refuse('tranche_cover', `security ${securityId} has tranches covering less than its quantity`);
    }
    const q = toUnits(transfer.quantity);
    const held = hold.quantity === null ? 0n : toUnits(hold.quantity);
    if (q <= 0n || q > held || q > toUnits(state.quantity)) {
      refuse('hold', `draw of ${showDaml(q)} must be positive and at most hold ${hold.hold_id}'s quantity`);
    }
    const resulting = this.resultingIssuances(unit, transfer.named);
    const [buyer] = resulting;
    if (buyer === undefined || resulting.length !== 1) {
      return refuse('hold', `settlement transfer ${record.id} delivers exactly one buyer issuance`);
    }
    const balance = this.balanceOf(unit);
    this.checkBalance(state, transfer.quantity, transfer.namedBalance, balance);
    if (toUnits(buyer.quantity) !== q || buyer.stock_class_id !== state.stock_class_id) {
      refuse('conservation', `the buyer issuance of transfer ${record.id} must hold its quantity in the lot's class`);
    }
    if (buyer.stakeholder_id === state.stakeholder_id)
      refuse('hold', 'the buyer and the seller are the same stakeholder');
    if (buyer.vestings.length > 0 || buyer.vesting_terms_id !== null) {
      refuse('hold', `the buyer issuance ${buyer.id} of a settlement carries no vesting`);
    }
    if (balance !== null && state.vesting.kind === 'tranches') {
      const expected = drawTranches(transfer.quantity, state.vesting.tranches);
      if (!sameTranches(sortTranches(balance.vestings), expected)) {
        refuse('hold', `balance ${balance.id} must keep the tranches the draw leaves on security ${securityId}`);
      }
    }
    this.resolveId(draft, 'object', record.id);
    this.endState(draft, state, record.id, date);
    const buyerState = this.addOutputIssuance(draft, date, buyer);
    this.putState(draft, {
      ...buyerState,
      delivery: { reference: hold.reference, seller_stakeholder_id: state.stakeholder_id, transfer_id: record.id },
    });
    if (balance !== null) this.addOutputIssuance(draft, date, balance);
    this.step(draft, unit, 'draw', null, this.bundleSecurities([securityId], resulting, balance));
  }

  // ===== Warrants, convertibles and equity compensation =====

  /** The ledger's refusal of a reference to a security no issuance of the expected types carries. */
  private missingReference(label: string, securityId: string): never {
    const creator = this.order.creators.get(securityId);
    const carried =
      creator === undefined || !this.accepted.has(creator)
        ? null
        : instrumentOfIssuance(creator.record.objectType) === null
          ? 'TX_STOCK_ISSUANCE'
          : creator.record.objectType;
    return refuse(
      'reference',
      carried === null
        ? `${label} security not found: ${securityId}`
        : `${label} security ${securityId} is carried by a ${showObjectType(carried as OcfObjectType)}`
    );
  }

  private trackInstrument(draft: Draft, record: ReplayRecord, spec: InstrumentEventSpec, securityId: string): void {
    const instrument = draft.instrument(securityId);
    if (instrument?.kind !== spec.kind) return this.missingReference(spec.label, securityId);
    draft.setInstrument(trackInstrumentEvent(instrument, record, spec));
  }
}

/**
 * Replay a book's OCF under the OpenCapTable-v35 rules, off the ledger.
 *
 * The manifest is replayed in the order a replication writes it (the units rule and same-day dependencies; see
 * `orderReplay`), each accepted record or bundled stock event becoming a step with the `CapTable_Apply` operation that
 * writes it, each refused one a violation with the rule it breaks and the ledger's message. The result holds every
 * active stock security's expected state, the securities events ended, each class's splits and the lifecycle of
 * every warrant, convertible and equity-compensation security, which the register keeps no state for.
 *
 * The manifest should be normalised as the source's records will be written (plan-security aliases are read as equity
 * compensation, but their data is passed on as it is). The hold pair is replayed only when the manifest includes it
 * (an extended export).
 *
 * @param manifest - The book's OCF: `buildOcfManifest`'s, or a source database's records grouped the same way
 * @param options - The cap table ID, to recognise this book's derived IDs
 * @returns the steps, the expected states, the retired securities, the splits, the instruments and the violations
 *
 * @example
 * ```typescript
 * import { register } from '@open-captable-protocol/canton';
 *
 * const replay = register.replayOcf(manifest, { capTableId });
 * const [first] = replay.violations;
 * if (first !== undefined) throw new Error(`${first.rule}: ${first.message} (${first.recordIds.join(', ')})`);
 * ```
 */
export function replayOcf(manifest: OcfManifest, options: ReplayOcfOptions = {}): ReplayResult {
  return new OcfReplay(orderReplay(manifest), options.capTableId).run();
}
