import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface AirdropConfig {
  sender: string;
  featuredAppRight: string;
  amuletRulesCid: string;
  dso: string;
}

export interface CreateAirdropParams {
  config: AirdropConfig;
  observers?: string[];
}

export function buildCreateAirdropCommand(params: CreateAirdropParams): Command {
  const airdropData = {
    config: {
      sender: params.config.sender,
      featuredAppRight: params.config.featuredAppRight,
      amuletRulesCid: params.config.amuletRulesCid,
      dso: params.config.dso,
    },
    joinedParties: [],
    observers: params.observers ?? [],
  };

  return {
    CreateCommand: {
      templateId: CantonPayments.Airdrop.Airdrop.Airdrop.templateId,
      createArguments: airdropData,
    },
  };
}

