/**
 * Tests for validation of required fields across OCP entities.
 *
 * These tests verify that the SDK fails fast with clear error messages when required fields are missing, as required by
 * the CLAUDE.md guidelines.
 */

import { OcpValidationError } from '../../src/errors';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import type { OcfStakeholder } from '../../src/types';

describe('Required Field Validation', () => {
  describe('stakeholderDataToDaml', () => {
    test('throws OcpValidationError when id is missing', () => {
      const invalidData = {
        object_type: 'STAKEHOLDER',
        name: { legal_name: 'Test Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      } as unknown as OcfStakeholder;

      expect(() => stakeholderDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stakeholderDataToDaml(invalidData)).toThrow("[id] /: must have required property 'id'");
    });

    test('succeeds with valid minimal data', () => {
      const validData: OcfStakeholder = {
        id: 'sh-001',
        object_type: 'STAKEHOLDER',
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
      object_type: 'TX_STOCK_ISSUANCE' as const,
      security_id: 'sec-001',
      custom_id: 'CS-001',
      stakeholder_id: 'sh-001',
      stock_class_id: 'sc-001',
      date: '2024-01-15',
      share_price: { amount: '1.00', currency: 'USD' },
      quantity: '1000',
      security_law_exemptions: [] as Array<{ description: string; jurisdiction: string }>,
      stock_legend_ids: [] as string[],
    };

    test('succeeds with valid data', () => {
      const result = stockIssuanceDataToDaml(validBaseData);
      expect(result.id).toBe('iss-001');
      expect(result.security_id).toBe('sec-001');
    });
  });
});
