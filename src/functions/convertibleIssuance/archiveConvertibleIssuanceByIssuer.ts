import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveConvertibleIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveConvertibleIssuanceByIssuerResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function archiveConvertibleIssuanceByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveConvertibleIssuanceByIssuerParams
): Promise<ArchiveConvertibleIssuanceByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveConvertibleIssuanceByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveConvertibleIssuanceByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.ConvertibleIssuance.ConvertibleIssuance.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


