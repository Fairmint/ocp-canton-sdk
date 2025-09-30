import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CommandWithDisclosedContracts } from '../../types';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockClassAuthorizedSharesAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: {
    id: string;
    date: string;
    stock_class_id: string;
    new_shares_authorized: string | number;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    comments?: string[];
  };
}

export interface CreateStockClassAuthorizedSharesAdjustmentResult { contractId: string; updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockClassAuthorizedSharesAdjustment(
  client: LedgerJsonApiClient,
  params: CreateStockClassAuthorizedSharesAdjustmentParams
): Promise<CreateStockClassAuthorizedSharesAdjustmentResult> {
  const { command, disclosedContracts } = buildCreateStockClassAuthorizedSharesAdjustmentCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values((response.transactionTree as any)?.eventsById ?? (response.transactionTree as any)?.transaction?.eventsById).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment:StockClassAuthorizedSharesAdjustment');
  }) as any;
  if (!created) throw new Error('Expected StockClassAuthorizedSharesAdjustment CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildCreateStockClassAuthorizedSharesAdjustmentCommand(params: CreateStockClassAuthorizedSharesAdjustmentParams): CommandWithDisclosedContracts {
  const d = params.adjustmentData;
  const adjustment_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_shares_authorized: typeof d.new_shares_authorized === 'number' ? d.new_shares_authorized.toString() : d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClassAuthorizedSharesAdjustment = { adjustment_data } as any;
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockClassAuthorizedSharesAdjustment', choiceArgument: choiceArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


