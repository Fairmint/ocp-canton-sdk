import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params: {
  contractId: string;
}): Command {
  return {
    ExerciseCommand: {
      templateId:
        Fairmint.OpenCapTable.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment
          .templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {},
    },
  };
}
