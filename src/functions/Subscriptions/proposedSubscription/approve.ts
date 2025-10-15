import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface PaymentContextForApproval {
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface ProposedSubscriptionApproveParams {
  proposedSubscriptionContractId: string;
  actor: string;
  subscriberAmulets?: string[]; // Required for final approval
  amountToLock?: string; // Required for final approval (as Decimal string)
  paymentContext?: PaymentContextForApproval; // Required for final approval
}

export function buildProposedSubscriptionApproveCommand(
  params: ProposedSubscriptionApproveParams
): CommandWithDisclosedContracts {
  const choiceArgument: any = {
    actor: params.actor,
    subscriberAmulets: params.subscriberAmulets ?? [],
    amountToLock: params.amountToLock ?? '0.0',
    paymentContext: params.paymentContext ?? null,
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

