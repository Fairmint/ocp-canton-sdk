import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfEquityCompensationIssuanceData } from '../../types/native';
import { equityCompIssuanceDataToDaml, dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateEquityCompensationIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  issuanceData: OcfEquityCompensationIssuanceData & {
    ocf_id: string;
    date: string;
    security_id: string;
    custom_id: string;
    stakeholder_id: string;
    stock_plan_id?: string;
    stock_class_id?: string;
  };
}

export interface CreateEquityCompensationIssuanceResult { contractId: string; updateId: string }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createEquityCompensationIssuance(
  client: LedgerJsonApiClient,
  params: CreateEquityCompensationIssuanceParams
): Promise<CreateEquityCompensationIssuanceResult> {
  const issuerEvents = await client.getEventsByContractId({ contractId: params.issuerContractId });
  const systemOperator = (issuerEvents.created?.createdEvent?.createArgument as IssuerCreateArgShape | undefined)?.context?.system_operator;
  if (!systemOperator) throw new Error('System operator not found on Issuer create argument');

  const d = params.issuanceData;
  const issuance_data: Fairmint.OpenCapTable.EquityCompensationIssuance.OcfEquityCompensationIssuanceTxData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: null,
    stockholder_approval_date: null,
    consideration_text: null,
    security_law_exemptions: [],
    stock_plan_id: d.stock_plan_id ?? null,
    stock_class_id: d.stock_class_id ?? null,
    ...equityCompIssuanceDataToDaml(d)
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, issuance_data };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty, systemOperator],
    commands: [ { CreateCommand: { templateId: Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance.templateId, createArguments: createArguments as any } } ],
    disclosedContracts: [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance')
  ) as any;
  if (!created) throw new Error('Expected EquityCompensationIssuance CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateEquityCompensationIssuanceCommand(params: CreateEquityCompensationIssuanceParams & { systemOperator: string }): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.issuanceData;
  const issuance_data: Fairmint.OpenCapTable.EquityCompensationIssuance.OcfEquityCompensationIssuanceTxData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: null,
    stockholder_approval_date: null,
    consideration_text: null,
    security_law_exemptions: [],
    stock_plan_id: d.stock_plan_id ?? null,
    stock_class_id: d.stock_class_id ?? null,
    ...equityCompIssuanceDataToDaml(d)
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: params.systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, issuance_data };
  const command: Command = { CreateCommand: { templateId: Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance.templateId, createArguments: createArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


