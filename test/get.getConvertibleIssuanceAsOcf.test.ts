import { OcpClient } from '../src';

describe('get: getConvertibleIssuanceAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.convertibleIssuance.getConvertibleIssuanceAsOcf({ contractId: 'convertible-issuance-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'b7d3ad8e-15ea-40e9-b68a-93d5a9f4e5bc',
        date: '2023-11-01',
        security_id: '07dc6a31-3852-42b2-9e36-3be2698a4eb9',
        custom_id: 'CN-2',
        stakeholder_id: 'b21ec946-4e68-424c-9050-4cf2345d1b02',
        investment_amount: { amount: '25000', currency: 'USD' },
        convertible_type: 'SAFE',
        conversion_triggers: [
          {
            type: 'AUTOMATIC_ON_CONDITION',
            trigger_id: 'cd1f2ac7-1d39-4c2d-b6cb-77e395cbc415',
            nickname: 'Next Financing',
            trigger_description: 'Conversion at Next Equity Financing',
            trigger_condition: 'SAFE shall convert upon completion of next equity financing (as defined in the instrument)',
            conversion_right: {
              type: 'CONVERTIBLE_CONVERSION_RIGHT',
              conversion_mechanism: {
                type: 'SAFE_CONVERSION',
                conversion_mfn: false,
                conversion_valuation_cap: { amount: '7000000', currency: 'USD' },
                conversion_timing: 'POST_MONEY'
              },
              converts_to_future_round: true
            }
          }
        ],
        seniority: 1
      },
      contractId: 'convertible-issuance-minimal'
    });
  });

  test('safe minimal', async () => {
    const client = new OcpClient();
    const res = await client.convertibleIssuance.getConvertibleIssuanceAsOcf({ contractId: 'convertible-issuance-safe-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'ci-1',
        date: '2025-01-03',
        security_id: 'conv-1',
        custom_id: 'C-1',
        stakeholder_id: 'st-1',
        investment_amount: { amount: '10000', currency: 'USD' },
        convertible_type: 'SAFE',
        conversion_triggers: [
          {
            type: 'AUTOMATIC_ON_DATE',
            trigger_id: 'ci-1-trigger-1',
            conversion_right: {
              type: 'CONVERTIBLE_CONVERSION_RIGHT',
              conversion_mechanism: {
                type: 'SAFE_CONVERSION',
                conversion_mfn: false
              }
            }
          }
        ],
        seniority: 1
      },
      contractId: 'convertible-issuance-safe-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.convertibleIssuance.getConvertibleIssuanceAsOcf({ contractId: 'convertible-issuance-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: '72a00893-ace6-4a9e-9881-5e79a06af2b2',
        date: '2024-05-28',
        security_id: '1b39a78d-24b1-4be4-b3aa-bd2bcd716130',
        custom_id: 'CN-5',
        stakeholder_id: 'a3829b26-acb9-4273-a63a-946fff5ccc24',
        investment_amount: { amount: '25000.0000000000', currency: 'USD' },
        convertible_type: 'SAFE',
        conversion_triggers: [
          {
            type: 'AUTOMATIC_ON_CONDITION',
            trigger_id: 'a84b1867-6cfa-42cf-94be-1e97d51bd361',
            nickname: 'Qualified Financing Conversion',
            trigger_description: 'Automatic conversion upon a Qualified Financing with aggregate proceeds of at least $1,000,000.',
            trigger_condition: 'Company issues and sells Preferred Stock in a bona fide transaction or series of transactions with the principal purpose of raising capital for aggregate proceeds of at least $1,000,000.',
            conversion_right: {
              type: 'CONVERTIBLE_CONVERSION_RIGHT',
              conversion_mechanism: {
                type: 'SAFE_CONVERSION',
                conversion_mfn: false,
                conversion_discount: '0.1500000000',
                conversion_timing: 'POST_MONEY',
                conversion_valuation_cap: { amount: '40000000.0000000000', currency: 'USD' },
                capitalization_definition: "Includes all issued and outstanding shares of the Company’s capital stock, all shares issuable upon conversion of this SAFE and other instruments, all issued and outstanding options, restricted stock awards or purchases, RSUs, SARs, warrants or similar securities, Promised Options, and the Unissued Option Pool, except any increase to the Unissued Option Pool in connection with the Qualified Financing.",
                capitalization_definition_rules: {
                  include_additional_option_pool_topup: false,
                  include_new_money: false,
                  include_option_pool_topup_for_promised_options: false,
                  include_other_converting_securities: true,
                  include_outstanding_options: true,
                  include_outstanding_shares: true,
                  include_outstanding_unissued_options: true,
                  include_this_security: true
                }
              },
              converts_to_future_round: true
            }
          },
          {
            type: 'AUTOMATIC_ON_CONDITION',
            trigger_id: '536410c5-73c4-4647-b70d-a724af618c7e',
            nickname: 'Liquidity Event Conversion',
            trigger_description: 'Automatic conversion upon a Liquidity Event such as a Change of Control, Direct Listing, or Initial Public Offering.',
            trigger_condition: 'Change of Control, Direct Listing, or Initial Public Offering occurs before the termination of this SAFE.',
            conversion_right: {
              type: 'CONVERTIBLE_CONVERSION_RIGHT',
              conversion_mechanism: {
                type: 'SAFE_CONVERSION',
                conversion_mfn: false,
                conversion_timing: 'POST_MONEY',
                conversion_valuation_cap: { amount: '40000000.0000000000', currency: 'USD' },
                capitalization_definition: 'Includes all shares of Capital Stock issued and outstanding, all issued and outstanding Options and Promised Options to the extent receiving Proceeds, and all Converting Securities, excluding the Unissued Option Pool.',
                capitalization_definition_rules: {
                  include_additional_option_pool_topup: false,
                  include_new_money: false,
                  include_option_pool_topup_for_promised_options: false,
                  include_other_converting_securities: true,
                  include_outstanding_options: true,
                  include_outstanding_shares: true,
                  include_outstanding_unissued_options: false,
                  include_this_security: true
                }
              },
              converts_to_future_round: true
            }
          }
        ],
        seniority: 1,
        security_law_exemptions: [
          { description: 'Exemption under the Securities Act of 1933 and applicable state securities laws', jurisdiction: 'US' }
        ],
        consideration_text: 'Payment of $25,000.00',
        comments: [
          'This SAFE includes both a valuation cap and a discount rate for conversion.'
        ]
      },
      contractId: 'convertible-issuance-full'
    });
  });
});


