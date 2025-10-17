import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface ArchiveInactivePaymentStreamParams {
  paymentStreamContractId: string;
  actor: string;
}

export function buildArchiveInactivePaymentStreamCommand(params: ArchiveInactivePaymentStreamParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_ArchiveInactivePaymentStream',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };
}
