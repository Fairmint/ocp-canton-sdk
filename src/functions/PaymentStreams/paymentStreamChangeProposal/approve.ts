import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface PaymentStreamChangeProposalApproveParams {
  changeProposalContractId: string;
  actor: string;
}

export function buildPaymentStreamChangeProposalApproveCommand(
  params: PaymentStreamChangeProposalApproveParams
): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.PaymentStreamChangeProposal.templateId,
      contractId: params.changeProposalContractId,
      choice: 'PaymentStreamChangeProposal_Approve',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };
}
