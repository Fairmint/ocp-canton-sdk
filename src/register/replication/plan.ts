/**
 * Replication's plan (design, "One mode and teardown"): publish a book's source records (PostgreSQL's) into its
 * OpenCapTable-v35 book as missing data through `CapTable_Apply`, and mirror the source's edits and deletes through
 * `CapTable_Restate`, all as the TA, in date order, each batch atomic so the book is always a valid prefix of its
 * history.
 *
 * 1. The source is normalized (plan-security aliases, deprecated fields). The hold pair is left out: only the hold
 *    choices write it. A record whose ID has this book's derived form was written by a register choice and read back
 *    by apiv2: it is skipped, and reported when it differs from the ledger's (a correction is a new record).
 * 2. The source is diffed against the key index (`computeReplicationDiff`, semantic OCF equality): records to create,
 *    edit and delete. The book's derived-form records and the hold pair are never edited or deleted, and neither is a
 *    record one of those names: a settlement's new buyer, whose stakeholder `CapTable_Settle` wrote under a claimed ID,
 *    stays on the book until apiv2 reads the trade back, so replication never undoes a trade.
 * 3. The target book (the source with the ledger's derived-form records, the records they name and the hold pair) is
 *    replayed under the v35 rules (`replayOcf`). The plan stops at the first violation and reports it.
 * 4. The creates are written in replay order, bundled as `CapTable_Apply` writes them (the units rule, same-day
 *    dependencies sorted); each historical split is its own step, recorded by the split procedure
 *    (`register.recordSplit`); a large book first pre-splits its ID shards. The writer packs the rest into
 *    transactions within every cap (`register.planBatches`).
 * 5. Edits and deletes become a `CapTable_Restate`, with the states the replay of the corrected book restates, after
 *    the definitions the corrections may name and before the dated records, which may rest on the corrected states.
 *    A correction above one restatement's caps is written in several, each holding whole groups of operations that
 *    must change together and each one the writer's checks accept over the book as the parts before it leave it
 *    (`packRestatement`). Edits of documents and financings that name dated records still to create go in a last
 *    restatement (or several).
 * 6. What the register refuses is refused before anything is submitted, with the reason (`checkRestatement`, the
 *    history the book already holds, the ledger's ID and reference rules over a dry run of every step, and the
 *    writer's references check of the correction). Such a book is corrected in the source, or rebuilt as a new cap
 *    table.
 *
 * Planning is idempotent: run it again on the updated index and what was written is no longer missing.
 */

import { OcpErrorCodes, OcpValidationError } from '../../errors';
import { applyOperationToDaml } from '../../functions/OpenCapTable/capTable/choiceArguments';
import {
  isOcfLedgerWrittenEntityType,
  type OcfDataTypeFor,
  type OcfEditableEntityType,
  type OcfEntityType,
} from '../../functions/OpenCapTable/capTable/entityTypes';
import { convertToDamlData } from '../../functions/OpenCapTable/capTable/ocfToDaml';
import type { OcfStockClassSplit } from '../../types/native';
import type {
  ApplyOperation,
  ApplyPreSplitShardOperation,
  RegisterRecord,
  ReplayResult,
  ReplayStep,
  ReplayViolation,
  RestateEditOperation,
  RestateOperation,
} from '../../types/register';
import { buildOcfManifest, manifestOfRecords } from '../../utils/cantonOcfExtractor';
import { DEFAULT_DEPRECATED_FIELDS, DEFAULT_INTERNAL_FIELDS, ocfDeepEqual } from '../../utils/ocfComparison';
import {
  buildCantonOcfDataMap,
  computeReplicationDiff,
  type ReplicationDiff,
  type ReplicationItem,
} from '../../utils/replicationHelpers';
import { recordSecurityIds } from '../admissionRules';
import {
  emptyDelta,
  IndexView,
  OverlayView,
  plannedContractId,
  WriteSimulation,
  type BookDelta,
  type BookView,
} from '../bookSimulation';
import { MAX_OPERATIONS_PER_APPLY } from '../caps';
import { CheckedWrite } from '../checks/book';
import { checkReferences } from '../checks/references';
import { splitOffenders } from '../checks/splits';
import { isDerivedForm } from '../ids';
import { toUnits } from '../numeric';
import type { RegisterIndex } from '../registerIndex';
import { replayOcf } from '../replay/replay';
import { scaleQuantityAcross } from '../splits';
import { readEndedState, type EndedState } from './endedState';
import {
  checkRestatement,
  deriveStateRestatements,
  packRestatement,
  recordRefusal,
  refusal,
  type RestatementPart,
} from './restatement';
import { dateOfRecord, issuedSecurity, readSource, sourceItems, type SourceRecord } from './source';
import type {
  PlanReplicationOptions,
  ReplicationNotice,
  ReplicationPlan,
  ReplicationRefusal,
  ReplicationRestateBasis,
  ReplicationSource,
  ReplicationStep,
} from './types';

