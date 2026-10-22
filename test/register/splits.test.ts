import fc from 'fast-check';

import { OcpValidationError } from '../../src/errors';
import {
  applySplits,
  findHold,
  floorMulDiv,
  fromUnits,
  isCurrentHold,
  isStopped,
  isVoidedHold,
  scaleQuantityAcross,
  scaleTranches,
  settlementHolds,
  splitsDatedIn,
  splitsOnOrBefore,
  stopHolds,
  toUnits,
  unitsEpochOf,
  vestedBy,
} from '../../src/register';
import type { Vesting } from '../../src/types/native';
import type { OpenHold, RegisterResult, StockSecurityState } from '../../src/types/register';
import { split, stockState } from './registerFixtures';

const SPLIT_DAY = '2025-01-10';

function applied(result: RegisterResult<StockSecurityState>): StockSecurityState {
  if (!result.ok) throw new Error(`expected the splits to apply: ${result.message}`);
  return result.value;
}

function settlementHold(overrides: Partial<OpenHold> = {}): OpenHold {
  return {
    hold_id: 'HOLD-1',
    hold_type: 'REGISTER_SETTLEMENT',
    reference: 'T-1',
    split_epoch: 0,
    quantity: '100',
    ...overrides,
  };
}

describe('split epochs', () => {
  const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1'), split('SPLIT-2', '2025-02-01', '3', '1')];

  test('counts the splits dated on or before a date', () => {
    expect(splitsOnOrBefore(splits, '2025-01-09')).toBe(0);
    expect(splitsOnOrBefore(splits, SPLIT_DAY)).toBe(1);
    expect(splitsOnOrBefore(splits, '2025-01-31')).toBe(1);
    expect(splitsOnOrBefore(splits, '2025-02-01')).toBe(2);
    expect(splitsOnOrBefore([], '2025-02-01')).toBe(0);
  });

  test('the units rule: a split dated D applies to records dated before D, not to records dated D', () => {
    expect(unitsEpochOf('2025-01-09', splits)).toBe(0);
    expect(unitsEpochOf(SPLIT_DAY, splits)).toBe(1);
    expect(unitsEpochOf('2025-02-01', splits)).toBe(2);
  });

  test('selects the splits dated after one date and on or before another', () => {
    expect(splitsDatedIn(splits, '2025-01-09', SPLIT_DAY).map((s) => s.split_id)).toEqual(['SPLIT-1']);
    expect(splitsDatedIn(splits, SPLIT_DAY, '2025-02-01').map((s) => s.split_id)).toEqual(['SPLIT-2']);
    expect(splitsDatedIn(splits, SPLIT_DAY, '2025-01-31')).toEqual([]);
  });

  test('rejects a date that is not an exact YYYY-MM-DD', () => {
    expect(() => splitsOnOrBefore(splits, '2025-01-10T00:00:00Z')).toThrow(OcpValidationError);
    expect(() => splitsOnOrBefore(splits, '2025-02-30')).toThrow(OcpValidationError);
  });
});

