import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface AddObserversToAirdropParams {
  airdropContractId: string;
  actor: string;
  newObservers: string[];
}

export function buildAddObserversToAirdropCommand(params: AddObserversToAirdropParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.Airdrop.Airdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'Airdrop_AddObservers',
      choiceArgument: {
        actor: params.actor,
        newObservers: params.newObservers,
      },
    },
  };
}
