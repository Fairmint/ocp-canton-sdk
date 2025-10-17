import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface PaymentStreamChangeProposalRejectParams {
  changeProposalContractId: string;
  actor: string;
  description?: string;
}

export function buildPaymentStreamChangeProposalRejectCommand(
  params: PaymentStreamChangeProposalRejectParams
): Command {
  const choiceArgument = {
    actor: params.actor,
    description: params.description ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.PaymentStreamChangeProposal.templateId,
      contractId: params.changeProposalContractId,
      choice: 'PaymentStreamChangeProposal_Reject',
      choiceArgument,
    },
  };
}
