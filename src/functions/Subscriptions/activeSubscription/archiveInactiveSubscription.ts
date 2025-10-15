import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ArchiveInactiveSubscriptionParams {
  subscriptionContractId: string;
  actor: string;
}

export function buildArchiveInactiveSubscriptionCommand(params: ArchiveInactiveSubscriptionParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ArchiveInactiveSubscription',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };
}
