/**
 * Unit tests for PlanSecurity Type converters.
 *
 * Tests OCF→DAML conversions for PlanSecurity types that are aliases
 * for EquityCompensation types:
 * - PlanSecurityIssuance → EquityCompensationIssuance
 * - PlanSecurityExercise → EquityCompensationExercise
 *
 * These tests verify that:
 * 1. PlanSecurity types are correctly converted to their DAML equivalents
 * 2. plan_security_type is mapped to compensation_type correctly
 * 3. 'OTHER' plan_security_type throws an error (as there's no DAML equivalent)
 * 4. Fields are properly transformed to DAML format
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import type { OcfPlanSecurityExercise, OcfPlanSecurityIssuance } from '../../src/types/native';

describe('PlanSecurity Type Converters', () => {
  describe('OCF→DAML Converters (convertToDaml)', () => {
    describe('planSecurityIssuance', () => {
      it('converts OPTION plan security type to OcfCompensationTypeOption', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-001',
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          stock_class_id: 'class-001',
          plan_security_type: 'OPTION',
          quantity: '10000',
          exercise_price: { amount: '1.50', currency: 'USD' },
          vesting_terms_id: 'vesting-001',
          board_approval_date: '2025-01-10',
          stockholder_approval_date: '2025-01-12',
          consideration_text: 'For services rendered',
          security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
          comments: ['Initial grant'],
        };

        const result = convertToDaml('planSecurityIssuance', input);

        // Verify compensation_type mapping from plan_security_type
        expect(result.compensation_type).toBe('OcfCompensationTypeOption');

        // Verify other fields are correctly converted
        expect(result.id).toBe('psi-001');
        expect(result.security_id).toBe('sec-001');
        expect(result.custom_id).toBe('custom-001');
        expect(result.stakeholder_id).toBe('stakeholder-001');
        expect(result.stock_plan_id).toBe('plan-001');
        expect(result.stock_class_id).toBe('class-001');
        expect(result.quantity).toBe('10000');
        expect(result.vesting_terms_id).toBe('vesting-001');
        expect(result.consideration_text).toBe('For services rendered');
        expect(result.comments).toEqual(['Initial grant']);

        // Date fields are converted to DAML time format
        expect(result.date).toContain('2025-01-15');
        expect(result.board_approval_date).toContain('2025-01-10');
        expect(result.stockholder_approval_date).toContain('2025-01-12');

        // Exercise price is converted to DAML monetary format
        expect(result.exercise_price).toEqual({
          amount: '1.50',
          currency: 'USD',
        });

        // Security law exemptions are mapped correctly
        expect(result.security_law_exemptions).toEqual([{ description: 'Rule 701', jurisdiction: 'US' }]);

        // Fields that PlanSecurity doesn't have should be null/empty
        expect(result.base_price).toBeNull();
        expect(result.early_exercisable).toBeNull();
        expect(result.vestings).toEqual([]);
        expect(result.expiration_date).toBeNull();
        expect(result.termination_exercise_windows).toEqual([]);
      });

      it('converts RSU plan security type to OcfCompensationTypeRSU', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-002',
          date: '2025-02-01',
          security_id: 'sec-002',
          custom_id: 'custom-002',
          stakeholder_id: 'stakeholder-002',
          stock_plan_id: 'plan-002',
          plan_security_type: 'RSU',
          quantity: '5000',
        };

        const result = convertToDaml('planSecurityIssuance', input);

        // Verify RSU compensation_type mapping
        expect(result.compensation_type).toBe('OcfCompensationTypeRSU');

        // Verify other required fields
        expect(result.id).toBe('psi-002');
        expect(result.security_id).toBe('sec-002');
        expect(result.quantity).toBe('5000');

        // RSUs typically don't have exercise_price
        expect(result.exercise_price).toBeNull();
      });

      it('throws OcpValidationError for OTHER plan security type', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-003',
          date: '2025-03-01',
          security_id: 'sec-003',
          custom_id: 'custom-003',
          stakeholder_id: 'stakeholder-003',
          stock_plan_id: 'plan-003',
          plan_security_type: 'OTHER',
          quantity: '1000',
        };

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);

        try {
          convertToDaml('planSecurityIssuance', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('planSecurityIssuance.plan_security_type');
          expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
          expect(validationError.message).toContain("'OTHER' is not supported");
          expect(validationError.message).toContain('Use EquityCompensationIssuance');
        }
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          plan_security_type: 'OPTION',
          quantity: '10000',
        } as OcfPlanSecurityIssuance;

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);
      });

      it('throws OcpValidationError when plan_security_type is undefined', () => {
        const input = {
          id: 'psi-004',
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          quantity: '10000',
        } as OcfPlanSecurityIssuance;

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);

        try {
          convertToDaml('planSecurityIssuance', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('planSecurityIssuance.plan_security_type');
          expect(validationError.message).toContain('plan_security_type is required');
        }
      });

      it('handles minimal required fields', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-minimal',
          date: '2025-05-01',
          security_id: 'sec-minimal',
          custom_id: 'custom-minimal',
          stakeholder_id: 'stakeholder-minimal',
          stock_plan_id: 'plan-minimal',
          plan_security_type: 'OPTION',
          quantity: '100',
        };

        const result = convertToDaml('planSecurityIssuance', input);

        expect(result.id).toBe('psi-minimal');
        expect(result.compensation_type).toBe('OcfCompensationTypeOption');
        expect(result.quantity).toBe('100');

        // Optional fields should be null
        expect(result.stock_class_id).toBeNull();
        expect(result.vesting_terms_id).toBeNull();
        expect(result.board_approval_date).toBeNull();
        expect(result.stockholder_approval_date).toBeNull();
        expect(result.consideration_text).toBeNull();
        expect(result.exercise_price).toBeNull();
        expect(result.security_law_exemptions).toEqual([]);
        expect(result.comments).toEqual([]);
      });
    });

    describe('planSecurityExercise', () => {
      it('converts plan security exercise with all fields', () => {
        const input: OcfPlanSecurityExercise = {
          id: 'pse-001',
          date: '2026-01-15',
          security_id: 'sec-001',
          quantity: '2500',
          resulting_security_ids: ['result-001', 'result-002'],
          balance_security_id: 'balance-001',
          consideration_text: 'Cash exercise',
          comments: ['Partial exercise'],
        };

        const result = convertToDaml('planSecurityExercise', input);

        expect(result.id).toBe('pse-001');
        expect(result.security_id).toBe('sec-001');
        expect(result.quantity).toBe('2500');
        expect(result.resulting_security_ids).toEqual(['result-001', 'result-002']);
        expect(result.consideration_text).toBe('Cash exercise');
        expect(result.comments).toEqual(['Partial exercise']);

        // Date is converted to DAML time format
        expect(result.date).toContain('2026-01-15');

        // Note: balance_security_id is intentionally NOT included in the DAML output
        // because the underlying EquityCompensationExercise contract doesn't support it
        expect(result.balance_security_id).toBeUndefined();
      });

      it('converts plan security exercise with minimal fields', () => {
        const input: OcfPlanSecurityExercise = {
          id: 'pse-002',
          date: '2026-02-01',
          security_id: 'sec-002',
          quantity: '1000',
          resulting_security_ids: ['result-003'],
        };

        const result = convertToDaml('planSecurityExercise', input);

        expect(result.id).toBe('pse-002');
        expect(result.security_id).toBe('sec-002');
        expect(result.quantity).toBe('1000');
        expect(result.resulting_security_ids).toEqual(['result-003']);

        // Optional fields should be null
        expect(result.consideration_text).toBeNull();
        expect(result.comments).toEqual([]);
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2026-01-15',
          security_id: 'sec-001',
          quantity: '2500',
          resulting_security_ids: ['result-001'],
        } as OcfPlanSecurityExercise;

        expect(() => convertToDaml('planSecurityExercise', input)).toThrow(OcpValidationError);

        try {
          convertToDaml('planSecurityExercise', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toBe('planSecurityExercise.id');
        }
      });

      it('handles numeric quantity values', () => {
        const input: OcfPlanSecurityExercise = {
          id: 'pse-numeric',
          date: '2026-03-01',
          security_id: 'sec-numeric',
          quantity: '5000',
          resulting_security_ids: ['result-004'],
        };

        const result = convertToDaml('planSecurityExercise', input);

        // Quantity should be converted to string for DAML
        expect(result.quantity).toBe('5000');
      });
    });
  });
});
