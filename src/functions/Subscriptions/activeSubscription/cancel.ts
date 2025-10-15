import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { PaymentContext } from '../utils/paymentContext';

export interface CancelSubscriptionParams {
  subscriptionContractId: string;
  actor: string;
  disregardAvailablePaidPeriod?: boolean;
  description?: string;
  paymentContext: PaymentContext;
}

export function buildCancelSubscriptionCommand(params: CancelSubscriptionParams): Command {
  const choiceArgument: any = {
    actor: params.actor,
    disregardAvailablePaidPeriod: params.disregardAvailablePaidPeriod ?? false,
    description: params.description ?? null,
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
      featuredAppRight: params.paymentContext.featuredAppRight,
    },
  };

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_Cancel',
      choiceArgument,
    },
  };
}

