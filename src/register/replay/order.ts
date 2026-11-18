/**
 * The order the offline replay writes a book's OCF in, as a replication writes it: date order with the units rule
 * and the same-day dependencies sorted.
 *
 * - Definitions come first, undated: the issuer, stakeholders, vesting terms, legend templates, stock classes (each
 *   after the classes it converts to), stock plans and valuations. Documents come last, since one may name any record.
 * - Dated records follow in date order. A `TX_STOCK_CLASS_SPLIT` dated D sorts before every other record dated D: a
 *   split applies to records dated before D, and records dated D or later are in post-split units (the units rule, so
 *   a split's own `TX_STOCK_REISSUANCE` can be dated D). Within a day the weights of the manifest's own sort apply
 *   (`txWeight`, the hold pair after vesting records and before terminal events), then the same tiebreaks.
 * - A bundled stock event carries its output issuances (found by `resulting_security_ids`, `balance_security_id` and a
 *   consolidation's `resulting_security_id`) and replays on its own date; a stop carries the cancellation of the
 *   settlement hold it canceled.
 * - Within a day, an issuance sorts before the events on its security, a hold cancellation after its hold, a
 *   reissuance after its split, a financing after the issuances it names, and an instrument event's resulting
 *   issuances after it.
 * - Vesting starts and events may be backdated, the one exception to per-security date order, and the ledger keeps no
 *   date order for warrants, convertibles and equity compensation, so such a record dated before its security's
 *   issuance replays on the issuance's day, after it; a financing replays on the day of the last issuance it names.
 *
 * OCF dates are day-only (OCF-IMP-003): two records of one day whose order this leaves open replay in the order of
 * these rules, and the replay retries a refused record after the rest of its day.
 */

import { mapOcfObjectTypeToEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import { getTimestampOrNull, txWeight, type OcfManifest } from '../../utils/cantonOcfExtractor';
import { normalizeObjectType } from '../../utils/planSecurityAliases';
import { dateOf, type ManifestRecord, type ReplayRecord } from './records';

/** The stock events `CapTable_Apply` writes bundled with their output issuances. */
export const BUNDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'TX_STOCK_TRANSFER',
  'TX_STOCK_CANCELLATION',
  'TX_STOCK_REPURCHASE',
  'TX_STOCK_CONVERSION',
  'TX_STOCK_REISSUANCE',
  'TX_STOCK_CONSOLIDATION',
]);

/** The issuances of the instruments the register keeps no state for. */
export const INSTRUMENT_ISSUANCE_TYPES: ReadonlySet<string> = new Set([
  'TX_WARRANT_ISSUANCE',
  'TX_CONVERTIBLE_ISSUANCE',
  'TX_EQUITY_COMPENSATION_ISSUANCE',
]);

const ISSUANCE_TYPES: ReadonlySet<string> = new Set(['TX_STOCK_ISSUANCE', ...INSTRUMENT_ISSUANCE_TYPES]);

/** The rank of each undated definition among the definitions. */
const DEFINITION_RANK: Readonly<Record<string, number>> = {
  ISSUER: 0,
  STAKEHOLDER: 1,
  VESTING_TERMS: 2,
  STOCK_LEGEND_TEMPLATE: 3,
  STOCK_CLASS: 4,
  STOCK_PLAN: 5,
  VALUATION: 6,
};

/** The manifest's categories of undated records, with the object type a record without one has. */
const UNDATED_CATEGORIES = [
  ['stakeholders', 'STAKEHOLDER'],
  ['stockClasses', 'STOCK_CLASS'],
  ['stockPlans', 'STOCK_PLAN'],
  ['vestingTerms', 'VESTING_TERMS'],
  ['valuations', 'VALUATION'],
  ['stockLegendTemplates', 'STOCK_LEGEND_TEMPLATE'],
  ['documents', 'DOCUMENT'],
] as const;

/** One unit of the replay: a record, or a bundled stock event with its outputs, or a stop with its companion. */
export interface ReplayUnit {
  /** The record, or the bundled event, or the stop */
  record: ReplayRecord;
  /** A bundled event's resulting issuances, one per resulting security in order; `null` where none is found */
  resulting: Array<ReplayRecord | null>;
  /** A bundled event's balance issuance, when it names a balance security and one is found */
  balance: ReplayRecord | null;
  /** A stop's companion: the cancellation of the settlement hold the stop canceled */
  companion: ReplayRecord | null;
  /** The day the unit replays on; `null` for a definition or a document */
  date: string | null;
  /** Its position in the replay order */
  index: number;
}

