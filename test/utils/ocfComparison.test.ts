/** Tests for OCF comparison utilities */

import { diffOcfObjects, ocfCompare, ocfDeepEqual } from '../../src/utils/ocfComparison';

describe('ocfDeepEqual', () => {
  test('returns true for identical objects', () => {
    const obj = { id: 'test-1', name: 'Test', quantity: '100' };
    expect(ocfDeepEqual(obj, { ...obj })).toBe(true);
  });

  test('returns true for numeric strings with different precision', () => {
    expect(ocfDeepEqual({ quantity: '100' }, { quantity: '100.0000000000' })).toBe(true);
    expect(ocfDeepEqual({ quantity: '100.5' }, { quantity: '100.5' })).toBe(true);
  });

  test('returns true when comparing undefined to empty array', () => {
    expect(ocfDeepEqual({ items: undefined }, { items: [] })).toBe(true);
    expect(ocfDeepEqual({ items: [] }, { items: undefined })).toBe(true);
  });

  test('returns true when comparing undefined to empty object', () => {
    expect(ocfDeepEqual({ data: undefined }, { data: {} })).toBe(true);
  });

  test('returns true for whitespace-trimmed strings', () => {
    expect(ocfDeepEqual({ name: 'Test' }, { name: '  Test  ' })).toBe(true);
  });

  test('returns false for different values', () => {
    expect(ocfDeepEqual({ quantity: '100' }, { quantity: '200' })).toBe(false);
  });

  test('returns true for number vs equivalent numeric string (DB JSONB vs DAML readback)', () => {
    // DB JSONB stores numbers as JS numbers, DAML readback returns strings
    expect(ocfDeepEqual({ value: 100 }, { value: '100' })).toBe(true);
    expect(ocfDeepEqual({ value: '100' }, { value: 100 })).toBe(true);
    expect(ocfDeepEqual({ value: 22500 }, { value: '22500' })).toBe(true);
    expect(ocfDeepEqual({ value: 35000 }, { value: '35000' })).toBe(true);
    expect(ocfDeepEqual({ value: 100.5 }, { value: '100.5' })).toBe(true);
  });

  test('returns false for number vs non-equivalent string', () => {
    expect(ocfDeepEqual({ value: 100 }, { value: 'abc' })).toBe(false);
    expect(ocfDeepEqual({ value: 100 }, { value: '200' })).toBe(false);
  });

  test('handles nested number vs string comparison', () => {
    // Simulates purchase_price.amount stored as number in DB vs string from Canton
    const dbData = {
      purchase_price: { amount: 22500, currency: 'USD' },
      exercise_triggers: [
        {
          conversion_right: {
            conversion_mechanism: { converts_to_quantity: 22500 },
          },
        },
      ],
    };
    const cantonData = {
      purchase_price: { amount: '22500', currency: 'USD' },
      exercise_triggers: [
        {
          conversion_right: {
            conversion_mechanism: { converts_to_quantity: '22500' },
          },
        },
      ],
    };
    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('handles nested objects correctly', () => {
    const a = { issuer: { id: 'test', name: { legal_name: 'Test Corp' } } };
    const b = { issuer: { id: 'test', name: { legal_name: 'Test Corp' } } };
    expect(ocfDeepEqual(a, b)).toBe(true);
  });

  test('handles zero share ranges as undefined-like', () => {
    expect(
      ocfDeepEqual(
        { share_numbers: [{ starting_share_number: 0, ending_share_number: 0 }] },
        { share_numbers: undefined }
      )
    ).toBe(true);
  });

  test('treats omitted remainder and false as equivalent', () => {
    expect(
      ocfDeepEqual(
        { portion: { numerator: '1', denominator: '4' } },
        { portion: { numerator: '1', denominator: '4', remainder: false } }
      )
    ).toBe(true);
    expect(
      ocfDeepEqual(
        { portion: { numerator: '1', denominator: '4', remainder: false } },
        { portion: { numerator: '1', denominator: '4' } }
      )
    ).toBe(true);
  });

  test('remainder: true is NOT equivalent to omitted or false', () => {
    // remainder: true should NOT match omitted remainder
    expect(ocfDeepEqual({ portion: { remainder: true } }, { portion: {} })).toBe(false);
    // remainder: true should NOT match remainder: false
    expect(ocfDeepEqual({ portion: { remainder: true } }, { portion: { remainder: false } })).toBe(false);
  });
});

describe('date normalization', () => {
  test('returns true for date-only vs ISO timestamp with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T00:00:00.000Z' })).toBe(true);
  });

  test('returns true for ISO timestamp vs date-only with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15T12:30:00Z' }, { date: '2024-01-15' })).toBe(true);
  });

  test('returns true for two identical date-only strings', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15' })).toBe(true);
  });

  test('returns true for two ISO timestamps with same date', () => {
    expect(ocfDeepEqual({ date: '2024-01-15T00:00:00.000Z' }, { date: '2024-01-15T12:30:00Z' })).toBe(true);
  });

  test('returns false for different dates', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-16' })).toBe(false);
  });

  test('handles nested date fields in transaction-like objects', () => {
    const dbData = {
      id: 'tx-1',
      date: '2024-08-14T00:00:00.000Z',
      security_id: 'sec-1',
    };
    const cantonData = {
      id: 'tx-1',
      date: '2024-08-14',
      security_id: 'sec-1',
    };
    expect(ocfDeepEqual(dbData, cantonData)).toBe(true);
  });

  test('handles date in array elements', () => {
    const a = { items: [{ date: '2024-01-15T00:00:00.000Z' }] };
    const b = { items: [{ date: '2024-01-15' }] };
    expect(ocfDeepEqual(a, b)).toBe(true);
  });

  test('does not treat non-date strings as dates', () => {
    expect(ocfDeepEqual({ val: 'hello' }, { val: 'hello' })).toBe(true);
    expect(ocfDeepEqual({ val: 'hello' }, { val: 'world' })).toBe(false);
  });

  test('does not match date-prefixed IDs as dates', () => {
    // Strings starting with YYYY-MM-DD but without valid time suffix
    // must NOT be normalized as dates (could be IDs, codes, etc.)
    expect(ocfDeepEqual({ id: '2024-01-15TICKET' }, { id: '2024-01-15TICKET' })).toBe(true);
    expect(ocfDeepEqual({ id: '2024-01-15TICKET' }, { id: '2024-01-15' })).toBe(false);
    expect(ocfDeepEqual({ id: '2024-01-15Tabc' }, { id: '2024-01-15' })).toBe(false);
  });

  test('handles date with timezone offset', () => {
    expect(ocfDeepEqual({ date: '2024-01-15' }, { date: '2024-01-15T12:00:00+05:00' })).toBe(true);
  });
});

