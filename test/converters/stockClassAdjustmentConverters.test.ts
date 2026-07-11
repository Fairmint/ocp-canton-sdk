/**
 * Unit tests for stock class adjustment type converters.
 *
 * Tests OCF to DAML conversion (ocfToDaml.ts) for:
 * - StockClassSplit
 * - StockClassConversionRatioAdjustment
 * - StockConsolidation
 * - StockReissuance
 *
 * Tests DAML to OCF conversion (damlToOcf.ts) for:
 * - StockClassSplit
 * - StockClassConversionRatioAdjustment
 * - StockConsolidation
 * - StockReissuance
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { getStockClassConversionRatioAdjustmentAsOcf } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/getStockClassConversionRatioAdjustmentAsOcf';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { damlStockConsolidationToNative } from '../../src/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import { damlStockReissuanceToNative } from '../../src/functions/OpenCapTable/stockReissuance/damlToStockReissuance';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
} from '../../src/types/native';

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

describe('Stock Class Adjustment Converters', () => {
  describe('OCF to DAML (ocfToDaml)', () => {
    describe('stockClassSplit', () => {
      const baseData: OcfStockClassSplit = {
        object_type: 'TX_STOCK_CLASS_SPLIT',
        id: 'split-001',
        date: '2024-01-15',
        stock_class_id: 'class-001',
        split_ratio: {
          numerator: '2',
          denominator: '1',
        },
      };

      test('converts basic stock class split with nested split_ratio', () => {
        const result = convertToDaml('stockClassSplit', baseData);

        expect(result).toEqual({
          id: 'split-001',
          date: expect.any(String), // DAML time format
          stock_class_id: 'class-001',
          split_ratio: {
            numerator: '2',
            denominator: '1',
          },
          comments: [],
        });
      });

      test('handles numeric split ratio values', () => {
        const dataWithNumericRatio = {
          ...baseData,
          split_ratio: {
            numerator: '3',
            denominator: '1',
          },
        };

        const result = convertToDaml('stockClassSplit', dataWithNumericRatio);
        const splitRatio = result.split_ratio as { numerator: string; denominator: string };

        expect(splitRatio.numerator).toBe('3');
        expect(splitRatio.denominator).toBe('1');
      });

      test('normalizes split ratio numeric strings before DAML conversion', () => {
        const dataWithUnnormalizedRatio = {
          ...baseData,
          split_ratio: {
            numerator: '2.0000000000',
            denominator: '1.5000000000',
          },
        };

        const result = convertToDaml('stockClassSplit', dataWithUnnormalizedRatio);
        const splitRatio = result.split_ratio as { numerator: string; denominator: string };

        expect(splitRatio.numerator).toBe('2');
        expect(splitRatio.denominator).toBe('1.5');
      });

      test('converts with comments', () => {
        const dataWithComments = {
          ...baseData,
          comments: ['2-for-1 stock split', 'Approved by board'],
        };

        const result = convertToDaml('stockClassSplit', dataWithComments);

        expect(result.comments).toEqual(['2-for-1 stock split', 'Approved by board']);
      });

      test('throws error when id is missing', () => {
        const invalidData = { ...baseData, id: '' };

        expect(() => convertToDaml('stockClassSplit', invalidData)).toThrow('stockClassSplit.id');
      });
    });

    describe('stockClassConversionRatioAdjustment', () => {
      const baseData: OcfStockClassConversionRatioAdjustment = {
        object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
        id: 'adj-001',
        date: '2024-02-01',
        stock_class_id: 'class-002',
        new_ratio_conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          conversion_price: { amount: '0', currency: 'USD' },
          ratio: {
            numerator: '3',
            denominator: '2',
          },
          rounding_type: 'NORMAL',
        },
      };

      test('converts basic conversion ratio adjustment with nested mechanism', () => {
        const result = convertToDaml('stockClassConversionRatioAdjustment', baseData);

        expect(result).toEqual({
          id: 'adj-001',
          date: expect.any(String),
          stock_class_id: 'class-002',
          new_ratio_conversion_mechanism: {
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: {
              numerator: '3',
              denominator: '2',
            },
            rounding_type: 'OcfRoundingNormal' as const,
          },
          comments: [],
        });
      });

      test('handles numeric ratio values', () => {
        const dataWithNumericRatio: OcfStockClassConversionRatioAdjustment = {
          ...baseData,
          new_ratio_conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: {
              numerator: '5',
              denominator: '4',
            },
            rounding_type: 'NORMAL',
          },
        };

        const result = convertToDaml('stockClassConversionRatioAdjustment', dataWithNumericRatio);
        const mechanism = result.new_ratio_conversion_mechanism as {
          ratio: { numerator: string; denominator: string };
        };

        expect(mechanism.ratio.numerator).toBe('5');
        expect(mechanism.ratio.denominator).toBe('4');
      });

      test.each([
        ['direct converter', stockClassConversionRatioAdjustmentDataToDaml],
        [
          'generic converter',
          (input: OcfStockClassConversionRatioAdjustment) =>
            convertToDaml('stockClassConversionRatioAdjustment', input),
        ],
      ] as const)('%s canonicalizes leading-plus Numeric 10 fields', (_case, convert) => {
        const input: OcfStockClassConversionRatioAdjustment = {
          ...baseData,
          new_ratio_conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            conversion_price: { amount: '+0001.2300000000', currency: 'USD' },
            ratio: { numerator: '+0002.0000000000', denominator: '+0004.0000000000' },
            rounding_type: 'NORMAL',
          },
        };

        expect(convert(input)).toMatchObject({
          new_ratio_conversion_mechanism: {
            conversion_price: { amount: '1.23', currency: 'USD' },
            ratio: { numerator: '2', denominator: '4' },
          },
        });
      });

      test.each([
        ['direct converter', stockClassConversionRatioAdjustmentDataToDaml],
        [
          'generic converter',
          (input: OcfStockClassConversionRatioAdjustment) =>
            convertToDaml('stockClassConversionRatioAdjustment', input),
        ],
      ] as const)('%s rejects schema-invalid trailing fractional digits', (_case, convert) => {
        const input: OcfStockClassConversionRatioAdjustment = {
          ...baseData,
          new_ratio_conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            conversion_price: { amount: '1.00000000000', currency: 'USD' },
            ratio: { numerator: '2', denominator: '1' },
            rounding_type: 'NORMAL',
          },
        };

        expect(() => convert(input)).toThrow(OcpValidationError);
      });

      test('converts with comments', () => {
        const dataWithOptionals = {
          ...baseData,
          comments: ['Ratio adjusted for anti-dilution'],
        };

        const result = convertToDaml('stockClassConversionRatioAdjustment', dataWithOptionals);

        expect(result.comments).toEqual(['Ratio adjusted for anti-dilution']);
      });

      test('throws error when id is missing', () => {
        const invalidData = { ...baseData, id: '' };

        expect(() => convertToDaml('stockClassConversionRatioAdjustment', invalidData)).toThrow(
          'stockClassConversionRatioAdjustment.id'
        );
      });

      test('rejects a missing conversion mechanism at runtime', () => {
        const { new_ratio_conversion_mechanism: _, ...withoutMechanism } = baseData;

        expect(() =>
          convertToDaml(
            'stockClassConversionRatioAdjustment',
            withoutMechanism as unknown as OcfStockClassConversionRatioAdjustment
          )
        ).toThrow('new_ratio_conversion_mechanism');
      });

      test.each([
        [
          'null mechanism',
          null,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
          OcpErrorCodes.INVALID_TYPE,
        ],
        [
          'missing discriminator',
          {
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: { numerator: '1', denominator: '1' },
            rounding_type: 'NORMAL',
          },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.type',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
        ],
        [
          'wrong discriminator',
          { ...baseData.new_ratio_conversion_mechanism, type: 'FIXED_AMOUNT_CONVERSION' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.type',
          OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        ],
        [
          'non-string discriminator',
          { ...baseData.new_ratio_conversion_mechanism, type: null },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.type',
          OcpErrorCodes.INVALID_TYPE,
        ],
        [
          'unknown mechanism field',
          { ...baseData.new_ratio_conversion_mechanism, legacy_ratio: '1:1' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.legacy_ratio',
          OcpErrorCodes.SCHEMA_MISMATCH,
        ],
        [
          'missing conversion price',
          { ...baseData.new_ratio_conversion_mechanism, conversion_price: undefined },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
        ],
        [
          'missing ratio',
          { ...baseData.new_ratio_conversion_mechanism, ratio: undefined },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
        ],
        [
          'null ratio',
          { ...baseData.new_ratio_conversion_mechanism, ratio: null },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio',
          OcpErrorCodes.INVALID_TYPE,
        ],
        [
          'missing numerator',
          { ...baseData.new_ratio_conversion_mechanism, ratio: { denominator: '1' } },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
        ],
        [
          'boolean denominator',
          { ...baseData.new_ratio_conversion_mechanism, ratio: { numerator: '1', denominator: true } },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.denominator',
          OcpErrorCodes.INVALID_TYPE,
        ],
        [
          'unknown rounding',
          { ...baseData.new_ratio_conversion_mechanism, rounding_type: 'BANKERS' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type',
          OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        ],
      ] as const)('direct writer classifies %s', (_case, mechanism, fieldPath, code) => {
        try {
          stockClassConversionRatioAdjustmentDataToDaml({
            ...baseData,
            new_ratio_conversion_mechanism: mechanism,
          } as unknown as OcfStockClassConversionRatioAdjustment);
          throw new Error('Expected mechanism validation to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({ fieldPath, code });
        }
      });

      test.each(['board_approval_date', 'stockholder_approval_date', 'legacy_ratio'] as const)(
        'direct writer rejects unexpected top-level field %s instead of dropping it',
        (field) => {
          const input = { ...baseData, [field]: '2026-01-02' };

          expect(() => stockClassConversionRatioAdjustmentDataToDaml(input)).toThrow(
            expect.objectContaining({
              name: OcpValidationError.name,
              fieldPath: `stockClassConversionRatioAdjustment.${field}`,
              code: OcpErrorCodes.SCHEMA_MISMATCH,
              expectedType: 'absent property',
              receivedValue: '2026-01-02',
            })
          );
        }
      );
    });

    describe('stockConsolidation', () => {
      const baseData: OcfStockConsolidation = {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'consolidation-001',
        date: '2024-03-01',
        security_ids: ['sec-001', 'sec-002', 'sec-003'],
        resulting_security_id: 'new-sec-001',
      };

      test('converts basic stock consolidation with singular resulting_security_id', () => {
        const result = convertToDaml('stockConsolidation', baseData);

        expect(result).toEqual({
          id: 'consolidation-001',
          date: expect.any(String),
          security_ids: ['sec-001', 'sec-002', 'sec-003'],
          resulting_security_id: 'new-sec-001', // DAML expects singular
          reason_text: null,
          comments: [],
        });
      });

      test('converts with comments', () => {
        const dataWithComments = {
          ...baseData,
          comments: ['Reverse split consolidation'],
        };

        const result = convertToDaml('stockConsolidation', dataWithComments);

        expect(result.comments).toEqual(['Reverse split consolidation']);
      });

      test('keeps canonical resulting_security_id', () => {
        const result = convertToDaml('stockConsolidation', baseData);
        expect(result.resulting_security_id).toBe('new-sec-001');
      });

      test('throws error when id is missing', () => {
        const invalidData = { ...baseData, id: '' };

        expect(() => convertToDaml('stockConsolidation', invalidData)).toThrow('stockConsolidation.id');
      });
    });

    describe('stockReissuance', () => {
      const baseData: OcfStockReissuance = {
        object_type: 'TX_STOCK_REISSUANCE',
        id: 'reissue-001',
        date: '2024-04-01',
        security_id: 'sec-cancelled-001',
        resulting_security_ids: ['sec-new-001', 'sec-new-002'],
      };

      test('converts basic stock reissuance with optional fields', () => {
        const result = convertToDaml('stockReissuance', baseData);

        expect(result).toEqual({
          id: 'reissue-001',
          date: expect.any(String),
          security_id: 'sec-cancelled-001',
          resulting_security_ids: ['sec-new-001', 'sec-new-002'],
          reason_text: null,
          split_transaction_id: null,
          comments: [],
        });
      });

      test('converts with comments', () => {
        const dataWithComments = {
          ...baseData,
          comments: ['Reissued after forfeiture expiration'],
        };

        const result = convertToDaml('stockReissuance', dataWithComments);

        expect(result.comments).toEqual(['Reissued after forfeiture expiration']);
      });

      test('handles single resulting security', () => {
        const dataWithSingleResult = {
          ...baseData,
          resulting_security_ids: ['sec-new-single'],
        };

        const result = convertToDaml('stockReissuance', dataWithSingleResult);

        expect(result.resulting_security_ids).toEqual(['sec-new-single']);
      });

      test('throws error when id is missing', () => {
        const invalidData = { ...baseData, id: '' };

        expect(() => convertToDaml('stockReissuance', invalidData)).toThrow('stockReissuance.id');
      });
    });
  });

  describe('DAML to OCF (damlToOcf)', () => {
    describe('damlStockClassSplitToNative', () => {
      test('converts basic stock class split data', () => {
        const damlData = {
          id: 'split-001',
          date: '2024-01-15T00:00:00.000Z',
          stock_class_id: 'class-001',
          split_ratio: {
            numerator: '2.0000000000',
            denominator: '1.0000000000',
          },
          comments: ['2-for-1 stock split'],
        };

        const result = damlStockClassSplitToNative(damlData);

        expect(result).toEqual({
          object_type: 'TX_STOCK_CLASS_SPLIT',
          id: 'split-001',
          date: '2024-01-15',
          stock_class_id: 'class-001',
          split_ratio: {
            numerator: '2',
            denominator: '1',
          },
          comments: ['2-for-1 stock split'],
        });
      });

      test('handles empty comments', () => {
        const damlData = {
          id: 'split-002',
          date: '2024-01-15T00:00:00.000Z',
          stock_class_id: 'class-001',
          split_ratio: { numerator: '3', denominator: '1' },
          comments: [],
        };

        const result = damlStockClassSplitToNative(damlData);

        expect(result.comments).toBeUndefined();
      });
    });

    describe('damlStockClassConversionRatioAdjustmentToNative', () => {
      test('converts basic conversion ratio adjustment data', () => {
        const damlData = {
          id: 'adj-001',
          date: '2024-02-01T00:00:00.000Z',
          stock_class_id: 'class-002',
          new_ratio_conversion_mechanism: {
            conversion_price: { amount: '0.0000000000', currency: 'USD' },
            ratio: {
              numerator: '3.0000000000',
              denominator: '2.0000000000',
            },
            rounding_type: 'OcfRoundingNormal' as const,
          },
          comments: ['Anti-dilution adjustment'],
        };

        const result = damlStockClassConversionRatioAdjustmentToNative(damlData);

        expect(result).toEqual({
          object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
          id: 'adj-001',
          date: '2024-02-01',
          stock_class_id: 'class-002',
          new_ratio_conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: {
              numerator: '3',
              denominator: '2',
            },
            rounding_type: 'NORMAL',
          },
          comments: ['Anti-dilution adjustment'],
        });
      });

      test('direct reader rejects an unknown rounding type', () => {
        const damlData = {
          id: 'adj-unknown-rounding',
          date: '2024-02-01T00:00:00.000Z',
          stock_class_id: 'class-002',
          new_ratio_conversion_mechanism: {
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: { numerator: '3', denominator: '2' },
            rounding_type: 'OcfRoundingBankers',
          },
          comments: [],
        };

        expect(() =>
          damlStockClassConversionRatioAdjustmentToNative(
            damlData as unknown as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0]
          )
        ).toThrow(
          expect.objectContaining({
            name: OcpParseError.name,
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
            source: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type',
          })
        );
      });

      test.each([
        [
          'malformed price amount',
          { amount: 'not-a-number', currency: 'USD' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.amount',
          'DAML Numeric(10) decimal string',
          'not-a-number',
        ],
        [
          'price amount beyond Numeric 10 scale',
          { amount: '1.12345678901', currency: 'USD' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.amount',
          'DAML Numeric(10) decimal string',
          '1.12345678901',
        ],
        [
          'malformed currency',
          { amount: '1', currency: 'usd' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.currency',
          'three-letter uppercase currency code',
          'usd',
        ],
      ] as const)(
        'direct reader rejects %s at the exact monetary path',
        (_case, conversionPrice, fieldPath, expectedType, receivedValue) => {
          const damlData = {
            id: 'adj-invalid-price',
            date: '2024-02-01T00:00:00.000Z',
            stock_class_id: 'class-002',
            new_ratio_conversion_mechanism: {
              conversion_price: conversionPrice,
              ratio: { numerator: '3', denominator: '2' },
              rounding_type: 'OcfRoundingNormal' as const,
            },
            comments: [],
          };

          expect(() => damlStockClassConversionRatioAdjustmentToNative(damlData)).toThrow(
            expect.objectContaining({
              name: OcpValidationError.name,
              code: OcpErrorCodes.INVALID_FORMAT,
              fieldPath,
              expectedType,
              receivedValue,
            })
          );
        }
      );

      test.each([
        [
          'null mechanism',
          null,
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
          'object',
          null,
        ],
        [
          'missing ratio',
          { conversion_price: { amount: '0', currency: 'USD' }, rounding_type: 'OcfRoundingNormal' },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio',
          OcpErrorCodes.REQUIRED_FIELD_MISSING,
          'object',
          undefined,
        ],
        [
          'numeric numerator',
          {
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: { numerator: 3, denominator: '2' },
            rounding_type: 'OcfRoundingNormal',
          },
          'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator',
          OcpErrorCodes.INVALID_TYPE,
          'decimal string',
          3,
        ],
      ] as const)(
        'direct reader rejects %s before nested dereference',
        (_case, mechanism, fieldPath, code, expectedType, receivedValue) => {
          const damlData = {
            id: 'adj-invalid-shape',
            date: '2024-02-01T00:00:00.000Z',
            stock_class_id: 'class-002',
            new_ratio_conversion_mechanism: mechanism,
            comments: [],
          } as unknown as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0];

          expect(() => damlStockClassConversionRatioAdjustmentToNative(damlData)).toThrow(
            expect.objectContaining({
              name: OcpValidationError.name,
              code,
              fieldPath,
              expectedType,
              receivedValue,
            })
          );
        }
      );

      test('dedicated reader rejects an unknown rounding type', async () => {
        const getEventsByContractId = jest.fn().mockResolvedValue({
          created: {
            createdEvent: {
              templateId:
                Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment
                  .templateId,
              createArgument: {
                context: GENERATED_CONTEXT,
                adjustment_data: {
                  id: 'adj-unknown-rounding',
                  date: '2024-02-01T00:00:00.000Z',
                  stock_class_id: 'class-002',
                  new_ratio_conversion_mechanism: {
                    conversion_price: { amount: '0', currency: 'USD' },
                    ratio: { numerator: '3', denominator: '2' },
                    rounding_type: 'OcfRoundingBankers',
                  },
                  comments: [],
                },
              },
            },
          },
        });

        await expect(
          getStockClassConversionRatioAdjustmentAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
            contractId: 'adj-cid',
          })
        ).rejects.toMatchObject({
          name: OcpParseError.name,
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.rounding_type',
        });
      });

      test('dedicated and generic readers decode the complete generated template wrapper', async () => {
        const createArgument = {
          context: GENERATED_CONTEXT,
          adjustment_data: {
            id: 'adj-full-wrapper',
            date: '2024-02-01T00:00:00.000Z',
            stock_class_id: 'class-002',
            new_ratio_conversion_mechanism: {
              conversion_price: { amount: '0', currency: 'USD' },
              ratio: { numerator: '3', denominator: '2' },
              rounding_type: 'OcfRoundingNormal',
            },
            comments: [],
          },
        };
        const readers: ReadonlyArray<(client: LedgerJsonApiClient) => Promise<unknown>> = [
          async (client) =>
            getStockClassConversionRatioAdjustmentAsOcf(client, {
              contractId: 'adj-full-wrapper-cid',
            }),
          async (client) => getEntityAsOcf(client, 'stockClassConversionRatioAdjustment', 'adj-full-wrapper-cid'),
        ];

        for (const read of readers) {
          const getEventsByContractId = jest.fn().mockResolvedValue({
            created: {
              createdEvent: {
                templateId:
                  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment
                    .templateId,
                createArgument,
              },
            },
          });
          const { decoder } =
            Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment;
          const decodeSpy = jest.spyOn(decoder, 'runWithException');
          try {
            await expect(read({ getEventsByContractId } as unknown as LedgerJsonApiClient)).resolves.toBeDefined();
            expect(decodeSpy).toHaveBeenCalledWith(createArgument);
          } finally {
            decodeSpy.mockRestore();
          }
        }
      });

      test('dedicated reader rejects a missing adjustment_data wrapper with an exact source', async () => {
        const getEventsByContractId = jest.fn().mockResolvedValue({
          created: {
            createdEvent: {
              templateId:
                Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment
                  .templateId,
              createArgument: { context: GENERATED_CONTEXT },
            },
          },
        });

        await expect(
          getStockClassConversionRatioAdjustmentAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
            contractId: 'adj-missing-wrapper',
          })
        ).rejects.toMatchObject({
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'StockClassConversionRatioAdjustment.createArgument.adjustment_data',
          classification: 'invalid_generated_create_argument',
        });
      });

      test.each([
        [
          'missing context',
          {
            adjustment_data: {
              id: 'adj-wrapper-shape',
              date: '2024-02-01T00:00:00.000Z',
              stock_class_id: 'class-002',
              new_ratio_conversion_mechanism: {
                conversion_price: { amount: '0', currency: 'USD' },
                ratio: { numerator: '3', denominator: '2' },
                rounding_type: 'OcfRoundingNormal',
              },
              comments: [],
            },
          },
          'StockClassConversionRatioAdjustment.createArgument.context',
          'invalid_generated_create_argument',
        ],
        [
          'unexpected wrapper field',
          {
            context: GENERATED_CONTEXT,
            adjustment_data: {
              id: 'adj-wrapper-shape',
              date: '2024-02-01T00:00:00.000Z',
              stock_class_id: 'class-002',
              new_ratio_conversion_mechanism: {
                conversion_price: { amount: '0', currency: 'USD' },
                ratio: { numerator: '3', denominator: '2' },
                rounding_type: 'OcfRoundingNormal',
              },
              comments: [],
            },
            unexpected: true,
          },
          'StockClassConversionRatioAdjustment.createArgument.unexpected',
          'invalid_generated_daml_json',
        ],
      ] as const)(
        'dedicated reader rejects a create argument with %s',
        async (_case, createArgument, source, classification) => {
          const getEventsByContractId = jest.fn().mockResolvedValue({
            created: {
              createdEvent: {
                templateId:
                  Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment
                    .templateId,
                createArgument,
              },
            },
          });

          await expect(
            getStockClassConversionRatioAdjustmentAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
              contractId: 'adj-invalid-wrapper',
            })
          ).rejects.toMatchObject({
            name: OcpParseError.name,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source,
            classification,
          });
        }
      );

      test('dedicated reader rejects a null mechanism with a structured source', async () => {
        const getEventsByContractId = jest.fn().mockResolvedValue({
          created: {
            createdEvent: {
              templateId:
                Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment
                  .templateId,
              createArgument: {
                context: GENERATED_CONTEXT,
                adjustment_data: {
                  id: 'adj-null-mechanism',
                  date: '2024-02-01T00:00:00.000Z',
                  stock_class_id: 'class-002',
                  new_ratio_conversion_mechanism: null,
                  comments: [],
                },
              },
            },
          },
        });

        await expect(
          getStockClassConversionRatioAdjustmentAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, {
            contractId: 'adj-null-mechanism',
          })
        ).rejects.toMatchObject({
          name: OcpValidationError.name,
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
          expectedType: 'object',
          receivedValue: null,
        });
      });
    });

    describe('damlStockConsolidationToNative', () => {
      test('converts basic stock consolidation data', () => {
        const damlData = {
          id: 'consolidation-001',
          date: '2024-03-01T00:00:00.000Z',
          security_ids: ['sec-001', 'sec-002'],
          resulting_security_id: 'new-sec-001', // DAML has singular
          reason_text: 'Reverse split',
          comments: ['Consolidation comment'],
        };

        const result = damlStockConsolidationToNative(damlData);

        expect(result).toEqual({
          object_type: 'TX_STOCK_CONSOLIDATION',
          id: 'consolidation-001',
          date: '2024-03-01',
          security_ids: ['sec-001', 'sec-002'],
          resulting_security_id: 'new-sec-001',
          reason_text: 'Reverse split',
          comments: ['Consolidation comment'],
        });
      });

      test('handles null reason_text', () => {
        const damlData = {
          id: 'consolidation-002',
          date: '2024-03-01T00:00:00.000Z',
          security_ids: ['sec-001'],
          resulting_security_id: 'new-sec-001',
          reason_text: null,
          comments: [],
        };

        const result = damlStockConsolidationToNative(damlData);

        expect(result.reason_text).toBeUndefined();
      });
    });

    describe('damlStockReissuanceToNative', () => {
      test('converts basic stock reissuance data', () => {
        const damlData = {
          id: 'reissue-001',
          date: '2024-04-01T00:00:00.000Z',
          security_id: 'sec-cancelled-001',
          resulting_security_ids: ['sec-new-001', 'sec-new-002'],
          reason_text: 'Forfeiture expired',
          split_transaction_id: 'split-001',
          comments: ['Reissuance comment'],
        };

        const result = damlStockReissuanceToNative(damlData);

        expect(result).toEqual({
          object_type: 'TX_STOCK_REISSUANCE',
          id: 'reissue-001',
          date: '2024-04-01',
          security_id: 'sec-cancelled-001',
          resulting_security_ids: ['sec-new-001', 'sec-new-002'],
          reason_text: 'Forfeiture expired',
          split_transaction_id: 'split-001',
          comments: ['Reissuance comment'],
        });
      });

      test('handles null optional fields', () => {
        const damlData = {
          id: 'reissue-002',
          date: '2024-04-01T00:00:00.000Z',
          security_id: 'sec-cancelled-001',
          resulting_security_ids: ['sec-new-001'],
          reason_text: null,
          split_transaction_id: null,
          comments: [],
        };

        const result = damlStockReissuanceToNative(damlData);

        expect(result.reason_text).toBeUndefined();
        expect(result.split_transaction_id).toBeUndefined();
        expect(result.comments).toBeUndefined();
      });
    });
  });
});
