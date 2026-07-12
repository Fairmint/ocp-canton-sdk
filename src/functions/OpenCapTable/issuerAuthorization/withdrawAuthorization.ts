import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { submitObservedTransactionTree } from '../../../observability';
import { requiredCommandParameter, requiredContractId, requiredPartyId } from '../../../utils/commandParameters';
import { commandCarrierKeys, snapshotExactCommandCarrier } from '../../../utils/observabilityConfig';
import type { WithdrawAuthorizationParams, WithdrawAuthorizationResult } from './types';

export type { WithdrawAuthorizationParams, WithdrawAuthorizationResult } from './types';

const WITHDRAW_AUTHORIZATION_KEYS = commandCarrierKeys(['issuerAuthorizationContractId', 'systemOperatorParty']);

export async function withdrawAuthorization(
  client: LedgerJsonApiClient,
  params: WithdrawAuthorizationParams
): Promise<WithdrawAuthorizationResult> {
  const carrier = snapshotExactCommandCarrier(params, WITHDRAW_AUTHORIZATION_KEYS, 'withdrawAuthorization');
  const issuerAuthorizationContractId = requiredContractId(
    requiredCommandParameter(carrier.snapshot, 'issuerAuthorizationContractId', 'withdrawAuthorization'),
    'withdrawAuthorization.issuerAuthorizationContractId'
  );
  const systemOperatorParty = requiredPartyId(
    requiredCommandParameter(carrier.snapshot, 'systemOperatorParty', 'withdrawAuthorization'),
    'withdrawAuthorization.systemOperatorParty'
  );
  const issuerAuthorizationTemplateId = OCP_TEMPLATES.issuerAuthorization;
  const response = await submitObservedTransactionTree(
    client,
    {
      actAs: [systemOperatorParty],
      commands: [
        {
          ExerciseCommand: {
            templateId: issuerAuthorizationTemplateId,
            contractId: issuerAuthorizationContractId,
            choice: 'WithdrawAuthorization',
            choiceArgument: {},
          },
        },
      ],
    },
    carrier.observability,
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
