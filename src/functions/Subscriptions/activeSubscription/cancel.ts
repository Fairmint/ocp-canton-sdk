import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface CancelSubscriptionParams {
  subscriptionContractId: string;
  actor: string;
  disregardAvailablePaidPeriod?: boolean;
  description?: string;
}

export function buildCancelSubscriptionCommand(params: CancelSubscriptionParams): Command {
  const choiceArgument: any = {
    actor: params.actor,
    disregardAvailablePaidPeriod: params.disregardAvailablePaidPeriod ?? false,
  };

  if (params.description) {
    choiceArgument.description = params.description;
  }

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_Cancel',
      choiceArgument,
    },
  };
}

