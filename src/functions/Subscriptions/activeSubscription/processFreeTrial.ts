import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';

export interface ProcessFreeTrialParams {
  subscriptionContractId: string;
  processingPeriod: string; // RelTime as string (microseconds)
  featuredAppRight?: string; // Optional FeaturedAppRight contract ID
}

export function buildProcessFreeTrialCommand(params: ProcessFreeTrialParams): Command {
  const choiceArguments = {
    processingPeriod: relTimeToDAML(params.processingPeriod),
    featuredAppRight: params.featuredAppRight ?? null,
  };

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ProcessFreeTrial',
      choiceArgument: choiceArguments,
    },
  };
}
