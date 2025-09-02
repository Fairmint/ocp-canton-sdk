import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AdjustStockPlanPoolParams {
  stockPlanContractId: ContractId<Fairmint.OpenCapTable.StockPlan.StockPlan>;
  issuerParty: string;
  newReservedShares: string | number;
  date: string; // YYYY-MM-DD
}

export interface AdjustStockPlanPoolResult {
  updateId: string;
}

/**
 * Adjust a stock plan's reserved share pool size.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json
 * - new_reserved_shares: New total reserved shares in the plan pool
 * - date: Effective date (YYYY-MM-DD)
 */
export async function adjustStockPlanPool(
  client: LedgerJsonApiClient,
  params: AdjustStockPlanPoolParams
): Promise<AdjustStockPlanPoolResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.AdjustPool = {
    new_reserved_shares:
      typeof params.newReservedShares === 'number'
        ? params.newReservedShares.toString()
        : params.newReservedShares,
    date: `${params.date}T00:00:00.000Z`,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockPlan.StockPlan.templateId,
          contractId: params.stockPlanContractId,
          choice: 'AdjustPool',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}
