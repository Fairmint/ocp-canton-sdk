/** Shared exact contract for source, emitted, and package-facing conversion types. */

import type { IsExactly } from './typeAssertions';

interface ExpectedMonetary {
  amount: string;
  currency: string;
}

interface ExpectedCapitalizationDefinitionRules {
  include_outstanding_shares: boolean;
  include_outstanding_options: boolean;
  include_outstanding_unissued_options: boolean;
  include_this_security: boolean;
  include_other_converting_securities: boolean;
  include_option_pool_topup_for_promised_options: boolean;
  include_additional_option_pool_topup: boolean;
  include_new_money: boolean;
}

interface ExpectedValuationBase {
  type: 'VALUATION_BASED_CONVERSION';
  capitalization_definition?: string;
  capitalization_definition_rules?: ExpectedCapitalizationDefinitionRules;
}

type ExpectedValuation = ExpectedValuationBase &
  (
    | {
        valuation_type: 'CAP' | 'FIXED';
        valuation_amount: ExpectedMonetary;
      }
    | {
        valuation_type: 'ACTUAL';
        valuation_amount?: ExpectedMonetary;
      }
  );

type ExpectedPersistedValuation = ExpectedValuation & { valuation_amount: ExpectedMonetary };

interface ExpectedCustom {
  type: 'CUSTOM_CONVERSION';
  custom_conversion_description: string;
}

interface ExpectedPercentCapitalization {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  converts_to_percent: string;
  capitalization_definition?: string;
  capitalization_definition_rules?: ExpectedCapitalizationDefinitionRules;
}

interface ExpectedFixedAmount {
  type: 'FIXED_AMOUNT_CONVERSION';
  converts_to_quantity: string;
}

interface ExpectedSharePriceBase {
  type: 'PPS_BASED_CONVERSION';
  description: string;
}

type ExpectedSharePrice =
  | (ExpectedSharePriceBase & {
      discount: true;
      discount_percentage: string;
      discount_amount?: never;
    })
  | (ExpectedSharePriceBase & {
      discount: true;
      discount_amount: ExpectedMonetary;
      discount_percentage?: never;
    })
  | (ExpectedSharePriceBase & {
      discount: false;
      discount_percentage?: never;
      discount_amount?: never;
    });

interface ExpectedInterestRate {
  rate: string;
  accrual_start_date: string;
  accrual_end_date?: string;
}

interface ExpectedNote {
  type: 'CONVERTIBLE_NOTE_CONVERSION';
  interest_rates: ExpectedInterestRate[];
  day_count_convention: 'ACTUAL_365' | '30_360';
  interest_payout: 'DEFERRED' | 'CASH';
  interest_accrual_period: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  compounding_type: 'SIMPLE' | 'COMPOUNDING';
  conversion_discount?: string;
  conversion_valuation_cap?: ExpectedMonetary;
  capitalization_definition?: string;
  capitalization_definition_rules?: ExpectedCapitalizationDefinitionRules;
  exit_multiple?: { numerator: string; denominator: string };
  conversion_mfn?: boolean;
}

type ExpectedWarrantMechanism =
  | ExpectedCustom
  | ExpectedPercentCapitalization
  | ExpectedFixedAmount
  | ExpectedValuation
  | ExpectedSharePrice;

type ExpectedPersistedWarrantMechanism =
  | ExpectedCustom
  | ExpectedPercentCapitalization
  | ExpectedFixedAmount
  | ExpectedPersistedValuation
  | ExpectedSharePrice;

interface ExpectedWarrantRight {
  type: 'WARRANT_CONVERSION_RIGHT';
  conversion_mechanism: ExpectedWarrantMechanism;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
}

interface ExpectedPersistedWarrantRight extends Omit<ExpectedWarrantRight, 'conversion_mechanism'> {
  conversion_mechanism: ExpectedPersistedWarrantMechanism;
}

export interface ConversionMechanismContractTypes {
  valuation: unknown;
  persistedValuation: unknown;
  note: unknown;
  warrantMechanism: unknown;
  persistedWarrantMechanism: unknown;
  warrantRight: unknown;
  persistedWarrantRight: unknown;
}

/**
 * Any-resistant public conversion contract. Every comparison is exact, so
 * missing fields, extra optional fields, widened discriminators, and nested
 * `any` all fail at every package surface.
 */
export type ConversionMechanismContract<Types extends ConversionMechanismContractTypes> = IsExactly<
  readonly [
    Types['valuation'],
    Types['persistedValuation'],
    Types['note'],
    Types['warrantMechanism'],
    Types['persistedWarrantMechanism'],
    Types['warrantRight'],
    Types['persistedWarrantRight'],
  ],
  readonly [
    ExpectedValuation,
    ExpectedPersistedValuation,
    ExpectedNote,
    ExpectedWarrantMechanism,
    ExpectedPersistedWarrantMechanism,
    ExpectedWarrantRight,
    ExpectedPersistedWarrantRight,
  ]
>;
