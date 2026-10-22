import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { PkgWarrantIssuanceOcfData } from '../../../types/daml';
import type {
  CapitalizationDefinitionRules,
  ConversionTriggerType,
  OcfWarrantIssuance,
  StockClassConversionRight,
  WarrantConversionMechanism,
  WarrantConversionRight,
  WarrantExerciseTrigger,
  WarrantTriggerConversionRight,
} from '../../../types/native';
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

/** The OCF warrant conversion mechanisms: the shared records plus the valuation- and share-price-based ones. */
export type WarrantConversionMechanismInput = WarrantConversionMechanism;

/** Strict ratio-conversion mechanism for STOCK_CLASS_CONVERSION_RIGHT triggers (OCF RatioConversionMechanism) */
export type StockClassRatioConversionMechanismInput = StockClassConversionRight['conversion_mechanism'];

/** WARRANT_CONVERSION_RIGHT branch of a warrant exercise trigger's conversion_right */
export type WarrantConversionRightInput = WarrantConversionRight;

/** STOCK_CLASS_CONVERSION_RIGHT branch of a warrant exercise trigger's conversion_right */
export type StockClassConversionRightInput = StockClassConversionRight;

export type WarrantConversionRightKindInput = WarrantTriggerConversionRight;

/** Exact object-shaped exercise-trigger row from the OCF schema. */
export type WarrantExerciseTriggerInput = WarrantExerciseTrigger;

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
  // Runtime JSON may omit the mechanism or its discriminator despite the declared type.
  const raw: unknown = m;
  if (raw == null || typeof raw !== 'object' || !('type' in raw)) {
    throw new OcpValidationError(
      'conversion_right.conversion_mechanism',
      'conversion_right.conversion_mechanism is required for warrant issuance',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: raw }
    );
  }
  switch (m.type) {
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: { custom_conversion_description: m.custom_conversion_description },
      };

    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: normalizeNumericString(m.converts_to_percent),
          capitalization_definition: optionalString(m.capitalization_definition),
          capitalization_definition_rules: mapWarrantCapitalizationRules(m.capitalization_definition_rules),
        },
      };

    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: { converts_to_quantity: normalizeNumericString(m.converts_to_quantity) },
      };

    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: damlEnumConstructorFromInput(
            'OcfValuationBasedFormulaType',
            m.valuation_type,
            'conversion_right.conversion_mechanism.valuation_type'
          ),
          valuation_amount: m.valuation_amount ? monetaryToDaml(m.valuation_amount) : null,
          capitalization_definition: optionalString(m.capitalization_definition),
          capitalization_definition_rules: mapWarrantCapitalizationRules(m.capitalization_definition_rules),
        },
      };

    case 'PPS_BASED_CONVERSION': {
      const dpct = m.discount_percentage;
      return {
        tag: 'OcfWarrantMechanismPpsBased',
        value: {
          description: m.description,
          discount: typeof m.discount === 'boolean' ? m.discount : null,
          discount_percentage: dpct === '' || dpct == null ? null : normalizeNumericString(dpct),
          discount_amount: m.discount_amount ? monetaryToDaml(m.discount_amount) : null,
        },
      };
    }

    default: {
      const _exhaustive: never = m;
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
  details: StockClassConversionRightInput
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  // Runtime guard: protect against invalid data reaching this path (e.g. from untyped JSON)
  const mechType: unknown = (details.conversion_mechanism as { type?: unknown } | undefined)?.type;
  if (mechType !== 'RATIO_CONVERSION') {
    throw new OcpParseError(
      `Unsupported conversion_mechanism.type "${String(mechType)}" for STOCK_CLASS_CONVERSION_RIGHT on warrant — only RATIO_CONVERSION is supported`,
      { source: 'conversion_right.conversion_mechanism', code: OcpErrorCodes.UNKNOWN_ENUM_VALUE }
    );
  }

  return {
    tag: 'OcfRightStockClass',
    value: {
      conversion_mechanism: toDamlRatio(details.conversion_mechanism),
      converts_to_future_round:
        typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null,
      converts_to_stock_class_id: optionalString(details.converts_to_stock_class_id),
    },
  };
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

  const rawRight: unknown = (exerciseTrigger as { conversion_right?: unknown }).conversion_right;
  if (!rawRight || typeof rawRight !== 'object' || Array.isArray(rawRight)) {
    throw new OcpValidationError(
      `${triggerPath}.conversion_right`,
      'conversion_right is required for each warrant exercise trigger',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: rawRight }
    );
  }
  const cr = rawRight as WarrantTriggerConversionRight;

  switch (cr.type) {
    case 'STOCK_CLASS_CONVERSION_RIGHT': {
      return buildWarrantStockClassConversionRight(cr);
    }
    case 'WARRANT_CONVERSION_RIGHT': {
      return {
        tag: 'OcfRightWarrant',
        value: {
          conversion_mechanism: warrantMechanismToDamlVariant(cr.conversion_mechanism),
          converts_to_future_round:
            typeof cr.converts_to_future_round === 'boolean' ? cr.converts_to_future_round : null,
          converts_to_stock_class_id: optionalString(cr.converts_to_stock_class_id),
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
  qs: OcfWarrantIssuance['quantity_source'] | null
): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  if (qs === undefined || qs === null) return null;
  return damlEnumConstructor('OcfQuantitySourceType', qs, 'warrantIssuance.quantity_source');
}

function buildWarrantTrigger(
  t: WarrantExerciseTriggerInput,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerPath = `warrantIssuance.exercise_triggers[${index}]`;
  // Runtime JSON may carry anything where the declared type promises a trigger object.
  const rawTrigger: unknown = t;
  if (!rawTrigger || typeof rawTrigger !== 'object' || Array.isArray(rawTrigger)) {
    throw new OcpValidationError(triggerPath, 'Expected an exercise trigger object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: rawTrigger,
    });
  }
  const triggerId: unknown = (rawTrigger as { trigger_id?: unknown }).trigger_id;
  if (typeof triggerId !== 'string' || triggerId.length === 0) {
    throw new OcpValidationError(
      `${triggerPath}.trigger_id`,
      'trigger_id is required for each warrant exercise trigger',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: triggerId,
      }
    );
  }
  const normalized = normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized, `${triggerPath}.type`);
  return {
    type_: typeEnum,
    trigger_id: t.trigger_id,
    nickname: optionalString(t.nickname),
    trigger_description: optionalString(t.trigger_description),
    conversion_right: buildWarrantRight(t, index),
    ...triggerFieldsToDaml(t, triggerPath),
  };
}

/**
 * Convert native OCF warrant issuance data to the generated DAML `WarrantIssuanceOcfData`.
 *
 * @param d - The native OCF warrant issuance data
 * @returns The DAML-formatted warrant issuance data
 */
export function warrantIssuanceDataToDaml(d: OcfWarrantIssuance): PkgWarrantIssuanceOcfData {
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
