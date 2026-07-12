/** Compile-time contracts for canonical conversion mechanisms and rights. */

import type {
  CapitalizationDefinitionRules,
  ConversionMechanism,
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  CustomConversionMechanism,
  NoteConversionMechanism,
  OcfConvertibleConversion,
  OcfConvertibleIssuance,
  OcfWarrantIssuance,
  PersistedStockClassRatioConversionMechanism,
  RatioConversionMechanism,
  SharePriceBasedConversionMechanism,
  StockClassConversionRight,
  ValuationBasedConversionMechanism,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantTriggerConversionRight,
} from '../../src';
import type { DamlStockClassConversionRatioAdjustmentData } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';

const generatedRatioAdjustment: DamlStockClassConversionRatioAdjustmentData = {
  id: 'ratio-adjustment',
  date: '2026-01-01T00:00:00.000Z',
  stock_class_id: 'stock-class',
  new_ratio_conversion_mechanism: {
    conversion_price: { amount: '1', currency: 'USD' },
    ratio: { numerator: '1', denominator: '1' },
    rounding_type: 'OcfRoundingNormal',
  },
  comments: [],
};

const invalidGeneratedRatioAdjustment: DamlStockClassConversionRatioAdjustmentData = {
  ...generatedRatioAdjustment,
  new_ratio_conversion_mechanism: {
    ...generatedRatioAdjustment.new_ratio_conversion_mechanism,
    ratio: {
      ...generatedRatioAdjustment.new_ratio_conversion_mechanism.ratio,
      // @ts-expect-error Generated DAML Numeric values are strings, never JavaScript numbers.
      numerator: 1,
    },
  },
};
void invalidGeneratedRatioAdjustment;

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
const persistedRatio: PersistedStockClassRatioConversionMechanism = {
  ...ratio,
  rounding_type: 'NORMAL',
};

const note: NoteConversionMechanism = {
  type: 'CONVERTIBLE_NOTE_CONVERSION',
  interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
  day_count_convention: 'ACTUAL_365',
  interest_payout: 'DEFERRED',
  interest_accrual_period: 'ANNUAL',
  compounding_type: 'SIMPLE',
};

const cappedValuation: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'CAP',
  valuation_amount: { amount: '10000000', currency: 'USD' },
};
const actualValuation: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
  valuation_amount: { amount: '10000000', currency: 'USD' },
};

const percentageDiscount: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: '80% of the next financing price',
  discount: true,
  discount_percentage: '0.20',
};
const amountDiscount: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'One dollar below the next financing price',
  discount: true,
  discount_amount: { amount: '1', currency: 'USD' },
};
const noDiscount: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Next financing price',
  discount: false,
};

const convertibleRight: ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: note,
};
const warrantRight: WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  conversion_mechanism: cappedValuation,
};
const stockClassRight: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: persistedRatio,
  converts_to_stock_class_id: 'common-class',
};
const stockClassWithCeilingRounding: StockClassConversionRight = {
  ...stockClassRight,
  conversion_mechanism: {
    ...persistedRatio,
    // @ts-expect-error Canton v34 stock-class rights cannot persist CEILING rounding.
    rounding_type: 'CEILING',
  },
};
const stockClassWithFloorRounding: StockClassConversionRight = {
  ...stockClassRight,
  conversion_mechanism: {
    ...persistedRatio,
    // @ts-expect-error Canton v34 stock-class rights cannot persist FLOOR rounding.
    rounding_type: 'FLOOR',
  },
};
const warrantConvertibleRight: WarrantTriggerConversionRight = convertibleRight;

const automaticConditionTrigger: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_CONDITION',
  trigger_id: 'automatic-condition',
  trigger_condition: 'Qualified financing closes',
  conversion_right: convertibleRight,
};
const automaticDateTrigger: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'automatic-date',
  trigger_date: '2027-01-01',
  conversion_right: warrantRight,
};
const rangeTrigger: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'range',
  start_date: '2027-01-01',
  end_date: '2027-12-31',
  conversion_right: warrantRight,
};

// @ts-expect-error stock-class rights require their concrete destination class
const stockClassWithoutTarget: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: persistedRatio,
};

void rules;
void actualValuation;
void percentageDiscount;
void amountDiscount;
void noDiscount;
void convertibleRight;
void warrantRight;
void stockClassRight;
void stockClassWithCeilingRounding;
void stockClassWithFloorRounding;
void warrantConvertibleRight;
void automaticConditionTrigger;
void automaticDateTrigger;
void rangeTrigger;
void stockClassWithoutTarget;

// @ts-expect-error condition triggers require trigger_condition
const missingTriggerCondition: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_ON_CONDITION',
  trigger_id: 'missing-condition',
  conversion_right: convertibleRight,
};
void missingTriggerCondition;

// @ts-expect-error date triggers require trigger_date
const missingTriggerDate: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'missing-date',
  conversion_right: warrantRight,
};
void missingTriggerDate;

