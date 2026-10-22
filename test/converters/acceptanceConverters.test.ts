/**
 * Unit tests for acceptance type converters.
 *
 * Tests both directions:
 * - OCF → DAML (via convertToDamlData)
 * - DAML → OCF (via damlXAcceptanceToNative functions)
 */

import { OcpValidationError } from '../../src/errors';
import { convertToDamlData } from '../../src/functions/OpenCapTable/capTable';
import { damlConvertibleAcceptanceToNative } from '../../src/functions/OpenCapTable/convertibleAcceptance';
import { damlEquityCompensationAcceptanceToNative } from '../../src/functions/OpenCapTable/equityCompensationAcceptance';
import { damlStockAcceptanceToNative } from '../../src/functions/OpenCapTable/stockAcceptance';
import { damlWarrantAcceptanceToNative } from '../../src/functions/OpenCapTable/warrantAcceptance';
import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../src/types';

/**
 * Common DAML acceptance data structure used for testing.
 */
interface DamlAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

describe('Acceptance Type Converters', () => {
  describe('OCF → DAML conversion (convertToDamlData)', () => {
    describe('stockAcceptance', () => {
      test('converts minimal stockAcceptance to DAML format', () => {
        const ocfData: OcfStockAcceptance = {
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'stock-accept-001',
          date: '2024-01-15',
          security_id: 'stock-sec-001',
        };

        const result = convertToDamlData('stockAcceptance', ocfData);

        expect(result).toEqual({
          id: 'stock-accept-001',
          date: '2024-01-15',
          security_id: 'stock-sec-001',
          comments: [],
        });
      });

      test('converts stockAcceptance with comments to DAML format', () => {
        const ocfData: OcfStockAcceptance = {
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'stock-accept-002',
          date: '2024-02-20',
          security_id: 'stock-sec-002',
          comments: ['Accepted by stakeholder', 'Board approved'],
        };

        const result = convertToDamlData('stockAcceptance', ocfData);

        expect(result).toEqual({
          id: 'stock-accept-002',
          date: '2024-02-20',
          security_id: 'stock-sec-002',
          comments: ['Accepted by stakeholder', 'Board approved'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: '',
          date: '2024-01-15',
          security_id: 'stock-sec-001',
        } as OcfStockAcceptance;

        expect(() => convertToDamlData('stockAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDamlData('stockAcceptance', ocfData)).toThrow('stockAcceptance.id');
      });

      test('rejects date values that include time portion', () => {
        const ocfData: OcfStockAcceptance = {
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'stock-accept-003',
          date: '2024-01-15T10:30:00.000Z',
          security_id: 'stock-sec-003',
        };

        expect(() => convertToDamlData('stockAcceptance', ocfData)).toThrow(OcpValidationError);
      });

      test('filters empty comments', () => {
        const ocfData: OcfStockAcceptance = {
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'stock-accept-004',
          date: '2024-01-15',
          security_id: 'stock-sec-004',
          comments: ['Valid comment', '', '  ', 'Another valid comment'],
        };

        const result = convertToDamlData('stockAcceptance', ocfData);

        expect(result.comments).toEqual(['Valid comment', 'Another valid comment']);
      });
    });

    describe('warrantAcceptance', () => {
      test('converts minimal warrantAcceptance to DAML format', () => {
        const ocfData: OcfWarrantAcceptance = {
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: 'warrant-accept-001',
          date: '2024-03-10',
          security_id: 'warrant-sec-001',
        };

        const result = convertToDamlData('warrantAcceptance', ocfData);

        expect(result).toEqual({
          id: 'warrant-accept-001',
          date: '2024-03-10',
          security_id: 'warrant-sec-001',
          comments: [],
        });
      });

      test('converts warrantAcceptance with comments', () => {
        const ocfData: OcfWarrantAcceptance = {
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: 'warrant-accept-002',
          date: '2024-03-15',
          security_id: 'warrant-sec-002',
          comments: ['Investor accepted warrant'],
        };

        const result = convertToDamlData('warrantAcceptance', ocfData);

        expect(result).toEqual({
          id: 'warrant-accept-002',
          date: '2024-03-15',
          security_id: 'warrant-sec-002',
          comments: ['Investor accepted warrant'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: '',
          date: '2024-03-10',
          security_id: 'warrant-sec-001',
        } as OcfWarrantAcceptance;

        expect(() => convertToDamlData('warrantAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDamlData('warrantAcceptance', ocfData)).toThrow('warrantAcceptance.id');
      });
    });

    describe('convertibleAcceptance', () => {
      test('converts minimal convertibleAcceptance to DAML format', () => {
        const ocfData: OcfConvertibleAcceptance = {
          object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
          id: 'conv-accept-001',
          date: '2024-04-05',
          security_id: 'conv-sec-001',
        };

        const result = convertToDamlData('convertibleAcceptance', ocfData);

        expect(result).toEqual({
          id: 'conv-accept-001',
          date: '2024-04-05',
          security_id: 'conv-sec-001',
          comments: [],
        });
      });

      test('converts convertibleAcceptance with comments', () => {
        const ocfData: OcfConvertibleAcceptance = {
          object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
          id: 'conv-accept-002',
          date: '2024-04-10',
          security_id: 'conv-sec-002',
          comments: ['SAFE note accepted', 'Terms reviewed'],
        };

        const result = convertToDamlData('convertibleAcceptance', ocfData);

        expect(result).toEqual({
          id: 'conv-accept-002',
          date: '2024-04-10',
          security_id: 'conv-sec-002',
          comments: ['SAFE note accepted', 'Terms reviewed'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
          id: '',
          date: '2024-04-05',
          security_id: 'conv-sec-001',
        } as OcfConvertibleAcceptance;

        expect(() => convertToDamlData('convertibleAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDamlData('convertibleAcceptance', ocfData)).toThrow('convertibleAcceptance.id');
      });
    });

    describe('equityCompensationAcceptance', () => {
      test('converts minimal equityCompensationAcceptance to DAML format', () => {
        const ocfData: OcfEquityCompensationAcceptance = {
          object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
          id: 'equity-accept-001',
          date: '2024-05-01',
          security_id: 'equity-sec-001',
        };

        const result = convertToDamlData('equityCompensationAcceptance', ocfData);

        expect(result).toEqual({
          id: 'equity-accept-001',
          date: '2024-05-01',
          security_id: 'equity-sec-001',
          comments: [],
        });
      });

      test('converts equityCompensationAcceptance with comments', () => {
        const ocfData: OcfEquityCompensationAcceptance = {
          object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
          id: 'equity-accept-002',
          date: '2024-05-15',
          security_id: 'equity-sec-002',
          comments: ['Option grant accepted', 'Vesting schedule acknowledged'],
        };

        const result = convertToDamlData('equityCompensationAcceptance', ocfData);

        expect(result).toEqual({
          id: 'equity-accept-002',
          date: '2024-05-15',
          security_id: 'equity-sec-002',
          comments: ['Option grant accepted', 'Vesting schedule acknowledged'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
          id: '',
          date: '2024-05-01',
          security_id: 'equity-sec-001',
        } as OcfEquityCompensationAcceptance;

        expect(() => convertToDamlData('equityCompensationAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDamlData('equityCompensationAcceptance', ocfData)).toThrow(
          'equityCompensationAcceptance.id'
        );
      });
    });
  });

  describe('DAML → OCF conversion', () => {
    const baseDamlData: DamlAcceptanceData = {
      id: 'test-accept-001',
      date: '2024-06-15',
      security_id: 'test-sec-001',
      comments: [],
    };

    const damlDataWithComments: DamlAcceptanceData = {
      id: 'test-accept-002',
      date: '2024-06-20',
      security_id: 'test-sec-002',
      comments: ['Comment 1', 'Comment 2'],
    };

    describe('damlStockAcceptanceToNative', () => {
      test('converts minimal DAML data to OCF format', () => {
        const result = damlStockAcceptanceToNative(baseDamlData);

        expect(result).toEqual({
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlStockAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
          object_type: 'TX_STOCK_ACCEPTANCE',
          id: 'test-accept-002',
          date: '2024-06-20',
          security_id: 'test-sec-002',
          comments: ['Comment 1', 'Comment 2'],
        });
      });

      test('excludes empty comments array', () => {
        const result = damlStockAcceptanceToNative(baseDamlData);

        expect(result).not.toHaveProperty('comments');
      });
    });

    describe('damlWarrantAcceptanceToNative', () => {
      test('converts minimal DAML data to OCF format', () => {
        const result = damlWarrantAcceptanceToNative(baseDamlData);

        expect(result).toEqual({
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlWarrantAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: 'test-accept-002',
          date: '2024-06-20',
          security_id: 'test-sec-002',
          comments: ['Comment 1', 'Comment 2'],
        });
      });
    });

    describe('damlConvertibleAcceptanceToNative', () => {
      test('converts minimal DAML data to OCF format', () => {
        const result = damlConvertibleAcceptanceToNative(baseDamlData);

        expect(result).toEqual({
          object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlConvertibleAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
          object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
          id: 'test-accept-002',
          date: '2024-06-20',
          security_id: 'test-sec-002',
          comments: ['Comment 1', 'Comment 2'],
        });
      });
    });

    describe('damlEquityCompensationAcceptanceToNative', () => {
      test('converts minimal DAML data to OCF format', () => {
        const result = damlEquityCompensationAcceptanceToNative(baseDamlData);

        expect(result).toEqual({
          object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlEquityCompensationAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
          object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
          id: 'test-accept-002',
          date: '2024-06-20',
          security_id: 'test-sec-002',
          comments: ['Comment 1', 'Comment 2'],
        });
      });
    });
  });

  describe('Round-trip conversion', () => {
    test('OCF → DAML → OCF preserves stockAcceptance data', () => {
      const original: OcfStockAcceptance = {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'round-trip-001',
        date: '2024-07-01',
        security_id: 'rt-sec-001',
        comments: ['Test comment'],
      };

      const damlData = convertToDamlData('stockAcceptance', original);
      const roundTripped = damlStockAcceptanceToNative(damlData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves warrantAcceptance data', () => {
      const original: OcfWarrantAcceptance = {
        object_type: 'TX_WARRANT_ACCEPTANCE',
        id: 'round-trip-002',
        date: '2024-07-02',
        security_id: 'rt-sec-002',
        comments: ['Warrant comment'],
      };

      const damlData = convertToDamlData('warrantAcceptance', original);
      const roundTripped = damlWarrantAcceptanceToNative(damlData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves convertibleAcceptance data', () => {
      const original: OcfConvertibleAcceptance = {
        object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
        id: 'round-trip-003',
        date: '2024-07-03',
        security_id: 'rt-sec-003',
        comments: ['Convertible comment'],
      };

      const damlData = convertToDamlData('convertibleAcceptance', original);
      const roundTripped = damlConvertibleAcceptanceToNative(damlData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves equityCompensationAcceptance data', () => {
      const original: OcfEquityCompensationAcceptance = {
        object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
        id: 'round-trip-004',
        date: '2024-07-04',
        security_id: 'rt-sec-004',
        comments: ['Equity comp comment'],
      };

      const damlData = convertToDamlData('equityCompensationAcceptance', original);
      const roundTripped = damlEquityCompensationAcceptanceToNative(damlData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves data without optional comments', () => {
      const original: OcfStockAcceptance = {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'round-trip-005',
        date: '2024-07-05',
        security_id: 'rt-sec-005',
      };

      const damlData = convertToDamlData('stockAcceptance', original);
      const roundTripped = damlStockAcceptanceToNative(damlData);

      expect(roundTripped).toEqual(original);
    });
  });
});
