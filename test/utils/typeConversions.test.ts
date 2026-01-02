/** Unit tests for typeConversions utility functions. */

import { normalizeNumericString } from '../../src/utils/typeConversions';

describe('normalizeNumericString', () => {
  describe('valid inputs', () => {
    test('handles integers without decimal point', () => {
      expect(normalizeNumericString('5000000')).toBe('5000000');
      expect(normalizeNumericString('0')).toBe('0');
      expect(normalizeNumericString('123')).toBe('123');
    });

    test('removes trailing zeros after decimal point', () => {
      expect(normalizeNumericString('5000000.0000000000')).toBe('5000000');
      expect(normalizeNumericString('123.4500')).toBe('123.45');
      expect(normalizeNumericString('100.00')).toBe('100');
    });

    test('preserves significant decimal digits', () => {
      expect(normalizeNumericString('123.456')).toBe('123.456');
      expect(normalizeNumericString('0.5')).toBe('0.5');
      expect(normalizeNumericString('1.1')).toBe('1.1');
    });

    test('handles negative numbers', () => {
      expect(normalizeNumericString('-123')).toBe('-123');
      expect(normalizeNumericString('-123.4500')).toBe('-123.45');
      expect(normalizeNumericString('-100.00')).toBe('-100');
    });
  });

  describe('invalid inputs - scientific notation', () => {
    test('rejects lowercase e notation', () => {
      expect(() => normalizeNumericString('1.5e10')).toThrow(
        'Invalid numeric string: scientific notation is not supported (got "1.5e10")'
      );
      expect(() => normalizeNumericString('1e5')).toThrow('scientific notation is not supported');
      expect(() => normalizeNumericString('2.5e-3')).toThrow('scientific notation is not supported');
    });

    test('rejects uppercase E notation', () => {
      expect(() => normalizeNumericString('1.5E10')).toThrow('scientific notation is not supported');
      expect(() => normalizeNumericString('1E5')).toThrow('scientific notation is not supported');
      expect(() => normalizeNumericString('2.5E-3')).toThrow('scientific notation is not supported');
    });
  });

  describe('invalid inputs - malformed strings', () => {
    test('rejects non-numeric strings', () => {
      expect(() => normalizeNumericString('abc')).toThrow('Invalid numeric string format (got "abc")');
      expect(() => normalizeNumericString('12.34.56')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('12,345')).toThrow('Invalid numeric string format');
    });

    test('rejects empty or invalid formats', () => {
      expect(() => normalizeNumericString('')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('.')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('-.5')).toThrow('Invalid numeric string format');
    });

    test('rejects strings with spaces', () => {
      expect(() => normalizeNumericString('123 456')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString(' 123')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('123 ')).toThrow('Invalid numeric string format');
    });
  });
});
