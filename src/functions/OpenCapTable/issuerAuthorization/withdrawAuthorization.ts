import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { submitObservedTransaction, type CommandObservabilityOptions } from '../../../observability';
import type { WithdrawAuthorizationResult } from '../../../types/setup';
import { requireSetupParty } from '../factory/factoryIdentity';

export type { WithdrawAuthorizationResult } from '../../../types/setup';

const WITHDRAW_CHOICE = 'IssuerAuthorization_Withdraw';

export interface WithdrawAuthorizationParams extends CommandObservabilityOptions {
  /** The authorization to withdraw, accepted by the transfer agent or not. */
  authorizationContractId: string;
  /** The authorization's `system_operator`: the transaction is submitted as this party. */
  systemOperator: string;
  /** Override when your ledger reports a different `IssuerAuthorization` template ID than the bundled default. */
  templateId?: string;
}

/**
 * Withdraw an issuer authorization before the issuer uses it. `system_operator` is the choice's only controller.
 * The authorization is archived; the factory's counter does not go back, so the cap table ID it carried is not reused.
 */
export async function withdrawAuthorization(
  client: LedgerJsonApiClient,
  params: WithdrawAuthorizationParams
): Promise<WithdrawAuthorizationResult> {
  if (typeof params.authorizationContractId !== 'string' || params.authorizationContractId === '') {
    throw new OcpValidationError('authorizationContractId', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: params.authorizationContractId,
    });
  }
  requireSetupParty(params.systemOperator, 'systemOperator');

  const templateId = params.templateId ?? OCP_TEMPLATES.issuerAuthorization;
  const response = await submitObservedTransaction(
    client,
    {
      commands: [
        {
          ExerciseCommand: {
            templateId,
            contractId: params.authorizationContractId,
            choice: WITHDRAW_CHOICE,
            choiceArgument: {},
          },
        },
      ],
      actAs: [params.systemOperator],
    },
    params,
    { operation: 'withdrawAuthorization', templateId, choice: WITHDRAW_CHOICE }
  );

  return { updateId: response.transaction.updateId, response };
}
