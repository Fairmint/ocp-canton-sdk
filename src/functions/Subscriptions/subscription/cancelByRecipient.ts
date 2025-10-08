import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface CancelByRecipientParams {
  subscriptionContractId: string;
}

export function buildCancelByRecipientCommand(params: CancelByRecipientParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.Subscription.Subscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'Subscription_CancelByRecipient',
      choiceArgument: {},
    },
  };
}

