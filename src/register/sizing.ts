/**
 * Batch sizing for OpenCapTable-v35 writes: which per-transaction caps a write exceeds, and how to split a list of
 * `CapTable_Apply` operations into consecutive transactions that keep within every cap and the SDK's 8 MB budget.
 *
 * The ledger refuses a transaction over any of its counted caps (operations, claimed IDs, shards created, tranches,
 * polymorphic references, a restatement's contracts) and a record over its own caps (stored references, plan classes,
 * tranches); the SDK also keeps the JSON size of every input contract, every created contract and the choice argument
 * within its byte budget, because the counted caps alone cannot price every payload.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { applyOperationToDaml, restateOperationToDaml } from '../functions/OpenCapTable/capTable/choiceArguments';
import type {
  ApplyOperation,
  BatchPlan,
  BookWrite,
  BookWriteUsage,
  PlannedBatch,
  RestateOperation,
} from '../types/register';
import { emptyDelta, IndexView, OverlayView, plannedContractId, WriteSimulation } from './bookSimulation';
import {
  MAX_CLAIMS_PER_TRANSACTION,
  MAX_CONTRACTS_PER_RESTATEMENT,
  MAX_HOLD_CANCELLATIONS_PER_TRANSACTION,
  MAX_LOTS_PER_OPERATION,
  MAX_OPERATIONS_PER_APPLY,
  MAX_POLYMORPHIC_REFERENCES_PER_TRANSACTION,
  MAX_SHARDS_CREATED_PER_TRANSACTION,
  MAX_STORED_POLYMORPHIC_REFERENCES,
  MAX_TRANCHES_PER_TRANSACTION,
  SDK_BATCH_BYTE_BUDGET,
} from './caps';
import type { RegisterIndex } from './registerIndex';

/** How to size a write. */
export interface SizingOptions {
  /** The most bytes one transaction may carry, as the SDK estimates them (default 8 MiB) */
  byteBudget?: number;
}

const OPERATION_CAPS: Readonly<Record<Exclude<BookWrite['kind'], 'restate'>, readonly [number, string]>> = {
  apply: [MAX_OPERATIONS_PER_APPLY, `CapTable_Apply takes at most ${MAX_OPERATIONS_PER_APPLY} operations`],
  placeHolds: [MAX_LOTS_PER_OPERATION, `CapTable_PlaceHolds takes at most ${MAX_LOTS_PER_OPERATION} lots`],
  cancelHolds: [
    MAX_HOLD_CANCELLATIONS_PER_TRANSACTION,
    `CapTable_CancelHolds takes at most ${MAX_HOLD_CANCELLATIONS_PER_TRANSACTION} holds`,
  ],
  settle: [MAX_LOTS_PER_OPERATION, `CapTable_Settle takes at most ${MAX_LOTS_PER_OPERATION} lots`],
};

/**
 * The limits a write's usage exceeds, each with the ledger's message (the SDK's for the byte budget), in the order
 * the ledger would reach them; empty when the write fits.
 */
export function exceededLimits(kind: BookWrite['kind'], usage: BookWriteUsage, options: SizingOptions = {}): string[] {
  const byteBudget = options.byteBudget ?? SDK_BATCH_BYTE_BUDGET;
  const exceeded: string[] = [];
  if (kind === 'restate') {
    if (usage.contractsTouched > MAX_CONTRACTS_PER_RESTATEMENT) {
      exceeded.push(`CapTable_Restate touches at most ${MAX_CONTRACTS_PER_RESTATEMENT} contracts`);
    }
  } else {
    const [max, message] = OPERATION_CAPS[kind];
    if (usage.operations > max) exceeded.push(message);
  }
  if (usage.claims > MAX_CLAIMS_PER_TRANSACTION) {
    exceeded.push(`more than ${MAX_CLAIMS_PER_TRANSACTION} claimed IDs in one transaction`);
  }
  if (usage.tranches > MAX_TRANCHES_PER_TRANSACTION) {
    exceeded.push(`more than ${MAX_TRANCHES_PER_TRANSACTION} vesting tranches read or written in one transaction`);
  }
  if (usage.polymorphicReferences > MAX_POLYMORPHIC_REFERENCES_PER_TRANSACTION) {
    exceeded.push(
      `more than ${MAX_POLYMORPHIC_REFERENCES_PER_TRANSACTION} polymorphic references checked in one transaction`
    );
  }
  if (usage.shardsCreated > MAX_SHARDS_CREATED_PER_TRANSACTION) {
    exceeded.push(`more than ${MAX_SHARDS_CREATED_PER_TRANSACTION} ID shards created in one transaction`);
  }
  exceeded.push(...usage.recordCaps);
  if (usage.bytes > byteBudget) {
    exceeded.push(`an estimated ${usage.bytes} bytes, over the SDK's batch budget of ${byteBudget} bytes`);
  }
  return exceeded;
}

interface PlannedOperation {
  native: ApplyOperation;
  encoded: Fairmint.OpenCapTable.Apply.ApplyOperation;
  source: number;
}

