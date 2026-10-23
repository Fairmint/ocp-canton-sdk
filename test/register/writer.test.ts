import { OcpContractError, OcpErrorCodes, OcpNetworkError, OcpParseError, OcpValidationError } from '../../src/errors';
import { buildApplyCommand } from '../../src/functions/OpenCapTable/capTable/apply';
import { contextKey } from '../../src/register/admissionRules';
import { resolveInputs } from '../../src/register/inputs';
import { InProcessLockProvider } from '../../src/register/locks';
import type { RegisterIndex } from '../../src/register/registerIndex';
import {
  registerCommandId,
  RegisterWriter,
  type RegisterSubmission,
  type RegisterWriterOptions,
} from '../../src/register/writer';
import type {
  ApplyOperation,
  LockRequest,
  RegisterContext,
  RegisterWriteError,
  WriterLockProvider,
} from '../../src/types/register';
import { ANCHOR, ANCHOR_TEMPLATE_ID, anchorExercise } from '../capTable/capTableFixtures';
import { baseBook, CONTEXT, stakeholder, stockClass } from './bookFixtures';
import { deferred, FakeLedger, settle, steppingClock, type LedgerEffects } from './fakeLedger';
import { damlData, recordEvent } from './registerLedgerFixtures';

const TA = CONTEXT.transfer_agent;
const BOOK_KEY = contextKey(CONTEXT);

/** The base book with its anchor and a second class. */
function bookIndex(): RegisterIndex {
  const index = baseBook().record('stockClass', stockClass('CLS-B')).epoch('CLS-B').index();
  index.add({
    kind: 'anchor',
    context: CONTEXT,
    contract: { contractId: ANCHOR, templateId: ANCHOR_TEMPLATE_ID, createdOffset: 1, status: 'ACTIVE' },
  });
  return index;
}

interface Harness {
  ledger: FakeLedger;
  locks: InProcessLockProvider;
  writer: RegisterWriter;
}

function harness(options: Partial<RegisterWriterOptions> = {}): Harness {
  const ledger = new FakeLedger();
  const locks = new InProcessLockProvider();
  const writer = new RegisterWriter({
    ledger: ledger.asClient(),
    context: CONTEXT,
    transferAgent: TA,
    index: bookIndex(),
    locks,
    clock: steppingClock(),
    outcome: { timeoutMs: 5_000, pollMs: 1_000 },
    lockTimeoutMs: 5_000,
    ...options,
  });
  return { ledger, locks, writer };
}

/** The created event of a stakeholder record the ledger wrote. */
function stakeholderCreated(id: string): Record<string, unknown> {
  return recordEvent(`cid-${id}`, 'stakeholder', damlData('stakeholder', { ...stakeholder(id) }));
}

function createdStakeholder(id: string): LedgerEffects {
  return { created: [stakeholderCreated(id)] };
}

