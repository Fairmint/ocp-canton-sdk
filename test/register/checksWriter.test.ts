import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import { buildApplyCommand } from '../../src/functions/OpenCapTable/capTable/apply';
import { contextKey } from '../../src/register/admissionRules';
import { writeViolations } from '../../src/register/checks/write';
import type { RegisterSessionSubmission } from '../../src/register/writer';
import type { ApplyOperation, LockRequest, RegisterCheckError, WriterLockProvider } from '../../src/types/register';
import { ANCHOR } from '../capTable/capTableFixtures';
import { CONTEXT, stakeholder } from './bookFixtures';
import { ceilingBook, CHECKS, issue } from './checkFixtures';
import { deferred, settle } from './fakeLedger';
import { damlData, recordEvent } from './registerLedgerFixtures';
import { anchoredIndex, issuanceEffects, TA, writerHarness } from './writerFixtures';

const BOOK_KEY = contextKey(CONTEXT);

function issuance(securityId: string, quantity: string): ApplyOperation {
  return { kind: 'record', type: 'stockIssuance', data: issue(securityId, quantity) };
}

async function lockFree(locks: WriterLockProvider, scopes: LockRequest[]): Promise<boolean> {
  try {
    const lease = await locks.acquire(BOOK_KEY, scopes, { timeoutMs: 5 });
    await lease.release();
    return true;
  } catch (error) {
    if (error instanceof OcpContractError && error.classification === 'writer_lock_timeout') return false;
    throw error;
  }
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the write to fail');
    },
    (error: unknown) => error
  );
}

describe('RegisterWriter: the off-ledger checks', () => {
  it('lets only one of two 10-share issuances against 90 of 100 authorized shares through, under the class lock', async () => {
    const index = anchoredIndex(ceilingBook());
    // Each alone passes against the book as it stands: without the lock both would commit, and the class hold 110.
    expect(writeViolations(index, { kind: 'apply', operations: [issuance('S-N1', '10')] }, CHECKS)).toEqual([]);
    expect(writeViolations(index, { kind: 'apply', operations: [issuance('S-N2', '10')] }, CHECKS)).toEqual([]);

    const { ledger, writer } = writerHarness(index);
    const gate = deferred();
    ledger.next({ outcome: 'commit', effects: issuanceEffects(issue('S-N1', '10')), gate: gate.promise });

    const first = writer.apply([issuance('S-N1', '10')]);
    const second = writer.apply([issuance('S-N2', '10')]);
    await settle();
    // The second waits for the class while the first is in flight.
    expect(ledger.submitted).toHaveLength(1);

    gate.resolve();
    await expect(first).resolves.toMatchObject({ batches: [expect.objectContaining({ offset: 101 })] });
    const error = (await failure(second)) as RegisterCheckError;
    expect(error).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.OUT_OF_RANGE,
      classification: 'class_ceiling',
      fieldPath: 'operations[0]',
    });
    expect(error.message).toContain('Stock class CLS-A would have 110 shares outstanding on 2026-10-23');
    expect(error.violations).toEqual([expect.objectContaining({ rule: 'class_ceiling', recordIds: ['ISS-S-N2'] })]);
    expect(ledger.submitted).toHaveLength(1);
    expect(writer.index.stateOf('S-N1')).not.toBeNull();
  });

  it('runs the checks on every Apply by default, and only as selected', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next(
      { outcome: 'commit', effects: issuanceEffects(issue('S-N1', '11')) },
      { outcome: 'commit', effects: issuanceEffects(issue('S-N2', '11')) }
    );

    await expect(writer.apply([issuance('S-N1', '11')])).rejects.toMatchObject({ classification: 'class_ceiling' });
    expect(ledger.submitted).toEqual([]);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);

    await expect(writer.apply([issuance('S-N1', '11')], { checks: { ceilings: false } })).resolves.toMatchObject({
      batches: [expect.objectContaining({ kind: 'apply' })],
    });
    await expect(writer.apply([issuance('S-N2', '11')], { checks: false })).resolves.toMatchObject({
      batches: [expect.objectContaining({ kind: 'apply' })],
    });
    expect(ledger.submitted).toHaveLength(2);
  });

  it('dates the checks by the writer clock’s UTC date', async () => {
    const { ledger, writer } = writerHarness(anchoredIndex(ceilingBook({ authorized: 'UNLIMITED' })));
    const tomorrow: ApplyOperation = { kind: 'record', type: 'stockIssuance', data: issue('S-N1', '1', '2026-10-24') };

    await expect(writer.apply([tomorrow])).rejects.toMatchObject({
      classification: 'future_dated',
      message: expect.stringContaining('after the ledger date 2026-10-23'),
    });
    expect(ledger.submitted).toEqual([]);
  });

  it('refuses a restatement that would orphan a reference before it reaches the ledger', async () => {
    const { ledger, writer } = writerHarness(anchoredIndex(ceilingBook()));

    const error = (await failure(writer.restate([{ kind: 'delete', objectId: 'SH-A' }]))) as RegisterCheckError;

    expect(error).toMatchObject({ classification: 'orphaned_reference', code: OcpErrorCodes.CONTRACT_NOT_FOUND });
    expect(error.violations?.map((violation) => violation.rule)).toEqual(['orphaned_reference', 'stakeholder_holds']);
    expect(error.message).toContain('(and 1 more)');
    expect(ledger.submitted).toEqual([]);
  });
});

