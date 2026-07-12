/**
 * Unit tests for transaction sorting utilities.
 *
 * Transaction ordering is correctness-critical for cap table verification.
 * The sorting logic ensures Canton transactions are processed in the same
 * order as DB-loaded transactions by the cap table engine.
 */

import { OcpErrorCodes } from '../../src/errors/codes';
import { toSafeDiagnosticValue } from '../../src/errors/OcpError';
import { OcpValidationError } from '../../src/errors/OcpValidationError';
import {
  buildTransactionSortKey,
  getTimestampOrNull,
  sortTransactions,
  txWeight,
  type SortableOcfTransaction,
} from '../../src/utils/cantonOcfExtractor';
import { requireDefined } from '../../src/utils/requireDefined';

function allPermutations<Value>(values: readonly Value[]): Value[][] {
  if (values.length < 2) return [[...values]];

  const permutations: Value[][] = [];
  for (const [index, value] of values.entries()) {
    const remaining = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const permutation of allPermutations(remaining)) {
      permutations.push([value, ...permutation]);
    }
  }
  return permutations;
}

function encodeKeyComponent(value: string): string {
  return [...value]
    .flatMap((character) => {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined) return [];
      if (codePoint <= 0xffff) return [codePoint.toString(16).padStart(4, '0')];
      const offset = codePoint - 0x10000;
      return [
        (0xd800 + (offset >> 10)).toString(16).padStart(4, '0'),
        (0xdc00 + (offset & 0x3ff)).toString(16).padStart(4, '0'),
      ];
    })
    .join('');
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function shuffled<Value>(values: readonly Value[], random: () => number): Value[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = requireDefined(result[index], `shuffle index ${index}`);
    result[index] = requireDefined(result[swapIndex], `shuffle index ${swapIndex}`);
    result[swapIndex] = current;
  }
  return result;
}

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

  it.each([NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE])(
    'returns null for a numeric input outside the Date timestamp range: %s',
    (value) => {
      expect(getTimestampOrNull(value)).toBeNull();
    }
  );
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
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_ISSUANCE' })).toBe(10);
    expect(txWeight({ object_type: 'TX_WARRANT_ISSUANCE' })).toBe(10);
  });

  it('moves an issuance produced by a parent transaction after conversions and exercises', () => {
    const resultSecurityIds = new Set(['result-security']);

    expect(txWeight({ object_type: 'TX_STOCK_ISSUANCE', security_id: 'result-security' }, resultSecurityIds)).toBe(36);
    expect(txWeight({ object_type: 'TX_STOCK_ISSUANCE', security_id: 'unrelated-security' }, resultSecurityIds)).toBe(
      10
    );
    expect(txWeight({ object_type: 'TX_STOCK_CANCELLATION', security_id: 'result-security' }, resultSecurityIds)).toBe(
      40
    );
  });

  it('returns weight 11 for acceptances', () => {
    expect(txWeight({ object_type: 'TX_STOCK_ACCEPTANCE' })).toBe(11);
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE' })).toBe(11);
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
  });

  it('returns weight 25 for releases', () => {
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_RELEASE' })).toBe(25);
  });

  it('returns weight 30 for exercises', () => {
    expect(txWeight({ object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' })).toBe(30);
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
    expect(txWeight({ object_type: 'TX_WARRANT_CANCELLATION' })).toBe(40);
    expect(txWeight({ object_type: 'TX_CONVERTIBLE_CANCELLATION' })).toBe(40);
  });

  it('returns weight 45 for stakeholder events', () => {
    expect(txWeight({ object_type: 'CE_STAKEHOLDER_RELATIONSHIP' })).toBe(45);
    expect(txWeight({ object_type: 'CE_STAKEHOLDER_STATUS' })).toBe(45);
  });

  it('returns weight 50 (default) for unknown types', () => {
    expect(txWeight({ object_type: 'TX_UNKNOWN_TYPE' })).toBe(50);
    expect(txWeight({ object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT' })).toBe(50);
    expect(txWeight({ object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT' })).toBe(50);
    for (const objectType of [
      'TX_PLAN_SECURITY_ACCEPTANCE',
      'TX_PLAN_SECURITY_CANCELLATION',
      'TX_PLAN_SECURITY_EXERCISE',
      'TX_PLAN_SECURITY_ISSUANCE',
      'TX_PLAN_SECURITY_RELEASE',
      'TX_PLAN_SECURITY_RETRACTION',
      'TX_PLAN_SECURITY_TRANSFER',
    ]) {
      expect(txWeight({ object_type: objectType })).toBe(50);
    }
    expect(txWeight({ object_type: undefined })).toBe(50);
    expect(txWeight({})).toBe(50);
  });
});

describe('buildTransactionSortKey', () => {
  it('builds an opaque key with encoded day/weight/group/created/id components', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      security_id: 'sec-456',
      createdAt: '2025-03-15T10:30:00.000Z',
    };

    const key = buildTransactionSortKey(tx);
    const parts = key.split('/');

    expect(parts).toEqual(
      ['2025-03-15', '010', 'sec-456', '2025-03-15T10:30:00.000Z', 'tx-123'].map(encodeKeyComponent)
    );
  });

  it('uses _no_security_ for transactions without security_id', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    };

    const key = buildTransactionSortKey(tx);
    expect(key.split('/')[2]).toBe(encodeKeyComponent('_no_security_'));
  });

  it('uses far-future timestamp when createdAt is missing', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
    };

    const key = buildTransactionSortKey(tx);
    expect(key.split('/')[3]).toBe(encodeKeyComponent('9999-12-31T23:59:59.999Z'));
  });

  it.each([NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE])(
    'uses the far-future timestamp when createdAt is outside the Date timestamp range: %s',
    (createdAt) => {
      const key = buildTransactionSortKey({
        id: 'tx-123',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        createdAt,
      });

      expect(key.split('/')[3]).toBe(encodeKeyComponent('9999-12-31T23:59:59.999Z'));
    }
  );

  it('handles created_at (underscore) as fallback for createdAt', () => {
    const tx = {
      id: 'tx-123',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      created_at: '2025-03-15T08:00:00.000Z',
    };

    const key = buildTransactionSortKey(tx);
    expect(key.split('/')[3]).toBe(encodeKeyComponent('2025-03-15T08:00:00.000Z'));
  });

  it('throws OcpValidationError for missing date', () => {
    const tx = {
      id: 'tx-123',
      object_type: 'TX_STOCK_ISSUANCE',
    };

    expect(() => buildTransactionSortKey(tx)).toThrow(OcpValidationError);
    expect(() => buildTransactionSortKey(tx)).toThrow(/missing date/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/id: "tx-123"/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/object_type: "TX_STOCK_ISSUANCE"/);

    try {
      buildTransactionSortKey(tx);
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'tx.date',
        receivedValue: undefined,
      });
    }
  });

  it('classifies an explicit null date as missing', () => {
    try {
      buildTransactionSortKey({ id: 'tx-null-date', date: null, object_type: 'TX_STOCK_ISSUANCE' });
      throw new Error('Expected buildTransactionSortKey to reject the transaction date');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'tx.date',
        receivedValue: null,
      });
    }
  });

  it('throws OcpValidationError for invalid date', () => {
    const tx = {
      id: 'tx-456',
      date: 'not-a-valid-date',
      object_type: 'TX_STOCK_TRANSFER',
    };

    expect(() => buildTransactionSortKey(tx)).toThrow(OcpValidationError);
    expect(() => buildTransactionSortKey(tx)).toThrow(/invalid date/);
    expect(() => buildTransactionSortKey(tx)).toThrow(/id: "tx-456"/);

    try {
      buildTransactionSortKey(tx);
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'tx.date',
        receivedValue: 'not-a-valid-date',
      });
    }
  });

  it.each(['2023-02-29', '2024-02-30', '2024-13-01'])('rejects impossible calendar date %s', (date) => {
    expect(() => buildTransactionSortKey({ id: 'tx-invalid-date', date, object_type: 'TX_STOCK_ISSUANCE' })).toThrow(
      OcpValidationError
    );

    try {
      buildTransactionSortKey({ id: 'tx-invalid-date', date, object_type: 'TX_STOCK_ISSUANCE' });
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'tx.date',
        receivedValue: date,
      });
    }
  });

  it('accepts a valid leap day', () => {
    expect(buildTransactionSortKey({ id: 'tx-leap', date: '2024-02-29' }).split('/')[0]).toBe(
      encodeKeyComponent('2024-02-29')
    );
  });

  it.each([0, 1710502200000, {}, true, 1n, Symbol('date')])('rejects non-string transaction date %p', (date) => {
    try {
      buildTransactionSortKey({ id: 'tx-invalid-type', date, object_type: 'TX_STOCK_ISSUANCE' });
      throw new Error('Expected buildTransactionSortKey to reject the transaction date');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      const validationError = error as OcpValidationError;
      expect(validationError.code).toBe(OcpErrorCodes.INVALID_TYPE);
      expect(validationError.fieldPath).toBe('tx.date');
      expect(validationError.receivedValue).toEqual(toSafeDiagnosticValue(date));
      expect(validationError.message.length).toBeLessThan(500);
    }
  });

  it('preserves the lexical calendar day of an offset date-time', () => {
    const key = buildTransactionSortKey({
      id: 'tx-offset',
      date: '2024-01-15T23:30:00-05:00',
      object_type: 'TX_STOCK_ISSUANCE',
    });

    expect(key.split('/')[0]).toBe(encodeKeyComponent('2024-01-15'));
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

  it('bounds arbitrary transaction values in invalid-date diagnostics', () => {
    const longValue = 'x'.repeat(20_000);

    try {
      buildTransactionSortKey({ id: longValue, object_type: longValue, date: longValue });
      throw new Error('Expected buildTransactionSortKey to reject the transaction date');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      const validationError = error as OcpValidationError;
      expect(validationError.code).toBe(OcpErrorCodes.INVALID_FORMAT);
      expect(validationError.fieldPath).toBe('tx.date');
      expect(validationError.receivedValue).toEqual(toSafeDiagnosticValue(longValue));
      expect(validationError.receivedValue).not.toBe(longValue);
      expect(validationError.message.length).toBeLessThan(500);
    }
  });
});

