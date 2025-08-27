import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfIssuerData } from '../../types/native';
import { issuerDataToDaml } from '../../utils/typeConversions';

export interface UpdateIssuerDataParams {
  issuerContractId: string; // Contract ID of the Issuer contract to update
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