/**
 * A write as the off-ledger checks see it: the book before it (the key index) and after it (the index with the write's
 * records created, edited and deleted, and the stock states and epochs the ledger would leave, from the write's
 * simulation).
 *
 * Internal: the simulation and the requirement lookups read generated payloads, so this stays behind the package
 * boundary.
 */

import { OcpErrorCodes, OcpValidationError } from '../../errors';
import { ENTITY_REGISTRY } from '../../functions/OpenCapTable/capTable/batchTypes';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { OcfObjectType } from '../../types/native';
import type {
  ApplyOperation,
  BookWrite,
  RecordedSplit,
  RegisterRecord,
  StockSecurityState,
} from '../../types/register';
import { recordSecurityIds } from '../admissionRules';
import { emptyDelta, IndexView, OverlayView, simulateWrite, type BookDelta, type BookView } from '../bookSimulation';
import type { RequirementLookups } from '../references';
import type { RegisterIndex } from '../registerIndex';
import { dateOf } from '../replay/records';

/** A record as the checks read it: native OCF, from the book or from the write. */
export interface CheckRecord {
  readonly entityType: OcfEntityType;
  readonly objectType: OcfObjectType;
  readonly objectId: string;
  readonly data: Readonly<Record<string, unknown>>;
  /** The security IDs it names, as its `OcfObject` view lists them */
  readonly securityIds: readonly string[];
  /** The write's operation that writes it, by position; `null` for a record of the book */
  readonly operation: number | null;
  /** Its place among the book's records (the offset that created it), then the write's (in order) */
  readonly order: number;
}

/** One side of a write: the book before it, or after it. */
export interface BookSide {
  record(objectId: string): CheckRecord | null;
  recordsOf(entityType: OcfEntityType): CheckRecord[];
  /** The records that name a security (its issuance, the events on it, the events resulting in it) */
  recordsNaming(securityId: string): CheckRecord[];
  state(securityId: string): StockSecurityState | null;
  statesOfClass(stockClassId: string): StockSecurityState[];
  states(): StockSecurityState[];
  /** The class's recorded splits, in date order (none when it has no epoch) */
  splits(stockClassId: string): readonly RecordedSplit[];
  /** How the ledger's requirement checks see this side */
  readonly lookups: RequirementLookups;
}

/** A record the write creates or edits, before it is placed in the book's order. */
interface WrittenRecord {
  entityType: OcfEntityType;
  data: Readonly<Record<string, unknown>>;
  operation: number;
  edit: boolean;
}

/** A date field of a record as `YYYY-MM-DD`, or `null`. */
export function recordDate(record: Pick<CheckRecord, 'data'>, field = 'date'): string | null {
  return dateOf(record.data[field]);
}

