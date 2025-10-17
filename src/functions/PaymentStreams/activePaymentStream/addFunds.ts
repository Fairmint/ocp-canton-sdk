import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { LockFundsInput } from '../types/lockFundsInput';

export interface AddFundsParams {
  paymentStreamContractId: string;
  actor: string;
  lockFundsInput: LockFundsInput;
  description?: string;
}

export function buildAddFundsCommand(params: AddFundsParams): CommandWithDisclosedContracts {
  const choiceArguments = {
    actor: params.actor,
    lockFundsInput: {
      amuletInputs: params.lockFundsInput.amuletInputs,
      amountToLock: params.lockFundsInput.amountToLock,
      paymentContext: {
        amuletRulesCid: params.lockFundsInput.paymentContext.amuletRulesCid,
        openMiningRoundCid: params.lockFundsInput.paymentContext.openMiningRoundCid,
        featuredAppRight: params.lockFundsInput.paymentContext.featuredAppRight,
      },
    },
    description: params.description ?? null,
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_AddFunds',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
