import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface CancelBySubscriberParams {
  subscriptionContractId: string;
}

export function buildCancelBySubscriberCommand(params: CancelBySubscriberParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.Subscription.Subscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'Subscription_CancelBySubscriber',
      choiceArgument: {},
    },
  };
}

