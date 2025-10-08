import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ProcessorApprovedRecipientRejectParams {
  approvedProposalContractId: string;
}

export function buildProcessorApprovedRecipientRejectCommand(params: ProcessorApprovedRecipientRejectParams): Command {
  return {
    ExerciseCommand: {
      templateId:
        Fairmint.Subscriptions.ProcessorApprovedSubscriptionProposal.ProcessorApprovedSubscriptionProposal.templateId,
      contractId: params.approvedProposalContractId,
      choice: 'ProcessorApprovedSubscriptionProposal_RecipientReject',
      choiceArgument: {},
    },
  };
}

