import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveDocumentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveDocumentByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Document.Document.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


