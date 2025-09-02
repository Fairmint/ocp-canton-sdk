import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface StartVestingParams {
  planSecurityGrantContractId: string;
  issuerParty: string;
  vesting_condition_id: string;
  date: string; // YYYY-MM-DD
}

export interface StartVestingResult {
  updateId: string;
  vestingStartEventContractId: string;
}

export async function startVesting(
  client: LedgerJsonApiClient,
  params: StartVestingParams
): Promise<StartVestingResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.StartVesting = {
    vesting_condition_id: params.vesting_condition_id,
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityGrantContractId,
          choice: 'StartVesting',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityVestingStart.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityVestingStart not found');

  return { updateId: response.transactionTree.updateId, vestingStartEventContractId: created.CreatedTreeEvent.value.contractId };
}
