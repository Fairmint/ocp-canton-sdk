/** Tests for OCF comparison utilities */

import { ocfDeepEqual } from '../../src/utils/ocfComparison';

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

  test('returns false for type mismatches', () => {
    expect(ocfDeepEqual({ value: 100 }, { value: '100' })).toBe(false);
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
});
