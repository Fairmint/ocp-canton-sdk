/**
 * A fake Ledger API for the register writer: an append-only ledger of transactions with an update stream, command
 * completions, update-by-ID reads and scripted submission outcomes (committed, response lost, rejected, never sent),
 * each submission optionally held at a gate so a test can observe what runs concurrently.
 */

import { ApiError, UnknownMutationOutcomeError, type LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionResponse } from '../../src/types/common';
import { CONTEXT } from './registerFixtures';

export const LEDGER_USER = 'ledger-api-user';
const SUBMIT_ENDPOINT = 'http://ledger.test/v2/commands/submit-and-wait-for-transaction';

/** What one transaction does: contracts it creates (created events), archives (contract IDs) and exercises. */
export interface LedgerEffects {
  created?: Array<Record<string, unknown>>;
  archived?: string[];
  /** Non-consuming exercised events (for instance an anchor choice with its `exerciseResult`) */
  exercised?: Array<Record<string, unknown>>;
}

/** How the ledger answers the next submission. */
export type ScriptedSubmission =
  /** Commit and answer with the transaction */
  | { outcome: 'commit'; effects?: LedgerEffects; gate?: Promise<void> }
  /** Commit, then lose the response (`UnknownMutationOutcomeError`) */
  | { outcome: 'lose'; effects?: LedgerEffects; gate?: Promise<void> }
  /** Lose the response of a command that never commits and leaves no completion */
  | { outcome: 'unknown'; gate?: Promise<void> }
  /** Reject it with a definite 400, completing it as failed */
  | { outcome: 'reject'; message?: string }
  /** Reject it, completing it as failed, and lose the response */
  | { outcome: 'lose-rejected'; message?: string }
  /** Fail before the request leaves the client */
  | { outcome: 'never-sent' };

interface CompletionEntry {
  commandId: string;
  offset: number;
  updateId?: string;
  status?: { code: number; message: string };
}

interface LedgerTransaction {
  updateId: string;
  commandId: string;
  workflowId: string;
  effectiveAt: string;
  offset: number;
  events: unknown[];
  synchronizerId: string;
  recordTime: string;
}

export interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

export function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Let every pending promise and immediate callback run. */
export async function settle(turns = 25): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

function unknownOutcome(cause: Error): UnknownMutationOutcomeError {
  return new UnknownMutationOutcomeError({ method: 'POST', endpoint: SUBMIT_ENDPOINT, attempts: 1 }, cause);
}

/** A fake ledger that the writer reads and writes through its `LedgerJsonApiClient` surface. */
export class FakeLedger {
  offset: number;
  /** Each transaction in ACS-delta shape, as the update stream serves it */
  readonly updates: LedgerTransaction[] = [];
  /** Each transaction in ledger-effects shape, by update ID */
  readonly ledgerEffects = new Map<string, LedgerTransaction>();
  readonly completionLog: CompletionEntry[] = [];
  /** Every submission, in order */
  readonly submitted: Array<{ commandId: string; actAs: string[]; commands: unknown[] }> = [];
  inFlight = 0;
  maxInFlight = 0;
  /** Fail this many completion reads, then the same number of update-by-ID reads, with a network error */
  failCompletionReads = 0;
  failUpdateReads = 0;
  /**
   * Computes the effects of a submission whose scripted outcome names none (a simulated ledger); an error it throws
   * rejects the submission with its message. `null` commits such a submission with no effects.
   */
  effectsOf: ((submission: { commandId: string; commands: unknown[] }) => LedgerEffects) | null = null;
  /** Every contract created so far, by contract ID */
  readonly contracts = new Map<string, Record<string, unknown>>();
  private readonly script: ScriptedSubmission[] = [];

  readonly getLedgerEnd = jest.fn(async () => Promise.resolve({ offset: this.offset }));

  readonly submitAndWaitForTransaction = jest.fn(
    async (params: { commandId?: string; actAs?: string[]; commands: unknown[] }) => this.submit(params)
  );

