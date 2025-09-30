import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockClassData } from '../../types/native';
import { stockClassDataToDaml } from '../../utils/typeConversions';

export interface CreateStockClassParams {
  /** Contract ID of the Issuer contract */
  issuerContractId: string;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  /** The party that will act as the issuer */
  issuerParty: string;
  /**
   * Stock class data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
   * - name: Name for the stock type (e.g. Series A Preferred or Class A Common)
   * - class_type: The type of this stock class (e.g. Preferred or Common)
   * - default_id_prefix: Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate IDs have a dash, the prefix should end in the dash like CS-
   * - initial_shares_authorized: The initial number of shares authorized for this stock class
   * - board_approval_date (optional): Date on which the board approved the stock class (YYYY-MM-DD)
   * - stockholder_approval_date (optional): Date on which the stockholders approved the stock class (YYYY-MM-DD)
   * - votes_per_share: The number of votes each share of this stock class gets
   * - par_value (optional): Per-share par value of this stock class
   * - price_per_share (optional): Per-share price this stock class was issued for
   * - seniority: Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so that stock classes with a higher seniority have higher repayment priority. Multiple stock classes can share the same seniority.
   * - conversion_rights (optional): List of stock class conversion rights possible for this stock class
   * - liquidation_preference_multiple (optional): The liquidation preference per share for this stock class
   * - participation_cap_multiple (optional): The participation cap multiple per share for this stock class
   * - comments (optional): Additional comments or notes about the stock class
   */
  stockClassData: OcfStockClassData;
}

export interface CreateStockClassResult {
  contractId: string; // Contract ID of the created StockClass
  updateId: string;
}

/**
 * Create a stock class by exercising the CreateStockClass choice on an Issuer contract
 *
 * This function requires the FeaturedAppRight contract details to be provided for disclosed contracts,
 * which is necessary for cross-domain contract interactions in Canton.
 *
 * @example
 * ```typescript
 * const featuredAppRightContractDetails = {
 *   contractId: "abcdef1234567890",
 *   createdEventBlob: "serialized_featured_app_right_blob_here",
 *   synchronizerId: "featured_sync_id_here",
 *   templateId: "FeaturedAppRight:template:id:here"
 * };
 *
 * const result = await createStockClass(client, {
 *   issuerContractId: "1234567890abcdef",
 *   featuredAppRightContractDetails,
 *   issuerParty: "issuer_party_id",
 *   stockClassData: {
 *     name: "Series A Preferred",
 *     class_type: "PREFERRED",
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
 * @param params - Parameters for creating a stock class, including the contract details for disclosed contracts
 * @returns Promise resolving to the result of the stock class creation
 */
export async function createStockClass(
  client: LedgerJsonApiClient,
  params: CreateStockClassParams
): Promise<CreateStockClassResult> {
  // Create the choice arguments for CreateStockClass
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClass = {
    stock_class_data: stockClassDataToDaml(params.stockClassData)
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

export function buildCreateStockClassCommand(params: CreateStockClassParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClass = {
    stock_class_data: stockClassDataToDaml(params.stockClassData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockClass',
      choiceArgument: choiceArguments as any
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
