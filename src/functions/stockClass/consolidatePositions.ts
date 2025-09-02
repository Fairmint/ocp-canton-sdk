import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ConsolidatePositionsParams {
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  issuerParty: string;
  owner: string;
  positions: string[]; // ContractIds of StockPosition
  date: string; // YYYY-MM-DD
  reasonText?: string;
}

export interface ConsolidatePositionsResult {
  updateId: string;
  resultingPositionContractId: string;
}

/**
 * Consolidate multiple stock positions of the same owner into one.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/consolidation/StockConsolidation.schema.json
 */
export async function consolidatePositions(
  client: LedgerJsonApiClient,
  params: ConsolidatePositionsParams
): Promise<ConsolidatePositionsResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.ConsolidatePositions = {
    owner: params.owner,
    positions: params.positions as any,
    date: `${params.date}T00:00:00.000Z`,
    reason_text: params.reasonText ? { tag: 'Some', value: params.reasonText } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'ConsolidatePositions',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockPosition.templateId
  ) as any;

  if (!created) throw new Error('Resulting StockPosition not found');

  return { updateId: response.transactionTree.updateId, resultingPositionContractId: created.CreatedTreeEvent.value.contractId };
}