  readonly completions = jest.fn(async (params: { beginExclusive: number; limit?: number }) => {
    if (this.failCompletionReads > 0) {
      this.failCompletionReads -= 1;
      throw new Error('socket hang up');
    }
    const entries = this.completionLog
      .filter((entry) => entry.offset > params.beginExclusive)
      .slice(0, params.limit ?? Number.MAX_SAFE_INTEGER);
    return Promise.resolve(
      entries.map((entry) => ({
        completionResponse: {
          Completion: {
            value: {
              commandId: entry.commandId,
              offset: entry.offset,
              userId: LEDGER_USER,
              actAs: [CONTEXT.transfer_agent],
              synchronizerTime: { synchronizerId: 'synchronizer-1', recordTime: '2026-10-23T00:00:00Z' },
              ...(entry.updateId !== undefined ? { updateId: entry.updateId } : {}),
              ...(entry.status !== undefined ? { status: { ...entry.status, details: [] } } : {}),
            },
          },
        },
      }))
    );
  });

  readonly getUpdateById = jest.fn(async (params: { updateId: string; readAs: string[] }) => {
    if (this.failUpdateReads > 0) {
      this.failUpdateReads -= 1;
      throw new Error('socket hang up');
    }
    const transaction = this.ledgerEffects.get(params.updateId);
    if (transaction === undefined) throw new ApiError(`HTTP 404: update ${params.updateId} not found`, 404);
    return Promise.resolve({ update: { Transaction: { value: transaction } } });
  });

  readonly getUpdateByOffset = jest.fn(async (params: { offset: number }) => {
    const transaction = [...this.ledgerEffects.values()].find((candidate) => candidate.offset === params.offset);
    if (transaction === undefined) throw new ApiError(`HTTP 404: no update at offset ${params.offset}`, 404);
    return Promise.resolve({ update: { Transaction: { value: transaction } } });
  });

  readonly getEventsByContractId = jest.fn(async (params: { contractId: string }) => {
    const createdEvent = this.contracts.get(params.contractId);
    if (createdEvent === undefined) throw new ApiError(`HTTP 404: contract ${params.contractId} not found`, 404);
    return Promise.resolve({ created: { createdEvent, synchronizerId: 'synchronizer-1' } });
  });

  readonly makePostRequest = jest.fn(
    async (
      url: string,
      body: { beginExclusive: number; endInclusive: number },
      _config?: unknown,
      _options?: unknown
    ) => {
      const { pathname, searchParams } = new URL(url);
      if (pathname !== '/v2/updates') throw new ApiError(`HTTP 404: ${pathname}`, 404);
      const limit = Number(searchParams.get('limit') ?? Number.MAX_SAFE_INTEGER);
      const transactions = this.updates
        .filter((update) => update.offset > body.beginExclusive && update.offset <= body.endInclusive)
        .slice(0, limit);
      return Promise.resolve(transactions.map((transaction) => ({ update: { Transaction: { value: transaction } } })));
    }
  );

  constructor(offset = 100) {
    this.offset = offset;
  }

  getUserId(): string {
    return LEDGER_USER;
  }

  getApiUrl(): string {
    return 'http://ledger.test';
  }

  /** Queue the outcomes of the next submissions; a submission with none queued commits with no effects. */
  next(...submissions: ScriptedSubmission[]): this {
    this.script.push(...submissions);
    return this;
  }

