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
    quantity: string | number;
    exercise_price: Monetary;
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

function triggerToDaml(t: 'AUTOMATIC' | 'OPTIONAL'): any {
  return t === 'AUTOMATIC' ? 'OcfConversionTriggerAutomatic' : 'OcfConversionTriggerOptional';
}

export async function createWarrantIssuance(
  client: LedgerJsonApiClient,
  params: CreateWarrantIssuanceParams
): Promise<CreateWarrantIssuanceResult> {
  const issuerEvents = await client.getEventsByContractId({ contractId: params.issuerContractId });
  const createArg = issuerEvents.created?.createdEvent?.createArgument as IssuerCreateArgShape | undefined;
  const systemOperator = createArg?.context?.system_operator;
  if (!systemOperator) throw new Error('System operator not found on Issuer create argument');

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
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    exercise_price: monetaryToDaml(d.exercise_price),
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map(triggerToDaml) as any,
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })) as any,
    comments: d.comments || []
  } as any;

  const createArguments = {
    context: {
      issuer: params.issuerParty,
      system_operator: systemOperator,
      featured_app_right: params.featuredAppRightContractDetails.contractId
    },
    issuance_data
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty, systemOperator],
    commands: [
      {
        CreateCommand: {
          templateId: Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance.templateId,
          createArguments: createArguments as any
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
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance')
  ) as any;
  if (!created) throw new Error('Expected WarrantIssuance CreatedTreeEvent not found');

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateWarrantIssuanceCommand(params: CreateWarrantIssuanceParams & { systemOperator: string }): {
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
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    exercise_price: monetaryToDaml(d.exercise_price),
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map(triggerToDaml) as any,
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })) as any,
    comments: d.comments || []
  } as any;

  const createArguments = {
    context: {
      issuer: params.issuerParty,
      system_operator: params.systemOperator,
      featured_app_right: params.featuredAppRightContractDetails.contractId
    },
    issuance_data
  };

  const command: Command = {
    CreateCommand: {
      templateId: Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance.templateId,
      createArguments: createArguments as any
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


