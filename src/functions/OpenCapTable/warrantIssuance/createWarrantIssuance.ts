import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { CapitalizationDefinitionRules, Monetary } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  normalizeNumericString,
  optionalString,
} from '../../../utils/typeConversions';

export interface SimpleVesting {
  date: string;
  amount: string;
}

export type WarrantTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED';

export type WarrantConversionMechanismInput =
  | { type: 'CUSTOM_CONVERSION'; custom_conversion_description: string }
  | {
      type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
      converts_to_percent: string;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: CapitalizationDefinitionRules | null;
    }
  | { type: 'FIXED_AMOUNT_CONVERSION'; converts_to_quantity: string }
  | {
      type: 'VALUATION_BASED_CONVERSION';
      valuation_type: string;
      valuation_amount?: Monetary | null;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: CapitalizationDefinitionRules | null;
    }
  | {
      type: 'PPS_BASED_CONVERSION';
      description: string;
      discount: boolean;
      discount_percentage?: string | null;
      discount_amount?: Monetary | null;
    };

/** Strict ratio-conversion mechanism for STOCK_CLASS_CONVERSION_RIGHT triggers (OCF RatioConversionMechanism) */
export interface StockClassRatioConversionMechanismInput {
  type: 'RATIO_CONVERSION';
  ratio: { numerator: string; denominator: string };
  conversion_price: Monetary;
  rounding_type: 'NORMAL' | 'CEILING' | 'FLOOR';
}

/** WARRANT_CONVERSION_RIGHT branch of a warrant exercise trigger's conversion_right */
export interface WarrantConversionRightInput {
  type: 'WARRANT_CONVERSION_RIGHT';
  conversion_mechanism: WarrantConversionMechanismInput;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
}

/** STOCK_CLASS_CONVERSION_RIGHT branch of a warrant exercise trigger's conversion_right */
export interface StockClassConversionRightInput {
  type: 'STOCK_CLASS_CONVERSION_RIGHT';
  conversion_mechanism: StockClassRatioConversionMechanismInput;
  converts_to_stock_class_id: string;
  converts_to_future_round?: boolean;
}

export type WarrantConversionRightKindInput = WarrantConversionRightInput | StockClassConversionRightInput;

/** Object-shaped exercise trigger row (OCF schema); bare trigger-type strings are not accepted for issuance. */
export interface WarrantExerciseTriggerInput {
  type: WarrantTriggerTypeInput;
  trigger_id?: string;
  nickname?: string;
  trigger_description?: string;
  trigger_date?: string; // YYYY-MM-DD or ISO datetime
  trigger_condition?: string;
  start_date?: string; // YYYY-MM-DD or ISO datetime (ELECTIVE_IN_RANGE)
  end_date?: string; // YYYY-MM-DD or ISO datetime (ELECTIVE_IN_RANGE)
  conversion_right?: WarrantConversionRightKindInput;
}