  /** Commit a transaction, as another writer or a late command would, completing `commandId` when given. */
  commit(effects: LedgerEffects = {}, commandId?: string): LedgerTransaction {
    this.offset += 1;
    const { offset } = this;
    const updateId = `update-${offset}`;
    const created: Array<Record<string, unknown>> = (effects.created ?? []).map((event) => ({ ...event, offset }));
    const archived = effects.archived ?? [];
    const templateOf = (contractId: string): unknown => this.contracts.get(contractId)?.templateId ?? 'archived';
    for (const event of created) {
      if (typeof event.contractId === 'string') this.contracts.set(event.contractId, event);
    }
    const base = {
      updateId,
      commandId: commandId ?? '',
      workflowId: '',
      effectiveAt: '2026-10-23T00:00:00Z',
      offset,
      synchronizerId: 'synchronizer-1',
      recordTime: '2026-10-23T00:00:00Z',
    };
    this.updates.push({
      ...base,
      events: [
        ...created.map((event) => ({ CreatedEvent: event })),
        ...archived.map((contractId) => ({
          ArchivedEvent: {
            offset,
            nodeId: 1,
            contractId,
            templateId: templateOf(contractId),
            witnessParties: [],
            packageName: '',
          },
        })),
      ],
    });
    const transaction: LedgerTransaction = {
      ...base,
      events: [
        ...(effects.exercised ?? []).map((event) => ({ ExercisedEvent: { ...event, offset } })),
        ...created.map((event) => ({ CreatedEvent: event })),
        ...archived.map((contractId) => ({
          ExercisedEvent: {
            offset,
            nodeId: 2,
            contractId,
            templateId: templateOf(contractId),
            choice: 'Archive',
            consuming: true,
            exerciseResult: {},
          },
        })),
      ],
    };
    this.ledgerEffects.set(updateId, transaction);
    if (commandId !== undefined) this.completionLog.push({ commandId, offset, updateId });
    return transaction;
  }

  /** Complete a command as rejected without committing it. */
  reject(commandId: string, message: string): void {
    this.offset += 1;
    this.completionLog.push({ commandId, offset: this.offset, status: { code: 9, message } });
  }

  asClient(): LedgerJsonApiClient {
    return this as unknown as LedgerJsonApiClient;
  }

  /** A scripted submission's effects, else the simulated ledger's; its refusal rejects the command. */
  private effectsFor(
    effects: LedgerEffects | undefined,
    params: { commands: unknown[] },
    commandId: string
  ): LedgerEffects | undefined {
    if (effects !== undefined || this.effectsOf === null) return effects;
    try {
      return this.effectsOf({ commandId, commands: params.commands });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.reject(commandId, message);
      throw new ApiError(`HTTP 400: DAML_INTERPRETATION_ERROR - ${message}`, 400, 'Bad Request', {
        code: 'DAML_INTERPRETATION_ERROR',
      });
    }
  }

  private async submit(params: {
    commandId?: string;
    actAs?: string[];
    commands: unknown[];
  }): Promise<SubmitAndWaitForTransactionResponse> {
    const commandId = params.commandId ?? 'unnamed';
    this.submitted.push({ commandId, actAs: params.actAs ?? [], commands: params.commands });
    const step = this.script.shift() ?? { outcome: 'commit' };
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      if ('gate' in step && step.gate !== undefined) await step.gate;
      switch (step.outcome) {
        case 'commit':
          return {
            transaction: this.commit(this.effectsFor(step.effects, params, commandId), commandId),
          } as unknown as SubmitAndWaitForTransactionResponse;
        case 'lose':
          this.commit(this.effectsFor(step.effects, params, commandId), commandId);
          throw unknownOutcome(new ApiError('HTTP 500: the response was lost', 500, 'Internal Server Error'));
        case 'unknown':
          throw unknownOutcome(new ApiError('HTTP 504: Gateway Timeout', 504, 'Gateway Timeout'));
        case 'reject': {
          const message = step.message ?? 'ID already used';
          this.reject(commandId, message);
          throw new ApiError(`HTTP 400: DAML_INTERPRETATION_ERROR - ${message}`, 400, 'Bad Request', {
            code: 'DAML_INTERPRETATION_ERROR',
          });
        }
        case 'lose-rejected':
          this.reject(commandId, step.message ?? 'contract not active');
          throw unknownOutcome(new ApiError('HTTP 502: Bad Gateway', 502, 'Bad Gateway'));
        case 'never-sent':
          throw Object.assign(new Error('Failed to fetch a token'), { name: 'AuthenticationError' });
      }
    } finally {
      this.inFlight -= 1;
    }
  }
}

/** A clock that moves only when the writer waits, so outcome polls run at once. */
export function steppingClock(start = 1_000_000): { now: () => number; sleep: (ms: number) => Promise<void> } {
  let now = start;
  return {
    now: () => now,
    async sleep(ms: number): Promise<void> {
      now += ms;
      await Promise.resolve();
    },
  };
}
