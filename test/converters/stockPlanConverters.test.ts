/**
 * Unit tests for StockPlan type converters.
 *
 * Tests OCF → DAML conversion for:
 * - StockPlan canonical non-empty stock_class_ids handling
 * - Automatic normalization via convertToDaml dispatcher
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { stockPlanDataToDaml } from '../../src/functions/OpenCapTable/stockPlan/createStockPlan';
import { damlStockPlanDataToNative } from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import type { OcfStockPlan } from '../../src/types';

describe('StockPlan Converters', () => {
  test.each([
    ['convertToDaml', (input: OcfStockPlan) => convertToDaml('stockPlan', input)],
    [
      'CapTableBatch.create',
      (input: OcfStockPlan) =>
        new CapTableBatch({ capTableContractId: 'cap-table-1', actAs: ['issuer::party'] }).create('stockPlan', input),
    ],
  ] as const)('%s rejects the deprecated singular stock_class_id key', (_case, write) => {
    const legacyStockPlan = {
      object_type: 'STOCK_PLAN',
      id: 'legacy-stock-plan',
      plan_name: 'Legacy Plan',
      initial_shares_reserved: '1000',
      stock_class_id: 'stock-class-1',
    } as unknown as OcfStockPlan;

    expect(() => write(legacyStockPlan)).toThrow(
      expect.objectContaining({
        fieldPath: 'stock_class_id',
        code: 'INVALID_FORMAT',
      })
    );
  });

  describe('OCF → DAML (stockPlanDataToDaml)', () => {
    test('converts minimal stock plan data', () => {
      const ocfData: OcfStockPlan = {
        object_type: 'STOCK_PLAN',
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
        object_type: 'STOCK_PLAN',
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
        object_type: 'STOCK_PLAN',
        id: 'sp-003',
        plan_name: 'Test Plan',
        initial_shares_reserved: '500000',
        stock_class_ids: ['sc-001'],
      };

      const damlData = stockPlanDataToDaml(ocfData);

      expect(damlData.initial_shares_reserved).toBe('500000');
    });

    test('canonicalizes a schema-valid leading-plus Numeric 10 value', () => {
      const ocfData: OcfStockPlan = {
        object_type: 'STOCK_PLAN',
        id: 'sp-plus',
        plan_name: 'Plus Plan',
        initial_shares_reserved: '+000500000.0000000000',
        stock_class_ids: ['sc-001'],
      };

      expect(stockPlanDataToDaml(ocfData).initial_shares_reserved).toBe('500000');
    });

    test('throws OcpValidationError when id is missing', () => {
      const ocfData = {
        object_type: 'STOCK_PLAN',
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
          object_type: 'STOCK_PLAN',
          id: 'sp-001',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: ['sc-001', 'sc-002'],
        };

        const damlData = stockPlanDataToDaml(ocfData);

        expect(damlData.stock_class_ids).toEqual(['sc-001', 'sc-002']);
      });

      test('throws OcpValidationError when stock_class_ids is absent at runtime', () => {
        const ocfData = {
          object_type: 'STOCK_PLAN',
          id: 'sp-missing',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
        } as unknown as OcfStockPlan;

        expect(() => stockPlanDataToDaml(ocfData)).toThrow(OcpValidationError);
        expect(() => stockPlanDataToDaml(ocfData)).toThrow('stock_class_ids');
      });

      test('throws OcpValidationError when stock_class_ids is empty at runtime', () => {
        const ocfData = {
          object_type: 'STOCK_PLAN',
          id: 'sp-empty',
          plan_name: 'Test Plan',
          initial_shares_reserved: '1000000',
          stock_class_ids: [],
        } as unknown as OcfStockPlan;

        expect(() => stockPlanDataToDaml(ocfData)).toThrow(OcpValidationError);
      });
    });

    describe('cancellation behavior enum conversion', () => {
      test('converts RETIRE cancellation behavior', () => {
        const ocfData: OcfStockPlan = {
          object_type: 'STOCK_PLAN',
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
          object_type: 'STOCK_PLAN',
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
          object_type: 'STOCK_PLAN',
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
          object_type: 'STOCK_PLAN',
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
          object_type: 'STOCK_PLAN',
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
        object_type: 'STOCK_PLAN',
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

  describe('DAML → OCF (damlStockPlanDataToNative)', () => {
    const damlData = {
      id: 'sp-read-001',
      plan_name: 'Read Plan',
      board_approval_date: null,
      stockholder_approval_date: null,
      initial_shares_reserved: '1000',
      default_cancellation_behavior: null,
      stock_class_ids: ['sc-001'],
      comments: [],
    };

    function convert(value: object) {
      return damlStockPlanDataToNative(value as unknown as Parameters<typeof damlStockPlanDataToNative>[0]);
    }

    test('returns a canonical non-empty stock_class_ids tuple', () => {
      expect(convert(damlData).stock_class_ids).toEqual(['sc-001']);
    });

    test('rejects an empty stock_class_ids array from the ledger', () => {
      expect(() => convert({ ...damlData, stock_class_ids: [] })).toThrow(OcpValidationError);
    });

    test.each([
      ['unknown root field', { unexpected: true }, 'stockPlan.unexpected'],
      ['malformed comments', { comments: 42 }, 'stockPlan.comments'],
    ])('rejects %s losslessly', (_case, fields, source) => {
      expect(() => convert({ ...damlData, ...fields })).toThrow(
        expect.objectContaining({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source })
      );
    });
  });
});
