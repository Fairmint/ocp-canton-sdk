/**
 * Unit tests for stock class adjustment type converters in ocfToDaml.ts
 *
 * Tests the OCF to DAML conversion for:
 * - StockClassSplit
 * - StockClassConversionRatioAdjustment
 * - StockConsolidation
 * - StockReissuance
 */

import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
} from '../../src/types/native';

describe('ocfToDaml - Stock Class Adjustments', () => {
  describe('stockClassSplit', () => {
    const baseData: OcfStockClassSplit = {
      id: 'split-001',
      date: '2024-01-15',
      stock_class_id: 'class-001',
      split_ratio_numerator: '2',
      split_ratio_denominator: '1',
    };

    test('converts basic stock class split', () => {
      const result = convertToDaml('stockClassSplit', baseData);

      expect(result).toEqual({
        id: 'split-001',
        date: expect.any(String), // DAML time format
        stock_class_id: 'class-001',
        split_ratio_numerator: '2',
        split_ratio_denominator: '1',
        board_approval_date: null,
        stockholder_approval_date: null,
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

      expect(result.split_ratio_numerator).toBe('3');
      expect(result.split_ratio_denominator).toBe('1');
    });

    test('converts with optional approval dates', () => {
      const dataWithDates = {
        ...baseData,
        board_approval_date: '2024-01-10',
        stockholder_approval_date: '2024-01-12',
      };

      const result = convertToDaml('stockClassSplit', dataWithDates);

      expect(result.board_approval_date).toBeTruthy();
      expect(result.stockholder_approval_date).toBeTruthy();
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

    test('converts basic conversion ratio adjustment', () => {
      const result = convertToDaml('stockClassConversionRatioAdjustment', baseData);

      expect(result).toEqual({
        id: 'adj-001',
        date: expect.any(String),
        stock_class_id: 'class-002',
        new_ratio_numerator: '3',
        new_ratio_denominator: '2',
        board_approval_date: null,
        stockholder_approval_date: null,
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

      expect(result.new_ratio_numerator).toBe('5');
      expect(result.new_ratio_denominator).toBe('4');
    });

    test('converts with optional fields', () => {
      const dataWithOptionals = {
        ...baseData,
        board_approval_date: '2024-01-25',
        stockholder_approval_date: '2024-01-28',
        comments: ['Ratio adjusted for anti-dilution'],
      };

      const result = convertToDaml('stockClassConversionRatioAdjustment', dataWithOptionals);

      expect(result.board_approval_date).toBeTruthy();
      expect(result.stockholder_approval_date).toBeTruthy();
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

    test('converts basic stock consolidation', () => {
      const result = convertToDaml('stockConsolidation', baseData);

      expect(result).toEqual({
        id: 'consolidation-001',
        date: expect.any(String),
        security_ids: ['sec-001', 'sec-002', 'sec-003'],
        resulting_security_ids: ['new-sec-001'],
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

    test('handles multiple resulting securities', () => {
      const dataWithMultipleResults = {
        ...baseData,
        resulting_security_ids: ['new-sec-001', 'new-sec-002'],
      };

      const result = convertToDaml('stockConsolidation', dataWithMultipleResults);

      expect(result.resulting_security_ids).toEqual(['new-sec-001', 'new-sec-002']);
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

    test('converts basic stock reissuance', () => {
      const result = convertToDaml('stockReissuance', baseData);

      expect(result).toEqual({
        id: 'reissue-001',
        date: expect.any(String),
        security_id: 'sec-cancelled-001',
        resulting_security_ids: ['sec-new-001', 'sec-new-002'],
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
