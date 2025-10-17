import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';
import type { PaymentStreamAmountInput, PaymentStreamTimeInput } from '../paymentStreamFactory/createPaymentStreamProposal';

export interface PaymentStreamProposalChanges {
  payer?: string;
  recipient?: string;
  recipientProvider?: string;
  recipientBeneficiaries?: Array<{ party: string; weight: string }> | null;
  recipientPaymentPerDay?: PaymentStreamAmountInput;
  processorPaymentPerDay?: PaymentStreamAmountInput | null;
  paymentsEndAt?: PaymentStreamTimeInput | null;
  prepayWindow?: string | null; // RelTime as microseconds string
  freeTrialExpiration?: PaymentStreamTimeInput | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
  observers?: string[];
}

export interface EditPaymentStreamProposalParams {
  proposedPaymentStreamContractId: string;
  actor: string;
  changes: PaymentStreamProposalChanges;
  description?: string;
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

function changesToDaml(changes: PaymentStreamProposalChanges): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (changes.payer !== undefined) result.payer = changes.payer;
  if (changes.recipient !== undefined) result.recipient = changes.recipient;
  if (changes.recipientProvider !== undefined) result.recipientProvider = changes.recipientProvider;
  if (changes.recipientBeneficiaries !== undefined) result.recipientBeneficiaries = changes.recipientBeneficiaries;
  if (changes.recipientPaymentPerDay !== undefined)
    result.recipientPaymentPerDay = paymentStreamAmountToDaml(changes.recipientPaymentPerDay);
  if (changes.processorPaymentPerDay !== undefined)
    result.processorPaymentPerDay =
      changes.processorPaymentPerDay === null ? null : paymentStreamAmountToDaml(changes.processorPaymentPerDay);
  if (changes.paymentsEndAt !== undefined)
    result.paymentsEndAt = changes.paymentsEndAt === null ? null : paymentStreamTimeToDaml(changes.paymentsEndAt);
  if (changes.prepayWindow !== undefined)
    result.prepayWindow = changes.prepayWindow === null ? null : relTimeToDAML(changes.prepayWindow);
  if (changes.freeTrialExpiration !== undefined)
    result.freeTrialExpiration =
      changes.freeTrialExpiration === null ? null : paymentStreamTimeToDaml(changes.freeTrialExpiration);
  if (changes.description !== undefined) result.description = changes.description;
  if (changes.metadata !== undefined) result.metadata = changes.metadata;
  if (changes.observers !== undefined) result.observers = changes.observers;

  return result;
}

export function buildEditPaymentStreamProposalCommand(params: EditPaymentStreamProposalParams): Command {
  const choiceArgument = {
    actor: params.actor,
    changes: changesToDaml(params.changes),
    description: params.description ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ProposedPaymentStream.ProposedPaymentStream.templateId,
      contractId: params.proposedPaymentStreamContractId,
      choice: 'ProposedPaymentStream_EditPaymentStreamProposal',
      choiceArgument,
    },
  };
}
