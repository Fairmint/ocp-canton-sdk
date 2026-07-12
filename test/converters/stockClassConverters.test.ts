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
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { buildOcfCreateData } from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
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
        value: '1000000.5',
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
        'Expected a DAML Numeric 10 string, "UNLIMITED", or "NOT APPLICABLE"'
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

    const stockClassWithRatioRight = (roundingType: 'CEILING' | 'FLOOR' | 'NORMAL' = 'NORMAL'): OcfStockClass => ({
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
    });

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
        ...stockClassWithRatioRight(),
        comments: [],
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

    test.each([
      ['missing target', (right: Record<string, unknown>) => ({ ...right, converts_to_stock_class_id: undefined })],
      ['malformed ratio', (right: Record<string, unknown>) => ({ ...right, ratio: { numerator: '3' } })],
    ])('wraps %s ledger payloads instead of leaking raw TypeError', (_case, mutateRight) => {
      const generated = buildOcfCreateData('stockClass', stockClassWithRatioRight());
      const right = generated.value.conversion_rights[0] as unknown as Record<string, unknown>;
      const malformed = {
        ...generated.value,
        conversion_rights: [mutateRight(right)],
      };

      let thrown: unknown;
      expect(() => {
        try {
          damlStockClassDataToNative(malformed);
        } catch (error) {
          thrown = error;
          throw error;
        }
      }).toThrow();
      expect(thrown).not.toBeInstanceOf(TypeError);
      expect(thrown).toMatchObject({ code: OcpErrorCodes.SCHEMA_MISMATCH });
    });

    test('rejects populated non-ratio DAML fields instead of dropping them', () => {
      const generated = buildOcfCreateData('stockClass', stockClassWithRatioRight());
      const right = generated.value.conversion_rights[0];
      const withDiscount = {
        ...generated.value,
        conversion_rights: [{ ...right, discount_rate: '0.1' }],
      };

      expect(() => damlStockClassDataToNative(withDiscount)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].discount_rate',
          receivedValue: '0.1',
        })
      );
    });

    test('rejects arbitrary DAML conversion triggers instead of silently discarding them', () => {
      const generated = buildOcfCreateData('stockClass', stockClassWithRatioRight());
      const right = generated.value.conversion_rights[0];
      const withArbitraryTrigger = {
        ...generated.value,
        conversion_rights: [
          {
            ...right,
            conversion_trigger: {
              ...right.conversion_trigger,
              trigger_id: 'legacy-or-caller-supplied-trigger',
            },
          },
        ],
      };

      expect(() => damlStockClassDataToNative(withArbitraryTrigger)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
          receivedValue: 'legacy-or-caller-supplied-trigger',
        })
      );
    });

    test.each(['CEILING', 'FLOOR'] as const)(
      'rejects %s rounding because DAML v34 cannot persist it',
      (roundingType) => {
        const dataWithLossyRounding = stockClassWithRatioRight(roundingType);

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

    test.each([
      {
        name: 'missing conversion_mechanism',
        conversionMechanism: undefined,
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed conversion_mechanism',
        conversionMechanism: 'RATIO_CONVERSION',
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing conversion_price',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          ratio: { numerator: '3', denominator: '2' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.conversion_price',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed conversion_price',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: 'USD 1',
          ratio: { numerator: '3', denominator: '2' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.conversion_price',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing ratio',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed ratio',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: '3/2',
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing ratio numerator',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { denominator: '2' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio.numerator',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed ratio numerator',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: 3, denominator: '2' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio.numerator',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing ratio denominator',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: '3' },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio.denominator',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed ratio denominator',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: '3', denominator: 2 },
        },
        fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.ratio.denominator',
        code: OcpErrorCodes.INVALID_TYPE,
      },
    ])('wraps $name as OcpValidationError instead of leaking TypeError', ({ conversionMechanism, fieldPath, code }) => {
      const valid = stockClassWithRatioRight();
      const originalRight = valid.conversion_rights?.[0];
      if (!originalRight) throw new Error('Expected stock-class conversion-right fixture');
      const malformed = {
        ...valid,
        conversion_rights: [{ ...originalRight, conversion_mechanism: conversionMechanism }],
      } as unknown as OcfStockClass;

      let thrown: unknown;
      expect(() => {
        try {
          stockClassDataToDaml(malformed);
        } catch (error) {
          thrown = error;
          throw error;
        }
      }).toThrow();
      expect(thrown).toBeInstanceOf(OcpValidationError);
      expect(thrown).not.toBeInstanceOf(TypeError);
      expect(thrown).toMatchObject({ code, fieldPath });
    });

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

    test('rejects a runtime stock-class right without the exact OCF discriminator', () => {
      const data = stockClassWithRatioRight();
      const right = { ...data.conversion_rights?.[0] } as Record<string, unknown>;
      delete right.type;
      const missingType = { ...data, conversion_rights: [right] } as unknown as OcfStockClass;

      expect(() => convertToDaml('stockClass', missingType)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].type',
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
