/** Compile-time contracts for canonical conversion mechanisms in built declarations. */

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
  OcfWritableDataTypeFor,
  PersistedStockClassRatioConversionMechanism,
  PersistedWarrantConversionMechanism,
  PersistedWarrantConversionRight,
  PersistedWarrantValuationBasedConversionMechanism,
  RatioConversionMechanism,
  SharePriceBasedConversionMechanism,
  StockClassConversionRight,
  ValuationBasedConversionMechanism,
  WarrantConversionMechanism,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantTriggerConversionRight,
} from '../../dist';
import type { DamlStockClassConversionRatioAdjustmentData } from '../../dist/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import type {
  ConversionMechanismContract,
  ConversionMechanismContractTypes,
} from '../typeContracts/conversionMechanisms';
import type { Assert } from '../typeContracts/typeAssertions';

interface BuiltConversionTypes extends ConversionMechanismContractTypes {
  valuation: ValuationBasedConversionMechanism;
  persistedValuation: PersistedWarrantValuationBasedConversionMechanism;
  note: NoteConversionMechanism;
  warrantMechanism: WarrantConversionMechanism;
  persistedWarrantMechanism: PersistedWarrantConversionMechanism;
  warrantRight: WarrantConversionRight;
  persistedWarrantRight: PersistedWarrantConversionRight;
}

const builtConversionTypesAreExact: Assert<ConversionMechanismContract<BuiltConversionTypes>> = true;
void builtConversionTypesAreExact;

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
      // @ts-expect-error Built declarations keep generated DAML Numeric values string-only.
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
  conversion_mechanism: persistedRatio,
  converts_to_stock_class_id: 'common-class',
};
const stockClassWithCeilingRounding: StockClassConversionRight = {
  ...stockClass,
  conversion_mechanism: {
    ...persistedRatio,
    // @ts-expect-error built declarations reject lossy CEILING rounding on v34 stock-class rights
    rounding_type: 'CEILING',
  },
};
const stockClassWithFloorRounding: StockClassConversionRight = {
  ...stockClass,
  conversion_mechanism: {
    ...persistedRatio,
    // @ts-expect-error built declarations reject lossy FLOOR rounding on v34 stock-class rights
    rounding_type: 'FLOOR',
  },
};
const warrantConvertible: WarrantTriggerConversionRight = convertible;

const conditionTrigger: ConvertibleConversionTrigger = {
  type: 'AUTOMATIC_ON_CONDITION',
  trigger_id: 'condition',
  trigger_condition: 'Qualified financing closes',
  conversion_right: convertible,
};
const dateTrigger: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'date',
  trigger_date: '2027-01-01',
  conversion_right: warrant,
};
const rangeTrigger: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'range',
  start_date: '2027-01-01',
  end_date: '2027-12-31',
  conversion_right: warrant,
};

// @ts-expect-error built stock-class rights require their concrete destination class
const stockClassWithoutTarget: StockClassConversionRight = {
  type: 'STOCK_CLASS_CONVERSION_RIGHT',
  conversion_mechanism: persistedRatio,
};

void rules;
void pps;
void convertible;
void warrant;
void stockClass;
void stockClassWithCeilingRounding;
void stockClassWithFloorRounding;
void warrantConvertible;
void conditionTrigger;
void dateTrigger;
void rangeTrigger;
void stockClassWithoutTarget;

// @ts-expect-error built condition triggers require trigger_condition
const missingCondition: ConvertibleConversionTrigger = {
  type: 'ELECTIVE_ON_CONDITION',
  trigger_id: 'missing-condition',
  conversion_right: convertible,
};
void missingCondition;

// @ts-expect-error built date triggers require trigger_date
const missingDate: WarrantExerciseTrigger = {
  type: 'AUTOMATIC_ON_DATE',
  trigger_id: 'missing-date',
  conversion_right: warrant,
};
void missingDate;

// @ts-expect-error built range triggers require both endpoints
const missingEnd: WarrantExerciseTrigger = {
  type: 'ELECTIVE_IN_RANGE',
  trigger_id: 'missing-end',
  start_date: '2027-01-01',
  conversion_right: warrant,
};
void missingEnd;

// @ts-expect-error built fieldless triggers forbid condition fields
const forbiddenAtWillField: WarrantExerciseTrigger = {
  type: 'ELECTIVE_AT_WILL',
  trigger_id: 'forbidden-at-will-field',
  conversion_right: warrant,
  trigger_condition: 'Not applicable',
};
void forbiddenAtWillField;

// @ts-expect-error built declarations require a non-empty convertible trigger list
const emptyConvertibleTriggers: OcfConvertibleIssuance['conversion_triggers'] = [];
void emptyConvertibleTriggers;

const convertibleConversionResultIds: OcfConvertibleConversion['resulting_security_ids'] = ['stock-security'];
void convertibleConversionResultIds;

// @ts-expect-error built declarations require at least one convertible-conversion result security
const emptyConvertibleConversionResultIds: OcfConvertibleConversion['resulting_security_ids'] = [];
void emptyConvertibleConversionResultIds;

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

const actualWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
void actualWithoutAmount;

// @ts-expect-error built v34 persistence declarations require ACTUAL amounts
const persistedActualWithoutAmount: PersistedWarrantValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
void persistedActualWithoutAmount;

const canonicalDeferredActualIssuance = {
  object_type: 'TX_WARRANT_ISSUANCE',
  id: 'deferred-actual',
  date: '2026-01-01',
  security_id: 'warrant-security',
  custom_id: 'W-ACTUAL',
  stakeholder_id: 'stakeholder',
  security_law_exemptions: [],
  purchase_price: { amount: '1', currency: 'USD' },
  exercise_triggers: [
    {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'actual-trigger',
      conversion_right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'ACTUAL',
        },
      },
    },
  ],
} satisfies OcfWarrantIssuance;

// @ts-expect-error built batch writes require the deferred ACTUAL amount to be resolved
const unwritableDeferredActualIssuance: OcfWritableDataTypeFor<'warrantIssuance'> = canonicalDeferredActualIssuance;
void unwritableDeferredActualIssuance;

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
  conversion_mechanism: persistedRatio,
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
