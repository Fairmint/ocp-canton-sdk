import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

/**
 * Details about the IssuerAuthorization contract that need to be disclosed
 * when exercising the CreateIssuer choice. This is required for cross-domain
 * contract interactions in Canton.
 */
export interface IssuerAuthorizationContractDetails {
  /** The contract ID of the IssuerAuthorization contract */
  contractId: string;
  /** The serialized created event blob of the contract */
  createdEventBlob: string;
  /** The synchronizer ID associated with the contract */
  synchronizerId: string;
  /** The template ID of the contract */
  templateId: string;
}

export interface CreateIssuerParams {
  /** Details of the IssuerAuthorization contract for disclosed contracts */
  issuerAuthorizationContractDetails: IssuerAuthorizationContractDetails;
  issuerParty: string;
  /** Issuer data to create */
  issuerData: Fairmint.OpenCapTable.OcfObjects.OcfIssuerData;
}

export interface CreateIssuerResult {
  contractId: string; // Contract ID of the created Issuer
  updateId: string;
}

/**
 * Create an issuer by exercising the CreateIssuer choice on an IssuerAuthorization contract
 * 
 * This function requires the IssuerAuthorization contract details to be provided for disclosed contracts,
 * which is necessary for cross-domain contract interactions in Canton.
 * 
 * @example
 * ```typescript
 * const issuerAuthorizationContractDetails = {
 *   contractId: "1234567890abcdef",
 *   createdEventBlob: "serialized_contract_blob_here",
 *   synchronizerId: "sync_id_here"
 * };
 * 
 * const result = await createIssuer(client, {
 *   issuerAuthorizationContractDetails,
 *   issuerData: {
 *     legal_name: "My Company Inc.",
 *     country_of_formation: "US",
 *     // ... other issuer data
 *   }
 * });
 * ```
 * 
 * @param client - The ledger JSON API client
 * @param params - Parameters for creating an issuer, including the IssuerAuthorization contract details
 * @returns Promise resolving to the result of the issuer creation
 */
export async function createIssuer(
  client: LedgerJsonApiClient,
  params: CreateIssuerParams
): Promise<CreateIssuerResult> {
  // Create the choice arguments for CreateIssuer
  const choiceArguments: Fairmint.OpenCapTable.IssuerAuthorization.CreateIssuer = {
    issuer_data: params.issuerData
  };

  // Submit the choice to the IssuerAuthorization contract
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId,
          contractId: params.issuerAuthorizationContractDetails.contractId,
          choice: 'CreateIssuer',
          choiceArgument: choiceArguments
        }
      }
    ],
    disclosedContracts: [
      {
        templateId: params.issuerAuthorizationContractDetails.templateId,
        contractId: params.issuerAuthorizationContractDetails.contractId,
        createdEventBlob: params.issuerAuthorizationContractDetails.createdEventBlob,
        synchronizerId: params.issuerAuthorizationContractDetails.synchronizerId
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