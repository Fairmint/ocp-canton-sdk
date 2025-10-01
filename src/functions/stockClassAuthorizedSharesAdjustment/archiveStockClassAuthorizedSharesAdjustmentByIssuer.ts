import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult { updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

export async function archiveStockClassAuthorizedSharesAdjustmentByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams
): Promise<ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


