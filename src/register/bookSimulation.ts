/**
 * A simulation of one register write over a book: the working set of `Fairmint.OpenCapTable.Book`, driven by the
 * operations of `Apply.daml`, `Restate.daml` and `Holds.daml` with the ID resolution of `Events.daml`.
 *
 * It computes what the write must pass (the states it consumes or reads, the epochs of the classes it touches, the
 * shards that cover the IDs it claims or releases, the records its references point at), the IDs it claims and
 * releases, and the counters behind the per-transaction caps. It refuses, with the ledger's message, what the book
 * already shows the ledger would refuse about IDs and references; the ledger's checks of quantities, dates, vesting and
 * holds are not repeated here.
 *
 * Internal: it reads the generated payloads of the write's operations, so it stays behind the package boundary.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Book.daml
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, type OcpErrorCode } from '../errors/codes';
import { OcpValidationError } from '../errors/OcpValidationError';
import { ENTITY_REGISTRY } from '../functions/OpenCapTable/capTable/batchTypes';
import { applyOperationToDaml, restateOperationToDaml } from '../functions/OpenCapTable/capTable/choiceArguments';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml } from '../functions/OpenCapTable/capTable/ocfToDaml';
import type { HoldType, OcfObjectType, Vesting } from '../types/native';
import type {
  BookInputs,
  BookWrite,
  BookWriteUsage,
  CancelHold,
  ClaimedId,
  DerivedRole,
  DrawLot,
  IdNamespace,
  OpenHold,
  PlaceHoldLot,
  RegisterContext,
  RegisterRecord,
  RegisterRecordRef,
  RegisterRequirement,
  SettleBuyer,
  StateRestatement,
  StockClassEpochState,
  StockSecurityState,
  StockVesting,
} from '../types/register';
import { damlEnumConstructor } from '../utils/damlEnums';
import {
  claimHash,
  coveringShardPrefix,
  deriveId,
  isDerivedForm,
  simulateClaim,
  simulatePreSplit,
  simulateRelease,
} from './ids';
import { fromUnits, toUnits } from './numeric';
import {
  checkRecordCaps,
  checkRequirement,
  consumedSecurities,
  CONSUMING_ENTITY_TYPES,
  dedupRequirements,
  issuanceSecurityId,
  isVestingRecord,
  polymorphicReferenceCount,
  polymorphicRequirementsOf,
  recordEntityType,
  recordTranches,
  requirementKey,
  requirementsOfRecord,
  subjectSecurity,
  vestingTermsIdOf,
  type RecordData,
  type RequirementLookups,
} from './references';
import type { RegisterIndex } from './registerIndex';
import { settlementHolds, splitsOnOrBefore } from './splits';
import { drawTranches, sortTranches } from './vesting';

type DamlApplyOperation = Fairmint.OpenCapTable.Apply.ApplyOperation;
type DamlRestateOperation = Fairmint.OpenCapTable.Restate.RestateOperation;
type DamlStockIssuance = Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;

// ===== Payload sizes =====

/** The UTF-8 byte length of a value's JSON. */
export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

/** A decimal as the Ledger API writes a Daml `Numeric 10`: ten fractional digits. */
function numeric10(decimal: string): string {
  const [whole, fraction = ''] = decimal.split('.');
  return `${whole ?? ''}.${fraction.padEnd(10, '0')}`;
}

function stockVestingWire(vesting: StockVesting): unknown {
  switch (vesting.kind) {
    case 'none':
      return { tag: 'StockVestingNone', value: {} };
    case 'tranches':
      return {
        tag: 'StockVestingTranches',
        value: vesting.tranches.map((tranche) => ({ date: tranche.date, amount: numeric10(tranche.amount) })),
      };
    case 'on_terms':
      return { tag: 'StockVestingOnTerms', value: vesting.vesting_terms_id };
  }
}

/** The JSON size of a `StockSecurity` payload, as the Ledger API encodes it. */
export function stateBytes(state: StockSecurityState): number {
  return jsonBytes({
    context: state.context,
    security_id: state.security_id,
    issue_date: state.issue_date,
    last_event_date: state.last_event_date,
    origin_transaction_id: state.origin_transaction_id,
    quantity: numeric10(state.quantity),
    seq: String(state.seq),
    split_epoch: String(state.split_epoch),
    stakeholder_id: state.stakeholder_id,
    stock_class_id: state.stock_class_id,
    vesting: stockVestingWire(state.vesting),
    holds: state.holds.map((hold) => ({
      hold_id: hold.hold_id,
      hold_type: damlEnumConstructor('OcfHoldType', hold.hold_type),
      reference: hold.reference,
      split_epoch: String(hold.split_epoch),
      quantity: hold.quantity === null ? null : numeric10(hold.quantity),
    })),
    delivery: state.delivery,
    snapshot:
      state.snapshot === null ? null : { as_of: state.snapshot.as_of, vested: numeric10(state.snapshot.vested) },
    accelerated_since_snapshot:
      state.accelerated_since_snapshot === null ? null : numeric10(state.accelerated_since_snapshot),
    derived_ids: state.derived_ids,
  });
}

/** The JSON size of a `StockClassEpoch` payload. */
export function epochBytes(epoch: StockClassEpochState): number {
  return jsonBytes({
    context: epoch.context,
    stock_class_id: epoch.stock_class_id,
    frozen: epoch.frozen,
    splits: epoch.splits.map((split) => ({
      split_id: split.split_id,
      date: split.date,
      ratio: { numerator: numeric10(split.ratio.numerator), denominator: numeric10(split.ratio.denominator) },
    })),
  });
}

/** One claimed hash in an `OcfIdShard`'s `DA.Set` JSON: `["<64 hex digits>",{}]`. */
const SHARD_HASH_ENTRY_BYTES = 71;

/** The JSON size of an `OcfIdShard` payload holding `count` hashes. */
export function shardBytes(context: RegisterContext, prefix: string, count: number): number {
  return jsonBytes({ context, prefix, claimed: { map: [] } }) + count * SHARD_HASH_ENTRY_BYTES + Math.max(0, count - 1);
}

/** The JSON size of an OCF record contract's payload. */
export function recordBytes(context: RegisterContext, data: RecordData): number {
  return jsonBytes({ context, ocf_data: data.value });
}

function trancheCount(state: StockSecurityState): number {
  return state.vesting.kind === 'tranches' ? state.vesting.tranches.length : 0;
}

// ===== Views of a book =====

/** A stock state a view of the book holds. */
export interface ViewState {
  readonly contractId: string;
  readonly state: StockSecurityState;
}

/** A stock class epoch a view of the book holds. */
export interface ViewEpoch {
  readonly contractId: string;
  readonly epoch: StockClassEpochState;
}

/** An ID shard a view of the book holds. */
export interface ViewShard {
  readonly contractId: string;
  readonly prefix: string;
  readonly claimed: ReadonlySet<string>;
}

/** An OCF record a view of the book holds. */
export interface ViewRecord {
  readonly contractId: string;
  readonly entityType: OcfEntityType;
  readonly objectId: string;
  readonly objectType: OcfObjectType;
  /** The security an issuance carries; `null` for any other record */
  readonly securityId: string | null;
  /** The record as the ledger holds it, or `null` when the index keeps no payload */
  data(): RecordData | null;
  /** Its payload's JSON size (0 when the index keeps no payload) */
  bytes(): number;
}

/** What a simulated write reads of a book: a key index, or one with the effects of earlier planned batches. */
export interface BookView {
  readonly context: RegisterContext;
  state(securityId: string): ViewState | null;
  epoch(stockClassId: string): ViewEpoch | null;
  record(objectId: string): ViewRecord | null;
  issuance(securityId: string): ViewRecord | null;
  shardFor(hash: string): ViewShard | null;
  shardAt(prefix: string): ViewShard | null;
  /** Records that consumed the security (may include others that only name it, when the index keeps no payload) */
  consumers(securityId: string): ViewRecord[];
}

const ISSUANCE_ENTITY_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'warrantIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
]);

