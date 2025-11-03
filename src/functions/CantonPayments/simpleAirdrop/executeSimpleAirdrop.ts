import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CantonPayments } from '@fairmint/open-captable-protocol-daml-js';

export interface RecipientSpec {
  transferPreapprovalCid: string;
  numberOfTransfers: number;
}

export interface ExecuteSimpleAirdropParams {
  airdropContractId: string;
  recipientSpecs: RecipientSpec[];
  initialAmuletInputs: string[];
  openMiningRoundCid: string;
  amountPerTransfer: string | number;
}

export function buildExecuteSimpleAirdropCommand(params: ExecuteSimpleAirdropParams): Command {
  const recipientSpecs = params.recipientSpecs.map((spec) => ({
    transferPreapprovalCid: spec.transferPreapprovalCid,
    numberOfTransfers: spec.numberOfTransfers,
  }));

  return {
    ExerciseCommand: {
      templateId: CantonPayments.Airdrop.SimpleAirdrop.SimpleAirdrop.templateId,
      contractId: params.airdropContractId,
      choice: 'SimpleAirdrop_Execute',
      choiceArgument: {
        recipientSpecs,
        initialAmuletInputs: params.initialAmuletInputs,
        openMiningRoundCid: params.openMiningRoundCid,
        amountPerTransfer:
          typeof params.amountPerTransfer === 'number' ? params.amountPerTransfer.toString() : params.amountPerTransfer,
      },
    },
  };
}

