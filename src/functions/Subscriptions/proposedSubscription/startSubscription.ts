import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { LockFundsInput } from '../types/lockFundsInput';

export interface ProposedSubscriptionStartParams {
  proposedSubscriptionContractId: string;
  lockFundsInput: LockFundsInput;
}

export function buildProposedSubscriptionStartCommand(
  params: ProposedSubscriptionStartParams
): CommandWithDisclosedContracts {
  const choiceArgument = {
    lockFundsInput: {
      amuletInputs: params.lockFundsInput.amuletInputs,
      amountToLock: params.lockFundsInput.amountToLock,
      paymentContext: {
        amuletRulesCid: params.lockFundsInput.paymentContext.amuletRulesCid,
        openMiningRoundCid: params.lockFundsInput.paymentContext.openMiningRoundCid,
        featuredAppRight: params.lockFundsInput.paymentContext.featuredAppRight,
      },
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.Subscriptions.ProposedSubscription.ProposedSubscription.templateId,
      contractId: params.proposedSubscriptionContractId,
      choice: 'ProposedSubscription_StartSubscription',
      choiceArgument,
    },
  };

  return { command, disclosedContracts: [] };
}

