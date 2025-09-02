import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { OcfStakeholderData } from '../../types/native';
import { stakeholderDataToDaml } from '../../utils/typeConversions';

export interface UpdateStakeholderDataParams {
  stakeholderContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  newStakeholderData: OcfStakeholderData;
}

export interface UpdateStakeholderDataResult {
  contractId: string;
  updateId: string;
}

interface StakeholderCreateArgumentShape {
  issuer?: string;
}

function hasIssuer(arg: unknown): arg is Required<Pick<StakeholderCreateArgumentShape, 'issuer'>> {
  return !!arg && typeof arg === 'object' && typeof (arg as StakeholderCreateArgumentShape).issuer === 'string';
}

/**
 * Update stakeholder data by exercising the UpdateStakeholderData choice on a Stakeholder contract
 */
export async function updateStakeholderData(
  client: LedgerJsonApiClient,
  params: UpdateStakeholderDataParams
): Promise<UpdateStakeholderDataResult> {
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.stakeholderContractId
  });

  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  const choiceArguments: Fairmint.OpenCapTable.Stakeholder.UpdateStakeholderData = {
    new_stakeholder_data: stakeholderDataToDaml(params.newStakeholderData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId,
          contractId: params.stakeholderContractId,
          choice: 'UpdateStakeholderData',
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
