/**
 * Unit tests for StockClass type converters.
 *
 * Tests OCF to DAML conversion for:
 * - StockClass with initial_shares_authorized tagged union encoding
 *
 * These tests ensure V30 DAML contract compatibility, which requires
 * initial_shares_authorized to be a tagged union type:
 * - OcfInitialSharesNumeric for numeric values
 * - OcfInitialSharesEnum for "UNLIMITED" or "NOT APPLICABLE"
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import type { OcfStockClass } from '../../src/types/native';
import { initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';

describe('StockClass Converters', () => {
  const baseData: OcfStockClass = {
    object_type: 'STOCK_CLASS',
    id: 'class-001',
    name: 'Common Stock',
    class_type: 'COMMON',
    default_id_prefix: 'CS',
    initial_shares_authorized: '10000000',
    seniority: '1',
    votes_per_share: '1',
  };

  describe('initialSharesAuthorizedToDaml', () => {
    test('encodes numeric string as OcfInitialSharesNumeric', () => {
      const result = initialSharesAuthorizedToDaml('10000000');

      expect(result).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '10000000',
      });
    });

    test('encodes numeric string as OcfInitialSharesNumeric', () => {
      const result = initialSharesAuthorizedToDaml('5000000');

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

    test('encodes NOT APPLICABLE as OcfInitialSharesEnum', () => {
      const result = initialSharesAuthorizedToDaml('NOT APPLICABLE');

      expect(result).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesNotApplicable',
      });
    });

    test('throws for unknown string values', () => {
      expect(() => initialSharesAuthorizedToDaml('UNKNOWN_VALUE')).toThrow(
        'Expected numeric string, "UNLIMITED", or "NOT APPLICABLE"'
      );
    });
  });

  describe('OCF to DAML (convertToDaml stockClass)', () => {
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
        amount: '1',
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

  describe('DAML to OCF numeric field diagnostics', () => {
    test.each([
      {
        name: 'initial authorized shares',
        field: 'initial_shares_authorized',
        fieldPath: 'stockClass.initial_shares_authorized',
        value: { tag: 'OcfInitialSharesNumeric', value: '1e3' },
        receivedValue: '1e3',
      },
      {
        name: 'votes per share',
        field: 'votes_per_share',
        fieldPath: 'stockClass.votes_per_share',
        value: '1e3',
        receivedValue: '1e3',
      },
      {
        name: 'seniority',
        field: 'seniority',
        fieldPath: 'stockClass.seniority',
        value: '1e3',
        receivedValue: '1e3',
      },
      {
        name: 'liquidation preference multiple',
        field: 'liquidation_preference_multiple',
        fieldPath: 'stockClass.liquidation_preference_multiple',
        value: '1e3',
        receivedValue: '1e3',
      },
      {
        name: 'participation cap multiple',
        field: 'participation_cap_multiple',
        fieldPath: 'stockClass.participation_cap_multiple',
        value: '1e3',
        receivedValue: '1e3',
      },
    ])('reports malformed $name at its OCF field path', ({ field, fieldPath, value, receivedValue }) => {
      const daml = convertToDaml('stockClass', baseData);

      try {
        damlStockClassDataToNative({
          ...daml,
          [field]: value,
        } as Parameters<typeof damlStockClassDataToNative>[0]);
        throw new Error('Expected stock class numeric validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath,
          receivedValue,
        });
      }
    });
  });
});
