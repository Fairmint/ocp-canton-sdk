import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

export interface PaymentContext {
  amuletRulesCid: string;
  openMiningRoundCid: string;
}

export interface AddFundsParams {
  subscriptionContractId: string;
  actor: string;
  amuletInputs: string[];
  amountToLock: string; // Decimal as string
  description?: string;
  paymentContext: PaymentContext;
}

export function buildAddFundsCommand(params: AddFundsParams): CommandWithDisclosedContracts {
  const choiceArguments: any = {
    actor: params.actor,
    amuletInputs: params.amuletInputs,
    amountToLock: params.amountToLock,
    description: params.description ?? null,
    paymentContext: {
      amuletRulesCid: params.paymentContext.amuletRulesCid,
      openMiningRoundCid: params.paymentContext.openMiningRoundCid,
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ActiveSubscription.ActiveSubscription.templateId,
      contractId: params.subscriptionContractId,
      choice: 'ActiveSubscription_AddFunds',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}

