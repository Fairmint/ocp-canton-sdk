/**
 * Unit tests for StockPlan type converters.
 *
 * Tests both OCF → DAML conversions for:
 * - StockPlan (including deprecated stock_class_id field handling)
 */

import { stockPlanDataToDaml } from '../../src/functions/OpenCapTable/stockPlan/createStockPlan';
import type { OcfStockPlan } from '../../src/types';

describe('StockPlan Converters', () => {
  describe('OCF → DAML (stockPlanDataToDaml)', () => {
    test('converts minimal stock plan data', () => {
      const ocfData: OcfStockPlan = {
        id: 'sp-001',
        plan_name: 'Employee Stock Option Pool',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-001'],
      };

      const damlData = stockPlanDataToDaml(ocfData);

      expect(damlData.id).toBe('sp-001');
      expect(damlData.plan_name).toBe('Employee Stock Option Pool');
      expect(damlData.initial_shares_reserved).toBe('1000000');
      expect(damlData.stock_class_ids).toEqual(['sc-001']);
    });

    test('converts stock plan with all optional fields', () => {
      const ocfData: OcfStockPlan = {
        id: 'sp-002',
        plan_name: 'Full Stock Plan',
        initial_shares_reserved: '2000000',
        stock_class_ids: ['sc-001', 'sc-002'],
        board_approval_date: '2024-01-15',
        stockholder_approval_date: '2024-01-20',
        default_cancellation_behavior: 'RETURN_TO_POOL',
        comments: ['Annual stock plan', 'Board approved'],
      };

      const damlData = stockPlanDataToDaml(ocfData);

      expect(damlData.plan_name).toBe('Full Stock Plan');
      expect(damlData.stock_class_ids).toEqual(['sc-001', 'sc-002']);
      expect(damlData.board_approval_date).toBe('2024-01-15T00:00:00.000Z');
      expect(damlData.stockholder_approval_date).toBe('2024-01-20T00:00:00.000Z');
      expect(damlData.default_cancellation_behavior).toBe('OcfPlanCancelReturnToPool');
      expect(damlData.comments).toEqual(['Annual stock plan', 'Board approved']);
    });

    test('handles numeric initial_shares_reserved', () => {
      const ocfData: OcfStockPlan = {
        id: 'sp-003',
        plan_name: 'Test Plan',
        initial_shares_reserved: 500000,
        stock_class_ids: ['sc-001'],
      };

      const damlData = stockPlanDataToDaml(ocfData);

      expect(damlData.initial_shares_reserved).toBe('500000');
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        id: '',
        plan_name: 'Test Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-001'],
      } as OcfStockPlan;

      expect(() => stockPlanDataToDaml(ocfData)).toThrow('stockPlan.id is required');
    });

    describe('deprecated stock_class_id field handling', () => {
      test('uses stock_class_ids when both fields are present (stock_class_ids takes precedence)', () => {
        const ocfDataWithBoth = {
          id: 'sp-deprecated-001',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-new-001', 'sc-new-002'],
          stock_class_id: 'sc-deprecated-001', // deprecated field
        } as OcfStockPlan & { stock_class_id?: string };

        const damlData = stockPlanDataToDaml(ocfDataWithBoth);

        expect(damlData.stock_class_ids).toEqual(['sc-new-001', 'sc-new-002']);
      });

      test('uses deprecated stock_class_id when stock_class_ids is empty', () => {
        const ocfDataWithDeprecated = {
          id: 'sp-deprecated-002',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: [],
          stock_class_id: 'sc-deprecated-001', // deprecated field
        } as OcfStockPlan & { stock_class_id?: string };

        const damlData = stockPlanDataToDaml(ocfDataWithDeprecated);

        expect(damlData.stock_class_ids).toEqual(['sc-deprecated-001']);
      });

      test('uses deprecated stock_class_id when stock_class_ids is undefined', () => {
        const ocfDataWithDeprecated = {
          id: 'sp-deprecated-003',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_id: 'sc-deprecated-001', // deprecated field
        } as unknown as OcfStockPlan;

        const damlData = stockPlanDataToDaml(ocfDataWithDeprecated);

        expect(damlData.stock_class_ids).toEqual(['sc-deprecated-001']);
      });

      test('returns empty array when neither field is provided', () => {
        const ocfDataNoStockClass = {
          id: 'sp-deprecated-004',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
        } as unknown as OcfStockPlan;

        const damlData = stockPlanDataToDaml(ocfDataNoStockClass);

        expect(damlData.stock_class_ids).toEqual([]);
      });

      test('returns empty array when stock_class_ids is empty and stock_class_id is undefined', () => {
        const ocfDataEmptyArray: OcfStockPlan = {
          id: 'sp-deprecated-005',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: [],
        };

        const damlData = stockPlanDataToDaml(ocfDataEmptyArray);

        expect(damlData.stock_class_ids).toEqual([]);
      });
    });

    describe('cancellation behavior enum conversion', () => {
      test('converts RETIRE cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-cancel-001',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001'],
          default_cancellation_behavior: 'RETIRE',
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.default_cancellation_behavior).toBe('OcfPlanCancelRetire');
      });

      test('converts RETURN_TO_POOL cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-cancel-002',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001'],
          default_cancellation_behavior: 'RETURN_TO_POOL',
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.default_cancellation_behavior).toBe('OcfPlanCancelReturnToPool');
      });

      test('converts HOLD_AS_CAPITAL_STOCK cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-cancel-003',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001'],
          default_cancellation_behavior: 'HOLD_AS_CAPITAL_STOCK',
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.default_cancellation_behavior).toBe('OcfPlanCancelHoldAsCapitalStock');
      });

      test('converts DEFINED_PER_PLAN_SECURITY cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-cancel-004',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001'],
          default_cancellation_behavior: 'DEFINED_PER_PLAN_SECURITY',
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.default_cancellation_behavior).toBe('OcfPlanCancelDefinedPerPlanSecurity');
      });

      test('handles undefined cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-cancel-005',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001'],
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.default_cancellation_behavior).toBeNull();
      });
    });
  });
});
