import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import { contextKey } from '../../src/register/admissionRules';
import { recordSplit, splitOffenders } from '../../src/register/checks/splits';
import type { OcfStockClassSplit, OcfValuation } from '../../src/types/native';
import type { LockRequest, RecordSplitError, WriterLockProvider } from '../../src/types/register';
import { CONTEXT, stockAcceptance, stockClass, stockClassSplit, stockPlan } from './bookFixtures';
import { ceilingBook, classAdjustment, issue, option, optionExercise, poolAdjustment, usd } from './checkFixtures';
import { deferred, settle } from './fakeLedger';
import { split } from './registerFixtures';
import { damlData, recordEvent } from './registerLedgerFixtures';
import { anchoredIndex, choicesOf, epochEffects, splitEffects, writerHarness } from './writerFixtures';

const BOOK_KEY = contextKey(CONTEXT);
const SPLIT: OcfStockClassSplit = stockClassSplit('SPLIT-1', 'CLS-A', '2026-10-01');

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
      throw new Error('expected the split to fail');
    },
    (error: unknown) => error
  );
}

function valuation(id: string, effectiveDate: string): OcfValuation {
  return {
    object_type: 'VALUATION',
    id,
    stock_class_id: 'CLS-A',
    price_per_share: usd('2'),
    effective_date: effectiveDate,
    valuation_type: '409A',
  };
}

