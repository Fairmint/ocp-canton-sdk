import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';
import type { PaymentStreamAmountInput, PaymentStreamTimeInput } from '../paymentStreamFactory/createPaymentStreamProposal';

export interface PaymentStreamChanges {
  processedAndPaidUntilAdjustment?: string; // RelTime as microseconds string
  recipientProvider?: string;
  recipientBeneficiaries?: Array<{ party: string; weight: string }> | null;
  recipientPaymentPerDay?: PaymentStreamAmountInput;
  processorPaymentPerDay?: PaymentStreamAmountInput | null;
  prepayWindow?: string | null; // RelTime as microseconds string
  paymentsEndAt?: PaymentStreamTimeInput | null;
  trialEndsAt?: PaymentStreamTimeInput | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
  observers?: string[];
}

export interface ProposeChangesParams {
  paymentStreamContractId: string;
  actor: string;
  paymentStreamChanges: PaymentStreamChanges;
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

function changesToDaml(changes: PaymentStreamChanges): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (changes.processedAndPaidUntilAdjustment !== undefined)
    result.processedAndPaidUntilAdjustment = relTimeToDAML(changes.processedAndPaidUntilAdjustment);
  if (changes.recipientProvider !== undefined) result.recipientProvider = changes.recipientProvider;
  if (changes.recipientBeneficiaries !== undefined) result.recipientBeneficiaries = changes.recipientBeneficiaries;
  if (changes.recipientPaymentPerDay !== undefined)
    result.recipientPaymentPerDay = paymentStreamAmountToDaml(changes.recipientPaymentPerDay);
  if (changes.processorPaymentPerDay !== undefined)
    result.processorPaymentPerDay =
      changes.processorPaymentPerDay === null ? null : paymentStreamAmountToDaml(changes.processorPaymentPerDay);
  if (changes.prepayWindow !== undefined)
    result.prepayWindow = changes.prepayWindow === null ? null : relTimeToDAML(changes.prepayWindow);
  if (changes.paymentsEndAt !== undefined)
    result.paymentsEndAt = changes.paymentsEndAt === null ? null : paymentStreamTimeToDaml(changes.paymentsEndAt);
  if (changes.trialEndsAt !== undefined)
    result.trialEndsAt = changes.trialEndsAt === null ? null : paymentStreamTimeToDaml(changes.trialEndsAt);
  if (changes.description !== undefined) result.description = changes.description;
  if (changes.metadata !== undefined) result.metadata = changes.metadata;
  if (changes.observers !== undefined) result.observers = changes.observers;

  return result;
}

export function buildProposeChangesCommand(params: ProposeChangesParams): Command {
  const choiceArgument = {
    actor: params.actor,
    paymentStreamChanges: changesToDaml(params.paymentStreamChanges),
    description: params.description ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_ProposeChanges',
      choiceArgument,
    },
  };
}