/** A manifest object the replay cannot place: no object, no known object type, no ID, or a transaction with no date. */
export interface ReplayOrderProblem {
  recordId: string | null;
  objectType: string | null;
  message: string;
  /** Its position among the manifest's objects */
  position: number;
}

/** A manifest in replay order. */
export interface ReplayOrder {
  units: ReplayUnit[];
  /** The objects left out, in manifest order */
  problems: ReplayOrderProblem[];
  /** The unit that creates each security: its issuance's, or the bundled event's that writes the issuance */
  creators: ReadonlyMap<string, ReplayUnit>;
  /** Every record placed, by object ID (the first of a repeated ID) */
  records: ReadonlyMap<string, ReplayRecord>;
}

/** The within-day weight of a record: the manifest sort's, with the hold pair after vesting records. */
export function replayWeight(objectType: string): number {
  if (objectType === 'TX_STOCK_HOLD' || objectType === 'TX_STOCK_HOLD_CANCELLATION') return 15;
  return txWeight({ object_type: objectType });
}

interface Placed {
  unit: ReplayUnit;
  /** The record's own date, before any lift */
  ownDate: string;
}

function text(data: ManifestRecord, field: string): string | null {
  const value = data[field];
  return typeof value === 'string' ? value : null;
}

function textList(data: ManifestRecord, field: string): string[] {
  const value = data[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** The output security IDs a bundled stock event names: its resulting securities in order, and its balance. */
export function bundledOutputIds(record: ReplayRecord): { resulting: string[]; balance: string | null } {
  const { data } = record;
  switch (record.objectType) {
    case 'TX_STOCK_CONSOLIDATION': {
      const resulting = text(data, 'resulting_security_id');
      return { resulting: resulting === null ? [] : [resulting], balance: null };
    }
    case 'TX_STOCK_REISSUANCE':
      return { resulting: textList(data, 'resulting_security_ids'), balance: null };
    case 'TX_STOCK_CANCELLATION':
    case 'TX_STOCK_REPURCHASE':
      return { resulting: [], balance: text(data, 'balance_security_id') };
    default:
      return { resulting: textList(data, 'resulting_security_ids'), balance: text(data, 'balance_security_id') };
  }
}

/** The securities a record acts on: a consolidation's inputs, any other event's `security_id`; none for an issuance. */
export function subjectSecurities(record: ReplayRecord): string[] {
  if (ISSUANCE_TYPES.has(record.objectType)) return [];
  if (record.objectType === 'TX_STOCK_CONSOLIDATION') return textList(record.data, 'security_ids');
  const security = text(record.data, 'security_id');
  return security === null ? [] : [security];
}

function readRecord(
  value: unknown,
  fallbackType: string | null,
  position: number,
  problems: ReplayOrderProblem[]
): ReplayRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    problems.push({
      recordId: null,
      objectType: fallbackType,
      message: 'a manifest record must be an object',
      position,
    });
    return null;
  }
  const data = value as ManifestRecord;
  const declared = text(data, 'object_type') ?? fallbackType;
  const id = text(data, 'id');
  if (declared === null) {
    problems.push({ recordId: id, objectType: null, message: 'a transaction must name its object_type', position });
    return null;
  }
  const objectType = normalizeObjectType(declared);
  const entityType = mapOcfObjectTypeToEntityType(objectType);
  if (entityType === null) {
    problems.push({ recordId: id, objectType: declared, message: `unknown object type ${declared}`, position });
    return null;
  }
  if (id === null) {
    problems.push({ recordId: null, objectType, message: `${objectType}: id must be a string`, position });
    return null;
  }
  return { objectType, entityType, id, data, position };
}

function isDated(objectType: string): boolean {
  return objectType.startsWith('TX_') || objectType.startsWith('CE_') || objectType === 'FINANCING';
}

function newUnit(record: ReplayRecord, date: string | null): ReplayUnit {
  return { record, resulting: [], balance: null, companion: null, date, index: -1 };
}

type SortKey = [number, string, number, string, number];

function sortKey(unit: ReplayUnit): SortKey {
  const { data } = unit.record;
  const created = getTimestampOrNull(data['createdAt'] ?? data['created_at']);
  return [
    replayWeight(unit.record.objectType),
    text(data, 'security_id') ?? '_no_security_',
    created ?? Number.POSITIVE_INFINITY,
    unit.record.id,
    unit.record.position,
  ];
}