function holdRecordToDaml(record: RegisterRecord): RecordData | null {
  if (record.data === null) return null;
  if (record.entityType === 'stockHold') {
    const hold = record.data;
    return {
      tag: 'OcfRecordDataStockHold',
      value: {
        id: hold.id,
        date: hold.date,
        hold_type: damlEnumConstructor('OcfHoldType', hold.hold_type),
        reason_text: hold.reason_text,
        reference: hold.reference,
        security_id: hold.security_id,
        comments: hold.comments ?? [],
        quantity: hold.quantity ?? null,
      },
    };
  }
  const cancellation = record.data as RegisterRecordOfData<'stockHoldCancellation'>;
  return {
    tag: 'OcfRecordDataStockHoldCancellation',
    value: {
      id: cancellation.id,
      date: cancellation.date,
      hold_id: cancellation.hold_id,
      reason_text: cancellation.reason_text,
      security_id: cancellation.security_id,
      comments: cancellation.comments ?? [],
    },
  };
}

type RegisterRecordOfData<EntityType extends OcfEntityType> = NonNullable<
  Extract<RegisterRecord, { entityType: EntityType }>['data']
>;

/** A record of the index as a view record, its generated payload re-encoded from the native data on first use. */
function indexRecordView(context: RegisterContext, record: RegisterRecord): ViewRecord {
  let data: RecordData | null | undefined;
  let size: number | undefined;
  const view: ViewRecord = {
    contractId: record.contractId,
    entityType: record.entityType,
    objectId: record.objectId,
    objectType: record.objectType,
    securityId: ISSUANCE_ENTITY_TYPES.has(record.entityType) ? (record.securityIds[0] ?? null) : null,
    data: () => {
      if (data === undefined) {
        if (record.data === null) data = null;
        else if (record.entityType === 'stockHold' || record.entityType === 'stockHoldCancellation') {
          data = holdRecordToDaml(record);
        } else {
          // The entity kind and the native data come from one admitted record; the union cannot be re-correlated.
          data = convertToDaml(record.entityType, record.data as never);
        }
      }
      return data;
    },
    bytes: () => {
      if (size === undefined) {
        const payload = view.data();
        size = payload === null ? 0 : recordBytes(context, payload);
      }
      return size;
    },
  };
  return view;
}

/** A key index as a view of its book. */
export class IndexView implements BookView {
  readonly context: RegisterContext;
  private readonly index: RegisterIndex;
  private readonly views = new Map<string, ViewRecord>();
  private consumerIndex: Map<string, ViewRecord[]> | null = null;

  constructor(index: RegisterIndex) {
    this.index = index;
    this.context = index.context;
  }

  state(securityId: string): ViewState | null {
    const entry = this.index.stateOf(securityId);
    return entry === null ? null : { contractId: entry.contractId, state: entry.state };
  }

  epoch(stockClassId: string): ViewEpoch | null {
    const entry = this.index.epochOf(stockClassId);
    return entry === null ? null : { contractId: entry.contractId, epoch: entry.epoch };
  }

  record(objectId: string): ViewRecord | null {
    const entry = this.index.record(objectId);
    return entry === null ? null : this.view(entry);
  }

  issuance(securityId: string): ViewRecord | null {
    const entry = this.index.issuanceOf(securityId);
    return entry === null ? null : this.view(entry);
  }

  shardFor(hash: string): ViewShard | null {
    const entry = this.index.shardFor(hash);
    return entry === null
      ? null
      : { contractId: entry.contractId, prefix: entry.shard.prefix, claimed: new Set(entry.shard.claimed) };
  }

  shardAt(prefix: string): ViewShard | null {
    const entry = this.index.shardAt(prefix);
    return entry === null
      ? null
      : { contractId: entry.contractId, prefix: entry.shard.prefix, claimed: new Set(entry.shard.claimed) };
  }

  consumers(securityId: string): ViewRecord[] {
    if (this.consumerIndex === null) {
      const consumers = new Map<string, ViewRecord[]>();
      for (const record of this.index.records()) {
        if (!CONSUMING_ENTITY_TYPES.has(record.entityType)) continue;
        const view = this.view(record);
        const payload = view.data();
        for (const consumed of payload === null ? record.securityIds : consumedSecurities(payload)) {
          const list = consumers.get(consumed);
          if (list === undefined) consumers.set(consumed, [view]);
          else list.push(view);
        }
      }
      this.consumerIndex = consumers;
    }
    return [...(this.consumerIndex.get(securityId) ?? [])];
  }

  private view(record: RegisterRecord): ViewRecord {
    let view = this.views.get(record.contractId);
    if (view === undefined) {
      view = indexRecordView(this.context, record);
      this.views.set(record.contractId, view);
    }
    return view;
  }
}

/** The contracts earlier planned batches create and archive, keyed as a view keys them. */
export interface BookDelta {
  states: Map<string, ViewState | null>;
  epochs: Map<string, ViewEpoch | null>;
  records: Map<string, ViewRecord | null>;
  securities: Map<string, string | null>;
  shards: Map<string, ViewShard>;
  removedShards: Set<string>;
}

export function emptyDelta(): BookDelta {
  return {
    states: new Map(),
    epochs: new Map(),
    records: new Map(),
    securities: new Map(),
    shards: new Map(),
    removedShards: new Set(),
  };
}

/** A view of a book as it will be once earlier planned batches commit: the base view with their delta on top. */
export class OverlayView implements BookView {
  readonly context: RegisterContext;
  private readonly base: BookView;
  private readonly delta: BookDelta;

  constructor(base: BookView, delta: BookDelta) {
    this.base = base;
    this.delta = delta;
    this.context = base.context;
  }

  state(securityId: string): ViewState | null {
    const changed = this.delta.states.get(securityId);
    return changed !== undefined ? changed : this.base.state(securityId);
  }

  epoch(stockClassId: string): ViewEpoch | null {
    const changed = this.delta.epochs.get(stockClassId);
    return changed !== undefined ? changed : this.base.epoch(stockClassId);
  }

  record(objectId: string): ViewRecord | null {
    const changed = this.delta.records.get(objectId);
    return changed !== undefined ? changed : this.base.record(objectId);
  }

  issuance(securityId: string): ViewRecord | null {
    const objectId = this.delta.securities.get(securityId);
    if (objectId === undefined) return this.base.issuance(securityId);
    return objectId === null ? null : (this.delta.records.get(objectId) ?? null);
  }

  shardFor(hash: string): ViewShard | null {
    const prefix = coveringShardPrefix(hash, this.delta.shards);
    if (prefix !== null) return this.delta.shards.get(prefix) ?? null;
    const shard = this.base.shardFor(hash);
    return shard === null || this.delta.removedShards.has(shard.prefix) ? null : shard;
  }

  shardAt(prefix: string): ViewShard | null {
    const shard = this.delta.shards.get(prefix);
    if (shard !== undefined) return shard;
    return this.delta.removedShards.has(prefix) ? null : this.base.shardAt(prefix);
  }

  consumers(securityId: string): ViewRecord[] {
    const fromBase = this.base
      .consumers(securityId)
      .filter((record) => this.delta.records.get(record.objectId) === undefined);
    const fromDelta = [...this.delta.records.values()].filter((record): record is ViewRecord => {
      const payload = record?.data() ?? null;
      return payload !== null && consumedSecurities(payload).includes(securityId);
    });
    return [...fromBase, ...fromDelta];
  }
}

// ===== The working set =====

interface StateSlot {
  original: ViewState | null;
  archived: boolean;
  current: StockSecurityState | null;
  dirty: boolean;
  /** What the flush creates for the slot: its payload's size and its tranches */
  bytes: number;
  tranches: number;
}

interface EpochSlot {
  original: ViewEpoch | null;
  archived: boolean;
  current: StockClassEpochState | null;
  dirty: boolean;
  bytes: number;
}

interface RecordEntry {
  readonly objectId: string;
  readonly entityType: OcfEntityType;
  readonly securityId: string | null;
  /** The view record it was loaded from; `null` when this write created it */
  readonly loaded: ViewRecord | null;
  data(): RecordData | null;
  readonly bytes: number;
}

/** Which choice a simulation runs, for its caps and its deferred checks. */
export type SimulatedChoice = 'apply' | 'restate' | 'placeHolds' | 'cancelHolds' | 'settle';

type Pending =
  | { kind: 'end'; securityId: string; derivedIds: boolean }
  | { kind: 'recreate'; securityId: string }
  | { kind: 'issuanceGone'; objectId: string; securityId: string };

const STATELESS_VESTING_TARGETS: OcfObjectType[] = ['TX_WARRANT_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'];

