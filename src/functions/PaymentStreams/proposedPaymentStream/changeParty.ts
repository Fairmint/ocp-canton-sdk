import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export type PartyRole = 'Payer' | 'Recipient' | 'Processor';

export interface ProposedPaymentStreamChangePartyParams {
  proposedPaymentStreamContractId: string;
  partyType: PartyRole;
  oldParty: string;
  newParty: string;
}

export function buildProposedPaymentStreamChangePartyCommand(params: ProposedPaymentStreamChangePartyParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ProposedPaymentStream.ProposedPaymentStream.templateId,
      contractId: params.proposedPaymentStreamContractId,
      choice: 'ProposedPaymentStream_ChangeParty',
      choiceArgument: {
        partyType: params.partyType,
        oldParty: params.oldParty,
        newParty: params.newParty,
      },
    },
  };
}