/** A write of one new stakeholder under the given scopes, decoding to its update ID. */
function stakeholderWrite(id: string, scopes: RegisterSubmission<string>['scopes']): RegisterSubmission<string> {
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

describe('RegisterWriter: scoped locks', () => {
  it('serializes two writes on one class', async () => {
    const { ledger, writer } = harness();
    const gate = deferred();
    ledger.next(
      { outcome: 'commit', effects: createdStakeholder('SH-X'), gate: gate.promise },
      { outcome: 'commit', effects: createdStakeholder('SH-Y') }
    );

    const first = writer.submit(stakeholderWrite('SH-X', ['class:CLS-A']));
    const second = writer.submit(stakeholderWrite('SH-Y', ['class:CLS-A']));
    await settle();
    expect(ledger.submitted).toHaveLength(1);

    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ result: 'update-101' }),
      expect.objectContaining({ result: 'update-102' }),
    ]);
    expect(ledger.maxInFlight).toBe(1);
    expect(writer.index.record('SH-X')).not.toBeNull();
    expect(writer.index.record('SH-Y')).not.toBeNull();
    expect(writer.index.offset).toBe(102);
  });

  it('runs writes on two classes in parallel', async () => {
    const { ledger, writer } = harness();
    const gates = [deferred(), deferred()];
    ledger.next(
      { outcome: 'commit', effects: createdStakeholder('SH-X'), gate: gates[0]?.promise },
      { outcome: 'commit', effects: createdStakeholder('SH-Y'), gate: gates[1]?.promise }
    );

    const writes = Promise.all([
      writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])),
      writer.submit(stakeholderWrite('SH-Y', ['class:CLS-B'])),
    ]);
    await settle();
    expect(ledger.submitted).toHaveLength(2);
    expect(ledger.maxInFlight).toBe(2);

    // The second commit lands first; the index still applies both, in ledger order.
    gates[1]?.resolve();
    await settle();
    gates[0]?.resolve();
    await writes;
    expect(writer.index.record('SH-X')).not.toBeNull();
    expect(writer.index.record('SH-Y')).not.toBeNull();
  });

  it('submits as the transfer agent with a deterministic command ID', async () => {
    const { ledger, writer } = harness();
    const write = stakeholderWrite('SH-X', ['class:CLS-A']);
    const expected = registerCommandId(CONTEXT, (write.build(writer.index) as { command: never }).command);
    expect(expected).toMatch(/^ocp-CapTable_Apply-[0-9a-f]{64}$/);

    const committed = await writer.submit(write);

    expect(committed).toEqual({ commandId: expected, updateId: 'update-101', offset: 101, result: 'update-101' });
    expect(ledger.submitted[0]).toMatchObject({ commandId: expected, actAs: [TA] });
  });

  it('brings the index current before the check, and re-locks when the current index moves the scopes', async () => {
    const { ledger, locks, writer } = harness();
    ledger.commit(createdStakeholder('SH-E'));
    const acquire = jest.spyOn(locks, 'acquire');
    const check = jest.fn((index: RegisterIndex) => {
      expect(index.record('SH-E')).not.toBeNull();
    });

    await writer.submit({
      ...stakeholderWrite('SH-X', []),
      scopes: (index) => (index.record('SH-E') === null ? ['class:CLS-A'] : ['class:CLS-B']),
      check,
    });

    expect(check).toHaveBeenCalledTimes(1);
    expect(acquire.mock.calls.map(([, scopes]) => scopes)).toEqual([
      [
        { scope: 'issuer', mode: 'shared' },
        { scope: 'class:CLS-A', mode: 'exclusive' },
      ],
      [
        { scope: 'issuer', mode: 'shared' },
        { scope: 'class:CLS-A', mode: 'exclusive' },
        { scope: 'class:CLS-B', mode: 'exclusive' },
      ],
    ]);
    await expect(lockFree(locks, ['class:CLS-A', 'class:CLS-B'])).resolves.toBe(true);
  });

  it('releases the scopes when the check or the build refuses the write', async () => {
    const { ledger, locks, writer } = harness();
    await expect(
      writer.submit({
        ...stakeholderWrite('SH-X', ['class:CLS-A']),
        check: () => {
          throw new OcpValidationError('quantity', 'Outstanding shares would exceed authorized shares');
        },
      })
    ).rejects.toThrow('Outstanding shares would exceed authorized shares');
    await expect(
      writer.submit({
        ...stakeholderWrite('SH-A', ['class:CLS-A']),
        build: (index) =>
          buildApplyCommand({ capTableContractId: ANCHOR, transferAgent: TA, index }, [
            { kind: 'record', type: 'stakeholder', data: stakeholder('SH-A') },
          ]),
      })
    ).rejects.toThrow('ID already used');
    await expect(
      writer.submit({
        ...stakeholderWrite('SH-Y', ['class:CLS-A']),
        build: (index) => ({
          ...buildApplyCommand({ capTableContractId: ANCHOR, transferAgent: TA, index }, [
            { kind: 'record', type: 'stakeholder', data: stakeholder('SH-Y') },
          ]),
          actAs: [CONTEXT.system_operator],
        }),
      })
    ).rejects.toThrow("The writer submits only the transfer agent's commands");
    expect(ledger.submitted).toHaveLength(0);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });
});