describe('recordSplit: the split procedure', () => {
  it('freezes the class, checks it, records the split and unfreezes it, under one lease on the book', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next(
      { outcome: 'commit', effects: epochEffects('CapTable_FreezeClass', 'CLS-A', 'epoch-CLS-A', 'epoch-frozen') },
      { outcome: 'commit', effects: splitEffects(SPLIT, 'epoch-frozen', 'epoch-split') },
      {
        outcome: 'commit',
        effects: epochEffects('CapTable_UnfreezeClass', 'CLS-A', 'epoch-split', 'epoch-open', [SPLIT]),
      }
    );
    const acquire = jest.spyOn(locks, 'acquire');

    const result = await recordSplit(writer, SPLIT);

    expect(choicesOf(ledger)).toEqual(['CapTable_FreezeClass', 'CapTable_Apply', 'CapTable_UnfreezeClass']);
    expect(result).toEqual({
      freeze: expect.objectContaining({ offset: 101, result: 'epoch-frozen' }),
      split: expect.objectContaining({ kind: 'apply', offset: 102, sources: [0] }),
      unfreeze: expect.objectContaining({ offset: 103, result: 'epoch-open' }),
    });
    expect(result.split?.result.epochs.get('CLS-A')).toBe('epoch-split');
    expect(writer.index.epochOf('CLS-A')?.epoch).toMatchObject({ frozen: false, splits: [{ split_id: 'SPLIT-1' }] });
    // The whole book and the class, held once from the freeze to the unfreeze.
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(acquire.mock.calls[0]?.[1]).toEqual([
      { scope: 'issuer', mode: 'exclusive' },
      { scope: 'class:CLS-A', mode: 'exclusive' },
    ]);
    await expect(lockFree(locks, ['issuer'])).resolves.toBe(true);
  });

  it('unfreezes the class and names the records when the check after the freeze finds any', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    const gate = deferred();
    ledger.next(
      {
        outcome: 'commit',
        effects: epochEffects('CapTable_FreezeClass', 'CLS-A', 'epoch-CLS-A', 'epoch-frozen'),
        gate: gate.promise,
      },
      { outcome: 'commit', effects: epochEffects('CapTable_UnfreezeClass', 'CLS-A', 'epoch-frozen', 'epoch-open') }
    );

    const splitting = failure(recordSplit(writer, SPLIT));
    await settle();
    // A writer outside this lock provider records an adjustment of the class dated after the split before the freeze.
    const adjustment = classAdjustment('ADJ-9', 'CLS-A', '200', '2026-10-15');
    ledger.commit({
      created: [
        recordEvent(
          'cid-ADJ-9',
          'stockClassAuthorizedSharesAdjustment',
          damlData('stockClassAuthorizedSharesAdjustment', { ...adjustment })
        ),
      ],
    });
    gate.resolve();
    const error = (await splitting) as RecordSplitError;

    expect(choicesOf(ledger)).toEqual(['CapTable_FreezeClass', 'CapTable_UnfreezeClass']);
    expect(error).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.OUT_OF_RANGE,
      classification: 'split_records_on_or_after',
      fieldPath: 'split',
    });
    expect(error.message).toContain(
      'Split SPLIT-1 of stock class CLS-A dated 2026-10-01 cannot be recorded: 1 record(s) in the class are dated on or ' +
        'after it: ADJ-9 (2026-10-15)'
    );
    expect(error.message).not.toContain('still frozen');
    expect(error.offenders).toEqual([
      {
        objectId: 'ADJ-9',
        objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        entityType: 'stockClassAuthorizedSharesAdjustment',
        date: '2026-10-15',
      },
    ]);
    expect(error.unfreeze).toMatchObject({ result: 'epoch-open' });
    expect(writer.index.epochOf('CLS-A')?.epoch.frozen).toBe(false);
    await expect(lockFree(locks, ['issuer'])).resolves.toBe(true);
  });

  it('refuses before freezing when the book already shows records on or after the split, or the split out of order', async () => {
    const book = ceilingBook({ authorized: 'UNLIMITED' }).record('stockIssuance', issue('S-N1', '5', '2026-10-01'));
    const { ledger, writer } = writerHarness(anchoredIndex(book));

    await expect(recordSplit(writer, SPLIT)).rejects.toMatchObject({
      classification: 'split_records_on_or_after',
      offenders: [expect.objectContaining({ objectId: 'ISS-S-N1', date: '2026-10-01' })],
      unfreeze: null,
    });

    const earlier = ceilingBook()
      .record('stockClassSplit', stockClassSplit('SPLIT-0', 'CLS-A', '2026-10-01'))
      .epoch('CLS-A', { splits: [split('SPLIT-0', '2026-10-01', '2', '1')] }, 'epoch-split');
    const ordered = writerHarness(anchoredIndex(earlier));
    ordered.writer.index.remove('epoch-CLS-A');
    await expect(recordSplit(ordered.writer, SPLIT)).rejects.toMatchObject({
      classification: 'split_order',
      message: expect.stringContaining("split SPLIT-1 must be dated after the class's latest recorded split"),
    });
    expect(ledger.submitted).toEqual([]);
    expect(ordered.ledger.submitted).toEqual([]);
  });

  it('unfreezes the class when the ledger refuses the split, and reports the refusal', async () => {
    const { ledger, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next(
      { outcome: 'commit', effects: epochEffects('CapTable_FreezeClass', 'CLS-A', 'epoch-CLS-A', 'epoch-frozen') },
      { outcome: 'reject', message: 'stock class CLS-A already has 64 splits' },
      { outcome: 'commit', effects: epochEffects('CapTable_UnfreezeClass', 'CLS-A', 'epoch-frozen', 'epoch-open') }
    );

    await expect(recordSplit(writer, SPLIT)).rejects.toMatchObject({
      code: OcpErrorCodes.CHOICE_FAILED,
      message: expect.stringContaining('already has 64 splits'),
    });
    expect(choicesOf(ledger)).toEqual(['CapTable_FreezeClass', 'CapTable_Apply', 'CapTable_UnfreezeClass']);
    expect(writer.index.epochOf('CLS-A')?.epoch.frozen).toBe(false);
  });

  it('takes over a class an earlier attempt left frozen, and finishes a split it recorded', async () => {
    const index = anchoredIndex(ceilingBook().epoch('CLS-A', { frozen: true }, 'epoch-frozen'));
    index.remove('epoch-CLS-A');
    const { ledger, writer } = writerHarness(index);
    ledger.next(
      { outcome: 'commit', effects: splitEffects(SPLIT, 'epoch-frozen', 'epoch-split') },
      {
        outcome: 'commit',
        effects: epochEffects('CapTable_UnfreezeClass', 'CLS-A', 'epoch-split', 'epoch-open', [SPLIT]),
      }
    );

    await expect(recordSplit(writer, SPLIT)).resolves.toMatchObject({
      freeze: null,
      split: expect.anything(),
      unfreeze: expect.anything(),
    });
    expect(choicesOf(ledger)).toEqual(['CapTable_Apply', 'CapTable_UnfreezeClass']);

    // Recorded and unfrozen: nothing is left to do.
    await expect(recordSplit(writer, SPLIT)).resolves.toEqual({ freeze: null, split: null, unfreeze: null });
    expect(ledger.submitted).toHaveLength(2);
  });

  it('keeps the class frozen and locked when the split’s outcome is unknown', async () => {
    const { ledger, locks, writer } = writerHarness(anchoredIndex(ceilingBook()));
    ledger.next(
      { outcome: 'commit', effects: epochEffects('CapTable_FreezeClass', 'CLS-A', 'epoch-CLS-A', 'epoch-frozen') },
      { outcome: 'unknown' }
    );

    await expect(recordSplit(writer, SPLIT)).rejects.toMatchObject({ code: OcpErrorCodes.OUTCOME_UNKNOWN });
    expect(choicesOf(ledger)).toEqual(['CapTable_FreezeClass', 'CapTable_Apply']);
    expect(writer.index.epochOf('CLS-A')?.epoch.frozen).toBe(true);
    await expect(lockFree(locks, ['class:CLS-A'])).resolves.toBe(false);
  });
});

