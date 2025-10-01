import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveIssuerAuthorizedSharesAdjustmentByIssuerResult { updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

export async function archiveIssuerAuthorizedSharesAdjustmentByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams
): Promise<ArchiveIssuerAuthorizedSharesAdjustmentByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


