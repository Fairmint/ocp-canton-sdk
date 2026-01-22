import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
  safeString,
} from '../../../utils/typeConversions';

type ConversionTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED';

type ConvertibleConversionMechanismInput =
  | 'CUSTOM_CONVERSION'
  | 'SAFE_CONVERSION'
  | 'CONVERTIBLE_NOTE_CONVERSION'
  | 'FIXED_AMOUNT_CONVERSION'
  | 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION'
  | 'VALUATION_BASED_CONVERSION'
  | 'SHARE_PRICE_BASED_CONVERSION';

export type ConversionTriggerInput =
  | ConversionTriggerTypeInput
  | {
      type: ConversionTriggerTypeInput;
      trigger_id?: string;
      nickname?: string;
      trigger_description?: string;
      trigger_date?: string; // YYYY-MM-DD or ISO datetime
      trigger_condition?: string;
      conversion_right?: {
        conversion_mechanism?: ConvertibleConversionMechanismInput;
        converts_to_future_round?: boolean;
        converts_to_stock_class_id?: string;
      };
    };

function convertibleTypeToDaml(t: 'NOTE' | 'SAFE' | 'SECURITY'): Fairmint.OpenCapTable.Types.OcfConvertibleType {
  switch (t) {
    case 'NOTE':
      return 'OcfConvertibleNote';
    case 'SAFE':
      return 'OcfConvertibleSafe';
    case 'SECURITY':
      return 'OcfConvertibleSecurity';
  }
}

