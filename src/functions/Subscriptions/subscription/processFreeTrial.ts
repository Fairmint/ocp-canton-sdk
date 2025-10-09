import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';

export interface ProcessFreeTrialParams {
  subscriptionContractId: string;
  processingPeriod: string; // RelTime as string (microseconds)
}

export function buildProcessFreeTrialCommand(params: ProcessFreeTrialParams): Command {
  const choiceArguments: Fairmint.Subscriptions.Subscription.Subscription_ProcessFreeTrial = {
    processingPeriod: relTimeToDAML(
      params.processingPeriod
    ) as Fairmint.Subscriptions.Subscription.Subscription_ProcessFreeTrial['processingPeriod'],
  };

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.Subscription.Subscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'Subscription_ProcessFreeTrial',
      choiceArgument: choiceArguments,
    },
  };
}
