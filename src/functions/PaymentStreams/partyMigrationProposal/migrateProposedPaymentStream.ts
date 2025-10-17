import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface MigrateProposedPaymentStreamParams {
  migrationProposalContractId: string;
  actor: string;
  proposedPaymentStreamCid: string;
}

export function buildMigrateProposedPaymentStreamCommand(params: MigrateProposedPaymentStreamParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_MigrateProposedPaymentStream',
      choiceArgument: {
        actor: params.actor,
        proposedPaymentStreamCid: params.proposedPaymentStreamCid,
      },
    },
  };
}
