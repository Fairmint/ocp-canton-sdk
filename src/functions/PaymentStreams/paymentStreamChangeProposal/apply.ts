import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface PaymentStreamChangeProposalApplyParams {
  changeProposalContractId: string;
  actor: string;
  activePaymentStreamCid: string;
}

export function buildPaymentStreamChangeProposalApplyCommand(params: PaymentStreamChangeProposalApplyParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.PaymentStreamChangeProposal.templateId,
      contractId: params.changeProposalContractId,
      choice: 'PaymentStreamChangeProposal_Apply',
      choiceArgument: {
        actor: params.actor,
        activePaymentStreamCid: params.activePaymentStreamCid,
      },
    },
  };
}
