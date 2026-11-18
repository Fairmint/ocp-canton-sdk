/**
 * Scoped locks for one writer per issuer (design, "What moves off the ledger"): the checks the ledger does not make
 * against the rest of a book hold only if no other write changes what a check read before the checked command's
 * outcome is known. Two writers that both pass an off-ledger check could otherwise commit together, because no shared
 * contract makes them conflict.
 *
 * A write locks what its checks depend on: the whole book (`issuer`), a class's outstanding shares (`class:<id>`), a
 * plan's pool (`plan:<id>`) or one instrument (`instrument:<security ID>`). Every write holds `issuer`, `shared` when
 * narrower scopes cover it, so a write that depends on the whole book (`issuer` held `exclusive`) waits for every other
 * write and blocks them. Scopes are taken in one canonical order, so two leases never deadlock.
 *
 * ta-service and the replication scripts run in different processes and must take their locks from one
 * {@link WriterLockProvider} backed by shared state, for example PostgreSQL advisory locks in ta-service's database.
 * The SDK ships only the interface and {@link InProcessLockProvider}.
 */

import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../errors';
import type {
  AcquireLockOptions,
  LockLease,
  LockMode,
  LockRequest,
  LockScope,
  ScopedLock,
  WriterLockProvider,
} from '../types/register';

/** The scope of the whole book. */
export const ISSUER_SCOPE = 'issuer' satisfies LockScope;

const SCOPE_PREFIXES = ['class:', 'plan:', 'instrument:'] as const;

function scopeOf(prefix: (typeof SCOPE_PREFIXES)[number], id: unknown, fieldPath: string): LockScope {
  if (typeof id !== 'string' || id === '') {
    throw new OcpValidationError(fieldPath, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: id,
    });
  }
  return `${prefix}${id}`;
}

/** The scope of a stock class's outstanding shares. */
export function classScope(stockClassId: string): LockScope {
  return scopeOf('class:', stockClassId, 'stockClassId');
}

/** The scope of a stock plan's pool. */
export function planScope(stockPlanId: string): LockScope {
  return scopeOf('plan:', stockPlanId, 'stockPlanId');
}

/** The scope of one warrant, convertible or equity-compensation instrument. */
export function instrumentScope(securityId: string): LockScope {
  return scopeOf('instrument:', securityId, 'securityId');
}

function requireScope(scope: unknown, fieldPath: string): LockScope {
  if (scope === ISSUER_SCOPE) return scope;
  if (typeof scope === 'string') {
    const prefix = SCOPE_PREFIXES.find((candidate) => scope.startsWith(candidate));
    if (prefix !== undefined && scope.length > prefix.length) return scope as LockScope;
  }
  throw new OcpValidationError(fieldPath, 'Must be issuer, class:<id>, plan:<id> or instrument:<security ID>', {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'LockScope',
    receivedValue: scope,
  });
}

function requireMode(mode: unknown, fieldPath: string): LockMode {
  if (mode === 'exclusive' || mode === 'shared') return mode;
  throw new OcpValidationError(fieldPath, 'Must be exclusive or shared', {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType: 'exclusive | shared',
    receivedValue: mode,
  });
}

function compareScopes(left: LockScope, right: LockScope): number {
  if (left === right) return 0;
  if (left === ISSUER_SCOPE) return -1;
  if (right === ISSUER_SCOPE) return 1;
  return left < right ? -1 : 1;
}

/**
 * Lock requests as one lease holds them: validated, each scope once (`exclusive` when any request holds it so), in the
 * canonical order every provider acquires in: `issuer` first, then by scope, as strings.
 *
 * @throws OcpValidationError for a scope or mode that is not one of the register's
 */
export function canonicalLocks(requests: readonly LockRequest[]): ScopedLock[] {
  if (!Array.isArray(requests)) {
    throw new OcpValidationError('scopes', 'Expected an array of lock scopes', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: requests,
    });
  }
  const modes = new Map<LockScope, LockMode>();
  for (const [position, request] of requests.entries()) {
    const fieldPath = `scopes[${position}]`;
    const lock: ScopedLock =
      typeof request === 'object' && request !== null
        ? {
            scope: requireScope(request.scope, `${fieldPath}.scope`),
            mode: requireMode(request.mode, `${fieldPath}.mode`),
          }
        : { scope: requireScope(request, fieldPath), mode: 'exclusive' };
    if (modes.get(lock.scope) !== 'exclusive') modes.set(lock.scope, lock.mode);
  }
  return [...modes].sort(([left], [right]) => compareScopes(left, right)).map(([scope, mode]) => ({ scope, mode }));
}

/** Whether two sets of locks conflict: they share a scope that one of them holds `exclusive`. */
export function locksConflict(held: readonly ScopedLock[], requested: readonly ScopedLock[]): boolean {
  const modes = new Map(held.map((lock) => [lock.scope, lock.mode]));
  return requested.some((lock) => {
    const mode = modes.get(lock.scope);
    return mode !== undefined && (mode === 'exclusive' || lock.mode === 'exclusive');
  });
}

/** Whether `held` covers `needed`: every needed scope is held, `exclusive` where it is needed so. */
export function locksCover(held: readonly ScopedLock[], needed: readonly ScopedLock[]): boolean {
  const modes = new Map(held.map((lock) => [lock.scope, lock.mode]));
  return needed.every((lock) => {
    const mode = modes.get(lock.scope);
    return mode === 'exclusive' || (mode === 'shared' && lock.mode === 'shared');
  });
}

interface Waiter {
  readonly mode: LockMode;
  readonly grant: () => void;
}

