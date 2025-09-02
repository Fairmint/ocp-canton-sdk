import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { ContractId } from '@daml/types';
import { ContractDetails } from '../../types/contractDetails';
import { OcfStockPlanData } from '../../types/native';
import { stockPlanDataToDaml } from '../../utils/typeConversions';

export interface UpdateStockPlanParams {
  stockPlanContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  newPlanData: OcfStockPlanData;
  newStockClassContractIds: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>[];
}

export interface UpdateStockPlanResult {
  contractId: string;
  updateId: string;
}

interface CreateArgShape { issuer?: string }
function hasIssuer(arg: unknown): arg is Required<CreateArgShape> {
  return !!arg && typeof arg === 'object' && typeof (arg as CreateArgShape).issuer === 'string';
}

/**
 * Update a stock plan by exercising the UpdateStockPlan choice on a StockPlan contract
 *
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockPlan.schema.json
 * - newPlanData: fields per schema (plan_name, initial_shares_reserved, optional dates and behavior)
 * - newStockClassContractIds: updated array of stock class contract IDs
 */
export async function updateStockPlan(
  client: LedgerJsonApiClient,
  params: UpdateStockPlanParams
): Promise<UpdateStockPlanResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.stockPlanContractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  const choiceArguments: Fairmint.OpenCapTable.StockPlan.UpdateStockPlan = {
    new_plan_data: stockPlanDataToDaml(params.newPlanData),
    new_stock_classes: params.newStockClassContractIds
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.StockPlan.templateId,
          contractId: params.stockPlanContractId,
          choice: 'UpdateStockPlan',
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

  const event = response.transactionTree.eventsById[1];
  if ('CreatedTreeEvent' in event) {
    return {
      contractId: event.CreatedTreeEvent.value.contractId,
      updateId: response.transactionTree.updateId
    };
  } else {
    throw new Error('Expected CreatedTreeEvent not found');
  }
}
