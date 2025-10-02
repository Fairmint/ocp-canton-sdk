import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { extractUpdateId } from '../../utils/typeConversions';

export interface WithdrawAuthorizationParams {
  issuerAuthorizationContractId: string;
  systemOperatorParty: string;
}

export interface WithdrawAuthorizationResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function withdrawAuthorization(
  client: LedgerJsonApiClient,
  params: WithdrawAuthorizationParams
): Promise<WithdrawAuthorizationResult> {
  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.systemOperatorParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId,
          contractId: params.issuerAuthorizationContractId,
          choice: 'WithdrawAuthorization',
          choiceArgument: {},
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  return {
    updateId: extractUpdateId(response),
    response,
  };
}
