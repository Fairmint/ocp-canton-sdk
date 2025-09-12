import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveDocumentByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveDocumentByIssuerResult {
  updateId: string;
}

export async function archiveDocumentByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveDocumentByIssuerParams
): Promise<ArchiveDocumentByIssuerResult> {
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Document.Document.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  });
  return { updateId: (response as any).transactionTree.updateId };
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


