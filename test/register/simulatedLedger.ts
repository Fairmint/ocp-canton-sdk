/**
 * A simulated OpenCapTable-v35 ledger for the replication tests: the fake ledger, whose unscripted anchor commands are
 * run against its own copy of the book. `CapTable_Apply` and `CapTable_Restate` run through the SDK's simulation of the
 * ledger's book (`WriteSimulation`: IDs, shards, references, the states a write creates and ends), with each stock
 * state an Apply creates taken from the replay of the book's records as they stand after the write; the class freezes
 * replace the epoch. Inputs that are no longer active, and what the simulation refuses, reject the command. Every
 * committed contract is a created event with its interface views, as the Ledger API serves it, so a writer's index
 * reads the book from the update stream.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import {
  emptyDelta,
  IndexView,
  stockClassEpochWire,
  stockSecurityWire,
  WriteSimulation,
  type BookDelta,
} from '../../src/register/bookSimulation';
import { claimHash, INITIAL_SHARD_PREFIXES, simulateClaim } from '../../src/register/ids';
import { InProcessLockProvider } from '../../src/register/locks';
import { canonicalDecimal } from '../../src/register/numeric';
import { RegisterIndex } from '../../src/register/registerIndex';
import { replayOcf } from '../../src/register/replay/replay';
import { splitsOnOrBefore } from '../../src/register/splits';
import { RegisterWriter, type RegisterWriterOptions } from '../../src/register/writer';
import type { OcfIssuer } from '../../src/types/native';
import type { StateRestatement, StockSecurityState, StockVesting } from '../../src/types/register';
import { manifestOfRecords } from '../../src/utils/cantonOcfExtractor';
import { ANCHOR, anchorExercise, decodeChoice } from '../capTable/capTableFixtures';
import { FakeLedger, steppingClock, type LedgerEffects } from './fakeLedger';
import { CONTEXT } from './registerFixtures';
import { anchorEvent, damlData, epochEvent, recordEvent, shardEvent, stateEvent } from './registerLedgerFixtures';
import { NOON_TODAY } from './writerFixtures';

type DamlStateRestatement = Fairmint.OpenCapTable.Restate.StateRestatement;
type DamlStockVesting = Fairmint.OpenCapTable.State.StockVesting;

interface ExerciseCommand {
  choice: string;
  choiceArgument: unknown;
}

function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function vestingToNative(vesting: DamlStockVesting): StockVesting {
  switch (vesting.tag) {
    case 'StockVestingNone':
      return { kind: 'none' };
    case 'StockVestingTranches':
      return {
        kind: 'tranches',
        tranches: vesting.value.map((tranche) => ({ date: tranche.date, amount: canonicalDecimal(tranche.amount) })),
      };
    case 'StockVestingOnTerms':
      return { kind: 'on_terms', vesting_terms_id: vesting.value };
  }
}

function restatementToNative(state: DamlStateRestatement): StateRestatement {
  return {
    security_id: state.security_id,
    issue_date: state.issue_date,
    last_event_date: state.last_event_date,
    origin_transaction_id: state.origin_transaction_id,
    quantity: canonicalDecimal(state.quantity),
    stakeholder_id: state.stakeholder_id,
    stock_class_id: state.stock_class_id,
    vesting: vestingToNative(state.vesting),
    snapshot:
      state.snapshot === null ? null : { as_of: state.snapshot.as_of, vested: canonicalDecimal(state.snapshot.vested) },
    accelerated_since_snapshot:
      state.accelerated_since_snapshot === null ? null : canonicalDecimal(state.accelerated_since_snapshot),
    seq: state.seq === null ? null : Number(state.seq),
  };
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export class SimulatedLedger {
  readonly ledger = new FakeLedger(0);
  private readonly copy = new RegisterIndex({ context: CONTEXT, offset: 0 });
  private contracts = 0;

  constructor() {
    this.ledger.effectsOf = ({ commands }) => this.effects(commands);
  }

  /** Create the cap table: its anchor, its issuer record and the 256 initial shards, the issuer's ID claimed. */
  setup(issuer: OcfIssuer): void {
    let shards: Map<string, ReadonlySet<string>> = new Map(INITIAL_SHARD_PREFIXES.map((prefix) => [prefix, new Set()]));
    ({ shards } = simulateClaim(shards, claimHash('object', issuer.id)));
    this.ledger.commit({
      created: [
        anchorEvent(ANCHOR, CONTEXT),
        recordEvent(`cid-${issuer.id}`, 'issuer', damlData('issuer', { ...issuer })),
        ...[...shards].map(([prefix, claimed]) => shardEvent(`shard-${prefix}`, prefix, [...claimed].sort())),
      ],
    });
  }

  /** A writer of the book over this ledger, its index read from the update stream on its first refresh. */
  writer(options: Partial<RegisterWriterOptions> = {}): RegisterWriter {
    return new RegisterWriter({
      ledger: this.ledger.asClient(),
      context: CONTEXT,
      transferAgent: CONTEXT.transfer_agent,
      index: new RegisterIndex({ context: CONTEXT, offset: 0 }),
      locks: new InProcessLockProvider(),
      clock: steppingClock(NOON_TODAY),
      outcome: { timeoutMs: 5_000, pollMs: 1_000 },
      lockTimeoutMs: 5_000,
      ...options,
    });
  }

  /** The anchor choices the ledger was asked to exercise, in order. */
  choices(): string[] {
    return this.ledger.submitted.map((submission) => {
      const [command] = submission.commands as Array<{ ExerciseCommand?: { choice?: string } }>;
      return command?.ExerciseCommand?.choice ?? '';
    });
  }

  /** The ledger's own copy of the book, brought current with every transaction committed so far. */
  get book(): RegisterIndex {
    for (const update of this.ledger.updates) {
      if (update.offset > this.copy.offset) this.copy.applyTransaction(update as never);
    }
    return this.copy;
  }

  private cid(kind: string, key: string): string {
    this.contracts += 1;
    return `sim-${this.contracts}-${kind}-${key}`;
  }

  private effects(commands: readonly unknown[]): LedgerEffects {
    const [command] = commands as Array<{ ExerciseCommand?: ExerciseCommand }>;
    const exercise = command?.ExerciseCommand;
    if (exercise === undefined) throw new Error('expected an exercise of the anchor');
    const { choice, choiceArgument } = exercise;
    switch (choice) {
      case 'CapTable_Apply': {
        const argument = decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Apply, choiceArgument);
        this.requireActive(argument.inputs);
        const simulation = new WriteSimulation(new IndexView(this.book), 'apply');
        argument.operations.forEach((operation, index) => simulation.apply(operation, index));
        simulation.finish();
        const delta = emptyDelta();
        simulation.commitTo(delta, (kind, key) => this.cid(kind, key));
        this.replayStates(delta);
        return this.flush(choice, choiceArgument, delta);
      }
      case 'CapTable_Restate': {
        const argument = decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_Restate, choiceArgument);
        this.requireActive(argument.inputs);
        const simulation = new WriteSimulation(new IndexView(this.book), 'restate');
        argument.operations.forEach((operation, index) =>
          simulation.restate(
            operation,
            operation.tag === 'RestateSetState' ? restatementToNative(operation.value) : null,
            index
          )
        );
        simulation.finish();
        const delta = emptyDelta();
        simulation.commitTo(delta, (kind, key) => this.cid(kind, key));
        return this.flush(choice, choiceArgument, delta);
      }
      case 'CapTable_FreezeClass':
      case 'CapTable_UnfreezeClass': {
        const argument = decodeChoice(Fairmint.OpenCapTable.CapTable.CapTable_FreezeClass, choiceArgument);
        const epoch = [...this.book.epochs()].find((candidate) => candidate.contractId === argument.epoch);
        if (epoch === undefined) throw new Error(`contract not active: ${argument.epoch}`);
        const frozen = choice === 'CapTable_FreezeClass';
        if (epoch.epoch.frozen === frozen) throw new Error(`stock class ${epoch.epoch.stock_class_id} is already so`);
        const contractId = this.cid('epoch', epoch.epoch.stock_class_id);
        const { splits } = stockClassEpochWire({ ...epoch.epoch, frozen }) as { splits: unknown[] };
        return {
          archived: [epoch.contractId],
          created: [epochEvent(contractId, epoch.epoch.stock_class_id, splits, { frozen })],
          exercised: [this.exercise(choice, choiceArgument, contractId)],
        };
      }
      default:
        throw new Error(`the simulated ledger does not run ${choice}`);
    }
  }

  private requireActive(inputs: Fairmint.OpenCapTable.Book.BookInputs): void {
    const ids = [...inputs.states, ...inputs.epochs, ...inputs.shards, ...inputs.records.map((record) => record.value)];
    for (const contractId of ids) {
      if (!this.book.contains(contractId)) throw new Error(`contract not active: ${contractId}`);
    }
  }

  /**
   * The stock states an Apply creates, with the fields the ledger's event rules compute (dates, split application,
   * vesting) taken from the replay of the book's records after the write; seq, holds and snapshots from the simulation.
   */
  private replayStates(delta: BookDelta): void {
    const records = new Map<string, { entityType: OcfEntityType; data: Record<string, unknown> }>();
    for (const record of this.book.records()) {
      if (record.data !== null) {
        records.set(record.objectId, { entityType: record.entityType, data: record.data as Record<string, unknown> });
      }
    }
    for (const [objectId, view] of delta.records) {
      if (view === null) {
        records.delete(objectId);
        continue;
      }
      const data = view.data();
      if (data === null) continue;
      const native = convertToOcf(view.entityType as never, data.value as never) as unknown as Record<string, unknown>;
      records.set(objectId, { entityType: view.entityType, data: native });
    }
    const replay = replayOcf(manifestOfRecords(records.values()), { capTableId: CONTEXT.cap_table_id });
    for (const [securityId, slot] of delta.states) {
      if (slot === null) continue;
      const replayed = replay.states.get(securityId);
      if (replayed === undefined) continue;
      const lastEventDate = maxDate(replayed.last_event_date, slot.state.last_event_date);
      const splits = replay.splits.get(replayed.stock_class_id) ?? [];
      const state: StockSecurityState = {
        ...slot.state,
        issue_date: replayed.issue_date,
        last_event_date: lastEventDate,
        origin_transaction_id: replayed.origin_transaction_id,
        quantity: replayed.quantity,
        split_epoch: splitsOnOrBefore(splits, lastEventDate),
        stakeholder_id: replayed.stakeholder_id,
        stock_class_id: replayed.stock_class_id,
        vesting: replayed.vesting,
      };
      delta.states.set(securityId, { contractId: slot.contractId, state });
    }
  }

  private flush(choice: string, choiceArgument: unknown, delta: BookDelta): LedgerEffects {
    const created: Array<Record<string, unknown>> = [];
    const archived: string[] = [];
    const result = {
      records: [] as unknown[],
      states: [] as unknown[],
      epochs: [] as unknown[],
      shards: [] as unknown[],
    };
    for (const [securityId, slot] of delta.states) {
      const old = this.book.stateOf(securityId);
      if (old !== null) archived.push(old.contractId);
      if (slot === null) continue;
      const { context: _context, ...payload } = stockSecurityWire(slot.state);
      created.push(stateEvent(slot.contractId, payload));
      result.states.push([securityId, slot.contractId]);
    }
    for (const [stockClassId, slot] of delta.epochs) {
      const old = this.book.epochOf(stockClassId);
      if (old !== null) archived.push(old.contractId);
      if (slot === null) continue;
      const { splits } = stockClassEpochWire(slot.epoch) as { splits: unknown[] };
      created.push(epochEvent(slot.contractId, stockClassId, splits, { frozen: slot.epoch.frozen }));
      result.epochs.push([stockClassId, slot.contractId]);
    }
    for (const [objectId, view] of delta.records) {
      const old = this.book.record(objectId);
      if (old !== null) archived.push(old.contractId);
      const data = view?.data() ?? null;
      if (view === null || data === null) continue;
      created.push(recordEvent(view.contractId, view.entityType, wire(data.value)));
      result.records.push([objectId, { tag: ENTITY_REGISTRY[view.entityType].cidTag, value: view.contractId }]);
    }
    for (const prefix of delta.removedShards) {
      const old = this.book.shardAt(prefix);
      if (old !== null) archived.push(old.contractId);
    }
    for (const [prefix, shard] of delta.shards) {
      created.push(shardEvent(shard.contractId, prefix, [...shard.claimed].sort()));
      result.shards.push([prefix, shard.contractId]);
    }
    // A DA.Map is encoded in key order.
    const byKey = (pairs: unknown[]): unknown[] =>
      [...(pairs as Array<[string, unknown]>)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const sorted = {
      records: byKey(result.records),
      states: byKey(result.states),
      epochs: byKey(result.epochs),
      shards: byKey(result.shards),
    };
    return { created, archived, exercised: [this.exercise(choice, choiceArgument, sorted)] };
  }

  private exercise(choice: string, choiceArgument: unknown, exerciseResult: unknown): Record<string, unknown> {
    const { ExercisedEvent: event } = anchorExercise(choice, exerciseResult, { choiceArgument });
    return event as Record<string, unknown>;
  }
}
