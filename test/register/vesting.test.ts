import {
  accelerateTranches,
  checkBalanceVesting,
  checkOutputsVesting,
  checkTransferVesting,
  drawTranches,
  fromUnits,
  fullyCovered,
  isOnTerms,
  sortTranches,
  toUnits,
  trancheTotal,
  vestedAt,
  vestedBy,
} from '../../src/register';
import { addDays } from '../../src/register/dates';
import type { Vesting } from '../../src/types/native';
import type { OutputVesting, RegisterCheckResult, StockSecurityState } from '../../src/types/register';
import { stockState } from './registerFixtures';

function tranche(amount: string, date: string): Vesting {
  return { amount, date };
}

function output(quantity: string, vestings: Vesting[] = [], on_terms = false): OutputVesting {
  return { quantity, vestings, on_terms };
}

function withTranches(security_id: string, quantity: string, tranches: Vesting[]): StockSecurityState {
  return stockState({ security_id, quantity, vesting: { kind: 'tranches', tranches } });
}

function onTerms(security_id: string, quantity: string, vested: string | null): StockSecurityState {
  return stockState({
    security_id,
    quantity,
    vesting: { kind: 'on_terms', vesting_terms_id: 'VT-4Y' },
    snapshot: vested === null ? null : { as_of: '2025-03-01', vested },
  });
}

const PASSED: RegisterCheckResult = { ok: true };

function refused(message: string): RegisterCheckResult {
  return { ok: false, message };
}

describe('vesting queries', () => {
  const tranches = [tranche('50', '2024-02-01'), tranche('50', '2025-02-01')];

  test('vested shares at a date', () => {
    expect(vestedAt(stockState({ quantity: '600' }), '2020-01-01')).toBe('600');
    const lot = withTranches('S-V', '100', tranches);
    expect(vestedAt(lot, '2024-01-31')).toBe('0');
    expect(vestedAt(lot, '2024-02-01')).toBe('50');
    expect(vestedAt(lot, '2030-01-01')).toBe('100');
    expect(vestedAt(onTerms('S-V1', '100', '40'), '2020-01-01')).toBe('40');
    expect(vestedAt(onTerms('S-V1', '100', null), '2030-01-01')).toBe('0');
    expect(vestedBy('2024-12-31', tranches)).toBe('50');
    expect(trancheTotal(tranches)).toBe('100');
  });

  test('tranche cover', () => {
    expect(fullyCovered(withTranches('S-V', '100', tranches))).toBe(true);
    expect(fullyCovered(withTranches('S-V', '101', tranches))).toBe(false);
    expect(fullyCovered(stockState())).toBe(true);
    expect(fullyCovered(onTerms('S-V1', '100', null))).toBe(true);
    expect(isOnTerms(onTerms('S-V1', '100', null).vesting)).toBe(true);
    expect(isOnTerms(stockState().vesting)).toBe(false);
  });

  test('sorts tranches by date, keeping the order of tranches on one date', () => {
    expect(sortTranches([tranche('1', '2025-01-01'), tranche('2', '2024-01-01'), tranche('3', '2025-01-01')])).toEqual([
      tranche('2', '2024-01-01'),
      tranche('1', '2025-01-01'),
      tranche('3', '2025-01-01'),
    ]);
  });
});

describe('drawTranches', () => {
  const tranches = [tranche('50', '2025-01-01'), tranche('50', '2024-01-01')];

  test('takes from the earliest tranches first, dropping emptied ones', () => {
    expect(drawTranches('30', tranches)).toEqual([tranche('20', '2024-01-01'), tranche('50', '2025-01-01')]);
    expect(drawTranches('50', tranches)).toEqual([tranche('50', '2025-01-01')]);
    expect(drawTranches('60', tranches)).toEqual([tranche('40', '2025-01-01')]);
    expect(drawTranches('100', tranches)).toEqual([]);
    expect(drawTranches('150', tranches)).toEqual([]);
    expect(drawTranches('0', tranches)).toEqual([tranche('50', '2024-01-01'), tranche('50', '2025-01-01')]);
  });

  test('a partial settlement draw leaves the balance the later tranches', () => {
    expect(drawTranches('0.0000000001', [tranche('0.5', '2024-01-01')])).toEqual([
      tranche('0.4999999999', '2024-01-01'),
    ]);
  });
});

