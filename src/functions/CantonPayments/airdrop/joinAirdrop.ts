import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface AirdropContractDetails {
  templateId: string;
  contractId: string;
  createdEventBlob: string;
  synchronizerId: string;
}

export interface JoinAirdropParams {
  airdropContractId: string;
  actor: string;
  airdropContractDetails: AirdropContractDetails;
}

export function buildJoinAirdropCommand(params: JoinAirdropParams): CommandWithDisclosedContracts {
  const command: Command = {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.Airdrop.Airdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'Airdrop_Join',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.airdropContractDetails.templateId,
      contractId: params.airdropContractDetails.contractId,
      createdEventBlob: params.airdropContractDetails.createdEventBlob,
      synchronizerId: params.airdropContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
