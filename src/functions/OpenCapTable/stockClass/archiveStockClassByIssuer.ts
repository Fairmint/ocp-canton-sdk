import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface ArchiveStockClassByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveStockClassByIssuerCommand(params: { contractId: string }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {},
    },
  };
}