describe('accelerateTranches (the ledger’s acceleration scenarios)', () => {
  const d2024 = '2024-01-01';
  const d2025 = '2025-01-01';
  const d2026 = '2026-01-01';
  const d2027 = '2027-01-01';
  const mid = '2024-06-01';

  function accelerate(date: string, quantity: string, state: StockSecurityState): Vesting[] | string {
    if (state.vesting.kind !== 'tranches') throw new Error('expected a tranche lot');
    const result = accelerateTranches(date, quantity, state, state.vesting.tranches);
    return result.ok ? result.value : result.message;
  }

  test('on a tranche’s own date, the accelerated shares join it', () => {
    const lot = withTranches('S-T1', '100', [tranche('50', d2024), tranche('50', d2026)]);
    expect(accelerate(d2024, '10', lot)).toEqual([tranche('60', d2024), tranche('40', d2026)]);
  });

  test('beyond the later tranches, from the shares no tranche covers', () => {
    const lot = withTranches('S-T2', '100', [tranche('50', d2024), tranche('20', d2026)]);
    expect(accelerate(d2025, '40', lot)).toEqual([tranche('50', d2024), tranche('40', d2025)]);
  });

  test('part of a tranche, bounded by the unvested quantity at the date', () => {
    const lot = withTranches('S-T3', '100', [
      tranche('25', d2024),
      tranche('25', d2025),
      tranche('25', d2026),
      tranche('25', d2027),
    ]);
    const once = accelerate(mid, '30', lot);
    expect(once).toEqual([tranche('25', d2024), tranche('30', mid), tranche('20', d2026), tranche('25', d2027)]);
    if (typeof once === 'string') throw new Error(once);
    const after = { ...lot, vesting: { kind: 'tranches' as const, tranches: once } };
    expect(accelerate(mid, '46', after)).toBe(
      'acceleration of 46.0 on security S-T3 must be positive and at most its unvested quantity 45.0'
    );
    // Exactly the unvested quantity vests everything.
    expect(accelerate(mid, '45', after)).toEqual([tranche('25', d2024), tranche('75', mid)]);
  });

  test('a zero quantity is refused', () => {
    const lot = withTranches('S-T1', '100', [tranche('60', d2024), tranche('40', d2026)]);
    expect(accelerate(d2025, '0', lot)).toBe(
      'acceleration of 0.0 on security S-T1 must be positive and at most its unvested quantity 40.0'
    );
  });
});

describe('checkOutputsVesting', () => {
  test('a same-class conversion never vests ahead of its source', () => {
    const source = withTranches('S-V', '100', [tranche('50', '2024-01-01'), tranche('50', '2026-01-01')]);
    expect(checkOutputsVesting('2025-01-01', 'CONV-V', [source], [output('100')])).toEqual(
      refused(
        'the outputs of CONV-V vest 100.0 shares by 2025-01-01, more than the 50.0 their source has vested by then'
      )
    );
    expect(
      checkOutputsVesting(
        '2025-01-01',
        'CONV-V',
        [source],
        [output('100', [tranche('50', '2024-06-01'), tranche('50', '2026-01-01')])]
      )
    ).toEqual(PASSED);
    // A later output tranche ahead of the source's fails at its date.
    expect(
      checkOutputsVesting(
        '2025-01-01',
        'CONV-V',
        [source],
        [output('100', [tranche('50', '2024-06-01'), tranche('50', '2025-06-01')])]
      )
    ).toEqual(
      refused(
        'the outputs of CONV-V vest 100.0 shares by 2025-06-01, more than the 50.0 their source has vested by then'
      )
    );
  });

  test('a transfer’s fully vested buyer lot vests ahead of a tranche source', () => {
    const source = withTranches('S-V', '100', [tranche('50', '2024-02-01'), tranche('50', '2025-02-01')]);
    expect(
      checkOutputsVesting(
        '2024-03-01',
        'TR-V',
        [source],
        [output('60'), output('40', [tranche('20', '2024-02-01'), tranche('20', '2025-02-01')])]
      )
    ).toEqual(
      refused('the outputs of TR-V vest 80.0 shares by 2024-03-01, more than the 50.0 their source has vested by then')
    );
  });

  test('a source on vesting terms counts its snapshot at the event and its whole quantity after it', () => {
    const source = onTerms('S-V1', '100', '40');
    const day = '2025-03-03';
    expect(checkOutputsVesting(day, 'TR-W', [source], [output('100')])).toEqual(
      refused('the outputs of TR-W vest 100.0 shares by 2025-03-03, more than the 40.0 their source has vested by then')
    );
    // On terms, the output counts as unvested until the TA's snapshot on it.
    expect(checkOutputsVesting(day, 'TR-W', [source], [output('100', [], true)])).toEqual(PASSED);
    expect(
      checkOutputsVesting(day, 'TR-W', [source], [output('100', [tranche('30', day), tranche('70', '2025-03-04')])])
    ).toEqual(PASSED);
  });
});