function refuse(
  fieldPath: string,
  message: string,
  classification: string,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): never {
  throw new OcpValidationError(fieldPath, message, { code, classification });
}

/** A stock state's vesting as an issuance creates it (`vestingOfIssuance`). */
function vestingOfIssuance(issuance: DamlStockIssuance): StockVesting {
  if (issuance.vestings.length > 0) {
    return {
      kind: 'tranches',
      tranches: sortTranches(issuance.vestings.map((tranche) => ({ date: tranche.date, amount: tranche.amount }))),
    };
  }
  return issuance.vesting_terms_id === null
    ? { kind: 'none' }
    : { kind: 'on_terms', vesting_terms_id: issuance.vesting_terms_id };
}

/** The next state after a non-terminal event (`successor`). */
function successor(state: StockSecurityState): StockSecurityState {
  return { ...state, seq: state.seq + 1, delivery: null };
}

/**
 * One write simulated over a view of its book, operation by operation, as the ledger runs it. The inputs it reports
 * are the contracts the view holds that the write needs, in the order its operations first need them.
 */
export class WriteSimulation {
  readonly view: BookView;
  readonly choice: SimulatedChoice;
  private readonly context: RegisterContext;
  private path = 'operations';

  private readonly states = new Map<string, StateSlot>();
  private readonly epochs = new Map<string, EpochSlot>();
  private shardClaims: Map<string, ReadonlySet<string>> = new Map();
  private readonly shardOriginals = new Map<string, ViewShard>();
  private readonly loadedShards = new Set<string>();
  private readonly createdShardBytes = new Map<string, number>();
  private readonly records = new Map<string, RecordEntry | null>();
  private readonly securities = new Map<string, string | null>();
  private readonly loadedRecords = new Map<string, RecordEntry>();
  private readonly loadedSecurities = new Map<string, RecordEntry>();
  private readonly createdRecords = new Set<string>();
  private readonly requirements: RegisterRequirement[] = [];
  private unresolved: RegisterRequirement[] = [];

  private readonly inputStates: string[] = [];
  private readonly inputEpochs: string[] = [];
  private readonly inputShards: string[] = [];
  private readonly inputRecords: RegisterRecordRef[] = [];
  private readonly fetched = new Set<string>();
  readonly claimed: ClaimedId[] = [];
  readonly released: ClaimedId[] = [];
  readonly originIssuances = new Map<string, string>();
  buyer: SettleBuyer | null = null;

  // Restatement progress
  private readonly touchedIds = new Set<string>();
  private readonly deleted = new Map<string, RecordData>();
  private pending: Pending[] = [];

  // Counters
  private operations = 0;
  private claims = 0;
  private tranches = 0;
  private polymorphic = 0;
  private touched = 0;
  private dirtyStates = 0;
  private dirtyEpochs = 0;
  private createdShards = 0;
  private pendingStateTranches = 0;
  private inputBytes = 0;
  private createdRecordBytes = 0;
  private pendingBytes = 0;
  private argumentBytes = 0;
  private readonly recordCaps: string[] = [];
  private finished = false;

  constructor(view: BookView, choice: SimulatedChoice) {
    this.view = view;
    this.choice = choice;
    this.context = view.context;
  }

  // ----- Results -----

  /** The contracts the write must pass. */
  inputs(): BookInputs {
    return {
      states: [...this.inputStates],
      epochs: [...this.inputEpochs],
      shards: [...this.inputShards],
      records: this.inputRecords.map((ref) => ({ ...ref })),
    };
  }

  /** The caps the write uses so far, the flush included. */
  usage(): BookWriteUsage {
    return {
      operations: this.operations,
      claims: this.claims,
      shardsCreated: this.createdShards,
      tranches: this.tranches + this.pendingStateTranches,
      polymorphicReferences: this.polymorphic,
      contractsTouched: this.touched + this.dirtyStates + this.dirtyEpochs + this.createdShards,
      bytes: this.inputBytes + this.createdRecordBytes + this.pendingBytes + this.argumentBytes,
      recordCaps: [...this.recordCaps],
    };
  }

  // ----- CapTable_Apply -----

  /** Runs one `CapTable_Apply` operation. */
  apply(operation: DamlApplyOperation, index: number): void {
    this.beginOperation(operation, index);
    switch (operation.tag) {
      case 'ApplyRecord':
        this.applyRecord(operation.value);
        break;
      case 'ApplyStockTransfer': {
        const { transfer, resulting, balance } = operation.value;
        const source = this.beginEvent(transfer.security_id);
        this.writeEventRecord(source, transfer.id, { tag: 'OcfRecordDataStockTransfer', value: transfer });
        this.endState(source.security_id);
        this.writeOutputs(source, resulting, balance);
        break;
      }
      case 'ApplyStockCancellation': {
        const { cancellation, balance } = operation.value;
        this.applyReduction(
          { tag: 'OcfRecordDataStockCancellation', value: cancellation },
          cancellation.id,
          cancellation.security_id,
          balance
        );
        break;
      }
      case 'ApplyStockRepurchase': {
        const { repurchase, balance } = operation.value;
        this.applyReduction(
          { tag: 'OcfRecordDataStockRepurchase', value: repurchase },
          repurchase.id,
          repurchase.security_id,
          balance
        );
        break;
      }
      case 'ApplyStockConversion': {
        const { conversion, resulting, balance } = operation.value;
        const source = this.beginEvent(conversion.security_id);
        this.writeEventRecord(source, conversion.id, { tag: 'OcfRecordDataStockConversion', value: conversion });
        this.endState(source.security_id);
        this.writeOutputs(source, resulting, balance);
        break;
      }
      case 'ApplyStockReissuance': {
        const { reissuance, resulting } = operation.value;
        const source = this.beginEvent(reissuance.security_id);
        this.writeEventRecord(source, reissuance.id, { tag: 'OcfRecordDataStockReissuance', value: reissuance });
        if (reissuance.split_transaction_id !== null) {
          this.addRequirements([
            {
              kind: 'split_of_class',
              label: `Stock reissuance ${reissuance.id}`,
              split_id: reissuance.split_transaction_id,
              stock_class_id: source.stock_class_id,
              on_or_before: reissuance.date,
            },
          ]);
        }
        this.endState(source.security_id);
        this.writeOutputs(source, resulting, null);
        break;
      }
      case 'ApplyStockConsolidation': {
        const { consolidation, resulting_issuance: resultingIssuance } = operation.value;
        const sources = consolidation.security_ids.map((securityId) => this.beginEvent(securityId));
        const [first] = sources;
        if (first === undefined) refuse(this.path, 'a consolidation needs at least one security', 'invalid_operation');
        this.writeEventRecord(first, consolidation.id, {
          tag: 'OcfRecordDataStockConsolidation',
          value: consolidation,
        });
        for (const source of sources) this.endState(source.security_id);
        this.addOutputIssuance(first, ['resulting_issuance', 'resulting_security', 0], resultingIssuance);
        break;
      }
      case 'ApplyVestingSnapshot': {
        const { security_id: securityId, as_of: asOf, vested } = operation.value;
        const state = this.beginEvent(securityId);
        this.replaceState({
          ...successor(state),
          snapshot: { as_of: asOf, vested },
          accelerated_since_snapshot: null,
        });
        break;
      }
      case 'ApplyPreSplitShard':
        this.preSplitShard(operation.value.prefix);
        break;
    }
    this.resolveRequirementTargets();
  }

