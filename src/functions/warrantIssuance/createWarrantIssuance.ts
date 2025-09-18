import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Monetary } from '../../types/native';
import { monetaryToDaml, dateStringToDAMLTime } from '../../utils/typeConversions';

export interface SimpleVesting { date: string; amount: string | number }

export interface CreateWarrantIssuanceParams {
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
    quantity?: string | number;
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

interface IssuerCreateArgShape { context?: { system_operator?: string } }

type WarrantTriggerTypeInput =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_AT_WILL'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_IN_RANGE'
  | 'UNSPECIFIED'
  | 'AUTOMATIC' // Back-compat simple flags
  | 'OPTIONAL';

type WarrantConversionMechanismInput =
  | { type: 'CUSTOM'; custom_conversion_description: string }
  | {
      type: 'PERCENT_CAPITALIZATION';
      converts_to_percent: string | number;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | { type: 'FIXED_AMOUNT'; converts_to_quantity: string | number }
  | {
      type: 'VALUATION_BASED';
      valuation_type: string;
      valuation_amount?: Monetary | null;
      capitalization_definition?: string | null;
      capitalization_definition_rules?: Record<string, unknown> | null;
    }
  | {
      type: 'SHARE_PRICE_BASED';
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

function normalizeTriggerType(t: WarrantTriggerTypeInput): Exclude<WarrantTriggerTypeInput, 'AUTOMATIC' | 'OPTIONAL'> {
  if (t === 'AUTOMATIC') return 'AUTOMATIC_ON_CONDITION';
  if (t === 'OPTIONAL') return 'ELECTIVE_AT_WILL';
  return t;
}

function triggerTypeToDamlEnum(
  t: Exclude<WarrantTriggerTypeInput, 'AUTOMATIC' | 'OPTIONAL'>
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

function warrantMechanismToDamlVariant(
  m?: WarrantConversionMechanismInput
): Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism {
  if (!m) {
    return { tag: 'OcfWarrantMechanismCustom', value: { custom_conversion_description: 'Custom warrant conversion' } } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
  }
  switch (m.type) {
    case 'CUSTOM':
      return { tag: 'OcfWarrantMechanismCustom', value: { custom_conversion_description: m.custom_conversion_description } } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
    case 'PERCENT_CAPITALIZATION':
      return {
        tag: 'OcfWarrantMechanismPercentCapitalization',
        value: {
          converts_to_percent: typeof m.converts_to_percent === 'number' ? m.converts_to_percent.toString() : m.converts_to_percent,
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: m.capitalization_definition_rules ?? null
        }
      } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
    case 'FIXED_AMOUNT':
      return {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: {
          converts_to_quantity: typeof m.converts_to_quantity === 'number' ? m.converts_to_quantity.toString() : m.converts_to_quantity
        }
      } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
    case 'VALUATION_BASED':
      return {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: m.valuation_type,
          valuation_amount: m.valuation_amount ? monetaryToDaml(m.valuation_amount) : null,
          capitalization_definition: m.capitalization_definition ?? null,
          capitalization_definition_rules: m.capitalization_definition_rules ?? null
        }
      } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
    case 'SHARE_PRICE_BASED':
      return {
        tag: 'OcfWarrantMechanismSharePriceBased',
        value: {
          description: m.description,
          discount: m.discount,
          discount_percentage: m.discount_percentage !== undefined && m.discount_percentage !== null ? (typeof m.discount_percentage === 'number' ? m.discount_percentage.toString() : m.discount_percentage) : null,
          discount_amount: m.discount_amount ? monetaryToDaml(m.discount_amount) : null
        }
      } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
    default:
      return { tag: 'OcfWarrantMechanismCustom', value: { custom_conversion_description: 'Custom warrant conversion' } } as unknown as Fairmint.OpenCapTable.StockClass.OcfWarrantConversionMechanism;
  }
}

function buildWarrantRight(input: WarrantExerciseTriggerInput | undefined): Fairmint.OpenCapTable.StockClass.OcfAnyConversionRight {
  const details = typeof input === 'object' && input !== null && 'conversion_right' in input ? (input as Exclude<WarrantExerciseTriggerInput, WarrantTriggerTypeInput>).conversion_right : undefined;
  const mechanism = warrantMechanismToDamlVariant(details?.conversion_mechanism);
  const converts_to_future_round = details && typeof details.converts_to_future_round === 'boolean' ? details.converts_to_future_round : null;
  const converts_to_stock_class_id = details?.converts_to_stock_class_id ?? null;
  const warrantRight: Fairmint.OpenCapTable.StockClass.OcfWarrantConversionRight = {
    type_: 'WARRANT_CONVERSION_RIGHT',
    conversion_mechanism: mechanism,
    converts_to_future_round,
    converts_to_stock_class_id
  };
  const anyRight = {
    tag: 'OcfRightWarrant',
    value: warrantRight
  } as unknown as Fairmint.OpenCapTable.StockClass.OcfAnyConversionRight;
  return anyRight;
}

function buildWarrantTrigger(
  t: WarrantExerciseTriggerInput,
  index: number,
  ocfId: string
): Fairmint.OpenCapTable.StockClass.OcfConversionTrigger {
  const normalized = typeof t === 'string' ? normalizeTriggerType(t) : normalizeTriggerType(t.type);
  const typeEnum = triggerTypeToDamlEnum(normalized);
  const trigger_id = typeof t === 'object' && t.trigger_id ? t.trigger_id : `${ocfId}-warrant-trigger-${index + 1}`;
  const nickname = typeof t === 'object' && t.nickname ? t.nickname : null;
  const trigger_description = typeof t === 'object' && t.trigger_description ? t.trigger_description : null;
  const trigger_dateStr = typeof t === 'object' && t.trigger_date ? t.trigger_date : undefined;
  const trigger_condition = typeof t === 'object' && t.trigger_condition ? t.trigger_condition : null;
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
  // Default quantity_source to UNSPECIFIED when quantity is provided per schema
  const quantitySourceDaml =
    d.quantity !== undefined && d.quantity !== null ? ('OcfQuantityUnspecified' as unknown as Fairmint.OpenCapTable.Types.OcfQuantitySourceType) : null;
  const issuance_data: Fairmint.OpenCapTable.WarrantIssuance.OcfWarrantIssuanceData = {
    ocf_id: d.ocf_id,
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
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.ocf_id)),
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
  const created = Object.values(response.transactionTree.eventsById).find((e): e is CreatedEvent =>
    'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId.endsWith(':Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance')
  );
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
  // Default quantity_source to UNSPECIFIED when quantity is provided per schema
  const quantitySourceDaml =
    d.quantity !== undefined && d.quantity !== null ? ('OcfQuantityUnspecified' as unknown as Fairmint.OpenCapTable.Types.OcfQuantitySourceType) : null;
  const issuance_data: Fairmint.OpenCapTable.WarrantIssuance.OcfWarrantIssuanceData = {
    ocf_id: d.ocf_id,
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
    exercise_triggers: d.exercise_triggers.map((t, idx) => buildWarrantTrigger(t, idx, d.ocf_id)),
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


