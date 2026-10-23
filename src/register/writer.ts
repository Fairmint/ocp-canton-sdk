/**
 * One writer per issuer (design, "What moves off the ledger"): the single write path that ta-service and replication
 * share, so that every check the ledger does not make against the rest of a book runs under a lock held from the check
 * until the command's outcome is known.
 *
 * A write acquires its scopes, brings the key index current from the update stream, runs its check, builds its command
 * with a deterministic command ID and submits it as the transfer agent. Then:
 *
 * - committed: the result is decoded and the index brought current through the commit before the scopes are released;
 * - definitely rejected (the ledger's answer, or a request that never left the client): the scopes are released and
 *   the rejection surfaces with its cause;
 * - unknown (`OUTCOME_UNKNOWN`, a timeout or a network error): the writer polls the ledger's completions for the command
 *   ID from the offset read before the submission. A success fetches the update by ID and continues as committed, a
 *   rejection releases. While no completion shows, the scopes stay locked and the writer refuses every write that
 *   conflicts with them, until {@link RegisterWriter.reconcile} settles the command from its completion or the book.
 *
 * `apply` and `restate` run the off-ledger checks (`register.checkWrite`) on every transaction under its locks, against
 * the UTC date of the writer's clock. A {@link RegisterWriter.session} holds one lease across several commands, for a
 * procedure whose check must hold from its first command to its last (`register.recordSplit`).
 *
 * The writer never resubmits. ta-service and the replication scripts run in different processes: give every writer of a
 * book one shared `WriterLockProvider` (the default in-process provider serializes only the writers of one process).
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { createHash } from 'node:crypto';
import { OcpContractError, OcpErrorCodes, OcpNetworkError, OcpValidationError } from '../errors';
import { buildApplyCommand, readApplyResult } from '../functions/OpenCapTable/capTable/apply';
import { buildRestateCommand, readRestateResult } from '../functions/OpenCapTable/capTable/restate';
import { submitObservedTransaction, type OcpObservabilityOptions } from '../observability';
import type { SubmitAndWaitForTransactionResponse } from '../types/common';
import type {
  ApplyOperation,
  BookWrite,
  BookWriteResult,
  CapTableCommand,
  CommandMarkers,
  LockLease,
  LockRequest,
  ReconcileResult,
  RegisterBatchCommitted,
  RegisterCheckSelection,
  RegisterCommitted,
  RegisterContext,
  RegisterWriteError,
  RegisterWriteSummary,
  ResolvedInputs,
  RestateOperation,
  ScopedLock,
  UnresolvedCommand,
  WriterClock,
  WriterLockProvider,
} from '../types/register';
import { contextKey, sameContext } from './admissionRules';
import { checkWrite } from './checks/write';
import { resolveInputs } from './inputs';
import { catchUp, findCompletion, readLedgerEnd, readTransactionById, type CommandCompletion } from './ledger';
import { canonicalLocks, InProcessLockProvider, ISSUER_SCOPE, locksConflict, locksCover } from './locks';
import { registerEventFormat, type RegisterEventFormat } from './reader';
import type { RegisterIndex } from './registerIndex';
import { planBatches, type SizingOptions } from './sizing';
import { writeScopes } from './writerScopes';

/** The default outcome poll: two minutes, once a second. */
const DEFAULT_OUTCOME_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 1_000;
const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
const DEFAULT_PAGE_SIZE = 100;
/** How often a write re-acquires when the current index moves its scopes before it gives up. */
const MAX_SCOPE_ATTEMPTS = 3;

/** The provider of writers given none: it serializes every writer of this process. */
const PROCESS_LOCKS = new InProcessLockProvider();

const SYSTEM_CLOCK: WriterClock = {
  now: () => Date.now(),
  async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  },
};

/** Errors canton-node-sdk raises before a request leaves the client: such a command never reached the ledger. */
const NOT_DISPATCHED_ERRORS: ReadonlySet<string> = new Set([
  'ConfigurationError',
  'AuthenticationError',
  'ValidationError',
]);

/** How to build a {@link RegisterWriter}. */
export interface RegisterWriterOptions extends OcpObservabilityOptions {
  ledger: LedgerJsonApiClient;
  /** The book's `Context`: the writer's index must be this book's */
  context: RegisterContext;
  /** The book's transfer agent, the only controller of the anchor's writes: every command is submitted as it */
  transferAgent: string;
  /** The book's key index. The writer keeps it current: give it to one writer only */
  index: RegisterIndex;
  /** Where the writer takes its scoped locks (default: one in-process provider shared by the process's writers) */
  locks?: WriterLockProvider;
  /** Wall-clock time and the wait between polls (default: the system clock) */
  clock?: WriterClock;
  /** How long to poll the completions of a command whose outcome is unknown, and how often */
  outcome?: { timeoutMs?: number; pollMs?: number };
  /** How long a write waits for its locks (default 60,000 ms) */
  lockTimeoutMs?: number;
  /** The ledger user the client submits as, whose completions the writer reads (default: the client's) */
  userId?: string;
  /** The party the writer reads the update stream and completions' transactions as (default: the transfer agent) */
  readAs?: string;
  /** The anchor's contract ID (default: the index's anchor) */
  capTableContractId?: string;
  /** The anchor's template ID (default: the bundled OpenCapTable-v35 template) */
  capTableTemplateId?: string;
  /** How `apply` and `restate` size their transactions */
  sizing?: SizingOptions;
  /** Updates or completions read per request (default 100) */
  pageSize?: number;
}

