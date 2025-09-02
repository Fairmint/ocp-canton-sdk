import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { OcfIssuerData } from '../../types/native';
import { issuerDataToDaml } from '../../utils/typeConversions';

export interface UpdateIssuerDataParams {
  issuerContractId: string; // Contract ID of the Issuer contract to update
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: ContractDetails;
  /**
   * New issuer data to apply to the contract
   * See schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
   * Field notes mirror the schema descriptions (legal_name, formation_date, country_of_formation, etc.)
   */
  newIssuerData: OcfIssuerData; // New issuer data
}

export interface UpdateIssuerDataResult {
  contractId: string; // Contract ID of the updated Issuer
  updateId: string;
}

interface IssuerCreateArgumentShape {
  issuer?: string;
}

function hasIssuer(arg: unknown): arg is Required<Pick<IssuerCreateArgumentShape, 'issuer'>> {
  return !!arg && typeof arg === 'object' && typeof (arg as IssuerCreateArgumentShape).issuer === 'string';
}

/**
 * Update issuer data by exercising the UpdateIssuerData choice on an Issuer contract
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
 * const result = await updateIssuerData(client, {
 *   issuerContractId: "1234567890abcdef",
 *   featuredAppRightContractDetails,
 *   newIssuerData: {
 *     legal_name: "Updated Company Inc.",
 *     country_of_formation: "US",
 *     // ... other updated issuer data
 *   }
 * });
 * ```
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters for updating issuer data, including the contract details for disclosed contracts
 * @returns Promise resolving to the result of the issuer data update
 */
export async function updateIssuerData(
  client: LedgerJsonApiClient,
  params: UpdateIssuerDataParams
): Promise<UpdateIssuerDataResult> {
  // Get the events for the Issuer contract to extract the issuer party
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.issuerContractId
  });

  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  // Create the choice arguments for UpdateIssuerData
  const choiceArguments: Fairmint.OpenCapTable.Issuer.UpdateIssuerData = {
    new_issuer_data: issuerDataToDaml(params.newIssuerData)
  };

  // Submit the choice to the Issuer contract
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'UpdateIssuerData',
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