describe('sortTransactions', () => {
  it('sorts by date first', () => {
    const transactions = [
      { id: 'tx-3', date: '2025-03-17', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-2', date: '2025-03-16', object_type: 'TX_STOCK_ISSUANCE' },
    ] as const;

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
  });

  it('sorts by weight within same day (issuance before exercise)', () => {
    const transactions = [
      { id: 'exercise', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' },
      { id: 'issuance', date: '2025-03-15', object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' },
    ] as const;

    const sorted = sortTransactions(transactions);

    // Issuance (weight 10) should come before exercise (weight 30)
    expect(sorted.map((tx) => tx.id)).toEqual(['issuance', 'exercise']);
  });

  it('sorts by weight within same day (adjustment before issuance before transfer)', () => {
    const transactions = [
      { id: 'transfer', date: '2025-03-15', object_type: 'TX_STOCK_TRANSFER' },
      { id: 'issuance', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'adjustment', date: '2025-03-15', object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT' },
    ] as const;

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
    ] as const;

    const sorted = sortTransactions(transactions);

    // sec-a comes before sec-b alphabetically, then by created timestamp / id
    expect(requireDefined(sorted[0], 'first sorted transaction').security_id).toBe('sec-a');
    expect(requireDefined(sorted[1], 'second sorted transaction').security_id).toBe('sec-a');
    expect(requireDefined(sorted[2], 'third sorted transaction').security_id).toBe('sec-b');
    expect(requireDefined(sorted[3], 'fourth sorted transaction').security_id).toBe('sec-b');
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
    ] as const;

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual(['tx-early', 'tx-late']);
  });

  it('uses transaction id as final tiebreaker', () => {
    const transactions = [
      { id: 'tx-zzz', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-aaa', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
    ] as const;

    const sorted = sortTransactions(transactions);

    // Without createdAt, both get far-future timestamp, so id is tiebreaker
    expect(sorted.map((tx) => tx.id)).toEqual(['tx-aaa', 'tx-zzz']);
  });

  it('keeps exact canonical-key ties stable and lossless', () => {
    const first = {
      id: 'duplicate-id',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ACCEPTANCE',
      security_id: 'same-security',
      marker: 'first',
    } as const;
    const second = { ...first, marker: 'second' } as const;

    const forward = sortTransactions([first, second]);
    const reverse = sortTransactions([second, first]);

    expect(forward).toHaveLength(2);
    expect(forward[0]).toBe(first);
    expect(forward[1]).toBe(second);
    expect(reverse).toHaveLength(2);
    expect(reverse[0]).toBe(second);
    expect(reverse[1]).toBe(first);
  });

  it('uses stable UTF-16 code-unit ordering instead of locale-dependent collation', () => {
    const transactions = [
      { id: 'tx-ä', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-z', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['tx-z', 'tx-ä']);
  });

  it('keeps distinct component tuples collision-free when ids contain the legacy separator', () => {
    const groupContainsCreated = {
      id: 'id',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      security_id: 'sec|2025-03-15T10:00:00.000Z',
      createdAt: '2025-03-15T11:00:00.000Z',
    } as const;
    const idContainsCreated = {
      id: '2025-03-15T11:00:00.000Z|id',
      date: '2025-03-15',
      object_type: 'TX_STOCK_ISSUANCE',
      security_id: 'sec',
      createdAt: '2025-03-15T10:00:00.000Z',
    } as const;
    const expected = [idContainsCreated.id, groupContainsCreated.id];

    expect(buildTransactionSortKey(groupContainsCreated)).not.toBe(buildTransactionSortKey(idContainsCreated));
    expect(sortTransactions([groupContainsCreated, idContainsCreated]).map((tx) => tx.id)).toEqual(expected);
    expect(sortTransactions([idContainsCreated, groupContainsCreated]).map((tx) => tx.id)).toEqual(expected);
  });

  it('sorts a retroactive vesting start after the issuance while preserving its original date', () => {
    const transactions = [
      {
        id: 'vesting-start',
        date: '2025-07-27',
        object_type: 'TX_VESTING_START',
        security_id: 'option-1',
      },
      {
        id: 'issuance',
        date: '2025-10-27',
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        security_id: 'option-1',
      },
    ] as const;

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual(['issuance', 'vesting-start']);
    expect(sorted[1]?.date).toBe('2025-07-27');
  });

  it('uses the latest duplicate issuance day for retroactive vesting across every input permutation', () => {
    const transactions = [
      {
        id: 'earlier-issuance',
        date: '2025-10-01',
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        security_id: 'duplicate-security',
      },
      {
        id: 'later-issuance',
        date: '2025-11-01',
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        security_id: 'duplicate-security',
      },
      {
        id: 'retroactive-vesting',
        date: '2025-07-01',
        object_type: 'TX_VESTING_START',
        security_id: 'duplicate-security',
      },
      {
        id: 'between-days',
        date: '2025-10-15',
        object_type: 'TX_STOCK_CANCELLATION',
        security_id: 'unrelated-security',
      },
    ] as const;
    const expected = ['earlier-issuance', 'between-days', 'later-issuance', 'retroactive-vesting'];

    for (const permutation of allPermutations(transactions)) {
      expect(sortTransactions(permutation).map((tx) => tx.id)).toEqual(expected);
    }
  });

  it.each([
    'TX_CONVERTIBLE_CONVERSION',
    'TX_WARRANT_EXERCISE',
    'TX_EQUITY_COMPENSATION_EXERCISE',
    'TX_EQUITY_COMPENSATION_RELEASE',
    'TX_STOCK_TRANSFER',
    'TX_STOCK_CONVERSION',
    'TX_CONVERTIBLE_TRANSFER',
    'TX_WARRANT_TRANSFER',
    'TX_EQUITY_COMPENSATION_TRANSFER',
    'TX_STOCK_REISSUANCE',
  ] as const)('sorts a resulting issuance and its same-day vesting after canonical parent %s', (parentObjectType) => {
    const transactions = [
      {
        id: 'vesting-start',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'result-security',
      },
      {
        id: 'result-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'result-security',
      },
      {
        id: 'parent',
        date: '2025-03-15',
        object_type: parentObjectType,
        security_id: 'source-security',
        resulting_security_ids: ['result-security'],
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['parent', 'result-issuance', 'vesting-start']);
  });

  it('keeps singular-result consolidation, child issuance, and child events dependency-ordered', () => {
    const transactions = [
      {
        id: 'child-vesting-z',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'consolidated-security',
        createdAt: '2025-03-15T12:00:00.000Z',
      },
      {
        id: 'result-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'consolidated-security',
      },
      {
        id: 'child-acceptance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ACCEPTANCE',
        security_id: 'consolidated-security',
      },
      {
        id: 'child-exercise',
        date: '2025-03-15',
        object_type: 'TX_WARRANT_EXERCISE',
        security_id: 'consolidated-security',
        resulting_security_ids: ['exercise-result'],
      },
      {
        id: 'unrelated-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'unrelated-security',
      },
      {
        id: 'unrelated-vesting',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'unrelated-security',
      },
      {
        id: 'consolidation',
        date: '2025-03-15',
        object_type: 'TX_STOCK_CONSOLIDATION',
        resulting_security_id: 'consolidated-security',
      },
      {
        id: 'child-vesting-a',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'consolidated-security',
        createdAt: '2025-03-15T12:00:00.000Z',
      },
      {
        id: 'child-vesting-event',
        date: '2025-03-15',
        object_type: 'TX_VESTING_EVENT',
        security_id: 'consolidated-security',
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual([
      'unrelated-issuance',
      'unrelated-vesting',
      'consolidation',
      'result-issuance',
      'child-acceptance',
      'child-vesting-a',
      'child-vesting-z',
      'child-vesting-event',
      'child-exercise',
    ]);
  });

  it('places retroactive child vesting immediately after its plural-result issuance', () => {
    const transactions = [
      {
        id: 'retroactive-vesting-start',
        date: '2025-07-27',
        object_type: 'TX_VESTING_START',
        security_id: 'converted-security',
      },
      {
        id: 'result-issuance',
        date: '2025-10-27',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'converted-security',
      },
      {
        id: 'conversion',
        date: '2025-10-27',
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        security_id: 'convertible-security',
        resulting_security_ids: ['converted-security'],
      },
      {
        id: 'later-cancellation',
        date: '2025-10-27',
        object_type: 'TX_STOCK_CANCELLATION',
        security_id: 'unrelated-security',
      },
    ] as const;

    const sorted = sortTransactions(transactions);

    expect(sorted.map((tx) => tx.id)).toEqual([
      'conversion',
      'result-issuance',
      'retroactive-vesting-start',
      'later-cancellation',
    ]);
    expect(sorted[2]?.date).toBe('2025-07-27');
  });

  it('orders a nested same-day result chain before actions on each child security', () => {
    const transactions = [
      {
        id: 'final-vesting',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'final-security',
      },
      {
        id: 'second-parent',
        date: '2025-03-15',
        object_type: 'TX_STOCK_CONVERSION',
        security_id: 'intermediate-security',
        resulting_security_ids: ['final-security'],
      },
      {
        id: 'final-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'final-security',
      },
      {
        id: 'first-parent',
        date: '2025-03-15',
        object_type: 'TX_WARRANT_EXERCISE',
        security_id: 'source-security',
        resulting_security_ids: ['intermediate-security'],
      },
      {
        id: 'intermediate-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'intermediate-security',
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual([
      'first-parent',
      'intermediate-issuance',
      'second-parent',
      'final-issuance',
      'final-vesting',
    ]);
  });

  it('keeps a later-day result issuance before its same-day actions without crossing day boundaries', () => {
    const transactions = [
      {
        id: 'child-acceptance',
        date: '2025-03-16',
        object_type: 'TX_STOCK_ACCEPTANCE',
        security_id: 'result-security',
      },
      {
        id: 'parent',
        date: '2025-03-15',
        object_type: 'TX_STOCK_TRANSFER',
        security_id: 'source-security',
        resulting_security_ids: ['result-security'],
      },
      {
        id: 'child-issuance',
        date: '2025-03-16',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'result-security',
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['parent', 'child-issuance', 'child-acceptance']);
  });

  it('produces the same dependency and tie order for every input permutation', () => {
    const transactions = [
      {
        id: 'vesting-z',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'result-security',
        createdAt: '2025-03-15T12:00:00.000Z',
      },
      {
        id: 'parent',
        date: '2025-03-15',
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        security_id: 'source-security',
        resulting_security_ids: ['result-security'],
      },
      {
        id: 'child-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'result-security',
      },
      {
        id: 'vesting-a',
        date: '2025-03-15',
        object_type: 'TX_VESTING_START',
        security_id: 'result-security',
        createdAt: '2025-03-15T12:00:00.000Z',
      },
      {
        id: 'unrelated-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'unrelated-security',
      },
    ] as const;
    for (const permutation of allPermutations(transactions)) {
      expect(sortTransactions(permutation).map((tx) => tx.id)).toEqual([
        'unrelated-issuance',
        'parent',
        'child-issuance',
        'vesting-a',
        'vesting-z',
      ]);
    }
  });

  it('keeps 500 seeded randomized dependency graphs lossless and permutation-independent', () => {
    const masterSeed = 0x5eedc0de;
    const parentTypes = [
      'TX_CONVERTIBLE_CONVERSION',
      'TX_WARRANT_EXERCISE',
      'TX_EQUITY_COMPENSATION_RELEASE',
      'TX_STOCK_TRANSFER',
      'TX_STOCK_CONVERSION',
      'TX_CONVERTIBLE_TRANSFER',
      'TX_WARRANT_TRANSFER',
      'TX_EQUITY_COMPENSATION_TRANSFER',
      'TX_STOCK_REISSUANCE',
    ] as const;
    const actionTypes = ['TX_STOCK_ACCEPTANCE', 'TX_VESTING_START', 'TX_VESTING_EVENT'] as const;

    for (let caseIndex = 0; caseIndex < 500; caseIndex += 1) {
      const caseSeed = (masterSeed ^ Math.imul(caseIndex + 1, 0x9e3779b1)) >>> 0;
      const random = seededRandom(caseSeed);
      const nodeCount = 3 + Math.floor(random() * 5);
      const transactions: SortableOcfTransaction[] = [];
      const dependencies: Array<readonly [before: string, after: string]> = [];

      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
        const securityId = `security-${caseIndex}-${nodeIndex}`;
        const issuanceId = `issuance-${caseIndex}-${nodeIndex}`;
        const actionId = `action-${caseIndex}-${nodeIndex}`;
        transactions.push({
          id: issuanceId,
          date: '2025-03-15',
          object_type: 'TX_STOCK_ISSUANCE',
          security_id: securityId,
        });
        transactions.push({
          id: actionId,
          date: '2025-03-15',
          object_type: requireDefined(
            actionTypes[Math.floor(random() * actionTypes.length)],
            `action type for seed ${caseSeed}`
          ),
          security_id: securityId,
        });
        dependencies.push([issuanceId, actionId]);

        if (nodeIndex === 0) continue;
        const sourceIndex = Math.floor(random() * nodeIndex);
        const parentId = `parent-${caseIndex}-${nodeIndex}`;
        transactions.push({
          id: parentId,
          date: '2025-03-15',
          object_type: requireDefined(
            parentTypes[Math.floor(random() * parentTypes.length)],
            `parent type for seed ${caseSeed}`
          ),
          security_id: `security-${caseIndex}-${sourceIndex}`,
          resulting_security_ids: [securityId],
        });
        dependencies.push([parentId, issuanceId]);
      }

      try {
        const expectedIds = sortTransactions(transactions).map(({ id }) => id);
        const firstIds = sortTransactions(shuffled(transactions, random)).map(({ id }) => id);
        const secondIds = sortTransactions(shuffled(transactions, random)).map(({ id }) => id);

        expect(firstIds).toEqual(expectedIds);
        expect(secondIds).toEqual(expectedIds);
        expect(new Set(expectedIds).size).toBe(transactions.length);
        expect([...expectedIds].sort()).toEqual(transactions.map(({ id }) => id).sort());

        const positions = new Map(expectedIds.map((id, index) => [id, index]));
        for (const [before, after] of dependencies) {
          expect(requireDefined(positions.get(before), `${before} position`)).toBeLessThan(
            requireDefined(positions.get(after), `${after} position`)
          );
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Seeded sorter graph failed: masterSeed=${masterSeed}, caseIndex=${caseIndex}, caseSeed=${caseSeed}, nodes=${nodeCount}: ${detail}`
        );
      }
    }
  });

  it('orders a self-referential result deterministically without creating a dependency cycle', () => {
    const transactions = [
      {
        id: 'acceptance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ACCEPTANCE',
        security_id: 'same-security',
      },
      {
        id: 'issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'same-security',
      },
      {
        id: 'self-parent',
        date: '2025-03-15',
        object_type: 'TX_STOCK_CONVERSION',
        security_id: 'same-security',
        resulting_security_ids: ['same-security'],
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['self-parent', 'issuance', 'acceptance']);
  });

  it('breaks a cyclic result graph at the deterministic baseline node', () => {
    const transactions = [
      {
        id: 'parent-a',
        date: '2025-03-15',
        object_type: 'TX_STOCK_CONVERSION',
        security_id: 'security-a',
        resulting_security_ids: ['security-b'],
      },
      {
        id: 'issuance-b',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'security-b',
      },
      {
        id: 'parent-b',
        date: '2025-03-15',
        object_type: 'TX_STOCK_CONVERSION',
        security_id: 'security-b',
        resulting_security_ids: ['security-a'],
      },
      {
        id: 'issuance-a',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'security-a',
      },
    ] as const;
    const expected = ['parent-a', 'issuance-b', 'parent-b', 'issuance-a'];

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(expected);
    expect(sortTransactions([...transactions].reverse()).map((tx) => tx.id)).toEqual(expected);
  });

  it.each([
    'TX_STOCK_CANCELLATION',
    'TX_WARRANT_CANCELLATION',
    'TX_CONVERTIBLE_CANCELLATION',
    'TX_EQUITY_COMPENSATION_CANCELLATION',
    'TX_STOCK_REPURCHASE',
  ] as const)('orders balance issuance and action after balance-only parent %s', (parentObjectType) => {
    const transactions = [
      {
        id: 'balance-action',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ACCEPTANCE',
        security_id: 'balance-security',
      },
      {
        id: 'balance-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'balance-security',
      },
      {
        id: 'parent',
        date: '2025-03-15',
        object_type: parentObjectType,
        security_id: 'source-security',
        balance_security_id: 'balance-security',
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['parent', 'balance-issuance', 'balance-action']);
  });

  it('sorts a transfer balance issuance after the parent transfer', () => {
    const transactions = [
      {
        id: 'balance-issuance',
        date: '2025-03-15',
        object_type: 'TX_STOCK_ISSUANCE',
        security_id: 'balance-security',
      },
      {
        id: 'transfer',
        date: '2025-03-15',
        object_type: 'TX_STOCK_TRANSFER',
        security_id: 'source-security',
        balance_security_id: 'balance-security',
      },
    ] as const;

    expect(sortTransactions(transactions).map((tx) => tx.id)).toEqual(['transfer', 'balance-issuance']);
  });

  it('returns empty array for empty input', () => {
    expect(sortTransactions([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const transactions = [{ id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' }] as const;
    const sorted = sortTransactions(transactions);
    expect(sorted).toEqual(transactions);
  });

  it('does not mutate the original array', () => {
    const transactions = [
      { id: 'tx-2', date: '2025-03-16', object_type: 'TX_STOCK_ISSUANCE' },
      { id: 'tx-1', date: '2025-03-15', object_type: 'TX_STOCK_ISSUANCE' },
    ] as const;
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
    ] as const;

    const sorted = sortTransactions(transactions);
    const ids = sorted.map((tx) => tx.id);

    // Expected order by weight:
    // 1. adjustment (5)
    // 2. issuances (10) - by security_id: sec-a before sec-b
    // 3. transfers (20)
    // 4. exercises (30)
    // 5. cancellations (40)
    expect(ids[0]).toBe('adjustment-1'); // weight 5
    expect(ids[1]).toBe('issuance-2'); // weight 10, sec-a
    expect(ids[2]).toBe('issuance-1'); // weight 10, sec-b
    expect(ids[3]).toBe('transfer-1'); // weight 20
    expect(ids[4]).toBe('exercise-1'); // weight 30
    expect(ids[5]).toBe('cancel-1'); // weight 40
  });
});
