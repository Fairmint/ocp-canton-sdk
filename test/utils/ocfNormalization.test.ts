/** Tests for canonical OCF normalization. */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { normalizeOcfData } from '../../src/utils/ocfNormalization';
import { parseOcfEntityInput } from '../../src/utils/ocfZodSchemas';
import { requireDefined, requireFirst } from '../../src/utils/requireDefined';
import { validateOcfObject } from './ocfSchemaValidator';

describe('OCF normalization utilities', () => {
  describe('normalizeOcfData', () => {
    it.each([
      'TX_PLAN_SECURITY_ACCEPTANCE',
      'TX_PLAN_SECURITY_CANCELLATION',
      'TX_PLAN_SECURITY_EXERCISE',
      'TX_PLAN_SECURITY_ISSUANCE',
      'TX_PLAN_SECURITY_RELEASE',
      'TX_PLAN_SECURITY_RETRACTION',
      'TX_PLAN_SECURITY_TRANSFER',
    ])('rejects retired PlanSecurity object type %s instead of silently converting it', (objectType) => {
      expect(() =>
        normalizeOcfData({
          object_type: objectType,
          id: 'test-123',
        })
      ).toThrow('Unsupported legacy PlanSecurity object_type');
    });

    it('returns canonical data unchanged when no normalization is needed', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'test-123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input); // Same reference - no copy made
    });

    it('returns data unchanged if no object_type field', () => {
      const input = {
        id: 'test-123',
        name: 'Test',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });

    it('returns data unchanged if object_type is not a string', () => {
      const input = {
        object_type: 123,
        id: 'test-123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });

    it.each([null, [], new Date('2026-01-01T00:00:00.000Z')])('rejects non-plain object input', (input) => {
      expect(() => normalizeOcfData(input)).toThrow('Invalid OCF data: expected a plain object');
    });

    it('strips date field from DOCUMENT objects (not modeled in DAML)', () => {
      const input = {
        object_type: 'DOCUMENT',
        id: 'doc-1',
        md5: 'abc123',
        date: '2024-08-14',
        comments: ['test'],
      };

      const result = normalizeOcfData(input);

      expect(result.id).toBe('doc-1');
      expect(result.md5).toBe('abc123');
      expect(result.comments).toEqual(['test']);
      expect(result).not.toHaveProperty('date');
    });

    it('does not strip date from non-DOCUMENT objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'tx-1',
        date: '2024-01-15',
      };

      const result = normalizeOcfData(input);

      expect(result.date).toBe('2024-01-15');
    });

    it('returns DOCUMENT data unchanged when no non-DAML fields present', () => {
      const input = {
        object_type: 'DOCUMENT',
        id: 'doc-1',
        md5: 'abc123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input); // Same reference - no copy needed
    });

    it('preserves stakeholder current_relationships order and duplicates through normalization and parsing', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', 'FOUNDER', 'INVESTOR'],
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result.current_relationships).toEqual(['INVESTOR', 'FOUNDER', 'INVESTOR']);

      expect(parseOcfEntityInput('stakeholder', input).current_relationships).toEqual([
        'INVESTOR',
        'FOUNDER',
        'INVESTOR',
      ]);
    });

    it('rejects non-string entries in stakeholder current_relationships at the parser boundary', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', 7],
      };

      expect(normalizeOcfData(input)).toBe(input);
      expect(() => parseOcfEntityInput('stakeholder', input)).toThrow(OcpValidationError);
      try {
        parseOcfEntityInput('stakeholder', input);
      } catch (error) {
        expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_TYPE });
      }
    });

    it('rejects padded entries without trimming stakeholder current_relationships', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', '   '],
      };

      expect(normalizeOcfData(input)).toBe(input);
      expect(() => parseOcfEntityInput('stakeholder', input)).toThrow(OcpValidationError);
      try {
        parseOcfEntityInput('stakeholder', input);
      } catch (error) {
        expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT });
      }
    });

    it('rejects non-array stakeholder current_relationships at the parser boundary', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: 'INVESTOR',
      };

      expect(normalizeOcfData(input)).toBe(input);
      expect(() => parseOcfEntityInput('stakeholder', input)).toThrow(OcpValidationError);
      try {
        parseOcfEntityInput('stakeholder', input);
      } catch (error) {
        expect(error).toMatchObject({ code: OcpErrorCodes.INVALID_TYPE });
      }
    });

    it('maps stock plan stock_class_id to stock_class_ids and removes deprecated field', async () => {
      const input: Record<string, unknown> = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: 'sc-1',
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result.stock_class_ids).toEqual(['sc-1']);
      expect(result).not.toHaveProperty('stock_class_id');
    });

    it('keeps explicit stock plan stock_class_ids authoritative over legacy field', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1', 'sc-2'],
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result.stock_class_ids).toEqual(['sc-1', 'sc-2']);
    });

    it('returns stock plan unchanged when stock_class_ids already present', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1'],
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });

    it('does not map legacy stock_class_id for non-stock-plan objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'tx-1',
        stock_class_id: 'sc-1',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result).not.toHaveProperty('stock_class_ids');
    });

    it('throws when stock plan stock_class_ids is not an array', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: 'sc-1',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_ids: expected array');
    });

    it('throws when stock plan stock_class_ids is null', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: null,
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_ids: expected array');
    });

    it('throws when stock plan stock_class_id is not a string', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: 9,
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_id: expected string');
    });

    it('throws when stock plan stock_class_id is an empty string', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: '   ',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_id: empty string');
    });

    it('canonicalizes deprecated option_grant_type to compensation_type', async () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        custom_id: 'custom-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        exercise_price: { amount: '1.00', currency: 'USD' },
        expiration_date: null,
        termination_exercise_windows: [],
        security_law_exemptions: [],
        compensation_type: 'OPTION',
        option_grant_type: 'NSO',
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result.compensation_type).toBe('OPTION_NSO');
      expect(result).not.toHaveProperty('option_grant_type');
    });

    it('rejects removed plan_security_type instead of normalizing it', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        custom_id: 'custom-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        exercise_price: { amount: '1.00', currency: 'USD' },
        expiration_date: null,
        termination_exercise_windows: [],
        security_law_exemptions: [],
        plan_security_type: 'OPTION',
      };

      expect(() => normalizeOcfData(input)).toThrow(
        'plan_security_type is not supported; use canonical compensation_type'
      );
    });

    it('throws when option_grant_type conflicts with compensation_type', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        compensation_type: 'RSU',
        option_grant_type: 'ISO',
      };

      expect(() => normalizeOcfData(input)).toThrow('conflicts with compensation_type');
    });

    it('canonicalizes stock class conversion ratio legacy fields to conversion mechanism', async () => {
      const input = {
        object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
        id: 'stock-class-ratio-adj-1',
        date: '2024-01-15',
        stock_class_id: 'sc-1',
        new_ratio_numerator: '11',
        new_ratio_denominator: '10',
      };

      const result = normalizeOcfData(input);
      const resultRecord = result;
      await validateOcfObject(resultRecord);

      expect(resultRecord.new_ratio_conversion_mechanism).toEqual({
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '0', currency: 'USD' },
        ratio: { numerator: '11', denominator: '10' },
        rounding_type: 'NORMAL',
      });
      expect(resultRecord).not.toHaveProperty('new_ratio_numerator');
      expect(resultRecord).not.toHaveProperty('new_ratio_denominator');
    });

    it('strips null split_transaction_id from stock reissuance', async () => {
      const input = {
        object_type: 'TX_STOCK_REISSUANCE',
        id: 'stock-reissuance-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        resulting_security_ids: ['sec-new-1'],
        split_transaction_id: null,
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result).not.toHaveProperty('split_transaction_id');
    });

    describe('normalizeOcfData - numeric string normalization', () => {
      describe('trailing zero stripping', () => {
        it('strips trailing zeros from nested monetary amount', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            investment_amount: { amount: '100000.00', currency: 'USD' },
          });
          expect((result.investment_amount as Record<string, unknown>).amount).toBe('100000');
        });

        it('normalizes "0.00" to "0"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            some_rate: '0.00',
          });
          expect(result.some_rate).toBe('0');
        });

        it('normalizes "0.10" to "0.1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            some_rate: '0.10',
          });
          expect(result.some_rate).toBe('0.1');
        });

        it('normalizes "1.00" to "1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '1.00',
          });
          expect(result.value).toBe('1');
        });

        it('normalizes "123.4500" to "123.45"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '123.4500',
          });
          expect(result.value).toBe('123.45');
        });

        it('normalizes negative decimal "-100.00" to "-100"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '-100.00',
          });
          expect(result.value).toBe('-100');
        });

        it('normalizes negative decimal "-0.10" to "-0.1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '-0.10',
          });
          expect(result.value).toBe('-0.1');
        });

        it('normalizes "0.0" to "0"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '0.0',
          });
          expect(result.value).toBe('0');
        });
      });

      describe('already-normalized values unchanged', () => {
        it('leaves integer string "100000" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            quantity: '100000',
          });
          expect(result.quantity).toBe('100000');
        });

        it('leaves "0.1" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            rate: '0.1',
          });
          expect(result.rate).toBe('0.1');
        });

        it('leaves "123.456" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            amount: '123.456',
          });
          expect(result.amount).toBe('123.456');
        });

        it('leaves "0" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            value: '0',
          });
          expect(result.value).toBe('0');
        });
      });

      describe('non-numeric strings not touched', () => {
        it('does not touch IDs or names', () => {
          const result = normalizeOcfData({
            object_type: 'STAKEHOLDER',
            id: 'stk_000001',
            name: { legal_name: 'Alice Doe' },
            stakeholder_type: 'INDIVIDUAL',
          });
          expect(result.id).toBe('stk_000001');
          expect((result.name as Record<string, unknown>).legal_name).toBe('Alice Doe');
        });

        it('does not touch date strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            date: '2024-01-15',
          });
          expect(result.date).toBe('2024-01-15');
        });

        it('does not touch enum strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            status: 'ACTIVE',
          });
          expect(result.status).toBe('ACTIVE');
        });

        it('does not touch IDs or empty strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'abc-123-def',
            custom_id: '',
          });
          expect(result.id).toBe('abc-123-def');
          expect(result.custom_id).toBe('');
        });
      });

      describe('nested object and array normalization', () => {
        it('normalizes nested monetary amount but leaves currency', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            investment_amount: { amount: '100000.00', currency: 'USD' },
          });
          const investmentAmount = result.investment_amount as Record<string, unknown>;
          expect(investmentAmount.amount).toBe('100000');
          expect(investmentAmount.currency).toBe('USD');
        });

        it('normalizes values inside arrays of objects', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            items: [{ rate: '0.10' }, { rate: '5.00' }],
          });
          const items = result.items as Array<Record<string, unknown>>;
          expect(requireDefined(items[0], 'first normalized item').rate).toBe('0.1');
          expect(requireDefined(items[1], 'second normalized item').rate).toBe('5');
        });

        it('normalizes values three levels deep', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            conversion_triggers: [
              {
                conversion_right: {
                  conversion_mechanism: {
                    interest_rates: [{ rate: '0.10' }],
                  },
                },
              },
            ],
          });
          const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
          const right = requireFirst(triggers, 'normalized conversion trigger').conversion_right as Record<
            string,
            unknown
          >;
          const mechanism = right.conversion_mechanism as Record<string, unknown>;
          const rates = mechanism.interest_rates as Array<Record<string, unknown>>;
          expect(requireFirst(rates, 'normalized interest rate').rate).toBe('0.1');
        });
      });

      describe('real-world OCF object scenarios', () => {
        it('normalizes a convertible issuance with nested interest rates', () => {
          const input = {
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'ci-001',
            date: '2024-01-15',
            security_id: 'sec-001',
            stakeholder_id: 'stk-001',
            investment_amount: { amount: '100000.00', currency: 'USD' },
            conversion_triggers: [
              {
                trigger_id: 'trig-1',
                conversion_right: {
                  conversion_mechanism: {
                    type: 'CONVERTIBLE_NOTE_CONVERSION',
                    interest_rates: [
                      { rate: '0.00', accrual_start_date: '2024-01-15' },
                      { rate: '0.10', accrual_start_date: '2024-06-15' },
                    ],
                  },
                },
              },
            ],
          } as Record<string, unknown>;

          const result = normalizeOcfData(input);

          expect((result.investment_amount as Record<string, unknown>).amount).toBe('100000');
          const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
          const right = requireFirst(triggers, 'normalized conversion trigger').conversion_right as Record<
            string,
            unknown
          >;
          const mechanism = right.conversion_mechanism as Record<string, unknown>;
          const rates = mechanism.interest_rates as Array<Record<string, unknown>>;
          const firstRate = requireDefined(rates[0], 'first normalized interest rate');
          const secondRate = requireDefined(rates[1], 'second normalized interest rate');
          expect(firstRate.rate).toBe('0');
          expect(firstRate.accrual_start_date).toBe('2024-01-15');
          expect(secondRate.rate).toBe('0.1');
          expect(secondRate.accrual_start_date).toBe('2024-06-15');
          expect(result.date).toBe('2024-01-15');
          expect(result.id).toBe('ci-001');
          expect(result.security_id).toBe('sec-001');
          expect(result.stakeholder_id).toBe('stk-001');
        });

        it('normalizes canonical relationships without touching non-numeric fields', () => {
          const input = {
            object_type: 'STAKEHOLDER',
            id: 'stk_000001',
            name: { legal_name: 'Alice Doe' },
            stakeholder_type: 'INDIVIDUAL',
            current_relationships: ['INVESTOR'],
          } as Record<string, unknown>;

          const result = normalizeOcfData(input);

          expect(result.id).toBe('stk_000001');
          expect((result.name as Record<string, unknown>).legal_name).toBe('Alice Doe');
          expect(result.current_relationships).toEqual(['INVESTOR']);
          expect(result.stakeholder_type).toBe('INDIVIDUAL');
        });
      });

      describe('edge cases', () => {
        it('preserves null values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            optional_field: null,
          });
          expect(result.optional_field).toBeNull();
        });

        it('does not touch boolean values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            flag: true,
          });
          expect(result.flag).toBe(true);
        });

        it('does not touch number values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            count: 42,
          });
          expect(result.count).toBe(42);
        });

        it('passes through empty objects', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            metadata: {},
          });
          expect(result.metadata).toEqual({});
        });

        it('passes through empty arrays', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            items: [],
          });
          expect(result.items).toEqual([]);
        });
      });
    });
  });

  describe('vesting terms defaults', () => {
    const makeVestingTerms = (overrides: Record<string, unknown> = {}) => ({
      object_type: 'VESTING_TERMS',
      id: 'vt-001',
      name: 'Standard Vesting',
      description: '4-year vesting with cliff',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['cliff'],
        },
        {
          id: 'cliff',
          portion: { numerator: '12', denominator: '48', remainder: false },
          trigger: { type: 'VESTING_SCHEDULE_RELATIVE' },
          next_condition_ids: ['monthly'],
        },
        {
          id: 'monthly',
          portion: { numerator: '1', denominator: '48', remainder: false },
          trigger: { type: 'VESTING_SCHEDULE_RELATIVE' },
          next_condition_ids: [],
        },
      ],
      comments: [],
      ...overrides,
    });

    it('strips remainder: false from vesting condition portions', () => {
      const result = normalizeOcfData(makeVestingTerms());
      const conditions = result.vesting_conditions as Array<{ portion?: Record<string, unknown> }>;
      const cliffPortion = requireDefined(conditions[1], 'cliff vesting condition').portion;
      const monthlyPortion = requireDefined(conditions[2], 'monthly vesting condition').portion;
      expect(cliffPortion).toBeDefined();
      expect(cliffPortion === undefined ? true : 'remainder' in cliffPortion).toBe(false);
      expect(monthlyPortion).toBeDefined();
      expect(monthlyPortion === undefined ? true : 'remainder' in monthlyPortion).toBe(false);
    });

    it('preserves remainder: true', () => {
      const input = makeVestingTerms({
        vesting_conditions: [
          {
            id: 'vc-1',
            portion: { numerator: '1', denominator: '4', remainder: true },
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      });
      const result = normalizeOcfData(input);
      const conditions = result.vesting_conditions as Array<{ portion?: Record<string, unknown> }>;
      expect(requireFirst(conditions, 'normalized vesting condition').portion?.remainder).toBe(true);
    });

    it('strips empty comments array', () => {
      const result = normalizeOcfData(makeVestingTerms({ comments: [] }));
      expect('comments' in result).toBe(false);
    });

    it('preserves non-empty comments', () => {
      const result = normalizeOcfData(makeVestingTerms({ comments: ['Board note'] }));
      expect(result.comments).toEqual(['Board note']);
    });

    it('does not affect non-VESTING_TERMS objects', () => {
      const stakeholder = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        comments: [],
      };
      const result = normalizeOcfData(stakeholder);
      expect(result.comments).toEqual([]);
    });
  });

  describe('capitalisation definition rules preservation', () => {
    const makeConvertibleIssuance = (triggers: unknown[]) =>
      ({
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'ci-001',
        date: '2024-01-15',
        security_id: 'sec-001',
        conversion_triggers: triggers,
      }) as Record<string, unknown>;

    it('does not invent missing boolean fields', () => {
      const partialRules = {
        include_outstanding_shares: true,
        include_outstanding_options: true,
        include_outstanding_unissued_options: false,
        include_this_security: true,
        include_other_converting_securities: false,
        include_option_pool_topup_for_promised_options: true,
        // missing: include_additional_option_pool_topup, include_new_money
      };

      const input = makeConvertibleIssuance([
        {
          conversion_right: {
            conversion_mechanism: {
              capitalization_definition_rules: partialRules,
            },
          },
        },
      ]);

      const result = normalizeOcfData(input);
      const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
      const right = requireFirst(triggers, 'normalized conversion trigger').conversion_right as Record<string, unknown>;
      const mechanism = right.conversion_mechanism as Record<string, unknown>;
      const rules = mechanism.capitalization_definition_rules as Record<string, boolean>;

      expect(Object.keys(rules)).toHaveLength(6);
      expect(rules.include_additional_option_pool_topup).toBeUndefined();
      expect(rules.include_new_money).toBeUndefined();
      expect(rules.include_outstanding_shares).toBe(true);
      expect(rules.include_option_pool_topup_for_promised_options).toBe(true);
    });

    it('is idempotent (running twice produces the same result)', () => {
      const partialRules = {
        include_outstanding_shares: true,
        include_outstanding_options: false,
        include_this_security: true,
        include_other_converting_securities: false,
        include_option_pool_topup_for_promised_options: true,
        include_new_money: false,
      };

      const input = makeConvertibleIssuance([
        {
          conversion_right: {
            conversion_mechanism: {
              capitalization_definition_rules: partialRules,
            },
          },
        },
      ]);

      const first = normalizeOcfData(input);
      const second = normalizeOcfData(first);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('does not affect non-TX_CONVERTIBLE_ISSUANCE objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'si-001',
        conversion_triggers: [
          {
            conversion_right: {
              conversion_mechanism: {
                capitalization_definition_rules: {
                  include_outstanding_shares: true,
                },
              },
            },
          },
        ],
      } as Record<string, unknown>;

      const result = normalizeOcfData(input);
      const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
      const right = requireFirst(triggers, 'normalized conversion trigger').conversion_right as Record<string, unknown>;
      const mechanism = right.conversion_mechanism as Record<string, unknown>;
      const rules = mechanism.capitalization_definition_rules as Record<string, unknown>;

      expect(Object.keys(rules)).toHaveLength(1);
      expect(rules.include_outstanding_shares).toBe(true);
    });
  });

  describe('canonical stock class conversion rights', () => {
    it('preserves a 1:1 ratio because a conversion right is not equivalent to its omission', () => {
      const cantonStyle = {
        object_type: 'STOCK_CLASS',
        id: 'sc-preferred',
        name: 'Preferred',
        class_type: 'PREFERRED',
        initial_shares_authorized: '1000000',
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '1', denominator: '1' },
              conversion_price: { amount: '0', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'common',
          },
        ],
      } as Record<string, unknown>;
      const result = normalizeOcfData(cantonStyle);
      expect(result.conversion_rights).toEqual(cantonStyle.conversion_rights);
    });

    it('preserves non-1:1 conversion rights', () => {
      const stockClass = {
        object_type: 'STOCK_CLASS',
        id: 'sc-preferred',
        name: 'Preferred',
        class_type: 'PREFERRED',
        initial_shares_authorized: '1000000',
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '2', denominator: '1' },
              conversion_price: { amount: '0', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'common',
          },
        ],
      } as Record<string, unknown>;
      const result = normalizeOcfData(stockClass);
      expect(result.conversion_rights).toHaveLength(1);
      expect(
        requireFirst(result.conversion_rights as Array<Record<string, unknown>>, 'normalized conversion right')
          .conversion_mechanism
      ).toMatchObject({
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'NORMAL',
      });
    });

    it('preserves empty conversion_rights unchanged', () => {
      const dbStyle = {
        object_type: 'STOCK_CLASS',
        id: 'sc-preferred',
        name: 'Preferred',
        class_type: 'PREFERRED',
        initial_shares_authorized: '1000000',
        conversion_rights: [],
      } as Record<string, unknown>;
      const result = normalizeOcfData(dbStyle);
      expect(result.conversion_rights).toEqual([]);
    });
  });
});
