import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import { relTimeToDAML } from '../../../utils/typeConversions';

/** Input format for paymentStream amounts (before DAML conversion) */
export interface PaymentStreamAmountInput {
  type: 'AMULET' | 'USD';
  amount: string | number;
}

/** Input format for paymentStream time values (before DAML conversion) */
export interface PaymentStreamTimeInput {
  type: 'PRECISE' | 'RELATIVE';
  value: Date | string; // Date for precise, microseconds string for relative
}

/** Input format for creating a paymentStream proposal */
export interface PaymentStreamProposalInput {
  payer: string;
  recipient: string;
  provider: string;
  appRewardBeneficiaries?: Array<{ beneficiary: string; weight: string }>;
  freeTrialExpiration?: PaymentStreamTimeInput;
  recipientPaymentPerDay: PaymentStreamAmountInput;
  processorPaymentPerDay?: PaymentStreamAmountInput | null;
  prepayWindow: string; // RelTime as microseconds string, e.g. '0' for no prepay window, '604800000000' for 7 days
  paymentsEndAt?: PaymentStreamTimeInput;
  description?: string;
  metadata?: Record<string, string>;
  observers?: string[];
}

export interface CreateProposedPaymentStreamParams {
  factoryContractId: string;
  actor: string;
  paymentStreamProposal: PaymentStreamProposalInput;
}

function paymentStreamAmountToDaml(amount: PaymentStreamAmountInput): Record<string, unknown> {
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

function paymentStreamTimeToDaml(time: PaymentStreamTimeInput): Record<string, unknown> {
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

function paymentStreamProposalToDaml(proposal: PaymentStreamProposalInput): Record<string, unknown> {
  const result: Record<string, unknown> = {
    payer: proposal.payer,
    recipient: proposal.recipient,
    provider: proposal.provider,
    recipientPaymentPerDay: paymentStreamAmountToDaml(proposal.recipientPaymentPerDay),
    prepayWindow: relTimeToDAML(proposal.prepayWindow), // Always required, convert to DAML format
    appRewardBeneficiaries: proposal.appRewardBeneficiaries ?? [],
    observers: proposal.observers ?? [],
  };

  if (proposal.processorPaymentPerDay) {
    result.processorPaymentPerDay = paymentStreamAmountToDaml(proposal.processorPaymentPerDay);
  }
  if (proposal.paymentsEndAt) {
    result.paymentsEndAt = paymentStreamTimeToDaml(proposal.paymentsEndAt);
  }
  if (proposal.freeTrialExpiration) {
    result.freeTrialExpiration = paymentStreamTimeToDaml(proposal.freeTrialExpiration);
  }
  if (proposal.description) {
    result.description = proposal.description;
  }
  if (proposal.metadata) {
    result.metadata = proposal.metadata;
  }

  return result;
}

export function buildCreateProposedPaymentStreamCommand(
  params: CreateProposedPaymentStreamParams
): CommandWithDisclosedContracts {
  const choiceArguments = {
    actor: params.actor,
    paymentStreamProposal: paymentStreamProposalToDaml(params.paymentStreamProposal),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.PaymentStreamFactory.PaymentStreamFactory.templateId,
      contractId: params.factoryContractId,
      choice: 'PaymentStreamFactory_CreateProposedPaymentStream',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
