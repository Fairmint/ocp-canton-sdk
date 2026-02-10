/**
 * Tests for validation of required fields across OCP entities.
 *
 * These tests verify that the SDK fails fast with clear error messages when required fields are missing, as required by
 * the CLAUDE.md guidelines.
 */

import { OcpValidationError } from '../../src/errors';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import type { OcfStakeholder, OcfStockIssuance } from '../../src/types';

describe('Required Field Validation', () => {
  describe('stakeholderDataToDaml', () => {
    test('throws OcpValidationError when id is missing', () => {
      const invalidData = {
        name: { legal_name: 'Test Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      } as unknown as OcfStakeholder;

      expect(() => stakeholderDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stakeholderDataToDaml(invalidData)).toThrow("'stakeholder.id'");
    });

    test('throws OcpValidationError when id is empty string', () => {
      const invalidData = {
        id: '',
        name: { legal_name: 'Test Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      } as OcfStakeholder;

      expect(() => stakeholderDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stakeholderDataToDaml(invalidData)).toThrow("'stakeholder.id'");
    });

    test('succeeds with valid minimal data', () => {
      const validData: OcfStakeholder = {
        id: 'sh-001',
        name: { legal_name: 'Test Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      };

      const result = stakeholderDataToDaml(validData);
      expect(result.id).toBe('sh-001');
      expect(result.stakeholder_type).toBe('OcfStakeholderTypeIndividual');
    });
  });

  describe('stockIssuanceDataToDaml', () => {
    const validBaseData = {
      id: 'iss-001',
      security_id: 'sec-001',
      custom_id: 'CS-001',
      stakeholder_id: 'sh-001',
      stock_class_id: 'sc-001',
      date: '2024-01-15',
      share_price: { amount: '1.00', currency: 'USD' },
      quantity: '1000',
    };

    test('throws OcpValidationError when id is missing', () => {
      const { id: _, ...invalidData } = validBaseData;
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow(OcpValidationError);
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow("'stockIssuance.id'");
    });

    test('throws OcpValidationError when security_id is missing', () => {
      const { security_id: _, ...invalidData } = validBaseData;
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow(OcpValidationError);
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow("'stockIssuance.security_id'");
    });

    test('throws OcpValidationError when custom_id is missing', () => {
      const { custom_id: _, ...invalidData } = validBaseData;
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow(OcpValidationError);
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow("'stockIssuance.custom_id'");
    });

    test('throws OcpValidationError when stakeholder_id is missing', () => {
      const { stakeholder_id: _, ...invalidData } = validBaseData;
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow(OcpValidationError);
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow("'stockIssuance.stakeholder_id'");
    });

    test('throws OcpValidationError when stock_class_id is missing', () => {
      const { stock_class_id: _, ...invalidData } = validBaseData;
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow(OcpValidationError);
      expect(() => stockIssuanceDataToDaml(invalidData as OcfStockIssuance)).toThrow("'stockIssuance.stock_class_id'");
    });

    test('succeeds with valid data', () => {
      const result = stockIssuanceDataToDaml(validBaseData as OcfStockIssuance);
      expect(result.id).toBe('iss-001');
      expect(result.security_id).toBe('sec-001');
    });
  });
});
