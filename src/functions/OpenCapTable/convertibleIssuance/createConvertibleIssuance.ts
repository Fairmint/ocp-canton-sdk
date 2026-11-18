import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { PkgConvertibleIssuanceOcfData } from '../../../types/daml';
import type {
  CapitalizationDefinitionRules,
  ConversionTriggerType,
  ConvertibleConversionMechanism,
  ConvertibleConversionRight,
  ConvertibleConversionTrigger,
  ConvertibleInterestRate,
  ExitMultiple,
  OcfConvertibleIssuance,
} from '../../../types/native';
import { damlEnumConstructor } from '../../../utils/damlEnums';
import {
  cleanComments,
  dateStringToDAMLDate,
  isRecord,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLDate,
  optionalString,
} from '../../../utils/typeConversions';
import { triggerFieldsToDaml } from '../shared/triggerFields';

type ConversionTriggerTypeInput = ConversionTriggerType;

/** The five OCF convertible conversion mechanisms (SAFE, Note, Custom, PercentCapitalization, FixedAmount). */
type ConvertibleConversionMechanismInput = ConvertibleConversionMechanism;

type ConvertibleConversionRightInput = ConvertibleConversionRight;

export type ConversionTriggerInput = ConvertibleConversionTrigger;

function convertibleTypeToDaml(
  t: OcfConvertibleIssuance['convertible_type']
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleType {
  return damlEnumConstructor('OcfConvertibleType', t, 'convertibleIssuance.convertible_type');
}

function normalizeTriggerType(t: ConversionTriggerTypeInput): ConversionTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(
  t: ConversionTriggerTypeInput,
  fieldPath: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  return damlEnumConstructor('OcfConversionTriggerType', t, fieldPath);
}

function capitalizationRulesToDaml(
  rules: CapitalizationDefinitionRules | undefined
): Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null {
  if (!rules) return null;
  return {
    include_outstanding_shares: Boolean(rules.include_outstanding_shares),
    include_outstanding_options: Boolean(rules.include_outstanding_options),
    include_outstanding_unissued_options: Boolean(rules.include_outstanding_unissued_options),
    include_this_security: Boolean(rules.include_this_security),
    include_other_converting_securities: Boolean(rules.include_other_converting_securities),
    include_option_pool_topup_for_promised_options: Boolean(rules.include_option_pool_topup_for_promised_options),
    include_additional_option_pool_topup: Boolean(rules.include_additional_option_pool_topup),
    include_new_money: Boolean(rules.include_new_money),
  };
}

function exitMultipleToDaml(
  exitMultiple: ExitMultiple | undefined,
  fieldPath: string
): Fairmint.OpenCapTable.Types.Stock.OcfRatio | null {
  if (!exitMultiple) return null;
  const { numerator, denominator } = exitMultiple;
  return {
    numerator: normalizeNumericString(String(numerator), `${fieldPath}.numerator`),
    denominator: normalizeNumericString(String(denominator), `${fieldPath}.denominator`),
  };
}

function interestRatesToDaml(
  rates: readonly ConvertibleInterestRate[],
  mechanismPath: string
): Fairmint.OpenCapTable.Types.Conversion.OcfInterestRate[] {
  return rates.map((rate, interestRateIndex) => {
    const interestRatePath = `${mechanismPath}.interest_rates[${interestRateIndex}]`;
    // Runtime JSON may carry anything where the declared type promises an interest rate row.
    const raw: unknown = rate;
    if (!isRecord(raw)) {
      throw new OcpValidationError(interestRatePath, 'Interest rate must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: raw,
      });
    }

    const accrualStartDate: unknown = raw.accrual_start_date;
    if (accrualStartDate === null || accrualStartDate === undefined) {
      throw new OcpValidationError(
        `${interestRatePath}.accrual_start_date`,
        'accrual_start_date is required for each convertible note interest rate',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          receivedValue: accrualStartDate,
        }
      );
    }

    const interestRate: unknown = raw.rate;
    if (interestRate === null || interestRate === undefined) {
      throw new OcpValidationError(
        `${interestRatePath}.rate`,
        'rate is required for each convertible note interest rate',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          receivedValue: interestRate,
        }
      );
    }
    if (typeof interestRate !== 'string' && typeof interestRate !== 'number') {
      throw new OcpValidationError(`${interestRatePath}.rate`, 'Interest rate must be a string or number', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: interestRate,
      });
    }

    return {
      rate: normalizeNumericString(interestRate, `${interestRatePath}.rate`),
      accrual_start_date: dateStringToDAMLDate(accrualStartDate, `${interestRatePath}.accrual_start_date`),
      accrual_end_date: optionalDateStringToDAMLDate(raw.accrual_end_date, `${interestRatePath}.accrual_end_date`),
    };
  });
}

