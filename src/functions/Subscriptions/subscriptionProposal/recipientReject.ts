import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface RecipientRejectParams {
  proposalContractId: string;
}

export function buildRecipientRejectCommand(params: RecipientRejectParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.SubscriptionProposal.SubscriptionProposal.templateId,
      contractId: params.proposalContractId,
      choice: 'SubscriptionProposal_RecipientReject',
      choiceArgument: {},
    },
  };
}

