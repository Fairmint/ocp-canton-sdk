/** Unit tests for typeConversions utility functions. */

import { OcpValidationError } from '../../src/errors';
import { ensureArray, normalizeNumericString } from '../../src/utils/typeConversions';

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
    test('rejects lowercase e notation with OcpValidationError', () => {
      expect(() => normalizeNumericString('1.5e10')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('1.5e10')).toThrow('Scientific notation is not supported');
      expect(() => normalizeNumericString('1e5')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('2.5e-3')).toThrow(OcpValidationError);
    });

    test('rejects uppercase E notation with OcpValidationError', () => {
      expect(() => normalizeNumericString('1.5E10')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('1.5E10')).toThrow('Scientific notation is not supported');
      expect(() => normalizeNumericString('1E5')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('2.5E-3')).toThrow(OcpValidationError);
    });
  });

  describe('invalid inputs - malformed strings', () => {
    test('rejects non-numeric strings with OcpValidationError', () => {
      expect(() => normalizeNumericString('abc')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('abc')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('12.34.56')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('12,345')).toThrow(OcpValidationError);
    });

    test('rejects empty or invalid formats with OcpValidationError', () => {
      expect(() => normalizeNumericString('')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('.')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('-.5')).toThrow(OcpValidationError);
    });

    test('rejects strings with spaces with OcpValidationError', () => {
      expect(() => normalizeNumericString('123 456')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString(' 123')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('123 ')).toThrow(OcpValidationError);
    });
  });
});

describe('ensureArray', () => {
  describe('normalizes null/undefined to empty array', () => {
    test('returns empty array for null', () => {
      expect(ensureArray(null)).toEqual([]);
    });

    test('returns empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([]);
    });
  });

  describe('preserves existing arrays', () => {
    test('returns same array for non-empty array', () => {
      const input = [1, 2, 3];
      expect(ensureArray(input)).toBe(input);
    });

    test('returns same array for empty array', () => {
      const input: number[] = [];
      expect(ensureArray(input)).toBe(input);
    });

    test('works with object arrays', () => {
      const input = [{ country: 'US', tax_id: '12-3456789' }];
      expect(ensureArray(input)).toBe(input);
    });

    test('works with string arrays', () => {
      const input = ['comment 1', 'comment 2'];
      expect(ensureArray(input)).toBe(input);
    });
  });
});
