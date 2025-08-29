import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ReleaseGrantParams {
  planSecurityGrantContractId: string;
  issuerParty: string;
  date: string; // YYYY-MM-DD
}

export interface ReleaseGrantResult {
  updateId: string;
  releaseEventContractId: string;
}

export async function releaseGrant(
  client: LedgerJsonApiClient,
  params: ReleaseGrantParams
): Promise<ReleaseGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.ReleaseGrant = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'ReleaseGrant',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityRelease.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityRelease not found');

  return { updateId: response.transactionTree.updateId, releaseEventContractId: created.CreatedTreeEvent.value.contractId };
}
