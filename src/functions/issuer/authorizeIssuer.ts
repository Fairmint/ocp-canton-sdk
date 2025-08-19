import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AuthorizeIssuerParams {
  issuer: string; // Party ID of the issuer to authorize
}

export interface AuthorizeIssuerResult {
  contractId: string; // Contract ID of the created IssuerAuthorization
  updateId: string;
  createdEventBlob: string;
  synchronizerId: string;
  templateId: string;
}

/**
 * Authorize an issuer using the OCP Factory contract
 * @param client - The ledger JSON API client
 * @param params - Parameters for authorizing an issuer
 * @returns Promise resolving to the result of the authorization
 */
export async function authorizeIssuer(
  client: LedgerJsonApiClient,
  params: AuthorizeIssuerParams
): Promise<AuthorizeIssuerResult> {
  // Get the current network from the client
  const network = client.getNetwork();
  
  // Select the appropriate contract ID based on the network
  const networkData = factoryContractIdData[network as keyof typeof factoryContractIdData];
  if (!networkData) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Create the choice arguments for AuthorizeIssuer
  const choiceArguments: Fairmint.OpenCapTable.OcpFactory.AuthorizeIssuer = {
    issuer: params.issuer
  };

  // Submit the choice to the factory contract
  const response = await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId,
          contractId: networkData.ocpFactoryContractId,
          choice: 'AuthorizeIssuer',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const issuerContractId = response.transactionTree.eventsById[1].CreatedTreeEvent.value.contractId;
  const issuerContractEvents = await client.getEventsByContractId({
    contractId: issuerContractId
  })
  
  return {
    contractId: issuerContractId,
    updateId: response.transactionTree.updateId,
    createdEventBlob: issuerContractEvents.created.createdEvent.createdEventBlob,
    synchronizerId: response.transactionTree.synchronizerId,
    templateId: response.transactionTree.eventsById[1].CreatedTreeEvent.value.templateId
  };
} 