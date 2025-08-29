import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ProposeTransferParams {
  stockPositionContractId: string;
  ownerParty: string;
  recipientParty: string;
  quantity: string | number;
}

export interface ProposeTransferResult {
  updateId: string;
  stockTransferProposalContractId: string;
}

export async function proposeTransfer(
  client: LedgerJsonApiClient,
  params: ProposeTransferParams
): Promise<ProposeTransferResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.ProposeTransfer = {
    transfer: {
      recipient: params.recipientParty,
      quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity
    } as any
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.ownerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockPosition.templateId,
          contractId: params.stockPositionContractId,
          choice: 'ProposeTransfer',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockTransferProposal.templateId
  ) as any;

  if (!created) throw new Error('StockTransferProposal not found');

  return { updateId: response.transactionTree.updateId, stockTransferProposalContractId: created.CreatedTreeEvent.value.contractId };
}
