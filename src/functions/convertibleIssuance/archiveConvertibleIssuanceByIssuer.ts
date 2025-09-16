import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ArchiveConvertibleIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveConvertibleIssuanceByIssuerResult {
  updateId: string;
}

export async function archiveConvertibleIssuanceByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveConvertibleIssuanceByIssuerParams
): Promise<ArchiveConvertibleIssuanceByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.ConvertibleIssuance.ConvertibleIssuance.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}


