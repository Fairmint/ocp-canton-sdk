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

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { planSecurityExerciseDataToDaml } from '../../src/functions/OpenCapTable/planSecurityExercise';
import { planSecurityIssuanceDataToDaml } from '../../src/functions/OpenCapTable/planSecurityIssuance';
import type { OcfPlanSecurityExercise, OcfPlanSecurityIssuance } from '../../src/types/native';

function planSecurityIssuanceInput(
  compensationType: OcfPlanSecurityIssuance['compensation_type'],
  exercisePrice?: unknown,
  basePrice?: unknown
): OcfPlanSecurityIssuance {
  return {
    object_type: 'TX_PLAN_SECURITY_ISSUANCE',
    id: `psi-${compensationType.toLowerCase()}`,
    date: '2025-01-15',
    security_id: `sec-${compensationType.toLowerCase()}`,
    custom_id: `custom-${compensationType.toLowerCase()}`,
    stakeholder_id: 'stakeholder-pricing',
    stock_plan_id: 'plan-pricing',
    stock_class_id: 'class-pricing',
    compensation_type: compensationType,
    quantity: '100.0000000000',
    ...(exercisePrice === undefined ? {} : { exercise_price: exercisePrice }),
    ...(basePrice === undefined ? {} : { base_price: basePrice }),
    early_exercisable: true,
    vestings: [{ date: '2025-06-01', amount: '10.0000000000' }],
    vesting_terms_id: 'vesting-pricing',
    expiration_date: '2030-01-01',
    termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER', period: 90, period_type: 'DAYS' }],
    board_approval_date: '2025-01-10',
    stockholder_approval_date: '2025-01-12',
    consideration_text: 'Services',
    security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
    comments: ['Pricing parity'],
  } as unknown as OcfPlanSecurityIssuance;
}

