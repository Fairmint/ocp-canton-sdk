import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { ContractId } from '@daml/types';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface IssueStockParams {
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  issuerParty: string;
  recipientParty: string;
  quantity: string | number;
}

export interface IssueStockResult {
  updateId: string;
  stockPositionContractId: string;
}

/**
 * Issue stock to a stakeholder by exercising the IssueStock choice on a StockClass contract
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/issuance/StockIssuance.schema.json
 */
export async function issueStock(
  client: LedgerJsonApiClient,
  params: IssueStockParams
): Promise<IssueStockResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.IssueStock = {
    transfer: {
      recipient: params.recipientParty,
      quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity
    } as any
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'IssueStock',
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
