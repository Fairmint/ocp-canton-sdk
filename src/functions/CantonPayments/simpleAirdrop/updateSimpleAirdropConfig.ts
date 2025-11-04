import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { SimpleAirdropConfig } from './createSimpleAirdrop';

export interface UpdateSimpleAirdropConfigParams {
  airdropContractId: string;
  newConfig: SimpleAirdropConfig;
}

export function buildUpdateSimpleAirdropConfigCommand(params: UpdateSimpleAirdropConfigParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.SimpleAirdrop.SimpleAirdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'SimpleAirdrop_UpdateConfig',
      choiceArgument: {
        newConfig: {
          sender: params.newConfig.sender,
          featuredAppRight: params.newConfig.featuredAppRight,
          amuletRulesCid: params.newConfig.amuletRulesCid,
          dso: params.newConfig.dso,
        },
      },
    },
  };
}




