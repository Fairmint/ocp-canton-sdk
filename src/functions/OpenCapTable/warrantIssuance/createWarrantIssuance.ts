import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  CapitalizationDefinitionRules,
  ConversionTriggerFor,
  ConversionTriggerType,
  Monetary,
} from '../../../types';
import { damlEnumConstructor, damlEnumConstructorFromInput, isOcfEnumValue } from '../../../utils/damlEnums';
import {
  cleanComments,
  dateStringToDAMLDate,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLDate,
  optionalString,
} from '../../../utils/typeConversions';
import { triggerFieldsToDaml } from '../shared/triggerFields';
import { filterAndMapVestingsToDaml } from '../shared/vesting';

export interface SimpleVesting {
  date: string;
  amount: string;
}

export type WarrantTriggerTypeInput = ConversionTriggerType;

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

/** Exact object-shaped exercise-trigger row from the OCF schema. */
export type WarrantExerciseTriggerInput = ConversionTriggerFor<WarrantConversionRightKindInput>;

function normalizeTriggerType(t: WarrantTriggerTypeInput): WarrantTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(
  t: WarrantTriggerTypeInput,
  fieldPath: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  return damlEnumConstructor('OcfConversionTriggerType', t, fieldPath);
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
  };
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
      };

    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: normalizeNumericString(mech.converts_to_percent),
          capitalization_definition: optionalString(mech.capitalization_definition ?? undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(mech.capitalization_definition_rules),
        },
      };

    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: { converts_to_quantity: normalizeNumericString(mech.converts_to_quantity) },
      };

    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: damlEnumConstructorFromInput(
            'OcfValuationBasedFormulaType',
            mech.valuation_type,
            'conversion_right.conversion_mechanism.valuation_type'
          ),
          valuation_amount: mech.valuation_amount ? monetaryToDaml(mech.valuation_amount) : null,
          capitalization_definition: optionalString(mech.capitalization_definition ?? undefined),
          capitalization_definition_rules: mapWarrantCapitalizationRules(mech.capitalization_definition_rules),
        },
      };

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
      };
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

/** Typed helper: convert a strict StockClassRatioConversionMechanismInput to DAML ratio fields. */
function toDamlRatio(
  mech: StockClassRatioConversionMechanismInput
): Fairmint.OpenCapTable.Types.Conversion.OcfRatioConversionMechanism {
  // Runtime JSON may omit rounding_type despite the declared type requiring it.
  const rawRounding = mech.rounding_type as string | null | undefined;
  if (rawRounding == null) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism.rounding_type',
      'OCF RatioConversionMechanism requires rounding_type',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
        receivedValue: mech.rounding_type,
      }
    );
  }
  if (!isOcfEnumValue('OcfRoundingType', rawRounding)) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism.rounding_type',
      'Unsupported rounding_type value',
      {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: "'NORMAL' | 'CEILING' | 'FLOOR'",
        receivedValue: mech.rounding_type,
      }
    );
  }
  return {
    ratio: {
      numerator: normalizeNumericString(mech.ratio.numerator),
      denominator: normalizeNumericString(mech.ratio.denominator),
    },
    conversion_price: monetaryToDaml(mech.conversion_price),
    rounding_type: damlEnumConstructor(
      'OcfRoundingType',
      rawRounding,
      'conversion_right.conversion_mechanism.rounding_type'
    ),
  };
}

function buildWarrantStockClassConversionRight(
  details: StockClassConversionRightInput,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const targetStockClassId = (details as { converts_to_stock_class_id?: unknown }).converts_to_stock_class_id;
  if (typeof targetStockClassId !== 'string' || targetStockClassId.length === 0) {
    throw new OcpValidationError(
      `warrantIssuance.exercise_triggers[${index}].conversion_right.converts_to_stock_class_id`,
      'The current DAML package requires a target stock class for warrant stock-class conversion rights',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: targetStockClassId,
      }
    );
  }

  // Runtime guard: protect against invalid data reaching this path (e.g. from untyped JSON)
  const mechType = (details.conversion_mechanism as { type: string }).type;
  if (mechType !== 'RATIO_CONVERSION') {
    throw new OcpParseError(
      `Unsupported conversion_mechanism.type "${mechType}" for STOCK_CLASS_CONVERSION_RIGHT on warrant — only RATIO_CONVERSION is supported`,
      { source: 'conversion_right.conversion_mechanism', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
    );
  }
  const conversion_mechanism = toDamlRatio(details.conversion_mechanism);
  const converts_to_future_round =
    typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;

  const value: Fairmint.OpenCapTable.Types.Conversion.OcfStockClassConversionRight = {
    conversion_mechanism,
    converts_to_future_round,
    converts_to_stock_class_id: targetStockClassId,
  };

  return { tag: 'OcfRightStockClass', value };
}

