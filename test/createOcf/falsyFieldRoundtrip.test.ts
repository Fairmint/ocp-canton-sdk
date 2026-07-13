/**
 * Tests that falsy values (false, 0, "0") survive the DAML-to-OCF round-trip.
 * Catches truthiness bugs where `value && {...}` or `value ? {...} : {}` would drop valid falsy values.
 */

import { damlConvertibleConversionToNative } from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { damlStockIssuanceDataToNative } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

describe('falsy field preservation in DAML-to-OCF converters', () => {
  describe('boolean false fields', () => {
    test('conversion_mfn: false is preserved in Note conversion mechanism', () => {
      const daml = {
        id: 'ci-1',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: '',
        stakeholder_id: 'sh-1',
        investment_amount: { amount: '1000', currency: 'USD' },
        convertible_type: 'OcfConvertibleNote',
        conversion_triggers: [
          {
            type_: 'OcfTriggerTypeTypeAutomaticOnDate',
            trigger_id: 't1',
            conversion_right: {
              conversion_mechanism: {
                tag: 'OcfConvMechNote',
                value: {
                  interest_rates: [{ rate: '0.05', accrual_start_date: '2024-01-01' }],
                  conversion_mfn: false,
                },
              },
            },
          },
        ],
        seniority: 1,
        security_law_exemptions: [],
      };
      const result = damlConvertibleIssuanceDataToNative(daml);
      const mechanism = result.conversion_triggers[0]?.conversion_right.conversion_mechanism;
      expect(mechanism).toBeDefined();
      expect('conversion_mfn' in mechanism).toBe(true);
      expect((mechanism as unknown as Record<string, unknown>).conversion_mfn).toBe(false);
    });

    test('conversion_mfn: false is preserved in SAFE conversion mechanism', () => {
      const daml = {
        id: 'ci-2',
        date: '2024-01-15T00:00:00Z',
        security_id: 'sec-1',
        custom_id: '',
        stakeholder_id: 'sh-1',
        investment_amount: { amount: '1000', currency: 'USD' },
        convertible_type: 'OcfConvertibleSafe',
        conversion_triggers: [
          {
            type_: 'OcfTriggerTypeTypeAutomaticOnDate',
            trigger_id: 't1',
            conversion_right: {
              conversion_mechanism: {
                tag: 'OcfConvMechSAFE',
                value: { conversion_mfn: false },
              },
            },
          },
        ],
        seniority: 1,
        security_law_exemptions: [],
      };
      const result = damlConvertibleIssuanceDataToNative(daml);
      const mechanism = result.conversion_triggers[0]?.conversion_right.conversion_mechanism;
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
            trigger: 'OcfVestingStartTrigger',
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
      const portion = result.vesting_conditions[0]?.portion;
      expect(portion).toBeDefined();
      expect('remainder' in portion!).toBe(true);
      expect(portion!.remainder).toBe(false);
    });
  });

  describe('numeric zero fields', () => {
    test('liquidation_preference_multiple: "0" is preserved in stock class', () => {
      const daml = {
        id: 'sc-1',
        name: 'Series A',
        class_type: 'OcfStockClassTypePreferred',
        default_id_prefix: 'SA-',
        initial_shares_authorized: '1000000',
        votes_per_share: '1',
        seniority: '1',
        conversion_rights: [],
        liquidation_preference_multiple: '0',
      };
      const result = damlStockClassDataToNative(daml as unknown as Parameters<typeof damlStockClassDataToNative>[0]);
      expect(result.liquidation_preference_multiple).toBe('0');
    });

    test('participation_cap_multiple: "0" is preserved in stock class', () => {
      const daml = {
        id: 'sc-2',
        name: 'Series B',
        class_type: 'OcfStockClassTypePreferred',
        default_id_prefix: 'SB-',
        initial_shares_authorized: '1000000',
        votes_per_share: '1',
        seniority: '2',
        conversion_rights: [],
        participation_cap_multiple: '0',
      };
      const result = damlStockClassDataToNative(daml as unknown as Parameters<typeof damlStockClassDataToNative>[0]);
      expect(result.participation_cap_multiple).toBe('0');
    });

    test('quantity_converted: "0" is preserved in convertible conversion', () => {
      const daml = {
        id: 'conv-1',
        date: '2024-01-15T00:00:00Z',
        reason_text: 'Conversion',
        security_id: 'sec-1',
        trigger_id: 't1',
        resulting_security_ids: ['sec-2'],
        comments: [],
        quantity_converted: '0',
      };
      const result = damlConvertibleConversionToNative(daml);
      expect(result.quantity_converted).toBe('0');
    });

    test('quantity_converted: 0 (number) is preserved in convertible conversion', () => {
      const daml = {
        id: 'conv-2',
        date: '2024-01-15T00:00:00Z',
        reason_text: 'Conversion',
        security_id: 'sec-1',
        trigger_id: 't1',
        resulting_security_ids: ['sec-2'],
        comments: [],
        quantity_converted: 0,
      };
      const result = damlConvertibleConversionToNative(
        daml as unknown as Parameters<typeof damlConvertibleConversionToNative>[0]
      );
      expect(result.quantity_converted).toBe('0');
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
        stock_legend_ids: [],
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
        stock_legend_ids: [],
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
