import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import { relTimeToDAML } from '../../../utils/typeConversions';
import type { PaymentContext } from '../utils/paymentContext';

export interface ProcessingContext {
  processingPeriod: string; // RelTime as string (microseconds)
  featuredAppRight?: string; // Optional FeaturedAppRight contract ID
}

export interface ProcessPaymentParams {
  subscriptionContractId: string;
  processingContext: ProcessingContext;
  paymentContext: PaymentContext;
  skipProcessorPayment?: boolean;
}

export function buildProcessPaymentCommand(params: ProcessPaymentParams): CommandWithDisclosedContracts {
  const processingContext = {
    processingPeriod: relTimeToDAML(params.processingContext.processingPeriod),
    featuredAppRight: params.processingContext.featuredAppRight ?? null,
  };

  const choiceArguments = {
    processingContext,
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
      featuredAppRight: params.paymentContext.featuredAppRight,
    },
    skipProcessorPayment: params.skipProcessorPayment ?? false,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ProcessPayment',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