describe('checkTransferVesting', () => {
  const t1 = '2024-02-01';
  const t2 = '2025-02-01';
  const day = '2024-03-01';
  const source = withTranches('S-V', '100', [tranche('50', t1), tranche('50', t2)]);

  test('a free transfer splits tranches, conserving each date’s vested amount', () => {
    expect(
      checkTransferVesting(
        day,
        'TR-V',
        source,
        [output('60', [tranche('30', t1), tranche('30', t2)])],
        output('40', [tranche('20', t1), tranche('20', t2)])
      )
    ).toEqual(PASSED);
    expect(
      checkTransferVesting(
        day,
        'TR-V',
        source,
        [output('60', [tranche('30', t1), tranche('30', t2)])],
        output('40', [tranche('40', t2)])
      )
    ).toEqual(refused('the outputs of TR-V vest 30.0 shares by 2024-03-01, but security S-V has vested 50.0 by then'));
  });

  test('no output replaces tranches with vesting terms', () => {
    expect(
      checkTransferVesting(
        day,
        'TR-V',
        source,
        [output('60', [], true)],
        output('40', [tranche('20', t1), tranche('20', t2)])
      )
    ).toEqual(
      refused("the outputs of TR-V split security S-V's tranches; none of them replaces them with vesting terms")
    );
  });

  test('a fully vested lot stays fully vested', () => {
    const fullyVested = stockState({ security_id: 'S-A2', quantity: '400' });
    expect(
      checkTransferVesting(day, 'TR-F', fullyVested, [output('400', [tranche('400', '2030-01-01')])], null)
    ).toEqual(refused('the outputs of TR-F vest 0.0 shares by 2024-03-01, but security S-A2 has vested 400.0 by then'));
    expect(checkTransferVesting(day, 'TR-F', fullyVested, [output('400')], null)).toEqual(PASSED);
  });

  test('from a lot on vesting terms, the balance keeps the vested shares the resulting issuances leave', () => {
    const terms = onTerms('S-V1', '100', '40');
    const date = '2025-03-03';
    expect(
      checkTransferVesting(date, 'TR-T', terms, [output('30')], output('70', [tranche('70', '2027-01-01')]))
    ).toEqual(
      refused('the balance of TR-T vests 0.0 shares by 2025-03-03, but keeps 10.0 vested shares of security S-V1')
    );
    expect(
      checkTransferVesting(
        date,
        'TR-T',
        terms,
        [output('30')],
        output('70', [tranche('10', '2025-03-01'), tranche('60', '2027-01-01')])
      )
    ).toEqual(PASSED);
    // A whole transfer leaves no balance.
    expect(checkTransferVesting(date, 'TR-W', terms, [output('100', [], true)], null)).toEqual(PASSED);
  });
});

