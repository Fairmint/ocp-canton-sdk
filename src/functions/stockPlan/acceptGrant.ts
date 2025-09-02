import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AcceptGrantParams {
  planSecurityGrantContractId: string;
  stakeholderParty: string;
  date: string; // YYYY-MM-DD
}

export interface AcceptGrantResult {
  updateId: string;
  acceptanceEventContractId: string;
}

/**
 * Accept a plan security grant by exercising the AcceptGrant choice on PlanSecurityGrant
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/acceptance/EquityCompensationAcceptance.schema.json
 */
export async function acceptGrant(
  client: LedgerJsonApiClient,
  params: AcceptGrantParams
): Promise<AcceptGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.AcceptGrant = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.stakeholderParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'AcceptGrant',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityAcceptance.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityAcceptance not found');

  return { updateId: response.transactionTree.updateId, acceptanceEventContractId: created.CreatedTreeEvent.value.contractId };
}