/** One scope of one book: who holds it, and who waits for it in arrival order. */
interface ScopeState {
  exclusive: boolean;
  shared: number;
  readonly waiters: Waiter[];
}

function lockWaitError(
  issuerKey: string,
  locks: readonly ScopedLock[],
  reason: 'timeout' | 'aborted',
  cause?: unknown
) {
  const scopes = locks.map((lock) => `${lock.scope} (${lock.mode})`).join(', ');
  return new OcpContractError(
    reason === 'timeout'
      ? `Timed out waiting for the writer locks of ${issuerKey}: ${scopes}`
      : `Stopped waiting for the writer locks of ${issuerKey}: ${scopes}`,
    {
      code: OcpErrorCodes.TIMEOUT,
      retryable: true,
      classification: reason === 'timeout' ? 'writer_lock_timeout' : 'writer_lock_aborted',
      ...(cause instanceof Error ? { cause } : {}),
      context: { issuerKey, scopes: locks.map((lock) => lock.scope) },
    }
  );
}

/**
 * The SDK's {@link WriterLockProvider} for writers that share one process: a FIFO queue per scope, so a waiter is
 * served in arrival order (an `exclusive` waiter is not overtaken by later `shared` ones), and scopes taken one at a
 * time in canonical order. It serializes nothing across processes: ta-service and replication need a shared provider.
 */
export class InProcessLockProvider implements WriterLockProvider {
  private readonly scopes = new Map<string, ScopeState>();

  async acquire(
    issuerKey: string,
    scopes: readonly LockRequest[],
    options: AcquireLockOptions = {}
  ): Promise<LockLease> {
    if (typeof issuerKey !== 'string' || issuerKey === '') {
      throw new OcpValidationError('issuerKey', 'Required field is missing or empty', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: issuerKey,
      });
    }
    const locks = canonicalLocks(scopes);
    const { signal, timeoutMs } = options;
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
      throw new OcpValidationError('timeoutMs', 'Must be a non-negative number of milliseconds', {
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue: timeoutMs,
      });
    }
    if (signal?.aborted === true) throw lockWaitError(issuerKey, locks, 'aborted', signal.reason);

    const held: string[] = [];
    let stop: ((error: Error) => void) | undefined;
    const stopped = new Promise<never>((_resolve, reject) => {
      stop = reject;
    });
    // A wait that loses the race still rejects later; nothing awaits it then.
    stopped.catch(() => undefined);
    const onAbort = (): void => stop?.(lockWaitError(issuerKey, locks, 'aborted', signal?.reason));
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => stop?.(lockWaitError(issuerKey, locks, 'timeout')), timeoutMs);
    try {
      for (const lock of locks) {
        const key = JSON.stringify([issuerKey, lock.scope]);
        await this.take(key, lock.mode, stopped);
        held.push(key);
      }
    } catch (error) {
      for (const [position, key] of held.entries()) this.give(key, locks[position]?.mode ?? 'exclusive');
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    let released = false;
    return {
      issuerKey,
      locks,
      release: async () => {
        if (released) return;
        released = true;
        for (let position = held.length - 1; position >= 0; position -= 1) {
          const key = held[position];
          if (key !== undefined) this.give(key, locks[position]?.mode ?? 'exclusive');
        }
        // In process the release is synchronous; the interface is asynchronous for shared providers.
        await Promise.resolve();
      },
    };
  }

  /** Take one scope in a mode: at once when it is free and nobody waits, else in turn, unless `stopped` rejects. */
  private async take(key: string, mode: LockMode, stopped: Promise<never>): Promise<void> {
    let state = this.scopes.get(key);
    if (state === undefined) {
      state = { exclusive: false, shared: 0, waiters: [] };
      this.scopes.set(key, state);
    }
    if (state.waiters.length === 0 && compatible(state, mode)) {
      hold(state, mode);
      return;
    }
    const scope = state;
    const progress = { granted: false };
    let resolveTurn: () => void = () => undefined;
    const turn = new Promise<void>((resolve) => {
      resolveTurn = resolve;
    });
    const waiter: Waiter = {
      mode,
      grant: () => {
        progress.granted = true;
        resolveTurn();
      },
    };
    scope.waiters.push(waiter);
    try {
      await Promise.race([turn, stopped]);
    } catch (error) {
      if (progress.granted) {
        // Granted in the same turn as the stop: give the scope back.
        this.give(key, mode);
      } else {
        const position = scope.waiters.indexOf(waiter);
        if (position >= 0) scope.waiters.splice(position, 1);
        this.serve(key, scope);
      }
      throw error;
    }
  }

  /** Release one hold of a scope, then serve its waiters. */
  private give(key: string, mode: LockMode): void {
    const state = this.scopes.get(key);
    if (state === undefined) return;
    if (mode === 'exclusive') state.exclusive = false;
    else state.shared = Math.max(0, state.shared - 1);
    this.serve(key, state);
  }

  /** Grant waiters from the front of the queue while they are compatible with the holders, in arrival order. */
  private serve(key: string, state: ScopeState): void {
    for (let next = state.waiters[0]; next !== undefined && compatible(state, next.mode); next = state.waiters[0]) {
      state.waiters.shift();
      hold(state, next.mode);
      next.grant();
    }
    if (!state.exclusive && state.shared === 0 && state.waiters.length === 0) this.scopes.delete(key);
  }
}

function compatible(state: ScopeState, mode: LockMode): boolean {
  return mode === 'exclusive' ? !state.exclusive && state.shared === 0 : !state.exclusive;
}

function hold(state: ScopeState, mode: LockMode): void {
  if (mode === 'exclusive') state.exclusive = true;
  else state.shared += 1;
}
