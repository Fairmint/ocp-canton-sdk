import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RetractGrantParams {
  planSecurityGrantContractId: string;
  stakeholderParty: string;
  date: string; // YYYY-MM-DD
}

export interface RetractGrantResult {
  updateId: string;
  retractionEventContractId: string;
}

/**
 * Retract a plan security grant by exercising the RetractGrant choice on PlanSecurityGrant
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/retraction/EquityCompensationRetraction.schema.json
 */
export async function retractGrant(
  client: LedgerJsonApiClient,
  params: RetractGrantParams
): Promise<RetractGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.RetractGrant = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.stakeholderParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'RetractGrant',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityRetraction.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityRetraction not found');

  return { updateId: response.transactionTree.updateId, retractionEventContractId: created.CreatedTreeEvent.value.contractId };
}
