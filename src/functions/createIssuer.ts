import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { JsSubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api';

export interface CreateIssuerParams {
  issuerAuthorizationContractId: string; // Contract ID of the IssuerAuthorization contract
  issuerData: Fairmint.OpenCapTable.OcfObjects.OcfIssuerData; // Issuer data to create
}

export interface CreateIssuerResult {
  contractId: string; // Contract ID of the created Issuer
  updateId: string;
}

/**
 * Create an issuer by exercising the CreateIssuer choice on an IssuerAuthorization contract
 * @param client - The ledger JSON API client
 * @param params - Parameters for creating an issuer
 * @returns Promise resolving to the result of the issuer creation
 */
export async function createIssuer(
  client: LedgerJsonApiClient,
  params: CreateIssuerParams
): Promise<CreateIssuerResult> {
  // Get the events for the IssuerAuthorization contract to extract the issuer party
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.issuerAuthorizationContractId
  });
  
  const issuerParty = eventsResponse.created.createdEvent.createArgument.issuer;
  
  // Create the choice arguments for CreateIssuer
  const choiceArguments: Fairmint.OpenCapTable.IssuerAuthorization.CreateIssuer = {
    issuer_data: params.issuerData
  };

  // Submit the choice to the IssuerAuthorization contract
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId,
          contractId: params.issuerAuthorizationContractId,
          choice: 'CreateIssuer',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as JsSubmitAndWaitForTransactionTreeResponse;
  
  return {
    contractId: response.transactionTree.eventsById[1].CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
} 