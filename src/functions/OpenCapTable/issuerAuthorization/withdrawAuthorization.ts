import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';

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
  const issuerAuthorizationTemplateId = OCP_TEMPLATES.issuerAuthorization;
  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.systemOperatorParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: issuerAuthorizationTemplateId,
          contractId: params.issuerAuthorizationContractId,
          choice: 'WithdrawAuthorization',
          choiceArgument: {},
        },
      },
    ],
  });

  return {
    updateId: response.transactionTree.updateId,
    response,
  };
}
