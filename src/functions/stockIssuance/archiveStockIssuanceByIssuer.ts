import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveStockIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveStockIssuanceByIssuerResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function archiveStockIssuanceByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockIssuanceByIssuerParams
): Promise<ArchiveStockIssuanceByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveStockIssuanceByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveStockIssuanceByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.StockIssuance.StockIssuance.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