describe('applySplits', () => {
  test('a stale split epoch fails closed', () => {
    const state = stockState({ last_event_date: SPLIT_DAY });
    expect(applySplits([split('SPLIT-1', SPLIT_DAY, '2', '1')], '2025-01-12', state)).toEqual({
      ok: false,
      message: 'stale split epoch on security S-A1: 0, the class has 1 splits dated on or before 2025-01-10',
    });
  });

  test('is applied lazily: an event before the split leaves it unapplied, one on its day applies it', () => {
    const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1')];
    const before = applied(applySplits(splits, '2025-01-09', stockState()));
    expect([before.quantity, before.split_epoch, before.last_event_date]).toEqual(['600', 0, '2025-01-09']);
    const onDay = applied(applySplits(splits, SPLIT_DAY, before));
    expect([onDay.quantity, onDay.split_epoch, onDay.last_event_date]).toEqual(['1200', 1, SPLIT_DAY]);
    // A later event applies nothing again.
    const later = applied(applySplits(splits, '2025-03-01', onDay));
    expect([later.quantity, later.split_epoch]).toEqual(['1200', 1]);
  });

  test('steps through a 2:1 then a 3:1 split in date order', () => {
    const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1'), split('SPLIT-2', '2025-01-11', '3', '1')];
    const both = applied(applySplits(splits, '2025-01-11', stockState({ quantity: '100' })));
    expect([both.quantity, both.split_epoch]).toEqual(['600', 2]);
    const first = applied(applySplits(splits, SPLIT_DAY, stockState({ quantity: '100' })));
    expect([first.quantity, first.split_epoch]).toEqual(['200', 1]);
    const second = applied(applySplits(splits, '2025-01-11', first));
    expect([second.quantity, second.split_epoch]).toEqual(['600', 2]);
  });

  test('floors step by step, never by the product of the ratios', () => {
    const splits = [split('SPLIT-1', SPLIT_DAY, '2', '3'), split('SPLIT-2', '2025-01-11', '3', '2')];
    const state = applied(applySplits(splits, '2025-01-11', stockState({ quantity: '100' })));
    expect(state.quantity).toBe('99.9999999999');
    expect(scaleQuantityAcross('100', splits, '2024-01-01', '2025-01-11')).toBe('99.9999999999');
  });

  test('an issuance dated on the split’s day is already post-split', () => {
    const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1')];
    const issued = stockState({
      security_id: 'S-NEW',
      quantity: '10',
      issue_date: SPLIT_DAY,
      last_event_date: SPLIT_DAY,
      split_epoch: unitsEpochOf(SPLIT_DAY, splits),
    });
    expect(issued.split_epoch).toBe(1);
    expect(applied(applySplits(splits, '2025-01-15', issued)).quantity).toBe('10');
  });

  test('floors the quantity and the tranches cumulatively', () => {
    const tranches: Vesting[] = [
      { date: '2024-06-01', amount: '40' },
      { date: '2025-06-01', amount: '60' },
    ];
    const state = applied(
      applySplits([split('SPLIT-1', SPLIT_DAY, '2', '3')], SPLIT_DAY, {
        ...stockState({ security_id: 'S-T', quantity: '100' }),
        vesting: { kind: 'tranches', tranches },
      })
    );
    // 100 × 2/3 floors to 66.6666666666; cumulative tranches 40 → 26.6666666666, 100 → 66.6666666666.
    expect(state.quantity).toBe('66.6666666666');
    expect(state.vesting).toEqual({
      kind: 'tranches',
      tranches: [
        { date: '2024-06-01', amount: '26.6666666666' },
        { date: '2025-06-01', amount: '40' },
      ],
    });
  });

  test('a split that floors the quantity to zero fails closed', () => {
    const state = stockState({ security_id: 'S-TINY', quantity: '0.0000000001' });
    expect(applySplits([split('SPLIT-1', SPLIT_DAY, '1', '10')], SPLIT_DAY, state)).toEqual({
      ok: false,
      message: 'split SPLIT-1 floors security S-TINY to zero; retire the fraction with a record dated before the split',
    });
  });

  test('a split that floors every tranche to zero fails closed; zero tranches are otherwise dropped', () => {
    const tiny = stockState({
      security_id: 'S-T',
      quantity: '10',
      vesting: { kind: 'tranches', tranches: [{ date: '2024-06-01', amount: '0.0000000001' }] },
    });
    expect(applySplits([split('SPLIT-1', SPLIT_DAY, '1', '10')], SPLIT_DAY, tiny)).toEqual({
      ok: false,
      message: 'split SPLIT-1 floors every vesting tranche of security S-T to zero',
    });
    expect(
      scaleTranches({ numerator: '1', denominator: '10' }, [
        { date: '2024-06-01', amount: '0.0000000005' },
        { date: '2024-07-01', amount: '0.0000000005' },
        { date: '2024-08-01', amount: '20' },
      ])
    ).toEqual([
      { date: '2024-07-01', amount: '0.0000000001' },
      { date: '2024-08-01', amount: '2' },
    ]);
  });

  test('scales the snapshot and the shares accelerated since it, but never a hold quantity', () => {
    const hold = settlementHold({ quantity: '30' });
    const state = applied(
      applySplits(
        [split('SPLIT-1', SPLIT_DAY, '3', '2')],
        SPLIT_DAY,
        stockState({
          quantity: '101',
          vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' },
          snapshot: { as_of: '2024-12-31', vested: '31' },
          accelerated_since_snapshot: '5',
          holds: [hold],
        })
      )
    );
    expect(state.quantity).toBe('151.5');
    expect(state.snapshot).toEqual({ as_of: '2024-12-31', vested: '46.5' });
    expect(state.accelerated_since_snapshot).toBe('7.5');
    expect(state.holds).toEqual([hold]);
    // The hold is no longer current: the split voided it.
    expect(isCurrentHold(state, hold)).toBe(false);
  });

  test('a backdated event keeps the state’s last event date', () => {
    const state = stockState({ last_event_date: '2025-03-01', split_epoch: 1 });
    const result = applied(applySplits([split('SPLIT-1', SPLIT_DAY, '2', '1')], '2024-06-01', state));
    expect([result.last_event_date, result.split_epoch, result.quantity]).toEqual(['2025-03-01', 1, '600']);
  });

  test('cumulative tranche scaling never overstates vesting at any date (fast-check)', () => {
    const tranche = fc.record({
      day: fc.integer({ min: 0, max: 400 }),
      amount: fc.bigInt({ min: 1n, max: 10n ** 14n }),
    });
    const ratio = fc.record({
      numerator: fc.bigInt({ min: 1n, max: 10n ** 12n }),
      denominator: fc.bigInt({ min: 1n, max: 10n ** 12n }),
    });
    fc.assert(
      fc.property(fc.array(tranche, { minLength: 1, maxLength: 30 }), ratio, (generated, r) => {
        const tranches: Vesting[] = [...generated]
          .sort((a, b) => a.day - b.day)
          .map(({ day, amount }) => ({
            date: new Date(Date.UTC(2024, 0, 1 + day)).toISOString().slice(0, 10),
            amount: fromUnits(amount),
          }));
        const numerator = fromUnits(r.numerator);
        const denominator = fromUnits(r.denominator);
        const scaled = scaleTranches({ numerator, denominator }, tranches);
        expect(scaled.every((t) => toUnits(t.amount) > 0n)).toBe(true);
        for (const { date } of tranches) {
          const original = vestedBy(date, tranches);
          // Exactly the floor of the scaled cumulative amount, so never more than the exact product.
          expect(vestedBy(date, scaled)).toBe(floorMulDiv(original, numerator, denominator));
          expect(toUnits(vestedBy(date, scaled)) * toUnits(denominator)).toBeLessThanOrEqual(
            toUnits(original) * toUnits(numerator)
          );
        }
      }),
      { numRuns: 200 }
    );
  });
});

