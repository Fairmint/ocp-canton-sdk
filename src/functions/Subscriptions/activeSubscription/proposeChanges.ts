import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';
import type { SubscriptionAmount, SubscriptionTime } from '../subscriptionFactory/createSubscriptionProposal';

export interface SubscriptionChanges {
  processedAndPaidUntilAdjustment?: string; // RelTime as microseconds string
  recipientProvider?: string;
  recipientBeneficiaries?: Array<{ party: string; weight: string }> | null;
  recipientPaymentPerDay?: SubscriptionAmount;
  processorPaymentPerDay?: SubscriptionAmount | null;
  prepayWindow?: string | null; // RelTime as microseconds string
  paymentsEndAt?: SubscriptionTime | null;
  trialEndsAt?: SubscriptionTime | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
  observers?: string[];
}

export interface ProposeChangesParams {
  subscriptionContractId: string;
  actor: string;
  subscriptionChanges: SubscriptionChanges;
  description?: string;
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

function changesToDaml(changes: SubscriptionChanges): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (changes.processedAndPaidUntilAdjustment !== undefined)
    result.processedAndPaidUntilAdjustment = relTimeToDAML(changes.processedAndPaidUntilAdjustment);
  if (changes.recipientProvider !== undefined) result.recipientProvider = changes.recipientProvider;
  if (changes.recipientBeneficiaries !== undefined)
    result.recipientBeneficiaries = changes.recipientBeneficiaries;
  if (changes.recipientPaymentPerDay !== undefined)
    result.recipientPaymentPerDay = subscriptionAmountToDaml(changes.recipientPaymentPerDay);
  if (changes.processorPaymentPerDay !== undefined)
    result.processorPaymentPerDay =
      changes.processorPaymentPerDay === null ? null : subscriptionAmountToDaml(changes.processorPaymentPerDay);
  if (changes.prepayWindow !== undefined)
    result.prepayWindow = changes.prepayWindow === null ? null : relTimeToDAML(changes.prepayWindow);
  if (changes.paymentsEndAt !== undefined)
    result.paymentsEndAt = changes.paymentsEndAt === null ? null : subscriptionTimeToDaml(changes.paymentsEndAt);
  if (changes.trialEndsAt !== undefined)
    result.trialEndsAt = changes.trialEndsAt === null ? null : subscriptionTimeToDaml(changes.trialEndsAt);
  if (changes.description !== undefined) result.description = changes.description;
  if (changes.metadata !== undefined) result.metadata = changes.metadata;
  if (changes.observers !== undefined) result.observers = changes.observers;

  return result;
}

export function buildProposeChangesCommand(params: ProposeChangesParams): Command {
  const choiceArgument: any = {
    actor: params.actor,
    subscriptionChanges: changesToDaml(params.subscriptionChanges),
  };

  if (params.description) {
    choiceArgument.description = params.description;
  }

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ProposeChanges',
      choiceArgument,
    },
  };
}

