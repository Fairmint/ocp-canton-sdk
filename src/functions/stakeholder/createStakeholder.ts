import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfStakeholderData } from '../../types/native';
import { stakeholderDataToDaml } from '../../utils/typeConversions';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateStakeholderParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  stakeholderParty: string;
  stakeholderData: OcfStakeholderData;
}

export interface CreateStakeholderResult {
  contractId: string;
  updateId: string;
}

/**
 * Create a stakeholder by exercising the CreateStakeholder choice on an Issuer contract
 */
export async function createStakeholder(
  client: LedgerJsonApiClient,
  params: CreateStakeholderParams
): Promise<CreateStakeholderResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStakeholder = {
    stakeholder_data: stakeholderDataToDaml(params.stakeholderData)
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateStakeholder',
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

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}

export function buildCreateStakeholderCommand(params: CreateStakeholderParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStakeholder = {
    stakeholder_data: stakeholderDataToDaml(params.stakeholderData)
  } as any;

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStakeholder',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}
