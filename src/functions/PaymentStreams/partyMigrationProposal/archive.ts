import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface PartyMigrationProposalArchiveParams {
  migrationProposalContractId: string;
  actor: string;
  description?: string;
}

export function buildPartyMigrationProposalArchiveCommand(params: PartyMigrationProposalArchiveParams): Command {
  const choiceArgument = {
    actor: params.actor,
    description: params.description ?? null,
  };

  if (params.description) {
    choiceArgument.description = params.description;
  }

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_Archive',
      choiceArgument,
    },
  };
}