function buildWarrantRight(
  exerciseTrigger: unknown,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const triggerPath = `warrantIssuance.exercise_triggers[${index}]`;
  if (!exerciseTrigger || typeof exerciseTrigger !== 'object' || Array.isArray(exerciseTrigger)) {
    throw new OcpValidationError(
      `${triggerPath}.conversion_right`,
      'conversion_right is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: exerciseTrigger }
    );
  }

  const rawRight = (exerciseTrigger as Record<string, unknown>).conversion_right;
  if (!rawRight || typeof rawRight !== 'object' || Array.isArray(rawRight)) {
    throw new OcpValidationError(
      `${triggerPath}.conversion_right`,
      'conversion_right is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: rawRight }
    );
  }
  const cr = rawRight as WarrantConversionRightKindInput;

  switch (cr.type) {
    case 'STOCK_CLASS_CONVERSION_RIGHT': {
      return buildWarrantStockClassConversionRight(cr, index);
    }
    case 'WARRANT_CONVERSION_RIGHT': {
      const mechanism = warrantMechanismToDamlVariant(cr.conversion_mechanism);
      const converts_to_future_round =
        typeof cr.converts_to_future_round === 'boolean' ? cr.converts_to_future_round : null;
      const converts_to_stock_class_id = optionalString(cr.converts_to_stock_class_id);
      return {
        tag: 'OcfRightWarrant',
        value: {
          conversion_mechanism: mechanism,
          converts_to_future_round,
          converts_to_stock_class_id,
        },
      };
    }
    default: {
      const _exhaustive: never = cr;
      throw new OcpParseError(`Unknown conversion_right.type: "${(_exhaustive as { type: string }).type}"`, {
        source: `${triggerPath}.conversion_right.type`,
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
  return damlEnumConstructor('OcfQuantitySourceType', qs, 'warrantIssuance.quantity_source');
}

function buildWarrantTrigger(t: WarrantExerciseTriggerInput, index: number) {
  const triggerPath = `warrantIssuance.exercise_triggers[${index}]`;
  const rawTrigger: unknown = t;
  if (!rawTrigger || typeof rawTrigger !== 'object' || Array.isArray(rawTrigger)) {
    throw new OcpValidationError(triggerPath, 'Expected an exercise trigger object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: rawTrigger,
    });
  }
  const rawTriggerRecord = rawTrigger as Record<string, unknown>;
  if (typeof rawTriggerRecord.trigger_id !== 'string' || rawTriggerRecord.trigger_id.length === 0) {
    throw new OcpValidationError(
      `${triggerPath}.trigger_id`,
      'trigger_id is required for each warrant exercise trigger',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: rawTriggerRecord.trigger_id,
      }
    );
  }
  const trigger = rawTriggerRecord as unknown as WarrantExerciseTriggerInput;
  const normalized = normalizeTriggerType(trigger.type);
  const typeEnum = triggerTypeToDamlEnum(normalized, `${triggerPath}.type`);
  const conversion_right = buildWarrantRight(trigger, index);
  const triggerFields = triggerFieldsToDaml(trigger, triggerPath);
  return {
    type_: typeEnum,
    trigger_id: trigger.trigger_id,
    nickname: typeof trigger.nickname === 'string' ? trigger.nickname : null,
    trigger_description: typeof trigger.trigger_description === 'string' ? trigger.trigger_description : null,
    conversion_right,
    ...triggerFields,
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
    'HUMAN_ESTIMATED' | 'MACHINE_ESTIMATED' | 'UNSPECIFIED' | 'INSTRUMENT_FIXED' | 'INSTRUMENT_MAX' | 'INSTRUMENT_MIN';
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
    date: dateStringToDAMLDate(d.date, 'warrantIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: optionalDateStringToDAMLDate(d.board_approval_date, 'warrantIssuance.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'warrantIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity != null ? normalizeNumericString(d.quantity) : null,
    quantity_source: quantitySourceDaml ?? null,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx)),
    warrant_expiration_date: optionalDateStringToDAMLDate(
      d.warrant_expiration_date,
      'warrantIssuance.warrant_expiration_date'
    ),
    vesting_terms_id: optionalString(d.vesting_terms_id),
    vestings: filterAndMapVestingsToDaml(d.vestings, 'warrantIssuance.vestings'),
    comments: cleanComments(d.comments),
  };
}
