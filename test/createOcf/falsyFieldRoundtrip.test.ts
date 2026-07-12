/**
 * Tests that falsy values (false, 0, "0") survive the DAML-to-OCF round-trip.
 * Catches truthiness bugs where `value && {...}` or `value ? {...} : {}` would drop valid falsy values.
 */

import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { damlConvertibleConversionToNative } from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import {
  damlConvertibleIssuanceDataToNative as convertTypedConvertibleIssuance,
  type DamlConvertibleIssuanceData,
} from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { damlStockIssuanceDataToNative } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { requireFirst } from '../../src/utils/requireDefined';

const damlConvertibleIssuanceDataToNative = (value: unknown) =>
  convertTypedConvertibleIssuance(value as DamlConvertibleIssuanceData);

describe('falsy field preservation in DAML-to-OCF converters', () => {
  describe('boolean false fields', () => {
    test('conversion_mfn: false is preserved in Note conversion mechanism', () => {
      const daml = {
        id: 'ci-1',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: 'CI-1',
        stakeholder_id: 'sh-1',
        board_approval_date: null,
        stockholder_approval_date: null,
        consideration_text: null,
        investment_amount: { amount: '1000', currency: 'USD' },
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [
          {
            type_: 'OcfTriggerTypeTypeAutomaticOnDate',
            trigger_id: 't1',
            trigger_date: '2025-01-01T00:00:00Z',
            trigger_condition: null,
            start_date: null,
            end_date: null,
            nickname: null,
            trigger_description: null,
            conversion_right: {
              type_: 'CONVERTIBLE_CONVERSION_RIGHT',
              converts_to_future_round: null,
              converts_to_stock_class_id: null,
              conversion_mechanism: {
                tag: 'OcfConvMechNote',
                value: {
                  interest_rates: [{ rate: '0.05', accrual_start_date: '2024-01-01', accrual_end_date: null }],
                  day_count_convention: 'OcfDayCountActual365',
                  interest_payout: 'OcfInterestPayoutDeferred',
                  interest_accrual_period: 'OcfAccrualAnnual',
                  compounding_type: 'OcfSimple',
                  conversion_mfn: false,
                  capitalization_definition: null,
                  capitalization_definition_rules: null,
                  conversion_discount: null,
                  conversion_valuation_cap: null,
                  exit_multiple: null,
                },
              },
            },
          },
        ],
        seniority: '1',
        pro_rata: null,
        security_law_exemptions: [],
        comments: [],
      };
      const result = damlConvertibleIssuanceDataToNative(daml);
      const mechanism = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
        .conversion_mechanism;
      expect(mechanism).toBeDefined();
      expect('conversion_mfn' in mechanism).toBe(true);
      expect((mechanism as unknown as Record<string, unknown>).conversion_mfn).toBe(false);
    });

    test('conversion_mfn: false is preserved in SAFE conversion mechanism', () => {
      const daml = {
        id: 'ci-2',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: 'CI-2',
        stakeholder_id: 'sh-1',
        board_approval_date: null,
        stockholder_approval_date: null,
        consideration_text: null,
        investment_amount: { amount: '1000', currency: 'USD' },
        convertible_type: 'OcfConvertibleSafe',
        conversion_triggers: [
          {
            type_: 'OcfTriggerTypeTypeAutomaticOnDate',
            trigger_id: 't1',
            trigger_date: '2025-01-01T00:00:00Z',
            trigger_condition: null,
            start_date: null,
            end_date: null,
            nickname: null,
            trigger_description: null,
            conversion_right: {
              type_: 'CONVERTIBLE_CONVERSION_RIGHT',
              converts_to_future_round: null,
              converts_to_stock_class_id: null,
              conversion_mechanism: {
                tag: 'OcfConvMechSAFE',
                value: {
                  conversion_mfn: false,
                  capitalization_definition: null,
                  capitalization_definition_rules: null,
                  conversion_discount: null,
                  conversion_timing: null,
                  conversion_valuation_cap: null,
                  exit_multiple: null,
                },
              },
            },
          },
        ],
        seniority: '1',
        pro_rata: null,
        security_law_exemptions: [],
        comments: [],
      };
      const result = damlConvertibleIssuanceDataToNative(daml);
      const mechanism = requireFirst(result.conversion_triggers, 'native conversion trigger').conversion_right
        .conversion_mechanism;
      expect(mechanism).toBeDefined();
      expect('conversion_mfn' in mechanism).toBe(true);
      expect((mechanism as unknown as Record<string, unknown>).conversion_mfn).toBe(false);
    });

    test('remainder: false is preserved in vesting condition portion', () => {
      const daml = {
        id: 'vt-1',
        name: 'Standard',
        description: '4 year vest',
        allocation_type: 'OcfAllocationCumulativeRounding',
        vesting_conditions: [
          {
            id: 'vc-1',
            trigger: { tag: 'OcfVestingStartTrigger', value: {} },
            next_condition_ids: [],
            portion: {
              numerator: '1',
              denominator: '4',
              remainder: false,
            },
          },
        ],
        comments: [],
      };
      const result = damlVestingTermsDataToNative(
        daml as unknown as Parameters<typeof damlVestingTermsDataToNative>[0]
      );
      const [{ portion }] = result.vesting_conditions;
      expect(portion).toBeDefined();
      expect('remainder' in portion!).toBe(true);
      expect(portion!.remainder).toBe(false);
    });
  });

  describe('numeric zero fields', () => {
    const convertibleConversionInput = {
      object_type: 'TX_CONVERTIBLE_CONVERSION' as const,
      id: 'conv-write',
      date: '2024-01-15',
      reason_text: 'Conversion',
      security_id: 'sec-1',
      trigger_id: 't1',
      resulting_security_ids: ['sec-2'] as [string],
    };

    test('liquidation_preference_multiple: "0" is preserved in stock class', () => {
      const daml = {
        id: 'sc-1',
        name: 'Series A',
        class_type: 'OcfStockClassTypePreferred',
        default_id_prefix: 'SA-',
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1000000' },
        votes_per_share: '1',
        seniority: '1',
        conversion_rights: [],
        comments: [],
        liquidation_preference_multiple: '0',
      };
      const result = damlStockClassDataToNative(daml);
      expect(result.liquidation_preference_multiple).toBe('0');
    });

    test('participation_cap_multiple: "0" is preserved in stock class', () => {
      const daml = {
        id: 'sc-2',
        name: 'Series B',
        class_type: 'OcfStockClassTypePreferred',
        default_id_prefix: 'SB-',
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '1000000' },
        votes_per_share: '1',
        seniority: '2',
        conversion_rights: [],
        comments: [],
        participation_cap_multiple: '0',
      };
      const result = damlStockClassDataToNative(daml);
      expect(result.participation_cap_multiple).toBe('0');
    });

    test('quantity_converted: "0" is rejected in convertible conversion', () => {
      const daml = {
        id: 'conv-1',
        date: '2024-01-15T00:00:00Z',
        reason_text: 'Conversion',
        security_id: 'sec-1',
        trigger_id: 't1',
        resulting_security_ids: ['sec-2'],
        comments: [],
        balance_security_id: null,
        capitalization_definition: null,
        quantity_converted: '0',
      };
      expect(() => damlConvertibleConversionToNative(daml)).toThrow(OcpValidationError);
    });

    test.each([
      ['JavaScript number', 0, OcpErrorCodes.INVALID_TYPE],
      ['eleven fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
      ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
      ['non-fixed-point string', '1e3', OcpErrorCodes.INVALID_FORMAT],
      ['zero', '0', OcpErrorCodes.OUT_OF_RANGE],
      ['negative zero', '-0', OcpErrorCodes.OUT_OF_RANGE],
      ['negative value', '-1', OcpErrorCodes.OUT_OF_RANGE],
    ] as const)('rejects read-side quantity_converted with %s', (_case, quantityConverted, code) => {
      try {
        damlConvertibleConversionToNative({
          id: 'conv-invalid',
          date: '2024-01-15T00:00:00Z',
          reason_text: 'Conversion',
          security_id: 'sec-1',
          trigger_id: 't1',
          resulting_security_ids: ['sec-2'],
          comments: [],
          quantity_converted: quantityConverted,
        } as unknown as Parameters<typeof damlConvertibleConversionToNative>[0]);
        throw new Error('Expected quantity validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code,
          fieldPath: 'convertibleConversion.quantity_converted',
          receivedValue: quantityConverted,
        });
      }
    });

    test.each([
      ['maximum Numeric(10) boundary', `${'9'.repeat(28)}.1234567890`, `${'9'.repeat(28)}.123456789`],
    ] as const)('canonicalizes read-side quantity_converted at the %s', (_case, quantityConverted, expected) => {
      const result = damlConvertibleConversionToNative({
        id: 'conv-boundary',
        date: '2024-01-15T00:00:00Z',
        reason_text: 'Conversion',
        security_id: 'sec-1',
        trigger_id: 't1',
        resulting_security_ids: ['sec-2'],
        balance_security_id: null,
        capitalization_definition: null,
        comments: [],
        quantity_converted: quantityConverted,
      });

      expect(result.quantity_converted).toBe(expected);
    });

    test.each([
      ['malformed string', '1e3', OcpErrorCodes.INVALID_FORMAT],
      ['empty string', '', OcpErrorCodes.INVALID_FORMAT],
      ['explicit null', null, OcpErrorCodes.INVALID_TYPE],
      ['runtime numeric zero', 0, OcpErrorCodes.INVALID_TYPE],
      ['fixed-point zero', '0', OcpErrorCodes.OUT_OF_RANGE],
      ['negative zero', '-0', OcpErrorCodes.OUT_OF_RANGE],
      ['negative value', '-1', OcpErrorCodes.OUT_OF_RANGE],
    ] as const)('rejects write-side quantity_converted %s without treating it as absent', (_case, value, code) => {
      try {
        convertibleConversionDataToDaml({
          ...convertibleConversionInput,
          quantity_converted: value,
        } as unknown as Parameters<typeof convertibleConversionDataToDaml>[0]);
        throw new Error('Expected write-side quantity validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code,
          fieldPath: 'convertibleConversion.quantity_converted',
          receivedValue: value,
        });
      }
    });
  });

  describe('null optional fields (DAML Optional None)', () => {
    test('issuance_type: null is handled in stock issuance', () => {
      const daml = {
        id: 'si-1',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: 'CS-1',
        stakeholder_id: 'sh-1',
        stock_class_id: 'sc-1',
        share_price: { amount: '1.00', currency: 'USD' },
        quantity: '100',
        security_law_exemptions: [],
        share_numbers_issued: [],
        stock_legend_ids: [],
        vestings: [],
        comments: [],
        issuance_type: null,
      };
      const result = damlStockIssuanceDataToNative(
        daml as unknown as Parameters<typeof damlStockIssuanceDataToNative>[0]
      );
      expect(result.issuance_type).toBeUndefined();
    });

    test('issuance_type: undefined (absent) is handled in stock issuance', () => {
      const daml = {
        id: 'si-2',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: 'CS-1',
        stakeholder_id: 'sh-1',
        stock_class_id: 'sc-1',
        share_price: { amount: '1.00', currency: 'USD' },
        quantity: '100',
        security_law_exemptions: [],
        share_numbers_issued: [],
        stock_legend_ids: [],
        vestings: [],
        comments: [],
      };
      delete (daml as Record<string, unknown>).issuance_type;
      const result = damlStockIssuanceDataToNative(
        daml as unknown as Parameters<typeof damlStockIssuanceDataToNative>[0]
      );
      expect(result.issuance_type).toBeUndefined();
    });
  });
});