describe('checkBalanceVesting', () => {
  test('a fully vested source leaves a fully vested balance', () => {
    const source = stockState({ security_id: 'SEC-1', quantity: '100' });
    expect(checkBalanceVesting(source, output('60'))).toEqual(PASSED);
    expect(checkBalanceVesting(source, output('60', [tranche('60', '2024-01-02')]))).toEqual(
      refused('the balance of fully vested security SEC-1 must carry no vesting')
    );
    expect(checkBalanceVesting(source, output('60', [], true))).toEqual(
      refused('the balance of fully vested security SEC-1 must carry no vesting')
    );
  });

  test('a balance of a tranche or terms lot carries explicit vestings that sum to its quantity', () => {
    const source = withTranches('S-V', '100', [tranche('50', '2024-02-01'), tranche('50', '2025-02-01')]);
    expect(checkBalanceVesting(source, output('40'))).toEqual(
      refused('the balance of security S-V must carry explicit vestings that sum to its quantity 40.0')
    );
    expect(
      checkBalanceVesting(source, output('40', [tranche('20', '2024-02-01'), tranche('10', '2025-02-01')]))
    ).toEqual(refused('the balance of security S-V must carry explicit vestings that sum to its quantity 40.0'));
    expect(
      checkBalanceVesting(source, output('40', [tranche('20', '2024-02-01'), tranche('20', '2025-02-01')]))
    ).toEqual(PASSED);
    expect(checkBalanceVesting(onTerms('S-V1', '100', '40'), output('70', [tranche('70', '2027-01-01')]))).toEqual(
      PASSED
    );
  });
});

/**
 * The ledger's generated cases (`Test/daml/OpenCapTable/TestVestingChecks.daml`): the swept checks agree, message
 * included, with the direct per-date definition on 300 seeds of the same linear congruential generator.
 */
