import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

/**
 * Adjust authorized shares for a stock class.
 *
 * Schema reference: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json
 * - new_authorized: New authorized shares amount (must be >= issued_shares and numeric for adjustable classes)
 * - date: Transaction date (YYYY-MM-DD)
 */
export interface AdjustAuthorizedSharesParams {
  stockClassContractId: string;
  issuerParty: string;
  newAuthorized: string | number;
  date: string; // YYYY-MM-DD
}

export interface AdjustAuthorizedSharesResult {
  updateId: string;
  updatedStockClassContractId: string;
}

export async function adjustAuthorizedShares(
  client: LedgerJsonApiClient,
  params: AdjustAuthorizedSharesParams
): Promise<AdjustAuthorizedSharesResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.AdjustAuthorizedShares = {
    new_authorized: typeof params.newAuthorized === 'number' ? params.newAuthorized.toString() : params.newAuthorized,
    date: `${params.date}T00:00:00.000Z`
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'AdjustAuthorizedShares',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockClass.templateId
  ) as any;

  if (!created) throw new Error('Updated StockClass not found');

  return { updateId: response.transactionTree.updateId, updatedStockClassContractId: created.CreatedTreeEvent.value.contractId };
}
