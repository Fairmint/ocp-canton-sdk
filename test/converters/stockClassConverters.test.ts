/**
 * Unit tests for StockClass type converters.
 *
 * Tests OCF to DAML conversion for:
 * - StockClass with initial_shares_authorized tagged union encoding
 *
 * These tests ensure V30 DAML contract compatibility, which requires
 * initial_shares_authorized to be a tagged union type:
 * - OcfInitialSharesNumeric for numeric values
 * - OcfInitialSharesEnum for "UNLIMITED" or "NOT_APPLICABLE"
 */

import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';
import type { OcfStockClass } from '../../src/types/native';

describe('StockClass Converters', () => {
  describe('initialSharesAuthorizedToDaml', () => {
    test('encodes numeric string as OcfInitialSharesNumeric', () => {
      const result = initialSharesAuthorizedToDaml('10000000');

      expect(result).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '10000000',
      });
    });

    test('encodes number as OcfInitialSharesNumeric with string value', () => {
      const result = initialSharesAuthorizedToDaml(5000000);

      expect(result).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '5000000',
      });
    });

    test('encodes decimal string as OcfInitialSharesNumeric', () => {
      const result = initialSharesAuthorizedToDaml('1000000.50');

      expect(result).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '1000000.50',
      });
    });

    test('encodes UNLIMITED as OcfInitialSharesEnum', () => {
      const result = initialSharesAuthorizedToDaml('UNLIMITED');

      expect(result).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesUnlimited',
      });
    });

    test('encodes NOT_APPLICABLE as OcfInitialSharesEnum', () => {
      const result = initialSharesAuthorizedToDaml('NOT_APPLICABLE');

      expect(result).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesNotApplicable',
      });
    });

    test('encodes unknown string as NOT_APPLICABLE', () => {
      const result = initialSharesAuthorizedToDaml('UNKNOWN_VALUE');

      expect(result).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesNotApplicable',
      });
    });
  });

  describe('OCF to DAML (convertToDaml stockClass)', () => {
    const baseData: OcfStockClass = {
      id: 'class-001',
      name: 'Common Stock',
      class_type: 'COMMON',
      default_id_prefix: 'CS',
      initial_shares_authorized: '10000000',
      seniority: '1',
      votes_per_share: '1',
    };

    test('converts stockClass with numeric initial_shares_authorized as tagged union', () => {
      const result = convertToDaml('stockClass', baseData);

      expect(result.initial_shares_authorized).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '10000000',
      });
    });

    test('converts stockClass with UNLIMITED initial_shares_authorized as tagged union', () => {
      const dataWithUnlimited: OcfStockClass = {
        ...baseData,
        initial_shares_authorized: 'UNLIMITED',
      };

      const result = convertToDaml('stockClass', dataWithUnlimited);

      expect(result.initial_shares_authorized).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesUnlimited',
      });
    });

    test('converts all required fields correctly', () => {
      const result = convertToDaml('stockClass', baseData);

      expect(result.id).toBe('class-001');
      expect(result.name).toBe('Common Stock');
      expect(result.class_type).toBe('OcfStockClassTypeCommon');
      expect(result.default_id_prefix).toBe('CS');
      expect(result.votes_per_share).toBe('1');
      expect(result.seniority).toBe('1');
    });

    test('converts stockClass with optional price_per_share', () => {
      const dataWithPrice: OcfStockClass = {
        ...baseData,
        price_per_share: { amount: '1.00', currency: 'USD' },
      };

      const result = convertToDaml('stockClass', dataWithPrice);

      expect(result.price_per_share).toEqual({
        amount: '1.00',
        currency: 'USD',
      });
    });

    test('converts stockClass with optional par_value', () => {
      const dataWithParValue: OcfStockClass = {
        ...baseData,
        par_value: { amount: '0.001', currency: 'USD' },
      };

      const result = convertToDaml('stockClass', dataWithParValue);

      expect(result.par_value).toEqual({
        amount: '0.001',
        currency: 'USD',
      });
    });

    test('throws error when id is missing', () => {
      const invalidData = { ...baseData, id: '' };

      expect(() => convertToDaml('stockClass', invalidData)).toThrow();
    });

    test('throws error when name is missing', () => {
      const invalidData = { ...baseData, name: '' };

      expect(() => convertToDaml('stockClass', invalidData)).toThrow();
    });
  });
});
