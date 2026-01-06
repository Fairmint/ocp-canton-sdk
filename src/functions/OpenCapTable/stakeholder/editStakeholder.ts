import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfStakeholderData } from '../../../types';
import { stakeholderDataToDaml } from './createStakeholder';

export interface EditStakeholderParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  stakeholderId: string;
  stakeholderData: OcfStakeholderData;
}

export function buildEditStakeholderCommand(params: EditStakeholderParams): CommandWithDisclosedContracts {
  const damlData = stakeholderDataToDaml(params.stakeholderData);

  // Omit current_status if it's null for JSON API compatibility
  const { current_status, ...restData } = damlData;
  const stakeholderDataForJson = current_status === null ? restData : damlData;

  const choiceArguments = {
    id: params.stakeholderId,
    new_stakeholder_data: stakeholderDataForJson,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.CapTable.CapTable.templateId,
      contractId: params.capTableContractId,
      choice: 'EditStakeholder',
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
