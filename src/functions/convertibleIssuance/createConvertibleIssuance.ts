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
  m: ConvertibleConversionMechanismInput | undefined
): Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism {
  return { tag: 'OcfConvMechCustom', value: { OcfCustomConversionMechanism: { custom_conversion_description: (m ?? 'CUSTOM_CONVERSION') } } } as unknown as Fairmint.OpenCapTable.StockClass.OcfConvertibleConversionMechanism;
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


