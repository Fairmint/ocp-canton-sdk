import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ExerciseWarrantParams {
  warrantContractId: string;
  issuerParty: string;
  quantity: string | number;
  date: string; // YYYY-MM-DD
}

export interface ExerciseWarrantResult {
  updateId: string;
  stockPositionContractId: string;
}

/**
 * Exercise a warrant by exercising the ExerciseWarrant choice on a Warrant contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/exercise/WarrantExercise.schema.json
 */
export async function exerciseWarrant(
  client: LedgerJsonApiClient,
  params: ExerciseWarrantParams
): Promise<ExerciseWarrantResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.ExerciseWarrant = {
    quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity,
    date: `${params.date}T00:00:00.000Z`
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Warrant.templateId,
          contractId: params.warrantContractId,
          choice: 'ExerciseWarrant',
          choiceArgument: choiceArguments
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
