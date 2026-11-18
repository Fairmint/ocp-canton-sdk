/**
 * Recording a split (design, "Splits", "Recording a split"). A split touches no stock state: each state applies it at
 * its next event, and a record dated on or after the split is read in post-split units (the units rule). So when the
 * split is recorded, nothing in its class may be dated on or after it, and nothing may be written there until it is:
 *
 * 1. `CapTable_FreezeClass` consumes the class's epoch and recreates it frozen: writes in flight that fetched it fail,
 *    and no write that creates or changes a stock state of the class commits until it is unfrozen.
 * 2. The SDK reads the book at an offset at or after the freeze's commit (the writer's key index, brought current) and
 *    checks that no record in the class, class- and plan-level records included, is dated on or after the split.
 * 3. The TA records the `TX_STOCK_CLASS_SPLIT` in `CapTable_Apply` (the ledger accepts it only on a frozen epoch,
 *    dated after the class's latest split, below 64 splits).
 * 4. `CapTable_UnfreezeClass` recreates the epoch unfrozen.
 *
 * The class- and plan-level records, and the warrant, convertible and equity-compensation records that create no stock
 * security, touch no epoch, and their writers lock only their plan or instrument. So the procedure holds the whole
 * book (`issuer`, exclusive) and the class from the freeze to the unfreeze, and nothing the check reads can change
 * before the split commits.
 */

import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../errors';
import {
  buildFreezeClassCommand,
  buildUnfreezeClassCommand,
  readFreezeClassResult,
  readUnfreezeClassResult,
} from '../../functions/OpenCapTable/capTable/classFreeze';
import type { OcfEntityType } from '../../functions/OpenCapTable/capTable/entityTypes';
import type { OcfStockClassSplit } from '../../types/native';
import type {
  RecordedSplit,
  RecordSplitError,
  RecordSplitOptions,
  RecordSplitResult,
  RegisterBatchCommitted,
  RegisterCommitted,
  SplitOffender,
} from '../../types/register';
import { MAX_SPLITS_PER_CLASS } from '../caps';
import { requireDate } from '../dates';
import { classScope, ISSUER_SCOPE } from '../locks';
import type { RegisterIndex } from '../registerIndex';
import type { RegisterWriter, RegisterWriterSession } from '../writer';
import { writeScopes } from '../writerScopes';
import { recordDate } from './book';

/** The class-level records, by the field that names the class. */
const CLASS_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockClassAuthorizedSharesAdjustment',
  'stockClassConversionRatioAdjustment',
  'stockClassSplit',
  'valuation',
]);

/** The plan-level records, by the field that names the plan. */
const PLAN_RECORDS: ReadonlySet<OcfEntityType> = new Set<OcfEntityType>([
  'stockPlanPoolAdjustment',
  'stockPlanReturnToPool',
]);

const LISTED = 5;

