import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ArchiveStockCancellationByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveStockCancellationByIssuerResult { updateId: string }

export async function archiveStockCancellationByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockCancellationByIssuerParams
): Promise<ArchiveStockCancellationByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockCancellation.StockCancellation.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: response.transactionTree.updateId };
}


