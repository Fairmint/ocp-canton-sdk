import { admitContract } from '../../src/register/admission';
import { CONTEXT, stateEvent } from './registerLedgerFixtures';

function admittedState(payload: Parameters<typeof stateEvent>[1]) {
  const result = admitContract(stateEvent('cid-state', payload), { requireView: true });
  if (!result.ok) throw new Error(result.rejection.message);
  if (result.contract.kind !== 'state') throw new Error(`not a state: ${result.contract.kind}`);
  return result.contract.contract.state;
}

function rejection(payload: Parameters<typeof stateEvent>[1]) {
  const result = admitContract(stateEvent('cid-state', payload), { requireView: true });
  if (result.ok) throw new Error('admitted');
  return result.rejection;
}

describe('StockSecurity to native', () => {
  it('converts tranches, a delivery and canonical decimals', () => {
    const state = admittedState({
      vesting: {
        tag: 'StockVestingTranches',
        value: [
          { date: '2024-06-01', amount: '2500000.0000000000' },
          { date: '2025-06-01', amount: '2500000.0000000000' },
        ],
      },
      holds: [],
      delivery: { reference: 'settlement-1', seller_stakeholder_id: 'SH-S', transfer_id: 'TR-1' },
    });

    expect(state).toMatchObject({
      context: CONTEXT,
      quantity: '5000000',
      seq: 2,
      split_epoch: 0,
      vesting: {
        kind: 'tranches',
        tranches: [
          { date: '2024-06-01', amount: '2500000' },
          { date: '2025-06-01', amount: '2500000' },
        ],
      },
      holds: [],
      delivery: { reference: 'settlement-1', seller_stakeholder_id: 'SH-S', transfer_id: 'TR-1' },
      snapshot: null,
      accelerated_since_snapshot: null,
    });
  });

  it('converts vesting on terms with a snapshot and accelerations since it, and a stop', () => {
    const state = admittedState({
      vesting: { tag: 'StockVestingOnTerms', value: 'VT-1' },
      snapshot: { as_of: '2024-01-31', vested: '1000.5000000000' },
      accelerated_since_snapshot: '10.0000000000',
      holds: [
        {
          hold_id: 'stop-1',
          hold_type: 'OcfHoldTypeStopTransfer',
          reference: 'court-order-1',
          split_epoch: '0',
          quantity: null,
        },
      ],
    });

    expect(state.vesting).toEqual({ kind: 'on_terms', vesting_terms_id: 'VT-1' });
    expect(state.snapshot).toEqual({ as_of: '2024-01-31', vested: '1000.5' });
    expect(state.accelerated_since_snapshot).toBe('10');
    expect(state.holds).toEqual([
      { hold_id: 'stop-1', hold_type: 'STOP_TRANSFER', reference: 'court-order-1', split_epoch: 0, quantity: null },
    ]);
  });

  it.each<[string, Parameters<typeof stateEvent>[1]]>([
    ['an Int that is not one', { seq: '1.5' }],
    ['an Int beyond a safe integer', { seq: '9007199254740993' }],
    ['a date that is not a Daml Date', { last_event_date: '2024-02-01T00:00:00Z' }],
    [
      'an unknown hold type',
      { holds: [{ hold_id: 'h', hold_type: 'OcfHoldTypePledge', reference: 'r', split_epoch: '0', quantity: null }] },
    ],
    ['an unknown vesting constructor', { vesting: { tag: 'StockVestingSometimes', value: {} } }],
  ])('rejects a state with %s as an invalid payload', (_case, payload) => {
    expect(rejection(payload)).toMatchObject({ contractId: 'cid-state', reason: 'invalid_payload' });
  });

  it('names the field that does not decode', () => {
    expect(rejection({ seq: '1.5' }).message).toContain('createArgument.seq');
  });
});
