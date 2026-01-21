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

import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { damlStockConsolidationToNative } from '../../src/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import { damlStockReissuanceToNative } from '../../src/functions/OpenCapTable/stockReissuance/damlToStockReissuance';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
} from '../../src/types/native';

describe('Stock Class Adjustment Converters', () => {
  describe('OCF to DAML (ocfToDaml)', () => {
    describe('stockClassSplit', () => {
      const baseData: OcfStockClassSplit = {
        id: 'split-001',
        date: '2024-01-15',
        stock_class_id: 'class-001',
        split_ratio_numerator: '2',
        split_ratio_denominator: '1',
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
          split_ratio_numerator: 3,
          split_ratio_denominator: 1,
        };

        const result = convertToDaml('stockClassSplit', dataWithNumericRatio);
        const splitRatio = result.split_ratio as { numerator: string; denominator: string };

        expect(splitRatio.numerator).toBe('3');
        expect(splitRatio.denominator).toBe('1');
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
        id: 'adj-001',
        date: '2024-02-01',
        stock_class_id: 'class-002',
        new_ratio_numerator: '3',
        new_ratio_denominator: '2',
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
            rounding_type: 'OcfRoundingNormal',
          },
          comments: [],
        });
      });

      test('handles numeric ratio values', () => {
        const dataWithNumericRatio = {
          ...baseData,
          new_ratio_numerator: 5,
          new_ratio_denominator: 4,
        };

        const result = convertToDaml('stockClassConversionRatioAdjustment', dataWithNumericRatio);
        const mechanism = result.new_ratio_conversion_mechanism as {
          ratio: { numerator: string; denominator: string };
        };

        expect(mechanism.ratio.numerator).toBe('5');
        expect(mechanism.ratio.denominator).toBe('4');
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
    });

    describe('stockConsolidation', () => {
      const baseData: OcfStockConsolidation = {
        id: 'consolidation-001',
        date: '2024-03-01',
        security_ids: ['sec-001', 'sec-002', 'sec-003'],
        resulting_security_ids: ['new-sec-001'],
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

      test('takes first resulting security when multiple provided', () => {
        const dataWithMultipleResults = {
          ...baseData,
          resulting_security_ids: ['new-sec-001', 'new-sec-002'],
        };

        const result = convertToDaml('stockConsolidation', dataWithMultipleResults);

        // DAML only supports singular resulting_security_id, takes first
        expect(result.resulting_security_id).toBe('new-sec-001');
      });

      test('throws error when id is missing', () => {
        const invalidData = { ...baseData, id: '' };

        expect(() => convertToDaml('stockConsolidation', invalidData)).toThrow('stockConsolidation.id');
      });
    });

    describe('stockReissuance', () => {
      const baseData: OcfStockReissuance = {
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
          id: 'split-001',
          date: '2024-01-15',
          stock_class_id: 'class-001',
          split_ratio_numerator: '2',
          split_ratio_denominator: '1',
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
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: {
              numerator: '3.0000000000',
              denominator: '2.0000000000',
            },
            rounding_type: 'OcfRoundingNormal',
          },
          comments: ['Anti-dilution adjustment'],
        };

        const result = damlStockClassConversionRatioAdjustmentToNative(damlData);

        expect(result).toEqual({
          id: 'adj-001',
          date: '2024-02-01',
          stock_class_id: 'class-002',
          new_ratio_numerator: '3',
          new_ratio_denominator: '2',
          comments: ['Anti-dilution adjustment'],
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
          id: 'consolidation-001',
          date: '2024-03-01',
          security_ids: ['sec-001', 'sec-002'],
          resulting_security_ids: ['new-sec-001'], // OCF expects array
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
