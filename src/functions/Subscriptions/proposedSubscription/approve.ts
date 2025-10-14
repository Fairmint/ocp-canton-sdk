import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ProposedSubscriptionApproveParams {
  proposedSubscriptionContractId: string;
  actor: string;
}

export function buildProposedSubscriptionApproveCommand(params: ProposedSubscriptionApproveParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ProposedSubscription.ProposedSubscription.templateId,
      contractId: params.proposedSubscriptionContractId,
      choice: 'ProposedSubscription_Approve',
      choiceArgument: {
        actor: params.actor,
      },
    },
  };
}