  private applyRecord(data: RecordData): void {
    if (data.tag === 'OcfRecordDataStockIssuance') {
      const epoch = this.requireEpoch(data.value.stock_class_id);
      this.writeStatelessRecord(data, []);
      this.addState(this.stateForIssuance(epoch, data.value.date, data.value));
    } else if (data.tag === 'OcfRecordDataStockClass') {
      this.writeStatelessRecord(data, []);
      this.addEpoch({ context: this.context, stock_class_id: data.value.id, frozen: false, splits: [] });
    } else if (data.tag === 'OcfRecordDataStockClassSplit') {
      const epoch = this.requireEpoch(data.value.stock_class_id);
      this.writeStatelessRecord(data, []);
      this.replaceEpoch({
        ...epoch,
        splits: [
          ...epoch.splits,
          { split_id: data.value.id, date: data.value.date, ratio: { ...data.value.split_ratio } },
        ],
      });
    } else if (data.tag === 'OcfRecordDataStockAcceptance') {
      const state = this.beginEvent(data.value.security_id);
      this.writeEventRecord(state, data.value.id, data);
      this.replaceState(this.successorAfter(state, data.value.id));
    } else if (data.tag === 'OcfRecordDataStockRetraction') {
      const state = this.beginEvent(data.value.security_id);
      this.writeEventRecord(state, data.value.id, data);
      this.endState(state.security_id);
    } else if (data.tag === 'OcfRecordDataVestingStart' || data.tag === 'OcfRecordDataVestingEvent') {
      // Vesting starts and events are events on a stock lot's state when the write holds one.
      if (this.lookupState(data.value.security_id) === null) {
        this.writeStatelessRecord(data, [this.nonStockVestingTarget(data.value.security_id)]);
        return;
      }
      const state = this.beginEvent(data.value.security_id);
      this.writeEventRecord(state, data.value.id, data);
      this.replaceState(this.successorAfter(state, data.value.id));
    } else if (data.tag === 'OcfRecordDataVestingAcceleration') {
      const { security_id: securityId, id, date, quantity } = data.value;
      if (this.lookupState(securityId) === null) {
        this.writeStatelessRecord(data, [this.nonStockVestingTarget(securityId)]);
        return;
      }
      const state = this.beginEvent(securityId);
      this.writeEventRecord(state, id, data);
      // An acceleration moves shares to its date, so it adds at most one tranche; the ledger computes the amounts.
      const next = this.successorAfter(state, id);
      if (state.vesting.kind === 'tranches') {
        next.vesting = { kind: 'tranches', tranches: [...state.vesting.tranches, { date, amount: quantity }] };
      } else if (state.vesting.kind === 'on_terms') {
        const earlier = toUnits(state.accelerated_since_snapshot ?? '0', 'state.accelerated_since_snapshot');
        next.accelerated_since_snapshot = fromUnits(earlier + toUnits(quantity, 'quantity'));
      }
      this.replaceState(next);
    } else {
      this.writeStatelessRecord(data, []);
    }
  }

  private nonStockVestingTarget(securityId: string): RegisterRequirement {
    return {
      kind: 'security',
      label: 'Vesting record (no stock state in this write)',
      security_id: securityId,
      object_types: [...STATELESS_VESTING_TARGETS],
    };
  }

  private applyReduction(data: RecordData, id: string, securityId: string, balance: DamlStockIssuance | null): void {
    const source = this.beginEvent(securityId);
    this.writeEventRecord(source, id, data);
    this.endState(source.security_id);
    this.writeOutputs(source, [], balance);
  }

  // ----- CapTable_Restate -----

  /** Runs one `CapTable_Restate` operation (`native` for a restated state, the rest from its encoding). */
  restate(operation: DamlRestateOperation, native: StateRestatement | null, index: number): void {
    this.beginOperation(operation, index);
    switch (operation.tag) {
      case 'RestateEdit':
        this.restateEdit(operation.value);
        break;
      case 'RestateDelete':
        this.restateDelete(operation.value);
        break;
      case 'RestateSetState':
        if (native === null) throw new Error('RestateSetState needs its native state');
        this.restateSetState(native);
        break;
      case 'RestateEndState': {
        const state = this.requireState(operation.value);
        this.requireEpoch(state.stock_class_id);
        this.endState(operation.value);
        this.pending = [{ kind: 'end', securityId: operation.value, derivedIds: state.derived_ids }, ...this.pending];
        break;
      }
    }
  }

  private touch(objectId: string): void {
    if (this.touchedIds.has(objectId)) {
      refuse(this.path, `record ${objectId} is edited or deleted more than once in one restatement`, 'restated_twice');
    }
    this.touchedIds.add(objectId);
  }

  private refuseProtected(objectId: string, objectType: OcfObjectType): void {
    if (isDerivedForm(this.context.cap_table_id, objectId)) {
      refuse(
        this.path,
        `record ${objectId} was written by a register choice and is never restated; correct it with a new record`,
        'protected_record'
      );
    }
    if (objectType === 'TX_STOCK_CLASS_SPLIT') {
      refuse(this.path, `split ${objectId} is never restated; rebuild the book to correct it`, 'protected_record');
    }
    if (objectType === 'TX_STOCK_HOLD' || objectType === 'TX_STOCK_HOLD_CANCELLATION') {
      refuse(this.path, 'hold records are never restated', 'protected_record');
    }
  }

  private restateEdit(data: RecordData): void {
    const objectId = data.value.id;
    this.touch(objectId);
    const old = this.requireRecord(objectId);
    this.refuseProtected(objectId, ENTITY_REGISTRY[old.entityType].objectType);
    const oldData = this.payloadOf(old);
    const from = subjectSecurity(oldData);
    const to = subjectSecurity(data);
    const moved: RegisterRequirement[] = [];
    if (from !== to && from !== null && to !== null && isVestingRecord(data)) {
      // Where a moved vesting record was is a fact about the book as loaded.
      const label = `Moved vesting record ${objectId}`;
      const failure = checkRequirement(this.loadedLookups(), {
        kind: 'security',
        label: `${label} (from)`,
        security_id: from,
        object_types: [...STATELESS_VESTING_TARGETS],
      });
      if (failure !== null) refuse(this.path, failure, 'missing_reference', OcpErrorCodes.CONTRACT_NOT_FOUND);
      moved.push({ kind: 'security', label, security_id: to, object_types: [...STATELESS_VESTING_TARGETS] });
    }
    const oldSecurity = issuanceSecurityId(oldData);
    const newSecurity = issuanceSecurityId(data);
    this.removeRecord(objectId);
    if (oldSecurity !== newSecurity) {
      if (oldSecurity !== null) this.releaseId('security', oldSecurity);
      if (newSecurity !== null) this.claimId('security', newSecurity);
    }
    const oldRequirements = new Set(requirementsOfRecord(oldData).map(requirementKey));
    const added = requirementsOfRecord(data).filter((requirement) => !oldRequirements.has(requirementKey(requirement)));
    const oldPolymorphic = new Set(polymorphicRequirementsOf(oldData).map(requirementKey));
    const addedPolymorphic = polymorphicRequirementsOf(data).filter(
      (requirement) => !oldPolymorphic.has(requirementKey(requirement))
    );
    const grown = polymorphicReferenceCount(data) - polymorphicReferenceCount(oldData);
    this.countPolymorphicReferences(Math.max(grown, addedPolymorphic.length));
    this.addRecord(data);
    this.addRequirements([...added, ...moved]);
  }

  private restateDelete(objectId: string): void {
    this.touch(objectId);
    const old = this.requireRecord(objectId);
    const { objectType } = ENTITY_REGISTRY[old.entityType];
    this.refuseProtected(objectId, objectType);
    if (objectType === 'ISSUER') {
      refuse(this.path, 'the issuer record is never deleted; tear the book down instead', 'protected_record');
    }
    const oldData = this.payloadOf(old);
    if (old.entityType === 'stockClass') {
      this.requireEpoch(objectId);
      this.removeEpoch(objectId);
    }
    this.removeRecord(objectId);
    this.releaseId('object', objectId);
    const securityId = issuanceSecurityId(oldData);
    if (old.entityType === 'stockIssuance' && securityId !== null) {
      this.pending = [{ kind: 'issuanceGone', objectId, securityId }, ...this.pending];
    } else if (securityId !== null) {
      this.releaseId('security', securityId);
    }
    this.deleted.set(objectId, oldData);
  }

