import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RetractTransferParams {
  stockTransferProposalContractId: string;
  ownerParty: string;
  date: string; // YYYY-MM-DD
}

export interface RetractTransferResult {
  updateId: string;
}

/**
 * Retract a proposed stock transfer by exercising the RetractTransfer choice on a StockTransferProposal
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/retraction/StockRetraction.schema.json
 */
export async function retractTransfer(
  client: LedgerJsonApiClient,
  params: RetractTransferParams
): Promise<RetractTransferResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockClass.RetractTransfer = {
    date: `${params.date}T00:00:00.000Z`
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.ownerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockTransferProposal.templateId,
          contractId: params.stockTransferProposalContractId,
          choice: 'RetractTransfer',
          choiceArgument: choiceArgs
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}
