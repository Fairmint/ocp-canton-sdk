/**
 * The replay's tracking of warrants, convertibles and equity compensation, which the register keeps no state for: the
 * facts the SDK's lifecycle checks read (remaining quantity or amount, exercised or converted, expiration, retirement),
 * and the one rule the ledger checks, that an event's security is carried by an issuance of its instrument
 * (`TestWarrantExercise.daml`, `TestEquityCompensationExercise.daml`, `TestVestingAcceleration.daml`).
 */

import type { InstrumentState } from '../../src/types/register';
import { acceleration, D2024, issuance, replayBook, vestingStart, type OcfJson } from './replayFixtures';

const usd = (amount: string): OcfJson => ({ amount, currency: 'USD' });

function warrant(securityId: string, extra: OcfJson = {}): OcfJson {
  return {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: `WI-${securityId}`,
    custom_id: `W-${securityId}`,
    date: D2024,
    security_id: securityId,
    stakeholder_id: 'SH-A',
    purchase_price: usd('100'),
    exercise_triggers: [],
    security_law_exemptions: [],
    quantity: '100',
    warrant_expiration_date: '2030-01-01',
    ...extra,
  };
}

function option(securityId: string, quantity: string, extra: OcfJson = {}): OcfJson {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: `ECI-${securityId}`,
    custom_id: `OPT-${securityId}`,
    date: D2024,
    security_id: securityId,
    stakeholder_id: 'SH-A',
    compensation_type: 'OPTION_NSO',
    quantity,
    exercise_price: usd('1'),
    expiration_date: '2025-01-01',
    stock_class_id: 'CLS-A',
    security_law_exemptions: [],
    termination_exercise_windows: [],
    ...extra,
  };
}

function convertible(securityId: string): OcfJson {
  return {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: `CI-${securityId}`,
    custom_id: `SAFE-${securityId}`,
    date: D2024,
    security_id: securityId,
    stakeholder_id: 'SH-A',
    convertible_type: 'SAFE',
    investment_amount: usd('10000'),
    conversion_triggers: [],
    seniority: 1,
    security_law_exemptions: [],
  };
}

function event(objectType: string, id: string, securityId: string, date: string, extra: OcfJson = {}): OcfJson {
  return { object_type: objectType, id, date, security_id: securityId, ...extra };
}

function instrumentOf(states: Map<string, InstrumentState>, securityId: string): InstrumentState {
  const state = states.get(securityId);
  if (state === undefined) throw new Error(`no instrument ${securityId}`);
  return state;
}

