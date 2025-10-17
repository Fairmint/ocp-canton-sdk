import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { LockFundsInput } from '../types/lockFundsInput';

export interface ProposedPaymentStreamStartParams {
  proposedPaymentStreamContractId: string;
  lockFundsInput: LockFundsInput;
}

export function buildProposedPaymentStreamStartCommand(
  params: ProposedPaymentStreamStartParams
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
      templateId: CantonPayments.PaymentStream.ProposedPaymentStream.ProposedPaymentStream.templateId,
      contractId: params.proposedPaymentStreamContractId,
      choice: 'ProposedPaymentStream_StartPaymentStream',
      choiceArgument,
    },
  };

  return { command, disclosedContracts: [] };
}
