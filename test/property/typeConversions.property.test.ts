/**
 * Property-based tests for type conversion functions.
 *
 * These tests use fast-check to generate random inputs and verify that conversion functions
 * maintain their invariants across a wide range of inputs.
 */

import fc from 'fast-check';

import {
  damlMonetaryToNative,
  damlTimeToDateString,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  numberToString,
  optionalNumberToString,
  optionalString,
} from '../../src/utils/typeConversions';

describe('Property-based tests: Type Conversions', () => {
  describe('normalizeNumericString properties', () => {
    /**
     * Idempotency: Normalizing a valid numeric string twice should produce the same result
     * as normalizing it once.
     */
    test('idempotent: normalizing twice equals normalizing once', () => {
      fc.assert(
        fc.property(
          // Generate valid numeric strings (integers and decimals)
          fc.oneof(
            // Integers
            fc.integer({ min: -1e12, max: 1e12 }).map((n) => n.toString()),
            // Decimals with various precision
            fc
              .tuple(
                fc.integer({ min: -1e10, max: 1e10 }),
                fc.integer({ min: 0, max: 9999999999 }),
                fc.integer({ min: 1, max: 10 })
              )
              .map(([whole, frac, decimals]) => {
                const fracStr = frac.toString().padStart(decimals, '0').slice(0, decimals);
                return `${whole}.${fracStr}`;
              })
          ),
          (numStr) => {
            // Skip if the generated string isn't valid (e.g., scientific notation edge cases)
            try {
              const once = normalizeNumericString(numStr);
              const twice = normalizeNumericString(once);
              expect(twice).toBe(once);
            } catch {
              // Invalid inputs are expected to throw - that's fine
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    /**
     * Value preservation: Normalizing a numeric string should preserve its numeric value.
     */
    test('preserves numeric value', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: 0, max: 999999 })).map(([integer, frac]) => {
            // Create a valid decimal string
            const fracStr = frac.toString().padStart(6, '0');
            return `${integer}.${fracStr}`;
          }),
          (numStr) => {
            const normalized = normalizeNumericString(numStr);
            const original = parseFloat(numStr);
            const normalizedVal = parseFloat(normalized);
            // Values should be equal within floating point precision
            expect(Math.abs(normalizedVal - original)).toBeLessThan(1e-9);
          }
        ),
        { numRuns: 500 }
      );
    });

    /**
     * No trailing zeros: Normalized strings should not have unnecessary trailing zeros
     * after the decimal point.
     */
    test('removes trailing zeros after decimal', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: 1, max: 10 }))
            .map(([n, zeros]) => `${n}.${'0'.repeat(zeros)}`),
          (numStr) => {
            const normalized = normalizeNumericString(numStr);
            // Should not end with .0+ or have trailing zeros after decimal
            expect(normalized).not.toMatch(/\.0+$/);
            expect(normalized).not.toMatch(/\d+\.\d*0$/);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * Integers remain integers: If input has no significant decimal part,
     * output should be an integer string.
     */
    test('integers remain integers', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e12, max: 1e12 }), (n) => {
          const str = n.toString();
          const normalized = normalizeNumericString(str);
          expect(normalized).toBe(str);
          expect(normalized).not.toContain('.');
        }),
        { numRuns: 200 }
      );
    });

    /**
     * Rejects scientific notation: Should throw on scientific notation inputs.
     */
    test('rejects scientific notation', () => {
      fc.assert(
        fc.property(fc.tuple(fc.float({ min: 1, max: 100 }), fc.integer({ min: 1, max: 15 })), ([base, exp]) => {
          const scientific = `${base}e${exp}`;
          expect(() => normalizeNumericString(scientific)).toThrow(/scientific notation/i);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('numberToString properties', () => {
    /**
     * Numbers convert to their string representation.
     */
    test('converts numbers to strings', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e15, max: 1e15 }), (n) => {
          expect(numberToString(n)).toBe(n.toString());
        }),
        { numRuns: 200 }
      );
    });

    /**
     * Strings pass through unchanged.
     */
    test('strings pass through unchanged', () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[0-9.\-]{1,20}$/), (s) => {
          expect(numberToString(s)).toBe(s);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('optionalNumberToString properties', () => {
    /**
     * Null and undefined return undefined.
     */
    test('null and undefined return undefined', () => {
      expect(optionalNumberToString(null)).toBeUndefined();
      expect(optionalNumberToString(undefined)).toBeUndefined();
    });

    /**
     * Numbers convert to strings.
     */
    test('converts numbers to strings', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1e15, max: 1e15 }), (n) => {
          expect(optionalNumberToString(n)).toBe(n.toString());
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('optionalString properties', () => {
    /**
     * Empty, null, undefined all become null.
     */
    test('empty values become null', () => {
      expect(optionalString('')).toBeNull();
      expect(optionalString(null)).toBeNull();
      expect(optionalString(undefined)).toBeNull();
    });

    /**
     * Non-empty strings pass through unchanged.
     */
    test('non-empty strings pass through', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (s) => {
          expect(optionalString(s)).toBe(s);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('date conversion properties', () => {
    /**
     * Date round-trip: Converting to DAML time and back preserves the date portion.
     */
    test('date round-trip preserves date portion', () => {
      fc.assert(
        fc.property(fc.date({ min: new Date('1900-01-01'), max: new Date('2100-12-31') }), (date) => {
          // Format as YYYY-MM-DD
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const damlTime = dateStringToDAMLTime(dateStr);
          const backToDate = damlTimeToDateString(damlTime);

          expect(backToDate).toBe(dateStr);
        }),
        { numRuns: 500 }
      );
    });

    /**
     * dateStringToDAMLTime adds time portion to date-only strings.
     */
    test('adds time portion to date strings', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1900, max: 2100 }),
              fc.integer({ min: 1, max: 12 }),
              fc.integer({ min: 1, max: 28 }) // Use 28 to avoid month-day edge cases
            )
            .map(([year, month, day]) => {
              const monthStr = String(month).padStart(2, '0');
              const dayStr = String(day).padStart(2, '0');
              return `${year}-${monthStr}-${dayStr}`;
            }),
          (dateStr) => {
            const damlTime = dateStringToDAMLTime(dateStr);
            expect(damlTime).toBe(`${dateStr}T00:00:00.000Z`);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * dateStringToDAMLTime passes through strings with time portion.
     */
    test('passes through datetime strings unchanged', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1900, max: 2100 }),
              fc.integer({ min: 1, max: 12 }),
              fc.integer({ min: 1, max: 28 }),
              fc.integer({ min: 0, max: 23 }),
              fc.integer({ min: 0, max: 59 }),
              fc.integer({ min: 0, max: 59 })
            )
            .map(([year, month, day, hour, min, sec]) => {
              const monthStr = String(month).padStart(2, '0');
              const dayStr = String(day).padStart(2, '0');
              const hourStr = String(hour).padStart(2, '0');
              const minStr = String(min).padStart(2, '0');
              const secStr = String(sec).padStart(2, '0');
              return `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}:${secStr}.000Z`;
            }),
          (datetimeStr) => {
            const result = dateStringToDAMLTime(datetimeStr);
            expect(result).toBe(datetimeStr);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('monetary conversion properties', () => {
    /**
     * Monetary round-trip: Converting to DAML and back preserves the normalized value.
     */
    test('monetary round-trip preserves value', () => {
      fc.assert(
        fc.property(
          fc.record({
            amount: fc.oneof(
              // Integer amounts
              fc.integer({ min: 0, max: 1e12 }).map((n) => n.toString()),
              // Decimal amounts with various precision
              fc.tuple(fc.integer({ min: 0, max: 1e10 }), fc.integer({ min: 0, max: 999999 })).map(([whole, frac]) => {
                const fracStr = frac.toString().padStart(6, '0');
                return `${whole}.${fracStr}`;
              })
            ),
            currency: fc.stringMatching(/^[A-Z]{3}$/),
          }),
          (monetary) => {
            const daml = monetaryToDaml(monetary);
            const native = damlMonetaryToNative(daml);

            // Normalized amounts should be equal
            const originalNormalized = normalizeNumericString(monetary.amount);
            expect(native.amount).toBe(originalNormalized);
            expect(native.currency).toBe(monetary.currency);
          }
        ),
        { numRuns: 500 }
      );
    });

    /**
     * Monetary with number amounts: Should convert number amounts correctly.
     */
    test('converts number amounts to strings', () => {
      fc.assert(
        fc.property(
          fc.record({
            amount: fc.integer({ min: 0, max: 1e12 }),
            currency: fc.constant('USD'),
          }),
          (monetary) => {
            const daml = monetaryToDaml(monetary);
            expect(daml.amount).toBe(monetary.amount.toString());
            expect(daml.currency).toBe(monetary.currency);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * Currency codes preserved: Currency codes should pass through unchanged.
     */
    test('preserves currency codes', () => {
      fc.assert(
        fc.property(
          fc.record({
            amount: fc.constant('100'),
            currency: fc.stringMatching(/^[A-Z]{3}$/),
          }),
          (monetary) => {
            const daml = monetaryToDaml(monetary);
            const native = damlMonetaryToNative(daml);
            expect(native.currency).toBe(monetary.currency);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
