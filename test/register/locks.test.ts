import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../src/errors';
import {
  canonicalLocks,
  classScope,
  InProcessLockProvider,
  instrumentScope,
  locksConflict,
  locksCover,
  planScope,
} from '../../src/register/locks';
import type { LockLease } from '../../src/types/register';

const BOOK = 'book-1';

/** Settle every pending promise callback. */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

/** A lease request whose settlement the test observes. */
function track(lease: Promise<LockLease>): { lease: Promise<LockLease>; granted: () => boolean } {
  let granted = false;
  void lease.then(
    () => {
      granted = true;
    },
    () => undefined
  );
  return { lease, granted: () => granted };
}

describe('lock scopes', () => {
  it('names the four scopes and refuses an empty ID', () => {
    expect([classScope('CLS-A'), planScope('PLAN-1'), instrumentScope('W-1')]).toEqual([
      'class:CLS-A',
      'plan:PLAN-1',
      'instrument:W-1',
    ]);
    expect(() => classScope('')).toThrow(OcpValidationError);
  });

  it('puts locks in canonical order, each scope once, exclusive when any request holds it so', () => {
    expect(
      canonicalLocks([
        'plan:P',
        { scope: 'issuer', mode: 'shared' },
        'class:B',
        { scope: 'class:A', mode: 'shared' },
        { scope: 'class:B', mode: 'shared' },
        { scope: 'class:A', mode: 'exclusive' },
      ])
    ).toEqual([
      { scope: 'issuer', mode: 'shared' },
      { scope: 'class:A', mode: 'exclusive' },
      { scope: 'class:B', mode: 'exclusive' },
      { scope: 'plan:P', mode: 'exclusive' },
    ]);
  });

  it('refuses a scope or mode the register does not know', () => {
    expect(() => canonicalLocks(['class:'])).toThrow('Must be issuer, class:<id>, plan:<id>');
    expect(() => canonicalLocks(['stakeholder:SH-1' as never])).toThrow(OcpValidationError);
    expect(() => canonicalLocks([{ scope: 'issuer', mode: 'read' as never }])).toThrow('Must be exclusive or shared');
    expect(() => canonicalLocks('issuer' as never)).toThrow('Expected an array of lock scopes');
  });

  it('tells conflicting and covering lock sets apart', () => {
    const held = canonicalLocks([{ scope: 'issuer', mode: 'shared' }, 'class:A']);
    expect(locksConflict(held, canonicalLocks([{ scope: 'issuer', mode: 'shared' }, 'class:B']))).toBe(false);
    expect(locksConflict(held, canonicalLocks([{ scope: 'class:A', mode: 'shared' }]))).toBe(true);
    expect(locksConflict(held, canonicalLocks(['issuer']))).toBe(true);
    expect(locksCover(held, canonicalLocks([{ scope: 'class:A', mode: 'shared' }]))).toBe(true);
    expect(locksCover(held, canonicalLocks(['issuer']))).toBe(false);
    expect(locksCover(held, canonicalLocks(['class:B']))).toBe(false);
  });
});

