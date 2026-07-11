/** Compile-time contracts for canonical conversion mechanisms in built declarations. */

import type {
  CapitalizationDefinitionRules,
  ConversionMechanism,
  ConvertibleConversionRight,
  CustomConversionMechanism,
  NoteConversionMechanism,
  OcfConvertibleIssuance,
  OcfWarrantIssuance,
  RatioConversionMechanism,
  SharePriceBasedConversionMechanism,
  StockClassConversionRight,
  ValuationBasedConversionMechanism,
  WarrantConversionRight,
  WarrantTriggerConversionRight,
} from '../../dist';

const rules: CapitalizationDefinitionRules = {
  include_outstanding_shares: true,
  include_outstanding_options: true,
  include_outstanding_unissued_options: false,
  include_this_security: true,
  include_other_converting_securities: true,
  include_option_pool_topup_for_promised_options: false,
  include_additional_option_pool_topup: false,
  include_new_money: true,
};
const ratio: RatioConversionMechanism = {
  type: 'RATIO_CONVERSION',
  ratio: { numerator: '1', denominator: '2' },
  conversion_price: { amount: '3', currency: 'USD' },
  rounding_type: 'NORMAL',
};
const note: NoteConversionMechanism = {
  type: 'CONVERTIBLE_NOTE_CONVERSION',
  interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
  day_count_convention: '30_360',
  interest_payout: 'CASH',
  interest_accrual_period: 'MONTHLY',
  compounding_type: 'COMPOUNDING',
};
const valuation: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'FIXED',
  valuation_amount: { amount: '1', currency: 'USD' },
};
const pps: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'No discount',
  discount: false,
};
const convertible: ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: note,
};
const warrant: WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  conversion_mechanism: valuation,
};
const stockClass: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: ratio,
  converts_to_stock_class_id: 'common-class',
};
const warrantConvertible: WarrantTriggerConversionRight = convertible;

// @ts-expect-error built stock-class rights require their concrete destination class
const stockClassWithoutTarget: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: ratio,
};

void rules;
void pps;
void convertible;
void warrant;
void stockClass;
void warrantConvertible;
void stockClassWithoutTarget;

// @ts-expect-error built declarations require a non-empty convertible trigger list
const emptyConvertibleTriggers: OcfConvertibleIssuance['conversion_triggers'] = [];
void emptyConvertibleTriggers;

// @ts-expect-error built declarations require non-empty warrant vestings when present
const emptyWarrantVestings: NonNullable<OcfWarrantIssuance['vestings']> = [];
void emptyWarrantVestings;

// @ts-expect-error built declarations reject string mechanisms
const stringMechanism: ConversionMechanism = 'FIXED_AMOUNT_CONVERSION';
void stringMechanism;

// @ts-expect-error built declarations require all capitalization flags
const incompleteRules: CapitalizationDefinitionRules = { include_new_money: true };
void incompleteRules;

// @ts-expect-error built declarations require complete ratio mechanisms
const incompleteRatio: RatioConversionMechanism = { type: 'RATIO_CONVERSION' };
void incompleteRatio;

// @ts-expect-error built declarations require custom descriptions
const customWithoutDescription: CustomConversionMechanism = { type: 'CUSTOM_CONVERSION' };
void customWithoutDescription;

// @ts-expect-error built declarations require all note terms
const incompleteNote: NoteConversionMechanism = {
  type: 'CONVERTIBLE_NOTE_CONVERSION',
  interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
};
void incompleteNote;

const emptyInterestRates: NoteConversionMechanism = {
  ...note,
  // @ts-expect-error built declarations require at least one note rate
  interest_rates: [],
};
void emptyInterestRates;

// @ts-expect-error built declarations reject null note fields
const nullNote: NoteConversionMechanism = { ...note, interest_rates: null };
void nullNote;

// @ts-expect-error built declarations require CAP amounts
const capWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'CAP',
};
void capWithoutAmount;

// @ts-expect-error built declarations require FIXED amounts
const fixedWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'FIXED',
};
void fixedWithoutAmount;

// @ts-expect-error built declarations require ACTUAL amounts
const actualWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
void actualWithoutAmount;

const invalidValuationType: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  // @ts-expect-error built declarations expose the exact valuation enum
  valuation_type: '409A',
};
void invalidValuationType;

// @ts-expect-error built declarations require PPS descriptions
const ppsWithoutDescription: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  discount: false,
};
void ppsWithoutDescription;

// @ts-expect-error built declarations require PPS discount
const ppsWithoutDiscount: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Missing discount',
};
void ppsWithoutDiscount;

// @ts-expect-error built declarations forbid discount details when discount is false
const falseWithDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Contradictory discount',
  discount: false,
  discount_percentage: '0.1',
};
void falseWithDetails;

// @ts-expect-error built declarations require one detail when discount is true
const trueWithoutDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Missing detail',
  discount: true,
};
void trueWithoutDetails;

// @ts-expect-error built declarations forbid selecting both discount representations
const trueWithBothDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Ambiguous discount',
  discount: true,
  discount_percentage: '0.1',
  discount_amount: { amount: '1', currency: 'USD' },
};
void trueWithBothDetails;

// @ts-expect-error built declarations require conversion-right discriminators
const missingRightType: ConvertibleConversionRight = { conversion_mechanism: note };
void missingRightType;

const badConvertible: ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  // @ts-expect-error built declarations keep mechanism/right correlation
  conversion_mechanism: valuation,
};
void badConvertible;

const badWarrant: WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  // @ts-expect-error built declarations reject SAFE under warrant rights
  conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
};
void badWarrant;

const badStockClass: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: ratio,
  converts_to_stock_class_id: 'common-class',
  // @ts-expect-error built declarations do not expose DAML passthrough fields
  conversion_price: { amount: '3', currency: 'USD' },
};
void badStockClass;

const stockClassWithUnrelatedMechanism: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  converts_to_stock_class_id: 'common-class',
  // @ts-expect-error built declarations permit ratio conversion only
  conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1' },
};
void stockClassWithUnrelatedMechanism;
