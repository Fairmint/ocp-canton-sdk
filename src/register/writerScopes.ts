/**
 * The scopes a register write locks: what the off-ledger checks of the write read (design, "What moves off the
 * ledger"), so that no other write can change it between the check and the write's outcome.
 *
 * - A record that touches a stock class's outstanding shares (a stock issuance, an event on a stock security, a
 *   split, a class adjustment, a restated state) locks `class:<id>`, and `plan:<id>` too for plan stock.
 * - Plan-level records and equity compensation under a plan lock `plan:<id>`.
 * - Events on a warrant, convertible or equity-compensation security lock `instrument:<security ID>` (and the plan of
 *   equity compensation under one).
 * - An edit locks the scopes of the record before and after it, and the scopes of every live record that points at it,
 *   so a definition cannot change under the records that depend on it.
 * - Every write holds `issuer`: `exclusive` for issuer-level records and edits of the issuer, for every delete (a
 *   delete could orphan a reference that any other write adds) and, while the issuer's authorized shares are finite,
 *   for every write that can raise outstanding shares (all classes count toward that ceiling); `shared` otherwise.
 */

import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import type {
  ApplyOperation,
  BookWrite,
  LockMode,
  LockScope,
  RegisterRecord,
  RegisterRequirement,
  RestateOperation,
  ScopedLock,
} from '../types/register';
import { recordSecurityIds } from './admissionRules';
import { requirementsOf } from './inputs';
import { canonicalLocks, classScope, instrumentScope, ISSUER_SCOPE, planScope } from './locks';
import type { RegisterIndex } from './registerIndex';

/** The records whose write can raise a class's outstanding shares, which the issuer-level ceiling bounds. */
const RAISES_OUTSTANDING: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockIssuance',
  'stockClassSplit',
  'stockConversion',
  'stockReissuance',
]);

/** The records that lock a stock class, by the field that names it. */
const CLASS_SCOPED: Readonly<Partial<Record<OcfEntityType, 'id' | 'stock_class_id'>>> = {
  stockClass: 'id',
  stockClassAuthorizedSharesAdjustment: 'stock_class_id',
  stockClassConversionRatioAdjustment: 'stock_class_id',
  stockClassSplit: 'stock_class_id',
};

/** The records that lock a stock plan's pool, by the field that names it. */
const PLAN_SCOPED: Readonly<Partial<Record<OcfEntityType, 'id' | 'stock_plan_id'>>> = {
  stockPlan: 'id',
  stockPlanPoolAdjustment: 'stock_plan_id',
  stockPlanReturnToPool: 'stock_plan_id',
};

/** Records that depend on the whole book. */
const BOOK_WIDE: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>(['issuer', 'issuerAuthorizedSharesAdjustment']);

type SecurityKind = 'stock' | 'warrant' | 'convertible' | 'equityCompensation';

interface SecurityScope {
  kind: SecurityKind | null;
  stockClassId: string | null;
  stockPlanId: string | null;
}

const ISSUANCE_KINDS: Readonly<Partial<Record<OcfEntityType, SecurityKind>>> = {
  stockIssuance: 'stock',
  warrantIssuance: 'warrant',
  convertibleIssuance: 'convertible',
  equityCompensationIssuance: 'equityCompensation',
};

