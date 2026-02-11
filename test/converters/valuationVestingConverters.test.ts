/**
 * Unit tests for valuation and vesting type converters.
 *
 * Tests both OCF → DAML and DAML → OCF conversions for:
 * - Valuation
 * - VestingStart
 * - VestingEvent
 * - VestingAcceleration
 */

import { OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  damlValuationToNative,
  damlValuationTypeToNative,
  type DamlValuationData,
} from '../../src/functions/OpenCapTable/valuation/damlToOcf';
import {
  damlVestingAccelerationToNative,
  type DamlVestingAccelerationData,
} from '../../src/functions/OpenCapTable/vestingAcceleration/damlToOcf';
import {
  damlVestingEventToNative,
  type DamlVestingEventData,
} from '../../src/functions/OpenCapTable/vestingEvent/damlToOcf';
import {
  damlVestingStartToNative,
  type DamlVestingStartData,
} from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import type {
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfVestingTerms,
} from '../../src/types';

describe('Valuation Converters', () => {
  describe('OCF → DAML (valuationDataToDaml)', () => {
    test('converts minimal valuation data', () => {
      const ocfData: OcfValuation = {
        id: 'val-001',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.id).toBe('val-001');
      expect(damlData.stock_class_id).toBe('sc-001');
      expect(damlData.price_per_share).toEqual({ amount: '1.50', currency: 'USD' });
      expect(damlData.effective_date).toBe('2024-01-15T00:00:00.000Z');
      expect(damlData.valuation_type).toBe('OcfValuationType409A');
    });

    test('converts valuation with all optional fields', () => {
      const ocfData: OcfValuation = {
        id: 'val-002',
        stock_class_id: 'sc-002',
        price_per_share: { amount: '2.00', currency: 'USD' },
        effective_date: '2024-02-01',
        valuation_type: '409A',
        provider: 'Valuation Services Inc.',
        board_approval_date: '2024-01-20',
        stockholder_approval_date: '2024-01-25',
        comments: ['Annual 409A valuation', 'Approved by board'],
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.provider).toBe('Valuation Services Inc.');
      expect(damlData.board_approval_date).toBe('2024-01-20T00:00:00.000Z');
      expect(damlData.stockholder_approval_date).toBe('2024-01-25T00:00:00.000Z');
      expect(damlData.comments).toEqual(['Annual 409A valuation', 'Approved by board']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        id: '',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      } as OcfValuation;

      expect(() => convertToDaml('valuation', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('valuation', ocfData)).toThrow("'valuation.id'");
    });

    test('handles string amount', () => {
      const ocfData: OcfValuation = {
        id: 'val-003',
        stock_class_id: 'sc-003',
        price_per_share: { amount: '1.5', currency: 'USD' },
        effective_date: '2024-01-15',
        valuation_type: '409A',
      };

      const damlData = convertToDaml('valuation', ocfData);

      expect(damlData.price_per_share).toEqual({ amount: '1.5', currency: 'USD' });
    });
  });

  describe('DAML → OCF (damlValuationToNative)', () => {
    test('converts minimal valuation data', () => {
      const damlData: DamlValuationData = {
        id: 'val-001',
        stock_class_id: 'sc-001',
        price_per_share: { amount: '1.50', currency: 'USD' },
        effective_date: '2024-01-15T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: null,
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.id).toBe('val-001');
      expect(ocfData.stock_class_id).toBe('sc-001');
      expect(ocfData.price_per_share).toEqual({ amount: '1.5', currency: 'USD' });
      expect(ocfData.effective_date).toBe('2024-01-15');
      expect(ocfData.valuation_type).toBe('409A');
      expect(ocfData.provider).toBeUndefined();
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts valuation with all optional fields', () => {
      const damlData: DamlValuationData = {
        id: 'val-002',
        stock_class_id: 'sc-002',
        price_per_share: { amount: '2.0000000000', currency: 'USD' },
        effective_date: '2024-02-01T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: 'Valuation Services Inc.',
        board_approval_date: '2024-01-20T00:00:00.000Z',
        stockholder_approval_date: '2024-01-25T00:00:00.000Z',
        comments: ['Annual 409A valuation', 'Approved by board'],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.provider).toBe('Valuation Services Inc.');
      expect(ocfData.board_approval_date).toBe('2024-01-20');
      expect(ocfData.stockholder_approval_date).toBe('2024-01-25');
      expect(ocfData.comments).toEqual(['Annual 409A valuation', 'Approved by board']);
    });

    test('normalizes DAML numeric values', () => {
      const damlData: DamlValuationData = {
        id: 'val-003',
        stock_class_id: 'sc-003',
        price_per_share: { amount: '1.5000000000', currency: 'USD' },
        effective_date: '2024-01-15T00:00:00.000Z',
        valuation_type: 'OcfValuationType409A',
        provider: null,
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
      };

      const ocfData = damlValuationToNative(damlData);

      expect(ocfData.price_per_share.amount).toBe('1.5');
    });
  });

  describe('damlValuationTypeToNative', () => {
    test('converts known valuation types', () => {
      expect(damlValuationTypeToNative('OcfValuationType409A')).toBe('409A');
    });

    test('throws error for unknown valuation type', () => {
      expect(() => damlValuationTypeToNative('UnknownType')).toThrow(OcpParseError);
      expect(() => damlValuationTypeToNative('UnknownType')).toThrow('Unknown DAML valuation type');
    });
  });

  describe('round-trip conversion', () => {
    test('OCF → DAML → OCF preserves data', () => {
      // Use a value without trailing zeros to avoid normalization differences
      const originalOcf: OcfValuation = {
        id: 'val-roundtrip',
        stock_class_id: 'sc-roundtrip',
        price_per_share: { amount: '3.5', currency: 'USD' },
        effective_date: '2024-03-15',
        valuation_type: '409A',
        provider: 'Test Provider',
        board_approval_date: '2024-03-10',
        comments: ['Test comment'],
      };

      const damlData = convertToDaml('valuation', originalOcf) as unknown as DamlValuationData;
      // Simulate DAML null handling for missing optional fields
      damlData.stockholder_approval_date = damlData.stockholder_approval_date ?? null;
      const roundTrippedOcf = damlValuationToNative(damlData);

      expect(roundTrippedOcf.id).toBe(originalOcf.id);
      expect(roundTrippedOcf.stock_class_id).toBe(originalOcf.stock_class_id);
      expect(roundTrippedOcf.price_per_share).toEqual(originalOcf.price_per_share);
      expect(roundTrippedOcf.effective_date).toBe(originalOcf.effective_date);
      expect(roundTrippedOcf.valuation_type).toBe(originalOcf.valuation_type);
      expect(roundTrippedOcf.provider).toBe(originalOcf.provider);
      expect(roundTrippedOcf.board_approval_date).toBe(originalOcf.board_approval_date);
      expect(roundTrippedOcf.comments).toEqual(originalOcf.comments);
    });
  });
});

describe('VestingStart Converters', () => {
  describe('OCF → DAML (vestingStartDataToDaml)', () => {
    test('converts minimal vesting start data', () => {
      const ocfData: OcfVestingStart = {
        id: 'vs-001',
        date: '2024-01-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
      };

      const damlData = convertToDaml('vestingStart', ocfData);

      expect(damlData.id).toBe('vs-001');
      expect(damlData.date).toBe('2024-01-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.vesting_condition_id).toBe('vc-001');
    });

    test('converts vesting start with comments', () => {
      const ocfData: OcfVestingStart = {
        id: 'vs-002',
        date: '2024-02-01',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-002',
        comments: ['Employee start date'],
      };

      const damlData = convertToDaml('vestingStart', ocfData);

      expect(damlData.comments).toEqual(['Employee start date']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        id: '',
        date: '2024-01-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
      } as OcfVestingStart;

      expect(() => convertToDaml('vestingStart', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingStart', ocfData)).toThrow("'vestingStart.id'");
    });
  });

  describe('DAML → OCF (damlVestingStartToNative)', () => {
    test('converts minimal vesting start data', () => {
      const damlData: DamlVestingStartData = {
        id: 'vs-001',
        date: '2024-01-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-001',
        comments: [],
      };

      const ocfData = damlVestingStartToNative(damlData);

      expect(ocfData.id).toBe('vs-001');
      expect(ocfData.date).toBe('2024-01-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.vesting_condition_id).toBe('vc-001');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting start with comments', () => {
      const damlData: DamlVestingStartData = {
        id: 'vs-002',
        date: '2024-02-01T00:00:00.000Z',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-002',
        comments: ['Employee start date'],
      };

      const ocfData = damlVestingStartToNative(damlData);

      expect(ocfData.comments).toEqual(['Employee start date']);
    });
  });
});

describe('VestingTerms Converters', () => {
  describe('OCF -> DAML (vestingTermsDataToDaml)', () => {
    test('defaults portion.remainder to false when omitted', () => {
      const ocfData = {
        id: 'vt-001',
        name: 'Standard Vesting',
        description: '4-year vesting with cliff',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            portion: {
              numerator: '1',
              denominator: '4',
            },
            trigger: {
              type: 'VESTING_START_DATE',
            },
            next_condition_ids: [],
          },
        ],
      } as unknown as OcfVestingTerms;

      const damlData = convertToDaml('vestingTerms', ocfData) as {
        vesting_conditions: Array<{ portion: { numerator: string; denominator: string; remainder: boolean } }>;
      };

      expect(damlData.vesting_conditions[0].portion).toEqual({
        numerator: '1',
        denominator: '4',
        remainder: false,
      });

      // Ensure command payload remains pure JSON with no undefined fields.
      const serialized = JSON.parse(JSON.stringify(damlData));
      expect(serialized.vesting_conditions[0].portion.remainder).toBe(false);
    });

    test('preserves provided portion.remainder value', () => {
      const ocfData: OcfVestingTerms = {
        id: 'vt-002',
        name: 'Remainder Vesting',
        description: 'Remainder flag explicitly set',
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [
          {
            id: 'start',
            portion: {
              numerator: '1',
              denominator: '4',
              remainder: true,
            },
            trigger: { kind: 'START' },
            next_condition_ids: [],
          },
        ],
      };

      const damlData = convertToDaml('vestingTerms', ocfData) as {
        vesting_conditions: Array<{ portion: { numerator: string; denominator: string; remainder: boolean } }>;
      };

      expect(damlData.vesting_conditions[0].portion).toEqual({
        numerator: '1',
        denominator: '4',
        remainder: true,
      });
    });
  });
});

describe('VestingEvent Converters', () => {
  describe('OCF → DAML (vestingEventDataToDaml)', () => {
    test('converts minimal vesting event data', () => {
      const ocfData: OcfVestingEvent = {
        id: 've-001',
        date: '2024-06-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
      };

      const damlData = convertToDaml('vestingEvent', ocfData);

      expect(damlData.id).toBe('ve-001');
      expect(damlData.date).toBe('2024-06-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.vesting_condition_id).toBe('vc-milestone-001');
    });

    test('converts vesting event with comments', () => {
      const ocfData: OcfVestingEvent = {
        id: 've-002',
        date: '2024-07-01',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-milestone-002',
        comments: ['Milestone achieved: Series A funding'],
      };

      const damlData = convertToDaml('vestingEvent', ocfData);

      expect(damlData.comments).toEqual(['Milestone achieved: Series A funding']);
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        id: '',
        date: '2024-06-01',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
      } as OcfVestingEvent;

      expect(() => convertToDaml('vestingEvent', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingEvent', ocfData)).toThrow("'vestingEvent.id'");
    });
  });

  describe('DAML → OCF (damlVestingEventToNative)', () => {
    test('converts minimal vesting event data', () => {
      const damlData: DamlVestingEventData = {
        id: 've-001',
        date: '2024-06-01T00:00:00.000Z',
        security_id: 'sec-001',
        vesting_condition_id: 'vc-milestone-001',
        comments: [],
      };

      const ocfData = damlVestingEventToNative(damlData);

      expect(ocfData.id).toBe('ve-001');
      expect(ocfData.date).toBe('2024-06-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.vesting_condition_id).toBe('vc-milestone-001');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting event with comments', () => {
      const damlData: DamlVestingEventData = {
        id: 've-002',
        date: '2024-07-01T00:00:00.000Z',
        security_id: 'sec-002',
        vesting_condition_id: 'vc-milestone-002',
        comments: ['Milestone achieved: Series A funding'],
      };

      const ocfData = damlVestingEventToNative(damlData);

      expect(ocfData.comments).toEqual(['Milestone achieved: Series A funding']);
    });
  });
});

describe('VestingAcceleration Converters', () => {
  describe('OCF → DAML (vestingAccelerationDataToDaml)', () => {
    test('converts minimal vesting acceleration data', () => {
      const ocfData: OcfVestingAcceleration = {
        id: 'va-001',
        date: '2024-12-01',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.id).toBe('va-001');
      expect(damlData.date).toBe('2024-12-01T00:00:00.000Z');
      expect(damlData.security_id).toBe('sec-001');
      expect(damlData.quantity).toBe('10000');
      expect(damlData.reason_text).toBe('Company acquisition');
    });

    test('converts vesting acceleration with all fields', () => {
      const ocfData: OcfVestingAcceleration = {
        id: 'va-002',
        date: '2024-12-15',
        security_id: 'sec-002',
        quantity: '25000',
        reason_text: 'Single-trigger acceleration due to M&A',
        comments: ['Accelerated upon change of control', 'Per employment agreement section 4.3'],
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.reason_text).toBe('Single-trigger acceleration due to M&A');
      expect(damlData.comments).toEqual(['Accelerated upon change of control', 'Per employment agreement section 4.3']);
    });

    test('handles numeric quantity', () => {
      const ocfData: OcfVestingAcceleration = {
        id: 'va-003',
        date: '2024-12-01',
        security_id: 'sec-003',
        quantity: '15000',
        reason_text: 'Termination without cause',
      };

      const damlData = convertToDaml('vestingAcceleration', ocfData);

      expect(damlData.quantity).toBe('15000');
    });

    test('throws error when id is missing', () => {
      const ocfData = {
        id: '',
        date: '2024-12-01',
        security_id: 'sec-001',
        quantity: '10000',
        reason_text: 'Company acquisition',
      } as OcfVestingAcceleration;

      expect(() => convertToDaml('vestingAcceleration', ocfData)).toThrow(OcpValidationError);
      expect(() => convertToDaml('vestingAcceleration', ocfData)).toThrow("'vestingAcceleration.id'");
    });
  });

  describe('DAML → OCF (damlVestingAccelerationToNative)', () => {
    test('converts minimal vesting acceleration data', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-001',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-001',
        quantity: '10000.0000000000',
        reason_text: 'Company acquisition',
        comments: [],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.id).toBe('va-001');
      expect(ocfData.date).toBe('2024-12-01');
      expect(ocfData.security_id).toBe('sec-001');
      expect(ocfData.quantity).toBe('10000');
      expect(ocfData.reason_text).toBe('Company acquisition');
      expect(ocfData.comments).toBeUndefined();
    });

    test('converts vesting acceleration with all fields', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-002',
        date: '2024-12-15T00:00:00.000Z',
        security_id: 'sec-002',
        quantity: '25000',
        reason_text: 'Single-trigger acceleration due to M&A',
        comments: ['Accelerated upon change of control', 'Per employment agreement section 4.3'],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.reason_text).toBe('Single-trigger acceleration due to M&A');
      expect(ocfData.comments).toEqual(['Accelerated upon change of control', 'Per employment agreement section 4.3']);
    });

    test('normalizes DAML numeric values', () => {
      const damlData: DamlVestingAccelerationData = {
        id: 'va-003',
        date: '2024-12-01T00:00:00.000Z',
        security_id: 'sec-003',
        quantity: '15000.5000000000',
        reason_text: 'Partial acceleration',
        comments: [],
      };

      const ocfData = damlVestingAccelerationToNative(damlData);

      expect(ocfData.quantity).toBe('15000.5');
    });
  });

  describe('round-trip conversion', () => {
    test('OCF → DAML → OCF preserves data', () => {
      const originalOcf: OcfVestingAcceleration = {
        id: 'va-roundtrip',
        date: '2024-12-31',
        security_id: 'sec-roundtrip',
        quantity: '50000',
        reason_text: 'Double-trigger acceleration',
        comments: ['Per employment agreement'],
      };

      const damlData = convertToDaml('vestingAcceleration', originalOcf) as unknown as DamlVestingAccelerationData;
      const roundTrippedOcf = damlVestingAccelerationToNative(damlData);

      expect(roundTrippedOcf.id).toBe(originalOcf.id);
      expect(roundTrippedOcf.date).toBe(originalOcf.date);
      expect(roundTrippedOcf.security_id).toBe(originalOcf.security_id);
      expect(roundTrippedOcf.quantity).toBe(originalOcf.quantity);
      expect(roundTrippedOcf.reason_text).toBe(originalOcf.reason_text);
      expect(roundTrippedOcf.comments).toEqual(originalOcf.comments);
    });
  });
});