describe('RegisterWriter: command outcomes', () => {
  it('applies the transaction of a command whose response was lost when its completion shows success', async () => {
    const { ledger, writer } = harness();
    ledger.next({ outcome: 'lose', effects: createdStakeholder('SH-X') });

    const committed = await writer.submit(stakeholderWrite('SH-X', ['class:CLS-A']));

    expect(committed).toMatchObject({ updateId: 'update-101', offset: 101, result: 'update-101' });
    expect(ledger.getUpdateById).toHaveBeenCalledWith({ updateId: 'update-101', readAs: [TA] });
    expect(ledger.completions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'ledger-api-user', parties: [TA], beginExclusive: 100 })
    );
    expect(writer.index.record('SH-X')).toMatchObject({ contractId: 'cid-SH-X' });
    expect(writer.unresolved()).toEqual([]);
  });

  it('keeps polling through failed completion and update reads', async () => {
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const { ledger, writer } = harness({ logger });
    ledger.next({ outcome: 'lose', effects: createdStakeholder('SH-X') });
    ledger.failCompletionReads = 1;
    ledger.failUpdateReads = 1;

    await expect(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A']))).resolves.toMatchObject({
      updateId: 'update-101',
    });
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('releases the scopes on a definite rejection, with the rejection as the error', async () => {
    const { ledger, locks, writer } = harness();
    ledger.next({ outcome: 'reject', message: 'ID already used: SH-X' });

    const error = await failure(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));

    expect(error).toMatchObject({
      code: OcpErrorCodes.CHOICE_FAILED,
      classification: 'definite_rejection',
      retryable: false,
    });
    expect((error as Error).message).toContain('ID already used: SH-X');
    expect(ledger.completions).not.toHaveBeenCalled();
    expect(writer.unresolved()).toEqual([]);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });

  it('releases the scopes when a lost response completes as rejected, or the request never left', async () => {
    const { ledger, locks, writer } = harness();
    ledger.next(
      { outcome: 'lose-rejected', message: 'contract not active: shard-00000000' },
      { outcome: 'never-sent' }
    );

    await expect(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A']))).rejects.toMatchObject({
      code: OcpErrorCodes.CHOICE_FAILED,
      classification: 'definite_rejection',
      message: expect.stringContaining('was rejected: contract not active: shard-00000000'),
    });
    await expect(writer.submit(stakeholderWrite('SH-Y', ['class:CLS-A']))).rejects.toMatchObject({
      name: 'AuthenticationError',
    });
    expect(ledger.completions).toHaveBeenCalledTimes(1);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });

  it('holds the scopes across an unknown outcome and releases them once it is reconciled', async () => {
    const { ledger, locks, writer } = harness();
    ledger.next({ outcome: 'unknown' });

    const error = await failure(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));

    const [unresolved] = writer.unresolved();
    expect(unresolved).toMatchObject({
      choice: 'CapTable_Apply',
      locks: [
        { scope: 'issuer', mode: 'shared' },
        { scope: 'class:CLS-A', mode: 'exclusive' },
      ],
      beginExclusive: 100,
      markers: { createdObjects: ['SH-X'], deletedObjects: [], consumedContracts: [] },
      causeMessage: expect.stringContaining('HTTP 504'),
    });
    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUTCOME_UNKNOWN,
      classification: 'unresolved_command',
      retryable: false,
      message: expect.stringContaining(unresolved?.commandId ?? 'missing'),
    });
    // Polled for the whole outcome timeout: one read at once, then one per poll interval.
    expect(ledger.completions.mock.calls.length).toBeGreaterThanOrEqual(5);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(false);
    await expect(lockFree(locks, [{ scope: 'issuer', mode: 'shared' }, 'class:CLS-B'])).resolves.toBe(true);

    const result = await writer.reconcile(unresolved?.commandId ?? '');

    expect(result).toEqual({
      commandId: unresolved?.commandId,
      outcome: 'absent',
      evidence: 'index',
      updateId: null,
      status: null,
    });
    expect(writer.unresolved()).toEqual([]);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });

  it('refuses writes on poisoned scopes until the command is reconciled, and lets other scopes through', async () => {
    const { ledger, writer } = harness();
    ledger.next({ outcome: 'unknown' });
    await failure(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));
    const commandId = writer.unresolved()[0]?.commandId ?? '';

    for (const scopes of [['class:CLS-A'], ['issuer']] satisfies LockRequest[][]) {
      await expect(writer.submit(stakeholderWrite('SH-Y', scopes))).rejects.toMatchObject({
        code: OcpErrorCodes.OUTCOME_UNKNOWN,
        classification: 'poisoned_scope',
        context: expect.objectContaining({ commandId }),
      });
    }
    await expect(writer.submit(stakeholderWrite('SH-W', ['class:CLS-B']))).resolves.toMatchObject({
      result: 'update-101',
    });

    // The command did commit, late: its completion shows it.
    ledger.commit(createdStakeholder('SH-X'), commandId);
    await expect(writer.reconcile(commandId)).resolves.toEqual({
      commandId,
      outcome: 'committed',
      evidence: 'completion',
      updateId: 'update-102',
      status: null,
    });
    expect(writer.index.record('SH-X')).not.toBeNull();
    await expect(writer.submit(stakeholderWrite('SH-Y', ['class:CLS-A']))).resolves.toMatchObject({
      result: 'update-103',
    });
  });

  it('reconciles from the book when no completion shows, and as told when nothing decides', async () => {
    const { ledger, writer } = harness();
    ledger.next({ outcome: 'unknown' }, { outcome: 'unknown' }, { outcome: 'unknown' });
    await failure(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));
    await failure(writer.submit(stakeholderWrite('SH-Y', ['class:CLS-B'])));
    await failure(writer.submit(stakeholderWrite('SH-Z', ['plan:PLAN-1'])));
    const [first, second] = writer.unresolved().map((command) => command.commandId);

    // Committed with no completion left to read (another writer's record of the same ID would look the same).
    ledger.commit(createdStakeholder('SH-X'));
    await expect(writer.reconcile(first ?? '')).resolves.toMatchObject({ outcome: 'committed', evidence: 'index' });
    await expect(writer.reconcile(second ?? '', { assume: 'committed' })).resolves.toMatchObject({
      outcome: 'committed',
      evidence: 'assumed',
    });
    await expect(writer.reconcile('no-such-command')).rejects.toThrow(OcpValidationError);
    await expect(
      writer.reconcile(writer.unresolved()[0]?.commandId ?? '', { assume: 'maybe' as never })
    ).rejects.toThrow('Must be committed or absent');
  });

  it('keeps a command unresolved when neither its completion nor the book decides', async () => {
    const { ledger, locks, writer } = harness();
    ledger.next({ outcome: 'unknown' });
    await failure(
      writer.submit({
        scopes: ['class:CLS-A'],
        build: (index) =>
          buildApplyCommand({ capTableContractId: ANCHOR, transferAgent: TA, index }, [
            { kind: 'preSplitShard', prefix: '00000000' },
          ]),
        decode: () => null,
      })
    );
    const commandId = writer.unresolved()[0]?.commandId ?? '';

    await expect(writer.reconcile(commandId)).rejects.toMatchObject({
      code: OcpErrorCodes.OUTCOME_UNKNOWN,
      classification: 'unresolved_command',
    });
    expect(writer.unresolved()).toHaveLength(1);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(false);
    await expect(writer.reconcile(commandId, { assume: 'absent' })).resolves.toMatchObject({ outcome: 'absent' });
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });

  it('releases a committed command whose transaction cannot be read, saying it committed', async () => {
    const { ledger, locks, writer } = harness();
    ledger.next({ outcome: 'lose', effects: createdStakeholder('SH-X') });
    ledger.failUpdateReads = 100;

    const error = await failure(writer.submit(stakeholderWrite('SH-X', ['class:CLS-A'])));

    expect(error).toBeInstanceOf(OcpNetworkError);
    expect(error).toMatchObject({ classification: 'committed_result_unread' });
    expect((error as Error).message).toContain('committed as update update-101');
    expect(writer.unresolved()).toEqual([]);
    expect(writer.index.record('SH-X')).not.toBeNull();
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(true);
  });
});

