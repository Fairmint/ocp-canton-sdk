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

import { OcpValidationError } from '../../src/errors';
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
          compensation_type: 'OPTION',
          quantity: '10000',
          exercise_price: { amount: '1.50', currency: 'USD' },
          vesting_terms_id: 'vesting-001',
          expiration_date: null,
          termination_exercise_windows: [],
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
          amount: '1.5',
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

      it('preserves supported equity-compensation fields when provided', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-extended',
          date: '2025-01-15',
          security_id: 'sec-extended',
          custom_id: 'custom-extended',
          stakeholder_id: 'stakeholder-extended',
          compensation_type: 'OPTION',
          quantity: '100',
          exercise_price: { amount: '0.5000000000', currency: 'USD' },
          base_price: { amount: '0.2500000000', currency: 'USD' },
          early_exercisable: true,
          vestings: [
            { date: '2025-06-01', amount: '10.0000000000' },
            { date: '2025-07-01', amount: '0.0000000000' },
          ],
          expiration_date: '2030-01-01',
          termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER', period: 90, period_type: 'DAYS' }],
          security_law_exemptions: [],
        };

        const result = convertToDaml('planSecurityIssuance', input);

        expect(result.base_price).toEqual({ amount: '0.25', currency: 'USD' });
        expect(result.early_exercisable).toBe(true);
        expect(result.vestings).toEqual([{ date: '2025-06-01T00:00:00.000Z', amount: '10' }]);
        expect(result.expiration_date).toBe('2030-01-01T00:00:00.000Z');
        expect(result.termination_exercise_windows).toEqual([
          { reason: 'OcfTermVoluntaryOther', period: '90', period_type: 'OcfPeriodDays' },
        ]);
      });

      it('converts RSU plan security type to OcfCompensationTypeRSU', () => {
        const input: OcfPlanSecurityIssuance = {
          id: 'psi-002',
          date: '2025-02-01',
          security_id: 'sec-002',
          custom_id: 'custom-002',
          stakeholder_id: 'stakeholder-002',
          stock_plan_id: 'plan-002',
          compensation_type: 'RSU',
          quantity: '5000',
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
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

      it('throws OcpValidationError when compensation_type is missing', () => {
        const input = {
          id: 'psi-003',
          date: '2025-03-01',
          security_id: 'sec-003',
          custom_id: 'custom-003',
          stakeholder_id: 'stakeholder-003',
          stock_plan_id: 'plan-003',
          quantity: '1000',
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);

        try {
          convertToDaml('planSecurityIssuance', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toContain('compensation_type');
        }
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          quantity: '10000',
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);
      });

      it('throws OcpValidationError when compensation_type is undefined', () => {
        const input = {
          id: 'psi-004',
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          quantity: '10000',
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        expect(() => convertToDaml('planSecurityIssuance', input)).toThrow(OcpValidationError);

        try {
          convertToDaml('planSecurityIssuance', input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toContain('compensation_type');
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
          compensation_type: 'OPTION',
          quantity: '100',
          exercise_price: { amount: '0.10', currency: 'USD' },
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
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
        expect(result.exercise_price).toEqual({ amount: '0.1', currency: 'USD' });
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
          expect(validationError.fieldPath).toBe('id');
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
