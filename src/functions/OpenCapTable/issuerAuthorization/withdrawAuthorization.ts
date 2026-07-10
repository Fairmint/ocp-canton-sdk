import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { submitObservedTransactionTree } from '../../../observability';
import type { WithdrawAuthorizationParams, WithdrawAuthorizationResult } from './types';

export type { WithdrawAuthorizationParams, WithdrawAuthorizationResult } from './types';

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
