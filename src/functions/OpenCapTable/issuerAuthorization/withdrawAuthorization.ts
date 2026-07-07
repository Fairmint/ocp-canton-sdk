import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { submitObservedTransactionTree, type CommandObservabilityOptions } from '../../../observability';
import { OCP_TEMPLATES } from '../../../openCapTablePackage';

export interface WithdrawAuthorizationParams extends CommandObservabilityOptions {
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
  const response = await submitObservedTransactionTree(
    client,
    {
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
    },
    params,
    {
      operation: 'withdrawAuthorization',
      templateId: issuerAuthorizationTemplateId,
      choice: 'WithdrawAuthorization',
    }
  );

  return {
    updateId: response.transactionTree.updateId,
    response,
  };
}
