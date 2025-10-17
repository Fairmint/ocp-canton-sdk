import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface PartyMigrationProposalApproveParams {
  migrationProposalContractId: string;
  actor: string;
}

export function buildPartyMigrationProposalApproveCommand(params: PartyMigrationProposalApproveParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_Approve',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };
}
