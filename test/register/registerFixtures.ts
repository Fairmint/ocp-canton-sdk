import type { RecordedSplit, RegisterContext, StockSecurityState } from '../../src/types/register';

export const CONTEXT: RegisterContext = {
  cap_table_id: 'test-1',
  issuer: 'issuer::1220',
  system_operator: 'system-operator::1220',
  transfer_agent: 'transfer-agent::1220',
};

/** A fully vested stock state in class CLS-A with no holds; override any field. */
export function stockState(overrides: Partial<StockSecurityState> = {}): StockSecurityState {
  return {
    context: CONTEXT,
    security_id: 'S-A1',
    issue_date: '2024-01-01',
    last_event_date: '2024-01-01',
    origin_transaction_id: 'ISS-A1',
    quantity: '600',
    seq: 0,
    split_epoch: 0,
    stakeholder_id: 'SH-A',
    stock_class_id: 'CLS-A',
    vesting: { kind: 'none' },
    holds: [],
    delivery: null,
    snapshot: null,
    accelerated_since_snapshot: null,
    derived_ids: false,
    ...overrides,
  };
}

export function split(split_id: string, date: string, numerator: string, denominator: string): RecordedSplit {
  return { split_id, date, ratio: { numerator, denominator } };
}