describe('RegisterWriter: apply and restate', () => {
  function applyEffects(id: string): LedgerEffects {
    return {
      created: [stakeholderCreated(id)],
      exercised: [
        anchorExercise('CapTable_Apply', {
          records: [[id, { tag: 'OcfRecordCidStakeholder', value: `cid-${id}` }]],
          states: [],
          epochs: [],
          shards: [],
        }).ExercisedEvent as Record<string, unknown>,
      ],
    };
  }

  function stakeholders(...ids: string[]): ApplyOperation[] {
    return ids.map((id) => ({ kind: 'record', type: 'stakeholder', data: stakeholder(id) }));
  }

  /** A byte budget that fits one stakeholder record per transaction, not two. */
  function oneRecordBudget(index: RegisterIndex): number {
    const one = resolveInputs(index, { kind: 'apply', operations: stakeholders('SH-X') }).usage.bytes;
    const two = resolveInputs(index, { kind: 'apply', operations: stakeholders('SH-X', 'SH-Y') }).usage.bytes;
    return Math.floor((one + two) / 2);
  }

  it('submits each planned transaction on its own, resolving its inputs from the index as the last one left it', async () => {
    const index = bookIndex();
    const { ledger, writer } = harness({ index, sizing: { byteBudget: oneRecordBudget(index) } });
    ledger.next(
      { outcome: 'commit', effects: applyEffects('SH-X') },
      { outcome: 'commit', effects: applyEffects('SH-Y') }
    );

    const summary = await writer.apply(stakeholders('SH-X', 'SH-Y'));

    expect(summary.batches).toEqual([
      expect.objectContaining({ kind: 'apply', sources: [0], updateId: 'update-101', offset: 101 }),
      expect.objectContaining({ kind: 'apply', sources: [1], updateId: 'update-102', offset: 102 }),
    ]);
    expect(summary.batches[0]?.result.records.get('SH-X')).toEqual({
      entityType: 'stakeholder',
      contractId: 'cid-SH-X',
    });
    const [first, second] = ledger.submitted;
    expect(first?.commandId).not.toEqual(second?.commandId);
    expect(first?.commandId).toMatch(/^ocp-CapTable_Apply-/);
    expect(writer.index.record('SH-Y')).not.toBeNull();
  });

  it('refuses an operation that fits in no transaction before it submits anything', async () => {
    const { ledger, writer } = harness({ sizing: { byteBudget: 10 } });
    await expect(writer.apply(stakeholders('SH-X'))).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.OUT_OF_RANGE,
      message: expect.stringContaining('fits in no transaction'),
    });
    expect(ledger.submitted).toEqual([]);
  });

  it('names the transactions committed before a failing one on its error', async () => {
    const index = bookIndex();
    const { ledger, writer } = harness({ index, sizing: { byteBudget: oneRecordBudget(index) } });
    ledger.next(
      { outcome: 'commit', effects: applyEffects('SH-X') },
      { outcome: 'reject', message: 'ID already used' }
    );
    const check = jest.fn();

    const error = (await failure(writer.apply(stakeholders('SH-X', 'SH-Y'), { check }))) as RegisterWriteError;

    expect(error).toMatchObject({ code: OcpErrorCodes.CHOICE_FAILED });
    expect(error.committed).toEqual([expect.objectContaining({ kind: 'apply', sources: [0] })]);
    expect(check.mock.calls.map(([, write]) => write)).toEqual([
      { kind: 'apply', operations: stakeholders('SH-X') },
      { kind: 'apply', operations: stakeholders('SH-Y') },
    ]);
  });

  it('writes one restatement under the scopes of what it touches', async () => {
    const { ledger, locks, writer } = harness();
    const acquire = jest.spyOn(locks, 'acquire');
    ledger.next({
      outcome: 'commit',
      effects: {
        created: [stakeholderCreated('SH-B')],
        archived: ['cid-SH-B'],
        exercised: [
          anchorExercise('CapTable_Restate', {
            records: [['SH-B', { tag: 'OcfRecordCidStakeholder', value: 'cid-SH-B' }]],
            states: [],
            epochs: [],
            shards: [],
          }).ExercisedEvent as Record<string, unknown>,
        ],
      },
    });

    const summary = await writer.restate([{ kind: 'edit', type: 'stakeholder', data: stakeholder('SH-B') }]);

    expect(summary.batches).toEqual([expect.objectContaining({ kind: 'restate', sources: [0] })]);
    expect(acquire.mock.calls[0]?.[1]).toEqual([{ scope: 'issuer', mode: 'shared' }]);
    expect(writer.unresolved()).toEqual([]);
  });

  it('settles an unknown restatement from the records it edits and deletes', async () => {
    const { ledger, writer } = harness();
    ledger.next({ outcome: 'unknown' }, { outcome: 'unknown' });

    await failure(writer.restate([{ kind: 'edit', type: 'stakeholder', data: stakeholder('SH-B') }]));
    const [edit] = writer.unresolved();
    expect(edit?.markers).toEqual({ createdObjects: [], deletedObjects: [], consumedContracts: ['cid-SH-B'] });
    // A delete locks the whole book, which the unresolved edit holds shared.
    await expect(writer.restate([{ kind: 'delete', objectId: 'SH-B' }])).rejects.toMatchObject({
      classification: 'poisoned_scope',
    });

    // The edit committed: the record's old contract is archived.
    const edited = recordEvent('cid-SH-B-2', 'stakeholder', damlData('stakeholder', { ...stakeholder('SH-B') }));
    ledger.commit({ created: [edited], archived: ['cid-SH-B'] });
    await expect(writer.reconcile(edit?.commandId ?? '')).resolves.toMatchObject({
      outcome: 'committed',
      evidence: 'index',
    });

    await failure(writer.restate([{ kind: 'delete', objectId: 'SH-B' }]));
    const [deletion] = writer.unresolved();
    expect(deletion?.markers).toEqual({ createdObjects: [], deletedObjects: ['SH-B'], consumedContracts: [] });
    await expect(writer.reconcile(deletion?.commandId ?? '')).resolves.toMatchObject({ outcome: 'absent' });
  });

  it('refuses a restatement over a cap, and a book whose index has no anchor', async () => {
    const { writer } = harness({ sizing: { byteBudget: 10 } });
    await expect(writer.restate([{ kind: 'edit', type: 'stakeholder', data: stakeholder('SH-B') }])).rejects.toThrow(
      'The transaction exceeds its caps'
    );
    const anchorless = harness({ index: baseBook().index() });
    await expect(anchorless.writer.apply(stakeholders('SH-X'))).rejects.toMatchObject({
      classification: 'register_anchor_not_found',
    });
  });
});

