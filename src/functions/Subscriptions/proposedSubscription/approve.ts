import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface ProposedSubscriptionApproveParams {
  proposedSubscriptionContractId: string;
  actor: string;
}

export function buildProposedSubscriptionApproveCommand(
  params: ProposedSubscriptionApproveParams
): CommandWithDisclosedContracts {
  const choiceArgument = {
    actor: params.actor,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ProposedSubscription.ProposedSubscription.templateId,
      contractId: params.proposedSubscriptionContractId,
      choice: 'ProposedSubscription_Approve',
      choiceArgument,
    },
  };

  return { command, disclosedContracts: [] };
}
