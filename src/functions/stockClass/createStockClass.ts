import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';

export interface CreateStockClassParams {
  /** Contract ID of the Issuer contract */
  issuerContractId: string;
  /** The party that will act as the issuer */
  issuerParty: string;
  /** Stock class data to create */
  stockClassData: Fairmint.OpenCapTable.Types.OcfStockClassData;
}

export interface CreateStockClassResult {
  contractId: string; // Contract ID of the created StockClass
  updateId: string;
}

/**
 * Create a stock class by exercising the CreateStockClass choice on an Issuer contract
 * 
 * @example
 * ```typescript
 * const result = await createStockClass(client, {
 *   issuerContractId: "1234567890abcdef",
 *   issuerParty: "issuer_party_id",
 *   stockClassData: {
 *     name: "Series A Preferred",
 *     class_type: "OcfStockClassTypePreferred",
 *     default_id_prefix: "SA-",
 *     initial_shares_authorized: "1000000",
 *     votes_per_share: "1",
 *     seniority: "1",
 *     // ... other stock class data
 *   }
 * });
 * ```
 * 
 * @param client - The ledger JSON API client
 * @param params - Parameters for creating a stock class
 * @returns Promise resolving to the result of the stock class creation
 */
export async function createStockClass(
  client: LedgerJsonApiClient,
  params: CreateStockClassParams
): Promise<CreateStockClassResult> {
  // Create the choice arguments for CreateStockClass
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClass = {
    stock_class_data: params.stockClassData
  };

  // Submit the choice to the Issuer contract
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateStockClass',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;
  
  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.StockClass.StockClass.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  const stockClassContractId = created.CreatedTreeEvent.value.contractId;
  
  return {
    contractId: stockClassContractId,
    updateId: response.transactionTree.updateId
  };
}
