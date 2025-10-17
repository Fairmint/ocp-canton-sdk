import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface CancelPaymentStreamParams {
  paymentStreamContractId: string;
  actor: string;
  disregardAvailablePaidPeriod?: boolean;
  description?: string;
  openMiningRoundCid?: string;
}

export function buildCancelPaymentStreamCommand(params: CancelPaymentStreamParams): Command {
  const choiceArgument = {
    actor: params.actor,
    disregardAvailablePaidPeriod: params.disregardAvailablePaidPeriod ?? false,
    description: params.description ?? null,
    openMiningRoundCid: params.openMiningRoundCid ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_Cancel',
      choiceArgument,
    },
  };
}
