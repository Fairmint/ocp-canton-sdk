import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface SimpleAirdropConfig {
  sender: string;
  featuredAppRight: string | null;
  amuletRulesCid: string;
  dso: string;
}

export interface CreateSimpleAirdropParams {
  config: SimpleAirdropConfig;
}

export function buildCreateSimpleAirdropCommand(params: CreateSimpleAirdropParams): Command {
  const airdropData = {
    config: {
      sender: params.config.sender,
      featuredAppRight: params.config.featuredAppRight,
      amuletRulesCid: params.config.amuletRulesCid,
      dso: params.config.dso,
    },
  };

  return {
    CreateCommand: {
      templateId: CantonPayments.Airdrop.SimpleAirdrop.SimpleAirdrop.templateId,
      createArguments: airdropData,
    },
  };
}

