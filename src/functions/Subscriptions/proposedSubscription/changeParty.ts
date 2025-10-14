import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export type PartyRole = 'Subscriber' | 'Recipient' | 'Processor';

export interface ProposedSubscriptionChangePartyParams {
  proposedSubscriptionContractId: string;
  partyType: PartyRole;
  oldParty: string;
  newParty: string;
}

export function buildProposedSubscriptionChangePartyCommand(params: ProposedSubscriptionChangePartyParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ProposedSubscription.ProposedSubscription.templateId,
      contractId: params.proposedSubscriptionContractId,
      choice: 'ProposedSubscription_ChangeParty',
      choiceArgument: {
        partyType: params.partyType,
        oldParty: params.oldParty,
        newParty: params.newParty,
      },
    },
  };
}

