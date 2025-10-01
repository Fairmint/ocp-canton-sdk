import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveEquityCompensationIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveEquityCompensationIssuanceByIssuerResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function archiveEquityCompensationIssuanceByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveEquityCompensationIssuanceByIssuerParams
): Promise<ArchiveEquityCompensationIssuanceByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [buildArchiveEquityCompensationIssuanceByIssuerCommand({ contractId: params.contractId })]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildArchiveEquityCompensationIssuanceByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}

