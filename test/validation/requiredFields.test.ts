/**
 * Tests for validation of required fields across OCP entities.
 *
 * These tests verify that the SDK fails fast with clear error messages when required fields are missing, as required by
 * the CLAUDE.md guidelines.
 */

import { OcpValidationError } from '../../src/errors';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { equityCompensationReleaseDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationRelease/equityCompensationReleaseDataToDaml';
import { equityCompensationRepricingDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationRepricing/equityCompensationRepricingDataToDaml';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { stockConversionDataToDaml } from '../../src/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import { stockPlanReturnToPoolDataToDaml } from '../../src/functions/OpenCapTable/stockPlanReturnToPool/stockPlanReturnToPoolDataToDaml';
import type {
  OcfConvertibleConversion,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfStakeholder,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockPlanReturnToPool,
} from '../../src/types';

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

  describe('convertibleConversionDataToDaml', () => {
    const validBaseData: OcfConvertibleConversion = {
      id: 'cc-001',
      date: '2024-01-15',
      reason_text: 'Qualified financing trigger',
      security_id: 'conv-001',
      trigger_id: 'trigger-001',
      resulting_security_ids: ['stock-001'],
    };

    test('throws OcpValidationError when reason_text is missing', () => {
      const invalidData = { ...validBaseData, reason_text: '' };
      expect(() => convertibleConversionDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => convertibleConversionDataToDaml(invalidData)).toThrow("'convertibleConversion.reason_text'");
    });

    test('throws OcpValidationError when trigger_id is missing', () => {
      const invalidData = { ...validBaseData, trigger_id: '' };
      expect(() => convertibleConversionDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => convertibleConversionDataToDaml(invalidData)).toThrow("'convertibleConversion.trigger_id'");
    });

    test('succeeds with valid canonical data', () => {
      const result = convertibleConversionDataToDaml(validBaseData);
      expect(result.security_id).toBe('conv-001');
      expect(result.trigger_id).toBe('trigger-001');
    });
  });

  describe('stockConversionDataToDaml', () => {
    const validBaseData: OcfStockConversion = {
      id: 'sc-001',
      date: '2024-01-15',
      security_id: 'stock-001',
      quantity_converted: '100',
      resulting_security_ids: ['pref-001'],
    };

    test('throws OcpValidationError when security_id is missing', () => {
      const invalidData = { ...validBaseData, security_id: '' };
      expect(() => stockConversionDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stockConversionDataToDaml(invalidData)).toThrow("'stockConversion.security_id'");
    });

    test('throws OcpValidationError when quantity_converted is missing', () => {
      const invalidData = { ...validBaseData, quantity_converted: '' };
      expect(() => stockConversionDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stockConversionDataToDaml(invalidData)).toThrow("'stockConversion.quantity_converted'");
    });
  });

  describe('equityCompensationReleaseDataToDaml', () => {
    const validBaseData: OcfEquityCompensationRelease = {
      id: 'ecr-001',
      date: '2024-01-15',
      security_id: 'eq-001',
      quantity: '50',
      release_price: { amount: '0.00', currency: 'USD' },
      settlement_date: '2024-01-16',
      resulting_security_ids: ['stock-001'],
    };

    test('throws OcpValidationError when release_price is missing', () => {
      const invalidData = {
        ...validBaseData,
        release_price: undefined,
      } as unknown as OcfEquityCompensationRelease;
      expect(() => equityCompensationReleaseDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => equityCompensationReleaseDataToDaml(invalidData)).toThrow(
        "'equityCompensationRelease.release_price'"
      );
    });

    test('throws OcpValidationError when settlement_date is missing', () => {
      const invalidData = { ...validBaseData, settlement_date: '' };
      expect(() => equityCompensationReleaseDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => equityCompensationReleaseDataToDaml(invalidData)).toThrow(
        "'equityCompensationRelease.settlement_date'"
      );
    });
  });

  describe('equityCompensationRepricingDataToDaml', () => {
    const validBaseData: OcfEquityCompensationRepricing = {
      id: 'repricing-001',
      date: '2024-01-15',
      security_id: 'option-001',
      new_exercise_price: { amount: '0.50', currency: 'USD' },
    };

    test('throws OcpValidationError when new_exercise_price is missing', () => {
      const invalidData = {
        ...validBaseData,
        new_exercise_price: undefined,
      } as unknown as OcfEquityCompensationRepricing;
      expect(() => equityCompensationRepricingDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => equityCompensationRepricingDataToDaml(invalidData)).toThrow(
        "'equityCompensationRepricing.new_exercise_price'"
      );
    });
  });

  describe('stockPlanReturnToPoolDataToDaml', () => {
    const validBaseData: OcfStockPlanReturnToPool = {
      id: 'return-001',
      date: '2024-01-15',
      security_id: 'sec-001',
      stock_plan_id: 'plan-001',
      quantity: '15',
      reason_text: 'Termination',
    };

    test('throws OcpValidationError when security_id is missing', () => {
      const invalidData = { ...validBaseData, security_id: '' };
      expect(() => stockPlanReturnToPoolDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stockPlanReturnToPoolDataToDaml(invalidData)).toThrow("'stockPlanReturnToPool.security_id'");
    });

    test('throws OcpValidationError when reason_text is missing', () => {
      const invalidData = { ...validBaseData, reason_text: '' };
      expect(() => stockPlanReturnToPoolDataToDaml(invalidData)).toThrow(OcpValidationError);
      expect(() => stockPlanReturnToPoolDataToDaml(invalidData)).toThrow("'stockPlanReturnToPool.reason_text'");
    });
  });
});
