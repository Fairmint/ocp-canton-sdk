import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { PaymentContext } from '../utils/paymentContext';

export interface RefundPaymentStreamParams {
  paymentStreamContractId: string;
  paymentContext: PaymentContext;
  recipientAmuletInputs: string[]; // ContractIds of Amulet.Amulet
  recipientFeaturedAppRight?: string | null;
}

export function buildRefundPaymentStreamCommand(params: RefundPaymentStreamParams): Command {
  const choiceArgument = {
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
      featuredAppRight: params.paymentContext.featuredAppRight,
    },
    recipientAmuletInputs: params.recipientAmuletInputs,
    recipientFeaturedAppRight: params.recipientFeaturedAppRight ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_Refund',
      choiceArgument,
    },
  };
}
