import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { PaymentContext } from '../utils/paymentContext';

export interface WithdrawFundsParams {
  subscriptionContractId: string;
  amountToKeepLocked: string; // Decimal as string
  paymentContext: PaymentContext;
}

export function buildWithdrawFundsCommand(params: WithdrawFundsParams): CommandWithDisclosedContracts {
  const choiceArguments = {
    amountToKeepLocked: params.amountToKeepLocked,
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
      featuredAppRight: params.paymentContext.featuredAppRight,
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_WithdrawFunds',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
