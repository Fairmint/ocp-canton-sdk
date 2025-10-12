import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';

export interface PaymentContext {
  amuletInputs: string[]; // ContractIds of Amulet.Amulet
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface ProcessPaymentParams {
  subscriptionContractId: string;
  processingPeriod: string; // RelTime as string (microseconds)
  paymentCtx: PaymentContext;
}

export function buildProcessPaymentCommand(params: ProcessPaymentParams): Command {
  const choiceArguments: Fairmint.Subscriptions.Subscription.Subscription_ProcessPayment = {
    processingPeriod: relTimeToDAML(
      params.processingPeriod
    ) as Fairmint.Subscriptions.Subscription.Subscription_ProcessPayment['processingPeriod'],
    paymentCtx: {
      amuletInputs: params.paymentCtx
        .amuletInputs as Fairmint.Subscriptions.Subscription.Subscription_ProcessPayment['paymentCtx']['amuletInputs'],
      amuletRulesCid: params.paymentCtx
        .amuletRulesCid as Fairmint.Subscriptions.Subscription.Subscription_ProcessPayment['paymentCtx']['amuletRulesCid'],
      openMiningRoundCid: params.paymentCtx
        .openMiningRoundCid as Fairmint.Subscriptions.Subscription.Subscription_ProcessPayment['paymentCtx']['openMiningRoundCid'],
    },
  };

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.Subscription.Subscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'Subscription_ProcessPayment',
      choiceArgument: choiceArguments,
    },
  };
}
