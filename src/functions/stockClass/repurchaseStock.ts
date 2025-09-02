import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { ContractId } from '@daml/types';

export interface RepurchaseStockParams {
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  issuerParty: string;
  stockPositionContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockPosition>;
  quantity: string | number;
  date: string; // YYYY-MM-DD
}

export interface RepurchaseStockResult {
  updateId: string;
  updatedStockClassContractId: string;
}

/**
 * Repurchase stock from a position
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export async function repurchaseStock(
  client: LedgerJsonApiClient,
  params: RepurchaseStockParams
): Promise<RepurchaseStockResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.RepurchaseStock = {
    position: params.stockPositionContractId,
    quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity,
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'RepurchaseStock',
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
