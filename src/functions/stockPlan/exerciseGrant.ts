import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { ContractId } from '@daml/types';

export interface ExerciseGrantParams {
  planSecurityGrantContractId: string;
  issuerParty: string;
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  quantity: string | number;
  date: string; // YYYY-MM-DD
}

export interface ExerciseGrantResult {
  updateId: string;
  stockPositionContractId: string;
}

export async function exerciseGrant(
  client: LedgerJsonApiClient,
  params: ExerciseGrantParams
): Promise<ExerciseGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.ExerciseGrant = {
    stock_class: params.stockClassContractId,
    quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity,
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'ExerciseGrant',
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
