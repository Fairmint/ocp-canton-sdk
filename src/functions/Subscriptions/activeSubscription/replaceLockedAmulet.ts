import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { PaymentContext } from '../utils/paymentContext';

export interface ReplaceLockedAmuletParams {
  subscriptionContractId: string;
  newAmulets: string[];
  amountToLock: string; // Decimal as string
  paymentContext: PaymentContext;
}

export function buildReplaceLockedAmuletCommand(params: ReplaceLockedAmuletParams): CommandWithDisclosedContracts {
  const choiceArguments: any = {
    newAmulets: params.newAmulets,
    amountToLock: params.amountToLock,
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
      choice: 'ActiveSubscription_ReplaceLockedAmulet',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}

