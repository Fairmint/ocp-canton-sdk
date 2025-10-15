import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { PaymentContext } from '../utils/paymentContext';

export interface RefundSubscriptionParams {
  subscriptionContractId: string;
  paymentContext: PaymentContext;
  recipientAmuletInputs: string[]; // ContractIds of Amulet.Amulet
  recipientFeaturedAppRight?: string | null;
}

export function buildRefundSubscriptionCommand(params: RefundSubscriptionParams): Command {
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
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_Refund',
      choiceArgument,
    },
  };
}
