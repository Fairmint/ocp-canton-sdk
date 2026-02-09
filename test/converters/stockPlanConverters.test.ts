/**
 * Unit tests for StockPlan type converters.
 *
 * Tests OCF → DAML conversion for:
 * - StockPlan (including deprecated stock_class_id field handling)
 * - Automatic normalization via convertToDaml dispatcher
 */

import { OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
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
        initial_shares_reserved: '500000',
        stock_class_ids: ['sc-001'],
      };

      const damlData = stockPlanDataToDaml(ocfData);

      expect(damlData.initial_shares_reserved).toBe('500000');
    });

    test('throws OcpValidationError when id is missing', () => {
      const ocfData = {
        id: '',
        plan_name: 'Test Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-001'],
      } as OcfStockPlan;

      expect(() => stockPlanDataToDaml(ocfData)).toThrow(OcpValidationError);
      expect(() => stockPlanDataToDaml(ocfData)).toThrow("'stockPlan.id'");
    });

    describe('stock_class_ids field handling', () => {
      test('passes through stock_class_ids directly', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-001',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001', 'sc-002'],
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.stock_class_ids).toEqual(['sc-001', 'sc-002']);
      });

      test('passes empty array when stock_class_ids is empty', () => {
        const ocfData: OcfStockPlan = {
          id: 'sp-002',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: [],
        };

        const damlData = stockPlanDataToDaml(ocfData);

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

  describe('convertToDaml dispatches correctly', () => {
    test('converts stock plan via convertToDaml', () => {
      const data: OcfStockPlan = {
        id: 'sp-batch-001',
        plan_name: 'Batch Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-001'],
      };

      const damlData = convertToDaml('stockPlan', data);

      expect(damlData.stock_class_ids).toEqual(['sc-001']);
      expect(damlData.plan_name).toBe('Batch Plan');
    });
  });
});
