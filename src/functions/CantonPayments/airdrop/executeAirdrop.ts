import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface AppRewardBeneficiary {
  beneficiary: string;
  weight: string | number;
}

export interface RecipientTransferSpec {
  recipient: string;
  numberOfTransfers: number;
  appRewardBeneficiaries: AppRewardBeneficiary[];
}

export interface ExecuteAirdropParams {
  airdropContractId: string;
  transferSpecs: RecipientTransferSpec[];
  initialAmuletInputs: string[];
  openMiningRoundCid: string;
  amountPerTransfer: string | number;
  amuletRules: string;
}

export function buildExecuteAirdropCommand(params: ExecuteAirdropParams): Command {
  const transferSpecs = params.transferSpecs.map((spec) => ({
    recipient: spec.recipient,
    numberOfTransfers: spec.numberOfTransfers,
    appRewardBeneficiaries: spec.appRewardBeneficiaries.map((b) => ({
      beneficiary: b.beneficiary,
      weight: typeof b.weight === 'number' ? b.weight.toString() : b.weight,
    })),
  }));

  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.Airdrop.Airdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'Airdrop_Execute',
      choiceArgument: {
        transferSpecs,
        initialAmuletInputs: params.initialAmuletInputs,
        openMiningRoundCid: params.openMiningRoundCid,
        amountPerTransfer:
          typeof params.amountPerTransfer === 'number' ? params.amountPerTransfer.toString() : params.amountPerTransfer,
        amuletRules: ['Some', params.amuletRules],
      },
    },
  };
}
