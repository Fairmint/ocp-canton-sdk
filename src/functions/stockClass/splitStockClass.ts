import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface SplitStockClassParams {
  stockClassContractId: string;
  issuerParty: string;
  split_ratio: string | number;
  positionContractIds: string[];
  date: string; // YYYY-MM-DD
}

export interface SplitStockClassResult {
  updateId: string;
  newStockClassContractId: string;
}

export async function splitStockClass(
  client: LedgerJsonApiClient,
  params: SplitStockClassParams
): Promise<SplitStockClassResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.SplitStockClass = {
    split_ratio: typeof params.split_ratio === 'number' ? params.split_ratio.toString() : params.split_ratio,
    positions: params.positionContractIds,
    date: `${params.date}T00:00:00.000Z`
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'SplitStockClass',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockClass.templateId
  ) as any;

  if (!created) throw new Error('New StockClass not found');

  return { updateId: response.transactionTree.updateId, newStockClassContractId: created.CreatedTreeEvent.value.contractId };
}
