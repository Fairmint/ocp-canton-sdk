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
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { buildOcfCreateData } from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import type { OcfStockClass } from '../../src/types/native';
import { requireFirst } from '../../src/utils/requireDefined';
import { initialSharesAuthorizedFromDaml, initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
}

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
        value: '1000000.5',
      });
    });

    test.each([
      ['leading plus', '+1', '1'],
      ['ten fractional digits', '+0001.1234567890', '1.123456789'],
      ['twenty-eight integral digits', '9'.repeat(28), '9'.repeat(28)],
    ])('canonicalizes %s', (_case, value, expected) => {
      expect(initialSharesAuthorizedToDaml(value, 'stockClass.initial_shares_authorized')).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: expected,
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
      expect(() => initialSharesAuthorizedToDaml('UNKNOWN_VALUE')).toThrow(OcpValidationError);
    });

    test('attributes invalid values to a caller-supplied field path', () => {
      try {
        initialSharesAuthorizedToDaml('1e3', 'stockClass.initial_shares_authorized');
        throw new Error('Expected initial shares validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: 'stockClass.initial_shares_authorized',
          receivedValue: '1e3',
        });
      }
    });

    test.each([
      ['eleven fractional digits', '1.00000000000'],
      ['twenty-nine integral digits', '1'.repeat(29)],
    ])('rejects %s with exact direct-helper diagnostics', (_case, value) => {
      const error = captureValidationError(() =>
        initialSharesAuthorizedToDaml(value, 'stockClass.initial_shares_authorized')
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockClass.initial_shares_authorized',
        receivedValue: value,
      });
    });

    test('rejects negative initial shares with an exact range error', () => {
      const error = captureValidationError(() =>
        initialSharesAuthorizedToDaml('-1', 'stockClass.initial_shares_authorized')
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: 'stockClass.initial_shares_authorized',
        receivedValue: '-1',
      });
    });

    test('decodes and canonicalizes the generated numeric variant directly', () => {
      expect(
        initialSharesAuthorizedFromDaml(
          { tag: 'OcfInitialSharesNumeric', value: '+0001.0000000000' },
          'stockClass.initial_shares_authorized'
        )
      ).toBe('1');
    });

    test.each([
      ['missing tag', {}, 'stockClass.initial_shares_authorized.tag', OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['null tag', { tag: null, value: '1' }, 'stockClass.initial_shares_authorized.tag', OcpErrorCodes.INVALID_TYPE],
      [
        'undefined tag',
        { tag: undefined, value: '1' },
        'stockClass.initial_shares_authorized.tag',
        OcpErrorCodes.INVALID_TYPE,
      ],
      [
        'numeric variant missing value',
        { tag: 'OcfInitialSharesNumeric' },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      [
        'enum variant missing value',
        { tag: 'OcfInitialSharesEnum' },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      [
        'numeric variant with a non-string value',
        { tag: 'OcfInitialSharesNumeric', value: 1 },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.INVALID_TYPE,
      ],
      [
        'enum variant with a non-string value',
        { tag: 'OcfInitialSharesEnum', value: 1 },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.INVALID_TYPE,
      ],
      [
        'numeric variant with a null value',
        { tag: 'OcfInitialSharesNumeric', value: null },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.INVALID_TYPE,
      ],
      [
        'enum variant with an undefined value',
        { tag: 'OcfInitialSharesEnum', value: undefined },
        'stockClass.initial_shares_authorized.value',
        OcpErrorCodes.INVALID_TYPE,
      ],
      [
        'keyed compatibility shape',
        { OcfInitialSharesNumeric: '1' },
        'stockClass.initial_shares_authorized.tag',
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      ['scalar compatibility shape', '1', 'stockClass.initial_shares_authorized', OcpErrorCodes.INVALID_TYPE],
      [
        'extra non-generated field',
        { tag: 'OcfInitialSharesNumeric', value: '1', extra: true },
        'stockClass.initial_shares_authorized.extra',
        OcpErrorCodes.SCHEMA_MISMATCH,
      ],
    ] as const)('rejects a %s with exact direct-helper diagnostics', (_case, value, fieldPath, code) => {
      expect(
        captureValidationError(() => initialSharesAuthorizedFromDaml(value, 'stockClass.initial_shares_authorized'))
      ).toMatchObject({ code, fieldPath });
    });

    test('classifies only an unknown string enum constructor as UNKNOWN_ENUM_VALUE', () => {
      expect(() =>
        initialSharesAuthorizedFromDaml(
          { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesFuture' },
          'stockClass.initial_shares_authorized'
        )
      ).toThrow(
        expect.objectContaining({
          name: 'OcpParseError',
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'stockClass.initial_shares_authorized.value',
        })
      );
    });
  });

  describe('OCF to DAML (convertToDaml stockClass)', () => {
    const stockClassWithRatioRight = (roundingType: 'CEILING' | 'FLOOR' | 'NORMAL' = 'NORMAL'): OcfStockClass =>
      ({
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
      }) as unknown as OcfStockClass;
    test('converts stockClass with numeric initial_shares_authorized as tagged union', () => {
      const result = convertToDaml('stockClass', baseData);

      expect(result.initial_shares_authorized).toEqual({
        tag: 'OcfInitialSharesNumeric',
        value: '10000000',
      });
    });

    test('public StockClass writer accepts and canonicalizes a leading plus', () => {
      expect(stockClassDataToDaml({ ...baseData, initial_shares_authorized: '+1' })).toMatchObject({
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1' },
      });
    });

    test.each([
      ['eleven fractional digits', '1.00000000000'],
      ['twenty-nine integral digits', '1'.repeat(29)],
    ])('public StockClass writer rejects %s with exact diagnostics', (_case, value) => {
      const error = captureValidationError(() =>
        stockClassDataToDaml({ ...baseData, initial_shares_authorized: value })
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockClass.initial_shares_authorized',
        receivedValue: value,
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

      const storedRight = requireFirst(generatedCreate.value.conversion_rights, 'stored stock-class conversion right');
      const storedTrigger = storedRight.conversion_trigger;
      expect(storedTrigger).toEqual(
        expect.objectContaining({
          trigger_id: 'default-class-001-0',
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
      const right = requireFirst(
        generated.value.conversion_rights,
        'generated stock-class conversion right'
      ) as unknown as Record<string, unknown>;
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
      expect(thrown).toMatchObject({ code: OcpErrorCodes.REQUIRED_FIELD_MISSING });
    });

    test('rejects populated non-ratio DAML fields instead of dropping them', () => {
      const generated = buildOcfCreateData('stockClass', stockClassWithRatioRight());
      const right = requireFirst(generated.value.conversion_rights, 'generated stock-class conversion right');
      const withDiscount = {
        ...generated.value,
        conversion_rights: [{ ...right, discount_rate: '0.1' }],
      };

      expect(() => damlStockClassDataToNative(withDiscount)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights.0.discount_rate',
          receivedValue: '0.1',
        })
      );
    });

    test('rejects arbitrary DAML conversion triggers instead of silently discarding them', () => {
      const generated = buildOcfCreateData('stockClass', stockClassWithRatioRight());
      const right = requireFirst(generated.value.conversion_rights, 'generated stock-class conversion right');
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
          fieldPath: 'stockClass.conversion_rights.0.conversion_trigger.trigger_id',
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
            fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.rounding_type',
            receivedValue: roundingType,
          })
        );
      }
    );

    test.each([
      {
        name: 'missing conversion_mechanism',
        conversionMechanism: undefined,
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      },
      {
        name: 'malformed conversion_mechanism',
        conversionMechanism: 'RATIO_CONVERSION',
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing conversion_price',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          ratio: { numerator: '3', denominator: '2' },
        },
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.conversion_price',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.conversion_price',
        code: OcpErrorCodes.INVALID_TYPE,
      },
      {
        name: 'missing ratio',
        conversionMechanism: {
          type: 'RATIO_CONVERSION',
          rounding_type: 'NORMAL',
          conversion_price: { amount: '1', currency: 'USD' },
        },
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio.numerator',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio.numerator',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio.denominator',
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
        fieldPath: 'stockClass.conversion_rights.0.conversion_mechanism.ratio.denominator',
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
      const futureRoundRight = {
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
      } as unknown as OcfStockClass;

      expect(() => convertToDaml('stockClass', futureRoundRight)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stockClass.conversion_rights.0.converts_to_stock_class_id',
        })
      );
    });

    test('reports a wrong-type conversion target at the exact writer path', () => {
      const data = stockClassWithRatioRight();
      const right = { ...data.conversion_rights?.[0], converts_to_stock_class_id: 42 };
      const malformed = { ...data, conversion_rights: [right] } as unknown as OcfStockClass;

      expect(() => convertToDaml('stockClass', malformed)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: 'stockClass.conversion_rights.0.converts_to_stock_class_id',
          receivedValue: 42,
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
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'stockClass.conversion_rights.0.type',
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

    test('reports a malformed ratio denominator on the exact second conversion right', () => {
      const denominator = '1e3';
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };

      try {
        stockClassDataToDaml({
          ...baseData,
          conversion_rights: [
            conversionRight,
            {
              ...conversionRight,
              converts_to_stock_class_id: 'class-003',
              conversion_mechanism: {
                ...conversionRight.conversion_mechanism,
                ratio: { numerator: '1', denominator },
              },
            },
          ],
        });
        throw new Error('Expected ratio denominator validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: 'stockClass.conversion_rights.1.conversion_mechanism.ratio.denominator',
          receivedValue: denominator,
        });
      }
    });

    test('rejects a mismatched conversion right on the exact second right', () => {
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };
      const input = {
        ...baseData,
        conversion_rights: [
          conversionRight,
          { ...conversionRight, type: 'WARRANT_CONVERSION_RIGHT', converts_to_stock_class_id: 'class-003' },
        ],
      } as unknown as Parameters<typeof stockClassDataToDaml>[0];

      try {
        stockClassDataToDaml(input);
        throw new Error('Expected conversion-right validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'stockClass.conversion_rights.1.type',
        });
      }
    });

    test.each([
      ['explicit null', null],
      ['string', 'false'],
      ['number', 0],
      ['object', {}],
    ] as const)('rejects a %s converts_to_future_round instead of silently omitting it', (_case, value) => {
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };
      const input = {
        ...baseData,
        conversion_rights: [
          conversionRight,
          { ...conversionRight, converts_to_stock_class_id: 'class-003', converts_to_future_round: value },
        ],
      } as unknown as Parameters<typeof stockClassDataToDaml>[0];

      try {
        stockClassDataToDaml(input);
        throw new Error('Expected future-round validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: 'stockClass.conversion_rights.1.converts_to_future_round',
          receivedValue: value,
        });
      }
    });
  });

  describe('DAML to OCF numeric field diagnostics', () => {
    test('public StockClass reader canonicalizes a leading plus', () => {
      const daml = stockClassDataToDaml(baseData);
      expect(
        damlStockClassDataToNative({
          ...daml,
          initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '+1' },
        }).initial_shares_authorized
      ).toBe('1');
    });

    test.each([
      ['eleven fractional digits', '1.00000000000'],
      ['twenty-nine integral digits', '1'.repeat(29)],
    ])('public StockClass reader rejects %s with exact diagnostics', (_case, value) => {
      const daml = stockClassDataToDaml(baseData);
      const error = captureValidationError(() =>
        damlStockClassDataToNative({
          ...daml,
          initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value },
        })
      );
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'stockClass.initial_shares_authorized.value',
        receivedValue: value,
      });
    });

    test('rejects an unknown initial-shares enum instead of defaulting it', () => {
      const unknownValue = 'OcfAuthorizedSharesUnknown';
      const daml = convertToDaml('stockClass', baseData);

      try {
        damlStockClassDataToNative({
          ...daml,
          initial_shares_authorized: { tag: 'OcfInitialSharesEnum', value: unknownValue },
        });
        throw new Error('Expected initial-shares enum validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'stockClass.initial_shares_authorized.value',
        });
      }
    });

    test.each([
      ['null root', null, 'stockClass', OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['scalar root', 42, 'stockClass', OcpErrorCodes.INVALID_TYPE],
      ['numeric name', { ...stockClassDataToDaml(baseData), name: 42 }, 'stockClass.name', OcpErrorCodes.INVALID_TYPE],
      ['empty name', { ...stockClassDataToDaml(baseData), name: '' }, 'stockClass.name', OcpErrorCodes.INVALID_FORMAT],
    ] as const)('strictly classifies %s', (_case, value, fieldPath, code) => {
      const error = captureValidationError(() => damlStockClassDataToNative(value));
      expect(error).toMatchObject({ code, fieldPath });
    });

    test.each([
      ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['record', {}, OcpErrorCodes.INVALID_TYPE],
    ] as const)('classifies a %s conversion_rights collection', (_case, value, code) => {
      const daml = stockClassDataToDaml(baseData);
      const error = captureValidationError(() => damlStockClassDataToNative({ ...daml, conversion_rights: value }));
      expect(error).toMatchObject({
        code,
        fieldPath: 'stockClass.conversion_rights',
        receivedValue: value,
      });
    });

    test.each([
      ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['boolean', false, OcpErrorCodes.INVALID_TYPE],
    ] as const)('classifies a %s second conversion right record', (_case, value, code) => {
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };
      const daml = stockClassDataToDaml({ ...baseData, conversion_rights: [conversionRight] });
      const firstRight = daml.conversion_rights[0];
      if (firstRight === undefined) throw new Error('Expected serialized stock-class right');
      const error = captureValidationError(() =>
        damlStockClassDataToNative({ ...daml, conversion_rights: [firstRight, value] })
      );
      expect(error).toMatchObject({
        code,
        fieldPath: 'stockClass.conversion_rights.1',
        receivedValue: value,
      });
    });

    test.each([
      ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['number', 42, OcpErrorCodes.INVALID_TYPE],
    ] as const)('classifies %s comments', (_case, value, code) => {
      const daml = stockClassDataToDaml(baseData);
      const error = captureValidationError(() => damlStockClassDataToNative({ ...daml, comments: value }));
      expect(error).toMatchObject({
        code,
        fieldPath: 'stockClass.comments',
        receivedValue: value,
      });
    });

    test.each([false, 0, ''] as const)('rejects malformed optional par_value %p instead of omitting it', (value) => {
      const daml = stockClassDataToDaml(baseData);
      const error = captureValidationError(() => damlStockClassDataToNative({ ...daml, par_value: value }));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'stockClass.par_value',
        receivedValue: value,
      });
    });

    test.each(['par_value', 'price_per_share'] as const)(
      'rejects a non-string %s currency instead of returning an invalid Monetary value',
      (field) => {
        const daml = stockClassDataToDaml(baseData);
        const error = captureValidationError(() =>
          damlStockClassDataToNative({ ...daml, [field]: { amount: '1', currency: false } })
        );
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `stockClass.${field}.currency`,
          receivedValue: false,
        });
      }
    );

    test.each([
      {
        name: 'initial authorized shares',
        field: 'initial_shares_authorized',
        fieldPath: 'stockClass.initial_shares_authorized.value',
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
      {
        name: 'par value amount',
        field: 'par_value',
        fieldPath: 'stockClass.par_value.amount',
        value: { amount: '1e3', currency: 'USD' },
        receivedValue: '1e3',
      },
      {
        name: 'price per share amount',
        field: 'price_per_share',
        fieldPath: 'stockClass.price_per_share.amount',
        value: { amount: '1e3', currency: 'USD' },
        receivedValue: '1e3',
      },
    ])('reports malformed $name at its OCF field path', ({ field, fieldPath, value, receivedValue }) => {
      const daml = convertToDaml('stockClass', baseData);

      try {
        damlStockClassDataToNative({
          ...daml,
          [field]: value,
        });
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

    test('reports a malformed ratio denominator on the exact second readback right', () => {
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };
      const daml = stockClassDataToDaml({
        ...baseData,
        conversion_rights: [conversionRight, { ...conversionRight, converts_to_stock_class_id: 'class-003' }],
      });
      const secondRight = daml.conversion_rights[1];
      if (secondRight === undefined) throw new Error('Expected a second stock-class conversion right');
      if (secondRight.ratio === null) throw new Error('Expected a second stock-class ratio');
      secondRight.ratio.denominator = '1e3';

      try {
        damlStockClassDataToNative(daml);
        throw new Error('Expected readback ratio denominator validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_FORMAT,
          fieldPath: 'stockClass.conversion_rights.1.conversion_mechanism.ratio.denominator',
          receivedValue: '1e3',
        });
      }
    });

    test.each([
      ['false', false, false],
      ['null', null, undefined],
      ['undefined', undefined, undefined],
    ] as const)('handles %s on the exact second converts_to_future_round', (_case, value, expected) => {
      const conversionRight = {
        type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
        converts_to_stock_class_id: 'class-002',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION' as const,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL' as const,
        },
      };
      const daml = stockClassDataToDaml({
        ...baseData,
        conversion_rights: [conversionRight, { ...conversionRight, converts_to_stock_class_id: 'class-003' }],
      });
      const secondRight = daml.conversion_rights[1];
      if (secondRight === undefined) throw new Error('Expected a second stock-class conversion right');
      (secondRight as unknown as Record<string, unknown>).converts_to_future_round = value;

      const result = damlStockClassDataToNative(daml);
      const nativeRight = result.conversion_rights?.[1];
      if (nativeRight === undefined) throw new Error('Expected a second native stock-class conversion right');
      expect(nativeRight.converts_to_future_round).toBe(expected);
      expect(Object.prototype.hasOwnProperty.call(nativeRight, 'converts_to_future_round')).toBe(
        expected !== undefined
      );
    });

    test.each(['false', 0, {}])(
      'rejects malformed second converts_to_future_round value %p at its indexed path',
      (value) => {
        const conversionRight = {
          type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
          converts_to_stock_class_id: 'class-002',
          conversion_mechanism: {
            type: 'RATIO_CONVERSION' as const,
            ratio: { numerator: '1', denominator: '1' },
            conversion_price: { amount: '1', currency: 'USD' },
            rounding_type: 'NORMAL' as const,
          },
        };
        const daml = stockClassDataToDaml({
          ...baseData,
          conversion_rights: [conversionRight, { ...conversionRight, converts_to_stock_class_id: 'class-003' }],
        });
        const secondRight = daml.conversion_rights[1];
        if (secondRight === undefined) throw new Error('Expected a second stock-class conversion right');
        (secondRight as unknown as Record<string, unknown>).converts_to_future_round = value;

        try {
          damlStockClassDataToNative(daml);
          throw new Error('Expected future-round validation to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({
            code: OcpErrorCodes.INVALID_TYPE,
            fieldPath: 'stockClass.conversion_rights.1.converts_to_future_round',
            receivedValue: value,
          });
        }
      }
    );
  });
});
