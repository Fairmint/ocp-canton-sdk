import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface MigrateActivePaymentStreamParams {
  migrationProposalContractId: string;
  actor: string;
  activePaymentStreamCid: string;
}

export function buildMigrateActivePaymentStreamCommand(params: MigrateActivePaymentStreamParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.PartyMigrationProposal.PartyMigrationProposal.templateId,
      contractId: params.migrationProposalContractId,
      choice: 'PartyMigrationProposal_MigrateActivePaymentStream',
      choiceArgument: {
        actor: params.actor,
        activePaymentStreamCid: params.activePaymentStreamCid,
      },
    },
  };
}
