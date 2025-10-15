import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface SubscriptionChangeProposalApplyParams {
  changeProposalContractId: string;
  actor: string;
  activeSubscriptionCid: string;
}

export function buildSubscriptionChangeProposalApplyCommand(params: SubscriptionChangeProposalApplyParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.SubscriptionChangeProposal.templateId,
      contractId: params.changeProposalContractId,
      choice: 'SubscriptionChangeProposal_Apply',
      choiceArgument: {
        actor: params.actor,
        activeSubscriptionCid: params.activeSubscriptionCid,
      },
    },
  };
}
