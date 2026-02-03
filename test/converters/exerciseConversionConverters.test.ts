/**
 * Unit tests for exercise and conversion type converters.
 *
 * Tests the OCF → DAML and DAML → OCF conversion functions for:
 * - WarrantExercise
 * - ConvertibleConversion
 * - StockConversion
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { getConvertibleConversionAsOcf } from '../../src/functions/OpenCapTable/convertibleConversion';
import { getStockConversionAsOcf } from '../../src/functions/OpenCapTable/stockConversion';
import { getWarrantExerciseAsOcf } from '../../src/functions/OpenCapTable/warrantExercise';
import type { OcfConvertibleConversion, OcfStockConversion, OcfWarrantExercise } from '../../src/types/native';

// Mock client factory for DAML → OCF converter tests
function createMockClient(createArgument: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          createArgument,
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('Exercise and Conversion Type Converters', () => {
  describe('WarrantExercise', () => {
    describe('OCF → DAML (convertToDaml)', () => {
      const validWarrantExerciseData: OcfWarrantExercise = {
        id: 'we-001',
        date: '2024-01-15',
        security_id: 'warrant-sec-001',
        trigger_id: 'trigger-001',
        quantity: '5000',
        resulting_security_ids: ['stock-sec-001', 'stock-sec-002'],
        balance_security_id: 'warrant-sec-002',
        consideration_text: 'Exercise consideration',
        comments: ['Test comment'],
      };

      test('converts valid warrant exercise data', () => {
        const result = convertToDaml('warrantExercise', validWarrantExerciseData);

        expect(result.id).toBe('we-001');
        expect(result.date).toBe('2024-01-15T00:00:00.000Z');
        expect(result.security_id).toBe('warrant-sec-001');
        expect(result.quantity).toBe('5000');
        expect(result.resulting_security_ids).toEqual(['stock-sec-001', 'stock-sec-002']);
        expect(result.balance_security_id).toBe('warrant-sec-002');
        expect(result.consideration_text).toBe('Exercise consideration');
        expect(result.comments).toEqual(['Test comment']);
      });

      test('converts numeric quantity to string', () => {
        const dataWithNumericQuantity = {
          ...validWarrantExerciseData,
          quantity: 5000,
        };

        const result = convertToDaml('warrantExercise', dataWithNumericQuantity);
        expect(result.quantity).toBe('5000');
      });

      test('handles optional fields as null', () => {
        const minimalData: OcfWarrantExercise = {
          id: 'we-002',
          date: '2024-01-15',
          security_id: 'warrant-sec-003',
          trigger_id: 'trigger-002',
          quantity: '1000',
          resulting_security_ids: ['stock-sec-003'],
        };

        const result = convertToDaml('warrantExercise', minimalData);

        expect(result.id).toBe('we-002');
        expect(result.balance_security_id).toBeNull();
        expect(result.consideration_text).toBeNull();
        expect(result.comments).toEqual([]);
      });

      test('throws OcpValidationError when id is missing', () => {
        const invalidData = {
          ...validWarrantExerciseData,
          id: '',
        };

        expect(() => convertToDaml('warrantExercise', invalidData)).toThrow(OcpValidationError);
        try {
          convertToDaml('warrantExercise', invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('warrantExercise.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('DAML → OCF (getWarrantExerciseAsOcf)', () => {
      test('converts valid DAML warrant exercise event', async () => {
        const mockClient = createMockClient({
          exercise_data: {
            id: 'we-001',
            date: '2024-01-15T00:00:00.000Z',
            security_id: 'warrant-sec-001',
            trigger_id: 'trigger-001',
            quantity: '5000.0000000000',
            resulting_security_ids: ['stock-sec-001', 'stock-sec-002'],
            balance_security_id: 'warrant-sec-002',
            consideration_text: 'Exercise consideration',
            comments: ['Test comment'],
          },
        });

        const result = await getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.object_type).toBe('TX_WARRANT_EXERCISE');
        expect(result.event.id).toBe('we-001');
        expect(result.event.date).toBe('2024-01-15');
        expect(result.event.security_id).toBe('warrant-sec-001');
        expect(result.event.trigger_id).toBe('trigger-001');
        expect(result.event.quantity).toBe('5000');
        expect(result.event.resulting_security_ids).toEqual(['stock-sec-001', 'stock-sec-002']);
        expect(result.event.balance_security_id).toBe('warrant-sec-002');
        expect(result.event.consideration_text).toBe('Exercise consideration');
        expect(result.event.comments).toEqual(['Test comment']);
      });

      test('handles numeric quantity from DAML', async () => {
        const mockClient = createMockClient({
          exercise_data: {
            id: 'we-002',
            date: '2024-01-15T00:00:00.000Z',
            security_id: 'warrant-sec-003',
            trigger_id: 'trigger-002',
            quantity: 5000,
            resulting_security_ids: ['stock-sec-003'],
          },
        });

        const result = await getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' });
        expect(result.event.quantity).toBe('5000');
      });

      test('omits optional fields when not present', async () => {
        const mockClient = createMockClient({
          exercise_data: {
            id: 'we-003',
            date: '2024-01-15T00:00:00.000Z',
            security_id: 'warrant-sec-004',
            trigger_id: 'trigger-003',
            quantity: '1000',
            resulting_security_ids: ['stock-sec-004'],
          },
        });

        const result = await getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.balance_security_id).toBeUndefined();
        expect(result.event.consideration_text).toBeUndefined();
        expect(result.event.comments).toBeUndefined();
      });

      test('throws OcpValidationError when quantity is missing', async () => {
        const mockClient = createMockClient({
          exercise_data: {
            id: 'we-004',
            date: '2024-01-15T00:00:00.000Z',
            security_id: 'warrant-sec-005',
            trigger_id: 'trigger-004',
            resulting_security_ids: ['stock-sec-005'],
          },
        });

        await expect(getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' })).rejects.toThrow(
          OcpValidationError
        );
        try {
          await getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' });
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('warrantExercise.quantity');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });

      test('throws OcpValidationError when resulting_security_ids is empty', async () => {
        const mockClient = createMockClient({
          exercise_data: {
            id: 'we-005',
            date: '2024-01-15T00:00:00.000Z',
            security_id: 'warrant-sec-006',
            trigger_id: 'trigger-005',
            quantity: '1000',
            resulting_security_ids: [],
          },
        });

        await expect(getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' })).rejects.toThrow(
          OcpValidationError
        );
        try {
          await getWarrantExerciseAsOcf(mockClient, { contractId: 'test-contract' });
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('warrantExercise.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });
  });

  describe('ConvertibleConversion', () => {
    describe('OCF → DAML (convertToDaml)', () => {
      const validConvertibleConversionData: OcfConvertibleConversion = {
        id: 'cc-001',
        date: '2024-02-20',
        security_id: 'convertible-sec-001',
        resulting_security_ids: ['stock-sec-001'],
        balance_security_id: 'convertible-sec-002',
        trigger_id: 'trigger-001',
        comments: ['Converted on financing round'],
      };

      test('converts valid convertible conversion data', () => {
        const result = convertToDaml('convertibleConversion', validConvertibleConversionData);

        expect(result.id).toBe('cc-001');
        expect(result.date).toBe('2024-02-20T00:00:00.000Z');
        expect(result.security_id).toBe('convertible-sec-001');
        expect(result.resulting_security_ids).toEqual(['stock-sec-001']);
        expect(result.balance_security_id).toBe('convertible-sec-002');
        expect(result.trigger_id).toBe('trigger-001');
        expect(result.comments).toEqual(['Converted on financing round']);
      });

      test('handles optional fields as null', () => {
        const minimalData: OcfConvertibleConversion = {
          id: 'cc-002',
          date: '2024-02-20',
          security_id: 'convertible-sec-003',
          resulting_security_ids: ['stock-sec-002'],
        };

        const result = convertToDaml('convertibleConversion', minimalData);

        expect(result.id).toBe('cc-002');
        expect(result.balance_security_id).toBeNull();
        expect(result.trigger_id).toBeNull();
        expect(result.comments).toEqual([]);
      });

      test('throws OcpValidationError when id is missing', () => {
        const invalidData = {
          ...validConvertibleConversionData,
          id: '',
        };

        expect(() => convertToDaml('convertibleConversion', invalidData)).toThrow(OcpValidationError);
        try {
          convertToDaml('convertibleConversion', invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('convertibleConversion.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('DAML → OCF (getConvertibleConversionAsOcf)', () => {
      test('converts valid DAML convertible conversion event', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'cc-001',
            date: '2024-02-20T00:00:00.000Z',
            security_id: 'convertible-sec-001',
            resulting_security_ids: ['stock-sec-001'],
            balance_security_id: 'convertible-sec-002',
            trigger_id: 'trigger-001',
            comments: ['Converted on financing round'],
          },
        });

        const result = await getConvertibleConversionAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.object_type).toBe('TX_CONVERTIBLE_CONVERSION');
        expect(result.event.id).toBe('cc-001');
        expect(result.event.date).toBe('2024-02-20');
        expect(result.event.security_id).toBe('convertible-sec-001');
        expect(result.event.resulting_security_ids).toEqual(['stock-sec-001']);
        expect(result.event.balance_security_id).toBe('convertible-sec-002');
        expect(result.event.trigger_id).toBe('trigger-001');
        expect(result.event.comments).toEqual(['Converted on financing round']);
      });

      test('omits optional fields when not present', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'cc-002',
            date: '2024-02-20T00:00:00.000Z',
            security_id: 'convertible-sec-003',
            resulting_security_ids: ['stock-sec-002'],
          },
        });

        const result = await getConvertibleConversionAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.balance_security_id).toBeUndefined();
        expect(result.event.trigger_id).toBeUndefined();
        expect(result.event.comments).toBeUndefined();
      });

      test('throws OcpValidationError when resulting_security_ids is empty', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'cc-003',
            date: '2024-02-20T00:00:00.000Z',
            security_id: 'convertible-sec-004',
            resulting_security_ids: [],
          },
        });

        await expect(getConvertibleConversionAsOcf(mockClient, { contractId: 'test-contract' })).rejects.toThrow(
          OcpValidationError
        );
        try {
          await getConvertibleConversionAsOcf(mockClient, { contractId: 'test-contract' });
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('convertibleConversion.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });
  });

  describe('StockConversion', () => {
    describe('OCF → DAML (convertToDaml)', () => {
      const validStockConversionData: OcfStockConversion = {
        id: 'sc-001',
        date: '2024-03-10',
        security_id: 'stock-sec-001',
        quantity: '10000',
        resulting_security_ids: ['preferred-sec-001'],
        balance_security_id: 'stock-sec-002',
        comments: ['Converted to preferred'],
      };

      test('converts valid stock conversion data', () => {
        const result = convertToDaml('stockConversion', validStockConversionData);

        expect(result.id).toBe('sc-001');
        expect(result.date).toBe('2024-03-10T00:00:00.000Z');
        expect(result.security_id).toBe('stock-sec-001');
        expect(result.quantity).toBe('10000');
        expect(result.resulting_security_ids).toEqual(['preferred-sec-001']);
        expect(result.balance_security_id).toBe('stock-sec-002');
        expect(result.comments).toEqual(['Converted to preferred']);
      });

      test('converts numeric quantity to string', () => {
        const dataWithNumericQuantity = {
          ...validStockConversionData,
          quantity: 10000,
        };

        const result = convertToDaml('stockConversion', dataWithNumericQuantity);
        expect(result.quantity).toBe('10000');
      });

      test('handles optional fields as null', () => {
        const minimalData: OcfStockConversion = {
          id: 'sc-002',
          date: '2024-03-10',
          security_id: 'stock-sec-003',
          quantity: '5000',
          resulting_security_ids: ['preferred-sec-002'],
        };

        const result = convertToDaml('stockConversion', minimalData);

        expect(result.id).toBe('sc-002');
        expect(result.balance_security_id).toBeNull();
        expect(result.comments).toEqual([]);
      });

      test('throws OcpValidationError when id is missing', () => {
        const invalidData = {
          ...validStockConversionData,
          id: '',
        };

        expect(() => convertToDaml('stockConversion', invalidData)).toThrow(OcpValidationError);
        try {
          convertToDaml('stockConversion', invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('stockConversion.id');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });

    describe('DAML → OCF (getStockConversionAsOcf)', () => {
      test('converts valid DAML stock conversion event', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'sc-001',
            date: '2024-03-10T00:00:00.000Z',
            security_id: 'stock-sec-001',
            quantity: '10000.0000000000',
            resulting_security_ids: ['preferred-sec-001'],
            balance_security_id: 'stock-sec-002',
            comments: ['Converted to preferred'],
          },
        });

        const result = await getStockConversionAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.object_type).toBe('TX_STOCK_CONVERSION');
        expect(result.event.id).toBe('sc-001');
        expect(result.event.date).toBe('2024-03-10');
        expect(result.event.security_id).toBe('stock-sec-001');
        expect(result.event.quantity).toBe('10000');
        expect(result.event.resulting_security_ids).toEqual(['preferred-sec-001']);
        expect(result.event.balance_security_id).toBe('stock-sec-002');
        expect(result.event.comments).toEqual(['Converted to preferred']);
      });

      test('handles numeric quantity from DAML', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'sc-002',
            date: '2024-03-10T00:00:00.000Z',
            security_id: 'stock-sec-003',
            quantity: 10000,
            resulting_security_ids: ['preferred-sec-002'],
          },
        });

        const result = await getStockConversionAsOcf(mockClient, { contractId: 'test-contract' });
        expect(result.event.quantity).toBe('10000');
      });

      test('omits optional fields when not present', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'sc-003',
            date: '2024-03-10T00:00:00.000Z',
            security_id: 'stock-sec-004',
            quantity: '5000',
            resulting_security_ids: ['preferred-sec-003'],
          },
        });

        const result = await getStockConversionAsOcf(mockClient, { contractId: 'test-contract' });

        expect(result.event.balance_security_id).toBeUndefined();
        expect(result.event.comments).toBeUndefined();
      });

      test('throws OcpValidationError when quantity is missing', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'sc-004',
            date: '2024-03-10T00:00:00.000Z',
            security_id: 'stock-sec-005',
            resulting_security_ids: ['preferred-sec-004'],
          },
        });

        await expect(getStockConversionAsOcf(mockClient, { contractId: 'test-contract' })).rejects.toThrow(
          OcpValidationError
        );
        try {
          await getStockConversionAsOcf(mockClient, { contractId: 'test-contract' });
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('stockConversion.quantity');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });

      test('throws OcpValidationError when resulting_security_ids is empty', async () => {
        const mockClient = createMockClient({
          conversion_data: {
            id: 'sc-005',
            date: '2024-03-10T00:00:00.000Z',
            security_id: 'stock-sec-006',
            quantity: '1000',
            resulting_security_ids: [],
          },
        });

        await expect(getStockConversionAsOcf(mockClient, { contractId: 'test-contract' })).rejects.toThrow(
          OcpValidationError
        );
        try {
          await getStockConversionAsOcf(mockClient, { contractId: 'test-contract' });
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('stockConversion.resulting_security_ids');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
        }
      });
    });
  });
});