function requireMechanismField(
  mechanism: object,
  field: string,
  mechanismPath: string,
  mechanismType: string
): unknown {
  const value: unknown = (mechanism as Record<string, unknown>)[field];
  if (value === undefined || value === null || value === '') {
    throw new OcpValidationError(`${mechanismPath}.${field}`, `${mechanismType} requires ${field}`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
  return value;
}

function mechanismToDaml(
  m: ConvertibleConversionMechanismInput | undefined,
  mechanismPath: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism {
  // Runtime JSON may omit the mechanism or carry a non-object despite the declared type.
  const raw: unknown = m;
  if (!isRecord(raw)) {
    throw new OcpValidationError(mechanismPath, 'conversion_right.conversion_mechanism is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: raw,
    });
  }
  const mechanismField = (field: string): string => `${mechanismPath}.${field}`;
  const mechanism = m as ConvertibleConversionMechanismInput;

  switch (mechanism.type) {
    case 'SAFE_CONVERSION': {
      const conversionMfn: unknown = mechanism.conversion_mfn;
      if (typeof conversionMfn !== 'boolean') {
        throw new OcpValidationError(mechanismField('conversion_mfn'), 'SAFE_CONVERSION requires conversion_mfn', {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          expectedType: 'boolean',
          receivedValue: conversionMfn,
        });
      }
      return {
        tag: 'OcfConvMechSAFE',
        value: {
          conversion_mfn: conversionMfn,
          conversion_discount:
            mechanism.conversion_discount != null
              ? normalizeNumericString(mechanism.conversion_discount, mechanismField('conversion_discount'))
              : null,
          conversion_valuation_cap: mechanism.conversion_valuation_cap
            ? monetaryToDaml(mechanism.conversion_valuation_cap, mechanismField('conversion_valuation_cap'))
            : null,
          conversion_timing:
            mechanism.conversion_timing === undefined
              ? null
              : damlEnumConstructor(
                  'OcfConversionTimingType',
                  mechanism.conversion_timing,
                  mechanismField('conversion_timing')
                ),
          exit_multiple: exitMultipleToDaml(mechanism.exit_multiple, mechanismField('exit_multiple')),
          capitalization_definition: optionalString(mechanism.capitalization_definition),
          capitalization_definition_rules: capitalizationRulesToDaml(mechanism.capitalization_definition_rules),
        },
      };
    }
    case 'CONVERTIBLE_NOTE_CONVERSION': {
      const interestRates: unknown = mechanism.interest_rates;
      if (!Array.isArray(interestRates)) {
        throw new OcpValidationError(
          mechanismField('interest_rates'),
          'CONVERTIBLE_NOTE_CONVERSION requires interest_rates',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: interestRates }
        );
      }
      for (const field of ['day_count_convention', 'interest_payout', 'interest_accrual_period', 'compounding_type']) {
        requireMechanismField(mechanism, field, mechanismPath, 'CONVERTIBLE_NOTE_CONVERSION');
      }
      return {
        tag: 'OcfConvMechNote',
        value: {
          interest_rates: interestRatesToDaml(mechanism.interest_rates, mechanismPath),
          day_count_convention: damlEnumConstructor(
            'OcfDayCountType',
            mechanism.day_count_convention,
            mechanismField('day_count_convention')
          ),
          interest_payout: damlEnumConstructor(
            'OcfInterestPayoutType',
            mechanism.interest_payout,
            mechanismField('interest_payout')
          ),
          interest_accrual_period: damlEnumConstructor(
            'OcfAccrualPeriodType',
            mechanism.interest_accrual_period,
            mechanismField('interest_accrual_period')
          ),
          compounding_type: damlEnumConstructor(
            'OcfCompoundingType',
            mechanism.compounding_type,
            mechanismField('compounding_type')
          ),
          conversion_discount:
            mechanism.conversion_discount != null
              ? normalizeNumericString(mechanism.conversion_discount, mechanismField('conversion_discount'))
              : null,
          conversion_valuation_cap: mechanism.conversion_valuation_cap
            ? monetaryToDaml(mechanism.conversion_valuation_cap, mechanismField('conversion_valuation_cap'))
            : null,
          capitalization_definition: optionalString(mechanism.capitalization_definition),
          capitalization_definition_rules: capitalizationRulesToDaml(mechanism.capitalization_definition_rules),
          exit_multiple: exitMultipleToDaml(mechanism.exit_multiple, mechanismField('exit_multiple')),
          conversion_mfn: typeof mechanism.conversion_mfn === 'boolean' ? mechanism.conversion_mfn : null,
        },
      };
    }
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION': {
      const convertsToPercent: unknown = mechanism.converts_to_percent;
      if (convertsToPercent === undefined || typeof convertsToPercent !== 'string') {
        throw new OcpValidationError(
          mechanismField('converts_to_percent'),
          'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION requires converts_to_percent as string',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: convertsToPercent }
        );
      }
      return {
        tag: 'OcfConvMechPercentCapitalization',
        value: {
          converts_to_percent: normalizeNumericString(convertsToPercent, mechanismField('converts_to_percent')),
          capitalization_definition: optionalString(mechanism.capitalization_definition),
          capitalization_definition_rules: capitalizationRulesToDaml(mechanism.capitalization_definition_rules),
        },
      };
    }
    case 'FIXED_AMOUNT_CONVERSION': {
      const convertsToQuantity: unknown = mechanism.converts_to_quantity;
      if (convertsToQuantity === undefined || typeof convertsToQuantity !== 'string') {
        throw new OcpValidationError(
          mechanismField('converts_to_quantity'),
          'FIXED_AMOUNT_CONVERSION requires converts_to_quantity as string',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: convertsToQuantity }
        );
      }
      return {
        tag: 'OcfConvMechFixedAmount',
        value: {
          converts_to_quantity: normalizeNumericString(convertsToQuantity, mechanismField('converts_to_quantity')),
        },
      };
    }
    case 'CUSTOM_CONVERSION': {
      const description: unknown = mechanism.custom_conversion_description;
      if (typeof description !== 'string' || description.length === 0) {
        throw new OcpValidationError(
          mechanismField('custom_conversion_description'),
          'CUSTOM_CONVERSION requires custom_conversion_description',
          { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: description }
        );
      }
      return { tag: 'OcfConvMechCustom', value: { custom_conversion_description: description } };
    }
    default: {
      // OCF's convertible conversion mechanisms are the five above (the five of the OpenCapTable-v35 register); the
      // valuation- and share-price-based mechanisms are warrant-only, and anything else is not OCF at all.
      const unknownType = String((mechanism as { type?: unknown }).type);
      if (unknownType === 'VALUATION_BASED_CONVERSION' || unknownType === 'PPS_BASED_CONVERSION') {
        throw new OcpValidationError(
          mechanismField('type'),
          `${unknownType} is not a convertible conversion mechanism in OCF`,
          { code: OcpErrorCodes.UNKNOWN_ENUM_VALUE, receivedValue: unknownType }
        );
      }
      throw new OcpParseError(`Unknown conversion mechanism: ${unknownType}`, {
        source: mechanismField('type'),
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function buildConvertibleRight(
  input: ConversionTriggerInput,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionRight {
  const rightPath = `convertibleIssuance.conversion_triggers[${index}].conversion_right`;
  const rawDetails: unknown = (input as { conversion_right?: unknown }).conversion_right;
  if (!isRecord(rawDetails)) {
    throw new OcpValidationError(rightPath, 'conversion_right is required for each convertible conversion trigger', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: rawDetails,
    });
  }
  if (rawDetails.type !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw new OcpValidationError(`${rightPath}.type`, 'Expected CONVERTIBLE_CONVERSION_RIGHT', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      receivedValue: rawDetails.type,
    });
  }
  const details = rawDetails as unknown as ConvertibleConversionRightInput;
  return {
    conversion_mechanism: mechanismToDaml(details.conversion_mechanism, `${rightPath}.conversion_mechanism`),
    converts_to_future_round:
      typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null,
    converts_to_stock_class_id: optionalString(details.converts_to_stock_class_id),
  };
}

function buildTriggerToDaml(
  t: ConversionTriggerInput,
  index: number
): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.OcfConvertibleConversionTrigger {
  const triggerPath = `convertibleIssuance.conversion_triggers[${index}]`;
  // Runtime JSON may carry anything where the declared type promises a trigger object.
  const rawTrigger: unknown = t;
  if (!isRecord(rawTrigger)) {
    throw new OcpValidationError(triggerPath, 'Expected a conversion trigger object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: rawTrigger,
    });
  }
  if (typeof rawTrigger.trigger_id !== 'string' || rawTrigger.trigger_id.length === 0) {
    throw new OcpValidationError(
      `${triggerPath}.trigger_id`,
      'trigger_id is required for each convertible conversion trigger',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: rawTrigger.trigger_id,
      }
    );
  }
  const normalized = normalizeTriggerType(t.type);
  return {
    type_: triggerTypeToDamlEnum(normalized, `${triggerPath}.type`),
    trigger_id: t.trigger_id,
    nickname: optionalString(t.nickname),
    trigger_description: optionalString(t.trigger_description),
    conversion_right: buildConvertibleRight(t, index),
    ...triggerFieldsToDaml(t, triggerPath),
  };
}

/**
 * Convert native OCF convertible issuance data to the generated DAML `ConvertibleIssuanceOcfData`.
 *
 * @param d - The native OCF convertible issuance data
 * @returns The DAML-formatted convertible issuance data
 */
export function convertibleIssuanceDataToDaml(d: OcfConvertibleIssuance): PkgConvertibleIssuanceOcfData {
  return {
    id: d.id,
    date: dateStringToDAMLDate(d.date, 'convertibleIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: optionalDateStringToDAMLDate(d.board_approval_date, 'convertibleIssuance.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLDate(
      d.stockholder_approval_date,
      'convertibleIssuance.stockholder_approval_date'
    ),
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions,
    investment_amount: monetaryToDaml(d.investment_amount),
    convertible_type: convertibleTypeToDaml(d.convertible_type),
    conversion_triggers: d.conversion_triggers.map((t, idx) => buildTriggerToDaml(t, idx)),
    pro_rata: d.pro_rata != null ? normalizeNumericString(d.pro_rata) : null,
    seniority: d.seniority.toString(),
    comments: cleanComments(d.comments),
  };
}