function normalizeTriggerType(t: ConversionTriggerTypeInput): ConversionTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(t: ConversionTriggerTypeInput): Fairmint.OpenCapTable.Types.OcfConversionTriggerType {
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
        source: 'conversionTrigger.type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function mechanismInputToDamlEnum(
  m: ConvertibleConversionMechanismInput | (Record<string, unknown> & { type?: string }) | undefined
): Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism {
  const dayCountToDaml = (v: unknown): Fairmint.OpenCapTable.Types.OcfDayCountType => {
    const s = safeString(v).toUpperCase();
    if (s === 'ACTUAL_365') return 'OcfDayCountActual365';
    if (s === '30_360') return 'OcfDayCount30_360';
    throw new OcpParseError(`Unknown day_count_convention: ${safeString(v)}`, {
      source: 'conversion_mechanism.day_count_convention',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  };
  const payoutToDaml = (v: unknown): Fairmint.OpenCapTable.Types.OcfInterestPayoutType => {
    const s = safeString(v).toUpperCase();
    if (s === 'DEFERRED') return 'OcfInterestPayoutDeferred';
    if (s === 'CASH') return 'OcfInterestPayoutCash';
    throw new OcpParseError(`Unknown interest_payout: ${safeString(v)}`, {
      source: 'conversion_mechanism.interest_payout',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  };
  if (m && typeof m === 'object') {
    const typeStr = String(m.type ?? '').toUpperCase();

    // Helper: map capitalization_definition_rules plain booleans to DAML type
    const mapCapRules = (rules: unknown): Fairmint.OpenCapTable.Types.OcfCapitalizationDefinitionRules | null => {
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
      } as Fairmint.OpenCapTable.Types.OcfCapitalizationDefinitionRules;
    };

    const safeTiming = (v: unknown): string | null => {
      const s = safeString(v).toUpperCase();
      if (s === 'PRE_MONEY') return 'OcfConversionTimingPreMoney';
      if (s === 'POST_MONEY') return 'OcfConversionTimingPostMoney';
      return null;
    };

    switch (typeStr) {
      case 'SAFE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const exitMultipleValue = (() => {
          const r = (anyM as { exit_multiple?: unknown }).exit_multiple as
            | { numerator?: string | number; denominator?: string | number }
            | undefined;
          if (!r) return null;
          const num = r.numerator !== undefined ? String(r.numerator) : undefined;
          const den = r.denominator !== undefined ? String(r.denominator) : undefined;
          if (!num || !den) return null;
          return { numerator: num, denominator: den };
        })();
        return {
          tag: 'OcfConvMechSAFE',
          value: {
            conversion_discount: anyM.conversion_discount ?? null,
            conversion_valuation_cap: anyM.conversion_valuation_cap
              ? monetaryToDaml(anyM.conversion_valuation_cap as Monetary)
              : null,
            exit_multiple: exitMultipleValue,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null,
            conversion_timing: safeTiming(anyM.conversion_timing),
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'CONVERTIBLE_NOTE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const mapIR = (
          arr: unknown
        ): Array<{
          rate: unknown;
          accrual_start_date: string | null;
          accrual_end_date: string | null;
        }> =>
          Array.isArray(arr)
            ? arr.map((ir) => ({
                rate: ir?.rate ?? null,
                accrual_start_date: ir?.accrual_start_date
                  ? dateStringToDAMLTime(ir.accrual_start_date as string)
                  : null,
                accrual_end_date: ir?.accrual_end_date ? dateStringToDAMLTime(ir.accrual_end_date as string) : null,
              }))
            : [];
        const accrualToDaml = (v: unknown): string => {
          const s = safeString(v).toUpperCase();
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
              throw new OcpParseError(`Unknown interest_accrual_period: ${safeString(v)}`, {
                source: 'conversion_mechanism.interest_accrual_period',
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
              });
          }
        };
        const compoundingToDaml = (v: unknown): string => {
          // Pass-through if already DAML tag; otherwise map common strings
          const s = safeString(v);
          if (s.startsWith('Ocf')) return s;
          const u = s.toUpperCase();
          if (u === 'SIMPLE') return 'OcfSimple';
          if (u === 'COMPOUNDING') return 'OcfCompounding';
          throw new OcpParseError(`Unknown compounding_type: ${safeString(v)}`, {
            source: 'conversion_mechanism.compounding_type',
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          });
        };
        if (!Array.isArray(anyM.interest_rates))
          throw new OcpValidationError(
            'conversion_mechanism.interest_rates',
            'CONVERTIBLE_NOTE_CONVERSION requires interest_rates',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.day_count_convention)
          throw new OcpValidationError(
            'conversion_mechanism.day_count_convention',
            'CONVERTIBLE_NOTE_CONVERSION requires day_count_convention',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.interest_payout)
          throw new OcpValidationError(
            'conversion_mechanism.interest_payout',
            'CONVERTIBLE_NOTE_CONVERSION requires interest_payout',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        if (!anyM.interest_accrual_period) {
          throw new OcpValidationError(
            'conversion_mechanism.interest_accrual_period',
            'CONVERTIBLE_NOTE_CONVERSION requires interest_accrual_period',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        if (!anyM.compounding_type)
          throw new OcpValidationError(
            'conversion_mechanism.compounding_type',
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
            conversion_discount: anyM.conversion_discount ?? null,
            conversion_valuation_cap: anyM.conversion_valuation_cap
              ? monetaryToDaml(anyM.conversion_valuation_cap as Monetary)
              : null,
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
            exit_multiple: null,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null,
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_percent === undefined) {
          throw new OcpValidationError(
            'conversion_mechanism.converts_to_percent',
            'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION requires converts_to_percent',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        return {
          tag: 'OcfConvMechPercentCapitalization',
          value: {
            converts_to_percent: numberToString(anyM.converts_to_percent as string | number),
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_AMOUNT_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_quantity === undefined) {
          throw new OcpValidationError(
            'conversion_mechanism.converts_to_quantity',
            'FIXED_AMOUNT_CONVERSION requires converts_to_quantity',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        return {
          tag: 'OcfConvMechFixedAmount',
          value: {
            converts_to_quantity: numberToString(anyM.converts_to_quantity as string | number),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'VALUATION_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.valuation_type)
          throw new OcpValidationError(
            'conversion_mechanism.valuation_type',
            'VALUATION_BASED_CONVERSION requires valuation_type',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        return {
          tag: 'OcfConvMechValuationBased',
          value: {
            valuation_type: anyM.valuation_type as string,
            valuation_amount: anyM.valuation_amount ? monetaryToDaml(anyM.valuation_amount as Monetary) : null,
            capitalization_definition: optionalString(anyM.capitalization_definition as string | undefined),
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'SHARE_PRICE_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.description || typeof anyM.description !== 'string') {
          throw new OcpValidationError(
            'conversion_mechanism.description',
            'SHARE_PRICE_BASED_CONVERSION requires description',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        }
        return {
          tag: 'OcfConvMechSharePriceBased',
          value: {
            description: anyM.description,
            discount: Boolean(anyM.discount),
            discount_percentage: anyM.discount_percentage
              ? numberToString(anyM.discount_percentage as string | number)
              : null,
            discount_amount: anyM.discount_amount ? monetaryToDaml(anyM.discount_amount as Monetary) : null,
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'CUSTOM_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const desc =
          (anyM.custom_conversion_description as string) ||
          (anyM.custom_description as string) ||
          (anyM.description as string);
        if (!desc)
          throw new OcpValidationError(
            'conversion_mechanism.custom_conversion_description',
            'CUSTOM_CONVERSION requires custom_conversion_description',
            { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
          );
        return {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: desc },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      default: {
        throw new OcpParseError(`Unknown conversion mechanism: ${typeStr}`, {
          source: 'conversion_mechanism.type',
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        });
      }
    }
  }
  // No mechanism provided -> error (strict)
  throw new OcpValidationError(
    'conversion_right.conversion_mechanism',
    'conversion_right.conversion_mechanism is required',
    { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
  );
}

function buildConvertibleRight(input: ConversionTriggerInput | undefined) {
  const details = typeof input === 'object' && 'conversion_right' in input ? input.conversion_right : undefined;
  const mechanism = mechanismInputToDamlEnum(details?.conversion_mechanism);
  const convertsToFutureRound =
    details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const convertsToStockClassId = optionalString(details?.converts_to_stock_class_id);
  return {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: mechanism,
    converts_to_future_round: convertsToFutureRound,
    converts_to_stock_class_id: convertsToStockClassId,
  };
}

function buildTriggerToDaml(t: ConversionTriggerInput, _index: number, _issuanceId: string) {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  if (typeof t !== 'object' || !t.trigger_id) {
    throw new OcpValidationError('conversionTrigger.trigger_id', 'trigger_id is required for each convertible conversion trigger', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const { trigger_id } = t;
  const nickname = typeof t === 'object' && t.nickname ? t.nickname : null;
  const trigger_description = typeof t === 'object' && t.trigger_description ? t.trigger_description : null;
  const trigger_dateStr = typeof t === 'object' && t.trigger_date ? t.trigger_date : undefined;
  const trigger_condition = typeof t === 'object' && t.trigger_condition ? t.trigger_condition : null;
  const conversion_right = buildConvertibleRight(t);
  return {
    type_: typeEnum,
    trigger_id,
    nickname,
    trigger_description,
    conversion_right,
    trigger_date: trigger_dateStr ? dateStringToDAMLTime(trigger_dateStr) : null,
    trigger_condition,
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
  convertible_type: 'NOTE' | 'SAFE' | 'SECURITY';
  conversion_triggers: ConversionTriggerInput[];
  pro_rata?: string | number;
  seniority: number;
  comments?: string[];
}): Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData {
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
    investment_amount: monetaryToDaml(d.investment_amount),
    convertible_type: convertibleTypeToDaml(d.convertible_type),
    conversion_triggers: d.conversion_triggers.map((t, idx) => buildTriggerToDaml(t, idx, d.id)),
    pro_rata: d.pro_rata !== undefined ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority.toString(),
    comments: cleanComments(d.comments),
  };
}
