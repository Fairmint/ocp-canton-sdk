import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import { submitObservedTransactionTree } from '../../../observability';
import type { AuthorizeIssuerParams, AuthorizeIssuerResult } from './types';

export type { AuthorizeIssuerParams, AuthorizeIssuerResult } from './types';

/**
 * Authorize an issuer using the OCP Factory contract
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters for authorizing an issuer
 * @returns Promise resolving to the result of the authorization
 */
export async function authorizeIssuer(
  client: LedgerJsonApiClient,
  params: AuthorizeIssuerParams
): Promise<AuthorizeIssuerResult> {
  if (
    params.factory !== undefined &&
    (typeof params.factory.contractId !== 'string' ||
      params.factory.contractId.trim().length === 0 ||
      typeof params.factory.templateId !== 'string' ||
      params.factory.templateId.trim().length === 0)
  ) {
    throw new OcpValidationError('factory', 'factory override must include non-empty contractId and templateId', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  let templateId: string;
  let contractId: string;

  if (params.factory !== undefined) {
    ({ templateId, contractId } = params.factory);
  } else {
    const network = client.getNetwork();
    const networkData = factoryContractIdData[network as keyof typeof factoryContractIdData] as
      | (typeof factoryContractIdData)[keyof typeof factoryContractIdData]
      | undefined;
    if (!networkData) {
      throw new OcpValidationError('network', `Unsupported network: ${network}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: network,
      });
    }
    ({ ocpFactoryContractId: contractId, templateId } = networkData);
  }

  // Create the choice arguments for AuthorizeIssuer
  const choiceArguments: Fairmint.OpenCapTable.OcpFactory.AuthorizeIssuer = {
    issuer: params.issuer,
  };

  // Submit the choice to the factory contract
  const response = await submitObservedTransactionTree(
    client,
    {
      commands: [
        {
          ExerciseCommand: {
            templateId,
            contractId,
            choice: 'AuthorizeIssuer',
            choiceArgument: choiceArguments,
          },
        },
      ],
    },
    params,
    { operation: 'authorizeIssuer', templateId, choice: 'AuthorizeIssuer' }
  );

  const issuerAuthorizationTemplateId = OCP_TEMPLATES.issuerAuthorization;
  const created = findCreatedEventByTemplateId(response, issuerAuthorizationTemplateId);
  if (!created) {
    throw new OcpContractError('Expected CreatedTreeEvent not found for IssuerAuthorization', {
      templateId: issuerAuthorizationTemplateId,
      choice: 'AuthorizeIssuer',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const issuerAuthorizationContractId = created.CreatedTreeEvent.value.contractId;
  const issuerAuthorizationContractEvents = await client.getEventsByContractId({
    contractId: issuerAuthorizationContractId,
  });

  if (!issuerAuthorizationContractEvents.created?.createdEvent.createdEventBlob) {
    throw new OcpContractError(
      'Invalid issuer authorization contract events response: missing created event or created event blob',
      {
        contractId: issuerAuthorizationContractId,
        code: OcpErrorCodes.RESULT_NOT_FOUND,
      }
    );
  }

  return {
    contractId: issuerAuthorizationContractId,
    updateId: response.transactionTree.updateId,
    createdEventBlob: issuerAuthorizationContractEvents.created.createdEvent.createdEventBlob,
    synchronizerId: response.transactionTree.synchronizerId,
    templateId: created.CreatedTreeEvent.value.templateId,
    response,
  };
}
