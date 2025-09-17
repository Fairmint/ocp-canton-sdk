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
    conversion_triggers: Array<'AUTOMATIC_ON_CONDITION' | 'AUTOMATIC_ON_DATE' | 'ELECTIVE_AT_WILL' | 'ELECTIVE_ON_CONDITION' | 'ELECTIVE_IN_RANGE' | 'UNSPECIFIED' | 'AUTOMATIC' | 'OPTIONAL'>;
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

function convertibleTypeToDaml(t: 'NOTE' | 'SAFE' | 'SECURITY'): any {
  switch (t) {
    case 'NOTE': return 'OcfConvertibleNote';
    case 'SAFE': return 'OcfConvertibleSafe';
    default: return 'OcfConvertibleSecurity';
  }
}

function triggerToDaml(
  t: 'AUTOMATIC_ON_CONDITION' | 'AUTOMATIC_ON_DATE' | 'ELECTIVE_AT_WILL' | 'ELECTIVE_ON_CONDITION' | 'ELECTIVE_IN_RANGE' | 'UNSPECIFIED' | 'AUTOMATIC' | 'OPTIONAL'
): any {
  switch (t) {
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerAutomaticOnDate';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerElectiveAtWill';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerElectiveOnCondition';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerElectiveInRange';
    case 'UNSPECIFIED':
      return 'OcfTriggerUnspecified';
    case 'AUTOMATIC':
      return 'OcfTriggerAutomaticOnCondition';
    case 'OPTIONAL':
      return 'OcfTriggerElectiveAtWill';
    default:
      return 'OcfTriggerAutomaticOnCondition';
  }
}

export async function createConvertibleIssuance(
  client: LedgerJsonApiClient,
  params: CreateConvertibleIssuanceParams
): Promise<CreateConvertibleIssuanceResult> {
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
    convertible_type: convertibleTypeToDaml(d.convertible_type) as any,
    conversion_triggers: d.conversion_triggers.map(triggerToDaml) as any,
    pro_rata: d.pro_rata !== undefined && d.pro_rata !== null ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority as any,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateConvertibleIssuance = {
    issuance_data
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateConvertibleIssuance',
          choiceArgument: choiceArguments as any
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

  const created = Object.values(response.transactionTree.eventsById).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.ConvertibleIssuance.ConvertibleIssuance')
  ) as any;
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
    convertible_type: convertibleTypeToDaml(d.convertible_type) as any,
    conversion_triggers: d.conversion_triggers.map(triggerToDaml) as any,
    pro_rata: d.pro_rata !== undefined && d.pro_rata !== null ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    seniority: d.seniority as any,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateConvertibleIssuance = {
    issuance_data
  } as any;

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateConvertibleIssuance',
      choiceArgument: choiceArguments as any
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


