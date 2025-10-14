import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export type PartyRole = 'Subscriber' | 'Recipient' | 'Processor';

export interface ActiveSubscriptionChangePartyParams {
  subscriptionContractId: string;
  partyType: PartyRole;
  oldParty: string;
  newParty: string;
}

export function buildActiveSubscriptionChangePartyCommand(params: ActiveSubscriptionChangePartyParams): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ChangeParty',
      choiceArgument: {
        partyType: params.partyType,
        oldParty: params.oldParty,
        newParty: params.newParty,
      },
    },
  };
}