function normalizeTriggerType(t: WarrantTriggerTypeInput): WarrantTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(
  t: WarrantTriggerTypeInput
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  switch (t) {
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeTypeAutomaticOnDate';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeTypeElectiveAtWill';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeTypeElectiveOnCondition';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeTypeElectiveInRange';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeTypeUnspecified';
    case 'AUTOMATIC_ON_CONDITION':
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown warrant trigger type: ${exhaustiveCheck as string}`, {
        source: 'warrantTrigger.type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function mapWarrantCapitalizationRules(
  rules: CapitalizationDefinitionRules | null | undefined
): Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null {
  if (!rules) return null;
  return {
    include_outstanding_shares: rules.include_outstanding_shares ?? false,
    include_outstanding_options: rules.include_outstanding_options ?? false,
    include_outstanding_unissued_options: rules.include_outstanding_unissued_options ?? false,
    include_this_security: rules.include_this_security ?? false,
    include_other_converting_securities: rules.include_other_converting_securities ?? false,
    include_option_pool_topup_for_promised_options: rules.include_option_pool_topup_for_promised_options ?? false,
    include_additional_option_pool_topup: rules.include_additional_option_pool_topup ?? false,
    include_new_money: rules.include_new_money ?? false,
  } as Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules;
}

function warrantMechanismToDamlVariant(
  m: WarrantConversionMechanismInput
): Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism {
  const raw = m as unknown;
  if (raw == null || typeof raw !== 'object' || !('type' in raw)) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism',
      'conversion_right.conversion_mechanism is required for warrant issuance',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: raw }
    );
  }
  const mech = raw as WarrantConversionMechanismInput;
  switch (mech.type) {
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: { custom_conversion_description: mech.custom_conversion_description },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;

    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: normalizeNumericString(mech.converts_to_percent),
          capitalization_definition: optionalString(mech.capitalization_definition ?? undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(mech.capitalization_definition_rules),
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;

    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: { converts_to_quantity: normalizeNumericString(mech.converts_to_quantity) },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;

    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: mech.valuation_type,
          valuation_amount: mech.valuation_amount ? monetaryToDaml(mech.valuation_amount) : null,
          capitalization_definition: optionalString(mech.capitalization_definition ?? undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(mech.capitalization_definition_rules),
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;

    case 'PPS_BASED_CONVERSION': {
      const dpct = mech.discount_percentage;
      return {
        tag: 'OcfWarrantMechanismPpsBased',
        value: {
          description: mech.description,
          discount: mech.discount,
          discount_percentage: dpct === '' || dpct == null ? null : normalizeNumericString(dpct),
          discount_amount: mech.discount_amount ? monetaryToDaml(mech.discount_amount) : null,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfWarrantConversionMechanism;
    }

    default: {
      const _exhaustive: never = mech;
      throw new OcpParseError(
        `Unknown warrant conversion_mechanism.type: "${(_exhaustive as { type: string }).type}" for WARRANT_CONVERSION_RIGHT`,
        { code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
      );
    }
  }
}

type WarrantExerciseTriggerObject = WarrantExerciseTriggerInput;

function warrantNestedConversionTrigger(
  t: WarrantExerciseTriggerObject & { trigger_id: string },
  converts_to_stock_class_id: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const normalized = normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  const trigger_dateStr = typeof t.trigger_date === 'string' ? t.trigger_date : undefined;
  return {
    type_: typeEnum,
    trigger_id: t.trigger_id,
    nickname: typeof t.nickname === 'string' ? t.nickname : null,
    trigger_description: typeof t.trigger_description === 'string' ? t.trigger_description : null,
    trigger_date: trigger_dateStr ? dateStringToDAMLTime(trigger_dateStr) : null,
    trigger_condition: typeof t.trigger_condition === 'string' ? t.trigger_condition : null,
    start_date: typeof t.start_date === 'string' && t.start_date ? dateStringToDAMLTime(t.start_date) : null,
    end_date: typeof t.end_date === 'string' && t.end_date ? dateStringToDAMLTime(t.end_date) : null,
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        type_: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: 'Stock class conversion' },
        },
        converts_to_future_round: null,
        converts_to_stock_class_id,
      },
    },
  };
}

/** Typed helper: convert a strict StockClassRatioConversionMechanismInput to DAML ratio fields. */
function toDamlRatio(mech: StockClassRatioConversionMechanismInput): {
  ratio: Fairmint.OpenCapTable.Types.Stock.OcfRatio;
  conversion_price: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary;
} {
  // OcfStockClassConversionRight (DAML) has no rounding_type field — only NORMAL round-trips.
  if (mech.rounding_type !== 'NORMAL') {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism.rounding_type',
      'Warrant STOCK_CLASS_CONVERSION_RIGHT cannot persist rounding_type in DAML (OcfStockClassConversionRight omits it); use NORMAL or omit this trigger variant',
      { code: OcpErrorCodes.INVALID_FORMAT, receivedValue: mech.rounding_type }
    );
  }
  return {
    ratio: {
      numerator: normalizeNumericString(mech.ratio.numerator),
      denominator: normalizeNumericString(mech.ratio.denominator),
    },
    conversion_price: monetaryToDaml(mech.conversion_price),
  };
}

function buildWarrantStockClassConversionRight(
  exerciseTrigger: WarrantExerciseTriggerObject & { trigger_id: string },
  details: StockClassConversionRightInput
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  // Runtime guard: protect against invalid data reaching this path (e.g. from untyped JSON)
  const mechType = (details.conversion_mechanism as { type: string }).type;
  if (mechType !== 'RATIO_CONVERSION') {
    throw new OcpParseError(
      `Unsupported conversion_mechanism.type "${mechType}" for STOCK_CLASS_CONVERSION_RIGHT on warrant — only RATIO_CONVERSION is supported`,
      { source: 'conversion_right.conversion_mechanism', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
    );
  }
  const { ratio, conversion_price } = toDamlRatio(details.conversion_mechanism);
  const converts_to_future_round =
    typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;

  const value: Fairmint.OpenCapTable.Types.Conversion.OcfStockClassConversionRight = {
    type_: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: 'OcfConversionMechanismRatioConversion',
    conversion_trigger: warrantNestedConversionTrigger(exerciseTrigger, details.converts_to_stock_class_id),
    converts_to_stock_class_id: details.converts_to_stock_class_id,
    ratio,
    conversion_price,
    converts_to_future_round,
    ceiling_price_per_share: null,
    custom_description: null,
    discount_rate: null,
    expires_at: null,
    floor_price_per_share: null,
    percent_of_capitalization: null,
    reference_share_price: null,
    reference_valuation_price_per_share: null,
    valuation_cap: null,
  };

  return { tag: 'OcfRightStockClass', value };
}

function buildWarrantRight(
  exerciseTrigger: WarrantExerciseTriggerInput | undefined
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  if (!exerciseTrigger || typeof exerciseTrigger !== 'object') {
    throw new OcpValidationError(
      'warrantTrigger.conversion_right',
      'conversion_right is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }

  const cr = exerciseTrigger.conversion_right;
  if (!cr) {
    throw new OcpValidationError(
      'warrantTrigger.conversion_right',
      'conversion_right is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }

  switch (cr.type) {
    case 'STOCK_CLASS_CONVERSION_RIGHT': {
      if (!exerciseTrigger.trigger_id) {
        throw new OcpValidationError(
          'warrantTrigger.trigger_id',
          'trigger_id is required for STOCK_CLASS_CONVERSION_RIGHT triggers',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
        );
      }
      return buildWarrantStockClassConversionRight(
        exerciseTrigger as WarrantExerciseTriggerObject & { trigger_id: string },
        cr
      );
    }
    case 'WARRANT_CONVERSION_RIGHT': {
      const mechanism = warrantMechanismToDamlVariant(cr.conversion_mechanism);
      const converts_to_future_round =
        typeof cr.converts_to_future_round === 'boolean' ? cr.converts_to_future_round : null;
      const converts_to_stock_class_id = optionalString(cr.converts_to_stock_class_id);
      return {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: mechanism,
          converts_to_future_round,
          converts_to_stock_class_id,
        },
      } as Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight;
    }
    default: {
      const _exhaustive: never = cr;
      throw new OcpParseError(`Unknown conversion_right.type: "${(_exhaustive as { type: string }).type}"`, {
        source: 'conversion_right.type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function quantitySourceToDamlEnum(
  qs:
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'UNSPECIFIED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN'
    | null
    | undefined
): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  if (qs === undefined || qs === null) return null;
  switch (qs) {
    case 'HUMAN_ESTIMATED':
      return 'OcfQuantityHumanEstimated';
    case 'MACHINE_ESTIMATED':
      return 'OcfQuantityMachineEstimated';
    case 'UNSPECIFIED':
      return 'OcfQuantityUnspecified';
    case 'INSTRUMENT_FIXED':
      return 'OcfQuantityInstrumentFixed';
    case 'INSTRUMENT_MAX':
      return 'OcfQuantityInstrumentMax';
    case 'INSTRUMENT_MIN':
      return 'OcfQuantityInstrumentMin';
    default: {
      const _exhaustiveCheck: never = qs;
      throw new OcpParseError(`Unknown quantity_source: ${String(qs)}`, {
        source: 'warrantIssuance.quantity_source',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function buildWarrantTrigger(t: WarrantExerciseTriggerInput, _index: number, _ocfId: string) {
  const typeEnum = triggerTypeToDamlEnum(normalizeTriggerType(t.type));
  if (!t.trigger_id) {
    throw new OcpValidationError(
      'warrantTrigger.trigger_id',
      'trigger_id is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  const conversion_right = buildWarrantRight(t);
  return {
    type_: typeEnum,
    trigger_id: t.trigger_id,
    nickname: typeof t.nickname === 'string' ? t.nickname : null,
    trigger_description: typeof t.trigger_description === 'string' ? t.trigger_description : null,
    conversion_right,
    trigger_date: typeof t.trigger_date === 'string' ? dateStringToDAMLTime(t.trigger_date) : null,
    trigger_condition: typeof t.trigger_condition === 'string' ? t.trigger_condition : null,
    start_date: typeof t.start_date === 'string' && t.start_date ? dateStringToDAMLTime(t.start_date) : null,
    end_date: typeof t.end_date === 'string' && t.end_date ? dateStringToDAMLTime(t.end_date) : null,
  };
}

export function warrantIssuanceDataToDaml(d: {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  quantity?: string;
  quantity_source?:
    | 'HUMAN_ESTIMATED'
    | 'MACHINE_ESTIMATED'
    | 'UNSPECIFIED'
    | 'INSTRUMENT_FIXED'
    | 'INSTRUMENT_MAX'
    | 'INSTRUMENT_MIN';
  exercise_price?: Monetary;
  purchase_price: Monetary;
  exercise_triggers: WarrantExerciseTriggerInput[];
  warrant_expiration_date?: string;
  vesting_terms_id?: string;
  vestings?: SimpleVesting[];
  comments?: string[];
}): Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData {
  // Runtime truthiness check: DB JSONB may store quantity as explicit null or empty string
  // Must match the truthiness check used for the quantity field itself (d.quantity ? ... : null)
  const hasQuantity = Boolean(d.quantity);
  const quantitySourceDaml = hasQuantity
    ? quantitySourceToDamlEnum(d.quantity_source ?? 'UNSPECIFIED')
    : d.quantity_source
      ? quantitySourceToDamlEnum(d.quantity_source)
      : null;

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity != null ? normalizeNumericString(d.quantity) : null,
    quantity_source: quantitySourceDaml ?? null,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.id)),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: optionalString(d.vesting_terms_id),
    vestings: (d.vestings ?? [])
      .filter((v) => {
        // normalizeNumericString validates strict decimal format and rejects scientific notation
        const normalized = normalizeNumericString(v.amount);
        return parseFloat(normalized) > 0;
      })
      .map((v) => ({
        date: dateStringToDAMLTime(v.date),
        amount: normalizeNumericString(v.amount),
      })),
    comments: cleanComments(d.comments),
  };
}
