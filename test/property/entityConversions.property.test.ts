/**
 * Property-based tests for entity conversion functions.
 *
 * These tests verify that entity conversions (address, stakeholder data, etc.)
 * maintain their invariants across a wide range of inputs.
 */

import fc from 'fast-check';

import type { Address, AddressType } from '../../src/types/native';
import { addressToDaml, damlAddressToNative } from '../../src/utils/typeConversions';

// ===== Arbitraries (generators) for common types =====

/**
 * Generate valid ISO 3166-1 alpha-2 country codes (uppercase, 2 letters).
 */
const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);

/**
 * Generate valid address types.
 */
const addressTypeArb = fc.constantFrom<AddressType>('LEGAL', 'CONTACT', 'OTHER');

/**
 * Generate non-empty strings for optional address fields.
 * These strings avoid empty strings which become null in DAML.
 */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim() !== '');

/**
 * Generate optional non-empty strings (either a non-empty string or undefined).
 */
const optionalNonEmptyStringArb = fc.option(nonEmptyStringArb, { nil: undefined });

/**
 * Generate valid Address objects.
 */
const addressArb = fc.record({
  address_type: addressTypeArb,
  country: countryCodeArb,
  street_suite: optionalNonEmptyStringArb,
  city: optionalNonEmptyStringArb,
  country_subdivision: optionalNonEmptyStringArb,
  postal_code: optionalNonEmptyStringArb,
}) as fc.Arbitrary<Address>;

describe('Property-based tests: Entity Conversions', () => {
  describe('address conversion properties', () => {
    /**
     * Round-trip: Converting an address to DAML and back should preserve all required fields
     * and non-empty optional fields.
     */
    test('address round-trip preserves required fields', () => {
      fc.assert(
        fc.property(addressArb, (address) => {
          const daml = addressToDaml(address);
          const native = damlAddressToNative(daml);

          // Required fields must be preserved exactly
          expect(native.address_type).toBe(address.address_type);
          expect(native.country).toBe(address.country);
        }),
        { numRuns: 500 }
      );
    });

    /**
     * Round-trip: Non-empty optional fields should be preserved.
     */
    test('address round-trip preserves non-empty optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            address_type: addressTypeArb,
            country: countryCodeArb,
            street_suite: nonEmptyStringArb,
            city: nonEmptyStringArb,
            country_subdivision: nonEmptyStringArb,
            postal_code: nonEmptyStringArb,
          }) as fc.Arbitrary<Address>,
          (address) => {
            const daml = addressToDaml(address);
            const native = damlAddressToNative(daml);

            expect(native.street_suite).toBe(address.street_suite);
            expect(native.city).toBe(address.city);
            expect(native.country_subdivision).toBe(address.country_subdivision);
            expect(native.postal_code).toBe(address.postal_code);
          }
        ),
        { numRuns: 300 }
      );
    });

    /**
     * Address type mapping: All address types should map correctly to DAML and back.
     */
    test('address type mapping is bijective', () => {
      const addressTypes: AddressType[] = ['LEGAL', 'CONTACT', 'OTHER'];

      for (const addressType of addressTypes) {
        const address: Address = {
          address_type: addressType,
          country: 'US',
        };
        const daml = addressToDaml(address);
        const native = damlAddressToNative(daml);
        expect(native.address_type).toBe(addressType);
      }
    });

    /**
     * Empty optional fields: Empty strings in optional fields should be converted to null
     * in DAML and then omitted from the native representation.
     */
    test('empty optional fields are normalized', () => {
      fc.assert(
        fc.property(
          fc.record({
            address_type: addressTypeArb,
            country: countryCodeArb,
            street_suite: fc.constant(''),
            city: fc.constant(''),
            country_subdivision: fc.constant(''),
            postal_code: fc.constant(''),
          }) as fc.Arbitrary<Address>,
          (address) => {
            const daml = addressToDaml(address);

            // Empty strings should become null in DAML
            expect(daml.street_suite).toBeNull();
            expect(daml.city).toBeNull();
            expect(daml.country_subdivision).toBeNull();
            expect(daml.postal_code).toBeNull();

            // When converted back, null fields should not be present
            const native = damlAddressToNative(daml);
            expect(native.street_suite).toBeUndefined();
            expect(native.city).toBeUndefined();
            expect(native.country_subdivision).toBeUndefined();
            expect(native.postal_code).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * DAML address type format: All DAML address types should follow the expected naming.
     */
    test('DAML address types follow naming convention', () => {
      fc.assert(
        fc.property(addressArb, (address) => {
          const daml = addressToDaml(address);

          // DAML types should be prefixed with 'OcfAddressType'
          expect(daml.address_type).toMatch(/^OcfAddressType(Legal|Contact|Other)$/);
        }),
        { numRuns: 200 }
      );
    });

    /**
     * Country codes preserved: Country codes should pass through unchanged.
     */
    test('country codes are preserved unchanged', () => {
      fc.assert(
        fc.property(
          fc.record({
            address_type: fc.constant<AddressType>('LEGAL'),
            country: countryCodeArb,
          }) as fc.Arbitrary<Address>,
          (address) => {
            const daml = addressToDaml(address);
            const native = damlAddressToNative(daml);

            expect(daml.country).toBe(address.country);
            expect(native.country).toBe(address.country);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('address edge cases', () => {
    /**
     * Unicode in address fields: Unicode characters should be preserved.
     */
    test('unicode characters in optional fields are preserved', () => {
      fc.assert(
        fc.property(
          fc.record({
            address_type: addressTypeArb,
            country: countryCodeArb,
            // Generate strings that may contain unicode
            street_suite: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() !== ''),
            city: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() !== ''),
          }) as fc.Arbitrary<Address>,
          (address) => {
            const daml = addressToDaml(address);
            const native = damlAddressToNative(daml);

            expect(native.street_suite).toBe(address.street_suite);
            expect(native.city).toBe(address.city);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * Whitespace-only strings: Strings with only whitespace should be treated as non-empty
     * (since optionalString only checks for empty string '', not whitespace-only).
     * This documents the current behavior.
     */
    test('whitespace-only strings are preserved (current behavior)', () => {
      const address: Address = {
        address_type: 'LEGAL',
        country: 'US',
        street_suite: '   ', // whitespace only
      };

      const daml = addressToDaml(address);
      // Current behavior: whitespace-only is not treated as empty
      expect(daml.street_suite).toBe('   ');

      const native = damlAddressToNative(daml);
      expect(native.street_suite).toBe('   ');
    });

    /**
     * Long strings: Very long strings should be handled correctly.
     */
    test('long strings in optional fields are preserved', () => {
      fc.assert(
        fc.property(
          fc.record({
            address_type: addressTypeArb,
            country: countryCodeArb,
            street_suite: fc.string({ minLength: 100, maxLength: 500 }),
            city: fc.string({ minLength: 100, maxLength: 500 }),
          }) as fc.Arbitrary<Address>,
          (address) => {
            // Filter out empty strings since they become null
            if (address.street_suite === '' || address.city === '') return;

            const daml = addressToDaml(address);
            const native = damlAddressToNative(daml);

            expect(native.street_suite).toBe(address.street_suite);
            expect(native.city).toBe(address.city);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