describe('reader-side scaling', () => {
  const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1'), split('SPLIT-2', '2025-02-01', '3', '1')];

  test('brings an untouched state’s quantity to the units of a later date', () => {
    expect(scaleQuantityAcross('600', splits, '2024-01-01', '2025-01-09')).toBe('600');
    expect(scaleQuantityAcross('600', splits, '2024-01-01', SPLIT_DAY)).toBe('1200');
    expect(scaleQuantityAcross('600', splits, '2024-01-01', '2025-03-01')).toBe('3600');
    // A quantity already in the first split's units takes only the second.
    expect(scaleQuantityAcross('1200', splits, SPLIT_DAY, '2025-03-01')).toBe('3600');
  });

  test('floors a reverse split, possibly to zero', () => {
    expect(scaleQuantityAcross('0.0000000001', [split('R', SPLIT_DAY, '1', '10')], '2024-01-01', SPLIT_DAY)).toBe('0');
  });
});

describe('holds and splits', () => {
  const splits = [split('SPLIT-1', SPLIT_DAY, '2', '1')];

  test('a settlement hold placed before a split is void for a draw on or after the split’s date', () => {
    const hold = settlementHold({ split_epoch: unitsEpochOf('2025-01-05', splits) });
    expect(isVoidedHold(hold, splits, '2025-01-05')).toBe(false);
    expect(isVoidedHold(hold, splits, '2025-01-09')).toBe(false);
    expect(isVoidedHold(hold, splits, SPLIT_DAY)).toBe(true);
    expect(isVoidedHold(hold, splits, '2025-01-12')).toBe(true);
    // A hold placed on or after the split is current.
    expect(isVoidedHold(settlementHold({ split_epoch: 1 }), splits, '2025-01-12')).toBe(false);
  });

  test('a stop is never voided', () => {
    const stop = settlementHold({ hold_type: 'STOP_TRANSFER', reference: 'CASE-1', quantity: null });
    expect(isVoidedHold(stop, splits, '2025-01-12')).toBe(false);
  });

  test('the hold queries', () => {
    const hold = settlementHold();
    const stop = settlementHold({ hold_id: 'HOLD-2', hold_type: 'STOP_TRANSFER', reference: 'CASE-1', quantity: null });
    const state = stockState({ holds: [hold, stop] });
    expect(settlementHolds(state)).toEqual([hold]);
    expect(stopHolds(state)).toEqual([stop]);
    expect(isStopped(state)).toBe(true);
    expect(isStopped(stockState({ holds: [hold] }))).toBe(false);
    expect(findHold('HOLD-2', state)).toEqual(stop);
    expect(findHold('HOLD-3', state)).toBeNull();
    expect(isCurrentHold(state, hold)).toBe(true);
  });
});
