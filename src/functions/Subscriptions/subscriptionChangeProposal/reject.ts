import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface SubscriptionChangeProposalRejectParams {
  changeProposalContractId: string;
  actor: string;
  description?: string;
}

export function buildSubscriptionChangeProposalRejectCommand(params: SubscriptionChangeProposalRejectParams): Command {
  const choiceArgument: any = {
    actor: params.actor,
  };

  if (params.description) {
    choiceArgument.description = params.description;
  }

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.SubscriptionChangeProposal.templateId,
      contractId: params.changeProposalContractId,
      choice: 'SubscriptionChangeProposal_Reject',
      choiceArgument,
    },
  };
}