function stringField(data: unknown, field: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const value: unknown = (data as Record<string, unknown>)[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

function isFiniteCeiling(value: unknown): boolean {
  return typeof value === 'string' && value !== '' && value !== 'UNLIMITED' && value !== 'NOT_APPLICABLE';
}

/**
 * Whether the issuer's authorized shares bound the book: the issuer or an issuer-level adjustment names a number. An
 * index without record payloads cannot tell, so it is taken to bind.
 */
function issuerCeilingBinds(index: RegisterIndex): boolean {
  if (!index.retainsPayloads) return true;
  for (const record of index.recordsOf('issuer')) {
    if (record.data === null || isFiniteCeiling(stringField(record.data, 'initial_shares_authorized'))) return true;
  }
  for (const record of index.recordsOf('issuerAuthorizedSharesAdjustment')) {
    if (record.data === null || isFiniteCeiling(stringField(record.data, 'new_shares_authorized'))) return true;
  }
  return false;
}

/** The records that point at each object ID, by the references the ledger checks; `null` if a record has no data. */
type ReverseReferences = ReadonlyMap<string, readonly RegisterRecord[]> | null;

function pointedObjects(index: RegisterIndex, requirement: RegisterRequirement): string[] {
  const issuanceOf = (securityId: string): RegisterRecord | null => index.issuanceOf(securityId);
  switch (requirement.kind) {
    case 'object':
      return [requirement.object_id];
    case 'security':
    case 'trigger': {
      const issuance = issuanceOf(requirement.security_id);
      return issuance === null ? [] : [issuance.objectId];
    }
    case 'vesting_condition': {
      const issuance = issuanceOf(requirement.security_id);
      if (issuance === null) return [];
      const terms = stringField(issuance.data, 'vesting_terms_id');
      return terms === null ? [issuance.objectId] : [issuance.objectId, terms];
    }
    case 'plan_includes_class':
      return [requirement.stock_plan_id, requirement.stock_class_id];
    case 'ratio_conversion_right':
      return [requirement.stock_class_id];
    case 'split_of_class':
      return [requirement.split_id, requirement.stock_class_id];
  }
}

/** The records pointing at each object, read from every record's references (`requirementsOf`). */
function reverseReferences(index: RegisterIndex): ReverseReferences {
  let references: Map<string, RegisterRecord[]> | null = new Map();
  for (const record of index.records()) {
    if (record.data === null) {
      references = null;
      break;
    }
    let requirements: RegisterRequirement[];
    try {
      requirements = requirementsOf(record.entityType, record.data as never);
    } catch {
      references = null;
      break;
    }
    for (const requirement of requirements) {
      for (const objectId of pointedObjects(index, requirement)) {
        const pointing = references.get(objectId);
        if (pointing === undefined) references.set(objectId, [record]);
        else if (!pointing.includes(record)) pointing.push(record);
      }
    }
  }
  return references;
}

/** The scopes of one write, built up operation by operation. */
class ScopeCollector {
  private readonly modes = new Map<LockScope, LockMode>([[ISSUER_SCOPE, 'shared']]);
  /** Securities an earlier operation of the write creates */
  private readonly created = new Map<string, SecurityScope>();
  private ceiling: boolean | null = null;
  /** Computed once per write, when an edit first needs it */
  private references: ReverseReferences | undefined;

  constructor(private readonly index: RegisterIndex) {}

  locks(): ScopedLock[] {
    return canonicalLocks([...this.modes].map(([scope, mode]) => ({ scope, mode })));
  }

  add(scope: LockScope): void {
    this.modes.set(scope, 'exclusive');
  }

  /** The write depends on the whole book. */
  book(): void {
    this.modes.set(ISSUER_SCOPE, 'exclusive');
  }

  /** The write can raise outstanding shares: the whole book while the issuer's authorized shares are finite. */
  raisesOutstanding(): void {
    this.ceiling ??= issuerCeilingBinds(this.index);
    if (this.ceiling) this.book();
  }

  /** Lock what an operation on a security depends on: its class (and plan) for stock, else the instrument. */
  security(securityId: string): void {
    this.lockSecurity(securityId, this.created.get(securityId) ?? this.lookup(securityId));
  }

  /**
   * Lock what a record's write depends on, and note any security it creates for the write's later operations. A record
   * the write only protects (one that points at a record the write edits) locks its scopes but raises nothing.
   */
  record(entityType: OcfEntityType, data: unknown, written = true): void {
    if (BOOK_WIDE.has(entityType)) {
      this.book();
      return;
    }
    if (written && RAISES_OUTSTANDING.has(entityType)) this.raisesOutstanding();
    const stockClassId = stringField(data, 'stock_class_id');
    const stockPlanId = stringField(data, 'stock_plan_id');
    const issued = ISSUANCE_KINDS[entityType];
    const ownSecurity = stringField(data, 'security_id');
    if (issued !== undefined && ownSecurity !== null) {
      this.created.set(ownSecurity, {
        kind: issued,
        stockClassId: issued === 'stock' ? stockClassId : null,
        stockPlanId,
      });
      this.security(ownSecurity);
      return;
    }
    const classField = CLASS_SCOPED[entityType];
    const stockClass = classField === undefined ? null : stringField(data, classField);
    if (stockClass !== null) this.add(classScope(stockClass));
    const planField = PLAN_SCOPED[entityType];
    const stockPlan = planField === undefined ? null : stringField(data, planField);
    if (stockPlan !== null) this.add(planScope(stockPlan));
    for (const securityId of recordSecurityIds(entityType, data)) this.security(securityId);
  }

  apply(operation: ApplyOperation): void {
    switch (operation.kind) {
      case 'record':
        this.record(operation.type, operation.data);
        return;
      case 'stockTransfer':
        this.outputs([...operation.resulting, ...(operation.balance ? [operation.balance] : [])]);
        this.record('stockTransfer', operation.transfer);
        return;
      case 'stockCancellation':
        this.outputs(operation.balance ? [operation.balance] : []);
        this.record('stockCancellation', operation.cancellation);
        return;
      case 'stockRepurchase':
        this.outputs(operation.balance ? [operation.balance] : []);
        this.record('stockRepurchase', operation.repurchase);
        return;
      case 'stockConversion':
        this.outputs([...operation.resulting, ...(operation.balance ? [operation.balance] : [])]);
        this.record('stockConversion', operation.conversion);
        return;
      case 'stockReissuance':
        this.outputs(operation.resulting);
        this.record('stockReissuance', operation.reissuance);
        return;
      case 'stockConsolidation':
        this.outputs([operation.resultingIssuance]);
        this.record('stockConsolidation', operation.consolidation);
        return;
      case 'vestingSnapshot':
        this.security(operation.securityId);
        break;
      case 'preSplitShard':
        // Shards are contended on the ledger, never locked.
        break;
    }
  }

  restate(operation: RestateOperation): void {
    switch (operation.kind) {
      case 'edit': {
        const id = stringField(operation.data, 'id');
        const current = id === null ? null : this.index.record(id);
        if (current?.data === null || (current !== null && current.entityType !== operation.type)) {
          this.book();
          return;
        }
        this.record(operation.type, operation.data);
        if (current !== null) this.record(current.entityType, current.data);
        const named = [...recordSecurityIds(operation.type, operation.data), ...(current?.securityIds ?? [])];
        // The securities as the book holds them now, whatever the edit's records say.
        for (const securityId of new Set(named)) this.lockSecurity(securityId, this.lookup(securityId));
        if (id !== null) this.pointingAt(id);
        return;
      }
      case 'delete':
        this.book();
        return;
      case 'setState': {
        const { state } = operation;
        this.add(classScope(state.stock_class_id));
        this.security(state.security_id);
        this.raisesOutstanding();
        return;
      }
      case 'endState':
        this.security(operation.securityId);
    }
  }

  /** The scopes of every live record that points at an object: the whole book when a record's data is unknown. */
  private pointingAt(objectId: string): void {
    // `null` (unknown references) is a result too, so it is cached as well.
    if (this.references === undefined) this.references = reverseReferences(this.index);
    const { references } = this;
    if (references === null) {
      this.book();
      return;
    }
    for (const record of references.get(objectId) ?? []) this.record(record.entityType, record.data, false);
  }

  private outputs(
    issuances: ReadonlyArray<{ security_id: string; stock_class_id: string; stock_plan_id?: string }>
  ): void {
    for (const issuance of issuances) {
      this.created.set(issuance.security_id, {
        kind: 'stock',
        stockClassId: issuance.stock_class_id,
        stockPlanId: issuance.stock_plan_id ?? null,
      });
      this.security(issuance.security_id);
    }
  }

  private lockSecurity(securityId: string, known: SecurityScope): void {
    if (known.kind === 'stock' && known.stockClassId !== null) this.add(classScope(known.stockClassId));
    else this.add(instrumentScope(securityId));
    if (known.stockPlanId !== null) this.add(planScope(known.stockPlanId));
  }

  private lookup(securityId: string): SecurityScope {
    const state = this.index.stateOf(securityId);
    const issuance = this.index.issuanceOf(securityId);
    const kind = issuance === null ? (state === null ? null : 'stock') : (ISSUANCE_KINDS[issuance.entityType] ?? null);
    return {
      kind,
      stockClassId:
        state?.state.stock_class_id ?? (kind === 'stock' ? stringField(issuance?.data, 'stock_class_id') : null),
      stockPlanId: stringField(issuance?.data, 'stock_plan_id'),
    };
  }
}

/**
 * The scopes a write locks, from the book as its key index holds it: each scope once, in canonical order, `issuer`
 * always among them (see the module notes for the rules). Compute them again once the index is current, under the
 * lock: a write that restates a security's class can move what another write must lock.
 */
export function writeScopes(index: RegisterIndex, write: BookWrite): ScopedLock[] {
  const collector = new ScopeCollector(index);
  switch (write.kind) {
    case 'apply':
      for (const operation of write.operations) collector.apply(operation);
      break;
    case 'restate':
      for (const operation of write.operations) collector.restate(operation);
      break;
    case 'placeHolds':
      for (const lot of write.lots) collector.security(lot.security_id);
      break;
    case 'cancelHolds':
      for (const hold of write.holds) collector.security(hold.security_id);
      break;
    case 'settle':
      for (const lot of write.lots)
        collector.security(lot.kind === 'draw' ? lot.lot.security_id : lot.hold.security_id);
      break;
  }
  return collector.locks();
}
