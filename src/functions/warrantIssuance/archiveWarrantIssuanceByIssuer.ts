import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ArchiveWarrantIssuanceByIssuerParams { contractId: string; issuerParty: string }
export interface ArchiveWarrantIssuanceByIssuerResult { updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

export async function archiveWarrantIssuanceByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveWarrantIssuanceByIssuerParams
): Promise<ArchiveWarrantIssuanceByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.WarrantIssuance.WarrantIssuance.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;
  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}