/** What `planReplication` plans from. */
export interface PlanReplicationInput {
  /** The book's source records */
  source: ReplicationSource;
  /** The book's key index, current, with record payloads */
  index: RegisterIndex;
  options?: PlanReplicationOptions;
}

/** The default claimed IDs per shard a pre-split aims at: half of the 64 a shard holds before it splits. */
const DEFAULT_HASHES_PER_SHARD = 32;

/**
 * The definitions the corrections may name, written before the restatement. A valuation is not among them: the split
 * procedure reads it on its effective date, so it is written in date order, after the splits of its class dated on or
 * before that date.
 */
const DEFINITION_TYPES: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stakeholder',
  'vestingTerms',
  'stockLegendTemplate',
  'stockClass',
  'stockPlan',
]);

/** Records a vesting start or event may be dated before its lot's last event. */
const BACKDATABLE: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>(['vestingStart', 'vestingEvent']);

const COMPARISON = { ignoredFields: DEFAULT_INTERNAL_FIELDS, deprecatedFields: DEFAULT_DEPRECATED_FIELDS };

/** A replay step the plan writes, with the operation that writes it. */
interface CreateStep {
  step: ReplayStep;
  operation: ApplyOperation;
  recordIds: string[];
  split: OcfStockClassSplit | null;
}

function firstViolation(replay: ReplayResult): ReplayViolation | null {
  return replay.violations[0] ?? null;
}