/** A built command, with what the writer needs to settle its outcome. */
export interface RegisterBuiltCommand {
  command: CapTableCommand;
  /** Defaults to {@link registerCommandId} of the command */
  commandId?: string;
  /** What the book shows once the command committed, for {@link RegisterWriter.reconcile} without a completion */
  markers?: Partial<CommandMarkers>;
}

/** One write through {@link RegisterWriter.submit}. */
export interface RegisterSubmission<T> {
  /**
   * The scopes the write locks, or how to compute them from the index. A function is evaluated again once the index is
   * current, under the lock, and the writer re-acquires when the scopes moved. `issuer` is added `shared` if absent.
   */
  scopes: readonly LockRequest[] | ((index: RegisterIndex) => readonly LockRequest[]);
  /** The off-ledger check, run on the current index under the lock; throw to refuse the write */
  check?: (index: RegisterIndex) => void | Promise<void>;
  /** Build the command from the current index, under the lock */
  build: (
    index: RegisterIndex
  ) => CapTableCommand | RegisterBuiltCommand | Promise<CapTableCommand | RegisterBuiltCommand>;
  /** Read the write's result from its committed ledger-effects transaction */
  decode: (response: SubmitAndWaitForTransactionResponse) => T;
  /** Stop waiting for the locks when this signal aborts (a submitted command is never abandoned) */
  signal?: AbortSignal;
}

/** Options of {@link RegisterWriter.apply} and {@link RegisterWriter.restate}. */
export interface RegisterWriteOptions {
  /**
   * The register's off-ledger checks of each transaction (`register.checkWrite`: ceilings, orphaned references, the
   * lifecycle of warrants, convertibles and equity compensation, and the ledger date, the writer clock's UTC date), run
   * on the current index under its locks before `check`. All run by default; `false` turns them off, an object single
   * ones (`{ ceilings: false }`). They read the book's records: an index read with `retainPayloads: false` needs them off
   */
  checks?: boolean | RegisterCheckSelection;
  /** A further check of each transaction, run on the current index under its locks; throw to refuse it */
  check?: (index: RegisterIndex, write: BookWrite) => void | Promise<void>;
  /** Scopes to lock beyond the write's own */
  scopes?: readonly LockRequest[];
  /** Stop waiting for locks when this signal aborts */
  signal?: AbortSignal;
}

/** Options of {@link RegisterWriter.reconcile}. */
export interface ReconcileOptions {
  /**
   * Settle the command as the caller established it elsewhere, without reading the ledger: for a command whose
   * completion is gone and whose markers cannot decide.
   */
  assume?: 'committed' | 'absent';
}

/** A write through a {@link RegisterWriterSession}: its scopes must be among the session's. */
export type RegisterSessionSubmission<T> = Omit<RegisterSubmission<T>, 'signal'>;

/**
 * What a {@link RegisterWriter.session} run writes through: the writer's own writes, each under the session's lease
 * instead of locks of its own, so nothing another write of the book does can come between them.
 */
export interface RegisterWriterSession {
  /** The scopes the session holds, in canonical order */
  readonly locks: readonly ScopedLock[];
  /** The writer's key index */
  readonly index: RegisterIndex;
  /** Bring the index current, as {@link RegisterWriter.refresh} */
  refresh(): Promise<number>;
  /** One write, as {@link RegisterWriter.submit} */
  submit<T>(submission: RegisterSessionSubmission<T>): Promise<RegisterCommitted<T>>;
  /** `CapTable_Apply` operations, as {@link RegisterWriter.apply} */
  apply(operations: readonly ApplyOperation[], options?: RegisterSessionWriteOptions): Promise<RegisterWriteSummary>;
  /** One `CapTable_Restate`, as {@link RegisterWriter.restate} */
  restate(
    operations: readonly RestateOperation[],
    options?: RegisterSessionWriteOptions
  ): Promise<RegisterWriteSummary>;
}

/** Options of a session's `apply` and `restate`: as the writer's, but the session holds the scopes. */
export type RegisterSessionWriteOptions = Omit<RegisterWriteOptions, 'scopes' | 'signal'>;

/** Options of {@link RegisterWriter.session}. */
export interface RegisterSessionOptions {
  /** Stop waiting for the locks when this signal aborts */
  signal?: AbortSignal;
}

/**
 * The deterministic command ID of a built anchor command: the choice and the SHA-256 of the book's `Context`, the
 * submitting parties and the command. The same command built from the same book gets the same ID, so the ledger's
 * command deduplication refuses a second submission of it.
 */
export function registerCommandId(context: RegisterContext, command: CapTableCommand): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([contextKey(context), command.actAs, command.command, command.disclosedContracts]))
    .digest('hex');
  return `ocp-${choiceOf(command)}-${digest}`;
}

function choiceOf(command: CapTableCommand): string {
  const exercise = (command.command as { ExerciseCommand?: { choice?: unknown } }).ExerciseCommand;
  return typeof exercise?.choice === 'string' && exercise.choice !== '' ? exercise.choice : 'command';
}

function templateOf(command: CapTableCommand): string | undefined {
  const exercise = (command.command as { ExerciseCommand?: { templateId?: unknown } }).ExerciseCommand;
  return typeof exercise?.templateId === 'string' ? exercise.templateId : undefined;
}

