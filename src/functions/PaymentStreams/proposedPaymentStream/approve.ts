import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface ProposedPaymentStreamApproveParams {
  proposedPaymentStreamContractId: string;
  actor: string;
}

export function buildProposedPaymentStreamApproveCommand(
  params: ProposedPaymentStreamApproveParams
): CommandWithDisclosedContracts {
  const choiceArgument = {
    actor: params.actor,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ProposedPaymentStream.ProposedPaymentStream.templateId,
      contractId: params.proposedPaymentStreamContractId,
      choice: 'ProposedPaymentStream_Approve',
      choiceArgument,
    },
  };

  return { command, disclosedContracts: [] };
}
