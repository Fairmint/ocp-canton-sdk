import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult { updateId: string }

export async function archiveStockClassAuthorizedSharesAdjustmentByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams
): Promise<ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: response.transactionTree.updateId };
}


