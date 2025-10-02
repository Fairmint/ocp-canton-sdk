import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveStockPlanPoolAdjustmentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveStockPlanPoolAdjustmentByIssuerCommand(params: { contractId: string }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {},
    },
  };
}
