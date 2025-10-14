import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ProposedSubscriptionWithdrawParams {
  proposedSubscriptionContractId: string;
  actor: string;
  description?: string;
}

export function buildProposedSubscriptionWithdrawCommand(params: ProposedSubscriptionWithdrawParams): Command {
  const choiceArgument: any = {
    actor: params.actor,
  };

  if (params.description) {
    choiceArgument.description = params.description;
  }

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ProposedSubscription.ProposedSubscription.templateId,
      contractId: params.proposedSubscriptionContractId,
      choice: 'ProposedSubscription_Withdraw',
      choiceArgument,
    },
  };
}

