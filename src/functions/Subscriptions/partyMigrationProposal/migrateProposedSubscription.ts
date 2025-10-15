import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface MigrateProposedSubscriptionParams {
  migrationProposalContractId: string;
  actor: string;
  proposedSubscriptionCid: string;
}

export function buildMigrateProposedSubscriptionCommand(params: MigrateProposedSubscriptionParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_MigrateProposedSubscription',
      choiceArgument: {
        actor: params.actor,
        proposedSubscriptionCid: params.proposedSubscriptionCid,
      },
    },
  };
}
