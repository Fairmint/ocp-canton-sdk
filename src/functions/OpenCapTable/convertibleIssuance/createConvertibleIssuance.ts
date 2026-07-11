import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { ConversionTriggerFor, ConversionTriggerType, Monetary } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  isRecord,
  monetaryToDaml,
  normalizeNumericString,
  optionalDateStringToDAMLTime,
  optionalString,
  safeString,
} from '../../../utils/typeConversions';
import { triggerFieldsToDaml } from '../shared/triggerFields';

type ConversionTriggerTypeInput = ConversionTriggerType;

type ConvertibleConversionMechanismInput =
  | 'CUSTOM_CONVERSION'
  | 'SAFE_CONVERSION'
  | 'CONVERTIBLE_NOTE_CONVERSION'
  | 'FIXED_AMOUNT_CONVERSION'
  | 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION'
  | 'VALUATION_BASED_CONVERSION'
  | 'PPS_BASED_CONVERSION'
  | (Record<string, unknown> & { type: string });

interface ConvertibleConversionRightInput {
  type: 'CONVERTIBLE_CONVERSION_RIGHT';
  conversion_mechanism: ConvertibleConversionMechanismInput;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
}

export type ConversionTriggerInput = ConversionTriggerFor<ConvertibleConversionRightInput>;

