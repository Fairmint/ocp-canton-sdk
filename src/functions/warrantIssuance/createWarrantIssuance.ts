import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts, Monetary } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface SimpleVesting {
  date: string;
  amount: string | number;
}

export interface CreateWarrantIssuanceParams {
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
    quantity?: string | number;
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
  };
}

type WarrantTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED';

type WarrantConversionMechanismInput =
  | { type: 'CUSTOM_CONVERSION'; custom_conversion_description: string }
  | {
      type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
      converts_to_percent: string | number;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | { type: 'FIXED_AMOUNT_CONVERSION'; converts_to_quantity: string | number }
  | {
      type: 'VALUATION_BASED_CONVERSION';
      valuation_type: string;
      valuation_amount?: Monetary | null;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | {
      type: 'SHARE_PRICE_BASED_CONVERSION';
      description: string;
      discount: boolean;
      discount_percentage?: string | number | null;
      discount_amount?: Monetary | null;
    };

export type WarrantExerciseTriggerInput =
  | WarrantTriggerTypeInput
  | {
      type: WarrantTriggerTypeInput;
      trigger_id?: string;
      nickname?: string;
      trigger_description?: string;
      trigger_date?: string; // YYYY-MM-DD or ISO datetime
      trigger_condition?: string;
      conversion_right?: {
        conversion_mechanism?: WarrantConversionMechanismInput;
        converts_to_future_round?: boolean;
        converts_to_stock_class_id?: string;
      };
    };

function normalizeTriggerType(t: WarrantTriggerTypeInput): WarrantTriggerTypeInput {
  return t;
}

function triggerTypeToDamlEnum(t: WarrantTriggerTypeInput): Fairmint.OpenCapTable.Types.OcfConversionTriggerType {
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
      throw new Error(`Unknown warrant trigger type: ${exhaustiveCheck as string}`);
    }
  }
}

function warrantMechanismToDamlVariant(
  m?: WarrantConversionMechanismInput
): Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism {
  if (!m) {
    throw new Error('conversion_right.conversion_mechanism is required for warrant issuance');
  }
  switch (m.type) {
    case 'CUSTOM_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismCustom',
        value: { custom_conversion_description: m.custom_conversion_description },
      } as Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism;
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: numberToString(m.converts_to_percent),
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: (m.capitalization_definition_rules ??
            null) as Fairmint.OpenCapTable.Types.OcfCapitalizationDefinitionRules | null,
        },
      } as Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism;
    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: numberToString(m.converts_to_quantity),
        },
      } as Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism;
    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: m.valuation_type,
          valuation_amount: m.valuation_amount ? monetaryToDaml(m.valuation_amount) : null,
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: (m.capitalization_definition_rules ??
            null) as Fairmint.OpenCapTable.Types.OcfCapitalizationDefinitionRules | null,
        },
      } as Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism;
    case 'SHARE_PRICE_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismSharePriceBased',
        value: {
          description: m.description,
          discount: m.discount,
          discount_percentage:
            m.discount_percentage !== undefined && m.discount_percentage !== null
              ? numberToString(m.discount_percentage)
              : null,
          discount_amount: m.discount_amount ? monetaryToDaml(m.discount_amount) : null,
        },
      } as Fairmint.OpenCapTable.Types.OcfWarrantConversionMechanism;
  }
}

function buildWarrantRight(
  input: WarrantExerciseTriggerInput | undefined
): Fairmint.OpenCapTable.Types.OcfAnyConversionRight {
  const details =
    typeof input === 'object' && input !== null && 'conversion_right' in input ? input.conversion_right : undefined;
  const mechanism = warrantMechanismToDamlVariant(details?.conversion_mechanism);
  const converts_to_future_round =
    details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const converts_to_stock_class_id = details?.converts_to_stock_class_id ?? null;
  return {
    tag: 'OcfRightWarrant',
    value: {
      type_: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: mechanism,
      converts_to_future_round,
      converts_to_stock_class_id,
    },
  } as Fairmint.OpenCapTable.Types.OcfAnyConversionRight;
}

function quantitySourceToDamlEnum(
  qs: CreateWarrantIssuanceParams['issuanceData']['quantity_source'] | null | undefined
): Fairmint.OpenCapTable.Types.OcfQuantitySourceType | null {
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
      throw new Error(`Unknown quantity_source: ${String(qs)}`);
    }
  }
}

function buildWarrantTrigger(t: WarrantExerciseTriggerInput, _index: number, _ocfId: string) {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  if (typeof t !== 'object' || !t.trigger_id) {
    throw new Error('trigger_id is required for each warrant exercise trigger');
  }
  const { trigger_id } = t;
  const nickname = typeof t.nickname === 'string' ? t.nickname : null;
  const trigger_description = typeof t.trigger_description === 'string' ? t.trigger_description : null;
  const trigger_dateStr = typeof t.trigger_date === 'string' ? t.trigger_date : undefined;
  const trigger_condition = typeof t.trigger_condition === 'string' ? t.trigger_condition : null;
  const conversion_right = buildWarrantRight(t);
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

export function buildCreateWarrantIssuanceCommand(params: CreateWarrantIssuanceParams): CommandWithDisclosedContracts {
  const d = params.issuanceData;
  const quantitySourceDaml =
    d.quantity !== undefined && d.quantity !== null
      ? quantitySourceToDamlEnum(d.quantity_source ?? 'UNSPECIFIED')
      : quantitySourceToDamlEnum(d.quantity_source);
  const issuance_data: Fairmint.OpenCapTable.WarrantIssuance.OcfWarrantIssuanceData = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: optionalString(d.consideration_text),
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity !== undefined && d.quantity !== null ? numberToString(d.quantity) : null,
    quantity_source: quantitySourceDaml,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.id)),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings ?? []).map((v) => ({
      date: dateStringToDAMLTime(v.date),
      amount: numberToString(v.amount),
    })),
    comments: cleanComments(d.comments),
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateWarrantIssuance = {
    issuance_data,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateWarrantIssuance',
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
