import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveStakeholderByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export interface ArchiveStakeholderByIssuerResult {
  updateId: string;
}

export async function archiveStakeholderByIssuer(
  client: LedgerJsonApiClient,
  params: ArchiveStakeholderByIssuerParams
): Promise<ArchiveStakeholderByIssuerResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId,
          contractId: params.contractId,
          choice: 'ArchiveByIssuer',
          choiceArgument: {}
        }
      }
    ]
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}

export function buildArchiveStakeholderByIssuerCommand(params: {
  contractId: string;
}): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Stakeholder.Stakeholder.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {}
    }
  };
}


