import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import type { PaymentContext } from '../utils/paymentContext';

export interface ReplaceLockedAmuletParams {
  paymentStreamContractId: string;
  newAmulets: string[];
  amountToLock: string; // Decimal as string
  paymentContext: PaymentContext;
}

export function buildReplaceLockedAmuletCommand(params: ReplaceLockedAmuletParams): CommandWithDisclosedContracts {
  const choiceArguments = {
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
      templateId: CantonPayments.PaymentStream.ActivePaymentStream.ActivePaymentStream.templateId,
      contractId: params.paymentStreamContractId,
      choice: 'ActivePaymentStream_ReplaceLockedAmulet',
      choiceArgument: choiceArguments,
    },
  };

  return { command, disclosedContracts: [] };
}
