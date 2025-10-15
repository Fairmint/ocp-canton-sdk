import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface MigrateActiveSubscriptionParams {
  migrationProposalContractId: string;
  actor: string;
  activeSubscriptionCid: string;
}

export function buildMigrateActiveSubscriptionCommand(params: MigrateActiveSubscriptionParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_MigrateActiveSubscription',
      choiceArgument: {
        actor: params.actor,
        activeSubscriptionCid: params.activeSubscriptionCid,
      },
    },
  };
}
