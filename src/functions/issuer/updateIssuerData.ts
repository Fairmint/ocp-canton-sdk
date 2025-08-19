import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface UpdateIssuerDataParams {
  issuerContractId: string; // Contract ID of the Issuer contract to update
  newIssuerData: Fairmint.OpenCapTable.OcfObjects.OcfIssuerData; // New issuer data
}

export interface UpdateIssuerDataResult {
  contractId: string; // Contract ID of the updated Issuer
  updateId: string;
}

/**
 * Update issuer data by exercising the UpdateIssuerData choice on an Issuer contract
 * @param client - The ledger JSON API client
 * @param params - Parameters for updating issuer data
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
  
  const issuerParty = eventsResponse.created.createdEvent.createArgument.issuer;
  
  // Create the choice arguments for UpdateIssuerData
  const choiceArguments: Fairmint.OpenCapTable.Issuer.UpdateIssuerData = {
    new_issuer_data: params.newIssuerData
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
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;
  
  return {
    contractId: response.transactionTree.eventsById[1].CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
} 