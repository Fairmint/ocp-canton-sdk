import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { JsSubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api';

export interface AuthorizeIssuerParams {
  issuer: string; // Party ID of the issuer to authorize
}

export interface AuthorizeIssuerResult {
  contractId: string; // Contract ID of the created IssuerAuthorization
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
          contractId: factoryContractIdData.ocpFactoryContractId,
          choice: 'AuthorizeIssuer',
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