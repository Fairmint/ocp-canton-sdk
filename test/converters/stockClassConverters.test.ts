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

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import { buildOcfCreateData } from '../../src/functions/OpenCapTable/capTable/CapTableBatch';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import type { OcfStockClass } from '../../src/types/native';
import { initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';

describe('StockClass Converters', () => {
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

    test('keeps the DAML-only conversion trigger private and round-trips canonical OCF data exactly', () => {
      const dataWithConversionRight: OcfStockClass = {
        ...baseData,
        comments: [],
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'class-common',
          },
        ],
      };

      const generatedCreate = buildOcfCreateData('stockClass', dataWithConversionRight);
      expect(generatedCreate.tag).toBe('OcfCreateStockClass');

      const storedTrigger = generatedCreate.value.conversion_rights[0].conversion_trigger;
      expect(storedTrigger).toEqual(
        expect.objectContaining({
          trigger_id: 'ocp-sdk:stock-class:class-001:conversion-right:0:unspecified',
          type_: 'OcfTriggerTypeTypeUnspecified',
          end_date: null,
          nickname: null,
          start_date: null,
          trigger_condition: null,
          trigger_date: null,
          trigger_description: null,
          conversion_right: expect.objectContaining({
            tag: 'OcfRightConvertible',
            value: expect.objectContaining({ type_: 'CONVERTIBLE_CONVERSION_RIGHT' }),
          }),
        })
      );

      const decoded = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.decoder.runWithException(
        generatedCreate.value
      );
      expect(damlStockClassDataToNative(decoded)).toEqual(dataWithConversionRight);
    });

    test.each(['CEILING', 'FLOOR'] as const)(
      'rejects %s rounding because DAML v34 cannot persist it',
      (roundingType) => {
        const dataWithLossyRounding: OcfStockClass = {
          ...baseData,
          conversion_rights: [
            {
              type: 'STOCK_CLASS_CONVERSION_RIGHT',
              conversion_mechanism: {
                type: 'RATIO_CONVERSION',
                ratio: { numerator: '3', denominator: '2' },
                conversion_price: { amount: '1', currency: 'USD' },
                rounding_type: roundingType,
              },
              converts_to_stock_class_id: 'class-common',
            },
          ],
        };

        expect(() => convertToDaml('stockClass', dataWithLossyRounding)).toThrow(
          expect.objectContaining({
            name: 'OcpValidationError',
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.rounding_type',
            receivedValue: roundingType,
          })
        );
      }
    );

    test('rejects an OCF future-round right that the current DAML package cannot target', () => {
      const futureRoundRight: OcfStockClass = {
        ...baseData,
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_future_round: true,
          },
        ],
      };

      expect(() => convertToDaml('stockClass', futureRoundRight)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stockClass.conversion_rights[0].converts_to_stock_class_id',
        })
      );
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
