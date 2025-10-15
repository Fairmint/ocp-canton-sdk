import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';

export interface ProcessingContext {
  processingPeriod: string; // RelTime as string (microseconds)
  featuredAppRight?: string; // Optional FeaturedAppRight contract ID
}

export interface ProcessFreeTrialParams {
  subscriptionContractId: string;
  processingContext: ProcessingContext;
}

export function buildProcessFreeTrialCommand(params: ProcessFreeTrialParams): Command {
  const processingContext = {
    processingPeriod: relTimeToDAML(params.processingContext.processingPeriod),
    featuredAppRight: params.processingContext.featuredAppRight ?? null,
  };

  const choiceArguments = {
    processingContext,
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
