import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface SubscriptionAmount {
  type: 'AMULET' | 'USD';
  amount: string | number;
}

export interface PaymentConfig {
  amountPerDay: SubscriptionAmount;
  featuredAppRight?: string;
}

export interface SubscriptionConfig {
  subscriber: string;
  recipient: string;
  recipientPayment: PaymentConfig;
  processorPayment: PaymentConfig;
  expiresAt: Date;
  freeTrialEndsAt?: Date;
  reason?: string;
}

export interface CreateSubscriptionProposalParams {
  factoryContractId: string;
  config: SubscriptionConfig;
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

function paymentConfigToDaml(config: PaymentConfig): Record<string, unknown> {
  return {
    amountPerDay: subscriptionAmountToDaml(config.amountPerDay),
    featuredAppRight: config.featuredAppRight ?? null,
  };
}

function subscriptionConfigToDaml(config: SubscriptionConfig): Record<string, unknown> {
  return {
    subscriber: config.subscriber,
    recipient: config.recipient,
    recipientPayment: paymentConfigToDaml(config.recipientPayment),
    processorPayment: paymentConfigToDaml(config.processorPayment),
    expiresAt: config.expiresAt.toISOString(),
    freeTrialEndsAt: config.freeTrialEndsAt ? config.freeTrialEndsAt.toISOString() : null,
    reason: config.reason ?? null,
  };
}

export function buildCreateSubscriptionProposalCommand(
  params: CreateSubscriptionProposalParams
): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.Subscriptions.SubscriptionFactory.SubscriptionFactory_CreateProposal = {
    config: subscriptionConfigToDaml(params.config) as Fairmint.Subscriptions.SubscriptionConfig.SubscriptionConfig,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.SubscriptionFactory.SubscriptionFactory.templateId,
      contractId: params.factoryContractId,
      choice: 'SubscriptionFactory_CreateProposal',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