function convertibleTypeToDaml(
  t: 'NOTE' | 'SAFE' | 'CONVERTIBLE_SECURITY'
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleType {
  switch (t) {
    case 'NOTE':
      return 'OcfConvertibleNote';
    case 'SAFE':
      return 'OcfConvertibleSafe';
    case 'CONVERTIBLE_SECURITY':
      return 'OcfConvertibleSecurity';
  }
}

function normalizeTriggerType(t: ConversionTriggerTypeInput): ConversionTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(
  t: ConversionTriggerTypeInput,
  fieldPath: string
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
      throw new OcpParseError(`Unknown convertible trigger type: ${exhaustiveCheck as string}`, {
        source: fieldPath,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function mechanismInputToDamlEnum(
  m: ConvertibleConversionMechanismInput | (Record<string, unknown> & { type?: string }) | undefined,
  mechanismPath: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism {
  // Normalize bare string shorthand (e.g. 'SAFE_CONVERSION') to object form
  if (typeof m === 'string') {
    m = { type: m };
  }
  const mechanismField = (field: string): string => `${mechanismPath}.${field}`;
  const dayCountToDaml = (v: unknown): Fairmint.OpenCapTable.Types.Conversion.OcfDayCountType => {
    const fieldPath = mechanismField('day_count_convention');
    const s = safeString(v, fieldPath).toUpperCase();
    if (s === 'ACTUAL_365') return 'OcfDayCountActual365';
    if (s === '30_360') return 'OcfDayCount30_360';
    throw new OcpParseError(`Unknown day_count_convention: ${s}`, {
      source: fieldPath,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  };
  const payoutToDaml = (v: unknown): Fairmint.OpenCapTable.Types.Conversion.OcfInterestPayoutType => {
    const fieldPath = mechanismField('interest_payout');
    const s = safeString(v, fieldPath).toUpperCase();
    if (s === 'DEFERRED') return 'OcfInterestPayoutDeferred';
    if (s === 'CASH') return 'OcfInterestPayoutCash';
    throw new OcpParseError(`Unknown interest_payout: ${s}`, {
      source: fieldPath,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  };
  if (m && typeof m === 'object') {
    const typeStr = String(m.type ?? '').toUpperCase();

    // Helper: map capitalization_definition_rules plain booleans to DAML type
    const mapCapRules = (
      rules: unknown
    ): Fairmint.OpenCapTable.Types.Conversion.OcfCapitalizationDefinitionRules | null => {
      if (!rules || typeof rules !== 'object') return null;
      const r = rules as Record<string, unknown>;
      return {
        include_outstanding_shares: Boolean(r.include_outstanding_shares),
        include_outstanding_options: Boolean(r.include_outstanding_options),
        include_outstanding_unissued_options: Boolean(r.include_outstanding_unissued_options),
        include_this_security: Boolean(r.include_this_security),
        include_other_converting_securities: Boolean(r.include_other_converting_securities),
        include_option_pool_topup_for_promised_options: Boolean(r.include_option_pool_topup_for_promised_options),
        include_additional_option_pool_topup: Boolean(r.include_additional_option_pool_topup),
        include_new_money: Boolean(r.include_new_money),
      };
    };

    const safeTiming = (v: unknown): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTimingType | null => {
      const fieldPath = mechanismField('conversion_timing');
      const s = safeString(v, fieldPath).toUpperCase();
      if (s === '') return null;
      if (s === 'PRE_MONEY') return 'OcfConvTimingPreMoney';
      if (s === 'POST_MONEY') return 'OcfConvTimingPostMoney';
      throw new OcpParseError(`Unknown conversion_timing: ${s}`, {
        source: fieldPath,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    };

    switch (typeStr) {
      case 'SAFE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const exitMultipleValue = (() => {
          const r = (anyM as { exit_multiple?: unknown }).exit_multiple as
            | { numerator?: string; denominator?: string }
            | undefined;
          if (!r) return null;
          const num =
            r.numerator !== undefined
              ? normalizeNumericString(String(r.numerator), mechanismField('exit_multiple.numerator'))
              : undefined;
          const den =
            r.denominator !== undefined
              ? normalizeNumericString(String(r.denominator), mechanismField('exit_multiple.denominator'))
              : undefined;
          if (!num || !den) return null;
          return { numerator: num, denominator: den };
        })();
        return {
          tag: 'OcfConvMechSAFE',
          value: {
            conversion_discount:
              anyM.conversion_discount != null
                ? normalizeNumericString(anyM.conversion_discount as string, mechanismField('conversion_discount'))
                : null,
            conversion_valuation_cap: anyM.conversion_valuation_cap
              ? monetaryToDaml(anyM.conversion_valuation_cap as Monetary, mechanismField('conversion_valuation_cap'))
              : null,
            exit_multiple: exitMultipleValue,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null,
            conversion_timing: safeTiming(anyM.conversion_timing),
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism;
      }
      case 'CONVERTIBLE_NOTE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const mapIR = (
          arr: unknown
        ): Array<{
          rate: unknown;
          accrual_start_date: string;
          accrual_end_date: string | null;
        }> =>
          Array.isArray(arr)
            ? arr.map((ir, interestRateIndex) => {
                const interestRatePath = `${mechanismPath}.interest_rates[${interestRateIndex}]`;
                if (!isRecord(ir)) {
                  throw new OcpValidationError(interestRatePath, 'Interest rate must be an object', {
                    code: OcpErrorCodes.INVALID_TYPE,
                    expectedType: 'object',
                    receivedValue: ir,
                  });
                }

                const accrualStartDate = ir.accrual_start_date;
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

                const { rate } = ir;
                if (rate !== null && rate !== undefined && typeof rate !== 'string' && typeof rate !== 'number') {
                  throw new OcpValidationError(`${interestRatePath}.rate`, 'Interest rate must be a string or number', {
                    code: OcpErrorCodes.INVALID_TYPE,
                    expectedType: 'string | number',
                    receivedValue: rate,
                  });
                }

                return {
                  rate: rate != null ? normalizeNumericString(rate, `${interestRatePath}.rate`) : null,
                  accrual_start_date: dateStringToDAMLTime(accrualStartDate, `${interestRatePath}.accrual_start_date`),
                  accrual_end_date: optionalDateStringToDAMLTime(
                    ir.accrual_end_date,
                    `${interestRatePath}.accrual_end_date`
                  ),
                };
              })
            : [];
        const accrualToDaml = (v: unknown): string => {
          const fieldPath = mechanismField('interest_accrual_period');
          const s = safeString(v, fieldPath).toUpperCase();
          switch (s) {
            case 'DAILY':
              return 'OcfAccrualDaily';
            case 'MONTHLY':
              return 'OcfAccrualMonthly';
            case 'QUARTERLY':
              return 'OcfAccrualQuarterly';
            case 'SEMI_ANNUAL':
              return 'OcfAccrualSemiAnnual';
            case 'ANNUAL':
              return 'OcfAccrualAnnual';
            default:
              throw new OcpParseError(`Unknown interest_accrual_period: ${s}`, {
                source: fieldPath,
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
              });
          }
        };
        const compoundingToDaml = (v: unknown): string => {
          // Pass-through if already DAML tag; otherwise map common strings
          const fieldPath = mechanismField('compounding_type');
          const s = safeString(v, fieldPath);
          if (s.startsWith('Ocf')) return s;
          const u = s.toUpperCase();
          if (u === 'SIMPLE') return 'OcfSimple';
          if (u === 'COMPOUNDING') return 'OcfCompounding';
          throw new OcpParseError(`Unknown compounding_type: ${s}`, {
            source: fieldPath,
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          });
        };
        if (!Array.isArray(anyM.interest_rates))
          throw new OcpValidationError(
            mechanismField('interest_rates'),
            'CONVERTIBLE_NOTE_CONVERSION requires interest_rates',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.day_count_convention)
          throw new OcpValidationError(
            mechanismField('day_count_convention'),
            'CONVERTIBLE_NOTE_CONVERSION requires day_count_convention',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.interest_payout)
          throw new OcpValidationError(
            mechanismField('interest_payout'),
            'CONVERTIBLE_NOTE_CONVERSION requires interest_payout',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.interest_accrual_period) {
          throw new OcpValidationError(
            mechanismField('interest_accrual_period'),
            'CONVERTIBLE_NOTE_CONVERSION requires interest_accrual_period',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        if (!anyM.compounding_type)
          throw new OcpValidationError(
            mechanismField('compounding_type'),
            'CONVERTIBLE_NOTE_CONVERSION requires compounding_type',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        return {
          tag: 'OcfConvMechNote',
          value: {
            interest_rates: mapIR(anyM.interest_rates),
            day_count_convention: dayCountToDaml(anyM.day_count_convention),
            interest_payout: payoutToDaml(anyM.interest_payout),
            interest_accrual_period: accrualToDaml(anyM.interest_accrual_period),
            compounding_type: compoundingToDaml(anyM.compounding_type),
            conversion_discount:
              anyM.conversion_discount != null
                ? normalizeNumericString(anyM.conversion_discount as string, mechanismField('conversion_discount'))
                : null,
            conversion_valuation_cap: anyM.conversion_valuation_cap
              ? monetaryToDaml(anyM.conversion_valuation_cap as Monetary, mechanismField('conversion_valuation_cap'))
              : null,
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
            exit_multiple: null,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null,
          },
        } as Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_percent === undefined || typeof anyM.converts_to_percent !== 'string') {
          throw new OcpValidationError(
            mechanismField('converts_to_percent'),
            'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION requires converts_to_percent as string',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        return {
          tag: 'OcfConvMechPercentCapitalization',
          value: {
            converts_to_percent: normalizeNumericString(
              anyM.converts_to_percent,
              mechanismField('converts_to_percent')
            ),
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        };
      }
      case 'FIXED_AMOUNT_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_quantity === undefined || typeof anyM.converts_to_quantity !== 'string') {
          throw new OcpValidationError(
            mechanismField('converts_to_quantity'),
            'FIXED_AMOUNT_CONVERSION requires converts_to_quantity as string',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        return {
          tag: 'OcfConvMechFixedAmount',
          value: {
            converts_to_quantity: normalizeNumericString(
              anyM.converts_to_quantity,
              mechanismField('converts_to_quantity')
            ),
          },
        };
      }
      case 'VALUATION_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.valuation_type)
          throw new OcpValidationError(
            mechanismField('valuation_type'),
            'VALUATION_BASED_CONVERSION requires valuation_type',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        return {
          tag: 'OcfConvMechValuationBased',
          value: {
            valuation_type: anyM.valuation_type as string,
            valuation_amount: anyM.valuation_amount
              ? monetaryToDaml(anyM.valuation_amount as Monetary, mechanismField('valuation_amount'))
              : null,
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.Conversion.OcfConvertibleConversionMechanism;
      }
      case 'PPS_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.description || typeof anyM.description !== 'string') {
          throw new OcpValidationError(mechanismField('description'), 'PPS_BASED_CONVERSION requires description', {
            code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          });
        }
        return {
          tag: 'OcfConvMechPpsBased',
          value: {
            description: anyM.description,
            discount: Boolean(anyM.discount),
            discount_percentage:
              anyM.discount_percentage === '' || anyM.discount_percentage == null
                ? null
                : normalizeNumericString(anyM.discount_percentage as string, mechanismField('discount_percentage')),
            discount_amount: anyM.discount_amount
              ? monetaryToDaml(anyM.discount_amount as Monetary, mechanismField('discount_amount'))
              : null,
          },
        };
      }
      case 'CUSTOM_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const desc =
          (anyM.custom_conversion_description as string) ||
          (anyM.custom_description as string) ||
          (anyM.description as string);
        if (!desc)
          throw new OcpValidationError(
            mechanismField('custom_conversion_description'),
            'CUSTOM_CONVERSION requires custom_conversion_description',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        return {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: desc },
        };
      }
      default: {
        throw new OcpParseError(`Unknown conversion mechanism: ${typeStr}`, {
          source: mechanismField('type'),
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        });
      }
    }
  }
  // No mechanism provided -> error (strict)
  throw new OcpValidationError(mechanismPath, 'conversion_right.conversion_mechanism is required', {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
  });
}

function buildConvertibleRight(input: ConversionTriggerInput, index: number) {
  const rightPath = `convertibleIssuance.conversion_triggers[${index}].conversion_right`;
  const rawDetails = (input as unknown as Record<string, unknown>).conversion_right;
  if (!rawDetails || typeof rawDetails !== 'object' || Array.isArray(rawDetails)) {
    throw new OcpValidationError(rightPath, 'conversion_right is required for each convertible conversion trigger', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: rawDetails,
    });
  }
  const rawDetailsRecord = rawDetails as Record<string, unknown>;
  if (rawDetailsRecord.type !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    throw new OcpValidationError(`${rightPath}.type`, 'Expected CONVERTIBLE_CONVERSION_RIGHT', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      receivedValue: rawDetailsRecord.type,
    });
  }
  const details = rawDetailsRecord as unknown as ConvertibleConversionRightInput;
  const mechanism = mechanismInputToDamlEnum(details.conversion_mechanism, `${rightPath}.conversion_mechanism`);
  const convertsToFutureRound =
    typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const convertsToStockClassId = optionalString(details.converts_to_stock_class_id);
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: mechanism,
    converts_to_future_round: convertsToFutureRound,
    converts_to_stock_class_id: convertsToStockClassId,
  };
}

function buildTriggerToDaml(t: ConversionTriggerInput, index: number) {
  const triggerPath = `convertibleIssuance.conversion_triggers[${index}]`;
  const rawTrigger: unknown = t;
  if (!rawTrigger || typeof rawTrigger !== 'object' || Array.isArray(rawTrigger)) {
    throw new OcpValidationError(triggerPath, 'Expected a conversion trigger object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: rawTrigger,
    });
  }
  const rawTriggerRecord = rawTrigger as Record<string, unknown>;
  if (typeof rawTriggerRecord.trigger_id !== 'string' || rawTriggerRecord.trigger_id.length === 0) {
    throw new OcpValidationError(
      `${triggerPath}.trigger_id`,
      'trigger_id is required for each convertible conversion trigger',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        expectedType: 'non-empty string',
        receivedValue: rawTriggerRecord.trigger_id,
      }
    );
  }
  const trigger = rawTriggerRecord as unknown as ConversionTriggerInput;
  const normalized = normalizeTriggerType(trigger.type);
  const typeEnum = triggerTypeToDamlEnum(normalized, `${triggerPath}.type`);
  const { trigger_id } = trigger;
  const nickname = optionalString(trigger.nickname);
  const trigger_description = optionalString(trigger.trigger_description);
  const conversion_right = buildConvertibleRight(trigger, index);
  const triggerFields = triggerFieldsToDaml(trigger, triggerPath);
  return {
    type_: typeEnum,
    trigger_id,
    nickname,
    trigger_description,
    conversion_right,
    ...triggerFields,
  };
}

export function convertibleIssuanceDataToDaml(d: {
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  investment_amount: Monetary;
  convertible_type: 'NOTE' | 'SAFE' | 'CONVERTIBLE_SECURITY';
  conversion_triggers: ConversionTriggerInput[];
  pro_rata?: string;
  seniority: number;
  comments?: string[];
}): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData {
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date, 'convertibleIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: optionalDateStringToDAMLTime(d.board_approval_date, 'convertibleIssuance.board_approval_date'),
    stockholder_approval_date: optionalDateStringToDAMLTime(
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