function describeViolation(violation: ReplayViolation): string {
  const records = violation.recordIds.length > 0 ? ` (${violation.recordIds.join(', ')})` : '';
  return `${violation.rule}: ${violation.message}${records}`;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

function editOperation(item: ReplicationItem): RestateEditOperation {
  // The item's entity kind and data are correlated by the diff; the union of kinds cannot be re-correlated by type.
  return {
    kind: 'edit',
    type: item.entityType as OcfEditableEntityType,
    data: item.data as OcfDataTypeFor<OcfEditableEntityType>,
  } as RestateEditOperation;
}

function sameOnLedger(entityType: OcfEntityType, source: unknown, ledger: unknown): boolean {
  if (isOcfLedgerWrittenEntityType(entityType)) return false;
  try {
    const encode = (data: unknown): string => JSON.stringify(convertToDamlData(entityType, data as never));
    return encode(source) === encode(ledger);
  } catch {
    return false;
  }
}

/** The IDs a document or financing names. */
function namedObjects(record: { entityType: OcfEntityType; data: Record<string, unknown> }): string[] {
  if (record.entityType === 'financing') {
    const ids = record.data.issuance_ids;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  }
  if (record.entityType === 'document') {
    const related = record.data.related_objects;
    if (!Array.isArray(related)) return [];
    return related.flatMap((reference: unknown) => {
      const objectId =
        typeof reference === 'object' && reference !== null
          ? (reference as Record<string, unknown>).object_id
          : undefined;
      return typeof objectId === 'string' ? [objectId] : [];
    });
  }
  return [];
}

class ReplicationPlanner {
  private readonly index: RegisterIndex;
  private readonly options: PlanReplicationOptions;
  private readonly capTableId: string;
  private readonly records: SourceRecord[];
  private readonly notices: ReplicationNotice[] = [];
  private readonly refusals: ReplicationRefusal[] = [];
  private readonly delta: BookDelta = emptyDelta();
  private readonly view: BookView;
  /** Records of the book the source lacks that a register choice's records name: kept in the target book */
  private readonly retained: SourceRecord[] = [];
  private dryRuns = 0;

  constructor(input: PlanReplicationInput) {
    this.index = input.index;
    this.options = { ...(input.options ?? {}) };
    this.capTableId = input.index.context.cap_table_id;
    if (!input.index.retainsPayloads) {
      throw new OcpValidationError('index', 'Replication compares record data: read the book with its payloads', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        classification: 'register_payload_required',
      });
    }
    const perShard = this.options.hashesPerShard;
    if (perShard !== undefined && (!Number.isSafeInteger(perShard) || perShard < 1)) {
      throw new OcpValidationError('options.hashesPerShard', 'Must be a positive integer', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: perShard,
      });
    }
    this.records = readSource(input.source);
    this.view = new OverlayView(new IndexView(input.index), this.delta);
  }

  async plan(): Promise<ReplicationPlan> {
    const { anchor } = this.index;
    if (anchor?.status !== 'ACTIVE') {
      this.refusals.push(
        refusal(
          'book_not_active',
          anchor === null
            ? `Cap table ${this.capTableId} has no anchor in the index`
            : `Cap table ${this.capTableId} is ${anchor.status}: it takes no further writes`
        )
      );
    }
    const kept = this.skipRegisterWritten();
    const diff = this.diff(kept);
    this.recordLimits(diff);

    const target = [...kept, ...this.ledgerWritten(), ...this.retained];
    const replay = replayOcf(manifestOfRecords(target), { capTableId: this.capTableId });
    const violation = firstViolation(replay);
    const corrections = diff.edits.length + diff.deletes.length > 0;
    if (this.refusals.length > 0 || (violation !== null && corrections)) {
      return this.result(diff, violation, [], []);
    }

    const recordsById = new Map<string, SourceRecord>();
    for (const record of target) if (!recordsById.has(record.id)) recordsById.set(record.id, record);
    const usable = violation === null ? replay.steps : replay.steps.slice(0, violation.step);
    const creates = this.createSteps(usable, diff, recordsById);
    const definitions = creates.filter((create) => this.isDefinition(create));
    const dated = this.inDateOrder(creates.filter((create) => !this.isDefinition(create)));

    const preSplit = this.preSplitOperations(creates, recordsById);
    this.dryRun(preSplit, []);
    this.dryRun(
      definitions.map((create) => create.operation),
      definitions.map((create) => create.recordIds)
    );

    let restatement: { main: RestateOperation[][]; trailing: RestateOperation[]; securityIds: string[] } = {
      main: [],
      trailing: [],
      securityIds: [],
    };
    if (corrections && this.refusals.length === 0) {
      // The definitions are written before the restatement, so only an edit naming a dated create waits for it.
      restatement = await this.restatement(diff, definitions, recordsById, new Set(dated.flatMap((c) => c.recordIds)));
    }
    if (this.refusals.length === 0) this.checkHistory(dated, recordsById);
    this.dryRun(
      dated.map((create) => create.operation),
      dated.map((create) => create.recordIds)
    );
    const trailing =
      this.refusals.length === 0 && restatement.trailing.length > 0 ? this.dryRunEdits(restatement.trailing) : [];
    if (this.refusals.length > 0) return this.result(diff, violation, [], []);

    const steps: ReplicationStep[] = [];
    if (preSplit.length > 0) steps.push({ kind: 'preSplit', operations: preSplit });
    this.pushApplySteps(steps, definitions);
    for (const part of restatement.main) steps.push(this.restateStep(part));
    let run: CreateStep[] = [];
    for (const create of dated) {
      if (create.split === null) {
        run.push(create);
        continue;
      }
      this.pushApplySteps(steps, run);
      run = [];
      steps.push({ kind: 'split', split: create.split, recordIds: [create.split.id] });
    }
    this.pushApplySteps(steps, run);
    for (const part of trailing) steps.push(this.restateStep(part));
    return this.result(diff, violation, steps, restatement.securityIds);
  }

  // ===== 1. What the register writes =====

  /** Leaves out the hold pair and this book's derived-form records, reporting the ones that disagree with the book. */
  private skipRegisterWritten(): SourceRecord[] {
    const kept: SourceRecord[] = [];
    for (const record of this.records) {
      if (isOcfLedgerWrittenEntityType(record.entityType)) {
        this.notice(
          'hold_pair',
          record,
          `Hold record ${record.id} is left out: only the hold choices write the hold pair`
        );
        continue;
      }
      if (!isDerivedForm(this.capTableId, record.id)) {
        kept.push(record);
        continue;
      }
      const onLedger = this.index.record(record.id)?.data ?? null;
      if (onLedger === null) {
        this.notice(
          'derived_form_missing',
          record,
          `Record ${record.id} has this book's derived form but is not on the book; it cannot be claimed`
        );
      } else if (!ocfDeepEqual(record.data, onLedger, COMPARISON)) {
        this.notice(
          'derived_form_differs',
          record,
          `Record ${record.id} was written by a register choice and differs from the book's; it is never edited: ` +
            'correct it with a new record'
        );
      } else {
        this.notice('derived_form_skipped', record, `Record ${record.id} was written by a register choice`);
      }
    }
    return kept;
  }

  /** The ledger's derived-form records and hold pair: the target book keeps them as the ledger wrote them. */
  private ledgerWritten(): SourceRecord[] {
    const records: SourceRecord[] = [];
    for (const record of this.index.records()) {
      if (record.data === null) continue;
      if (!isOcfLedgerWrittenEntityType(record.entityType) && !isDerivedForm(this.capTableId, record.objectId))
        continue;
      records.push({
        entityType: record.entityType,
        id: record.objectId,
        data: record.data as Record<string, unknown>,
      });
    }
    return records;
  }

  private notice(kind: ReplicationNotice['kind'], record: SourceRecord, message: string): void {
    this.notices.push({ kind, message, id: record.id, entityType: record.entityType });
  }

  // ===== 2. The diff =====

  private diff(kept: readonly SourceRecord[]): ReplicationDiff {
    const cantonOcfData = buildCantonOcfDataMap(buildOcfManifest(this.index));
    const raw = computeReplicationDiff(sourceItems(kept), this.index.toRecordIndex(), {
      cantonOcfData,
      reportDifferences: this.options.reportDifferences ?? false,
    });
    const edits = raw.edits.filter((item) => {
      const onLedger = cantonOcfData.get(item.entityType)?.get(item.id);
      if (!sameOnLedger(item.entityType, item.data, onLedger)) return true;
      this.notices.push({
        kind: 'edit_unchanged',
        message: `Record ${item.id} differs from the book only where the ledger stores nothing; no edit is written`,
        id: item.id,
        entityType: item.entityType,
      });
      return false;
    });
    const deletes = raw.deletes.filter((item) => !isDerivedForm(this.capTableId, item.id) && !this.keepNamed(item));
    return {
      creates: raw.creates,
      edits,
      deletes,
      total: raw.creates.length + edits.length + deletes.length,
      conflicts: raw.conflicts,
    };
  }

  /**
   * Whether a record the source lacks is kept on the book because a record a register choice wrote (in this book's
   * derived form) names it: no restatement could repair that reference, since the naming record is never restated.
   * That is how a settlement's new buyer appears until apiv2 reads the trade back: `CapTable_Settle` wrote the buyer's
   * stakeholder under a claimed ID, and the buyer's issuance in the derived form names it. A kept record stays in the
   * target book as the ledger holds it.
   */
  private keepNamed(item: ReplicationItem): boolean {
    const record = this.index.record(item.id);
    if (record?.data === null || record?.data === undefined) return false;
    const namedBy = this.index
      .referrersOf(item.id)
      .find((referrer) => isDerivedForm(this.capTableId, referrer.objectId));
    if (namedBy === undefined) return false;
    this.retained.push({ entityType: record.entityType, id: item.id, data: record.data as Record<string, unknown> });
    this.notices.push({
      kind: 'register_named_kept',
      message:
        `${record.objectType} ${item.id} is not in the source, but ${namedBy.objectType} ${namedBy.objectId}, which a ` +
        'register choice wrote, names it: it is never deleted (a settlement writes its new buyer this way, which apiv2 ' +
        'reads back with the trade)',
      id: item.id,
      entityType: record.entityType,
    });
    return true;
  }

  /** The restatement limits a record's correction meets before any state is looked at. */
  private recordLimits(diff: ReplicationDiff): void {
    for (const item of diff.creates) {
      if (item.entityType !== 'issuer') continue;
      const issuer = this.index.recordsOf('issuer')[0]?.objectId ?? 'none';
      this.refusals.push(
        refusal(
          'issuer',
          `Issuer ${item.id} differs from the book's issuer ${issuer}: the issuer is written with the cap table; ` +
            'rebuild the book to change it',
          [item.id, issuer]
        )
      );
    }
    for (const item of diff.edits) {
      const refused = recordRefusal(this.index, editOperation(item));
      if (refused !== null) this.refusals.push(refused);
    }
    for (const item of diff.deletes) {
      const refused = recordRefusal(this.index, { kind: 'delete', objectId: item.id });
      if (refused !== null) this.refusals.push(refused);
    }
  }

  // ===== 4. The creates =====

  /** The replay steps that write records the book lacks, with the snapshots they need, in replay order. */
  private createSteps(
    steps: readonly ReplayStep[],
    diff: ReplicationDiff,
    recordsById: ReadonlyMap<string, SourceRecord>
  ): CreateStep[] {
    const createIds = new Set(diff.creates.map((item) => item.id));
    const creates: CreateStep[] = [];
    let snapshots: ReplayStep[] = [];
    for (const step of steps) {
      if (step.kind === 'snapshot') {
        snapshots.push(step);
        continue;
      }
      const implied = snapshots;
      snapshots = [];
      const created = step.recordIds.filter((id) => createIds.has(id));
      if (created.length === 0) continue;
      if (
        step.kind !== 'apply' ||
        step.operation === null ||
        step.derivedForm ||
        created.length < step.recordIds.length
      ) {
        const missing = step.recordIds.filter((id) => !createIds.has(id));
        this.refusals.push(
          refusal(
            'partial_bundle',
            `Records ${created.join(', ')} are written with ${missing.join(', ') || step.recordIds.join(', ')}, which ${
              step.derivedForm ? 'a register choice writes' : 'the book already holds'
            }: correct the whole event, or rebuild the book`,
            step.recordIds,
            step.securityIds
          )
        );
        continue;
      }
      for (const snapshot of implied) {
        if (snapshot.operation !== null && this.snapshotNeeded(snapshot)) {
          creates.push({ step: snapshot, operation: snapshot.operation, recordIds: [], split: null });
        }
      }
      const [first] = step.recordIds;
      const record = first === undefined ? undefined : recordsById.get(first);
      const split = record?.entityType === 'stockClassSplit' ? (record.data as unknown as OcfStockClassSplit) : null;
      creates.push({ step, operation: step.operation, recordIds: [...step.recordIds], split });
    }
    return creates;
  }

  /** A snapshot the replay needs before an event, unless the book's own snapshot of the lot is as large already. */
  private snapshotNeeded(step: ReplayStep): boolean {
    const { operation } = step;
    if (operation?.kind !== 'vestingSnapshot') return false;
    const state = this.index.stateOf(operation.securityId)?.state ?? null;
    if (state?.snapshot === null || state?.snapshot === undefined) return true;
    const splits = this.index.epochOf(state.stock_class_id)?.epoch.splits ?? [];
    const onBook =
      operation.asOf >= state.last_event_date
        ? scaleQuantityAcross(state.snapshot.vested, splits, state.last_event_date, operation.asOf)
        : state.snapshot.vested;
    return toUnits(onBook) < toUnits(operation.vested);
  }

  private isDefinition(create: CreateStep): boolean {
    const { operation } = create;
    return create.step.date === null && operation.kind === 'record' && DEFINITION_TYPES.has(operation.type);
  }

  /**
   * The dated creates in replay order, each valuation moved to its effective date: after every create dated on or
   * before it, so after the splits of its class that apply to it.
   */
  private inDateOrder(creates: readonly CreateStep[]): CreateStep[] {
    const effectiveDate = (create: CreateStep): string | null => {
      const { operation } = create;
      return operation.kind === 'record' && operation.type === 'valuation'
        ? (dateOfRecord({ date: operation.data.effective_date }) ?? null)
        : null;
    };
    const valuations = creates
      .filter((create) => effectiveDate(create) !== null)
      .sort((a, b) => (effectiveDate(a) ?? '').localeCompare(effectiveDate(b) ?? ''));
    const ordered: CreateStep[] = [];
    let next = 0;
    for (const create of creates) {
      if (effectiveDate(create) !== null) continue;
      const { date } = create.step;
      for (; next < valuations.length; next += 1) {
        const valuation = valuations[next];
        const effective = valuation === undefined ? null : effectiveDate(valuation);
        if (valuation === undefined || effective === null || (date !== null && date <= effective)) break;
        ordered.push(valuation);
      }
      ordered.push(create);
    }
    ordered.push(...valuations.slice(next));
    return ordered;
  }

  /**
   * One-bit pre-splits of the shortest shards first, until the shards would hold about `hashesPerShard` claimed IDs
   * each once the creates are written. A book whose claims fit gets none.
   */
  private preSplitOperations(
    creates: readonly CreateStep[],
    recordsById: ReadonlyMap<string, SourceRecord>
  ): ApplyPreSplitShardOperation[] {
    let claims = 0;
    const shards: string[] = [];
    for (const { shard } of this.index.shards()) {
      claims += shard.claimed.length;
      shards.push(shard.prefix);
    }
    for (const create of creates) {
      for (const id of create.recordIds) {
        if (!isDerivedForm(this.capTableId, id)) claims += 1;
        const record = recordsById.get(id);
        const securityId = record === undefined ? null : issuedSecurity(record.entityType, record.data);
        if (securityId !== null && !isDerivedForm(this.capTableId, securityId)) claims += 1;
      }
    }
    const target = Math.ceil(claims / (this.options.hashesPerShard ?? DEFAULT_HASHES_PER_SHARD));
    if (shards.length === 0 || target <= shards.length) return [];
    const queue = shards.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const operations: ApplyPreSplitShardOperation[] = [];
    for (let count = queue.length, next = 0; count < target && next < queue.length; count += 1, next += 1) {
      const prefix = queue[next] ?? '';
      if (prefix.length >= 256) break;
      operations.push({ kind: 'preSplitShard', prefix });
      queue.push(`${prefix}0`, `${prefix}1`);
    }
    return operations;
  }

  // ===== 5. The restatement =====

  /**
   * The correction's restatements: the edits and deletes with the states they restate, and the edits of documents and
   * financings that name a dated record still to create (`laterIds`), written last.
   */
  private async restatement(
    diff: ReplicationDiff,
    definitions: readonly CreateStep[],
    recordsById: ReadonlyMap<string, SourceRecord>,
    laterIds: ReadonlySet<string>
  ): Promise<{ main: RestateOperation[][]; trailing: RestateOperation[]; securityIds: string[] }> {
    const none = { main: [], trailing: [], securityIds: [] };
    const deleted = new Set(diff.deletes.map((item) => item.id));
    const edits = new Map(diff.edits.map((item) => [item.id, item]));
    const corrected = new Set<string>();
    const book: SourceRecord[] = [];
    for (const record of this.index.records()) {
      if (record.data === null) continue;
      const data = record.data as Record<string, unknown>;
      const edit = edits.get(record.objectId);
      if (deleted.has(record.objectId) || edit !== undefined) {
        for (const securityId of recordSecurityIds(record.entityType, data)) corrected.add(securityId);
      }
      if (deleted.has(record.objectId)) continue;
      if (edit?.entityType === record.entityType) {
        const edited = edit.data as Record<string, unknown>;
        for (const securityId of recordSecurityIds(record.entityType, edited)) corrected.add(securityId);
        book.push({ entityType: record.entityType, id: record.objectId, data: edited });
      } else {
        book.push({ entityType: record.entityType, id: record.objectId, data });
      }
    }
    for (const create of definitions) {
      for (const id of create.recordIds) {
        const record = recordsById.get(id);
        if (record !== undefined) book.push(record);
      }
    }
    const replay = replayOcf(manifestOfRecords(book), { capTableId: this.capTableId });
    const violation = firstViolation(replay);
    if (violation !== null) {
      this.refusals.push(
        refusal(
          'restatement',
          `The corrected book does not replay under the v35 rules: ${describeViolation(violation)}; correct the ` +
            'source, or rebuild the book',
          violation.recordIds,
          violation.securityIds
        )
      );
      return none;
    }
    const states = await deriveStateRestatements({
      index: this.index,
      replay,
      records: book,
      deleted,
      corrected,
      endedState: async (consumer, securityId) => this.endedState(consumer, securityId),
    });
    this.notices.push(...states.notices);
    this.refusals.push(...states.refusals);
    if (this.refusals.length > 0) return none;

    const trailing: RestateOperation[] = [];
    const recordOperations: RestateOperation[] = [];
    for (const item of diff.edits) {
      const record = { entityType: item.entityType, data: item.data as Record<string, unknown> };
      const late = namedObjects(record).some((id) => laterIds.has(id));
      (late ? trailing : recordOperations).push(editOperation(item));
    }
    for (const item of diff.deletes) recordOperations.push({ kind: 'delete', objectId: item.id });
    const main = [...recordOperations, ...states.operations];
    if (main.length === 0) return { main: [], trailing, securityIds: [] };
    const check = checkRestatement({ index: this.index, view: this.view, operations: main, replay });
    this.refusals.push(...check.refusals);
    if (check.parts === null) return none;
    this.checkReferences(main);
    if (this.refusals.length > 0) return none;
    this.commitParts(check.parts, 'restate');
    return { main: check.parts.map((part) => part.operations), trailing, securityIds: states.securityIds };
  }

  /**
   * The writer's references check of a correction (`checks/references.ts`), over the book as the writes planned before
   * it leave it: no live record may be left pointing at a record it deletes or edits away, and no stock class or
   * stakeholder be deleted while stock is outstanding in it. The writer runs it again on each restatement; running it
   * here refuses the plan before any step commits, also when the writer's checks are off.
   */
  private checkReferences(operations: RestateOperation[]): void {
    try {
      for (const violation of checkReferences(
        new CheckedWrite(this.index, { kind: 'restate', operations }, this.view)
      )) {
        this.refusals.push(
          refusal(
            'references',
            `The restatement would be refused by the writer's references check: ${violation.message}`,
            violation.recordIds
          )
        );
      }
    } catch (error) {
      if (!(error instanceof OcpValidationError)) throw error;
      this.refusals.push(
        refusal('references', `The references of the restatement cannot be checked: ${error.message}`)
      );
    }
  }

  /** Carry the book forward over planned restatements, each under its own placeholder contract IDs. */
  private commitParts(parts: readonly RestatementPart[], label: string): void {
    for (const [position, part] of parts.entries()) {
      part.simulation.commitTo(this.delta, (kind, key) =>
        plannedContractId(`planned:${label}:${position}:${kind}:${key}`)
      );
    }
  }

  private async endedState(consumer: RegisterRecord, securityId: string): Promise<EndedState> {
    const { ledger } = this.options;
    if (ledger === undefined) {
      throw new OcpValidationError(
        'options.ledger',
        `Restating security ${securityId} recreates the state ${consumer.objectId} ended, whose seq only the ledger ` +
          'knows: give planReplication a ledger client',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, classification: 'ledger_required' }
      );
    }
    return readEndedState(ledger, {
      context: this.index.context,
      consumer,
      securityId,
      readAs: this.options.readAs ?? this.index.context.transfer_agent,
    });
  }

  private restateStep(operations: RestateOperation[]): ReplicationStep {
    const recordIds = operations.flatMap((operation) =>
      operation.kind === 'edit' ? [operation.data.id] : operation.kind === 'delete' ? [operation.objectId] : []
    );
    const restated = operations.flatMap((operation) =>
      operation.kind === 'setState'
        ? [operation.state.security_id]
        : operation.kind === 'endState'
          ? [operation.securityId]
          : []
    );
    const basis: ReplicationRestateBasis[] = [
      ...restated.map((id) => ({ kind: 'state' as const, id, contractId: this.index.stateOf(id)?.contractId ?? null })),
      ...recordIds.map((id) => ({
        kind: 'record' as const,
        id,
        contractId: this.index.record(id)?.contractId ?? null,
      })),
    ];
    return { kind: 'restate', operations, recordIds, securityIds: restated, basis };
  }

  // ===== 6. What the book's history refuses =====

  /**
   * Each dated create on a security the book holds must come after the security's last event there (vesting starts
   * and events excepted), on a security the book has not ended; and no record in a split's class may be dated on or
   * after the split.
   */
  private checkHistory(creates: readonly CreateStep[], recordsById: ReadonlyMap<string, SourceRecord>): void {
    const created = new Set<string>();
    for (const create of creates) {
      if (create.split !== null) {
        const offenders = splitOffenders(this.index, create.split);
        if (offenders.length > 0) {
          this.refusals.push(
            refusal(
              'out_of_order',
              `Split ${create.split.id} of stock class ${create.split.stock_class_id} dated ${create.split.date} ` +
                `precedes ${offenders.length} record(s) the book already holds in the class ` +
                `(${offenders
                  .slice(0, 5)
                  .map((offender) => `${offender.objectId} ${offender.date}`)
                  .join(', ')}); rebuild the book to record it`,
              [create.split.id, ...offenders.map((offender) => offender.objectId)]
            )
          );
        }
        continue;
      }
      const records = create.recordIds.flatMap((id) => {
        const record = recordsById.get(id);
        return record === undefined ? [] : [record];
      });
      const issued = new Set(
        records.flatMap((record) => {
          const securityId = issuedSecurity(record.entityType, record.data);
          return securityId === null ? [] : [securityId];
        })
      );
      const [event] = records;
      const label = event === undefined ? 'The vesting snapshot' : `Record ${event.id}`;
      for (const securityId of create.step.securityIds) {
        if (issued.has(securityId) || created.has(securityId)) continue;
        const state = this.view.state(securityId)?.state ?? null;
        if (state === null) {
          this.refusals.push(
            refusal(
              'out_of_order',
              `${label} (${create.step.date ?? 'undated'}) is on security ${securityId}, which the book has already ` +
                'ended; rebuild the book to write it',
              create.recordIds,
              [securityId]
            )
          );
          continue;
        }
        const backdatable = event !== undefined && BACKDATABLE.has(event.entityType);
        if (!backdatable && create.step.date !== null && create.step.date < state.last_event_date) {
          this.refusals.push(
            refusal(
              'out_of_order',
              `${label} dated ${create.step.date} precedes the last event on security ${securityId} on the book ` +
                `(${state.last_event_date}); rebuild the book to write it`,
              create.recordIds,
              [securityId]
            )
          );
        }
      }
      for (const securityId of issued) created.add(securityId);
    }
  }

  /**
   * Simulate `CapTable_Apply` operations over the book as the planned writes before them leave it, refusing what the
   * ledger's ID and reference rules would refuse, and carry the book forward.
   */
  private dryRun(operations: readonly ApplyOperation[], recordIds: ReadonlyArray<readonly string[]>): void {
    if (operations.length === 0 || this.refusals.length > 0) return;
    for (const [part, batch] of chunks([...operations.entries()], MAX_OPERATIONS_PER_APPLY).entries()) {
      const simulation = new WriteSimulation(this.view, 'apply');
      let position = 0;
      try {
        for (const [index, operation] of batch) {
          position = index;
          simulation.apply(applyOperationToDaml(operation, `operations[${index}]`), index);
        }
        simulation.finish();
      } catch (error) {
        if (!(error instanceof OcpValidationError)) throw error;
        const ids = recordIds[position] ?? [];
        this.refusals.push(
          refusal(
            'ledger',
            `CapTable_Apply would refuse ${ids.length > 0 ? `record ${ids.join(', ')}` : 'a planned operation'}: ${
              error.message
            }`,
            ids
          )
        );
        return;
      }
      this.dryRuns += 1;
      simulation.commitTo(this.delta, (kind, key) =>
        plannedContractId(`planned:${this.dryRuns}:${part}:${kind}:${key}`)
      );
    }
  }

  /**
   * Simulate the last restatements (edits of documents and financings, which change no state) over the book as every
   * planned write before them leaves it, packed within the caps.
   *
   * @returns the restatements' operations, in order; none when refused
   */
  private dryRunEdits(operations: RestateOperation[]): RestateOperation[][] {
    try {
      const packed = packRestatement(this.index, this.view, operations);
      this.refusals.push(...packed.refusals);
      if (packed.refusals.length > 0) return [];
      this.commitParts(packed.parts, 'restate-trailing');
      return packed.parts.map((part) => part.operations);
    } catch (error) {
      if (!(error instanceof OcpValidationError)) throw error;
      this.refusals.push(
        refusal(
          'ledger',
          `CapTable_Restate would refuse the edits of ${operations
            .map((operation) => (operation.kind === 'edit' ? operation.data.id : operation.kind))
            .join(', ')}: ${error.message}`,
          operations.flatMap((operation) => (operation.kind === 'edit' ? [operation.data.id] : []))
        )
      );
      return [];
    }
  }

  // ===== The plan =====

  private pushApplySteps(steps: ReplicationStep[], creates: readonly CreateStep[]): void {
    for (const part of chunks(creates, MAX_OPERATIONS_PER_APPLY)) {
      if (part.length === 0) continue;
      steps.push({
        kind: 'apply',
        operations: part.map((create) => create.operation),
        recordIds: part.flatMap((create) => create.recordIds),
      });
    }
  }

  private result(
    diff: ReplicationDiff,
    violation: ReplayViolation | null,
    steps: ReplicationStep[],
    restatedSecurityIds: string[]
  ): ReplicationPlan {
    const status =
      this.refusals.length > 0 ? 'refused' : violation !== null ? 'blocked' : steps.length === 0 ? 'current' : 'ready';
    return {
      capTableId: this.capTableId,
      offset: this.index.offset,
      status,
      steps: status === 'refused' ? [] : steps,
      diff,
      restatedSecurityIds: status === 'refused' ? [] : restatedSecurityIds,
      violation,
      refusals: this.refusals,
      notices: this.notices,
      source: sourceItems(this.records),
      options: this.options,
    };
  }
}

/**
 * Plan the replication of a book's source records into its OpenCapTable-v35 book (see the module notes): the steps
 * that create what the book lacks and restate what the source corrects, in order, or the reason the book cannot be
 * brought to the source.
 *
 * @param input - The source, the book's current key index (with payloads), and the options (a ledger client when a
 * correction recreates a state)
 * @returns the plan; write it with `executeReplication`
 * @throws OcpValidationError for a malformed source record, an index without payloads, a source that lacks a record of
 * an index holding records whose references it cannot read, or a correction that recreates a state when no ledger
 * client is given
 * @throws OcpNetworkError or OcpContractError when reading an ended state from the ledger fails
 *
 * @example
 * ```typescript
 * import { planReplication, executeReplication } from '@open-captable-protocol/canton/replication';
 *
 * const plan = await planReplication({ source: manifest, index: writer.index, options: { ledger } });
 * if (plan.status === 'refused') console.warn(plan.refusals);
 * else await executeReplication(writer, plan);
 * ```
 */
export async function planReplication(input: PlanReplicationInput): Promise<ReplicationPlan> {
  return new ReplicationPlanner(input).plan();
}
