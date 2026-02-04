/**
 * Unit tests for transaction sorting utilities.
 *
 * Transaction ordering is correctness-critical for cap table verification.
 * The sorting logic ensures Canton transactions are processed in the same
 * order as DB-loaded transactions by the cap table engine.
 */

import { OcpValidationError } from '../../src/errors/OcpValidationError';
import {
  buildTransactionSortKey,
  getTimestampOrNull,
  sortTransactions,
  txWeight,
} from '../../src/utils/cantonOcfExtractor';

describe('getTimestampOrNull', () => {
  it('returns null for null input', () => {
    expect(getTimestampOrNull(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getTimestampOrNull(undefined)).toBeNull();
  });

  it('returns milliseconds for valid ISO date string', () => {
    const result = getTimestampOrNull('2025-03-15T10:30:00.000Z');
    expect(result).toBe(new Date('2025-03-15T10:30:00.000Z').getTime());
  });

  it('returns milliseconds for date-only string', () => {
    const result = getTimestampOrNull('2025-03-15');
    expect(result).toBe(new Date('2025-03-15').getTime());
  });

  it('returns the number directly for numeric input', () => {
    const ms = 1710502200000;
    expect(getTimestampOrNull(ms)).toBe(ms);
  });

  it('returns null for invalid date string', () => {
    expect(getTimestampOrNull('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTimestampOrNull('')).toBeNull();
  });
});

describe('txWeight', () => {
  it('returns weight 5 for administrative adjustments and return to pool', () => {
    expect(txWeight({ object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT' })).toBe(5);
    expect(txWeight({ object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT' })).toBe(5);
    expect(txWeight({ object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT' })).toBe(5);
    expect(txWeight({ object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL' })).toBe(5);
  });

  it('returns weight 10 for issuances', () => {
    expect(txWeight({ object_type: 'TX_STOCK_ISSUANCE' })).toBe(10);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' })).toBe(10);
    expect(txWeight({ object_type: 'TX_PLAN_SECURITY_ISSUANCE' })).toBe(10);
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_ISSUANCE' })).toBe(10);
    expect(txWeight({ object_type: 'TX_WARRANT_ISSUANCE' })).toBe(10);
  });

  it('returns weight 11 for acceptances', () => {
    expect(txWeight({ object_type: 'TX_STOCK_ACCEPTANCE' })).toBe(11);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE' })).toBe(11);
    expect(txWeight({ object_type: 'TX_PLAN_SECURITY_ACCEPTANCE' })).toBe(11);
  });

  it('returns weight 15 for splits', () => {
    expect(txWeight({ object_type: 'TX_STOCK_CLASS_SPLIT' })).toBe(15);
  });

  it('returns weight 16 for retractions (before transfers)', () => {
    expect(txWeight({ object_type: 'TX_STOCK_RETRACTION' })).toBe(16);
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_RETRACTION' })).toBe(16);
    expect(txWeight({ object_type: 'TX_WARRANT_RETRACTION' })).toBe(16);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_RETRACTION' })).toBe(16);
  });

  it('returns weight 20 for transfers', () => {
    expect(txWeight({ object_type: 'TX_STOCK_TRANSFER' })).toBe(20);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_TRANSFER' })).toBe(20);
    expect(txWeight({ object_type: 'TX_PLAN_SECURITY_TRANSFER' })).toBe(20);
  });

  it('returns weight 25 for releases', () => {
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_RELEASE' })).toBe(25);
  });

  it('returns weight 30 for exercises', () => {
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' })).toBe(30);
    expect(txWeight({ object_type: 'TX_PLAN_SECURITY_EXERCISE' })).toBe(30);
    expect(txWeight({ object_type: 'TX_WARRANT_EXERCISE' })).toBe(30);
  });

  it('returns weight 35 for conversions', () => {
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_CONVERSION' })).toBe(35);
    expect(txWeight({ object_type: 'TX_STOCK_CONVERSION' })).toBe(35);
  });

  it('returns weight 40 for repurchases and cancellations', () => {
    expect(txWeight({ object_type: 'TX_STOCK_REPURCHASE' })).toBe(40);
    expect(txWeight({ object_type: 'TX_STOCK_CANCELLATION' })).toBe(40);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION' })).toBe(40);
    expect(txWeight({ object_type: 'TX_PLAN_SECURITY_CANCELLATION' })).toBe(40);
    expect(txWeight({ object_type: 'TX_WARRANT_CANCELLATION' })).toBe(40);
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_CANCELLATION' })).toBe(40);
  });

  it('returns weight 45 for stakeholder events', () => {
    expect(txWeight({ object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT' })).toBe(45);
    expect(txWeight({ object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT' })).toBe(45);
  });

  it('returns weight 50 (default) for unknown types', () => {
    expect(txWeight({ object_type: 'TX_UNKNOWN_TYPE' })).toBe(50);
    expect(txWeight({ object_type: undefined })).toBe(50);
    expect(txWeight({})).toBe(50);
  });
});

describe('buildTransactionSortKey', () => {
  it('builds key with correct structure: day|weight|group|created|id', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      security_id: 'sec-456',
      createdAt: '2025-03-15T10:30:00.000Z',
    };

    const key = buildTransactionSortKey(tx);
    const parts = key.split('|');

    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('2025-03-15'); // day
    expect(parts[1]).toBe('010'); // weight (10 padded to 3 digits)
    expect(parts[2]).toBe('sec-456'); // security_id
    expect(parts[3]).toBe('2025-03-15T10:30:00.000Z'); // created
    expect(parts[4]).toBe('tx-123'); // id
  });

  it('uses _no_security_ for transactions without security_id', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    };

    const key = buildTransactionSortKey(tx);
    expect(key).toContain('|_no_security_|');
  });

  it('uses far-future timestamp when createdAt is missing', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
    };

    const key = buildTransactionSortKey(tx);
    expect(key).toContain('|9999-12-31T23:59:59.999Z|');
  });

  it('handles created_at (underscore) as fallback for createdAt', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      created_at: '2025-03-15T08:00:00.000Z',
    };

    const key = buildTransactionSortKey(tx);
    expect(key).toContain('|2025-03-15T08:00:00.000Z|');
  });

  it('throws OcpValidationError for missing date', () => {
    const tx = {
      id: 'tx-123',
      object_type: 'TX_STOCK_ISSUANCE',
    };

    expect(() => buildTransactionSortKey(tx)).toThrow(OcpValidationError);
    expect(() => buildTransactionSortKey(tx)).toThrow(/missing or invalid date/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/id: tx-123/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/object_type: TX_STOCK_ISSUANCE/);
  });

  it('throws OcpValidationError for invalid date', () => {
    const tx = {
      id: 'tx-456',
      date: 'not-a-valid-date',
      object_type: 'TX_STOCK_TRANSFER',
    };

    expect(() => buildTransactionSortKey(tx)).toThrow(OcpValidationError);
    expect(() => buildTransactionSortKey(tx)).toThrow(/missing or invalid date/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/id: tx-456/);
  });

  it('includes date value in error message', () => {
    const tx = {
      id: 'tx-789',
      date: 'invalid',
      object_type: 'TX_STOCK_ISSUANCE',
    };

    expect(() => buildTransactionSortKey(tx)).toThrow(OcpValidationError);
    expect(() => buildTransactionSortKey(tx)).toThrow(/"invalid"/);
  });
});

describe('sortTransactions', () => {
  it('sorts by date first', () => {
    const transactions = [
      { id: 'tx-3', date: '2025-03-17', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-2', date: '2025-03-16', object_type: 'TX_STOCK_ISSUANCE' },
    ];

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
  });

  it('sorts by weight within same day (issuance before exercise)', () => {
    const transactions = [
      { id: 'exercise', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' },
      { id: 'issuance', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' },
    ];

    const sorted = sortTransactions(transactions);

    // Issuance (weight 10) should come before exercise (weight 30)
    expect(sorted.map((tx) => tx.id)).toEqual(['issuance', 'exercise']);
  });

  it('sorts by weight within same day (adjustment before issuance before transfer)', () => {
    const transactions = [
      { id: 'transfer', date: '2025-03-15', object_type: 'TX_STOCK_TRANSFER' },
      { id: 'issuance', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'adjustment', date: '2025-03-15', object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT' },
    ];

    const sorted = sortTransactions(transactions);

    // adjustment (5) < issuance (10) < transfer (20)
    expect(sorted.map((tx) => tx.id)).toEqual(['adjustment', 'issuance', 'transfer']);
  });

  it('groups by security_id within same day and weight', () => {
    const transactions = [
      { id: 'tx-b1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE', security_id: 'sec-b' },
      { id: 'tx-a1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE', security_id: 'sec-a' },
      { id: 'tx-b2', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE', security_id: 'sec-b' },
      { id: 'tx-a2', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE', security_id: 'sec-a' },
    ];

    const sorted = sortTransactions(transactions);

    // sec-a comes before sec-b alphabetically, then by created timestamp / id
    expect(sorted[0].security_id).toBe('sec-a');
    expect(sorted[1].security_id).toBe('sec-a');
    expect(sorted[2].security_id).toBe('sec-b');
    expect(sorted[3].security_id).toBe('sec-b');
  });

  it('sorts by createdAt within same day, weight, and security_id', () => {
    const transactions = [
      {
        id: 'tx-late',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'sec-a',
        createdAt: '2025-03-15T14:00:00.000Z',
      },
      {
        id: 'tx-early',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'sec-a',
        createdAt: '2025-03-15T09:00:00.000Z',
      },
    ];

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual(['tx-early', 'tx-late']);
  });

  it('uses transaction id as final tiebreaker', () => {
    const transactions = [
      { id: 'tx-zzz', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-aaa', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
    ];

    const sorted = sortTransactions(transactions);

    // Without createdAt, both get far-future timestamp, so id is tiebreaker
    expect(sorted.map((tx) => tx.id)).toEqual(['tx-aaa', 'tx-zzz']);
  });

  it('returns empty array for empty input', () => {
    expect(sortTransactions([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const transactions = [{ id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' }];
    const sorted = sortTransactions(transactions);
    expect(sorted).toEqual(transactions);
  });

  it('does not mutate the original array', () => {
    const transactions = [
      { id: 'tx-2', date: '2025-03-16', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
    ];
    const original = [...transactions];

    sortTransactions(transactions);

    expect(transactions).toEqual(original);
  });

  it('handles complex real-world ordering scenario', () => {
    // Simulates a day with multiple transaction types that must be in correct order
    const transactions = [
      { id: 'cancel-1', date: '2025-03-15', object_type: 'TX_STOCK_CANCELLATION', security_id: 'sec-a' },
      { id: 'exercise-1', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_EXERCISE', security_id: 'sec-b' },
      { id: 'issuance-2', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE', security_id: 'sec-a' },
      { id: 'issuance-1', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE', security_id: 'sec-b' },
      { id: 'transfer-1', date: '2025-03-15', object_type: 'TX_STOCK_TRANSFER', security_id: 'sec-a' },
      { id: 'adjustment-1', date: '2025-03-15', object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT' },
    ];

    const sorted = sortTransactions(transactions);
    const ids = sorted.map((tx) => tx.id);

    // Expected order by weight:
    // 1. adjustment (5)
    // 2. issuances (10) - by security_id: sec-a before sec-b
    // 3. transfers (25)
    // 4. exercises (30)
    // 5. cancellations (40)
    expect(ids[0]).toBe('adjustment-1'); // weight 5
    expect(ids[1]).toBe('issuance-2'); // weight 10, sec-a
    expect(ids[2]).toBe('issuance-1'); // weight 10, sec-b
    expect(ids[3]).toBe('transfer-1'); // weight 25
    expect(ids[4]).toBe('exercise-1'); // weight 30
    expect(ids[5]).toBe('cancel-1'); // weight 40
  });
});