describe('InProcessLockProvider', () => {
  it('serializes two exclusive leases on one scope and runs two scopes in parallel', async () => {
    const locks = new InProcessLockProvider();
    const first = await locks.acquire(BOOK, ['class:A']);
    const second = track(locks.acquire(BOOK, ['class:A']));
    const other = track(locks.acquire(BOOK, ['class:B']));
    await flush();
    expect(second.granted()).toBe(false);
    expect(other.granted()).toBe(true);

    await first.release();
    await flush();
    expect(second.granted()).toBe(true);
    await (await second.lease).release();
    await (await other.lease).release();
  });

  it('keeps each book apart', async () => {
    const locks = new InProcessLockProvider();
    const held = await locks.acquire(BOOK, ['issuer']);
    const elsewhere = await locks.acquire('book-2', ['issuer']);
    expect(elsewhere.locks).toEqual([{ scope: 'issuer', mode: 'exclusive' }]);
    await held.release();
    await elsewhere.release();
  });

  it('shares a shared scope, and an exclusive request waits for every shared holder', async () => {
    const locks = new InProcessLockProvider();
    const reader = await locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }, 'class:A']);
    const otherReader = await locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }, 'class:B']);
    const book = track(locks.acquire(BOOK, ['issuer']));
    await flush();
    expect(book.granted()).toBe(false);

    await reader.release();
    await flush();
    expect(book.granted()).toBe(false);
    await otherReader.release();
    await flush();
    expect(book.granted()).toBe(true);
    await (await book.lease).release();
  });

  it('serves a scope in arrival order: a waiting exclusive request is not overtaken by later shared ones', async () => {
    const locks = new InProcessLockProvider();
    const order: string[] = [];
    const first = await locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }]);
    const exclusive = locks.acquire(BOOK, ['issuer']).then(async (lease) => {
      order.push('exclusive');
      await lease.release();
    });
    const shared = locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }]).then(async (lease) => {
      order.push('shared');
      await lease.release();
    });
    await flush();
    expect(order).toEqual([]);

    await first.release();
    await Promise.all([exclusive, shared]);
    expect(order).toEqual(['exclusive', 'shared']);
  });

  it('acquires in canonical order, so leases asking for the same scopes in opposite orders never deadlock', async () => {
    const locks = new InProcessLockProvider();
    const results = await Promise.all(
      Array.from({ length: 6 }, async (_unused, n) => {
        const lease = await locks.acquire(BOOK, n % 2 === 0 ? ['class:A', 'class:B'] : ['class:B', 'class:A']);
        await flush();
        await lease.release();
        return lease.locks.map((lock) => lock.scope);
      })
    );
    expect(results.every((scopes) => scopes.join() === 'class:A,class:B')).toBe(true);
  });

  it('gives up after its timeout holding nothing, and lets the next waiter through', async () => {
    const locks = new InProcessLockProvider();
    const holder = await locks.acquire(BOOK, ['class:B']);
    const timedOut = locks.acquire(BOOK, ['class:A', 'class:B'], { timeoutMs: 5 });
    await expect(timedOut).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.TIMEOUT,
      classification: 'writer_lock_timeout',
      retryable: true,
    });
    // class:A, taken before the wait, was released when the wait gave up.
    const classA = await locks.acquire(BOOK, ['class:A'], { timeoutMs: 5 });
    await classA.release();
    await holder.release();
  });

  it('stops waiting when the signal aborts', async () => {
    const locks = new InProcessLockProvider();
    const holder = await locks.acquire(BOOK, ['class:A']);
    const controller = new AbortController();
    const waiting = locks.acquire(BOOK, ['class:A'], { signal: controller.signal });
    controller.abort(new Error('shutting down'));
    const error: unknown = await waiting.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({ classification: 'writer_lock_aborted', cause: new Error('shutting down') });
    await expect(locks.acquire(BOOK, ['class:A'], { signal: controller.signal })).rejects.toMatchObject({
      classification: 'writer_lock_aborted',
    });
    await holder.release();
    const after = await locks.acquire(BOOK, ['class:A']);
    await after.release();
  });

  it('releases once, however often release is called', async () => {
    const locks = new InProcessLockProvider();
    const first = await locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }]);
    const second = await locks.acquire(BOOK, [{ scope: 'issuer', mode: 'shared' }]);
    await first.release();
    await first.release();
    const book = track(locks.acquire(BOOK, ['issuer']));
    await flush();
    expect(book.granted()).toBe(false);
    await second.release();
    await flush();
    expect(book.granted()).toBe(true);
    await (await book.lease).release();
  });

  it('refuses a malformed book key or timeout', async () => {
    const locks = new InProcessLockProvider();
    await expect(locks.acquire('', ['issuer'])).rejects.toThrow(OcpValidationError);
    await expect(locks.acquire(BOOK, ['issuer'], { timeoutMs: -1 })).rejects.toThrow(
      'Must be a non-negative number of milliseconds'
    );
  });
});