describe('replayOcf: warrants, convertibles and equity compensation', () => {
  it('retires a warrant at its exercise and flags a second one', () => {
    const exerciseDay = '2025-03-01';
    const result = replayBook(
      issuance('S-W1', 'SH-A', 'CLS-A', '100', exerciseDay),
      warrant('W-1'),
      event('TX_WARRANT_EXERCISE', 'WEX-1', 'W-1', exerciseDay, {
        trigger_id: 'WR-TRIGGER',
        resulting_security_ids: ['S-W1'],
      }),
      event('TX_WARRANT_EXERCISE', 'WEX-2', 'W-1', '2025-04-01', { trigger_id: 'WR-TRIGGER' })
    );
    expect(result.violations).toEqual([]);
    const state = instrumentOf(result.instruments, 'W-1');
    expect(state).toEqual(
      expect.objectContaining({
        kind: 'warrant',
        issuanceId: 'WI-W-1',
        quantity: '100',
        remainingQuantity: '0',
        exercisedQuantity: '100',
        expirationDate: '2030-01-01',
        retired: { recordId: 'WEX-1', objectType: 'TX_WARRANT_EXERCISE', date: exerciseDay },
      })
    );
    expect(state.events.map((tracked) => [tracked.recordId, tracked.effect, tracked.afterRetirement])).toEqual([
      ['WEX-1', 'retire', false],
      ['WEX-2', 'retire', true],
    ]);
    expect(state.events[0]?.resultingSecurityIds).toEqual(['S-W1']);
    // The exercise's resulting stock is a primary issuance, written after the exercise.
    expect(result.states.get('S-W1')?.quantity).toBe('100');
    const written = result.steps.flatMap((step) => step.recordIds);
    expect(written.indexOf('WEX-1')).toBeLessThan(written.indexOf('ISS-S-W1'));
  });

  it('draws exercises and releases from equity compensation’s remaining quantity', () => {
    const result = replayBook(
      option('EC-1', '100'),
      event('TX_EQUITY_COMPENSATION_EXERCISE', 'EX-1', 'EC-1', '2024-06-01', { quantity: '30' }),
      event('TX_EQUITY_COMPENSATION_RELEASE', 'REL-1', 'EC-1', '2024-07-01', {
        quantity: '80',
        release_price: usd('1'),
        settlement_date: '2024-07-01',
      }),
      event('TX_EQUITY_COMPENSATION_REPRICING', 'REP-1', 'EC-1', '2026-01-01', { new_exercise_price: usd('2') })
    );
    expect(result.violations).toEqual([]);
    const state = instrumentOf(result.instruments, 'EC-1');
    expect([state.remainingQuantity, state.exercisedQuantity, state.stockClassId]).toEqual(['-10', '110', 'CLS-A']);
    expect(state.retired?.recordId).toBe('REL-1');
    expect(
      state.events.map((tracked) => [
        tracked.recordId,
        tracked.effect,
        tracked.exceedsRemaining,
        tracked.afterRetirement,
        tracked.afterExpiration,
      ])
    ).toEqual([
      ['EX-1', 'reduce', false, false, false],
      ['REL-1', 'reduce', true, false, false],
      ['REP-1', 'none', false, true, true],
    ]);
  });

  it('retires equity compensation at a transfer, its balance a new security issued after it', () => {
    const day = '2024-06-01';
    const result = replayBook(
      option('EC-2', '100', { id: 'ECI-EC-2-B', security_id: 'EC-2-B', quantity: '40', date: day }),
      event('TX_EQUITY_COMPENSATION_TRANSFER', 'ECT-1', 'EC-1', day, {
        quantity: '60',
        resulting_security_ids: ['EC-2'],
        balance_security_id: 'EC-2-B',
      }),
      option('EC-1', '100'),
      option('EC-2', '60', { date: day })
    );
    expect(result.violations).toEqual([]);
    expect(instrumentOf(result.instruments, 'EC-1').retired?.recordId).toBe('ECT-1');
    expect(instrumentOf(result.instruments, 'EC-2-B').remainingQuantity).toBe('40');
    const written = result.steps.flatMap((step) => step.recordIds);
    expect(written.indexOf('ECT-1')).toBeLessThan(written.indexOf('ECI-EC-2'));
    expect(written.indexOf('ECT-1')).toBeLessThan(written.indexOf('ECI-EC-2-B'));
  });

  it('retires a convertible at a transfer of its amount', () => {
    const result = replayBook(
      convertible('CV-1'),
      event('TX_CONVERTIBLE_TRANSFER', 'CVT-1', 'CV-1', '2024-03-01', {
        amount: usd('12000'),
        resulting_security_ids: ['CV-2'],
      })
    );
    expect(result.violations).toEqual([]);
    const state = instrumentOf(result.instruments, 'CV-1');
    expect([state.amount, state.remainingAmount, state.quantity]).toEqual([usd('10000'), '0', null]);
    expect(state.events[0]).toEqual(
      expect.objectContaining({ amount: usd('12000'), exceedsRemaining: true, effect: 'retire' })
    );
  });

  it('replays an instrument record dated before its issuance after it', () => {
    const result = replayBook(
      event('TX_WARRANT_ACCEPTANCE', 'WACC-1', 'W-1', '2023-06-01'),
      vestingStart('VS-W', 'W-1', '2023-07-01'),
      warrant('W-1')
    );
    expect(result.violations).toEqual([]);
    expect(instrumentOf(result.instruments, 'W-1').events.map((tracked) => tracked.recordId)).toEqual([
      'WACC-1',
      'VS-W',
    ]);
  });

  it('refuses an event whose security no issuance of its instrument carries', () => {
    const result = replayBook(
      convertible('CV-1'),
      event('TX_WARRANT_EXERCISE', 'WEX-1', 'W-NONE', '2025-01-01', { trigger_id: 'WR-TRIGGER' }),
      event('TX_WARRANT_EXERCISE', 'WEX-2', 'S-A1', '2025-01-02', { trigger_id: 'WR-TRIGGER' }),
      acceleration('ACC-C', 'CV-1', '1', '2025-01-03'),
      acceleration('ACC-X', 'EC-MISSING', '1', '2025-01-04')
    );
    expect(result.violations.map((violation) => [violation.rule, violation.message])).toEqual([
      ['reference', 'Warrant exercise security not found: W-NONE'],
      ['reference', 'Warrant exercise security S-A1 is carried by a OcfObjectTypeTxStockIssuance'],
      [
        'reference',
        'Vesting record (no stock state in this write) security CV-1 is carried by a OcfObjectTypeTxConvertibleIssuance',
      ],
      ['reference', 'Vesting record (no stock state in this write) security not found: EC-MISSING'],
    ]);
  });
});
