import { OcpValidationError } from '../../src/errors';
import { planDraw } from '../../src/register/draw';
import { deriveId } from '../../src/register/ids';
import type { OcfStockIssuance } from '../../src/types/native';
import type { OpenHold, PlanDrawInput, StockSecurityState } from '../../src/types/register';
import { CONTEXT, split, stockState } from './registerFixtures';

const HOLD: OpenHold = {
  hold_id: 'test-1:hold-S-A1',
  hold_type: 'REGISTER_SETTLEMENT',
  reference: 'T-1',
  split_epoch: 0,
  quantity: '1000',
};

const ORIGIN: OcfStockIssuance = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'ISS-A1',
  date: '2024-01-01',
  security_id: 'S-A1',
  custom_id: 'CS-A1',
  stakeholder_id: 'SH-A',
  stock_class_id: 'CLS-A',
  share_price: { amount: '1', currency: 'USD' },
  quantity: '1000',
  cost_basis: { amount: '1000.00', currency: 'USD' },
  stock_legend_ids: ['LEGEND-1'],
  security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
};

// The lot after its hold placement: seq 1, last event on the trade day's placement.
function heldState(overrides: Partial<StockSecurityState> = {}): StockSecurityState {
  return stockState({ quantity: '1000', seq: 1, last_event_date: '2025-06-02', holds: [HOLD], ...overrides });
}

function input(overrides: Partial<PlanDrawInput> = {}): PlanDrawInput {
  return {
    state: heldState(),
    epochSplits: [],
    settlementId: 'T-1',
    holdId: HOLD.hold_id,
    quantity: '750',
    sharePrice: { amount: '2.00', currency: 'USD' },
    customId: 'BUY-S-A1',
    originIssuance: { contractId: 'cid-ISS-A1', data: ORIGIN },
    date: '2025-06-02',
    capTableId: CONTEXT.cap_table_id,
    ...overrides,
  };
}

function derived(role: Parameters<typeof deriveId>[0]['role'], seq = 1): string {
  return deriveId({ capTableId: CONTEXT.cap_table_id, securityId: 'S-A1', seq, role, index: 0 });
}

