import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockPlanData, CommandWithDisclosedContracts, StockPlanCancellationBehavior } from '../../types';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

function cancellationBehaviorToDaml(b: StockPlanCancellationBehavior | undefined): Fairmint.OpenCapTable.StockPlan.OcfStockPlanData['default_cancellation_behavior'] {
  if (!b) return null;
  switch (b) {
    case 'RETIRE': return 'OcfPlanCancelRetire';
    case 'RETURN_TO_POOL': return 'OcfPlanCancelReturnToPool';
    case 'HOLD_AS_CAPITAL_STOCK': return 'OcfPlanCancelHoldAsCapitalStock';
    case 'DEFINED_PER_PLAN_SECURITY': return 'OcfPlanCancelDefinedPerPlanSecurity';
    default: throw new Error('Unknown cancellation behavior');
  }
}

function stockPlanDataToDaml(d: OcfStockPlanData): Fairmint.OpenCapTable.StockPlan.OcfStockPlanData {
  if (!d.id) throw new Error('stockPlan.id is required');
  return {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved: typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: d.stock_class_ids,
    comments: d.comments || []
  };
}

export interface CreateStockPlanParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  planData: OcfStockPlanData;
}

export interface CreateStockPlanResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Create a stock plan by exercising the CreateStockPlan choice on an Issuer contract
 *
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockPlan.schema.json
 * - plan_name: Name for the stock plan
 * - board_approval_date (optional): Date board approved the plan (YYYY-MM-DD)
 * - stockholder_approval_date (optional): Date stockholders approved the plan (YYYY-MM-DD)
 * - initial_shares_reserved: Initial shares reserved in the pool
 * - default_cancellation_behavior (optional): What happens to cancelled reserved shares by default
 */
export async function createStockPlan(
  client: LedgerJsonApiClient,
  params: CreateStockPlanParams
): Promise<CreateStockPlanResult> {
  const { command, disclosedContracts } = buildCreateStockPlanCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.StockPlan.StockPlan.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId,
    response
  };
}

export function buildCreateStockPlanCommand(params: CreateStockPlanParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlan = {
    plan_data: stockPlanDataToDaml(params.planData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockPlan',
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
