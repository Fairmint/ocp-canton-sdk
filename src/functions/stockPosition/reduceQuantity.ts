import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ReduceQuantityParams {
  stockPositionContractId: string;
  issuerParty: string;
  amount: string | number;
}

export interface ReduceQuantityResult {
  updateId: string;
  updatedStockPositionContractId: string;
}

export async function reduceQuantity(
  client: LedgerJsonApiClient,
  params: ReduceQuantityParams
): Promise<ReduceQuantityResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.ReduceQuantity = {
    amount: typeof params.amount === 'number' ? params.amount.toString() : params.amount
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockPosition.templateId,
          contractId: params.stockPositionContractId,
          choice: 'ReduceQuantity',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockPosition.templateId
  ) as any;

  if (!created) throw new Error('Updated StockPosition not found');

  return { updateId: response.transactionTree.updateId, updatedStockPositionContractId: created.CreatedTreeEvent.value.contractId };
}