describe('PlanSecurity Type Converters', () => {
  describe('standalone legacy OCF→DAML converters', () => {
    describe('planSecurityIssuance', () => {
      const monetary = { amount: '1.2300000000', currency: 'USD' } as const;
      const pricingVariants = [
        { compensationType: 'OPTION', exercisePrice: monetary, basePrice: undefined },
        { compensationType: 'OPTION_ISO', exercisePrice: monetary, basePrice: undefined },
        { compensationType: 'OPTION_NSO', exercisePrice: monetary, basePrice: undefined },
        { compensationType: 'CSAR', exercisePrice: undefined, basePrice: monetary },
        { compensationType: 'SSAR', exercisePrice: undefined, basePrice: monetary },
        { compensationType: 'RSU', exercisePrice: undefined, basePrice: undefined },
      ] as const;

      it.each(pricingVariants)(
        'emits the exact canonical equity-compensation payload for $compensationType',
        ({ compensationType, exercisePrice, basePrice }) => {
          const aliasInput = planSecurityIssuanceInput(compensationType, exercisePrice, basePrice);
          const canonicalInput = {
            ...aliasInput,
            object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
          } as unknown as Parameters<typeof equityCompensationIssuanceDataToDaml>[0];
          const aliasDaml = planSecurityIssuanceDataToDaml(aliasInput);
          const canonicalDaml = equityCompensationIssuanceDataToDaml(canonicalInput);

          expect(aliasDaml).toEqual(canonicalDaml);
          expect(JSON.stringify(aliasDaml)).toBe(JSON.stringify(canonicalDaml));
        }
      );

      it('rejects an accessor Monetary without invoking the getter', () => {
        let getterReads = 0;
        const price = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(price, 'amount', {
          enumerable: true,
          get: () => {
            getterReads += 1;
            return '1';
          },
        });
        Object.defineProperty(price, 'currency', { enumerable: true, value: 'USD' });

        expect(() => planSecurityIssuanceDataToDaml(planSecurityIssuanceInput('OPTION', price))).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: 'planSecurityIssuance.exercise_price.amount',
          })
        );
        expect(getterReads).toBe(0);
      });

      it('rejects a proxy Monetary without invoking proxy traps', () => {
        let trapCalls = 0;
        const price = new Proxy(
          { amount: '1', currency: 'USD' },
          {
            get: (target, property, receiver) => {
              trapCalls += 1;
              return Reflect.get(target, property, receiver);
            },
            getOwnPropertyDescriptor: (target, property) => {
              trapCalls += 1;
              return Reflect.getOwnPropertyDescriptor(target, property);
            },
            getPrototypeOf: (target) => {
              trapCalls += 1;
              return Reflect.getPrototypeOf(target);
            },
            ownKeys: (target) => {
              trapCalls += 1;
              return Reflect.ownKeys(target);
            },
          }
        );

        expect(() => planSecurityIssuanceDataToDaml(planSecurityIssuanceInput('OPTION', price))).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_TYPE,
            fieldPath: 'planSecurityIssuance.exercise_price',
          })
        );
        expect(trapCalls).toBe(0);
      });

      it('rejects a malformed exact Monetary shape at the alias-specific path', () => {
        const price = { amount: '1', currency: 'USD', unexpected: true };

        expect(() => planSecurityIssuanceDataToDaml(planSecurityIssuanceInput('OPTION', price))).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: 'planSecurityIssuance.exercise_price.unexpected',
          })
        );
      });

      it('converts OPTION plan security type to OcfCompensationTypeOption', () => {
        const input: OcfPlanSecurityIssuance = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
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

        const result = planSecurityIssuanceDataToDaml(input);

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
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          id: 'psi-extended',
          date: '2025-01-15',
          security_id: 'sec-extended',
          custom_id: 'custom-extended',
          stakeholder_id: 'stakeholder-extended',
          compensation_type: 'CSAR',
          quantity: '100',
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

        const result = planSecurityIssuanceDataToDaml(input);

        expect(result.base_price).toEqual({ amount: '0.25', currency: 'USD' });
        expect(result.early_exercisable).toBe(true);
        expect(result.vestings).toEqual([{ date: '2025-06-01T00:00:00.000Z', amount: '10' }]);
        expect(result.expiration_date).toBe('2030-01-01T00:00:00.000Z');
        expect(result.termination_exercise_windows).toEqual([
          { reason: 'OcfTermVoluntaryOther', period: '90', period_type: 'OcfPeriodDays' },
        ]);
      });

      it.each([
        {
          name: 'an option without exercise_price',
          compensation_type: 'OPTION',
          exercise_price: undefined,
          base_price: undefined,
          fieldPath: 'planSecurityIssuance.exercise_price',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        },
        {
          name: 'an option with base_price',
          compensation_type: 'OPTION',
          exercise_price: { amount: '1', currency: 'USD' },
          base_price: { amount: '2', currency: 'USD' },
          fieldPath: 'planSecurityIssuance.base_price',
          code: OcpErrorCodes.INVALID_FORMAT,
        },
        {
          name: 'a SAR without base_price',
          compensation_type: 'CSAR',
          exercise_price: undefined,
          base_price: undefined,
          fieldPath: 'planSecurityIssuance.base_price',
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        },
        {
          name: 'an RSU with exercise_price',
          compensation_type: 'RSU',
          exercise_price: { amount: '1', currency: 'USD' },
          base_price: undefined,
          fieldPath: 'planSecurityIssuance.exercise_price',
          code: OcpErrorCodes.INVALID_FORMAT,
        },
        {
          name: 'an option with a non-canonical currency',
          compensation_type: 'OPTION',
          exercise_price: { amount: '1', currency: 'usd' },
          base_price: undefined,
          fieldPath: 'planSecurityIssuance.exercise_price.currency',
          code: OcpErrorCodes.INVALID_FORMAT,
        },
      ] as const)('rejects $name at the legacy plan-security boundary', (testCase) => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          id: 'psi-invalid-pricing',
          date: '2025-01-15',
          security_id: 'sec-invalid-pricing',
          custom_id: 'custom-invalid-pricing',
          stakeholder_id: 'stakeholder-invalid-pricing',
          compensation_type: testCase.compensation_type,
          quantity: '100',
          exercise_price: testCase.exercise_price,
          base_price: testCase.base_price,
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(
          expect.objectContaining({
            code: testCase.code,
            fieldPath: testCase.fieldPath,
          })
        );
      });

      it('validates zero-amount vesting dates before filtering and preserves the original index', () => {
        const input: OcfPlanSecurityIssuance = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          id: 'psi-indexed-date',
          date: '2025-01-15',
          security_id: 'sec-indexed-date',
          custom_id: 'custom-indexed-date',
          stakeholder_id: 'stakeholder-indexed-date',
          compensation_type: 'OPTION',
          quantity: '100',
          exercise_price: { amount: '1', currency: 'USD' },
          vestings: [
            { date: '2025-06-01', amount: '0' },
            { date: '', amount: '0' },
          ],
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        };

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.INVALID_FORMAT,
            fieldPath: 'planSecurityIssuance.vestings.1.date',
            receivedValue: '',
          })
        );
      });

      it('rejects a negative vesting amount instead of silently filtering it', () => {
        const input: OcfPlanSecurityIssuance = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          id: 'psi-negative-vesting',
          date: '2025-01-15',
          security_id: 'sec-negative-vesting',
          custom_id: 'custom-negative-vesting',
          stakeholder_id: 'stakeholder-negative-vesting',
          compensation_type: 'OPTION',
          quantity: '100',
          exercise_price: { amount: '1', currency: 'USD' },
          vestings: [{ date: '2025-06-01', amount: '-1' }],
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        };

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.OUT_OF_RANGE,
            fieldPath: 'planSecurityIssuance.vestings.0.amount',
            receivedValue: '-1',
          })
        );
      });

      it.each([
        ['undefined', undefined, OcpErrorCodes.INVALID_TYPE],
        ['empty', '', OcpErrorCodes.INVALID_FORMAT],
        ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
      ] as const)('rejects a required-nullable expiration_date when %s', (_case, expirationDate, code) => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          id: 'psi-expiration-boundary',
          date: '2025-01-15',
          security_id: 'sec-expiration-boundary',
          custom_id: 'custom-expiration-boundary',
          stakeholder_id: 'stakeholder-expiration-boundary',
          compensation_type: 'OPTION',
          quantity: '100',
          exercise_price: { amount: '1', currency: 'USD' },
          expiration_date: expirationDate,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        try {
          planSecurityIssuanceDataToDaml(input);
          throw new Error('Expected expiration date validation to fail');
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect(error).toMatchObject({
            code,
            fieldPath: 'planSecurityIssuance.expiration_date',
            receivedValue: expirationDate,
          });
        }
      });

      it('converts RSU plan security type to OcfCompensationTypeRSU', () => {
        const input: OcfPlanSecurityIssuance = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
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

        const result = planSecurityIssuanceDataToDaml(input);

        // Verify RSU compensation_type mapping
        expect(result.compensation_type).toBe('OcfCompensationTypeRSU');

        // Verify other required fields
        expect(result.id).toBe('psi-002');
        expect(result.security_id).toBe('sec-002');
        expect(result.quantity).toBe('5000');

        // RSUs typically don't have exercise_price
        expect(result.exercise_price).toBeNull();
      });

      it('throws OcpParseError when compensation_type is missing', () => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
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

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(OcpParseError);

        try {
          planSecurityIssuanceDataToDaml(input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpParseError);
          const parseError = error as OcpParseError;
          expect(parseError.source).toContain('compensation_type');
        }
      });

      it('throws OcpValidationError when id is missing', () => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
          date: '2025-01-15',
          security_id: 'sec-001',
          custom_id: 'custom-001',
          stakeholder_id: 'stakeholder-001',
          stock_plan_id: 'plan-001',
          compensation_type: 'OPTION',
          quantity: '10000',
          expiration_date: null,
          termination_exercise_windows: [],
          security_law_exemptions: [],
        } as unknown as OcfPlanSecurityIssuance;

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(OcpValidationError);
      });

      it('throws OcpParseError when compensation_type is undefined', () => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
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

        expect(() => planSecurityIssuanceDataToDaml(input)).toThrow(OcpParseError);

        try {
          planSecurityIssuanceDataToDaml(input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpParseError);
          const parseError = error as OcpParseError;
          expect(parseError.source).toContain('compensation_type');
        }
      });

      it('handles minimal required fields', () => {
        const input: OcfPlanSecurityIssuance = {
          object_type: 'TX_PLAN_SECURITY_ISSUANCE',
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

        const result = planSecurityIssuanceDataToDaml(input);

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
          object_type: 'TX_PLAN_SECURITY_EXERCISE',
          id: 'pse-001',
          date: '2026-01-15',
          security_id: 'sec-001',
          quantity: '2500',
          resulting_security_ids: ['result-001', 'result-002'],
          consideration_text: 'Cash exercise',
          comments: ['Partial exercise'],
        };

        const result = planSecurityExerciseDataToDaml(input);

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
          object_type: 'TX_PLAN_SECURITY_EXERCISE',
          id: 'pse-002',
          date: '2026-02-01',
          security_id: 'sec-002',
          quantity: '1000',
          resulting_security_ids: ['result-003'],
        };

        const result = planSecurityExerciseDataToDaml(input);

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
          object_type: 'TX_PLAN_SECURITY_EXERCISE',
          date: '2026-01-15',
          security_id: 'sec-001',
          quantity: '2500',
          resulting_security_ids: ['result-001'],
        } as OcfPlanSecurityExercise;

        expect(() => planSecurityExerciseDataToDaml(input)).toThrow(OcpValidationError);

        try {
          planSecurityExerciseDataToDaml(input);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          const validationError = error as OcpValidationError;
          expect(validationError.fieldPath).toContain('id');
        }
      });

      it('handles numeric quantity values', () => {
        const input = {
          object_type: 'TX_PLAN_SECURITY_EXERCISE',
          id: 'pse-numeric',
          date: '2026-03-01',
          security_id: 'sec-numeric',
          quantity: 5000,
          resulting_security_ids: ['result-004'],
        } as unknown as OcfPlanSecurityExercise;

        const result = planSecurityExerciseDataToDaml(input);

        // Quantity should be converted to string for DAML
        expect(result.quantity).toBe('5000');
      });
    });
  });
});