/** Whether a failed submission may still have committed: anything but a definite rejection or an undispatched request. */
function mayHaveCommitted(error: unknown): boolean {
  if (error instanceof OcpContractError) {
    if (error.code === OcpErrorCodes.OUTCOME_UNKNOWN) return true;
    if (error.code === OcpErrorCodes.CHOICE_FAILED && error.classification === 'definite_rejection') return false;
  }
  if (error instanceof OcpValidationError) return false;
  return !(error instanceof Error && NOT_DISPATCHED_ERRORS.has(error.name));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireDuration(value: unknown, fallback: number, fieldPath: string, positive = false): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new OcpValidationError(fieldPath, `Must be a ${positive ? 'positive' : 'non-negative'} number`, {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: value,
    });
  }
  return value;
}

function scopesText(locks: readonly ScopedLock[]): string {
  return locks.map((lock) => `${lock.scope} (${lock.mode})`).join(', ');
}

/** The book's markers of a committed `CapTable_Apply` or `CapTable_Restate`. */
function writeMarkers(index: RegisterIndex, write: BookWrite, resolved: ResolvedInputs): CommandMarkers {
  const createdObjects: string[] = [];
  const deletedObjects: string[] = [];
  const consumedContracts = [...resolved.inputs.states];
  const created = (...records: ReadonlyArray<{ id: string } | null | undefined>): void => {
    for (const record of records) if (record) createdObjects.push(record.id);
  };
  if (write.kind === 'apply') {
    for (const operation of write.operations) applyMarkers(operation, created);
  } else if (write.kind === 'restate') {
    for (const operation of write.operations) {
      if (operation.kind === 'delete') deletedObjects.push(operation.objectId);
      if (operation.kind === 'edit') {
        const current = index.record(operation.data.id);
        if (current !== null) consumedContracts.push(current.contractId);
      }
    }
  }
  return { createdObjects, deletedObjects, consumedContracts };
}

function applyMarkers(
  operation: ApplyOperation,
  created: (...records: ReadonlyArray<{ id: string } | null | undefined>) => void
): void {
  switch (operation.kind) {
    case 'record':
      created(operation.data);
      break;
    case 'stockTransfer':
      created(operation.transfer, ...operation.resulting, operation.balance);
      break;
    case 'stockCancellation':
      created(operation.cancellation, operation.balance);
      break;
    case 'stockRepurchase':
      created(operation.repurchase, operation.balance);
      break;
    case 'stockConversion':
      created(operation.conversion, ...operation.resulting, operation.balance);
      break;
    case 'stockReissuance':
      created(operation.reissuance, ...operation.resulting);
      break;
    case 'stockConsolidation':
      created(operation.consolidation, operation.resultingIssuance);
      break;
    case 'vestingSnapshot':
    case 'preSplitShard':
      // Neither creates a record: a snapshot's state and a pre-split's shard are their markers.
      break;
  }
}

function isPresent(index: RegisterIndex, objectId: string): boolean {
  try {
    return index.record(objectId) !== null;
  } catch {
    // Two active records under one object ID: it is present.
    return true;
  }
}

/**
 * What the book says of a command: `committed` when every marker shows it, `absent` when none does, `null` when the
 * markers disagree or there are none. Created and deleted objects decide when there are any; consumed contracts only
 * otherwise, since a write may also read a state it does not consume.
 */
function markerOutcome(index: RegisterIndex, markers: CommandMarkers): 'committed' | 'absent' | null {
  const votes: boolean[] = [
    ...markers.createdObjects.map((objectId) => isPresent(index, objectId)),
    ...markers.deletedObjects.map((objectId) => !isPresent(index, objectId)),
  ];
  if (votes.length === 0) votes.push(...markers.consumedContracts.map((contractId) => !index.contains(contractId)));
  if (votes.length === 0) return null;
  if (votes.every(Boolean)) return 'committed';
  if (votes.every((vote) => !vote)) return 'absent';
  return null;
}

/** Name the transactions a call committed before it failed on its error ({@link RegisterWriteError}). */
function attachCommitted(error: unknown, committed: readonly RegisterBatchCommitted[]): void {
  if (typeof error !== 'object' || error === null || !Object.isExtensible(error)) return;
  const value: RegisterWriteError['committed'] = [...committed];
  Object.defineProperty(error, 'committed', { value, enumerable: false, configurable: true });
}

/** The scopes one command runs under, and what becomes of them once its outcome is known. */
interface CommandLease {
  readonly locks: readonly ScopedLock[];
  /** The outcome is known: release the scopes (a session keeps them) */
  release(): Promise<void>;
  /** The outcome is unknown: keep the scopes locked until the returned lease is released by reconciliation */
  park(commandId: string): LockLease;
}

function ownLease(lease: LockLease): CommandLease {
  return { locks: lease.locks, release: async () => lease.release(), park: () => lease };
}

/**
 * A lease held for a session's whole run. Its commands release nothing; one whose outcome is unknown parks the lease,
 * which then stays locked after the run until every parked command is reconciled.
 */
class SessionLease {
  private running = true;
  private released = false;
  private readonly parked = new Set<string>();

  constructor(private readonly lease: LockLease) {}

  get locks(): readonly ScopedLock[] {
    return this.lease.locks;
  }

  get open(): boolean {
    return this.running;
  }

  /** The command IDs whose outcome is unknown. */
  unresolved(): string[] {
    return [...this.parked];
  }

  command(): CommandLease {
    return {
      locks: this.lease.locks,
      release: async () => Promise.resolve(),
      park: (commandId) => {
        this.parked.add(commandId);
        return {
          issuerKey: this.lease.issuerKey,
          locks: this.lease.locks,
          release: async () => {
            if (this.parked.delete(commandId)) await this.settle();
          },
        };
      },
    };
  }

