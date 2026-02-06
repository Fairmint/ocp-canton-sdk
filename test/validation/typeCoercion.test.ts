/**
 * Tests for type coercion and conversion functions.
 *
 * These tests verify that type conversion functions handle edge cases correctly and fail with clear error messages for
 * invalid inputs.
 */

import { OcpValidationError } from '../../src/errors';
import {
  damlTimeToDateString,
  dateStringToDAMLTime,
  normalizeNumericString,
  numberToString,
  optionalNumberToString,
  optionalString,
  safeString,
} from '../../src/utils/typeConversions';

describe('Type Coercion Utilities', () => {
  describe('numberToString', () => {
    test('returns string as-is', () => {
      expect(numberToString('42')).toBe('42');
      expect(numberToString('0')).toBe('0');
      expect(numberToString('-123.45')).toBe('-123.45');
    });
  });

  describe('normalizeNumericString', () => {
    test('removes trailing zeros after decimal point', () => {
      expect(normalizeNumericString('5000000.0000000000')).toBe('5000000');
      expect(normalizeNumericString('123.45000')).toBe('123.45');
      expect(normalizeNumericString('100.10')).toBe('100.1');
    });

    test('returns integers as-is', () => {
      expect(normalizeNumericString('5000000')).toBe('5000000');
      expect(normalizeNumericString('0')).toBe('0');
      expect(normalizeNumericString('-123')).toBe('-123');
    });

    test('handles negative numbers correctly', () => {
      expect(normalizeNumericString('-123.4500')).toBe('-123.45');
      expect(normalizeNumericString('-0.100')).toBe('-0.1');
    });

    test('throws OcpValidationError for scientific notation', () => {
      expect(() => normalizeNumericString('1.5e10')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('1.5e10')).toThrow('Scientific notation is not supported');
      expect(() => normalizeNumericString('1E10')).toThrow(OcpValidationError);
    });

    test('throws OcpValidationError for invalid numeric strings', () => {
      expect(() => normalizeNumericString('abc')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('abc')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('12.34.56')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString(' 123 ')).toThrow(OcpValidationError);
    });
  });

  describe('optionalNumberToString', () => {
    test('returns string as-is', () => {
      expect(optionalNumberToString('42')).toBe('42');
    });

    test('returns null for null', () => {
      expect(optionalNumberToString(null)).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(optionalNumberToString(undefined)).toBeNull();
    });
  });

  describe('optionalString', () => {
    test('returns null for empty string', () => {
      expect(optionalString('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(optionalString(null)).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(optionalString(undefined)).toBeNull();
    });

    test('returns string as-is for non-empty values', () => {
      expect(optionalString('hello')).toBe('hello');
      expect(optionalString('  ')).toBe('  '); // Note: whitespace-only is NOT empty
    });
  });

  describe('dateStringToDAMLTime', () => {
    test('converts date string to DAML time format', () => {
      expect(dateStringToDAMLTime('2024-01-15')).toBe('2024-01-15T00:00:00.000Z');
      expect(dateStringToDAMLTime('2000-12-31')).toBe('2000-12-31T00:00:00.000Z');
    });

    test('returns datetime as-is if already has time portion', () => {
      const isoDate = '2024-01-15T14:30:00.000Z';
      expect(dateStringToDAMLTime(isoDate)).toBe(isoDate);
    });
  });

  describe('damlTimeToDateString', () => {
    test('extracts date portion from DAML time', () => {
      expect(damlTimeToDateString('2024-01-15T00:00:00.000Z')).toBe('2024-01-15');
      expect(damlTimeToDateString('2024-01-15T14:30:00.000Z')).toBe('2024-01-15');
    });

    test('returns date-only string as-is', () => {
      expect(damlTimeToDateString('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('safeString', () => {
    test('returns empty string for null', () => {
      expect(safeString(null)).toBe('');
    });

    test('returns empty string for undefined', () => {
      expect(safeString(undefined)).toBe('');
    });

    test('returns string as-is', () => {
      expect(safeString('hello')).toBe('hello');
    });

    test('throws for number', () => {
      expect(() => safeString(42)).toThrow();
    });

    test('throws for objects', () => {
      expect(() => safeString({ tag: 'SomeTag' })).toThrow();
      expect(() => safeString({ foo: 'bar' })).toThrow();
    });
  });
});
