/**
 * Tests for type coercion and conversion functions.
 *
 * These tests verify that type conversion functions handle edge cases correctly and fail with clear error messages for
 * invalid inputs.
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import {
  damlTimeToDateString,
  dateStringToDAMLTime,
  normalizeNumericString,
  optionalNumberToString,
  optionalString,
  safeString,
  tryIsoDateToDateString,
} from '../../src/utils/typeConversions';

describe('Type Coercion Utilities', () => {
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
    test.each(['2024-01-15', '2000-02-29', '1900-12-31'])('converts the valid date %s to UTC midnight', (date) => {
      expect(dateStringToDAMLTime(date)).toBe(`${date}T00:00:00.000Z`);
    });

    test.each([
      '2024-01-15T14:30:00Z',
      '2024-01-15T14:30:00.000000Z',
      '2024-01-15T23:59:59+14:00',
      '2024-01-15T00:00:00-05:30',
    ])('preserves the valid RFC 3339 date-time %s exactly', (dateTime) => {
      expect(dateStringToDAMLTime(dateTime)).toBe(dateTime);
    });
  });

  describe('damlTimeToDateString', () => {
    test.each([
      '2024-01-15T00:00:00.000Z',
      '2024-01-15T14:30:00.000Z',
      '2024-01-15T23:30:00-05:00',
      '2024-01-15T00:30:00+14:00',
    ])('extracts the lexical date prefix from %s', (dateTime) => {
      expect(damlTimeToDateString(dateTime)).toBe('2024-01-15');
    });

    test('returns date-only string as-is', () => {
      expect(damlTimeToDateString('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('strict date validation', () => {
    const invalidValues: unknown[] = [
      '2023-02-29',
      '1900-02-29',
      '2024-02-30',
      '2024-04-31',
      '2024-00-15',
      '2024-13-15',
      '2024-01-00',
      '2024-01-32',
      '2024-1-15',
      '2024-01-15T12:30:00',
      '2024-01-15T24:00:00Z',
      '2024-01-15T23:60:00Z',
      '2024-01-15T23:59:60Z',
      '2024-01-15T12:30Z',
      '2024-01-15T12:30:00+24:00',
      '2024-01-15T12:30:00+05:60',
      '2024-01-15T12:30:00z',
      '2024-01-15TICKET',
      '2024-01-15T12:30:00Zjunk',
      ' 2024-01-15',
      '2024-01-15 ',
      '',
      null,
      undefined,
      20240115,
      {},
      [],
    ];

    test.each(invalidValues)('non-throwing parser rejects invalid input %#', (value) => {
      expect(tryIsoDateToDateString(value)).toBeNull();
    });

    test.each(invalidValues)('both conversion boundaries reject invalid input %#', (value) => {
      expect(() => Reflect.apply(dateStringToDAMLTime, undefined, [value])).toThrow(OcpValidationError);
      expect(() => damlTimeToDateString(value)).toThrow(OcpValidationError);
    });

    test('accepts Gregorian leap days only when the year is valid', () => {
      expect(tryIsoDateToDateString('2000-02-29')).toBe('2000-02-29');
      expect(tryIsoDateToDateString('2024-02-29T23:59:59.123456789Z')).toBe('2024-02-29');
      expect(tryIsoDateToDateString('2100-02-29')).toBeNull();
    });

    test('reports the caller field path and invalid value', () => {
      const value = '2024-02-30T00:00:00Z';

      try {
        damlTimeToDateString(value, 'warrantIssuance.warrant_expiration_date');
        throw new Error('Expected date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          fieldPath: 'warrantIssuance.warrant_expiration_date',
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'YYYY-MM-DD or RFC 3339 date-time string with Z or numeric offset',
          receivedValue: value,
        });
      }
    });

    test('distinguishes wrong runtime types from malformed date strings', () => {
      for (const action of [
        () => damlTimeToDateString({ seconds: 1 }, 'transaction.date'),
        () => Reflect.apply(dateStringToDAMLTime, undefined, [42, 'transaction.date']),
      ]) {
        try {
          action();
          throw new Error('Expected date type validation to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({
            fieldPath: 'transaction.date',
            code: OcpErrorCodes.INVALID_TYPE,
          });
        }
      }
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