function refusal(overrides: Partial<PlanDrawInput>): OcpValidationError {
  try {
    planDraw(input(overrides));
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('planDraw did not refuse');
}

describe('planDraw', () => {
  it('plans the worked example: 750 of 1,000 at 2.00 USD on a 1,000.00 basis', () => {
    const planned = planDraw(input());

    expect(planned.lot).toEqual({
      security_id: 'S-A1',
      hold_id: HOLD.hold_id,
      quantity: '750',
      custom_id: 'BUY-S-A1',
      share_price: { amount: '2', currency: 'USD' },
      buyer_cost_basis: { amount: '1500', currency: 'USD' },
      balance_cost_basis: { amount: '250', currency: 'USD' },
      balance_vestings: [],
      origin_issuance: 'cid-ISS-A1',
    });
    expect(planned.delivered).toEqual({
      kind: 'draw',
      security_id: 'S-A1',
      hold_id: HOLD.hold_id,
      quantity: '750',
      share_price: { amount: '2', currency: 'USD' },
      transfer_id: derived('event'),
      buyer_issuance_id: derived('resulting_issuance'),
      buyer_security_id: derived('resulting_security'),
      balance_issuance_id: derived('balance_issuance'),
      balance_security_id: derived('balance_security'),
      stock_legend_ids: ['LEGEND-1'],
      security_law_exemptions: [{ description: 'Rule 144', jurisdiction: 'US' }],
    });
    expect(planned.seller_stakeholder_id).toBe('SH-A');
    expect(planned.stock_class_id).toBe('CLS-A');
    expect(planned.balance).toEqual({
      quantity: '250',
      cost_basis: { amount: '250', currency: 'USD' },
      vestings: [],
    });
  });

  it('draws the whole lot with no balance, and no balance basis when the origin has none', () => {
    const { cost_basis: _, ...noBasis } = ORIGIN;
    const planned = planDraw(input({ quantity: '1000', originIssuance: { contractId: 'cid', data: noBasis } }));
    expect(planned.lot.balance_cost_basis).toBeNull();
    expect(planned.delivered.balance_issuance_id).toBeNull();
    expect(planned.delivered.balance_security_id).toBeNull();
    expect(planned.balance).toBeNull();

    const partial = planDraw(input({ originIssuance: { contractId: 'cid', data: noBasis } }));
    expect(partial.lot.balance_cost_basis).toBeNull();
    expect(partial.balance?.quantity).toBe('250');
  });

  it('rounds the buyer basis half-even at scale 10 and floors the balance basis', () => {
    const planned = planDraw(
      input({
        quantity: '0.0000000001',
        sharePrice: { amount: '1.5', currency: 'USD' },
        originIssuance: { contractId: 'cid', data: { ...ORIGIN, cost_basis: { amount: '1', currency: 'EUR' } } },
        state: heldState({ quantity: '3', holds: [{ ...HOLD, quantity: '3' }] }),
      })
    );
    // 1.5 × 0.0000000001 is a tie at scale 10 and rounds to the even 0.0000000002; 1 × 2.9999999999 / 3 floors to
    // 0.9999999999, in the origin's currency
    expect(planned.lot.buyer_cost_basis).toEqual({ amount: '0.0000000002', currency: 'USD' });
    expect(planned.lot.balance_cost_basis).toEqual({ amount: '0.9999999999', currency: 'EUR' });
  });

  it('refuses a hold a split voided, after bringing the lot to the date', () => {
    // Held on 2025-06-01; a 2:1 split dated the trade day voids the hold
    const error = refusal({
      state: heldState({ last_event_date: '2025-06-01' }),
      epochSplits: [split('SPLIT-1', '2025-06-02', '2', '1')],
    });
    expect(error.message).toContain(`a split of the class voided hold ${HOLD.hold_id}`);
    expect(error.classification).toBe('voided_hold');
  });

  it('refuses a stopped lot', () => {
    const stop: OpenHold = {
      hold_id: 'stop-1',
      hold_type: 'STOP_TRANSFER',
      reference: 'CASE-1',
      split_epoch: 0,
      quantity: null,
    };
    const error = refusal({ state: heldState({ holds: [HOLD, stop] }) });
    expect(error.message).toContain('security S-A1 is stopped');
    expect(error.classification).toBe('stopped_lot');
  });

  it.each([
    [{ holdId: 'nope' }, 'hold nope is not open on security S-A1', 'hold_not_open'],
    [{ settlementId: 'T-2' }, `hold ${HOLD.hold_id} is not a settlement hold under T-2`, 'not_settlement_hold'],
    [
      { quantity: '1001' },
      `draw of 1001.0 must be positive and at most hold ${HOLD.hold_id}'s quantity`,
      'draw_quantity',
    ],
    [{ quantity: '0' }, 'draw of 0.0 must be positive', 'draw_quantity'],
    [
      { date: '2025-06-01' },
      'event dated 2025-06-01 precedes the last event on security S-A1 (2025-06-02)',
      'event_before_last_event',
    ],
    [
      { originIssuance: { contractId: 'cid', data: { ...ORIGIN, id: 'ISS-OTHER' } } },
      'issuance ISS-OTHER is not the origin of security S-A1',
      'origin_mismatch',
    ],
    [
      { originIssuance: { contractId: 'cid', data: { ...ORIGIN, stakeholder_id: 'SH-B' } } },
      "origin issuance ISS-A1 disagrees with security S-A1's stakeholder or class",
      'origin_mismatch',
    ],
    [
      { balanceVestings: [{ date: '2026-01-01', amount: '250' }] },
      "a fully vested lot's balance carries no vesting",
      'balance_vestings',
    ],
  ])('refuses %j as the ledger does', (overrides, message, classification) => {
    const error = refusal(overrides);
    expect(error.message).toContain(message);
    expect(error.classification).toBe(classification);
  });

  it('refuses a lot whose tranches cover less than its quantity', () => {
    const state = heldState({ vesting: { kind: 'tranches', tranches: [{ date: '2025-01-01', amount: '900' }] } });
    expect(refusal({ state }).classification).toBe('partial_tranche_cover');
  });

  it('leaves a tranche lot balance to the ledger, from the earliest vested tranches', () => {
    const tranches = [
      { date: '2025-01-01', amount: '250' },
      { date: '2025-04-01', amount: '250' },
      { date: '2025-07-01', amount: '250' },
      { date: '2025-10-01', amount: '250' },
    ];
    const state = heldState({ vesting: { kind: 'tranches', tranches }, holds: [{ ...HOLD, quantity: '300' }] });
    const planned = planDraw(input({ state, quantity: '300' }));
    expect(planned.lot.balance_vestings).toEqual([]);
    expect(planned.balance?.vestings).toEqual([
      { date: '2025-04-01', amount: '200' },
      { date: '2025-07-01', amount: '250' },
      { date: '2025-10-01', amount: '250' },
    ]);
    expect(refusal({ state, quantity: '300', balanceVestings: tranches }).message).toContain(
      "a tranche lot's balance vesting is the ledger's to compute"
    );
  });

  it("checks a lot on terms against the caller's balance tranches", () => {
    const state = heldState({
      vesting: { kind: 'on_terms', vesting_terms_id: 'VT-4Y' },
      snapshot: { as_of: '2025-03-01', vested: '400' },
      holds: [{ ...HOLD, quantity: '300' }],
    });
    const good = [
      { date: '2025-03-01', amount: '100' },
      { date: '2027-01-01', amount: '600.0' },
    ];
    const planned = planDraw(input({ state, quantity: '300', balanceVestings: good }));
    expect(planned.lot.balance_vestings).toEqual([
      { date: '2025-03-01', amount: '100' },
      { date: '2027-01-01', amount: '600' },
    ]);
    expect(planned.balance).toEqual({
      quantity: '700',
      cost_basis: { amount: '700', currency: 'USD' },
      vestings: planned.lot.balance_vestings,
    });

    expect(
      refusal({ state, quantity: '300', balanceVestings: [{ date: '2027-01-01', amount: '700' }] }).message
    ).toContain('must equal the vested 100.0 it keeps');
    expect(
      refusal({ state, quantity: '300', balanceVestings: [{ date: '2025-03-01', amount: '100' }] }).message
    ).toContain('must sum to its quantity 700.0');
    expect(refusal({ state, quantity: '300' }).message).toContain('must sum to its quantity 700.0');
    const whole = heldState({ ...state, holds: [{ ...HOLD, quantity: '1000' }] });
    expect(refusal({ state: whole, quantity: '1000', balanceVestings: good }).message).toContain(
      'a full draw has no balance vestings'
    );
  });

  it('applies the splits dated after the last event before it draws', () => {
    // A split before the hold's date was applied by the placement; a stale state fails closed
    const splits = [split('SPLIT-1', '2025-01-01', '2', '1')];
    const stale = refusal({ epochSplits: splits });
    expect(stale.classification).toBe('split_application');
    const current = planDraw(
      input({
        epochSplits: splits,
        state: heldState({ split_epoch: 1, quantity: '2000', holds: [{ ...HOLD, split_epoch: 1 }] }),
      })
    );
    expect(current.balance?.quantity).toBe('1250');
    expect(current.lot.balance_cost_basis).toEqual({ amount: '625', currency: 'USD' });
  });

  it('refuses malformed input', () => {
    expect(() => planDraw(input({ date: '2025-6-2' }))).toThrow(OcpValidationError);
    expect(() => planDraw(input({ quantity: '1e3' }))).toThrow('Expected a decimal string');
    expect(() => planDraw(input({ customId: '' }))).toThrow('Required field is missing or empty');
  });
});
