import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { OcfValuationData } from '../../types/native';
import { valuationDataToDaml } from '../../utils/typeConversions';

export interface UpdateValuationDataParams {
  valuationContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  newValuationData: OcfValuationData;
}

export interface UpdateValuationDataResult {
  contractId: string;
  updateId: string;
}

interface CreateArgShape { issuer?: string }
function hasIssuer(arg: unknown): arg is Required<CreateArgShape> {
  return !!arg && typeof arg === 'object' && typeof (arg as CreateArgShape).issuer === 'string';
}

/**
 * Update valuation data by exercising the UpdateValuationData choice on a Valuation contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Valuation.schema.json
 */
export async function updateValuationData(
  client: LedgerJsonApiClient,
  params: UpdateValuationDataParams
): Promise<UpdateValuationDataResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.valuationContractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  const choiceArguments: Fairmint.OpenCapTable.Valuation.UpdateValuationData = {
    new_valuation_data: valuationDataToDaml(params.newValuationData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Valuation.Valuation.templateId,
          contractId: params.valuationContractId,
          choice: 'UpdateValuationData',
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