function compareKeys(a: SortKey, b: SortKey): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined || x === y) continue;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** A binary min-heap of units by sort key. */
class UnitHeap {
  private readonly items: Array<{ key: SortKey; unit: ReplayUnit }> = [];

  get size(): number {
    return this.items.length;
  }

  push(unit: ReplayUnit, key: SortKey): void {
    const { items } = this;
    items.push({ key, unit });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const [up, down] = [items[parent], items[i]];
      if (up === undefined || down === undefined || compareKeys(up.key, down.key) <= 0) break;
      [items[parent], items[i]] = [down, up];
      i = parent;
    }
  }

  pop(): ReplayUnit | undefined {
    const { items } = this;
    const top = items[0];
    const last = items.pop();
    if (top === undefined || last === undefined || items.length === 0) return top?.unit;
    items[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      for (const child of [left, right]) {
        const candidate = items[child];
        const current = items[smallest];
        if (candidate !== undefined && current !== undefined && compareKeys(candidate.key, current.key) < 0) {
          smallest = child;
        }
      }
      if (smallest === i) break;
      const [a, b] = [items[i], items[smallest]];
      if (a === undefined || b === undefined) break;
      [items[i], items[smallest]] = [b, a];
      i = smallest;
    }
    return top.unit;
  }
}

/**
 * One day's units in dependency order: Kahn's algorithm taking the ready unit with the lowest sort key first. A
 * dependency cycle (only malformed data makes one) is broken at its unit with the lowest key.
 */
function orderDay(units: readonly ReplayUnit[], dependencies: ReadonlyMap<ReplayUnit, ReadonlySet<ReplayUnit>>) {
  const keys = new Map(units.map((unit) => [unit, sortKey(unit)]));
  const inDay = new Set(units);
  const waiting = new Map<ReplayUnit, number>();
  const dependents = new Map<ReplayUnit, ReplayUnit[]>();
  for (const unit of units) {
    const before = [...(dependencies.get(unit) ?? [])].filter((other) => inDay.has(other) && other !== unit);
    waiting.set(unit, before.length);
    for (const other of before) {
      const list = dependents.get(other);
      if (list === undefined) dependents.set(other, [unit]);
      else list.push(unit);
    }
  }
  const heap = new UnitHeap();
  for (const unit of units) {
    if (waiting.get(unit) === 0) heap.push(unit, keys.get(unit) ?? sortKey(unit));
  }
  const ordered: ReplayUnit[] = [];
  const done = new Set<ReplayUnit>();
  while (ordered.length < units.length) {
    let next = heap.pop();
    if (next === undefined || done.has(next)) {
      if (next !== undefined) continue;
      next = units
        .filter((unit) => !done.has(unit))
        .reduce((a, b) => (compareKeys(keys.get(a) ?? sortKey(a), keys.get(b) ?? sortKey(b)) <= 0 ? a : b));
    }
    done.add(next);
    ordered.push(next);
    for (const dependent of dependents.get(next) ?? []) {
      const left = (waiting.get(dependent) ?? 0) - 1;
      waiting.set(dependent, left);
      if (left === 0 && !done.has(dependent)) heap.push(dependent, keys.get(dependent) ?? sortKey(dependent));
    }
  }
  return ordered;
}