describe('ocfCompare', () => {
  test('reports no differences for number vs equivalent string', () => {
    const result = ocfCompare({ amount: 22500 }, { amount: '22500' });
    expect(result.equal).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  test('reports differences for actually different values', () => {
    const result = ocfCompare({ amount: '100' }, { amount: '200' });
    expect(result.equal).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });

  test('reports no differences for date format variations', () => {
    const result = ocfCompare({ date: '2024-08-14T00:00:00.000Z' }, { date: '2024-08-14' });
    expect(result.equal).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  test('reports differences for different dates', () => {
    const result = ocfCompare({ date: '2024-08-14' }, { date: '2024-08-15' });
    expect(result.equal).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });
});

describe('diffOcfObjects', () => {
  test('returns no diffs for number vs equivalent string', () => {
    const diffs = diffOcfObjects({ amount: 22500 }, { amount: '22500' });
    expect(diffs).toHaveLength(0);
  });

  test('returns diffs for number vs non-equivalent string', () => {
    const diffs = diffOcfObjects({ value: 100 }, { value: 'abc' });
    expect(diffs.length).toBeGreaterThan(0);
  });

  test('handles nested number/string equivalence', () => {
    const a = { purchase_price: { amount: 22500, currency: 'USD' } };
    const b = { purchase_price: { amount: '22500', currency: 'USD' } };
    const diffs = diffOcfObjects(a, b);
    expect(diffs).toHaveLength(0);
  });

  test('treats omitted remainder and false as no diff', () => {
    const a = { vesting_conditions: [{ portion: { numerator: '1', denominator: '4' } }] };
    const b = { vesting_conditions: [{ portion: { numerator: '1', denominator: '4', remainder: false } }] };
    const diffs = diffOcfObjects(a, b);
    expect(diffs).toHaveLength(0);
  });

  test('returns no diffs for date format variations', () => {
    const diffs = diffOcfObjects({ date: '2024-08-14T00:00:00.000Z' }, { date: '2024-08-14' });
    expect(diffs).toHaveLength(0);
  });
});
