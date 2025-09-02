import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface CancelGrantParams {
  planSecurityGrantContractId: string;
  issuerParty: string;
  date: string; // YYYY-MM-DD
}

export interface CancelGrantResult {
  updateId: string;
  cancellationEventContractId: string;
}

/**
 * Cancel a plan security grant by exercising the CancelGrant choice on PlanSecurityGrant
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/cancellation/EquityCompensationCancellation.schema.json
 */
export async function cancelGrant(
  client: LedgerJsonApiClient,
  params: CancelGrantParams
): Promise<CancelGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.CancelGrant = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'CancelGrant',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityCancellation.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityCancellation not found');

  return { updateId: response.transactionTree.updateId, cancellationEventContractId: created.CreatedTreeEvent.value.contractId };
}