function text(data: unknown, field: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const value: unknown = (data as Record<string, unknown>)[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

function texts(data: unknown, field: string): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const value: unknown = (data as Record<string, unknown>)[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** The date a record is read on: a valuation's effective date, any other record's date. */
function dateOf(entityType: OcfEntityType, data: unknown): string | null {
  const record = { data: (data ?? {}) as Record<string, unknown> };
  return entityType === 'valuation' ? recordDate(record, 'effective_date') : recordDate(record);
}

/**
 * The records in a split's class dated on or after the split, which the split cannot be recorded before: the class's
 * stock issuances and every record on their securities (events, vesting records, holds, the events naming them as
 * resulting or balance securities), the class's adjustments, splits and valuations, the pool adjustments and returns
 * to pool of each plan that includes the class, and the equity compensation of those plans (or of the class) with every
 * record on it.
 *
 * @throws OcpValidationError when the split's date is malformed, or the index keeps no record data
 */
export function splitOffenders(
  index: RegisterIndex,
  split: Pick<OcfStockClassSplit, 'id' | 'date' | 'stock_class_id'>
): SplitOffender[] {
  const date = requireDate(split.date, 'split.date');
  const stockClassId = split.stock_class_id;
  if (!index.retainsPayloads) {
    throw new OcpValidationError(
      'index',
      "A split's check reads the book's records: the key index was read with retainPayloads: false",
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, classification: 'register_payload_required' }
    );
  }
  const plans = new Set(
    index
      .recordsOf('stockPlan')
      .filter((plan) => texts(plan.data, 'stock_class_ids').includes(stockClassId))
      .map((plan) => plan.objectId)
  );
  const securities = new Set<string>();
  for (const issuance of index.recordsOf('stockIssuance')) {
    const securityId = text(issuance.data, 'security_id');
    if (securityId !== null && text(issuance.data, 'stock_class_id') === stockClassId) securities.add(securityId);
  }
  for (const state of index.statesOfClass(stockClassId)) securities.add(state.state.security_id);
  for (const grant of index.recordsOf('equityCompensationIssuance')) {
    const securityId = text(grant.data, 'security_id');
    const plan = text(grant.data, 'stock_plan_id');
    const inClass = text(grant.data, 'stock_class_id') === stockClassId || (plan !== null && plans.has(plan));
    if (securityId !== null && inClass) securities.add(securityId);
  }

  const offenders: SplitOffender[] = [];
  for (const record of index.records()) {
    if (record.objectId === split.id) continue;
    const recorded = dateOf(record.entityType, record.data);
    if (recorded === null || recorded < date) continue;
    const { data } = record;
    const inClass =
      (CLASS_RECORDS.has(record.entityType) && text(data, 'stock_class_id') === stockClassId) ||
      (PLAN_RECORDS.has(record.entityType) && plans.has(text(data, 'stock_plan_id') ?? '')) ||
      record.securityIds.some((securityId) => securities.has(securityId));
    if (!inClass) continue;
    offenders.push({
      objectId: record.objectId,
      objectType: record.objectType,
      entityType: record.entityType,
      date: recorded,
    });
  }
  return offenders.sort((a, b) => a.date.localeCompare(b.date) || a.objectId.localeCompare(b.objectId));
}

function requireSplit(split: OcfStockClassSplit): void {
  for (const field of ['id', 'stock_class_id'] as const) {
    if (typeof split[field] !== 'string' || split[field] === '') {
      throw new OcpValidationError(`split.${field}`, 'Required field is missing or empty', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: split[field],
      });
    }
  }
  requireDate(split.date, 'split.date');
}

function requireEpoch(session: RegisterWriterSession, stockClassId: string) {
  const epoch = session.index.epochOf(stockClassId);
  if (epoch === null) {
    throw new OcpContractError(
      `Stock class ${stockClassId} has no epoch in cap table ${session.index.context.cap_table_id}`,
      {
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        classification: 'register_epoch_not_found',
        context: { capTableId: session.index.context.cap_table_id, stockClassId },
      }
    );
  }
  return epoch;
}

/** The ledger's rules for a split on its class's epoch, checked before the class is frozen for it. */
function requireSplitOrder(splits: readonly RecordedSplit[], split: OcfStockClassSplit): void {
  const latest = splits[splits.length - 1];
  if (splits.length >= MAX_SPLITS_PER_CLASS) {
    throw new OcpValidationError(
      'split',
      `stock class ${split.stock_class_id} already has ${MAX_SPLITS_PER_CLASS} splits`,
      { code: OcpErrorCodes.OUT_OF_RANGE, classification: 'split_limit' }
    );
  }
  if (latest !== undefined && split.date <= latest.date) {
    throw new OcpValidationError(
      'split.date',
      `split ${split.id} must be dated after the class's latest recorded split`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        classification: 'split_order',
        receivedValue: split.date,
      }
    );
  }
}

function offendersError(
  split: OcfStockClassSplit,
  offenders: SplitOffender[],
  stillFrozen: boolean,
  unfreeze: RegisterCommitted<string> | null
): RecordSplitError {
  const listed = offenders.slice(0, LISTED).map((offender) => `${offender.objectId} (${offender.date})`);
  const more = offenders.length > LISTED ? ` and ${offenders.length - LISTED} more` : '';
  const error: RecordSplitError = new OcpValidationError(
    'split',
    `Split ${split.id} of stock class ${split.stock_class_id} dated ${split.date} cannot be recorded: ` +
      `${offenders.length} record(s) in the class are dated on or after it: ${listed.join(', ')}${more}${
        stillFrozen ? '. The class is still frozen' : ''
      }`,
    {
      code: OcpErrorCodes.OUT_OF_RANGE,
      classification: 'split_records_on_or_after',
      context: {
        stockClassId: split.stock_class_id,
        splitId: split.id,
        splitDate: split.date,
        offenders: offenders.length,
        stillFrozen,
      },
    }
  );
  Object.defineProperty(error, 'offenders', { value: offenders, enumerable: false, configurable: true });
  Object.defineProperty(error, 'unfreeze', { value: unfreeze, enumerable: false, configurable: true });
  return error;
}

/** A definite refusal: the command did not commit, so the class can be unfrozen again. */
function isDefinite(error: unknown): boolean {
  return !(error instanceof OcpContractError && error.code === OcpErrorCodes.OUTCOME_UNKNOWN);
}

