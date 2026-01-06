import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface DeleteStakeholderParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  stakeholderId: string;
}

export function buildDeleteStakeholderCommand(params: DeleteStakeholderParams): CommandWithDisclosedContracts {
  const choiceArguments = {
    id: params.stakeholderId,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.CapTable.CapTable.templateId,
      contractId: params.capTableContractId,
      choice: 'DeleteStakeholder',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}