  async end(): Promise<void> {
    this.running = false;
    await this.settle();
  }

  private async settle(): Promise<void> {
    if (this.running || this.parked.size > 0 || this.released) return;
    this.released = true;
    await this.lease.release();
  }
}

interface PreparedCommand {
  command: CapTableCommand;
  commandId: string;
  choice: string;
  markers: CommandMarkers;
  beginExclusive: number;
}

interface PendingCommand extends PreparedCommand {
  lease: LockLease;
  submittedAt: number;
  causeMessage: string;
}

type Outcome =
  | { kind: 'committed'; completion: CommandCompletion; response: SubmitAndWaitForTransactionResponse | null }
  | { kind: 'rejected'; completion: CommandCompletion }
  | { kind: 'unknown' };

/**
 * The writer of one book. Every write runs through {@link RegisterWriter.submit}; {@link RegisterWriter.apply} and
 * {@link RegisterWriter.restate} run `CapTable_Apply` and `CapTable_Restate` through it, transaction by transaction.
 *
 * @example
 * ```typescript
 * const writer = new register.RegisterWriter({ ledger, context, transferAgent: context.transfer_agent, index, locks });
 * const { batches } = await writer.apply([{ kind: 'record', type: 'stakeholder', data: stakeholder }]);
 * ```
 */
export class RegisterWriter {
  /** The book's `Context` */
  readonly context: RegisterContext;
  readonly transferAgent: string;
  /** The book's key index, kept current by the writer */
  readonly index: RegisterIndex;
  readonly clock: WriterClock;

  private readonly ledger: LedgerJsonApiClient;
  private readonly locks: WriterLockProvider;
  private readonly observability: OcpObservabilityOptions;
  private readonly issuerKey: string;
  private readonly userId: string;
  private readonly readAs: string;
  private readonly eventFormat: RegisterEventFormat;
  private readonly outcomeTimeoutMs: number;
  private readonly pollMs: number;
  private readonly lockTimeoutMs: number;
  private readonly pageSize: number;
  private readonly sizing: SizingOptions;
  private readonly capTableContractId: string | undefined;
  private readonly capTableTemplateId: string | undefined;
  private readonly pending = new Map<string, PendingCommand>();
  private syncTail: Promise<void> = Promise.resolve();