/**
 * A financing or document with more references than one transaction checks, but no more than a record stores: its
 * create with the first 100, then one restatement per further 100, each extending the record.
 */
function referenceExtensions(
  operation: ApplyOperation
): { create: ApplyOperation; extensions: RestateOperation[] } | null {
  if (operation.kind !== 'record') return null;
  const limit = MAX_POLYMORPHIC_REFERENCES_PER_TRANSACTION;
  const prefixLengths = (count: number): number[] => {
    const lengths: number[] = [];
    for (let length = 2 * limit; length < count + limit; length += limit) lengths.push(Math.min(length, count));
    return lengths;
  };
  const fits = (count: number): boolean => count <= limit || count > MAX_STORED_POLYMORPHIC_REFERENCES;
  if (operation.type === 'financing') {
    const { data } = operation;
    if (fits(data.issuance_ids.length)) return null;
    return {
      create: { ...operation, data: { ...data, issuance_ids: data.issuance_ids.slice(0, limit) } },
      extensions: prefixLengths(data.issuance_ids.length).map((length) => ({
        kind: 'edit',
        type: 'financing',
        data: { ...data, issuance_ids: data.issuance_ids.slice(0, length) },
      })),
    };
  }
  if (operation.type === 'document') {
    const { data } = operation;
    const related = data.related_objects ?? [];
    if (fits(related.length)) return null;
    return {
      create: { ...operation, data: { ...data, related_objects: related.slice(0, limit) } },
      extensions: prefixLengths(related.length).map((length) => ({
        kind: 'edit',
        type: 'document',
        data: { ...data, related_objects: related.slice(0, length) },
      })),
    };
  }
  return null;
}

/**
 * Split a list of `CapTable_Apply` operations into consecutive transactions, in order, each within every per-
 * transaction cap and the byte budget, as the book will be when the earlier ones have committed. An operation is never
 * split, so a bundled stock event stays with its output issuances. A financing or document with more than 100 new
 * references (and at most 1,000) is created with the first 100 and then extended by restatements of 100 each.
 *
 * Each batch's inputs depend on what the batches before it create, so resolve them (`resolveInputs`) from the index as
 * it is when the batch is submitted. A record must not reference one that a later batch creates: order the list so
 * references point back, or keep both in one batch.
 *
 * @returns the batches, and the first operation that fits in no transaction alone (planning stops there)
 * @throws OcpValidationError for an operation the SDK cannot encode, and with the ledger's message for what the book
 * shows the ledger would refuse (an ID already claimed or in the derived form, a missing state, epoch, shard or
 * reference)
 */
export function planBatches(
  index: RegisterIndex,
  operations: readonly ApplyOperation[],
  options: SizingOptions = {}
): BatchPlan {
  const delta = emptyDelta();
  const view = new OverlayView(new IndexView(index), delta);
  const batches: PlannedBatch[] = [];
  const contractIdFor =
    (batch: number) =>
    (kind: string, key: string): string =>
      plannedContractId(`planned:${batch}:${kind}:${key}`);

  let pending: PlannedOperation[] = [];
  let simulation = new WriteSimulation(view, 'apply');
  const close = (finished: WriteSimulation): void => {
    finished.finish();
    batches.push({
      kind: 'apply',
      operations: pending.map((operation) => operation.native),
      sources: pending.map((operation) => operation.source),
      usage: finished.usage(),
    });
    finished.commitTo(delta, contractIdFor(batches.length - 1));
    pending = [];
    simulation = new WriteSimulation(view, 'apply');
  };

  for (const [position, operation] of operations.entries()) {
    const expansion = referenceExtensions(operation);
    const native = expansion?.create ?? operation;
    const planned: PlannedOperation = {
      native,
      encoded: applyOperationToDaml(native, `operations[${position}]`),
      source: position,
    };
    simulation.apply(planned.encoded, position);
    let exceeded = exceededLimits('apply', simulation.usage(), options);
    if (exceeded.length > 0 && pending.length > 0) {
      const without = new WriteSimulation(view, 'apply');
      for (const earlier of pending) without.apply(earlier.encoded, earlier.source);
      close(without);
      simulation.apply(planned.encoded, position);
      exceeded = exceededLimits('apply', simulation.usage(), options);
    }
    if (exceeded.length > 0) return { batches, oversized: { index: position, kind: operation.kind, exceeded } };
    pending.push(planned);
    if (expansion === null) continue;

    close(simulation);
    for (const extension of expansion.extensions) {
      const restatement = new WriteSimulation(view, 'restate');
      restatement.restate(restateOperationToDaml(extension, `operations[${position}]`), null, position);
      restatement.finish();
      const usage = restatement.usage();
      const over = exceededLimits('restate', usage, options);
      if (over.length > 0) return { batches, oversized: { index: position, kind: operation.kind, exceeded: over } };
      batches.push({ kind: 'restate', operations: [extension], sources: [position], usage });
      restatement.commitTo(delta, contractIdFor(batches.length - 1));
    }
  }
  if (pending.length > 0) close(simulation);
  return { batches, oversized: null };
}
