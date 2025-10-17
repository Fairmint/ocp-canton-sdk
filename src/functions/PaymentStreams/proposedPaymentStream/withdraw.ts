import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface ProposedPaymentStreamWithdrawParams {
  proposedPaymentStreamContractId: string;
  actor: string;
  description?: string;
}

export function buildProposedPaymentStreamWithdrawCommand(params: ProposedPaymentStreamWithdrawParams): Command {
  const choiceArgument = {
    actor: params.actor,
    description: params.description ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ProposedPaymentStream.ProposedPaymentStream.templateId,
      contractId: params.proposedPaymentStreamContractId,
      choice: 'ProposedPaymentStream_Withdraw',
      choiceArgument,
    },
  };
}
