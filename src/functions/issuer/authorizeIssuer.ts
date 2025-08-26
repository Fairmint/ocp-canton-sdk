import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';
import { ContractDetails } from '../../types/contractDetails';

export interface AuthorizeIssuerParams {
  issuer: string; // Party ID of the issuer to authorize
}

export interface AuthorizeIssuerResult extends ContractDetails {
  updateId: string;
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
          templateId: networkData.templateId,
          contractId: networkData.ocpFactoryContractId,
          choice: 'AuthorizeIssuer',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }
  
  const issuerAuthorizationContractId = created.CreatedTreeEvent.value.contractId;
  const issuerAuthorizationContractEvents = await client.getEventsByContractId({
    contractId: issuerAuthorizationContractId
  });
  
  if (!issuerAuthorizationContractEvents.created?.createdEvent?.createdEventBlob) {
    throw new Error('Invalid issuer authorization contract events response: missing created event or created event blob');
  }
  
  return {
    contractId: issuerAuthorizationContractId,
    updateId: response.transactionTree.updateId,
    createdEventBlob: issuerAuthorizationContractEvents.created.createdEvent.createdEventBlob,
    synchronizerId: response.transactionTree.synchronizerId,
    templateId: created.CreatedTreeEvent.value.templateId
  };
} 