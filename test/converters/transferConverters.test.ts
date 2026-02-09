/**
 * Unit tests for Transfer Type converters.
 *
 * Tests OCF→DAML conversions for:
 * - StockTransfer
 * - ConvertibleTransfer
 * - EquityCompensationTransfer
 * - WarrantTransfer
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import type {
  OcfConvertibleTransfer,
  OcfEquityCompensationTransfer,
  OcfStockTransfer,
  OcfWarrantTransfer,
} from '../../src/types/native';

describe('Transfer Type Converters', () => {
  describe('OCF→DAML Converters (convertToDaml)', () => {
    describe('stockTransfer', () => {
      it('converts stock transfer with all fields', () => {
        const input: OcfStockTransfer = {
          id: 'st-001',
          date: '2025-08-05',
          security_id: 'sec-001',
          quantity: '1000',
          resulting_security_ids: ['result-001', 'result-002'],
          balance_security_id: 'balance-001',
          consideration_text: 'Transfer consideration',
          comments: ['Comment 1'],
        };

        const result = convertToDaml('stockTransfer', input);

        expect(result.id).toBe('st-001');
        expect(result.security_id).toBe('sec-001');
        expect(result.quantity).toBe('1000');
        expect(result.resulting_security_ids).toEqual(['result-001', 'result-002']);
        expect(result.balance_security_id).toBe('balance-001');
        expect(result.consideration_text).toBe('Transfer consideration');
        expect(result.comments).toEqual(['Comment 1']);
        // Date is converted to DAML time format
        expect(result.date).toContain('2025-08-05');
      });

      it('converts stock transfer with minimal fields', () => {
        const input: OcfStockTransfer = {
          id: 'st-002',
          date: '2025-08-06',
          security_id: 'sec-002',
          quantity: '500',
          resulting_security_ids: ['result-003'],
        };

        const result = convertToDaml('stockTransfer', input);

        expect(result.id).toBe('st-002');
        expect(result.quantity).toBe('500');
        expect(result.resulting_security_ids).toEqual(['result-003']);
        expect(result.balance_security_id).toBeNull();
        expect(result.consideration_text).toBeNull();
        expect(result.comments).toEqual([]);
      });

      it('throws OcpValidationError when resulting_security_ids is empty', () => {
        const input: OcfStockTransfer = {
          id: 'st-error-1',
          date: '2025-08-05',
          security_id: 'sec-001',
          quantity: '1000',
          resulting_security_ids: [], // Empty array should throw
        };

        expect(() => convertToDaml('stockTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('stockTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('stockTransfer.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('convertibleTransfer', () => {
      it('converts convertible transfer with all fields', () => {
        const input: OcfConvertibleTransfer = {
          id: 'ct-001',
          date: '2025-08-10',
          security_id: 'conv-sec-001',
          amount: { amount: '50000', currency: 'USD' },
          resulting_security_ids: ['conv-result-001'],
          balance_security_id: 'conv-balance-001',
          consideration_text: 'Note transfer',
          comments: ['Transfer comment'],
        };

        const result = convertToDaml('convertibleTransfer', input);

        expect(result.id).toBe('ct-001');
        expect(result.security_id).toBe('conv-sec-001');
        expect(result.amount).toEqual({ amount: '50000', currency: 'USD' });
        expect(result.resulting_security_ids).toEqual(['conv-result-001']);
        expect(result.balance_security_id).toBe('conv-balance-001');
        expect(result.consideration_text).toBe('Note transfer');
      });

      it('converts convertible transfer with minimal fields', () => {
        const input: OcfConvertibleTransfer = {
          id: 'ct-002',
          date: '2025-08-11',
          security_id: 'conv-sec-002',
          amount: { amount: '25000', currency: 'EUR' },
          resulting_security_ids: ['conv-result-002'],
        };

        const result = convertToDaml('convertibleTransfer', input);

        expect(result.id).toBe('ct-002');
        expect(result.amount).toEqual({ amount: '25000', currency: 'EUR' });
        expect(result.balance_security_id).toBeNull();
        expect(result.consideration_text).toBeNull();
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2025-08-10',
          security_id: 'conv-sec-001',
          amount: { amount: '50000', currency: 'USD' },
          resulting_security_ids: ['conv-result-001'],
        } as OcfConvertibleTransfer;

        expect(() => convertToDaml('convertibleTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('convertibleTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('convertibleTransfer.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });

      it('throws OcpValidationError when resulting_security_ids is empty', () => {
        const input: OcfConvertibleTransfer = {
          id: 'ct-error-1',
          date: '2025-08-10',
          security_id: 'conv-sec-001',
          amount: { amount: '50000', currency: 'USD' },
          resulting_security_ids: [], // Empty array should throw
        };

        expect(() => convertToDaml('convertibleTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('convertibleTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('convertibleTransfer.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('equityCompensationTransfer', () => {
      it('converts equity compensation transfer with all fields', () => {
        const input: OcfEquityCompensationTransfer = {
          id: 'ect-001',
          date: '2025-08-15',
          security_id: 'eq-sec-001',
          quantity: '10000',
          resulting_security_ids: ['eq-result-001'],
          balance_security_id: 'eq-balance-001',
          consideration_text: 'Option transfer',
          comments: ['Equity transfer comment'],
        };

        const result = convertToDaml('equityCompensationTransfer', input);

        expect(result.id).toBe('ect-001');
        expect(result.security_id).toBe('eq-sec-001');
        expect(result.quantity).toBe('10000');
        expect(result.resulting_security_ids).toEqual(['eq-result-001']);
        expect(result.balance_security_id).toBe('eq-balance-001');
        expect(result.consideration_text).toBe('Option transfer');
      });

      it('converts equity compensation transfer with minimal fields', () => {
        const input: OcfEquityCompensationTransfer = {
          id: 'ect-002',
          date: '2025-08-16',
          security_id: 'eq-sec-002',
          quantity: '5000',
          resulting_security_ids: ['eq-result-002'],
        };

        const result = convertToDaml('equityCompensationTransfer', input);

        expect(result.id).toBe('ect-002');
        expect(result.quantity).toBe('5000');
        expect(result.balance_security_id).toBeNull();
        expect(result.consideration_text).toBeNull();
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2025-08-15',
          security_id: 'eq-sec-001',
          quantity: '10000',
          resulting_security_ids: ['eq-result-001'],
        } as OcfEquityCompensationTransfer;

        expect(() => convertToDaml('equityCompensationTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('equityCompensationTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('equityCompensationTransfer.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });

      it('throws OcpValidationError when resulting_security_ids is empty', () => {
        const input: OcfEquityCompensationTransfer = {
          id: 'ect-error-1',
          date: '2025-08-15',
          security_id: 'eq-sec-001',
          quantity: '10000',
          resulting_security_ids: [], // Empty array should throw
        };

        expect(() => convertToDaml('equityCompensationTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('equityCompensationTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('equityCompensationTransfer.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('warrantTransfer', () => {
      it('converts warrant transfer with all fields', () => {
        const input: OcfWarrantTransfer = {
          id: 'wt-001',
          date: '2025-08-20',
          security_id: 'warrant-sec-001',
          quantity: '2500',
          resulting_security_ids: ['warrant-result-001', 'warrant-result-002'],
          balance_security_id: 'warrant-balance-001',
          consideration_text: 'Warrant transfer',
          comments: ['Warrant comment'],
        };

        const result = convertToDaml('warrantTransfer', input);

        expect(result.id).toBe('wt-001');
        expect(result.security_id).toBe('warrant-sec-001');
        expect(result.quantity).toBe('2500');
        expect(result.resulting_security_ids).toEqual(['warrant-result-001', 'warrant-result-002']);
        expect(result.balance_security_id).toBe('warrant-balance-001');
        expect(result.consideration_text).toBe('Warrant transfer');
      });

      it('converts warrant transfer with minimal fields', () => {
        const input: OcfWarrantTransfer = {
          id: 'wt-002',
          date: '2025-08-21',
          security_id: 'warrant-sec-002',
          quantity: '1000',
          resulting_security_ids: ['warrant-result-003'],
        };

        const result = convertToDaml('warrantTransfer', input);

        expect(result.id).toBe('wt-002');
        expect(result.quantity).toBe('1000');
        expect(result.balance_security_id).toBeNull();
        expect(result.consideration_text).toBeNull();
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2025-08-20',
          security_id: 'warrant-sec-001',
          quantity: '2500',
          resulting_security_ids: ['warrant-result-001'],
        } as OcfWarrantTransfer;

        expect(() => convertToDaml('warrantTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('warrantTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('warrantTransfer.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });

      it('throws OcpValidationError when resulting_security_ids is empty', () => {
        const input: OcfWarrantTransfer = {
          id: 'wt-error-1',
          date: '2025-08-20',
          security_id: 'warrant-sec-001',
          quantity: '2500',
          resulting_security_ids: [], // Empty array should throw
        };

        expect(() => convertToDaml('warrantTransfer', input)).toThrow(OcpValidationError);
        try {
          convertToDaml('warrantTransfer', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('warrantTransfer.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });
  });

  describe('Numeric quantity handling', () => {
    it('handles string quantity', () => {
      const input: OcfStockTransfer = {
        id: 'st-num-1',
        date: '2025-08-05',
        security_id: 'sec-001',
        quantity: '1000.5',
        resulting_security_ids: ['result-001'],
      };

      const result = convertToDaml('stockTransfer', input);
      expect(result.quantity).toBe('1000.5');
    });

    it('handles string quantity', () => {
      const input: OcfStockTransfer = {
        id: 'st-num-2',
        date: '2025-08-05',
        security_id: 'sec-001',
        quantity: '1000',
        resulting_security_ids: ['result-001'],
      };

      const result = convertToDaml('stockTransfer', input);
      expect(result.quantity).toBe('1000');
    });
  });

  describe('Date conversion', () => {
    it('converts date string to DAML time format', () => {
      const input: OcfStockTransfer = {
        id: 'st-date-1',
        date: '2025-08-05',
        security_id: 'sec-001',
        quantity: '1000',
        resulting_security_ids: ['result-001'],
      };

      const result = convertToDaml('stockTransfer', input);
      expect(result.date).toContain('2025-08-05');
      expect(result.date).toContain('T');
    });
  });

  describe('Comments handling', () => {
    it('filters empty comments array', () => {
      const input: OcfStockTransfer = {
        id: 'st-comments-1',
        date: '2025-08-05',
        security_id: 'sec-001',
        quantity: '1000',
        resulting_security_ids: ['result-001'],
        comments: [],
      };

      const result = convertToDaml('stockTransfer', input);
      expect(result.comments).toEqual([]);
    });

    it('preserves non-empty comments', () => {
      const input: OcfStockTransfer = {
        id: 'st-comments-2',
        date: '2025-08-05',
        security_id: 'sec-001',
        quantity: '1000',
        resulting_security_ids: ['result-001'],
        comments: ['Comment 1', 'Comment 2'],
      };

      const result = convertToDaml('stockTransfer', input);
      expect(result.comments).toEqual(['Comment 1', 'Comment 2']);
    });
  });
});