describe('splitOffenders: what a split cannot be recorded before', () => {
  it('finds the class’s records, the events on its securities, its plans’ records and their equity compensation', () => {
    // A grant under a plan of the class that names no class itself.
    const { stock_class_id: _stockClassId, ...planGrant } = option('EC-1', '10', {
      stock_plan_id: 'P-1',
      date: '2026-01-01',
    });
    const index = ceilingBook()
      .record('stockClass', stockClass('CLS-B'))
      .epoch('CLS-B')
      .record('stockPlan', stockPlan('P-1', ['CLS-A']))
      .record('stockPlan', stockPlan('P-2', ['CLS-B']))
      // On or after the split, in the class:
      .record('stockIssuance', issue('S-N1', '5', '2026-10-01'))
      .record('stockAcceptance', stockAcceptance('ACC-1', 'S-A1', '2026-10-02'))
      .record('stockClassAuthorizedSharesAdjustment', classAdjustment('ADJ-1', 'CLS-A', '200', '2026-11-01'))
      .record('valuation', valuation('VAL-1', '2026-10-05'))
      .record('stockPlanPoolAdjustment', poolAdjustment('PADJ-1', 'P-1', '500', '2026-10-03'))
      .record('equityCompensationIssuance', planGrant)
      .record('equityCompensationExercise', optionExercise('EX-1', 'EC-1', '5', '2026-10-04'))
      // Before the split, or in another class:
      .record('stockIssuance', issue('S-N2', '5', '2026-09-30'))
      .record('stockIssuance', issue('S-B1', '5', '2026-10-10', { stock_class_id: 'CLS-B' }))
      .record('stockPlanPoolAdjustment', poolAdjustment('PADJ-2', 'P-2', '500', '2026-10-03'))
      .record('stockClassSplit', SPLIT)
      .index();

    expect(splitOffenders(index, SPLIT).map((offender) => [offender.objectId, offender.date])).toEqual([
      ['ISS-S-N1', '2026-10-01'],
      ['ACC-1', '2026-10-02'],
      ['PADJ-1', '2026-10-03'],
      ['EX-1', '2026-10-04'],
      ['VAL-1', '2026-10-05'],
      ['ADJ-1', '2026-11-01'],
    ]);
  });
});
