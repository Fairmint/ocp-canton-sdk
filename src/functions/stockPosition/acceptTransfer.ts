import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AcceptTransferParams {
  stockTransferProposalContractId: string;
  issuerParty: string;
  date: string; // YYYY-MM-DD
}

export interface AcceptTransferResult {
  updateId: string;
  stockPositionContractId: string;
}

/**
 * Accept a proposed stock transfer by exercising the AcceptTransfer choice on a StockTransferProposal
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/transfer/StockTransfer.schema.json
 */
export async function acceptTransfer(
  client: LedgerJsonApiClient,
  params: AcceptTransferParams
): Promise<AcceptTransferResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.AcceptTransfer = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockTransferProposal.templateId,
          contractId: params.stockTransferProposalContractId,
          choice: 'AcceptTransfer',
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