describe('the vesting checks match their definition on generated cases', () => {
  const eventDate = '2025-03-01';

  function next(x: bigint): bigint {
    return (x * 1103515245n + 12345n) % 2147483648n;
  }

  function draws(seed: number, n: number): number[] {
    const values: number[] = [];
    let x = BigInt(seed);
    for (let i = 0; i < n; i++) {
      x = next(x);
      values.push(Number(x));
    }
    return values;
  }

  function tranchesOf(values: readonly number[]): Vesting[] {
    const result: Vesting[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      result.push(tranche(String(1 + ((values[i + 1] ?? 0) % 9)), addDays(eventDate, ((values[i] ?? 0) % 81) - 40)));
    }
    return result;
  }

  function total(tranches: readonly Vesting[]): bigint {
    return toUnits(trancheTotal(tranches));
  }

  function lot(seed: number, i: number): StockSecurityState {
    const tranches = sortTranches(tranchesOf(draws(seed + i, 2 * (seed % 6))));
    const kind = (seed + i) % 4;
    const vesting: StockSecurityState['vesting'] =
      kind === 0
        ? { kind: 'none' }
        : kind === 1
          ? { kind: 'on_terms', vesting_terms_id: 'VT' }
          : tranches.length === 0
            ? { kind: 'none' }
            : { kind: 'tranches', tranches };
    const units = total(tranches) + toUnits(String((seed + i) % 3));
    const quantity = units > 0n ? fromUnits(units) : '5';
    const vested = BigInt(seed % 4) * 10n ** 10n;
    return stockState({
      security_id: `S-${i}`,
      issue_date: addDays(eventDate, -100),
      last_event_date: eventDate,
      origin_transaction_id: `ISS-${i}`,
      quantity,
      stakeholder_id: 'SH',
      stock_class_id: 'CLS',
      vesting,
      snapshot:
        vesting.kind === 'on_terms'
          ? { as_of: eventDate, vested: fromUnits(vested < toUnits(quantity) ? vested : toUnits(quantity)) }
          : null,
    });
  }

  function outputOf(seed: number, i: number): OutputVesting {
    const tranches = tranchesOf(draws(seed * 7 + i, 2 * ((seed + i) % 5)));
    return {
      quantity: fromUnits(total(tranches) + toUnits(String((seed + i) % 2))),
      vestings: tranches,
      on_terms: tranches.length === 0 && (seed + i) % 3 === 0,
    };
  }

  function outputAt(t: string, o: OutputVesting): bigint {
    if (o.vestings.length > 0) return toUnits(vestedBy(t, o.vestings));
    return o.on_terms ? 0n : toUnits(o.quantity);
  }

  function trancheDates(s: StockSecurityState): string[] {
    return s.vesting.kind === 'tranches' ? s.vesting.tranches.map((t) => t.date) : [];
  }

  function laterDates(d: string, dates: readonly string[]): string[] {
    return [...new Set(dates)].sort().filter((t) => t > d);
  }

  function show(units: bigint): string {
    const text = fromUnits(units);
    return text.includes('.') ? text : `${text}.0`;
  }

  function referenceOutputs(
    d: string,
    label: string,
    sources: readonly StockSecurityState[],
    outputs: readonly OutputVesting[]
  ): RegisterCheckResult {
    const sourceVestedBy = (t: string, s: StockSecurityState): bigint => {
      switch (s.vesting.kind) {
        case 'tranches':
          return toUnits(vestedBy(t, s.vesting.tranches));
        case 'none':
          return toUnits(s.quantity);
        case 'on_terms':
          return t <= d ? toUnits(vestedAt(s, d)) : toUnits(s.quantity);
      }
    };
    const sourceAt = (t: string): bigint => sources.reduce((sum, s) => sum + sourceVestedBy(t, s), 0n);
    const outputsAt = (t: string): bigint => outputs.reduce((sum, o) => sum + outputAt(t, o), 0n);
    const dates = laterDates(d, [
      ...sources.flatMap(trancheDates),
      ...outputs.flatMap((o) => o.vestings.map((v) => v.date)),
      ...sources.filter((s) => isOnTerms(s.vesting)).map(() => addDays(d, 1)),
    ]);
    const failure = [d, ...dates].find((t) => outputsAt(t) > sourceAt(t));
    if (failure === undefined) return PASSED;
    return refused(
      `the outputs of ${label} vest ${show(outputsAt(failure))} shares by ${failure}, more than the ${show(sourceAt(failure))} their source has vested by then`
    );
  }

  function referenceTransfer(
    d: string,
    label: string,
    s: StockSecurityState,
    resulting: readonly OutputVesting[],
    balance: OutputVesting | null
  ): RegisterCheckResult {
    const outputs = balance === null ? resulting : [...resulting, balance];
    const outputsAt = (t: string): bigint => outputs.reduce((sum, o) => sum + outputAt(t, o), 0n);
    const dates = laterDates(d, [...trancheDates(s), ...outputs.flatMap((o) => o.vestings.map((v) => v.date))]);
    const failure = [d, ...dates].find((t) => outputsAt(t) !== toUnits(vestedAt(s, t)));
    if (failure === undefined) return PASSED;
    return refused(
      `the outputs of ${label} vest ${show(outputsAt(failure))} shares by ${failure}, but security ${s.security_id} has vested ${show(toUnits(vestedAt(s, failure)))} by then`
    );
  }

  const seeds = Array.from({ length: 300 }, (_, i) => i + 1);
  const sourcesOf = (seed: number): StockSecurityState[] =>
    Array.from({ length: 1 + (seed % 3) }, (_, i) => lot(seed, i + 1));
  const outputsOf = (seed: number): OutputVesting[] =>
    Array.from({ length: 1 + (seed % 4) }, (_, i) => outputOf(seed, i + 1));

  test('checkOutputsVesting', () => {
    const results = seeds.map((seed) => checkOutputsVesting(eventDate, 'event', sourcesOf(seed), outputsOf(seed)));
    expect(results).toEqual(
      seeds.map((seed) => referenceOutputs(eventDate, 'event', sourcesOf(seed), outputsOf(seed)))
    );
    // The cases exercise both outcomes.
    expect(results.some((result) => result.ok)).toBe(true);
    expect(results.some((result) => !result.ok)).toBe(true);
  });

  test('checkTransferVesting', () => {
    let compared = 0;
    for (const seed of seeds) {
      const source = lot(seed, 0);
      const outputs = outputsOf(seed);
      // The first of two or more outputs is the balance, as the ledger's generated cases take it.
      const balance = outputs.length >= 2 ? (outputs[0] ?? null) : null;
      const resulting = outputs.length >= 2 ? outputs.slice(1) : outputs;
      if (source.vesting.kind === 'on_terms' || outputs.some((o) => o.on_terms)) continue;
      compared++;
      expect(checkTransferVesting(eventDate, 'transfer', source, resulting, balance)).toEqual(
        referenceTransfer(eventDate, 'transfer', source, resulting, balance)
      );
    }
    expect(compared).toBeGreaterThan(100);
  });
});
