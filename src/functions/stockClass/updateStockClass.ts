import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfStockClassData } from '../../types/native';
import { stockClassDataToDaml } from '../../utils/typeConversions';

export interface UpdateStockClassParams {
  stockClassContractId: string; // Contract ID of the StockClass contract to update
  newStockClassData: OcfStockClassData; // New stock class data
}

export interface UpdateStockClassResult {
  contractId: string; // Contract ID of the updated StockClass
  updateId: string;
}

interface StockClassCreateArgumentShape {
  issuer?: string;
}

function hasIssuer(arg: unknown): arg is Required<Pick<StockClassCreateArgumentShape, 'issuer'>> {
  return !!arg && typeof arg === 'object' && typeof (arg as StockClassCreateArgumentShape).issuer === 'string';
}

/**
 * Update stock class data by exercising the UpdateStockClassData choice on a StockClass contract
 * 
 * This function retrieves the issuer party from the stock class contract and then updates
 * the stock class data with the provided new data.
 * 
 * @example
 * ```typescript
 * const result = await updateStockClass(client, {
 *   stockClassContractId: "1234567890abcdef",
 *   newStockClassData: {
 *     name: "Series A Preferred (Updated)",
 *     class_type: "PREFERRED",
 *     default_id_prefix: "SA-",
 *     initial_shares_authorized: "2000000", // Updated from 1000000
 *     votes_per_share: "1",
 *     seniority: "1",
 *     // ... other updated stock class data
 *   }
 * });
 * ```
 * 
 * @param client - The ledger JSON API client
 * @param params - Parameters for updating stock class data
 * @returns Promise resolving to the result of the stock class data update
 */
export async function updateStockClass(
  client: LedgerJsonApiClient,
  params: UpdateStockClassParams
): Promise<UpdateStockClassResult> {
  // Get the events for the StockClass contract to extract the issuer party
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.stockClassContractId
  });
  
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;
  
  // Create the choice arguments for UpdateStockClassData
  const choiceArguments: Fairmint.OpenCapTable.StockClass.UpdateStockClassData = {
    new_stock_class_data: stockClassDataToDaml(params.newStockClassData)
  };

  // Submit the choice to the StockClass contract
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'UpdateStockClassData',
          choiceArgument: choiceArguments
        }
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
