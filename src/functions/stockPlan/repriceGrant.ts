import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RepriceGrantParams {
  planSecurityContractId: ContractId<Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant>;
  issuerParty: string;
  newExercisePrice: { amount: string | number; currency: string };
  date: string; // YYYY-MM-DD
}

export interface RepriceGrantResult {
  updateId: string;
  repricingEventContractId: string;
}

/**
 * Reprice an equity compensation grant by adjusting its exercise price.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/repricing/EquityCompensationRepricing.schema.json
 */
export async function repriceGrant(
  client: LedgerJsonApiClient,
  params: RepriceGrantParams
): Promise<RepriceGrantResult> {
  const price: Fairmint.OpenCapTable.Types.OcfMonetary = {
    amount:
      typeof params.newExercisePrice.amount === 'number'
        ? params.newExercisePrice.amount.toString()
        : params.newExercisePrice.amount,
    currency: params.newExercisePrice.currency,
  } as any;

  const choiceArgs: Fairmint.OpenCapTable.StockPlan.Reprice = {
    new_exercise_price: price as any,
    date: `${params.date}T00:00:00.000Z`,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityContractId,
          choice: 'Reprice',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityRepricing.templateId
  ) as any;

  if (!created) throw new Error('PlanSecurityRepricing event not found');

  return { updateId: response.transactionTree.updateId, repricingEventContractId: created.CreatedTreeEvent.value.contractId };
}
