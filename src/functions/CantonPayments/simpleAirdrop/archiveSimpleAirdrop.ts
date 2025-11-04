import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface ArchiveSimpleAirdropParams {
  airdropContractId: string;
}

export function buildArchiveSimpleAirdropCommand(params: ArchiveSimpleAirdropParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.SimpleAirdrop.SimpleAirdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'SimpleAirdrop_Archive',
      choiceArgument: {},
    },
  };
}
