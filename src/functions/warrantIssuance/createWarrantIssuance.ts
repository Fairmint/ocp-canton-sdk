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
    exercise_triggers: Array<'AUTOMATIC' | 'OPTIONAL'>;
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

function triggerToDaml(t: 'AUTOMATIC_ON_CONDITION' | 'AUTOMATIC_ON_DATE' | 'ELECTIVE_AT_WILL' | 'ELECTIVE_ON_CONDITION' | 'ELECTIVE_IN_RANGE' | 'UNSPECIFIED' | 'AUTOMATIC' | 'OPTIONAL'): any {
  switch (t) {
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeAutomaticOnDate';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeElectiveAtWill';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeElectiveOnCondition';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeElectiveInRange';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeUnspecified';
    case 'AUTOMATIC':
      return 'OcfTriggerTypeAutomaticOnCondition';
    case 'OPTIONAL':
      return 'OcfTriggerTypeElectiveAtWill';
    default:
      return 'OcfTriggerTypeAutomaticOnCondition';
  }
}

export async function createWarrantIssuance(
  client: LedgerJsonApiClient,
  params: CreateWarrantIssuanceParams
): Promise<CreateWarrantIssuanceResult> {
  const d = params.issuanceData;
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
    quantity_source: null,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map(triggerToDaml),
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
    quantity_source: null,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map(triggerToDaml),
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


