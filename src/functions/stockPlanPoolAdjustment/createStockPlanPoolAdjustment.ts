import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CommandWithDisclosedContracts } from '../../types';
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

export interface CreateStockPlanPoolAdjustmentResult { contractId: string; updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockPlanPoolAdjustment(
  client: LedgerJsonApiClient,
  params: CreateStockPlanPoolAdjustmentParams
): Promise<CreateStockPlanPoolAdjustmentResult> {
  const { command, disclosedContracts } = buildCreateStockPlanPoolAdjustmentCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values((response.transactionTree as any)?.eventsById ?? (response.transactionTree as any)?.transaction?.eventsById).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.StockPlanPoolAdjustment:StockPlanPoolAdjustment');
  }) as any;
  if (!created) throw new Error('Expected StockPlanPoolAdjustment CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildCreateStockPlanPoolAdjustmentCommand(params: CreateStockPlanPoolAdjustmentParams): CommandWithDisclosedContracts {
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


