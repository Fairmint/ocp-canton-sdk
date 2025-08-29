import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { OcfVestingTermsData } from '../../types/native';
import { vestingTermsDataToDaml } from '../../utils/typeConversions';

export interface UpdateVestingTermsParams {
  vestingTermsContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  newVestingTermsData: OcfVestingTermsData;
}

export interface UpdateVestingTermsResult {
  contractId: string;
  updateId: string;
}

interface CreateArgShape { issuer?: string }
function hasIssuer(arg: unknown): arg is Required<CreateArgShape> {
  return !!arg && typeof arg === 'object' && typeof (arg as CreateArgShape).issuer === 'string';
}

/**
 * Update vesting terms by exercising the UpdateVestingTerms choice on a VestingTerms contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/VestingTerms.schema.json
 */
export async function updateVestingTerms(
  client: LedgerJsonApiClient,
  params: UpdateVestingTermsParams
): Promise<UpdateVestingTermsResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.vestingTermsContractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  const choiceArguments: Fairmint.OpenCapTable.VestingTerms.UpdateVestingTerms = {
    new_vesting_terms_data: vestingTermsDataToDaml(params.newVestingTermsData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.VestingTerms.VestingTerms.templateId,
          contractId: params.vestingTermsContractId,
          choice: 'UpdateVestingTerms',
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
