import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfStockPlanData } from '../../types/native';
import { stockPlanDataToDaml } from '../../utils/typeConversions';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateStockPlanParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  planData: OcfStockPlanData;
}

export interface CreateStockPlanResult {
  contractId: string;
  updateId: string;
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
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlan = {
    plan_data: stockPlanDataToDaml(params.planData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateStockPlan',
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

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.StockPlan.StockPlan.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateStockPlanCommand(params: CreateStockPlanParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
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
