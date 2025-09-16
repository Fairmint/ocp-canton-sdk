import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ArchiveStockPlanPoolAdjustmentByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveStockPlanPoolAdjustmentByIssuerResult { updateId: string }

export async function archiveStockPlanPoolAdjustmentByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockPlanPoolAdjustmentByIssuerParams
): Promise<ArchiveStockPlanPoolAdjustmentByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: response.transactionTree.updateId };
}


