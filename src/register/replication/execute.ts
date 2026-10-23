/**
 * Writing a replication plan through the book's register writer: each step under the writer's locks and checks, the
 * split procedure for each historical split, and a new plan from the updated index after a failed step or once the
 * steps are written, until the book holds its source.
 *
 * Planning is idempotent, so a run that fails or stops part-way is resumed by planning again (or calling
 * `executeReplication` again): what was written is no longer missing.
 */

import { OcpContractError, OcpErrorCodes, OcpNetworkError, OcpValidationError } from '../../errors';
import type { RegisterBatchCommitted, RegisterWriteError } from '../../types/register';
import { recordSplit } from '../checks/splits';
import type { RegisterWriteOptions, RegisterWriter } from '../writer';
import { planReplication } from './plan';
import type {
  ExecuteReplicationOptions,
  ExecutedReplicationStep,
  ReplicationError,
  ReplicationPlan,
  ReplicationProgress,
  ReplicationResult,
  ReplicationStep,
} from './types';

const DEFAULT_MAX_REPLANS = 3;

/** Whether planning again may get past a failed step: anything but an unknown outcome, which must be reconciled. */
function replannable(error: unknown): boolean {
  return !(error instanceof OcpContractError && error.code === OcpErrorCodes.OUTCOME_UNKNOWN);
}

/** A failure planning again can cure without anything new on the book: a lock wait, a moved scope, a read. */
function transient(error: unknown): boolean {
  if (error instanceof OcpNetworkError) return true;
  return error instanceof OcpContractError && error.retryable;
}

class ReplicationRun {
  private readonly executed: ExecutedReplicationStep[] = [];
  private readonly committed: RegisterBatchCommitted[] = [];
  private transactions = 0;
  private replans = 0;
  private planNumber = 1;

  constructor(
    private readonly writer: RegisterWriter,
    private readonly options: ExecuteReplicationOptions
  ) {}

  async run(initial: ReplicationPlan): Promise<ReplicationResult> {
    const maxReplans = this.options.maxReplans ?? DEFAULT_MAX_REPLANS;
    let plan = initial;
    await this.writer.refresh();
    if (this.writer.index.offset !== plan.offset) plan = await this.replan(plan, false);
    for (;;) {
      if (plan.steps.length === 0) return this.result(plan);
      const before = this.transactions;
      let failure: unknown = null;
      for (const [position, step] of plan.steps.entries()) {
        this.requireNotAborted(plan);
        this.report({
          phase: 'step',
          plan: this.planNumber,
          step: position,
          steps: plan.steps.length,
          kind: step.kind,
          transactions: this.transactions,
        });
        try {
          await this.runStep(step);
        } catch (error) {
          failure = error;
          break;
        }
      }
      if (failure !== null) {
        const progressed = this.transactions > before;
        if (!replannable(failure) || (!progressed && !transient(failure)) || this.replans >= maxReplans) {
          throw this.attach(failure, plan);
        }
      } else if (this.replans >= maxReplans) {
        return this.result(plan);
      }
      this.requireNotAborted(plan);
      plan = await this.replan(plan, true);
    }
  }

  private async replan(plan: ReplicationPlan, counted: boolean): Promise<ReplicationPlan> {
    await this.writer.refresh();
    const next = await planReplication({ source: plan.source, index: this.writer.index, options: plan.options });
    if (counted) {
      this.replans += 1;
      this.planNumber += 1;
    }
    this.report({
      phase: 'replan',
      plan: this.planNumber,
      step: next.steps.length,
      steps: next.steps.length,
      kind: null,
      transactions: this.transactions,
    });
    return next;
  }

  private writeOptions(): RegisterWriteOptions {
    return {
      ...(this.options.checks !== undefined ? { checks: this.options.checks } : {}),
      ...(this.options.signal !== undefined ? { signal: this.options.signal } : {}),
    };
  }

