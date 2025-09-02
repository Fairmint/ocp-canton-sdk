import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ReissueStockParams {
  stockClassContractId: string;
  issuerParty: string;
  recipientParty: string;
  quantity: string | number;
  date: string; // YYYY-MM-DD
}

export interface ReissueStockResult {
  updateId: string;
  stockPositionContractId: string;
}

/**
 * Reissue previously repurchased shares into a stock position
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/reissuance/StockReissuance.schema.json
 */
export async function reissueStock(
  client: LedgerJsonApiClient,
  params: ReissueStockParams
): Promise<ReissueStockResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.ReissueStock = {
    transfer: {
      recipient: params.recipientParty,
      quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity
    } as any,
    date: `${params.date}T00:00:00.000Z`
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'ReissueStock',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockPosition.templateId
  ) as any;

  if (!created) throw new Error('StockPosition not found');

  return { updateId: response.transactionTree.updateId, stockPositionContractId: created.CreatedTreeEvent.value.contractId };
}
