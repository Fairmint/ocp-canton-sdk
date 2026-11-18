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
import { decodeDamlEntityData } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import type { OcfStockClass } from '../../src/types/native';
import { requireDefined } from '../../src/utils/requireDefined';
import { initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';

/** Convert to DAML and decode the result through the generated StockClass codec (lossless). */
function generatedStockClassData(data: OcfStockClass) {
  return decodeDamlEntityData('stockClass', convertToDamlData('stockClass', data));
}

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

  describe('OCF to DAML (convertToDamlData stockClass)', () => {
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
      const result = convertToDamlData('stockClass', baseData);

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

      const result = convertToDamlData('stockClass', dataWithUnlimited);

      expect(result.initial_shares_authorized).toEqual({
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesUnlimited',
      });
    });

    test('converts all required fields correctly', () => {
      const result = convertToDamlData('stockClass', baseData);

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

      const result = convertToDamlData('stockClass', dataWithPrice);

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

      const result = convertToDamlData('stockClass', dataWithParValue);

      expect(result.par_value).toEqual({
        amount: '0.001',
        currency: 'USD',
      });
    });

    test('writes the ratio conversion right in its v35 shape and round-trips canonical OCF data exactly', () => {
      const dataWithConversionRight: OcfStockClass = {
        ...stockClassWithRatioRight(),
        comments: [],
      };

      const generatedData = generatedStockClassData(dataWithConversionRight);

      expect(generatedData.conversion_rights).toEqual([
        {
          conversion_mechanism: {
            conversion_price: { amount: '1', currency: 'USD' },
            ratio: { numerator: '3', denominator: '2' },
            rounding_type: 'OcfRoundingTypeNormal',
          },
          converts_to_future_round: null,
          converts_to_stock_class_id: 'class-common',
        },
      ]);

      const decoded = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.decoder.runWithException(generatedData);
      expect(damlStockClassDataToNative(decoded)).toEqual(dataWithConversionRight);
    });

    test.each([
      ['missing target', (right: Record<string, unknown>) => ({ ...right, converts_to_stock_class_id: undefined })],
      [
        'malformed ratio',
        (right: Record<string, unknown>) => ({
          ...right,
          conversion_mechanism: {
            ...(right.conversion_mechanism as Record<string, unknown>),
            ratio: { numerator: '3' },
          },
        }),
      ],
    ])('wraps %s ledger payloads instead of leaking raw TypeError', (_case, mutateRight) => {
      const generated = generatedStockClassData(stockClassWithRatioRight());
      const right = generated.conversion_rights[0] as unknown as Record<string, unknown>;
      const malformed = {
        ...generated,
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

    test.each([
      ['a v34 non-ratio field', 'discount_rate', '0.1'],
      ['a v34 conversion trigger', 'conversion_trigger', { trigger_id: 'legacy-or-caller-supplied-trigger' }],
      ['a v34 right discriminator', 'type_', 'STOCK_CLASS_CONVERSION_RIGHT'],
    ])('rejects %s instead of silently dropping it', (_case, field, value) => {
      const generated = generatedStockClassData(stockClassWithRatioRight());
      const right = requireDefined(generated.conversion_rights[0], 'generated conversion right');
      const withExtraField = {
        ...generated,
        conversion_rights: [{ ...right, [field]: value }],
      };

      expect(() => damlStockClassDataToNative(withExtraField)).toThrow(
        expect.objectContaining({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: `stockClass.conversion_rights[0].${field}`,
        })
      );
    });

    test.each([
      ['NORMAL', 'OcfRoundingTypeNormal'],
      ['CEILING', 'OcfRoundingTypeCeiling'],
      ['FLOOR', 'OcfRoundingTypeFloor'],
    ] as const)('persists %s rounding as %s and round-trips it', (roundingType, damlTag) => {
      const generated = generatedStockClassData(stockClassWithRatioRight(roundingType));

      expect(
        requireDefined(generated.conversion_rights[0], 'conversion_rights 0').conversion_mechanism.rounding_type
      ).toBe(damlTag);

      const native = damlStockClassDataToNative(generated);
      expect(native.conversion_rights?.[0]?.conversion_mechanism).toMatchObject({ rounding_type: roundingType });
    });

    test('rejects a DAML null rounding_type on readback (v35 requires it)', () => {
      const generated = generatedStockClassData(stockClassWithRatioRight('FLOOR'));
      const right = requireDefined(generated.conversion_rights[0], 'generated conversion right');
      const withoutRounding = {
        ...generated,
        conversion_rights: [{ ...right, conversion_mechanism: { ...right.conversion_mechanism, rounding_type: null } }],
      };

      expect(() => damlStockClassDataToNative(withoutRounding)).toThrow(
        expect.objectContaining({ name: 'OcpParseError', code: OcpErrorCodes.SCHEMA_MISMATCH })
      );
    });

    test('rejects a ratio conversion right without rounding_type on write', () => {
      const data = stockClassWithRatioRight();
      (data.conversion_rights?.[0]?.conversion_mechanism as unknown as Record<string, unknown>).rounding_type =
        undefined;

      expect(() => convertToDamlData('stockClass', data)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stockClass.conversion_rights[0].conversion_mechanism.rounding_type',
        })
      );
    });

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

    test('keeps an OCF future-round right without a target stock class: converts_to_stock_class_id is Optional', () => {
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

      const daml = convertToDamlData('stockClass', futureRoundRight);

      expect(daml.conversion_rights).toEqual([
        {
          conversion_mechanism: {
            conversion_price: { amount: '1', currency: 'USD' },
            ratio: { numerator: '3', denominator: '2' },
            rounding_type: 'OcfRoundingTypeNormal',
          },
          converts_to_future_round: true,
          converts_to_stock_class_id: null,
        },
      ]);
      expect(damlStockClassDataToNative(decodeDamlEntityData('stockClass', daml)).conversion_rights).toEqual(
        futureRoundRight.conversion_rights
      );
    });

    test('rejects a runtime stock-class right without the exact OCF discriminator', () => {
      const data = stockClassWithRatioRight();
      const right = { ...data.conversion_rights?.[0] } as Record<string, unknown>;
      delete right.type;
      const missingType = { ...data, conversion_rights: [right] } as unknown as OcfStockClass;

      expect(() => convertToDamlData('stockClass', missingType)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].type',
        })
      );
    });
  });
});
