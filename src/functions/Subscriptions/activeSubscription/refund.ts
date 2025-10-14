import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface PaymentContext {
  amuletInputs: string[]; // ContractIds of Amulet.Amulet
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface RefundSubscriptionParams {
  subscriptionContractId: string;
  paymentContext: PaymentContext;
  recipientFeaturedAppRight?: string;
}

export function buildRefundSubscriptionCommand(params: RefundSubscriptionParams): Command {
  const choiceArgument: any = {
    paymentContext: {
      amuletInputs: params.paymentContext.amuletInputs,
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
    },
  };

  if (params.recipientFeaturedAppRight) {
    choiceArgument.recipientFeaturedAppRight = params.recipientFeaturedAppRight;
  }

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_Refund',
      choiceArgument,
    },
  };
}

