import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface SubscriberWithdrawParams {
  proposalContractId: string;
}

export function buildSubscriberWithdrawCommand(params: SubscriberWithdrawParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.SubscriptionProposal.SubscriptionProposal.templateId,
      contractId: params.proposalContractId,
      choice: 'SubscriptionProposal_SubscriberWithdraw',
      choiceArgument: {},
    },
  };
}

