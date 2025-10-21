import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { AirdropConfig } from './createAirdrop';

export interface UpdateAirdropConfigParams {
  airdropContractId: string;
  newConfig: AirdropConfig;
}

export function buildUpdateAirdropConfigCommand(params: UpdateAirdropConfigParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.Airdrop.Airdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'Airdrop_UpdateConfig',
      choiceArgument: {
        newConfig: {
          sender: params.newConfig.sender,
          featuredAppRight: params.newConfig.featuredAppRight || null,
          amuletRulesCid: params.newConfig.amuletRulesCid,
          dso: params.newConfig.dso,
        },
      },
    },
  };
}