// @ts-expect-error range triggers require both endpoints
const missingRangeEnd: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'missing-range-end',
  start_date: '2027-01-01',
  conversion_right: warrantRight,
};
void missingRangeEnd;

// @ts-expect-error fieldless triggers forbid condition fields
const forbiddenAtWillField: WarrantExerciseTrigger = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'forbidden-at-will-field',
  conversion_right: warrantRight,
  trigger_condition: 'Not applicable',
};
void forbiddenAtWillField;

// @ts-expect-error convertible issuances require at least one conversion trigger
const emptyConvertibleTriggers: OcfConvertibleIssuance['conversion_triggers'] = [];
void emptyConvertibleTriggers;

const convertibleConversionResultIds: OcfConvertibleConversion['resulting_security_ids'] = ['stock-security'];
void convertibleConversionResultIds;

// @ts-expect-error convertible conversions require at least one resulting security
const emptyConvertibleConversionResultIds: OcfConvertibleConversion['resulting_security_ids'] = [];
void emptyConvertibleConversionResultIds;

// @ts-expect-error explicitly present warrant vestings require at least one entry
const emptyWarrantVestings: NonNullable<OcfWarrantIssuance['vestings']> = [];
void emptyWarrantVestings;

// @ts-expect-error conversion mechanisms are objects, not string shorthands
const stringMechanism: ConversionMechanism = 'RATIO_CONVERSION';
void stringMechanism;

// @ts-expect-error every capitalization rule flag is required
const incompleteRules: CapitalizationDefinitionRules = {
  include_outstanding_shares: true,
};
void incompleteRules;

// @ts-expect-error ratio requires conversion_price and rounding_type
const incompleteRatio: RatioConversionMechanism = {
  type: 'RATIO_CONVERSION',
  ratio: { numerator: '1', denominator: '1' },
};
void incompleteRatio;

// @ts-expect-error custom mechanisms require their legal description
const customWithoutDescription: CustomConversionMechanism = { type: 'CUSTOM_CONVERSION' };
void customWithoutDescription;

// @ts-expect-error every required note term must be present
const incompleteNote: NoteConversionMechanism = {
  type: 'CONVERTIBLE_NOTE_CONVERSION',
  interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
};
void incompleteNote;

const emptyInterestRates: NoteConversionMechanism = {
  ...note,
  interest_rates: [],
};
void emptyInterestRates;

const nullInterestRates: NoteConversionMechanism = {
  ...note,
  // @ts-expect-error note interest_rates cannot be null
  interest_rates: null,
};
void nullInterestRates;

// @ts-expect-error CAP requires valuation_amount
const capWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'CAP',
};
void capWithoutAmount;

// @ts-expect-error FIXED requires valuation_amount
const fixedWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'FIXED',
};
void fixedWithoutAmount;

// @ts-expect-error ACTUAL requires the concrete ledger valuation amount too
const actualWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
void actualWithoutAmount;

const invalidValuationType: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  // @ts-expect-error valuation formula types are the exact schema enum
  valuation_type: '409A',
};
void invalidValuationType;

// @ts-expect-error PPS description is required
const ppsWithoutDescription: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  discount: false,
};
void ppsWithoutDescription;

// @ts-expect-error PPS discount is required
const ppsWithoutDiscount: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Missing discount',
};
void ppsWithoutDiscount;

// @ts-expect-error discount details are forbidden when discount is false
const falseWithDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Contradictory discount',
  discount: false,
  discount_percentage: '0.10',
};
void falseWithDetails;

// @ts-expect-error a true discount requires exactly one detail
const trueWithoutDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Missing details',
  discount: true,
};
void trueWithoutDetails;

// @ts-expect-error a true discount cannot select both detail representations
const trueWithBothDetails: SharePriceBasedConversionMechanism = {
  type: 'PPS_BASED_CONVERSION',
  description: 'Ambiguous details',
  discount: true,
  discount_percentage: '0.1',
  discount_amount: { amount: '1', currency: 'USD' },
};
void trueWithBothDetails;

// @ts-expect-error each conversion right requires its exact discriminator
const convertibleWithoutType: ConvertibleConversionRight = { conversion_mechanism: note };
void convertibleWithoutType;

const convertibleWithWarrantMechanism: ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  // @ts-expect-error valuation mechanisms are not allowed on convertible rights
  conversion_mechanism: cappedValuation,
};
void convertibleWithWarrantMechanism;

const warrantWithSafe: WarrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  // @ts-expect-error SAFE mechanisms are not allowed on warrant rights
  conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
};
void warrantWithSafe;

const stockClassWithPassthrough: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: persistedRatio,
  converts_to_stock_class_id: 'common-class',
  // @ts-expect-error DAML passthrough fields are not part of a native conversion right
  ratio_numerator: '1',
};
void stockClassWithPassthrough;

const stockClassWithUnrelatedMechanism: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  converts_to_stock_class_id: 'common-class',
  // @ts-expect-error stock-class rights permit ratio conversion only
  conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1' },
};
void stockClassWithUnrelatedMechanism;