async function epochCommand(
  writer: RegisterWriter,
  session: RegisterWriterSession,
  stockClassId: string,
  freeze: boolean
): Promise<RegisterCommitted<string>> {
  const anchor = writer.capTableAnchor();
  return session.submit({
    scopes: [classScope(stockClassId)],
    build: (index) => {
      const epoch = index.epochOf(stockClassId);
      const params = { ...anchor, transferAgent: writer.transferAgent, epochContractId: epoch?.contractId ?? '' };
      return freeze ? buildFreezeClassCommand(params) : buildUnfreezeClassCommand(params);
    },
    decode: (response) =>
      freeze
        ? readFreezeClassResult(response, { capTableContractId: anchor.capTableContractId })
        : readUnfreezeClassResult(response, { capTableContractId: anchor.capTableContractId }),
  });
}

/**
 * Record a stock class split by the design's procedure (see the module notes): freeze the class, check that nothing in
 * it is dated on or after the split on the book read after the freeze committed, record the split in `CapTable_Apply`
 * and unfreeze the class, all under one lease on the whole book and the class. When the check finds records, or the
 * ledger refuses the split, the class is unfrozen and the error says why.
 *
 * The procedure picks up where an earlier attempt stopped: a class already frozen is not frozen again, a split
 * already on the class's epoch is not recorded again, and the class is unfrozen.
 *
 * The split's own `CapTable_Apply` runs the writer's checks but the ceilings: the class's authorized shares are raised,
 * if at all, by an adjustment dated on the split's day, which can only be recorded after it.
 *
 * @throws OcpValidationError ({@link RecordSplitError}, `split_records_on_or_after`) when records in the class are dated
 * on or after the split, every one of them on `offenders`
 * @throws the writer's errors: a refused freeze, split or unfreeze (`CHOICE_FAILED`), a command whose outcome is
 * unknown (`OUTCOME_UNKNOWN`: the class stays frozen and locked until it is reconciled; call `recordSplit` again then)
 *
 * @example
 * ```typescript
 * const { split } = await register.recordSplit(writer, {
 *   object_type: 'TX_STOCK_CLASS_SPLIT',
 *   id: 'split-2026-11-01',
 *   date: '2026-11-01',
 *   stock_class_id: 'common',
 *   split_ratio: { numerator: '2', denominator: '1' },
 * });
 * ```
 */
export async function recordSplit(
  writer: RegisterWriter,
  split: OcfStockClassSplit,
  options: RecordSplitOptions = {}
): Promise<RecordSplitResult> {
  requireSplit(split);
  const stockClassId = split.stock_class_id;
  const operation = { kind: 'record', type: 'stockClassSplit', data: split } as const;
  return writer.session(
    (index) => [
      { scope: ISSUER_SCOPE, mode: 'exclusive' },
      classScope(stockClassId),
      ...writeScopes(index, { kind: 'apply', operations: [operation] }),
    ],
    async (session) => {
      let freeze: RegisterCommitted<string> | null = null;
      let recorded: RegisterBatchCommitted | null = null;
      const epoch = requireEpoch(session, stockClassId);
      if (!epoch.epoch.splits.some((candidate) => candidate.split_id === split.id)) {
        requireSplitOrder(epoch.epoch.splits, split);
        // A check before the freeze spares freezing a class the split cannot be recorded in yet; the check that counts
        // is the one on the book read after the freeze committed.
        let offenders = splitOffenders(session.index, split);
        if (offenders.length === 0 && !epoch.epoch.frozen) {
          freeze = await epochCommand(writer, session, stockClassId, true);
          const offset = await session.refresh();
          if (offset < freeze.offset) {
            throw new OcpContractError(
              `The key index is at offset ${offset}, before the freeze of stock class ${stockClassId} at ${freeze.offset}`,
              { code: OcpErrorCodes.TIMEOUT, retryable: true, classification: 'register_index_behind' }
            );
          }
          offenders = splitOffenders(session.index, split);
        }
        if (offenders.length > 0) {
          const { frozen } = requireEpoch(session, stockClassId).epoch;
          let unfreeze: RegisterCommitted<string> | null = null;
          if (frozen) {
            try {
              unfreeze = await epochCommand(writer, session, stockClassId, false);
            } catch {
              // The refusal below names the offenders; the class stays frozen and the caller retries.
            }
          }
          throw offendersError(split, offenders, frozen && unfreeze === null, unfreeze);
        }
        try {
          const { batches } = await session.apply([operation], { checks: { ceilings: false } });
          recorded = batches[0] ?? null;
        } catch (error) {
          if (isDefinite(error)) {
            try {
              await epochCommand(writer, session, stockClassId, false);
            } catch {
              // The split's refusal is the error to report; the class stays frozen.
            }
          }
          throw error;
        }
      }
      const current = requireEpoch(session, stockClassId);
      const unfreeze = current.epoch.frozen ? await epochCommand(writer, session, stockClassId, false) : null;
      return { freeze, split: recorded, unfreeze };
    },
    options.signal !== undefined ? { signal: options.signal } : {}
  );
}
