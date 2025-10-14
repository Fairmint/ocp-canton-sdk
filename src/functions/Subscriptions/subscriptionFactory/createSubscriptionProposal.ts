import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface SubscriptionAmount {
  type: 'AMULET' | 'USD';
  amount: string | number;
}

export interface SubscriptionTime {
  type: 'PRECISE' | 'RELATIVE';
  value: Date | string; // Date for precise, microseconds string for relative
}

export interface SubscriptionProposal {
  subscriber: string;
  recipient: string;
  recipientProvider?: string;
  recipientBeneficiaries?: Array<{ party: string; weight: string }>;
  freeTrialExpiration?: SubscriptionTime;
  recipientPaymentPerDay: SubscriptionAmount;
  processorPaymentPerDay?: SubscriptionAmount;
  prepayWindow?: string; // RelTime as microseconds string
  paymentsEndAt?: SubscriptionTime;
  description?: string;
  metadata?: Record<string, string>;
  observers?: string[];
}

export interface CreateProposedSubscriptionParams {
  factoryContractId: string;
  actor: string;
  subscriptionProposal: SubscriptionProposal;
}

function subscriptionAmountToDaml(amount: SubscriptionAmount): Record<string, unknown> {
  const amountValue = typeof amount.amount === 'number' ? amount.amount.toString() : amount.amount;

  if (amount.type === 'AMULET') {
    return {
      tag: 'AmuletAmount',
      value: amountValue,
    };
  }
  return {
    tag: 'USDAmount',
    value: amountValue,
  };
}

function subscriptionTimeToDaml(time: SubscriptionTime): Record<string, unknown> {
  if (time.type === 'PRECISE') {
    return {
      tag: 'PreciseTime',
      value: (time.value as Date).toISOString(),
    };
  }
  return {
    tag: 'RelativeTime',
    value: time.value as string,
  };
}

function subscriptionProposalToDaml(proposal: SubscriptionProposal): Record<string, unknown> {
  const result: Record<string, unknown> = {
    subscriber: proposal.subscriber,
    recipient: proposal.recipient,
    recipientPaymentPerDay: subscriptionAmountToDaml(proposal.recipientPaymentPerDay),
    observers: proposal.observers ?? [],
  };

  if (proposal.recipientProvider) {
    result.recipientProvider = proposal.recipientProvider;
  }
  if (proposal.recipientBeneficiaries) {
    result.recipientBeneficiaries = proposal.recipientBeneficiaries;
  }
  if (proposal.processorPaymentPerDay) {
    result.processorPaymentPerDay = subscriptionAmountToDaml(proposal.processorPaymentPerDay);
  }
  if (proposal.prepayWindow) {
    result.prepayWindow = proposal.prepayWindow;
  }
  if (proposal.paymentsEndAt) {
    result.paymentsEndAt = subscriptionTimeToDaml(proposal.paymentsEndAt);
  }
  if (proposal.freeTrialExpiration) {
    result.freeTrialExpiration = subscriptionTimeToDaml(proposal.freeTrialExpiration);
  }
  if (proposal.description) {
    result.description = proposal.description;
  }
  if (proposal.metadata) {
    result.metadata = proposal.metadata;
  }

  return result;
}

export function buildCreateProposedSubscriptionCommand(
  params: CreateProposedSubscriptionParams
): CommandWithDisclosedContracts {
  const choiceArguments: any = {
    actor: params.actor,
    subscriptionProposal: subscriptionProposalToDaml(params.subscriptionProposal),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.SubscriptionFactory.SubscriptionFactory.templateId,
      contractId: params.factoryContractId,
      choice: 'SubscriptionFactory_CreateProposedSubscription',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