  /**
   * @throws OcpValidationError when the index is not the context's book, the transfer agent is not the book's, no
   * ledger user is known to read completions as, or a duration is malformed
   */
  constructor(options: RegisterWriterOptions) {
    const { ledger, context, index } = options;
    if (!sameContext(index.context, context)) {
      throw new OcpValidationError('index', `The index is not the book of cap table ${context.cap_table_id}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: index.context,
      });
    }
    if (options.transferAgent !== context.transfer_agent) {
      throw new OcpValidationError('transferAgent', "The writer submits as the book's transfer agent", {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: context.transfer_agent,
        receivedValue: options.transferAgent,
      });
    }
    const userId = options.userId ?? ledger.getUserId();
    if (typeof userId !== 'string' || userId === '') {
      throw new OcpValidationError(
        'userId',
        "The writer reads its commands' completions as the ledger user that submits them: configure the client's " +
          'userId or pass userId',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: userId }
      );
    }
    this.ledger = ledger;
    this.context = { ...context };
    this.transferAgent = options.transferAgent;
    this.index = index;
    this.locks = options.locks ?? PROCESS_LOCKS;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.observability = {
      ...(options.logger !== undefined ? { logger: options.logger } : {}),
      ...(options.metrics !== undefined ? { metrics: options.metrics } : {}),
      ...(options.defaultContext !== undefined ? { defaultContext: options.defaultContext } : {}),
    };
    this.issuerKey = contextKey(context);
    this.userId = userId;
    this.readAs = options.readAs ?? options.transferAgent;
    this.eventFormat = registerEventFormat(this.readAs);
    this.outcomeTimeoutMs = requireDuration(
      options.outcome?.timeoutMs,
      DEFAULT_OUTCOME_TIMEOUT_MS,
      'outcome.timeoutMs'
    );
    this.pollMs = requireDuration(options.outcome?.pollMs, DEFAULT_POLL_MS, 'outcome.pollMs', true);
    this.lockTimeoutMs = requireDuration(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS, 'lockTimeoutMs');
    this.pageSize = requireDuration(options.pageSize, DEFAULT_PAGE_SIZE, 'pageSize', true);
    this.sizing = options.sizing ?? {};
    this.capTableContractId = options.capTableContractId;
    this.capTableTemplateId = options.capTableTemplateId;
  }

  /** The commands whose outcome is unknown, each holding its scopes until it is reconciled. */
  unresolved(): UnresolvedCommand[] {
    return [...this.pending.values()].map((pending) => ({
      commandId: pending.commandId,
      choice: pending.choice,
      locks: pending.lease.locks.map((lock) => ({ ...lock })),
      beginExclusive: pending.beginExclusive,
      submittedAt: pending.submittedAt,
      markers: {
        createdObjects: [...pending.markers.createdObjects],
        deletedObjects: [...pending.markers.deletedObjects],
        consumedContracts: [...pending.markers.consumedContracts],
      },
      causeMessage: pending.causeMessage,
    }));
  }

  /**
   * Bring the index current: apply every transaction of the update stream after its offset, up to the ledger end.
   * Returns the offset the index is current at. A book whose index fell behind the participant's pruning offset cannot
   * be brought current: read it again (`register.readRegister`) and give the new index to a new writer.
   *
   * @throws OcpNetworkError when a read fails
   */
  async refresh(): Promise<number> {
    await this.serialized(async () => {
      const end = await readLedgerEnd(this.ledger);
      await this.catchUp(end);
    });
    return this.index.offset;
  }

  /**
   * Run one write: acquire its scopes, bring the index current, check, build, submit and settle the outcome (see the
   * module notes).
   *
   * @throws the check's or the builder's error, with the scopes released
   * @throws OcpContractError `TIMEOUT` when the locks are not granted in time
   * @throws OcpContractError `OUTCOME_UNKNOWN` (`poisoned_scope`) when a scope conflicts with an unresolved command's
   * @throws OcpContractError `CHOICE_FAILED` when the ledger rejected the command, with the rejection as its cause
   * @throws OcpContractError `OUTCOME_UNKNOWN` (`unresolved_command`) when no completion showed within the outcome
   * timeout: the scopes stay locked until {@link RegisterWriter.reconcile}
   */
  async submit<T>(submission: RegisterSubmission<T>): Promise<RegisterCommitted<T>> {
    const lease = await this.acquireCurrent(submission.scopes, submission.signal);
    return this.run(submission, ownLease(lease));
  }

  /**
   * Hold scopes for a whole procedure: acquire them once, bring the index current, then run `procedure` with a session
   * whose writes all run under that one lease, released when the procedure ends. A session write whose outcome is
   * unknown keeps the lease locked past the end, until {@link RegisterWriter.reconcile} settles it, and refuses the
   * session's later writes.
   *
   * @param scopes - The scopes, or how to compute them from the current index (re-acquired when they move); `issuer`
   * is added `shared` if absent
   * @throws OcpContractError `TIMEOUT` when the locks are not granted in time, `OUTCOME_UNKNOWN` when they conflict with
   * an unresolved command's; and whatever the procedure throws, with the lease released
   */
  async session<T>(
    scopes: RegisterSubmission<unknown>['scopes'],
    procedure: (session: RegisterWriterSession) => Promise<T>,
    options: RegisterSessionOptions = {}
  ): Promise<T> {
    const lease = new SessionLease(await this.acquireCurrent(scopes, options.signal));
    const handle: RegisterWriterSession = {
      locks: lease.locks,
      index: this.index,
      refresh: async () => {
        this.requireOpen(lease);
        return this.refresh();
      },
      submit: async <R>(submission: RegisterSessionSubmission<R>) => this.sessionSubmit(lease, submission),
      apply: async (operations, writeOptions = {}) => this.applyWith(operations, writeOptions, lease),
      restate: async (operations, writeOptions = {}) => this.restateWith(operations, writeOptions, lease),
    };
    try {
      return await procedure(handle);
    } finally {
      await lease.end();
    }
  }

  /** The anchor the writer exercises: its configured contract, else the index's. */
  capTableAnchor(): { capTableContractId: string; capTableTemplateId?: string } {
    return {
      capTableContractId: this.anchorContractId(),
      ...(this.capTableTemplateId !== undefined ? { capTableTemplateId: this.capTableTemplateId } : {}),
    };
  }

  /**
   * Write `CapTable_Apply` operations in order: planned into transactions within every cap (`register.planBatches`) on
   * the current index, each transaction then submitted on its own, its inputs resolved again from the index as the
   * transactions before it left it, under the scopes of its operations (`register.writeScopes`).
   *
   * @throws OcpValidationError before anything is submitted when an operation fits in no transaction
   * @throws the failing transaction's error, carrying the transactions committed before it on `committed`
   * ({@link RegisterWriteError})
   */
  async apply(
    operations: readonly ApplyOperation[],
    options: RegisterWriteOptions = {}
  ): Promise<RegisterWriteSummary> {
    return this.applyWith(operations, options, null);
  }

  /**
   * Write one `CapTable_Restate`: its operations in one transaction, so a correction and the states it restates commit
   * together, under the scopes of every record and state it touches.
   *
   * @throws OcpValidationError when the restatement exceeds a cap or a check refuses it, and the submission's error as
   * `submit` throws it
   */
  async restate(
    operations: readonly RestateOperation[],
    options: RegisterWriteOptions = {}
  ): Promise<RegisterWriteSummary> {
    return this.restateWith(operations, options, null);
  }

  private async applyWith(
    operations: readonly ApplyOperation[],
    options: RegisterWriteOptions,
    session: SessionLease | null
  ): Promise<RegisterWriteSummary> {
    if (session !== null) this.requireOpen(session);
    await this.refresh();
    const plan = planBatches(this.index, operations, this.sizing);
    if (plan.oversized !== null) {
      const { index, kind, exceeded } = plan.oversized;
      throw new OcpValidationError(
        `operations[${index}]`,
        `Operation ${index} (${kind}) fits in no transaction: ${exceeded.join('; ')}`,
        { code: OcpErrorCodes.OUT_OF_RANGE, receivedValue: exceeded }
      );
    }
    return this.writeBatches(
      plan.batches.map((batch) => ({
        write:
          batch.kind === 'apply'
            ? { kind: 'apply', operations: batch.operations }
            : { kind: 'restate', operations: batch.operations },
        sources: batch.sources,
      })),
      options,
      session
    );
  }

  private async restateWith(
    operations: readonly RestateOperation[],
    options: RegisterWriteOptions,
    session: SessionLease | null
  ): Promise<RegisterWriteSummary> {
    return this.writeBatches(
      [{ write: { kind: 'restate', operations }, sources: operations.map((_operation, position) => position) }],
      options,
      session
    );
  }

  /**
   * Settle a command whose outcome was unknown: from its completion when the ledger has one, else from the book (its
   * markers, on the current index), else as `assume` says. Releases its scopes once settled. Call it when the command
   * can no longer commit (its completion shows, or its submission's deadline passed): a command still in flight that
   * the book does not show yet would be taken as `absent`.
   *
   * @throws OcpValidationError when the writer holds no unresolved command with this ID
   * @throws OcpContractError `OUTCOME_UNKNOWN` when neither the completions nor the markers decide; the command stays
   * unresolved
   * @throws OcpNetworkError when a read fails; the command stays unresolved
   */
  async reconcile(commandId: string, options: ReconcileOptions = {}): Promise<ReconcileResult> {
    const pending = this.pending.get(commandId);
    if (pending === undefined) {
      throw new OcpValidationError('commandId', `The writer holds no unresolved command ${commandId}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: commandId,
      });
    }
    const { assume } = options;
    if (assume !== undefined && !(['committed', 'absent'] as readonly string[]).includes(assume)) {
      throw new OcpValidationError('assume', 'Must be committed or absent', {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: assume,
      });
    }
    let result: ReconcileResult;
    if (assume !== undefined) {
      result = { commandId, outcome: assume, evidence: 'assumed', updateId: null, status: null };
    } else {
      const { completion } = await findCompletion(this.ledger, commandId, pending.beginExclusive, this.completions());
      if (completion !== null) {
        result = {
          commandId,
          outcome: completion.status === null ? 'committed' : 'rejected',
          evidence: 'completion',
          updateId: completion.updateId,
          status: completion.status,
        };
      } else {
        await this.refresh();
        const outcome = markerOutcome(this.index, pending.markers);
        if (outcome === null) {
          throw new OcpContractError(
            `The outcome of ${pending.choice} command ${commandId} is still unknown: the ledger shows no completion ` +
              'and the book does not decide it',
            {
              code: OcpErrorCodes.OUTCOME_UNKNOWN,
              choice: pending.choice,
              retryable: false,
              classification: 'unresolved_command',
              context: { commandId, scopes: pending.lease.locks.map((lock) => lock.scope) },
            }
          );
        }
        result = { commandId, outcome, evidence: 'index', updateId: null, status: null };
      }
    }
    this.pending.delete(commandId);
    try {
      if (result.outcome === 'committed') await this.refreshQuietly();
    } finally {
      await pending.lease.release();
    }
    return result;
  }

  private async writeBatches(
    batches: ReadonlyArray<{ write: Extract<BookWrite, { kind: 'apply' | 'restate' }>; sources: readonly number[] }>,
    options: RegisterWriteOptions,
    session: SessionLease | null
  ): Promise<RegisterWriteSummary> {
    const committed: RegisterBatchCommitted[] = [];
    const selection = options.checks ?? true;
    for (const { write, sources } of batches) {
      let anchor = '';
      const { check } = options;
      const submission: RegisterSubmission<BookWriteResult> = {
        scopes: (index) => [...writeScopes(index, write), ...(options.scopes ?? [])],
        check: async (index) => {
          if (selection !== false) {
            checkWrite(index, write, { ...(selection === true ? {} : selection), today: this.today() });
          }
          await check?.(index, write);
        },
        build: (index) => {
          anchor = this.anchorContractId();
          return this.buildBatch(index, write, anchor);
        },
        decode: (response) =>
          write.kind === 'apply'
            ? readApplyResult(response, { capTableContractId: anchor })
            : readRestateResult(response, { capTableContractId: anchor }),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      };
      try {
        const outcome =
          session === null ? await this.submit(submission) : await this.sessionSubmit(session, submission);
        committed.push({ ...outcome, kind: write.kind, sources: [...sources] });
      } catch (error) {
        attachCommitted(error, committed);
        throw error;
      }
    }
    return { batches: committed };
  }

  /** The ledger date the checks compare with: the writer clock's UTC date. */
  private today(): string {
    return new Date(this.clock.now()).toISOString().slice(0, 10);
  }

  /** Acquire a write's scopes and bring the index current, re-acquiring while the current index moves them. */
  private async acquireCurrent(
    scopes: RegisterSubmission<unknown>['scopes'],
    signal: AbortSignal | undefined
  ): Promise<LockLease> {
    const scopesNow = (): ScopedLock[] => this.scopesOf(scopes);
    let lease = await this.acquire(scopesNow(), signal);
    try {
      for (let attempt = 1; ; attempt += 1) {
        await this.refresh();
        const needed = scopesNow();
        if (locksCover(lease.locks, needed)) return lease;
        if (attempt >= MAX_SCOPE_ATTEMPTS) {
          throw new OcpContractError(`The scopes of the write kept moving: ${scopesText(needed)}`, {
            code: OcpErrorCodes.TIMEOUT,
            retryable: true,
            classification: 'writer_scopes_moved',
            context: { scopes: needed.map((lock) => lock.scope) },
          });
        }
        const wanted = canonicalLocks([...lease.locks, ...needed]);
        await lease.release();
        lease = await this.acquire(wanted, signal);
      }
    } catch (error) {
      await lease.release();
      throw error;
    }
  }

  private scopesOf(scopes: RegisterSubmission<unknown>['scopes']): ScopedLock[] {
    const requested = typeof scopes === 'function' ? scopes(this.index) : scopes;
    return canonicalLocks([{ scope: ISSUER_SCOPE, mode: 'shared' }, ...requested]);
  }

  /** Check, build and submit a write under scopes already held. */
  private async run<T>(submission: RegisterSessionSubmission<T>, lease: CommandLease): Promise<RegisterCommitted<T>> {
    let prepared: PreparedCommand;
    try {
      await submission.check?.(this.index);
      prepared = await this.prepare(await submission.build(this.index));
    } catch (error) {
      await lease.release();
      throw error;
    }
    return this.execute(prepared, lease, submission.decode);
  }

  /** One write of a session: the index brought current, and the write's scopes checked against the session's. */
  private async sessionSubmit<T>(
    session: SessionLease,
    submission: RegisterSessionSubmission<T>
  ): Promise<RegisterCommitted<T>> {
    this.requireOpen(session);
    const [unresolved] = session.unresolved();
    if (unresolved !== undefined) {
      throw new OcpContractError(
        `The session's scopes ${scopesText(session.locks)} are held by command ${unresolved}, whose outcome is ` +
          'unknown: reconcile it first',
        {
          code: OcpErrorCodes.OUTCOME_UNKNOWN,
          retryable: false,
          classification: 'poisoned_scope',
          context: { commandId: unresolved, scopes: session.locks.map((lock) => lock.scope) },
        }
      );
    }
    await this.refresh();
    const needed = this.scopesOf(submission.scopes);
    if (!locksCover(session.locks, needed)) {
      throw new OcpValidationError(
        'scopes',
        `The write needs ${scopesText(needed)}; the session holds ${scopesText(session.locks)}`,
        { code: OcpErrorCodes.INVALID_FORMAT, classification: 'writer_scope_not_held' }
      );
    }
    return this.run(submission, session.command());
  }

  private requireOpen(session: SessionLease): void {
    if (session.open) return;
    throw new OcpValidationError('session', 'The session has ended: its lease is released', {
      code: OcpErrorCodes.INVALID_FORMAT,
      classification: 'writer_session_ended',
    });
  }

  private buildBatch(
    index: RegisterIndex,
    write: Extract<BookWrite, { kind: 'apply' | 'restate' }>,
    capTableContractId: string
  ): RegisterBuiltCommand {
    const resolved = resolveInputs(index, write, this.sizing);
    if (resolved.exceeded.length > 0) {
      throw new OcpValidationError('operations', `The transaction exceeds its caps: ${resolved.exceeded.join('; ')}`, {
        code: OcpErrorCodes.OUT_OF_RANGE,
        receivedValue: resolved.exceeded,
      });
    }
    const params = {
      capTableContractId,
      ...(this.capTableTemplateId !== undefined ? { capTableTemplateId: this.capTableTemplateId } : {}),
      transferAgent: this.transferAgent,
      inputs: resolved.inputs,
    };
    const command =
      write.kind === 'apply'
        ? buildApplyCommand(params, write.operations)
        : buildRestateCommand(params, write.operations);
    return { command, markers: writeMarkers(index, write, resolved) };
  }

  private anchorContractId(): string {
    const contractId = this.capTableContractId ?? this.index.anchor?.contractId;
    if (contractId === undefined) {
      throw new OcpContractError(`Cap table ${this.context.cap_table_id} has no anchor in the index`, {
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        classification: 'register_anchor_not_found',
        context: { capTableId: this.context.cap_table_id },
      });
    }
    return contractId;
  }

  /** Acquire scopes, refusing at once those an unresolved command holds. */
  private async acquire(locks: readonly ScopedLock[], signal: AbortSignal | undefined): Promise<LockLease> {
    for (const pending of this.pending.values()) {
      if (!locksConflict(pending.lease.locks, locks)) continue;
      throw new OcpContractError(
        `Scopes ${scopesText(locks)} conflict with ${scopesText(pending.lease.locks)} held by ${pending.choice} ` +
          `command ${pending.commandId}, whose outcome is unknown: reconcile it first`,
        {
          code: OcpErrorCodes.OUTCOME_UNKNOWN,
          choice: pending.choice,
          retryable: false,
          classification: 'poisoned_scope',
          context: { commandId: pending.commandId, scopes: locks.map((lock) => lock.scope) },
        }
      );
    }
    return this.locks.acquire(this.issuerKey, locks, {
      ...(signal !== undefined ? { signal } : {}),
      timeoutMs: this.lockTimeoutMs,
    });
  }

  private async prepare(built: CapTableCommand | RegisterBuiltCommand): Promise<PreparedCommand> {
    const normalized: RegisterBuiltCommand = 'actAs' in built ? { command: built } : built;
    const { command } = normalized;
    if (command.actAs.length !== 1 || command.actAs[0] !== this.transferAgent) {
      // The writer reads the completions of its own submissions only, so it settles only the TA's commands.
      throw new OcpValidationError('command.actAs', "The writer submits only the transfer agent's commands", {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: `[${this.transferAgent}]`,
        receivedValue: command.actAs,
      });
    }
    const commandId = normalized.commandId ?? registerCommandId(this.context, command);
    return {
      command,
      commandId,
      choice: choiceOf(command),
      markers: {
        createdObjects: [...(normalized.markers?.createdObjects ?? [])],
        deletedObjects: [...(normalized.markers?.deletedObjects ?? [])],
        consumedContracts: [...(normalized.markers?.consumedContracts ?? [])],
      },
      beginExclusive: await readLedgerEnd(this.ledger),
    };
  }

  private async execute<T>(
    prepared: PreparedCommand,
    lease: CommandLease,
    decode: (response: SubmitAndWaitForTransactionResponse) => T
  ): Promise<RegisterCommitted<T>> {
    const { command, commandId, choice } = prepared;
    const templateId = templateOf(command);
    let response: SubmitAndWaitForTransactionResponse | null;
    try {
      response = await submitObservedTransaction(
        this.ledger,
        { commands: [command.command], actAs: command.actAs, disclosedContracts: command.disclosedContracts },
        { ...this.observability, context: { commandId } },
        { operation: 'register.writer', ...(templateId !== undefined ? { templateId } : {}), choice }
      );
    } catch (error) {
      if (!mayHaveCommitted(error)) {
        await lease.release();
        throw error;
      }
      const outcome = await this.awaitOutcome(prepared);
      if (outcome.kind === 'rejected') {
        await lease.release();
        const { status } = outcome.completion;
        throw new OcpContractError(`${choice} command ${commandId} was rejected: ${status?.message ?? 'rejected'}`, {
          code: OcpErrorCodes.CHOICE_FAILED,
          choice,
          ...(error instanceof Error ? { cause: error } : {}),
          retryable: false,
          classification: 'definite_rejection',
          context: { commandId, statusCode: status?.code, completionOffset: outcome.completion.offset },
        });
      }
      if (outcome.kind === 'unknown') {
        const causeMessage = errorMessage(error);
        this.pending.set(commandId, {
          ...prepared,
          lease: lease.park(commandId),
          submittedAt: this.clock.now(),
          causeMessage,
        });
        throw new OcpContractError(
          `The outcome of ${choice} command ${commandId} is unknown: no completion within ${this.outcomeTimeoutMs} ms ` +
            `(${causeMessage}). Its scopes ${scopesText(lease.locks)} stay locked until it is reconciled`,
          {
            code: OcpErrorCodes.OUTCOME_UNKNOWN,
            choice,
            ...(error instanceof Error ? { cause: error } : {}),
            retryable: false,
            classification: 'unresolved_command',
            context: {
              commandId,
              scopes: lease.locks.map((lock) => lock.scope),
              beginExclusive: prepared.beginExclusive,
            },
          }
        );
      }
      ({ response } = outcome);
      if (response === null) {
        await this.refreshQuietly();
        await lease.release();
        const { updateId } = outcome.completion;
        throw new OcpNetworkError(
          `${choice} command ${commandId} committed${updateId === null ? '' : ` as update ${updateId}`}, but its ` +
            'transaction could not be read',
          {
            classification: 'committed_result_unread',
            ...(error instanceof Error ? { cause: error } : {}),
            context: { commandId, updateId },
          }
        );
      }
    }
    const { transaction } = response;
    try {
      return { commandId, updateId: transaction.updateId, offset: transaction.offset, result: decode(response) };
    } finally {
      await this.catchUpQuietly(transaction.offset);
      await lease.release();
    }
  }

  /** Poll the command's completion until it shows or the outcome timeout passes. */
  private async awaitOutcome(prepared: PreparedCommand): Promise<Outcome> {
    const deadline = this.clock.now() + this.outcomeTimeoutMs;
    let cursor = prepared.beginExclusive;
    let completion: CommandCompletion | null = null;
    for (;;) {
      try {
        if (completion === null) {
          const found = await findCompletion(this.ledger, prepared.commandId, cursor, this.completions());
          cursor = found.readUpTo;
          ({ completion } = found);
        }
        if (completion?.status !== undefined && completion.status !== null) return { kind: 'rejected', completion };
        if (completion !== null) {
          if (completion.updateId === null) return { kind: 'committed', completion, response: null };
          const response = await readTransactionById(this.ledger, completion.updateId, this.readAs);
          return { kind: 'committed', completion, response };
        }
      } catch (error) {
        this.warn('Reading the outcome of a register command failed; polling again', {
          commandId: prepared.commandId,
          errorMessage: errorMessage(error),
        });
      }
      if (this.clock.now() >= deadline) {
        return completion === null ? { kind: 'unknown' } : { kind: 'committed', completion, response: null };
      }
      await this.clock.sleep(this.pollMs);
    }
  }

  private completions(): { userId: string; party: string; pageSize: number; streamIdleTimeoutMs: number } {
    return {
      userId: this.userId,
      party: this.transferAgent,
      pageSize: this.pageSize,
      streamIdleTimeoutMs: this.pollMs,
    };
  }

  /** Read the update stream into the index up to an offset, one catch-up at a time. */
  private async catchUp(endInclusive: number): Promise<void> {
    await catchUp(this.ledger, this.index, { eventFormat: this.eventFormat, endInclusive, pageSize: this.pageSize });
  }

  /** After a commit: bring the index through it; a failure is logged, the next write brings the index current. */
  private async catchUpQuietly(offset: number): Promise<void> {
    try {
      await this.serialized(async () => this.catchUp(offset));
    } catch (error) {
      this.warn('Bringing the register index current after a commit failed', {
        offset,
        errorMessage: errorMessage(error),
      });
    }
  }

  private async refreshQuietly(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.warn('Bringing the register index current failed', { errorMessage: errorMessage(error) });
    }
  }

  private async serialized(task: () => Promise<void>): Promise<void> {
    const run = this.syncTail.then(task);
    this.syncTail = run.catch(() => undefined);
    await run;
  }

  private warn(message: string, context: Record<string, unknown>): void {
    try {
      this.observability.logger?.warn(message, { capTableId: this.context.cap_table_id, ...context });
    } catch {
      // Observability hooks must not change ledger command outcomes.
    }
  }
}