/** Definitions by rank; stock classes after the classes they convert to (a cycle keeps manifest order). */
function orderDefinitions(definitions: readonly ReplayUnit[]): ReplayUnit[] {
  const ranked = [...definitions].sort(
    (a, b) =>
      (DEFINITION_RANK[a.record.objectType] ?? 9) - (DEFINITION_RANK[b.record.objectType] ?? 9) ||
      a.record.position - b.record.position
  );
  const classes = ranked.filter((unit) => unit.record.objectType === 'STOCK_CLASS');
  const byId = new Map<string, ReplayUnit>();
  for (const unit of classes) if (!byId.has(unit.record.id)) byId.set(unit.record.id, unit);
  const sortedClasses: ReplayUnit[] = [];
  const state = new Map<ReplayUnit, 'visiting' | 'done'>();
  const visit = (unit: ReplayUnit): void => {
    if (state.has(unit)) return;
    state.set(unit, 'visiting');
    const rights = unit.record.data['conversion_rights'];
    for (const right of Array.isArray(rights) ? rights : []) {
      const target =
        typeof right === 'object' && right !== null
          ? (right as Record<string, unknown>)['converts_to_stock_class_id']
          : undefined;
      const targetUnit = typeof target === 'string' ? byId.get(target) : undefined;
      if (targetUnit !== undefined) visit(targetUnit);
    }
    state.set(unit, 'done');
    sortedClasses.push(unit);
  };
  for (const unit of classes) visit(unit);
  let nextClass = 0;
  return ranked.map((unit) => (unit.record.objectType === 'STOCK_CLASS' ? (sortedClasses[nextClass++] ?? unit) : unit));
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Put a manifest's records in replay order.
 *
 * @returns the units in order, the objects that cannot be placed, the unit that creates each security and the
 *   records by object ID
 */
export function orderReplay(manifest: OcfManifest): ReplayOrder {
  const problems: ReplayOrderProblem[] = [];
  const records: ReplayRecord[] = [];
  let position = 0;
  const take = (value: unknown, fallbackType: string | null): void => {
    const record = readRecord(value, fallbackType, position++, problems);
    if (record !== null) records.push(record);
  };
  if (manifest.issuer !== null) take(manifest.issuer, 'ISSUER');
  for (const [category, objectType] of UNDATED_CATEGORIES) {
    for (const value of manifest[category]) take(value, objectType);
  }
  for (const value of manifest.financings) take(value, 'FINANCING');
  for (const value of manifest.transactions) take(value, null);

  // Dated records need a date; the rest are definitions or documents.
  const dated: Placed[] = [];
  const definitions: ReplayUnit[] = [];
  const documents: ReplayUnit[] = [];
  const recordsById = new Map<string, ReplayRecord>();
  for (const record of records) {
    if (!recordsById.has(record.id)) recordsById.set(record.id, record);
    if (!isDated(record.objectType)) {
      (record.objectType === 'DOCUMENT' ? documents : definitions).push(newUnit(record, null));
      continue;
    }
    const date = dateOf(record.data['date']);
    if (date === null) {
      problems.push({
        recordId: record.id,
        objectType: record.objectType,
        message: `${record.objectType} ${record.id}: date must be a date (YYYY-MM-DD)`,
        position: record.position,
      });
      continue;
    }
    dated.push({ unit: newUnit(record, date), ownDate: date });
  }

  // Bundle each stock event with its output issuances, earliest event first, and each stop with its companion.
  const stockIssuances = new Map<string, ReplayRecord[]>();
  for (const { unit } of dated) {
    const security = text(unit.record.data, 'security_id');
    if (unit.record.objectType !== 'TX_STOCK_ISSUANCE' || security === null) continue;
    const list = stockIssuances.get(security);
    if (list === undefined) stockIssuances.set(security, [unit.record]);
    else list.push(unit.record);
  }
  const absorbed = new Set<ReplayRecord>();
  const takeOutput = (securityId: string): ReplayRecord | null => {
    const found = stockIssuances.get(securityId)?.find((record) => !absorbed.has(record)) ?? null;
    if (found !== null) absorbed.add(found);
    return found;
  };
  const byDate = (a: Placed, b: Placed): number =>
    a.ownDate < b.ownDate ? -1 : a.ownDate > b.ownDate ? 1 : a.unit.record.position - b.unit.record.position;
  for (const { unit } of [...dated].sort(byDate)) {
    if (!BUNDLED_EVENT_TYPES.has(unit.record.objectType)) continue;
    const outputs = bundledOutputIds(unit.record);
    unit.resulting = outputs.resulting.map(takeOutput);
    unit.balance = outputs.balance === null ? null : takeOutput(outputs.balance);
  }
  const cancellations = dated.filter(({ unit }) => unit.record.objectType === 'TX_STOCK_HOLD_CANCELLATION');
  for (const { unit } of dated) {
    const { data } = unit.record;
    if (unit.record.objectType !== 'TX_STOCK_HOLD' || data['hold_type'] !== 'STOP_TRANSFER') continue;
    const reason = `Canceled by stop ${text(data, 'reference') ?? ''}: ${text(data, 'reason_text') ?? ''}`;
    const companion = cancellations.find(
      ({ unit: candidate, ownDate }) =>
        !absorbed.has(candidate.record) &&
        ownDate === unit.date &&
        candidate.record.data['security_id'] === data['security_id'] &&
        candidate.record.data['reason_text'] === reason
    );
    if (companion !== undefined) {
      absorbed.add(companion.unit.record);
      unit.companion = companion.unit.record;
    }
  }
  const placed = dated.filter(({ unit }) => !absorbed.has(unit.record));

  // The unit that writes each record and creates each security.
  const recordUnit = new Map<string, ReplayUnit>();
  const creators = new Map<string, ReplayUnit>();
  const creatorDate = new Map<ReplayUnit, string>();
  for (const { unit, ownDate } of placed) {
    creatorDate.set(unit, ownDate);
    const { record, resulting, balance, companion } = unit;
    for (const member of [record, ...resulting, balance, companion]) {
      if (member !== null && !recordUnit.has(member.id)) recordUnit.set(member.id, unit);
    }
    const created = ISSUANCE_TYPES.has(record.objectType)
      ? [text(record.data, 'security_id')]
      : [...resulting, balance].map((output) => (output === null ? null : text(output.data, 'security_id')));
    for (const security of created) {
      if (security !== null && !creators.has(security)) creators.set(security, unit);
    }
  }

  // Lift what may replay later than its own date: a backdated vesting start or event, a record on an instrument, a
  // financing.
  for (const { unit, ownDate } of placed) {
    const { record } = unit;
    let date = ownDate;
    for (const security of subjectSecurities(record)) {
      const creator = creators.get(security);
      const createdOn = creator === undefined ? undefined : creatorDate.get(creator);
      if (creator === undefined || createdOn === undefined) continue;
      const onInstrument = INSTRUMENT_ISSUANCE_TYPES.has(creator.record.objectType);
      if (onInstrument || record.objectType === 'TX_VESTING_START' || record.objectType === 'TX_VESTING_EVENT') {
        date = maxDate(date, createdOn);
      }
    }
    if (record.objectType === 'FINANCING') {
      for (const issuanceId of textList(record.data, 'issuance_ids')) {
        const issuance = recordUnit.get(issuanceId);
        const issuedOn = issuance === undefined ? undefined : creatorDate.get(issuance);
        if (issuedOn !== undefined) date = maxDate(date, issuedOn);
      }
    }
    unit.date = date;
  }

  // Same-day dependencies.
  const dependencies = new Map<ReplayUnit, Set<ReplayUnit>>();
  const depend = (unit: ReplayUnit, on: ReplayUnit | undefined): void => {
    if (on === undefined || on === unit || on.date !== unit.date) return;
    const set = dependencies.get(unit) ?? new Set<ReplayUnit>();
    set.add(on);
    dependencies.set(unit, set);
  };
  for (const { unit } of placed) {
    const { record } = unit;
    for (const security of subjectSecurities(record)) depend(unit, creators.get(security));
    const holdId = record.objectType === 'TX_STOCK_HOLD_CANCELLATION' ? text(record.data, 'hold_id') : null;
    if (holdId !== null) depend(unit, recordUnit.get(holdId));
    const splitId = record.objectType === 'TX_STOCK_REISSUANCE' ? text(record.data, 'split_transaction_id') : null;
    if (splitId !== null) depend(unit, recordUnit.get(splitId));
    if (record.objectType === 'FINANCING') {
      for (const issuanceId of textList(record.data, 'issuance_ids')) depend(unit, recordUnit.get(issuanceId));
    }
    if (!BUNDLED_EVENT_TYPES.has(record.objectType)) {
      // An instrument event's (or a stock issuance's) named outputs are issued after it.
      const balance = text(record.data, 'balance_security_id');
      const named = [...textList(record.data, 'resulting_security_ids'), ...(balance === null ? [] : [balance])];
      for (const security of named) {
        const creator = creators.get(security);
        if (creator !== undefined) depend(creator, unit);
      }
    }
  }

  const days = new Map<string, ReplayUnit[]>();
  for (const { unit } of placed) {
    const day = unit.date ?? '';
    const list = days.get(day);
    if (list === undefined) days.set(day, [unit]);
    else list.push(unit);
  }
  const ordered = [
    ...orderDefinitions(definitions),
    ...[...days.keys()].sort().flatMap((day) => orderDay(days.get(day) ?? [], dependencies)),
    ...documents,
  ];
  ordered.forEach((unit, index) => {
    unit.index = index;
  });
  problems.sort((a, b) => a.position - b.position);
  return { units: ordered, problems, creators, records: recordsById };
}
