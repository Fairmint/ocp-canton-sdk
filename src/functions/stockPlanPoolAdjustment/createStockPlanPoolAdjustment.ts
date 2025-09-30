import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockPlanPoolAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: {
    id: string;
    date: string;
    stock_plan_id: string;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    shares_reserved: string | number;
    comments?: string[];
  };
}

export interface CreateStockPlanPoolAdjustmentResult { contractId: string; updateId: string }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockPlanPoolAdjustment(
  client: LedgerJsonApiClient,
  params: CreateStockPlanPoolAdjustmentParams
): Promise<CreateStockPlanPoolAdjustmentResult> {
  const d = params.adjustmentData;
  const adjustment_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_plan_id: d.stock_plan_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    shares_reserved: typeof d.shares_reserved === 'number' ? d.shares_reserved.toString() : d.shares_reserved,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlanPoolAdjustment = { adjustment_data } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockPlanPoolAdjustment', choiceArgument: choiceArguments as any } }
    ],
    disclosedContracts: [
      { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.StockPlanPoolAdjustment:StockPlanPoolAdjustment');
  }) as any;
  if (!created) throw new Error('Expected StockPlanPoolAdjustment CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateStockPlanPoolAdjustmentCommand(params: CreateStockPlanPoolAdjustmentParams): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.adjustmentData;
  const adjustment_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_plan_id: d.stock_plan_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    shares_reserved: typeof d.shares_reserved === 'number' ? d.shares_reserved.toString() : d.shares_reserved,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlanPoolAdjustment = { adjustment_data } as any;
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockPlanPoolAdjustment', choiceArgument: choiceArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


