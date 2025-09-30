import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Monetary } from '../../types/native';
import { monetaryToDaml, dateStringToDAMLTime } from '../../utils/typeConversions';

export interface SimpleVesting { date: string; amount: string | number }

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

export interface CreateWarrantIssuanceResult {
  contractId: string;
  updateId: string;
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

function triggerTypeToDamlEnum(
  t: WarrantTriggerTypeInput
): any {
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
    default:
      throw new Error(`Unknown warrant trigger type: ${t}`);
  }
}

function warrantMechanismToDamlVariant(
  m?: WarrantConversionMechanismInput
): any {
  if (!m) {
    throw new Error('conversion_right.conversion_mechanism is required for warrant issuance');
  }
  switch (m.type) {
    case 'CUSTOM_CONVERSION':
      return { tag: 'OcfWarrantMechanismCustom', value: { custom_conversion_description: m.custom_conversion_description } } as any;
    case 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: typeof m.converts_to_percent === 'number' ? m.converts_to_percent.toString() : m.converts_to_percent,
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: m.capitalization_definition_rules ?? null
        }
      } as any;
    case 'FIXED_AMOUNT_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: typeof m.converts_to_quantity === 'number' ? m.converts_to_quantity.toString() : m.converts_to_quantity
        }
      } as any;
    case 'VALUATION_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: m.valuation_type,
          valuation_amount: m.valuation_amount ? monetaryToDaml(m.valuation_amount) : null,
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: m.capitalization_definition_rules ?? null
        }
      } as any;
    case 'SHARE_PRICE_BASED_CONVERSION':
      return {
        tag: 'OcfWarrantMechanismSharePriceBased',
        value: {
          description: m.description,
          discount: m.discount,
          discount_percentage: m.discount_percentage !== undefined && m.discount_percentage !== null ? (typeof m.discount_percentage === 'number' ? m.discount_percentage.toString() : m.discount_percentage) : null,
          discount_amount: m.discount_amount ? monetaryToDaml(m.discount_amount) : null
        }
      } as any;
    default:
      throw new Error(`Unknown warrant conversion mechanism type: ${(m as any).type}`);
  }
}

function buildWarrantRight(input: WarrantExerciseTriggerInput | undefined): any {
  const details = typeof input === 'object' && input !== null && 'conversion_right' in input ? (input as Exclude<WarrantExerciseTriggerInput, WarrantTriggerTypeInput>).conversion_right : undefined;
  const mechanism = warrantMechanismToDamlVariant(details?.conversion_mechanism);
  const converts_to_future_round = details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const converts_to_stock_class_id = details?.converts_to_stock_class_id ?? null;
  const warrantRight: any = {
    type_: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: mechanism,
    converts_to_future_round,
    converts_to_stock_class_id
  };
  const anyRight = {
    tag: 'OcfRightWarrant',
    value: warrantRight
  } as unknown as any;
  return anyRight;
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
    default:
      throw new Error(`Unknown quantity_source: ${qs}`);
  }
}

function buildWarrantTrigger(
  t: WarrantExerciseTriggerInput,
  index: number,
  ocfId: string
): any {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  if (typeof t !== 'object' || !t.trigger_id) throw new Error('trigger_id is required for each warrant exercise trigger');
  const trigger_id = t.trigger_id;
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
    trigger_condition
  };
}

export async function createWarrantIssuance(
  client: LedgerJsonApiClient,
  params: CreateWarrantIssuanceParams
): Promise<CreateWarrantIssuanceResult> {
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
    consideration_text: d.consideration_text ?? null,
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity !== undefined && d.quantity !== null ? (typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity) : null,
    quantity_source: quantitySourceDaml,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.id)),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })),
    comments: d.comments || []
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateWarrantIssuance = {
    issuance_data
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateWarrantIssuance',
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

  type TreeEvent = SubmitAndWaitForTransactionTreeResponse['transactionTree']['eventsById'][string];
  type CreatedEvent = Extract<TreeEvent, { CreatedTreeEvent: unknown }>;
  const created = Object.values(response.transactionTree.eventsById).find((e): e is CreatedEvent => {
    if (!('CreatedTreeEvent' in e)) return false;
    const templateId = e.CreatedTreeEvent.value.templateId;
    return templateId.endsWith(':Fairmint.OpenCapTable.WarrantIssuance:WarrantIssuance');
  });
  if (!created) throw new Error('Expected WarrantIssuance CreatedTreeEvent not found');

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateWarrantIssuanceCommand(params: CreateWarrantIssuanceParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
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
    consideration_text: d.consideration_text ?? null,
    security_law_exemptions: d.security_law_exemptions,
    quantity: d.quantity !== undefined && d.quantity !== null ? (typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity) : null,
    quantity_source: quantitySourceDaml,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.id)),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })),
    comments: d.comments || []
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateWarrantIssuance = {
    issuance_data
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateWarrantIssuance',
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