  private async runStep(step: ReplicationStep): Promise<void> {
    try {
      switch (step.kind) {
        case 'preSplit':
        case 'apply': {
          const summary = await this.writer.apply(step.operations, this.writeOptions());
          this.record(summary.batches);
          this.executed.push({ kind: step.kind, step, summary });
          return;
        }
        case 'restate': {
          const summary = await this.writer.restate(step.operations, this.writeOptions());
          this.record(summary.batches);
          this.executed.push({ kind: 'restate', step, summary });
          return;
        }
        case 'split': {
          const result = await recordSplit(
            this.writer,
            step.split,
            this.options.signal !== undefined ? { signal: this.options.signal } : {}
          );
          this.transactions += [result.freeze, result.split, result.unfreeze].filter((part) => part !== null).length;
          if (result.split !== null) this.committed.push(result.split);
          this.executed.push({ kind: 'split', step, result });
        }
      }
    } catch (error) {
      const landed = (error as RegisterWriteError | null)?.committed;
      if (Array.isArray(landed)) this.record(landed);
      throw error;
    }
  }

  private record(batches: readonly RegisterBatchCommitted[]): void {
    this.committed.push(...batches);
    this.transactions += batches.length;
  }

  private report(progress: ReplicationProgress): void {
    try {
      this.options.onProgress?.(progress);
    } catch {
      // Progress reporting must not change what is written.
    }
  }

  private requireNotAborted(plan: ReplicationPlan): void {
    if (this.options.signal?.aborted !== true) return;
    throw this.attach(
      new OcpValidationError('signal', 'The replication was aborted', {
        code: OcpErrorCodes.INVALID_FORMAT,
        classification: 'replication_aborted',
      }),
      plan
    );
  }

  private result(plan: ReplicationPlan): ReplicationResult {
    return {
      plan,
      executed: [...this.executed],
      committed: [...this.committed],
      transactions: this.transactions,
      replans: this.replans,
    };
  }

  private attach(error: unknown, plan: ReplicationPlan): unknown {
    if (typeof error === 'object' && error !== null && Object.isExtensible(error)) {
      const value: ReplicationError['replication'] = this.result(plan);
      Object.defineProperty(error, 'replication', { value, enumerable: false, configurable: true });
    }
    return error;
  }
}

/**
 * Write a replication plan through the book's register writer (see the module notes). Each step runs under the
 * writer's locks and off-ledger checks: `apply` and `preSplit` steps through `writer.apply`, which packs them into
 * transactions, `restate` steps through `writer.restate`, and `split` steps through the split procedure. When a step
 * fails, or once every step is written, the run plans again from the updated index and goes on, until the plan is
 * `current` (or `blocked` or `refused` with nothing to write), or `maxReplans` plans have run.
 *
 * @param writer - The book's writer; its index is the one the plan was made on, or is planned on again
 * @param plan - From `planReplication`
 * @returns the last plan, every step written and every transaction committed
 * @throws the failing step's error ({@link ReplicationError}, what was written before it on `replication`) when the
 * outcome of a command is unknown (reconcile it with the writer first), when a step fails and planning again cannot
 * help (nothing committed since the last plan and the failure is not transient), or after `maxReplans` plans
 * @throws OcpValidationError when the plan is not the writer's book's
 *
 * @example
 * ```typescript
 * const plan = await planReplication({ source: manifest, index: writer.index, options: { ledger } });
 * const { plan: last, transactions } = await executeReplication(writer, plan, {
 *   onProgress: ({ plan, step, steps }) => console.log(`plan ${plan}: step ${step + 1} of ${steps}`),
 * });
 * if (last.status !== 'current') console.warn(last.status, last.violation ?? last.refusals);
 * ```
 */
export async function executeReplication(
  writer: RegisterWriter,
  plan: ReplicationPlan,
  options: ExecuteReplicationOptions = {}
): Promise<ReplicationResult> {
  if (plan.capTableId !== writer.context.cap_table_id) {
    throw new OcpValidationError('plan', `The plan is of cap table ${plan.capTableId}, not the writer's`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: writer.context.cap_table_id,
      receivedValue: plan.capTableId,
    });
  }
  return new ReplicationRun(writer, options).run(plan);
}
