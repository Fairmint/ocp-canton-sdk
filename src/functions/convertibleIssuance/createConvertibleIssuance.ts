import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, Monetary } from '../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  safeString,
} from '../../utils/typeConversions';

export interface CreateConvertibleIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  issuanceData: {
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
  };
}

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
      throw new Error(`Unknown convertible trigger type: ${exhaustiveCheck as string}`);
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
    throw new Error(`Unknown day_count_convention: ${safeString(v)}`);
  };
  const payoutToDaml = (v: unknown): Fairmint.OpenCapTable.Types.OcfInterestPayoutType => {
    const s = safeString(v).toUpperCase();
    if (s === 'DEFERRED') return 'OcfInterestPayoutDeferred';
    if (s === 'CASH') return 'OcfInterestPayoutCash';
    throw new Error(`Unknown interest_payout: ${safeString(v)}`);
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
            capitalization_definition: (anyM.capitalization_definition as string | undefined) ?? null,
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
              throw new Error(`Unknown interest_accrual_period: ${safeString(v)}`);
          }
        };
        const compoundingToDaml = (v: unknown): string => {
          // Pass-through if already DAML tag; otherwise map common strings
          const s = safeString(v);
          if (s.startsWith('Ocf')) return s;
          const u = s.toUpperCase();
          if (u === 'SIMPLE') return 'OcfSimple';
          if (u === 'COMPOUNDING') return 'OcfCompounding';
          throw new Error(`Unknown compounding_type: ${safeString(v)}`);
        };
        if (!Array.isArray(anyM.interest_rates)) throw new Error('CONVERTIBLE_NOTE_CONVERSION requires interest_rates');
        if (!anyM.day_count_convention) throw new Error('CONVERTIBLE_NOTE_CONVERSION requires day_count_convention');
        if (!anyM.interest_payout) throw new Error('CONVERTIBLE_NOTE_CONVERSION requires interest_payout');
        if (!anyM.interest_accrual_period) {
          throw new Error('CONVERTIBLE_NOTE_CONVERSION requires interest_accrual_period');
        }
        if (!anyM.compounding_type) throw new Error('CONVERTIBLE_NOTE_CONVERSION requires compounding_type');
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
            capitalization_definition: (anyM.capitalization_definition as string | undefined) ?? null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
            exit_multiple: null,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null,
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_percent === undefined) {
          throw new Error('FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION requires converts_to_percent');
        }
        return {
          tag: 'OcfConvMechPercentCapitalization',
          value: {
            converts_to_percent: numberToString(anyM.converts_to_percent as string | number),
            capitalization_definition: (anyM.capitalization_definition as string | undefined) ?? null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_AMOUNT_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_quantity === undefined) {
          throw new Error('FIXED_AMOUNT_CONVERSION requires converts_to_quantity');
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
        if (!anyM.valuation_type) throw new Error('VALUATION_BASED_CONVERSION requires valuation_type');
        return {
          tag: 'OcfConvMechValuationBased',
          value: {
            valuation_type: anyM.valuation_type as string,
            valuation_amount: anyM.valuation_amount ? monetaryToDaml(anyM.valuation_amount as Monetary) : null,
            capitalization_definition: (anyM.capitalization_definition as string | undefined) ?? null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
          },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      case 'SHARE_PRICE_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.description || typeof anyM.description !== 'string') {
          throw new Error('SHARE_PRICE_BASED_CONVERSION requires description');
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
        if (!desc) throw new Error('CUSTOM_CONVERSION requires custom_conversion_description');
        return {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: desc },
        } as Fairmint.OpenCapTable.Types.OcfConvertibleConversionMechanism;
      }
      default: {
        throw new Error(`Unknown conversion mechanism: ${typeStr}`);
      }
    }
  }
  // No mechanism provided -> error (strict)
  throw new Error('conversion_right.conversion_mechanism is required');
}

function buildConvertibleRight(input: ConversionTriggerInput | undefined) {
  const details = typeof input === 'object' && 'conversion_right' in input ? input.conversion_right : undefined;
  const mechanism = mechanismInputToDamlEnum(details?.conversion_mechanism);
  const convertsToFutureRound =
    details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const convertsToStockClassId = details?.converts_to_stock_class_id ?? null;
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
    throw new Error('trigger_id is required for each convertible conversion trigger');
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

export function buildCreateConvertibleIssuanceCommand(
  params: CreateConvertibleIssuanceParams
): CommandWithDisclosedContracts {
  const d = params.issuanceData;
  const issuance_data: Fairmint.OpenCapTable.ConvertibleIssuance.OcfConvertibleIssuanceTxData = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: d.consideration_text ?? null,
    security_law_exemptions: d.security_law_exemptions,
    investment_amount: monetaryToDaml(d.investment_amount),
    convertible_type: convertibleTypeToDaml(d.convertible_type),
    conversion_triggers: d.conversion_triggers.map((t, idx) => buildTriggerToDaml(t, idx, d.id)),
    pro_rata: d.pro_rata !== undefined ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority.toString(),
    comments: cleanComments(d.comments),
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateConvertibleIssuance = {
    issuance_data,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateConvertibleIssuance',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
