import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveStockLegendTemplateByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveStockLegendTemplateByIssuerResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function archiveStockLegendTemplateByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStockLegendTemplateByIssuerParams
): Promise<ArchiveStockLegendTemplateByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveStockLegendTemplateByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveStockLegendTemplateByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.StockLegendTemplate.StockLegendTemplate.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


