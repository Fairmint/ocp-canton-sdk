import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Monetary } from '../../types/native';
import { monetaryToDaml, dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateConvertibleIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  issuanceData: {
    ocf_id: string;
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

export interface CreateConvertibleIssuanceResult {
  contractId: string;
  updateId: string;
}

interface IssuerCreateArgShape { context?: { system_operator?: string } }

type ConversionTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED'
  // Back-compat simple flags
  | 'AUTOMATIC'
  | 'OPTIONAL';

type ConvertibleConversionMechanismInput =
  | 'CUSTOM_CONVERSION'
  | 'SAFE_CONVERSION'
  | 'NOTE_CONVERSION'
  | 'RATIO_CONVERSION'
  | 'FIXED_AMOUNT_CONVERSION'
  | 'PERCENT_CAPITALIZATION_CONVERSION'
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

function convertibleTypeToDaml(t: 'NOTE' | 'SAFE' | 'SECURITY'): any {
  switch (t) {
    case 'NOTE': return 'OcfConvertibleNote';
    case 'SAFE': return 'OcfConvertibleSafe';
    default: return 'OcfConvertibleSecurity';
  }
}

function normalizeTriggerType(t: ConversionTriggerTypeInput): Exclude<ConversionTriggerTypeInput, 'AUTOMATIC' | 'OPTIONAL'> {
  if (t === 'AUTOMATIC') return 'AUTOMATIC_ON_CONDITION';
  if (t === 'OPTIONAL') return 'ELECTIVE_AT_WILL';
  return t;
}

function triggerTypeToDamlEnum(
  t: Exclude<ConversionTriggerTypeInput, 'AUTOMATIC' | 'OPTIONAL'>
): Fairmint.OpenCapTable.StockClass.OcfConversionTriggerType {
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
    default:
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
  }
}

function mechanismInputToDamlEnum(
  m: ConvertibleConversionMechanismInput | (Record<string, unknown> & { type?: string }) | undefined
): Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism {
  if (m && typeof m === 'object') {
    const typeStr = String(m.type || '').toUpperCase();

    // Helper: map capitalization_definition_rules plain booleans to DAML type
    const mapCapRules = (rules: any) => {
      if (!rules || typeof rules !== 'object') return null;
      return {
        include_outstanding_shares: !!rules.include_outstanding_shares,
        include_outstanding_options: !!rules.include_outstanding_options,
        include_outstanding_unissued_options: !!rules.include_outstanding_unissued_options,
        include_this_security: !!rules.include_this_security,
        include_other_converting_securities: !!rules.include_other_converting_securities,
        include_option_pool_topup_for_promised_options: !!rules.include_option_pool_topup_for_promised_options,
        include_additional_option_pool_topup: !!rules.include_additional_option_pool_topup,
        include_new_money: !!rules.include_new_money
      } as unknown as Fairmint.OpenCapTable.Types.OcfCapitalizationDefinitionRules;
    };

    const safeTiming = (v: unknown): any => {
      const s = String(v || '').toUpperCase();
      if (s === 'PRE_MONEY') return 'OcfConversionTimingPreMoney';
      if (s === 'POST_MONEY') return 'OcfConversionTimingPostMoney';
      return null;
    };

    switch (typeStr) {
      case 'SAFE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        return {
          tag: 'OcfConvMechSAFE',
          value: {
            conversion_discount: anyM.conversion_discount ?? null,
            conversion_valuation_cap: anyM.conversion_valuation_cap ? monetaryToDaml(anyM.conversion_valuation_cap as any) : null,
            exit_multiple: null,
            conversion_mfn: Boolean(anyM.conversion_mfn),
            conversion_timing: safeTiming(anyM.conversion_timing),
            capitalization_definition: (anyM.capitalization_definition as string) || null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules)
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'CONVERTIBLE_NOTE_CONVERSION':
      case 'NOTE_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const mapIR = (arr: any): any[] =>
          Array.isArray(arr)
            ? (arr as any[]).map(ir => ({
                rate: ir?.rate ?? null,
                period_type: ir?.period_type ?? null,
                basis_points: ir?.basis_points ?? null
              }))
            : [];
        return {
          tag: 'OcfConvMechNote',
          value: {
            interest_rates: mapIR(anyM.interest_rates),
            day_count_convention: (anyM.day_count_convention as any) ?? 'OcfDayCountActualActual',
            interest_payout: (anyM.interest_payout as any) ?? 'OcfInterestPayoutAtMaturity',
            interest_accrual_period: (anyM.interest_accrual_period as any) ?? 'OcfAccrualPeriodMonthly',
            compounding_type: (anyM.compounding_type as any) ?? 'OcfCompoundingTypeNone',
            conversion_discount: anyM.conversion_discount ?? null,
            conversion_valuation_cap: anyM.conversion_valuation_cap ? monetaryToDaml(anyM.conversion_valuation_cap as any) : null,
            capitalization_definition: (anyM.capitalization_definition as string) || null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules),
            exit_multiple: null,
            conversion_mfn: (anyM.conversion_mfn as boolean | null) ?? null
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'PERCENT_CAPITALIZATION_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_percent === undefined) throw new Error('PERCENT_CAPITALIZATION_CONVERSION requires converts_to_percent');
        return {
          tag: 'OcfConvMechPercentCapitalization',
          value: {
            converts_to_percent: typeof anyM.converts_to_percent === 'number' ? String(anyM.converts_to_percent) : (anyM.converts_to_percent as string) || '0',
            capitalization_definition: (anyM.capitalization_definition as string) || null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules)
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'FIXED_AMOUNT_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (anyM.converts_to_quantity === undefined) throw new Error('FIXED_AMOUNT_CONVERSION requires converts_to_quantity');
        return {
          tag: 'OcfConvMechFixedAmount',
          value: {
            converts_to_quantity: typeof anyM.converts_to_quantity === 'number' ? String(anyM.converts_to_quantity) : (anyM.converts_to_quantity as string) || '0'
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'VALUATION_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.valuation_type) throw new Error('VALUATION_BASED_CONVERSION requires valuation_type');
        return {
          tag: 'OcfConvMechValuationBased',
          value: {
            valuation_type: (anyM.valuation_type as any) ?? 'OcfValuationActual',
            valuation_amount: anyM.valuation_amount ? monetaryToDaml(anyM.valuation_amount as any) : null,
            capitalization_definition: (anyM.capitalization_definition as string) || null,
            capitalization_definition_rules: mapCapRules(anyM.capitalization_definition_rules)
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'SHARE_PRICE_BASED_CONVERSION':
      case 'PPS_BASED_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        if (!anyM.description || typeof anyM.description !== 'string') throw new Error('SHARE_PRICE_BASED_CONVERSION requires description');
        return {
          tag: 'OcfConvMechSharePriceBased',
          value: {
            description: (anyM.description as string) || 'Share-price based conversion',
            discount: Boolean(anyM.discount),
            discount_percentage: (anyM.discount_percentage as any) ?? null,
            discount_amount: anyM.discount_amount ? monetaryToDaml(anyM.discount_amount as any) : null
          }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      case 'CUSTOM_CONVERSION': {
        const anyM = m as Record<string, unknown>;
        const desc = (anyM.custom_conversion_description as string) || (anyM.custom_description as string) || (anyM.description as string);
        if (!desc) throw new Error('CUSTOM_CONVERSION requires custom_conversion_description');
        return {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: desc }
        } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
      }
      default: {
        throw new Error(`Unknown conversion mechanism: ${typeStr}`);
      }
    }
  }

  // No mechanism provided -> default to CUSTOM with UNSPECIFIED
  return {
    tag: 'OcfConvMechCustom',
    value: { custom_conversion_description: 'UNSPECIFIED' }
  } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
}

function buildConvertibleRight(
  input: ConversionTriggerInput | undefined
): Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionRight {
  const details = typeof input === 'object' && input !== null && 'conversion_right' in input ? (input as Exclude<ConversionTriggerInput, ConversionTriggerTypeInput>).conversion_right : undefined;
  const mechanism = mechanismInputToDamlEnum(details?.conversion_mechanism);
  const convertsToFutureRound =
    details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const convertsToStockClassId = details?.converts_to_stock_class_id ?? null;
  const convertibleRight: Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionRight = {
    type_: 'CONVERTIBLE_CONVERSION_RIGHT',
    conversion_mechanism: mechanism,
    converts_to_future_round: convertsToFutureRound,
    converts_to_stock_class_id: convertsToStockClassId
  } as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionRight;
  return convertibleRight;
}

function buildTriggerToDaml(
  t: ConversionTriggerInput,
  index: number,
  ocfId: string
): Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionTrigger {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  const trigger_id = typeof t === 'object' && t.trigger_id ? t.trigger_id : `${ocfId}-trigger-${index + 1}`;
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
    trigger_condition
  } as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionTrigger;
}

export async function createConvertibleIssuance(
  client: LedgerJsonApiClient,
  params: CreateConvertibleIssuanceParams
): Promise<CreateConvertibleIssuanceResult> {
  type TreeEvent = SubmitAndWaitForTransactionTreeResponse['transactionTree']['eventsById'][string];
  type CreatedEvent = Extract<TreeEvent, { CreatedTreeEvent: unknown }>;
  function isCreatedEvent(e: TreeEvent): e is CreatedEvent {
    return 'CreatedTreeEvent' in e;
  }
  const d = params.issuanceData;
  const issuance_data: Fairmint.OpenCapTable.ConvertibleIssuance.OcfConvertibleIssuanceTxData = {
    ocf_id: d.ocf_id,
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
    conversion_triggers: d.conversion_triggers.map((t, idx) => buildTriggerToDaml(t, idx, d.ocf_id)),
    pro_rata: d.pro_rata !== undefined && d.pro_rata !== null ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority.toString(),
    comments: d.comments || []
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateConvertibleIssuance = {
    issuance_data
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateConvertibleIssuance',
          choiceArgument: choiceArguments
        }
      }
    ],
    disclosedContracts: [
      {
        templateId: params.featuredAppRightContractDetails.templateId,
        contractId: params.featuredAppRightContractDetails.contractId,
        createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
        synchronizerId: params.featuredAppRightContractDetails.synchronizerId
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e): e is CreatedEvent =>
      isCreatedEvent(e) &&
      e.CreatedTreeEvent.value.templateId.endsWith(':Fairmint.OpenCapTable.ConvertibleIssuance.ConvertibleIssuance')
  );
  if (!created) throw new Error('Expected ConvertibleIssuance CreatedTreeEvent not found');

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateConvertibleIssuanceCommand(params: CreateConvertibleIssuanceParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const d = params.issuanceData;
  const issuance_data: Fairmint.OpenCapTable.ConvertibleIssuance.OcfConvertibleIssuanceTxData = {
    ocf_id: d.ocf_id,
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
    conversion_triggers: d.conversion_triggers.map((t, idx) => buildTriggerToDaml(t, idx, d.ocf_id)),
    pro_rata: d.pro_rata !== undefined && d.pro_rata !== null ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority.toString(),
    comments: d.comments || []
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateConvertibleIssuance = {
    issuance_data
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateConvertibleIssuance',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}


