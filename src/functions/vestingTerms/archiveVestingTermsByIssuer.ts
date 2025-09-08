import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveVestingTermsByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveVestingTermsByIssuerResult {
  updateId: string;
}

export async function archiveVestingTermsByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveVestingTermsByIssuerParams
): Promise<ArchiveVestingTermsByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.VestingTerms.VestingTerms.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}

export function buildArchiveVestingTermsByIssuerCommand(params: { contractId: string; }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.VestingTerms.VestingTerms.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


