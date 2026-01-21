/**
 * Unit tests for acceptance type converters.
 *
 * Tests both directions:
 * - OCF → DAML (via convertToDaml)
 * - DAML → OCF (via damlXAcceptanceToNative functions)
 */

import { OcpValidationError } from '../../src/errors';
import {
  convertAcceptanceFromDaml,
  convertToDaml,
  damlConvertibleAcceptanceToNative,
  damlEquityCompensationAcceptanceToNative,
  damlStockAcceptanceToNative,
  damlWarrantAcceptanceToNative,
  type DamlAcceptanceData,
} from '../../src/functions/OpenCapTable/capTable';
import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../src/types';

describe('Acceptance Type Converters', () => {
  describe('OCF → DAML conversion (convertToDaml)', () => {
    describe('stockAcceptance', () => {
      test('converts minimal stockAcceptance to DAML format', () => {
        const ocfData: OcfStockAcceptance = {
          id: 'stock-accept-001',
          date: '2024-01-15',
          security_id: 'stock-sec-001',
        };

        const result = convertToDaml('stockAcceptance', ocfData);

        expect(result).toEqual({
          id: 'stock-accept-001',
          date: '2024-01-15T00:00:00.000Z',
          security_id: 'stock-sec-001',
          comments: [],
        });
      });

      test('converts stockAcceptance with comments to DAML format', () => {
        const ocfData: OcfStockAcceptance = {
          id: 'stock-accept-002',
          date: '2024-02-20',
          security_id: 'stock-sec-002',
          comments: ['Accepted by stakeholder', 'Board approved'],
        };

        const result = convertToDaml('stockAcceptance', ocfData);

        expect(result).toEqual({
          id: 'stock-accept-002',
          date: '2024-02-20T00:00:00.000Z',
          security_id: 'stock-sec-002',
          comments: ['Accepted by stakeholder', 'Board approved'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          id: '',
          date: '2024-01-15',
          security_id: 'stock-sec-001',
        } as OcfStockAcceptance;

        expect(() => convertToDaml('stockAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDaml('stockAcceptance', ocfData)).toThrow('stockAcceptance.id');
      });

      test('preserves date with time portion', () => {
        const ocfData: OcfStockAcceptance = {
          id: 'stock-accept-003',
          date: '2024-01-15T10:30:00.000Z',
          security_id: 'stock-sec-003',
        };

        const result = convertToDaml('stockAcceptance', ocfData);

        expect(result.date).toBe('2024-01-15T10:30:00.000Z');
      });

      test('filters empty comments', () => {
        const ocfData: OcfStockAcceptance = {
          id: 'stock-accept-004',
          date: '2024-01-15',
          security_id: 'stock-sec-004',
          comments: ['Valid comment', '', '  ', 'Another valid comment'],
        };

        const result = convertToDaml('stockAcceptance', ocfData);

        expect(result.comments).toEqual(['Valid comment', 'Another valid comment']);
      });
    });

    describe('warrantAcceptance', () => {
      test('converts minimal warrantAcceptance to DAML format', () => {
        const ocfData: OcfWarrantAcceptance = {
          id: 'warrant-accept-001',
          date: '2024-03-10',
          security_id: 'warrant-sec-001',
        };

        const result = convertToDaml('warrantAcceptance', ocfData);

        expect(result).toEqual({
          id: 'warrant-accept-001',
          date: '2024-03-10T00:00:00.000Z',
          security_id: 'warrant-sec-001',
          comments: [],
        });
      });

      test('converts warrantAcceptance with comments', () => {
        const ocfData: OcfWarrantAcceptance = {
          id: 'warrant-accept-002',
          date: '2024-03-15',
          security_id: 'warrant-sec-002',
          comments: ['Investor accepted warrant'],
        };

        const result = convertToDaml('warrantAcceptance', ocfData);

        expect(result).toEqual({
          id: 'warrant-accept-002',
          date: '2024-03-15T00:00:00.000Z',
          security_id: 'warrant-sec-002',
          comments: ['Investor accepted warrant'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          id: '',
          date: '2024-03-10',
          security_id: 'warrant-sec-001',
        } as OcfWarrantAcceptance;

        expect(() => convertToDaml('warrantAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDaml('warrantAcceptance', ocfData)).toThrow('warrantAcceptance.id');
      });
    });

    describe('convertibleAcceptance', () => {
      test('converts minimal convertibleAcceptance to DAML format', () => {
        const ocfData: OcfConvertibleAcceptance = {
          id: 'conv-accept-001',
          date: '2024-04-05',
          security_id: 'conv-sec-001',
        };

        const result = convertToDaml('convertibleAcceptance', ocfData);

        expect(result).toEqual({
          id: 'conv-accept-001',
          date: '2024-04-05T00:00:00.000Z',
          security_id: 'conv-sec-001',
          comments: [],
        });
      });

      test('converts convertibleAcceptance with comments', () => {
        const ocfData: OcfConvertibleAcceptance = {
          id: 'conv-accept-002',
          date: '2024-04-10',
          security_id: 'conv-sec-002',
          comments: ['SAFE note accepted', 'Terms reviewed'],
        };

        const result = convertToDaml('convertibleAcceptance', ocfData);

        expect(result).toEqual({
          id: 'conv-accept-002',
          date: '2024-04-10T00:00:00.000Z',
          security_id: 'conv-sec-002',
          comments: ['SAFE note accepted', 'Terms reviewed'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          id: '',
          date: '2024-04-05',
          security_id: 'conv-sec-001',
        } as OcfConvertibleAcceptance;

        expect(() => convertToDaml('convertibleAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDaml('convertibleAcceptance', ocfData)).toThrow('convertibleAcceptance.id');
      });
    });

    describe('equityCompensationAcceptance', () => {
      test('converts minimal equityCompensationAcceptance to DAML format', () => {
        const ocfData: OcfEquityCompensationAcceptance = {
          id: 'equity-accept-001',
          date: '2024-05-01',
          security_id: 'equity-sec-001',
        };

        const result = convertToDaml('equityCompensationAcceptance', ocfData);

        expect(result).toEqual({
          id: 'equity-accept-001',
          date: '2024-05-01T00:00:00.000Z',
          security_id: 'equity-sec-001',
          comments: [],
        });
      });

      test('converts equityCompensationAcceptance with comments', () => {
        const ocfData: OcfEquityCompensationAcceptance = {
          id: 'equity-accept-002',
          date: '2024-05-15',
          security_id: 'equity-sec-002',
          comments: ['Option grant accepted', 'Vesting schedule acknowledged'],
        };

        const result = convertToDaml('equityCompensationAcceptance', ocfData);

        expect(result).toEqual({
          id: 'equity-accept-002',
          date: '2024-05-15T00:00:00.000Z',
          security_id: 'equity-sec-002',
          comments: ['Option grant accepted', 'Vesting schedule acknowledged'],
        });
      });

      test('throws error when id is missing', () => {
        const ocfData = {
          id: '',
          date: '2024-05-01',
          security_id: 'equity-sec-001',
        } as OcfEquityCompensationAcceptance;

        expect(() => convertToDaml('equityCompensationAcceptance', ocfData)).toThrow(OcpValidationError);
        expect(() => convertToDaml('equityCompensationAcceptance', ocfData)).toThrow('equityCompensationAcceptance.id');
      });
    });
  });

  describe('DAML → OCF conversion', () => {
    const baseDamlData: DamlAcceptanceData = {
      id: 'test-accept-001',
      date: '2024-06-15T00:00:00.000Z',
      security_id: 'test-sec-001',
      comments: [],
    };

    const damlDataWithComments: DamlAcceptanceData = {
      id: 'test-accept-002',
      date: '2024-06-20T12:30:45.123Z',
      security_id: 'test-sec-002',
      comments: ['Comment 1', 'Comment 2'],
    };

    describe('damlStockAcceptanceToNative', () => {
      test('converts minimal DAML data to OCF format', () => {
        const result = damlStockAcceptanceToNative(baseDamlData);

        expect(result).toEqual({
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlStockAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
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
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlWarrantAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
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
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlConvertibleAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
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
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('converts DAML data with comments to OCF format', () => {
        const result = damlEquityCompensationAcceptanceToNative(damlDataWithComments);

        expect(result).toEqual({
          id: 'test-accept-002',
          date: '2024-06-20',
          security_id: 'test-sec-002',
          comments: ['Comment 1', 'Comment 2'],
        });
      });
    });

    describe('convertAcceptanceFromDaml (dispatcher)', () => {
      test('dispatches stockAcceptance correctly', () => {
        const result = convertAcceptanceFromDaml('stockAcceptance', baseDamlData);

        expect(result).toEqual({
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('dispatches warrantAcceptance correctly', () => {
        const result = convertAcceptanceFromDaml('warrantAcceptance', baseDamlData);

        expect(result).toEqual({
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('dispatches convertibleAcceptance correctly', () => {
        const result = convertAcceptanceFromDaml('convertibleAcceptance', baseDamlData);

        expect(result).toEqual({
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });

      test('dispatches equityCompensationAcceptance correctly', () => {
        const result = convertAcceptanceFromDaml('equityCompensationAcceptance', baseDamlData);

        expect(result).toEqual({
          id: 'test-accept-001',
          date: '2024-06-15',
          security_id: 'test-sec-001',
        });
      });
    });
  });

  describe('Round-trip conversion', () => {
    test('OCF → DAML → OCF preserves stockAcceptance data', () => {
      const original: OcfStockAcceptance = {
        id: 'round-trip-001',
        date: '2024-07-01',
        security_id: 'rt-sec-001',
        comments: ['Test comment'],
      };

      const damlData = convertToDaml('stockAcceptance', original);
      const roundTripped = damlStockAcceptanceToNative(damlData as unknown as DamlAcceptanceData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves warrantAcceptance data', () => {
      const original: OcfWarrantAcceptance = {
        id: 'round-trip-002',
        date: '2024-07-02',
        security_id: 'rt-sec-002',
        comments: ['Warrant comment'],
      };

      const damlData = convertToDaml('warrantAcceptance', original);
      const roundTripped = damlWarrantAcceptanceToNative(damlData as unknown as DamlAcceptanceData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves convertibleAcceptance data', () => {
      const original: OcfConvertibleAcceptance = {
        id: 'round-trip-003',
        date: '2024-07-03',
        security_id: 'rt-sec-003',
        comments: ['Convertible comment'],
      };

      const damlData = convertToDaml('convertibleAcceptance', original);
      const roundTripped = damlConvertibleAcceptanceToNative(damlData as unknown as DamlAcceptanceData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves equityCompensationAcceptance data', () => {
      const original: OcfEquityCompensationAcceptance = {
        id: 'round-trip-004',
        date: '2024-07-04',
        security_id: 'rt-sec-004',
        comments: ['Equity comp comment'],
      };

      const damlData = convertToDaml('equityCompensationAcceptance', original);
      const roundTripped = damlEquityCompensationAcceptanceToNative(damlData as unknown as DamlAcceptanceData);

      expect(roundTripped).toEqual(original);
    });

    test('OCF → DAML → OCF preserves data without optional comments', () => {
      const original: OcfStockAcceptance = {
        id: 'round-trip-005',
        date: '2024-07-05',
        security_id: 'rt-sec-005',
      };

      const damlData = convertToDaml('stockAcceptance', original);
      const roundTripped = damlStockAcceptanceToNative(damlData as unknown as DamlAcceptanceData);

      expect(roundTripped).toEqual(original);
    });
  });
});