/** A text field of a record, or `null` when absent or empty. */
export function textField(record: Pick<CheckRecord, 'data'>, field: string): string | null {
  const value = record.data[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A list-of-texts field of a record: empty when absent. */
export function textList(record: Pick<CheckRecord, 'data'>, field: string): string[] {
  const value = record.data[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asRecordData(value: unknown): Readonly<Record<string, unknown>> {
  return value as Readonly<Record<string, unknown>>;
}

/** Every record an Apply operation writes: the record, or a bundled event with its output issuances. */
function applyRecords(operation: ApplyOperation): Array<[OcfEntityType, unknown]> {
  const issued = (...issuances: ReadonlyArray<object | null | undefined>): Array<[OcfEntityType, unknown]> =>
    issuances.flatMap((issuance) => (issuance ? [['stockIssuance', issuance] as [OcfEntityType, unknown]] : []));
  switch (operation.kind) {
    case 'record':
      return [[operation.type, operation.data]];
    case 'stockTransfer':
      return [['stockTransfer', operation.transfer], ...issued(...operation.resulting, operation.balance)];
    case 'stockCancellation':
      return [['stockCancellation', operation.cancellation], ...issued(operation.balance)];
    case 'stockRepurchase':
      return [['stockRepurchase', operation.repurchase], ...issued(operation.balance)];
    case 'stockConversion':
      return [['stockConversion', operation.conversion], ...issued(...operation.resulting, operation.balance)];
    case 'stockReissuance':
      return [['stockReissuance', operation.reissuance], ...issued(...operation.resulting)];
    case 'stockConsolidation':
      return [['stockConsolidation', operation.consolidation], ...issued(operation.resultingIssuance)];
    case 'vestingSnapshot':
    case 'preSplitShard':
      return [];
  }
}

function fromIndex(record: RegisterRecord): CheckRecord {
  return {
    entityType: record.entityType,
    objectType: record.objectType,
    objectId: record.objectId,
    data: asRecordData(record.data ?? {}),
    securityIds: record.securityIds,
    operation: null,
    order: record.createdOffset,
  };
}

function viewLookups(view: BookView): RequirementLookups {
  return {
    record: (objectId) => view.record(objectId)?.data() ?? null,
    security: (securityId) => view.issuance(securityId)?.data() ?? null,
    epochSplits: (stockClassId) => view.epoch(stockClassId)?.epoch.splits ?? null,
  };
}

/** The book as its key index holds it. */
class IndexSide implements BookSide {
  readonly lookups: RequirementLookups;

  constructor(
    private readonly index: RegisterIndex,
    view: BookView
  ) {
    this.lookups = viewLookups(view);
  }

  record(objectId: string): CheckRecord | null {
    const record = this.index.record(objectId);
    return record === null ? null : fromIndex(record);
  }

  recordsOf(entityType: OcfEntityType): CheckRecord[] {
    return this.index.recordsOf(entityType).map(fromIndex);
  }

  recordsNaming(securityId: string): CheckRecord[] {
    return this.index.recordsNaming(securityId).map(fromIndex);
  }

  state(securityId: string): StockSecurityState | null {
    return this.index.stateOf(securityId)?.state ?? null;
  }

  statesOfClass(stockClassId: string): StockSecurityState[] {
    return this.index.statesOfClass(stockClassId).map((entry) => entry.state);
  }

  states(): StockSecurityState[] {
    return [...this.index.states()].map((entry) => entry.state);
  }

  splits(stockClassId: string): readonly RecordedSplit[] {
    return this.index.epochOf(stockClassId)?.epoch.splits ?? [];
  }
}

/** The book as the write leaves it. */
class WrittenSide implements BookSide {
  readonly lookups: RequirementLookups;

  constructor(
    private readonly before: IndexSide,
    private readonly index: RegisterIndex,
    /** The write's records by object ID; `null` for a deleted one */
    private readonly overlay: ReadonlyMap<string, CheckRecord | null>,
    private readonly delta: BookDelta,
    view: BookView
  ) {
    this.lookups = viewLookups(view);
  }

  record(objectId: string): CheckRecord | null {
    return this.overlay.has(objectId) ? (this.overlay.get(objectId) ?? null) : this.before.record(objectId);
  }

  recordsOf(entityType: OcfEntityType): CheckRecord[] {
    return [
      ...this.before.recordsOf(entityType).filter((record) => !this.overlay.has(record.objectId)),
      ...this.written().filter((record) => record.entityType === entityType),
    ];
  }

  recordsNaming(securityId: string): CheckRecord[] {
    return [
      ...this.before.recordsNaming(securityId).filter((record) => !this.overlay.has(record.objectId)),
      ...this.written().filter((record) => record.securityIds.includes(securityId)),
    ];
  }

  state(securityId: string): StockSecurityState | null {
    const changed = this.delta.states.get(securityId);
    return changed !== undefined ? (changed?.state ?? null) : this.before.state(securityId);
  }

  statesOfClass(stockClassId: string): StockSecurityState[] {
    return [
      ...this.index
        .statesOfClass(stockClassId)
        .filter((entry) => !this.delta.states.has(entry.state.security_id))
        .map((entry) => entry.state),
      ...this.changedStates().filter((state) => state.stock_class_id === stockClassId),
    ];
  }

  states(): StockSecurityState[] {
    return [
      ...[...this.index.states()]
        .filter((entry) => !this.delta.states.has(entry.state.security_id))
        .map((entry) => entry.state),
      ...this.changedStates(),
    ];
  }

  splits(stockClassId: string): readonly RecordedSplit[] {
    const changed = this.delta.epochs.get(stockClassId);
    return changed !== undefined ? (changed?.epoch.splits ?? []) : this.before.splits(stockClassId);
  }

  private written(): CheckRecord[] {
    return [...this.overlay.values()].filter((record): record is CheckRecord => record !== null);
  }

  private changedStates(): StockSecurityState[] {
    return [...this.delta.states.values()].flatMap((entry) => (entry === null ? [] : [entry.state]));
  }
}

/**
 * One write over its book, for the checks: the records it writes and deletes, and the book on either side of it.
 */
export class CheckedWrite {
  readonly before: BookSide;
  readonly after: BookSide;
  /** The records the write creates or edits, in operation order */
  readonly written: readonly CheckRecord[];
  /** The records the write deletes, as the book holds them, with the operation that deletes each */
  readonly deleted: ReadonlyArray<{ record: CheckRecord; operation: number }>;
  /** Which written records are edits of a record of the book */
  readonly edited: ReadonlySet<CheckRecord>;
  private readonly delta: BookDelta;

  /**
   * @throws OcpValidationError when the index keeps no record data, and the inputs preflight's refusals of a write the
   * ledger would refuse for its IDs, references or missing contracts
   */
  constructor(
    readonly index: RegisterIndex,
    readonly write: BookWrite
  ) {
    if (!index.retainsPayloads && (write.kind === 'apply' || write.kind === 'restate')) {
      throw new OcpValidationError(
        'index',
        "The off-ledger checks read the book's records: the key index was read with retainPayloads: false",
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, classification: 'register_payload_required' }
      );
    }
    const view = new IndexView(index);
    const before = new IndexSide(index, view);
    this.before = before;

    const records: WrittenRecord[] = [];
    const deleted: Array<{ record: CheckRecord; operation: number }> = [];
    if (write.kind === 'apply') {
      for (const [operation, op] of write.operations.entries()) {
        for (const [entityType, data] of applyRecords(op)) {
          records.push({ entityType, data: asRecordData(data), operation, edit: false });
        }
      }
    } else if (write.kind === 'restate') {
      for (const [operation, op] of write.operations.entries()) {
        if (op.kind === 'edit') {
          records.push({ entityType: op.type, data: asRecordData(op.data), operation, edit: true });
        } else if (op.kind === 'delete') {
          const record = before.record(op.objectId);
          if (record !== null) deleted.push({ record, operation });
        }
      }
    }
    // The write's records come after every record of the book, which the index's offset bounds.
    const base = index.offset + 1;
    const overlay = new Map<string, CheckRecord | null>();
    const edited = new Set<CheckRecord>();
    const written = records.map((record, position): CheckRecord => {
      const objectId = typeof record.data.id === 'string' ? record.data.id : '';
      const entry: CheckRecord = {
        entityType: record.entityType,
        objectType: ENTITY_REGISTRY[record.entityType].objectType,
        objectId,
        data: record.data,
        securityIds: recordSecurityIds(record.entityType, record.data),
        operation: record.operation,
        order: base + position,
      };
      if (record.edit) edited.add(entry);
      overlay.set(objectId, entry);
      return entry;
    });
    for (const { record } of deleted) overlay.set(record.objectId, null);
    this.written = written;
    this.deleted = deleted;
    this.edited = edited;

    const delta = emptyDelta();
    if (write.kind === 'apply' || write.kind === 'restate') {
      simulateWrite(view, write).commitTo(delta, (kind, key) => `checked:${kind}:${key}`);
    }
    this.delta = delta;
    this.after = new WrittenSide(before, index, overlay, delta, new OverlayView(view, delta));
  }

  /** The stock states the write creates, changes or ends, by security ID (`null` once ended). */
  changedStates(): Map<string, StockSecurityState | null> {
    const changed = new Map<string, StockSecurityState | null>();
    for (const [securityId, entry] of this.delta.states) changed.set(securityId, entry?.state ?? null);
    return changed;
  }

  /** Every record the write touches, as the book holds it before and as the write leaves it. */
  touchedRecords(): Array<{ before: CheckRecord | null; after: CheckRecord | null; operation: number }> {
    return [
      ...this.written.map((record) => ({
        before: this.edited.has(record) ? this.before.record(record.objectId) : null,
        after: record,
        operation: record.operation ?? 0,
      })),
      ...this.deleted.map(({ record, operation }) => ({ before: record, after: null, operation })),
    ];
  }
}
