import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import { relTimeToDAML } from '../../../utils/typeConversions';
import type { PaymentContext } from '../utils/paymentContext';

export interface ProcessPaymentParams {
  paymentStreamContractId: string;
  processingPeriod: string; // RelTime as string (microseconds)
  paymentContext: PaymentContext;
  skipProcessorPayment?: boolean;
  activityMarkerFeaturedAppRightCid?: string;
}

export function buildProcessPaymentCommand(params: ProcessPaymentParams): CommandWithDisclosedContracts {
  const choiceArguments = {
    processingPeriod: relTimeToDAML(params.processingPeriod),
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
      featuredAppRight: params.paymentContext.featuredAppRight,
    },
    skipProcessorPayment: params.skipProcessorPayment ?? false,
    activityMarkerFeaturedAppRightCid: params.activityMarkerFeaturedAppRightCid ?? null,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_ProcessPayment',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
