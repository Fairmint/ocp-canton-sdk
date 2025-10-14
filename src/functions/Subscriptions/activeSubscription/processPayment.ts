import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { relTimeToDAML } from '../../../utils/typeConversions';

export interface PaymentContext {
  amuletInputs: string[]; // ContractIds of Amulet.Amulet
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface ProcessingContext {
  processingPeriod: string; // RelTime as string (microseconds)
  processorProvider: string;
  recipientProvider?: string;
  recipientFeaturedAppRight?: string;
  processorFeaturedAppRight?: string;
  processorBeneficiaries: Array<{ party: string; weight: string }>;
}

export interface ProcessPaymentParams {
  subscriptionContractId: string;
  processingContext: ProcessingContext;
  paymentContext: PaymentContext;
  skipProcessorPayment?: boolean;
}

export function buildProcessPaymentCommand(params: ProcessPaymentParams): Command {
  const processingContext: any = {
    processingPeriod: relTimeToDAML(params.processingContext.processingPeriod),
    processorProvider: params.processingContext.processorProvider,
    processorBeneficiaries: params.processingContext.processorBeneficiaries,
  };

  if (params.processingContext.recipientProvider) {
    processingContext.recipientProvider = params.processingContext.recipientProvider;
  }
  if (params.processingContext.recipientFeaturedAppRight) {
    processingContext.recipientFeaturedAppRight = params.processingContext.recipientFeaturedAppRight;
  }
  if (params.processingContext.processorFeaturedAppRight) {
    processingContext.processorFeaturedAppRight = params.processingContext.processorFeaturedAppRight;
  }

  const choiceArguments: any = {
    processingContext,
    paymentContext: {
      amuletInputs: params.paymentContext.amuletInputs,
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
    },
    skipProcessorPayment: params.skipProcessorPayment ?? false,
  };

  return {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_ProcessPayment',
      choiceArgument: choiceArguments,
    },
  };
}
