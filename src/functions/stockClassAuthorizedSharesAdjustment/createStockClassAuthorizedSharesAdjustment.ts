import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockClassAuthorizedSharesAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  adjustmentData: {
    ocf_id: string;
    date: string;
    stock_class_id: string;
    new_shares_authorized: string | number;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    comments?: string[];
  };
}

export interface CreateStockClassAuthorizedSharesAdjustmentResult { contractId: string; updateId: string }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockClassAuthorizedSharesAdjustment(
  client: LedgerJsonApiClient,
  params: CreateStockClassAuthorizedSharesAdjustmentParams
): Promise<CreateStockClassAuthorizedSharesAdjustmentResult> {
  const issuerEvents = await client.getEventsByContractId({ contractId: params.issuerContractId });
  const systemOperator = (issuerEvents.created?.createdEvent?.createArgument as IssuerCreateArgShape | undefined)?.context?.system_operator;
  if (!systemOperator) throw new Error('System operator not found on Issuer create argument');

  const d = params.adjustmentData;
  const adjustment_data: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.OcfStockClassAuthorizedSharesAdjustmentData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_shares_authorized: typeof d.new_shares_authorized === 'number' ? d.new_shares_authorized.toString() : d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: d.comments || []
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, adjustment_data };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty, systemOperator],
    commands: [ { CreateCommand: { templateId: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId, createArguments: createArguments as any } } ],
    disclosedContracts: [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment')
  ) as any;
  if (!created) throw new Error('Expected StockClassAuthorizedSharesAdjustment CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateStockClassAuthorizedSharesAdjustmentCommand(params: CreateStockClassAuthorizedSharesAdjustmentParams & { systemOperator: string }): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.adjustmentData;
  const adjustment_data: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.OcfStockClassAuthorizedSharesAdjustmentData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_shares_authorized: typeof d.new_shares_authorized === 'number' ? d.new_shares_authorized.toString() : d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: d.comments || []
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: params.systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, adjustment_data };
  const command: Command = { CreateCommand: { templateId: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId, createArguments: createArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