describe('RegisterWriter: sessions', () => {
  function stakeholderWrite(id: string, scopes: LockRequest[]): RegisterSessionSubmission<string> {
    return {
      scopes,
      build: (index) => ({
        command: buildApplyCommand({ capTableContractId: ANCHOR, transferAgent: TA, index }, [
          { kind: 'record', type: 'stakeholder', data: stakeholder(id) },
        ]),
        markers: { createdObjects: [id] },
      }),
      decode: (response) => response.transaction.updateId,
    };
  }

  function created(id: string) {
    return { created: [recordEvent(`cid-${id}`, 'stakeholder', damlData('stakeholder', { ...stakeholder(id) }))] };
  }

  it('holds one lease across its writes, and releases it when the procedure ends', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next({ outcome: 'commit', effects: created('SH-X') }, { outcome: 'commit', effects: created('SH-Y') });
    const acquire = jest.spyOn(locks, 'acquire');
    let between: boolean | undefined;

    const results = await writer.session(['class:CLS-A'], async (session) => {
      const first = await session.submit(stakeholderWrite('SH-X', ['class:CLS-A']));
      between = await lockFree(locks, ['class:CLS-A']);
      const second = await session.submit(stakeholderWrite('SH-Y', []));
      return [first.result, second.result];
    });

    expect(results).toEqual(['update-101', 'update-102']);
    expect(between).toBe(false);
    // One lease for the session, and the probes.
    expect(acquire.mock.calls.filter(([, scopes]) => JSON.stringify(scopes).includes('shared'))).toHaveLength(1);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
    expect(writer.index.record('SH-Y')).not.toBeNull();
  });

  it('refuses a write outside its scopes, and any use once it has ended', async () => {
    const { ledger, writer } = writerHarness(anchoredIndex(ceilingBook()));
    let kept: Parameters<Parameters<typeof writer.session>[1]>[0] | undefined;

    await writer.session(['class:CLS-A'], async (session) => {
      kept = session;
      await expect(session.submit(stakeholderWrite('SH-X', ['class:CLS-B']))).rejects.toMatchObject({
        classification: 'writer_scope_not_held',
      });
    });

    await expect(kept?.submit(stakeholderWrite('SH-X', ['class:CLS-A']))).rejects.toMatchObject({
      classification: 'writer_session_ended',
    });
    await expect(kept?.apply([issuance('S-N1', '1')])).rejects.toMatchObject({
      classification: 'writer_session_ended',
    });
    await expect(kept?.refresh()).rejects.toMatchObject({ classification: 'writer_session_ended' });
    expect(ledger.submitted).toEqual([]);
  });

  it('keeps its lease past the end while a write’s outcome is unknown, until it is reconciled', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next({ outcome: 'unknown' });

    const error = await failure(
      writer.session(['class:CLS-A'], async (session) => {
        await failure(session.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));
        await session.submit(stakeholderWrite('SH-Y', ['class:CLS-A']));
      })
    );

    expect(error).toMatchObject({ code: OcpErrorCodes.OUTCOME_UNKNOWN, classification: 'poisoned_scope' });
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(false);
    const [unresolved] = writer.unresolved();
    expect(unresolved?.locks).toEqual([
      { scope: 'issuer', mode: 'shared' },
      { scope: 'class:CLS-A', mode: 'exclusive' },
    ]);
    await writer.reconcile(unresolved?.commandId ?? '', { assume: 'absent' });
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
    expect(ledger.submitted).toHaveLength(1);
  });
});
