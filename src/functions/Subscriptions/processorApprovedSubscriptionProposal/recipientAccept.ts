import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ProcessorApprovedRecipientAcceptParams {
  approvedProposalContractId: string;
}

export function buildProcessorApprovedRecipientAcceptCommand(params: ProcessorApprovedRecipientAcceptParams): Command {
  return {
    ExerciseCommand: {
      templateId:
        Fairmint.Subscriptions.ProcessorApprovedSubscriptionProposal.ProcessorApprovedSubscriptionProposal.templateId,
      contractId: params.approvedProposalContractId,
      choice: 'ProcessorApprovedSubscriptionProposal_RecipientAccept',
      choiceArgument: {},
    },
  };
}