  private restateSetState(restated: StateRestatement): void {
    const epoch = this.requireEpoch(restated.stock_class_id);
    const base: StockSecurityState = {
      context: this.context,
      security_id: restated.security_id,
      issue_date: restated.issue_date,
      last_event_date: restated.last_event_date,
      origin_transaction_id: restated.origin_transaction_id,
      quantity: restated.quantity,
      seq: 0,
      split_epoch: splitsOnOrBefore(epoch.splits, restated.last_event_date),
      stakeholder_id: restated.stakeholder_id,
      stock_class_id: restated.stock_class_id,
      vesting: restated.vesting,
      holds: [],
      delivery: null,
      snapshot: restated.snapshot,
      accelerated_since_snapshot: restated.accelerated_since_snapshot,
      derived_ids: true,
    };
    const old = this.lookupState(restated.security_id);
    const seq = restated.seq ?? null;
    if (old !== null && seq === null) {
      if (old.stock_class_id !== restated.stock_class_id) this.requireEpoch(old.stock_class_id);
      this.replaceState({ ...base, seq: old.seq + 1, holds: old.holds, derived_ids: old.derived_ids });
    } else if (old !== null) {
      refuse(
        this.path,
        `security ${restated.security_id} has an active state; replace it without a seq`,
        'active_state'
      );
    } else if (seq !== null) {
      this.addState({ ...base, seq });
      this.pending = [{ kind: 'recreate', securityId: restated.security_id }, ...this.pending];
    } else {
      refuse(
        this.path,
        `no active state for security ${restated.security_id}; give a seq to recreate one`,
        'missing_state',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
  }

  // Releases the security IDs the restatement may release and reads the consumer a stock issuance's delete relies on
  // (`resolvePending`, in the ledger's order: newest first).
  private resolvePending(): void {
    for (const item of this.pending) {
      if (item.kind !== 'issuanceGone') continue;
      const ended = this.pending.find(
        (other): other is Extract<Pending, { kind: 'end' }> =>
          other.kind === 'end' && other.securityId === item.securityId
      );
      if (ended !== undefined) {
        if (!ended.derivedIds && !isDerivedForm(this.context.cap_table_id, item.securityId)) {
          this.releaseId('security', item.securityId);
        }
        continue;
      }
      if (this.hasConsumerInWrite(item.securityId)) continue;
      const deletedConsumer = [...this.deleted.values()].some((data) =>
        consumedSecurities(data).includes(item.securityId)
      );
      const recreated = this.pending.some((other) => other.kind === 'recreate' && other.securityId === item.securityId);
      if (deletedConsumer && !recreated) continue;
      const consumer = this.view.consumers(item.securityId).find((record) => !this.records.has(record.objectId));
      if (consumer !== undefined) this.loadRecord(consumer);
    }
  }

  private hasConsumerInWrite(securityId: string): boolean {
    for (const entry of this.records.values()) {
      if (entry === null) continue;
      const payload = entry.data();
      if (payload !== null && consumedSecurities(payload).includes(securityId)) return true;
    }
    return false;
  }

  // ----- Holds and settlement -----

  /** Runs `CapTable_PlaceHolds`, recording each settlement lot's origin issuance. */
  placeHolds(
    holdType: HoldType,
    reference: string,
    date: string,
    reasonText: string,
    lots: readonly PlaceHoldLot[]
  ): void {
    for (const [index, lot] of lots.entries()) {
      this.beginOperation(lot, index, 'lots');
      const state = this.beginEvent(lot.security_id);
      const holdId = this.derive(state, 'hold');
      let current = state;
      if (holdType === 'REGISTER_SETTLEMENT') {
        this.readOrigin(state, lot.origin_issuance ?? null);
      } else {
        const settlement = settlementHolds(state);
        const [only] = settlement;
        if (settlement.length === 1 && only !== undefined) {
          this.addRecord(
            this.holdCancellationRecord(state, only.hold_id, date, `Canceled by stop ${reference}: ${reasonText}`)
          );
          current = { ...state, holds: state.holds.filter((hold) => hold.hold_id !== only.hold_id) };
        }
      }
      this.addRecord({
        tag: 'OcfRecordDataStockHold',
        value: {
          id: holdId,
          date,
          hold_type: damlEnumConstructor('OcfHoldType', holdType),
          reason_text: reasonText,
          reference,
          security_id: state.security_id,
          comments: [],
          quantity: lot.quantity ?? null,
        },
      });
      const hold: OpenHold = {
        hold_id: holdId,
        hold_type: holdType,
        reference,
        split_epoch: current.split_epoch,
        quantity: lot.quantity ?? null,
      };
      this.replaceState({ ...successor(current), holds: [...current.holds, hold], derived_ids: true });
    }
  }

  /** Runs `CapTable_CancelHolds`. */
  cancelHolds(date: string, holds: readonly CancelHold[]): void {
    for (const [index, hold] of holds.entries()) {
      this.beginOperation(hold, index, 'holds');
      this.cancelOne(hold, date);
    }
  }

  private cancelOne(hold: CancelHold, date: string): void {
    const state = this.beginEvent(hold.security_id);
    this.addRecord(this.holdCancellationRecord(state, hold.hold_id, date, hold.reason_text));
    this.replaceState({
      ...successor(state),
      holds: state.holds.filter((open) => open.hold_id !== hold.hold_id),
      derived_ids: true,
    });
  }

  private holdCancellationRecord(state: StockSecurityState, holdId: string, date: string, reason: string): RecordData {
    return {
      tag: 'OcfRecordDataStockHoldCancellation',
      value: {
        id: this.derive(state, 'hold_cancellation'),
        date,
        hold_id: holdId,
        reason_text: reason,
        security_id: state.security_id,
        comments: [],
      },
    };
  }

  /**
   * Runs `CapTable_Settle`. A buyer named by stakeholder ID is resolved to its record's contract; a new one claims its
   * stakeholder ID.
   */
  settle(
    settlementId: string,
    date: string,
    buyer: SettleBuyer | { kind: 'existingStakeholder'; stakeholderId: string },
    lots: ReadonlyArray<{ kind: 'draw'; lot: DrawLot } | { kind: 'cancel'; hold: CancelHold }>
  ): void {
    this.path = 'lots';
    for (const lot of lots) if (lot.kind === 'draw') this.requireState(lot.lot.security_id);
    let buyerId: string;
    if (buyer.kind === 'new') {
      this.path = 'buyer';
      const data = convertToDaml('stakeholder', buyer.stakeholder);
      this.claimId('object', data.value.id);
      this.addRecord(data);
      buyerId = data.value.id;
      this.buyer = buyer;
    } else if (buyer.kind === 'existingStakeholder') {
      const record = this.view.record(buyer.stakeholderId);
      if (record?.entityType !== 'stakeholder') {
        refuse(
          'buyer',
          `the buyer's stakeholder ${buyer.stakeholderId} is not on the book`,
          'missing_reference',
          OcpErrorCodes.CONTRACT_NOT_FOUND
        );
      }
      this.fetchDirect(record.contractId, record.bytes());
      buyerId = buyer.stakeholderId;
      this.buyer = { kind: 'existing', contractId: record.contractId };
    } else {
      // Named by its contract alone: its stakeholder ID only sizes the buyer's issuance, so it is left out.
      buyerId = '';
      this.buyer = buyer;
    }
    for (const [index, lot] of lots.entries()) {
      this.beginOperation(lot, index, 'lots');
      if (lot.kind === 'draw') this.drawOne(lot.lot, settlementId, date, buyerId);
      else this.cancelOne(lot.hold, date);
    }
  }

  private drawOne(lot: DrawLot, settlementId: string, date: string, buyerId: string): void {
    const state = this.beginEvent(lot.security_id);
    const origin = this.readOrigin(state, lot.origin_issuance);
    const transferId = this.derive(state, 'event');
    const buyerSecurityId = this.derive(state, 'resulting_security');
    const remaining = toUnits(state.quantity, 'state.quantity') - toUnits(lot.quantity, 'lot.quantity');
    const balanceSecurityId = remaining > 0n ? this.derive(state, 'balance_security') : null;
    this.addRecord({
      tag: 'OcfRecordDataStockTransfer',
      value: {
        id: transferId,
        date,
        quantity: lot.quantity,
        security_id: state.security_id,
        comments: [],
        resulting_security_ids: [buyerSecurityId],
        balance_security_id: balanceSecurityId,
        consideration_text: null,
      },
    });
    const buyerIssuance: DamlStockIssuance = {
      ...origin,
      id: this.derive(state, 'resulting_issuance'),
      custom_id: lot.custom_id,
      date,
      quantity: lot.quantity,
      security_id: buyerSecurityId,
      share_price: lot.share_price,
      stakeholder_id: buyerId,
      comments: [],
      share_numbers_issued: [],
      vestings: [],
      consideration_text: null,
      cost_basis: lot.buyer_cost_basis,
      vesting_terms_id: null,
    };
    this.addRecord({ tag: 'OcfRecordDataStockIssuance', value: buyerIssuance });
    this.endState(state.security_id);
    const epoch = this.requireEpoch(state.stock_class_id);
    this.addState({
      ...this.stateForIssuance(epoch, date, buyerIssuance),
      delivery: { reference: settlementId, seller_stakeholder_id: state.stakeholder_id, transfer_id: transferId },
    });
    if (balanceSecurityId === null) return;
    const vestings: Vesting[] =
      state.vesting.kind === 'tranches'
        ? drawTranches(lot.quantity, state.vesting.tranches)
        : state.vesting.kind === 'on_terms'
          ? lot.balance_vestings
          : [];
    const balance: DamlStockIssuance = {
      ...origin,
      id: this.derive(state, 'balance_issuance'),
      custom_id: balanceSecurityId,
      date,
      quantity: fromUnits(remaining),
      security_id: balanceSecurityId,
      comments: [],
      share_numbers_issued: [],
      vestings: vestings.map((tranche) => ({ date: tranche.date, amount: tranche.amount })),
      cost_basis: lot.balance_cost_basis,
      vesting_terms_id: null,
    };
    this.addRecord({ tag: 'OcfRecordDataStockIssuance', value: balance });
    this.addState(this.stateForIssuance(epoch, date, balance));
  }

  // The origin issuance a hold or draw fetches by contract ID: read, so its tranches count; not a book input.
  private readOrigin(state: StockSecurityState, given: string | null): DamlStockIssuance {
    const origin = this.view.record(state.origin_transaction_id);
    const payload = origin?.data() ?? null;
    if (origin === null || payload?.tag !== 'OcfRecordDataStockIssuance') {
      refuse(
        this.path,
        `security ${state.security_id}'s origin issuance ${state.origin_transaction_id} is not on the book`,
        'missing_origin',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
    const contractId = given ?? origin.contractId;
    this.originIssuances.set(state.security_id, contractId);
    this.tranches += payload.value.vestings.length;
    this.fetchDirect(contractId, origin.bytes());
    return payload.value;
  }

  private fetchDirect(contractId: string, bytes: number): void {
    if (this.fetched.has(contractId)) return;
    this.fetched.add(contractId);
    this.inputBytes += bytes;
  }

  // ----- Finishing -----

  /**
   * Runs the checks that need the whole write: a restatement's pending releases, then every deferred requirement
   * against the final working set (`checkRequirements`). Idempotent.
   *
   * @throws OcpValidationError with the ledger's message for the first requirement that fails
   */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.path = 'operations';
    if (this.choice === 'restate') this.resolvePending();
    const lookups = this.lookups();
    for (const requirement of dedupRequirements(this.requirements)) {
      const failure = checkRequirement(lookups, requirement);
      if (failure !== null) refuse(this.path, failure, 'missing_reference', OcpErrorCodes.CONTRACT_NOT_FOUND);
    }
  }

  /**
   * What the write leaves behind, for the next planned batch: its created and archived contracts under the
   * placeholder contract IDs `contractIdFor` gives.
   */
  commitTo(delta: BookDelta, contractIdFor: (kind: string, key: string) => string): void {
    for (const [securityId, slot] of this.states) {
      if (slot.current === null) delta.states.set(securityId, null);
      else if (slot.dirty) {
        delta.states.set(securityId, { contractId: contractIdFor('state', securityId), state: slot.current });
      }
    }
    for (const [stockClassId, slot] of this.epochs) {
      if (slot.current === null) delta.epochs.set(stockClassId, null);
      else if (slot.dirty) {
        delta.epochs.set(stockClassId, { contractId: contractIdFor('epoch', stockClassId), epoch: slot.current });
      }
    }
    for (const [objectId, entry] of this.records) {
      if (entry === null) delta.records.set(objectId, null);
      else if (this.createdRecords.has(objectId)) {
        const { objectType } = ENTITY_REGISTRY[entry.entityType];
        delta.records.set(objectId, {
          contractId: contractIdFor('record', objectId),
          entityType: entry.entityType,
          objectId,
          objectType,
          securityId: entry.securityId,
          data: () => entry.data(),
          bytes: () => entry.bytes,
        });
      }
    }
    for (const [securityId, objectId] of this.securities) {
      if (objectId === null || this.createdRecords.has(objectId)) delta.securities.set(securityId, objectId);
    }
    for (const prefix of this.loadedShards) {
      if (this.shardOriginals.has(prefix)) continue;
      delta.shards.delete(prefix);
      delta.removedShards.add(prefix);
    }
    for (const [prefix, claimed] of this.shardClaims) {
      if (this.shardOriginals.has(prefix)) continue;
      delta.shards.set(prefix, { contractId: contractIdFor('shard', prefix), prefix, claimed });
    }
  }

  // ----- Operations' shared steps (Events.daml) -----

  private beginOperation(argument: unknown, index: number, list = 'operations'): void {
    this.path = `${list}[${index}]`;
    this.operations += 1;
    this.argumentBytes += jsonBytes(argument) + 1;
  }

  private derive(state: StockSecurityState, role: DerivedRole, index = 0): string {
    return deriveId({
      capTableId: this.context.cap_table_id,
      securityId: state.security_id,
      seq: state.seq,
      role,
      index,
    });
  }

  /** Brings a security's state to an event: its state and its class's epoch must be in the write (`beginEvent`). */
  private beginEvent(securityId: string): StockSecurityState {
    const state = this.requireState(securityId);
    this.requireEpoch(state.stock_class_id);
    return state;
  }

  /** Claims an ID an event writes unless it is the derived ID for its role (`resolveId`). */
  private resolveId(
    namespace: IdNamespace,
    source: StockSecurityState,
    role: DerivedRole,
    index: number,
    given: string
  ): void {
    if (given !== this.derive(source, role, index)) this.claimId(namespace, given);
  }

  private successorAfter(state: StockSecurityState, id: string): StockSecurityState {
    return { ...successor(state), derived_ids: state.derived_ids || id === this.derive(state, 'event') };
  }

  private stateForIssuance(
    epoch: StockClassEpochState,
    eventDate: string,
    issuance: DamlStockIssuance
  ): StockSecurityState {
    return {
      context: this.context,
      security_id: issuance.security_id,
      issue_date: issuance.date,
      last_event_date: eventDate,
      origin_transaction_id: issuance.id,
      quantity: issuance.quantity,
      seq: 0,
      split_epoch: splitsOnOrBefore(epoch.splits, eventDate),
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

  private claimRecordIds(data: RecordData): void {
    this.claimId('object', data.value.id);
    const securityId = issuanceSecurityId(data);
    if (securityId !== null) this.claimId('security', securityId);
  }

  private writeStatelessRecord(data: RecordData, extra: RegisterRequirement[]): void {
    this.claimRecordIds(data);
    this.countPolymorphicReferences(polymorphicReferenceCount(data));
    this.addRecord(data);
    this.addRequirements([...requirementsOfRecord(data), ...extra]);
  }

  private writeEventRecord(state: StockSecurityState, id: string, data: RecordData): void {
    this.resolveId('object', state, 'event', 0, id);
    this.addRecord(data);
    this.addRequirements(requirementsOfRecord(data));
  }

  private writeOutputs(
    source: StockSecurityState,
    resulting: DamlStockIssuance[],
    balance: DamlStockIssuance | null
  ): void {
    for (const [index, issuance] of resulting.entries()) {
      this.addOutputIssuance(source, ['resulting_issuance', 'resulting_security', index], issuance);
    }
    if (balance !== null) this.addOutputIssuance(source, ['balance_issuance', 'balance_security', 0], balance);
  }

  private addOutputIssuance(
    source: StockSecurityState,
    [issuanceRole, securityRole, index]: [DerivedRole, DerivedRole, number],
    issuance: DamlStockIssuance
  ): void {
    this.resolveId('object', source, issuanceRole, index, issuance.id);
    this.resolveId('security', source, securityRole, index, issuance.security_id);
    const epoch = this.requireEpoch(issuance.stock_class_id);
    const data: RecordData = { tag: 'OcfRecordDataStockIssuance', value: issuance };
    this.addRecord(data);
    this.addState(this.stateForIssuance(epoch, issuance.date, issuance));
    this.addRequirements(requirementsOfRecord(data));
  }

  // ----- States -----

  private setStateSlot(slot: StateSlot, current: StockSecurityState | null, dirty: boolean): void {
    if (slot.dirty && slot.current !== null) {
      this.dirtyStates -= 1;
      this.pendingBytes -= slot.bytes;
      this.pendingStateTranches -= slot.tranches;
    }
    slot.current = current;
    slot.dirty = dirty;
    if (dirty && current !== null) {
      slot.bytes = stateBytes(current);
      slot.tranches = trancheCount(current);
      this.dirtyStates += 1;
      this.pendingBytes += slot.bytes;
      this.pendingStateTranches += slot.tranches;
    }
  }

  /** The security's current state in the write, read from the book on first use (`lookupState`). */
  private lookupState(securityId: string): StockSecurityState | null {
    const slot = this.states.get(securityId);
    if (slot !== undefined) return slot.current;
    const found = this.view.state(securityId);
    if (found === null) return null;
    this.states.set(securityId, {
      original: found,
      archived: false,
      current: found.state,
      dirty: false,
      bytes: 0,
      tranches: 0,
    });
    this.inputStates.push(found.contractId);
    this.inputBytes += stateBytes(found.state) + jsonBytes(found.contractId) + 1;
    this.tranches += trancheCount(found.state);
    return found.state;
  }

  private requireState(securityId: string): StockSecurityState {
    const state = this.lookupState(securityId);
    if (state === null) {
      refuse(
        this.path,
        `no active state for security ${securityId} in this write`,
        'missing_state',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
    return state;
  }

  private consumeStateSlot(securityId: string): StateSlot {
    const slot = this.states.get(securityId);
    if (slot?.current == null) {
      refuse(
        this.path,
        `no active state for security ${securityId} in this write`,
        'missing_state',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
    if (slot.original !== null && !slot.archived) {
      slot.archived = true;
      this.touched += 1;
    }
    return slot;
  }

  private replaceState(state: StockSecurityState): void {
    this.setStateSlot(this.consumeStateSlot(state.security_id), state, true);
  }

  private endState(securityId: string): void {
    this.setStateSlot(this.consumeStateSlot(securityId), null, false);
  }

  private addState(state: StockSecurityState): void {
    if (this.states.has(state.security_id)) {
      refuse(this.path, `security ${state.security_id} already has a state in this write`, 'duplicate_state');
    }
    const slot: StateSlot = { original: null, archived: false, current: null, dirty: false, bytes: 0, tranches: 0 };
    this.states.set(state.security_id, slot);
    this.setStateSlot(slot, state, true);
  }

  // ----- Epochs -----

  private setEpochSlot(slot: EpochSlot, current: StockClassEpochState | null, dirty: boolean): void {
    if (slot.dirty && slot.current !== null) {
      this.dirtyEpochs -= 1;
      this.pendingBytes -= slot.bytes;
    }
    slot.current = current;
    slot.dirty = dirty;
    if (dirty && current !== null) {
      slot.bytes = epochBytes(current);
      this.dirtyEpochs += 1;
      this.pendingBytes += slot.bytes;
    }
  }

  private requireEpoch(stockClassId: string): StockClassEpochState {
    let slot = this.epochs.get(stockClassId);
    if (slot === undefined) {
      const found = this.view.epoch(stockClassId);
      if (found !== null) {
        slot = { original: found, archived: false, current: found.epoch, dirty: false, bytes: 0 };
        this.epochs.set(stockClassId, slot);
        this.inputEpochs.push(found.contractId);
        this.inputBytes += epochBytes(found.epoch) + jsonBytes(found.contractId) + 1;
      }
    }
    if (slot?.current == null) {
      refuse(
        this.path,
        `no active epoch for stock class ${stockClassId} in this write`,
        'missing_epoch',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
    return slot.current;
  }

  private consumeEpochSlot(stockClassId: string): EpochSlot {
    this.requireEpoch(stockClassId);
    const slot = this.epochs.get(stockClassId);
    if (slot === undefined) throw new Error(`no epoch slot for ${stockClassId}`);
    if (slot.original !== null && !slot.archived) {
      slot.archived = true;
      this.touched += 1;
    }
    return slot;
  }

  private replaceEpoch(epoch: StockClassEpochState): void {
    this.setEpochSlot(this.consumeEpochSlot(epoch.stock_class_id), epoch, true);
  }

  private removeEpoch(stockClassId: string): void {
    this.setEpochSlot(this.consumeEpochSlot(stockClassId), null, false);
  }

  private addEpoch(epoch: StockClassEpochState): void {
    if (this.epochs.has(epoch.stock_class_id)) {
      refuse(this.path, `stock class ${epoch.stock_class_id} already has an epoch in this write`, 'duplicate_epoch');
    }
    const slot: EpochSlot = { original: null, archived: false, current: null, dirty: false, bytes: 0 };
    this.epochs.set(epoch.stock_class_id, slot);
    this.setEpochSlot(slot, epoch, true);
  }

  // ----- Records -----

  private loadRecord(view: ViewRecord): RecordEntry {
    const entry: RecordEntry = {
      objectId: view.objectId,
      entityType: view.entityType,
      securityId: view.securityId,
      loaded: view,
      data: () => view.data(),
      bytes: view.bytes(),
    };
    this.records.set(view.objectId, entry);
    this.loadedRecords.set(view.objectId, entry);
    if (entry.securityId !== null) {
      this.securities.set(entry.securityId, view.objectId);
      this.loadedSecurities.set(entry.securityId, entry);
    }
    const ref = { entityType: view.entityType, contractId: view.contractId };
    this.inputRecords.push(ref);
    this.inputBytes +=
      entry.bytes + jsonBytes({ tag: ENTITY_REGISTRY[view.entityType].cidTag, value: view.contractId }) + 1;
    const payload = view.data();
    if (payload !== null) this.tranches += recordTranches(payload);
    return entry;
  }

  /** The record with an object ID in the write, read from the book on first use (`lookupRecord`). */
  private lookupRecord(objectId: string): RecordEntry | null {
    const entry = this.records.get(objectId);
    if (entry !== undefined) return entry;
    const found = this.view.record(objectId);
    return found === null ? null : this.loadRecord(found);
  }

  /** The issuance carrying a security in the write, read from the book on first use (`lookupSecurity`). */
  private lookupSecurity(securityId: string): RecordEntry | null {
    const objectId = this.securities.get(securityId);
    if (objectId !== undefined) return objectId === null ? null : (this.records.get(objectId) ?? null);
    const found = this.view.issuance(securityId);
    if (found === null || this.records.has(found.objectId)) return null;
    return this.loadRecord(found);
  }

  private requireRecord(objectId: string): RecordEntry {
    const entry = this.lookupRecord(objectId);
    if (entry === null) {
      refuse(this.path, `record ${objectId} is not in this write`, 'missing_record', OcpErrorCodes.CONTRACT_NOT_FOUND);
    }
    return entry;
  }

  private payloadOf(entry: RecordEntry): RecordData {
    const payload = entry.data();
    if (payload === null) {
      refuse(
        this.path,
        `record ${entry.objectId} has no payload in the index; resolve this write from an index read with retainPayloads`,
        'register_payload_required',
        OcpErrorCodes.REQUIRED_FIELD_MISSING
      );
    }
    return payload;
  }

  private addRecord(data: RecordData): void {
    const capFailure = checkRecordCaps(data);
    if (capFailure !== null) this.recordCaps.push(capFailure);
    const objectId = data.value.id;
    if (this.records.get(objectId) != null) {
      refuse(this.path, `ID already used: ${objectId}`, 'claimed_id_used', OcpErrorCodes.OUT_OF_RANGE);
    }
    const securityId = issuanceSecurityId(data);
    if (securityId !== null && this.securities.get(securityId) != null) {
      refuse(this.path, `security ID already used: ${securityId}`, 'claimed_id_used', OcpErrorCodes.OUT_OF_RANGE);
    }
    const size = recordBytes(this.context, data);
    this.tranches += recordTranches(data);
    this.touched += 1;
    this.createdRecordBytes += size;
    this.records.set(objectId, {
      objectId,
      entityType: recordEntityType(data),
      securityId,
      loaded: null,
      data: () => data,
      bytes: size,
    });
    if (securityId !== null) this.securities.set(securityId, objectId);
    this.createdRecords.add(objectId);
  }

  private removeRecord(objectId: string): void {
    const entry = this.requireRecord(objectId);
    this.touched += 1;
    if (this.createdRecords.delete(objectId)) this.createdRecordBytes -= entry.bytes;
    this.records.set(objectId, null);
    if (entry.securityId !== null) this.securities.set(entry.securityId, null);
  }

  // ----- Claimed IDs and shards -----

  private coveringShard(hash: string, id: string): string {
    const prefix = coveringShardPrefix(hash, this.shardClaims);
    if (prefix !== null) return prefix;
    const found = this.view.shardFor(hash);
    if (found === null) {
      refuse(
        this.path,
        `no shard in this write covers the ID ${id}`,
        'missing_shard',
        OcpErrorCodes.CONTRACT_NOT_FOUND
      );
    }
    this.loadShard(found);
    return found.prefix;
  }

  private loadShard(shard: ViewShard): void {
    this.shardClaims.set(shard.prefix, shard.claimed);
    this.shardOriginals.set(shard.prefix, shard);
    this.loadedShards.add(shard.prefix);
    this.inputShards.push(shard.contractId);
    this.inputBytes += shardBytes(this.context, shard.prefix, shard.claimed.size) + jsonBytes(shard.contractId) + 1;
  }

  private applyShardStep(step: {
    shards: Map<string, ReadonlySet<string>>;
    consumed: string;
    created: string[];
  }): void {
    if (this.shardOriginals.delete(step.consumed)) {
      this.touched += 1;
    } else {
      this.createdShards -= 1;
      this.pendingBytes -= this.createdShardBytes.get(step.consumed) ?? 0;
      this.createdShardBytes.delete(step.consumed);
    }
    for (const prefix of step.created) {
      const size = shardBytes(this.context, prefix, step.shards.get(prefix)?.size ?? 0);
      this.createdShards += 1;
      this.createdShardBytes.set(prefix, size);
      this.pendingBytes += size;
    }
    this.shardClaims = step.shards;
  }

  /**
   * Claims a writer-chosen ID in the shard that covers its hash (`claimId`).
   *
   * @throws OcpValidationError with the ledger's message for an empty ID, one in this book's derived form, or one the
   * book (or this write) already claims
   */
  private claimId(namespace: IdNamespace, id: string): void {
    if (id === '') refuse(this.path, 'an empty ID cannot be claimed', 'empty_claim');
    if (isDerivedForm(this.context.cap_table_id, id)) {
      refuse(this.path, `ID ${id} has this cap table's derived form and cannot be claimed`, 'derived_form_claim');
    }
    this.claims += 1;
    const hash = claimHash(namespace, id);
    const prefix = this.coveringShard(hash, id);
    if (this.shardClaims.get(prefix)?.has(hash) === true) {
      refuse(
        this.path,
        `${namespace === 'security' ? 'security ID' : 'ID'} already used: ${id}`,
        'claimed_id_used',
        OcpErrorCodes.OUT_OF_RANGE
      );
    }
    this.applyShardStep(simulateClaim(this.shardClaims, hash));
    this.claimed.push({ namespace, id });
  }

  /** Releases the ID of a record a restatement deletes (`releaseId`). */
  private releaseId(namespace: IdNamespace, id: string): void {
    const hash = claimHash(namespace, id);
    const prefix = this.coveringShard(hash, id);
    if (this.shardClaims.get(prefix)?.has(hash) !== true) {
      refuse(this.path, `ID ${id} is not claimed`, 'unclaimed_id', OcpErrorCodes.OUT_OF_RANGE);
    }
    this.applyShardStep(simulateRelease(this.shardClaims, hash));
    this.released.push({ namespace, id });
  }

  private preSplitShard(prefix: string): void {
    if (!this.shardClaims.has(prefix)) {
      const found = this.view.shardAt(prefix);
      if (found === null) {
        refuse(
          this.path,
          `no shard with prefix ${prefix} in this write`,
          'missing_shard',
          OcpErrorCodes.CONTRACT_NOT_FOUND
        );
      }
      this.loadShard(found);
    }
    this.applyShardStep(simulatePreSplit(this.shardClaims, prefix));
  }

  // ----- Counters and requirements -----

  private countPolymorphicReferences(count: number): void {
    this.polymorphic += count;
  }

  private addRequirements(requirements: readonly RegisterRequirement[]): void {
    this.requirements.push(...requirements);
    this.unresolved.push(...requirements);
  }

  /**
   * Reads, as each operation ends, the records the requirements so far point at, so the counters include them; a
   * target a later operation creates is looked for again after each operation.
   */
  private resolveRequirementTargets(): void {
    const lookups = this.lookups();
    this.unresolved = this.unresolved.filter((requirement) => !this.targetsFound(lookups, requirement));
  }

  private targetsFound(lookups: RequirementLookups, requirement: RegisterRequirement): boolean {
    switch (requirement.kind) {
      case 'object':
        return lookups.record(requirement.object_id) !== null;
      case 'plan_includes_class':
        return lookups.record(requirement.stock_plan_id) !== null;
      case 'ratio_conversion_right':
        return lookups.record(requirement.stock_class_id) !== null;
      case 'split_of_class':
        return lookups.record(requirement.split_id) !== null;
      case 'security':
      case 'trigger':
        return lookups.security(requirement.security_id) !== null;
      case 'vesting_condition': {
        const issuance = lookups.security(requirement.security_id);
        if (issuance === null) return false;
        const termsId = vestingTermsIdOf(issuance) ?? null;
        return termsId === null || lookups.record(termsId) !== null;
      }
    }
  }

  /** The working set as requirements see it, reading records from the book on first use (`bookLookups`). */
  private lookups(): RequirementLookups {
    return {
      record: (objectId) => {
        const entry = this.lookupRecord(objectId);
        return entry === null ? null : this.payloadOf(entry);
      },
      security: (securityId) => {
        const entry = this.lookupSecurity(securityId);
        return entry === null ? null : this.payloadOf(entry);
      },
      epochSplits: (stockClassId) => this.epochs.get(stockClassId)?.current?.splits ?? null,
    };
  }

  /** The book as loaded, before the first operation: what a moved vesting record's source is checked against. */
  private loadedLookups(): RequirementLookups {
    return {
      record: (objectId) => {
        const loaded =
          this.loadedRecords.get(objectId) ?? (this.records.has(objectId) ? null : this.lookupRecord(objectId));
        return loaded === null ? null : this.payloadOf(loaded);
      },
      security: (securityId) => {
        const loaded =
          this.loadedSecurities.get(securityId) ??
          (this.securities.has(securityId) ? null : this.lookupSecurity(securityId));
        return loaded === null ? null : this.payloadOf(loaded);
      },
      epochSplits: (stockClassId) => this.epochs.get(stockClassId)?.original?.epoch.splits ?? null,
    };
  }
}

/**
 * Simulates a whole write over a view of its book: each operation as the ledger runs it, then the checks that need the
 * whole write.
 *
 * @throws OcpValidationError for an operation the SDK cannot encode, and with the ledger's message for what the book
 * shows the ledger would refuse (an ID already claimed or in the derived form, a missing state, epoch, shard or
 * reference)
 */
export function simulateWrite(view: BookView, write: BookWrite): WriteSimulation {
  const simulation = new WriteSimulation(view, write.kind);
  switch (write.kind) {
    case 'apply':
      for (const [index, operation] of write.operations.entries()) {
        simulation.apply(applyOperationToDaml(operation, `operations[${index}]`), index);
      }
      break;
    case 'restate':
      for (const [index, operation] of write.operations.entries()) {
        simulation.restate(
          restateOperationToDaml(operation, `operations[${index}]`),
          operation.kind === 'setState' ? operation.state : null,
          index
        );
      }
      break;
    case 'placeHolds':
      simulation.placeHolds(write.holdType, write.reference, write.date, write.reasonText, write.lots);
      break;
    case 'cancelHolds':
      simulation.cancelHolds(write.date, write.holds);
      break;
    case 'settle':
      simulation.settle(write.settlementId, write.date, write.buyer, write.lots);
      break;
    default:
      refuse('write.kind', 'Unknown register write', 'invalid_write', OcpErrorCodes.UNKNOWN_ENUM_VALUE);
  }
  simulation.finish();
  return simulation;
}