describe('RegisterWriter: the index and its construction', () => {
  it('reads the update stream page by page from the index offset', async () => {
    const { ledger, writer } = harness({ pageSize: 2 });
    for (const id of ['SH-1', 'SH-2', 'SH-3', 'SH-4', 'SH-5']) ledger.commit(createdStakeholder(id));

    await expect(writer.refresh()).resolves.toBe(105);

    expect(writer.index.record('SH-5')).not.toBeNull();
    expect(ledger.makePostRequest.mock.calls.map(([url, body]) => [url, body.beginExclusive])).toEqual([
      ['http://ledger.test/v2/updates?limit=2', 1],
      ['http://ledger.test/v2/updates?limit=2', 102],
      ['http://ledger.test/v2/updates?limit=2', 104],
    ]);
    expect(ledger.makePostRequest.mock.calls[0]?.[1]).toMatchObject({
      endInclusive: 105,
      updateFormat: { includeTransactions: { transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA' } },
    });
    expect(ledger.makePostRequest.mock.calls[0]?.[3]).toEqual({ requestSemantics: 'read' });
  });

  it('refuses an update stream that does not advance or is not a list', async () => {
    const { ledger, writer } = harness();
    ledger.offset = 120;
    ledger.makePostRequest.mockResolvedValueOnce([{ update: { OffsetCheckpoint: { value: { offset: 1 } } } }] as never);
    await expect(writer.refresh()).rejects.toThrow(OcpParseError);
    ledger.makePostRequest.mockResolvedValueOnce({ updates: [] } as never);
    await expect(writer.refresh()).rejects.toThrow('Updates response is not a list');
    ledger.makePostRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    await expect(writer.refresh()).rejects.toMatchObject({
      name: 'OcpNetworkError',
      classification: 'updates_read_failed',
    });
  });

  it('refuses an index of another book, a transfer agent not the book’s, and a client with no ledger user', () => {
    const ledger = new FakeLedger();
    const other: RegisterContext = { ...CONTEXT, cap_table_id: 'test-2' };
    expect(
      () =>
        new RegisterWriter({
          ledger: ledger.asClient(),
          context: other,
          transferAgent: other.transfer_agent,
          index: bookIndex(),
        })
    ).toThrow('The index is not the book of cap table test-2');
    expect(
      () =>
        new RegisterWriter({
          ledger: ledger.asClient(),
          context: CONTEXT,
          transferAgent: CONTEXT.issuer,
          index: bookIndex(),
        })
    ).toThrow("The writer submits as the book's transfer agent");
    const noUser = Object.assign(new FakeLedger(), { getUserId: () => undefined });
    expect(
      () => new RegisterWriter({ ledger: noUser.asClient(), context: CONTEXT, transferAgent: TA, index: bookIndex() })
    ).toThrow('completions as the ledger user');
    expect(
      () =>
        new RegisterWriter({
          ledger: ledger.asClient(),
          context: CONTEXT,
          transferAgent: TA,
          index: bookIndex(),
          outcome: { pollMs: 0 },
        })
    ).toThrow('Must be a positive number');
  });

  it('shares the process lock provider between writers given none', async () => {
    const ledger = new FakeLedger();
    const gate = deferred();
    ledger.next({ outcome: 'commit', effects: createdStakeholder('SH-X'), gate: gate.promise });
    const options = { ledger: ledger.asClient(), context: CONTEXT, transferAgent: TA, clock: steppingClock() };
    const first = new RegisterWriter({ ...options, index: bookIndex() });
    const second = new RegisterWriter({ ...options, index: bookIndex() });

    const writes = Promise.all([
      first.submit(stakeholderWrite('SH-X', ['class:CLS-A'])),
      second.submit(stakeholderWrite('SH-Y', ['class:CLS-A'])),
    ]);
    await settle();
    expect(ledger.submitted).toHaveLength(1);
    gate.resolve();
    await writes;
    expect(ledger.maxInFlight).toBe(1);
  });
});
