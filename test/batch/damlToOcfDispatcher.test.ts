/**
 * Tests for the damlToOcf dispatcher and helper functions.
 */

import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  convertToOcf,
  ENTITY_DATA_FIELD_MAP,
  extractCreateArgument,
  extractEntityData,
  type SupportedOcfReadType,
} from '../../src/functions/OpenCapTable/capTable/damlToOcf';

describe('damlToOcf dispatcher', () => {
  describe('extractCreateArgument', () => {
    it('extracts createArgument from valid events response', () => {
      const eventsResponse = {
        created: {
          createdEvent: {
            createArgument: { id: 'test', data: 'value' },
          },
        },
      };

      const result = extractCreateArgument(eventsResponse, 'contract-123');
      expect(result).toEqual({ id: 'test', data: 'value' });
    });

    it('throws OcpParseError when created event is missing', () => {
      const eventsResponse = {};

      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(OcpParseError);
      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(
        'Invalid contract events response: missing created event'
      );
    });

    it('throws OcpParseError when createArgument is missing', () => {
      const eventsResponse = {
        created: {
          createdEvent: {},
        },
      };

      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(OcpParseError);
      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(
        'Invalid contract events response: missing create argument'
      );
    });

    it('includes contract ID in error context', () => {
      const eventsResponse = {};

      try {
        extractCreateArgument(eventsResponse, 'my-contract-456');
      } catch (e) {
        const error = e as OcpParseError;
        expect(error.source).toBe('contract my-contract-456');
        expect(error.code).toBe(OcpErrorCodes.INVALID_RESPONSE);
      }
    });
  });

  describe('extractEntityData', () => {
    it('extracts entity data for stakeholder', () => {
      const createArgument = {
        stakeholder_data: { id: 'sh-1', name: { legal_name: 'Test Corp' } },
      };

      const result = extractEntityData('stakeholder', createArgument);
      expect(result).toEqual({ id: 'sh-1', name: { legal_name: 'Test Corp' } });
    });

    it('extracts entity data for stockAcceptance', () => {
      const createArgument = {
        acceptance_data: { id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' },
      };

      const result = extractEntityData('stockAcceptance', createArgument);
      expect(result).toEqual({ id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' });
    });

    it('throws when createArgument is not an object', () => {
      expect(() => extractEntityData('stakeholder', null)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', 'string')).toThrow(OcpParseError);
    });

    it('throws when expected field is missing', () => {
      const createArgument = { wrong_field: { id: 'test' } };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(
        "Expected field 'stakeholder_data' not found"
      );
    });

    it('throws when entity data is not an object', () => {
      const createArgument = { stakeholder_data: 'not an object' };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', createArgument)).toThrow('is not an object');
    });
  });

  describe('ENTITY_DATA_FIELD_MAP', () => {
    it('has mappings for all supported entity types', () => {
      const supportedTypes: SupportedOcfReadType[] = [
        'stockAcceptance',
        'convertibleAcceptance',
        'equityCompensationAcceptance',
        'warrantAcceptance',
        'valuation',
        'vestingStart',
        'vestingEvent',
        'vestingAcceleration',
        'stockReissuance',
        'stockClassSplit',
        'stockConsolidation',
        'stockClassConversionRatioAdjustment',
      ];

      for (const type of supportedTypes) {
        expect(ENTITY_DATA_FIELD_MAP[type]).toBeDefined();
        expect(typeof ENTITY_DATA_FIELD_MAP[type]).toBe('string');
      }
    });

    it('maps acceptance types to acceptance_data', () => {
      expect(ENTITY_DATA_FIELD_MAP.stockAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.convertibleAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.warrantAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.equityCompensationAcceptance).toBe('acceptance_data');
    });
  });

  describe('convertToOcf', () => {
    describe('acceptance types', () => {
      it('converts stockAcceptance', () => {
        const damlData = {
          id: 'acc-1',
          date: '2025-01-15T00:00:00Z',
          security_id: 'sec-1',
          comments: [],
        };

        const result = convertToOcf('stockAcceptance', damlData);

        expect(result.id).toBe('acc-1');
        expect(result.date).toBe('2025-01-15');
        expect(result.security_id).toBe('sec-1');
      });

      it('converts convertibleAcceptance', () => {
        const damlData = {
          id: 'conv-acc-1',
          date: '2025-02-20T00:00:00Z',
          security_id: 'conv-sec-1',
          comments: ['test comment'],
        };

        const result = convertToOcf('convertibleAcceptance', damlData);

        expect(result.id).toBe('conv-acc-1');
        expect(result.security_id).toBe('conv-sec-1');
        expect(result.comments).toEqual(['test comment']);
      });
    });

    describe('valuation', () => {
      it('converts valuation with all fields', () => {
        const damlData = {
          id: 'val-1',
          stock_class_id: 'sc-1',
          provider: 'Test Provider',
          board_approval_date: '2025-01-10T00:00:00Z',
          stockholder_approval_date: null,
          price_per_share: { amount: '10.00', currency: 'USD' },
          effective_date: '2025-01-15T00:00:00Z',
          valuation_type: 'OcfValuationType409A',
          comments: [],
        };

        const result = convertToOcf('valuation', damlData);

        expect(result.id).toBe('val-1');
        expect(result.stock_class_id).toBe('sc-1');
        expect(result.provider).toBe('Test Provider');
        // damlMonetaryToNative normalizes amounts
        expect(result.price_per_share).toEqual({ amount: '10', currency: 'USD' });
        expect(result.valuation_type).toBe('409A');
      });
    });

    describe('vesting types', () => {
      it('converts vestingStart', () => {
        const damlData = {
          id: 'vs-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
          comments: [],
        };

        const result = convertToOcf('vestingStart', damlData);

        expect(result.id).toBe('vs-1');
        expect(result.security_id).toBe('sec-1');
        expect(result.vesting_condition_id).toBe('vc-1');
      });

      it('converts vestingEvent', () => {
        const damlData = {
          id: 've-1',
          date: '2025-06-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
          comments: [],
        };

        const result = convertToOcf('vestingEvent', damlData);

        expect(result.id).toBe('ve-1');
        expect(result.vesting_condition_id).toBe('vc-1');
      });

      it('converts vestingAcceleration', () => {
        const damlData = {
          id: 'va-1',
          date: '2025-06-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '1000',
          reason_text: 'Early exit',
          comments: [],
        };

        const result = convertToOcf('vestingAcceleration', damlData);

        expect(result.id).toBe('va-1');
        expect(result.quantity).toBe('1000');
        expect(result.reason_text).toBe('Early exit');
      });
    });

    describe('transfer types', () => {
      it('converts stockTransfer', () => {
        const damlData = {
          id: 'xfer-1',
          date: '2025-03-15T00:00:00Z',
          security_id: 'sec-1',
          resulting_security_ids: ['sec-2'],
          balance_security_id: 'sec-3',
          consideration_text: 'Sale to investor',
          comments: [],
        };

        const result = convertToOcf('stockTransfer', damlData);

        expect(result.id).toBe('xfer-1');
        expect(result.resulting_security_ids).toEqual(['sec-2']);
        expect((result as Record<string, unknown>).balance_security_id).toBe('sec-3');
      });

      it('converts convertibleTransfer using shared pattern', () => {
        const damlData = {
          id: 'conv-xfer-1',
          date: '2025-03-15T00:00:00Z',
          security_id: 'conv-sec-1',
          resulting_security_ids: ['conv-sec-2'],
          comments: [],
        };

        const result = convertToOcf('convertibleTransfer', damlData);

        expect(result.id).toBe('conv-xfer-1');
        expect(result.resulting_security_ids).toEqual(['conv-sec-2']);
      });
    });

    describe('cancellation types', () => {
      it('converts stockCancellation', () => {
        const damlData = {
          id: 'cancel-1',
          date: '2025-04-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '500',
          balance_security_id: 'sec-2',
          reason_text: 'Cancelled by issuer',
          comments: [],
        };

        const result = convertToOcf('stockCancellation', damlData);

        expect(result.id).toBe('cancel-1');
        expect(result.quantity).toBe('500');
        expect((result as Record<string, unknown>).reason_text).toBe('Cancelled by issuer');
      });
    });

    describe('stock class adjustments', () => {
      it('converts stockClassSplit', () => {
        const damlData = {
          id: 'split-1',
          date: '2025-05-01T00:00:00Z',
          stock_class_id: 'sc-1',
          split_ratio: { numerator: '2', denominator: '1' },
          comments: [],
        };

        const result = convertToOcf('stockClassSplit', damlData);

        expect(result.id).toBe('split-1');
        expect(result.stock_class_id).toBe('sc-1');
        // Split ratio is flattened to separate fields
        expect(result.split_ratio_numerator).toBe('2');
        expect(result.split_ratio_denominator).toBe('1');
      });
    });

    describe('error handling', () => {
      it('throws OcpParseError for unsupported entity type', () => {
        expect(() => convertToOcf('unsupported' as SupportedOcfReadType, {})).toThrow(OcpParseError);
      });

      it('includes entity type in error message', () => {
        try {
          convertToOcf('unsupported' as SupportedOcfReadType, {});
        } catch (e) {
          const error = e as OcpParseError;
          expect(error.message).toContain('unsupported');
          expect(error.code).toBe(OcpErrorCodes.UNKNOWN_ENTITY_TYPE);
        }
      });
    });
  });
});
