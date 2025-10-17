import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export type PartyRole = 'Payer' | 'Recipient' | 'Processor';

export interface ActivePaymentStreamChangePartyParams {
  paymentStreamContractId: string;
  partyType: PartyRole;
  oldParty: string;
  newParty: string;
}

export function buildActivePaymentStreamChangePartyCommand(params: ActivePaymentStreamChangePartyParams): Command {
  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_ChangeParty',
      choiceArgument: {
        partyType: params.partyType,
        oldParty: params.oldParty,
        newParty: params.newParty,
      },
    },
  };
}
