/**
 * Tests for type coercion and conversion functions.
 *
 * These tests verify that type conversion functions handle edge cases correctly and fail with clear error messages for
 * invalid inputs.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  damlDateToDateString,
  dateStringToDAMLDate,
  normalizeNumericString,
  nullableDamlDateToDateString,
  nullableDateStringToDAMLDate,
  optionalDamlDateToDateString,
  optionalDateStringToDAMLDate,
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

  describe('dateStringToDAMLDate', () => {
    test.each(['2024-01-15', '2000-02-29', '1900-12-31'])('returns the valid date %s unchanged', (date) => {
      expect(dateStringToDAMLDate(date, 'test.date')).toBe(date);
    });

    test.each([
      '2024-01-15T14:30:00Z',
      '2024-01-15T14:30:00.000000Z',
      '2024-01-15T23:59:59+14:00',
      '2024-01-15T00:00:00-05:30',
    ])('keeps the lexical date of the valid RFC 3339 date-time %s', (dateTime) => {
      expect(dateStringToDAMLDate(dateTime, 'test.date')).toBe('2024-01-15');
    });

    test('never converts to UTC: an offset timestamp keeps the date it was written with', () => {
      const damlDate = dateStringToDAMLDate('2024-01-15T23:30:00-05:00', 'transaction.date');

      expect(damlDate).toBe('2024-01-15');
      expect(damlDateToDateString(damlDate, 'transaction.date')).toBe('2024-01-15');
      expect(dateStringToDAMLDate('2024-01-15T00:30:00+14:00', 'transaction.date')).toBe('2024-01-15');
    });

    test('does not construct a JavaScript Date', () => {
      const dateConstructor = jest.spyOn(globalThis, 'Date');
      try {
        dateStringToDAMLDate('2024-01-15T23:30:00-05:00', 'transaction.date');
        optionalDateStringToDAMLDate('2024-03-01', 'transaction.date');
        nullableDateStringToDAMLDate('2024-12-31T00:00:00Z', 'transaction.date');
        damlDateToDateString('2024-01-15', 'transaction.date');
        expect(dateConstructor).not.toHaveBeenCalled();
      } finally {
        dateConstructor.mockRestore();
      }
    });
  });

  describe('optional and required-nullable date helpers', () => {
    test('optional dates treat only null and undefined as absent', () => {
      expect(optionalDateStringToDAMLDate(null, 'optional.date')).toBeNull();
      expect(optionalDateStringToDAMLDate(undefined, 'optional.date')).toBeNull();
      expect(() => optionalDateStringToDAMLDate('', 'optional.date')).toThrow(OcpValidationError);
      expect(() => optionalDateStringToDAMLDate({ seconds: 1 }, 'optional.date')).toThrow(OcpValidationError);
    });

    test('required-nullable dates accept null but reject undefined and malformed present values', () => {
      expect(nullableDateStringToDAMLDate(null, 'nullable.date')).toBeNull();
      expect(() => nullableDateStringToDAMLDate(undefined, 'nullable.date')).toThrow(OcpValidationError);
      expect(() => nullableDateStringToDAMLDate('', 'nullable.date')).toThrow(OcpValidationError);
      expect(() => nullableDateStringToDAMLDate({ seconds: 1 }, 'nullable.date')).toThrow(OcpValidationError);
    });

    test('read helpers preserve optional and nullable output shapes without dropping present invalid values', () => {
      expect(optionalDamlDateToDateString(null, 'optional.date')).toBeUndefined();
      expect(optionalDamlDateToDateString(undefined, 'optional.date')).toBeUndefined();
      expect(nullableDamlDateToDateString(null, 'nullable.date')).toBeNull();
      expect(() => nullableDamlDateToDateString(undefined, 'nullable.date')).toThrow(OcpParseError);

      for (const value of ['', 0, false, { seconds: 1 }]) {
        expect(() => optionalDamlDateToDateString(value, 'optional.date')).toThrow(OcpParseError);
        expect(() => nullableDamlDateToDateString(value, 'nullable.date')).toThrow(OcpParseError);
      }
      expect(optionalDamlDateToDateString('2024-01-15', 'optional.date')).toBe('2024-01-15');
      expect(nullableDamlDateToDateString('2024-01-15', 'nullable.date')).toBe('2024-01-15');
    });
  });

  describe('damlDateToDateString', () => {
    test.each(['2024-01-15', '2000-02-29', '1900-12-31'])('returns the exact Daml Date %s as it is', (date) => {
      expect(damlDateToDateString(date, 'test.date')).toBe(date);
    });

    test.each([
      '2024-01-15T00:00:00.000Z',
      '2024-01-15T14:30:00.000Z',
      '2024-01-15T23:30:00-05:00',
      '2024-01-15T00:30:00+14:00',
    ])('rejects the timestamp %s: the ledger only encodes a Daml Date as YYYY-MM-DD', (dateTime) => {
      expect(() => damlDateToDateString(dateTime, 'test.date')).toThrow(
        expect.objectContaining({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'test.date',
        })
      );
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
      '0000-01-01',
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
      expect(() => dateStringToDAMLDate(value, 'test.date')).toThrow(OcpValidationError);
      expect(() => damlDateToDateString(value, 'test.date')).toThrow(OcpParseError);
    });

    test('accepts Gregorian leap days only when the year is valid', () => {
      expect(tryIsoDateToDateString('2000-02-29')).toBe('2000-02-29');
      expect(tryIsoDateToDateString('2024-02-29T23:59:59.123456789Z')).toBe('2024-02-29');
      expect(tryIsoDateToDateString('2100-02-29')).toBeNull();
    });

    test('accepts at most nine fractional-second digits', () => {
      const nineDigits = '2024-01-15T23:59:59.123456789Z';
      const tenDigits = '2024-01-15T23:59:59.1234567890Z';

      expect(tryIsoDateToDateString(nineDigits)).toBe('2024-01-15');
      expect(dateStringToDAMLDate(nineDigits, 'test.date')).toBe('2024-01-15');

      expect(tryIsoDateToDateString(tenDigits)).toBeNull();
      expect(() => dateStringToDAMLDate(tenDigits, 'test.date')).toThrow(OcpValidationError);
      expect(() => damlDateToDateString(tenDigits, 'test.date')).toThrow(OcpParseError);
    });

    test('reports the caller field path and invalid value', () => {
      const value = '2024-02-30T00:00:00Z';

      try {
        dateStringToDAMLDate(value, 'warrantIssuance.warrant_expiration_date');
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

      try {
        damlDateToDateString(value, 'warrantIssuance.warrant_expiration_date');
        throw new Error('Expected date validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          source: 'warrantIssuance.warrant_expiration_date',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: { expectedType: 'Daml Date (YYYY-MM-DD)', receivedValue: value },
        });
      }
    });

    test('distinguishes wrong runtime types from malformed date strings on the write boundary', () => {
      try {
        dateStringToDAMLDate(42, 'transaction.date');
        throw new Error('Expected date type validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          fieldPath: 'transaction.date',
          code: OcpErrorCodes.INVALID_TYPE,
        });
      }
    });

    test('treats every non-date ledger value as a schema mismatch on the read boundary', () => {
      expect(() => damlDateToDateString({ seconds: 1 }, 'transaction.date')).toThrow(
        expect.objectContaining({ name: 'OcpParseError', code: OcpErrorCodes.SCHEMA_MISMATCH })
      );
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
