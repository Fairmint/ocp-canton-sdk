import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import { submitObservedTransactionTree } from '../../../observability';
import { inspectCallableDataProperty } from '../../../utils/exactObject';
import { snapshotFactoryCoordinates } from '../../../utils/factoryCoordinates';
import { snapshotCommandCarrier } from '../../../utils/observabilityConfig';
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
  const carrier = snapshotCommandCarrier(params, 'authorizeIssuer');
  const allowedKeys = new Set(['issuer', 'factory', 'logger', 'metrics', 'defaultContext', 'context']);
  for (const key of carrier.snapshot.keys) {
    if (!allowedKeys.has(key)) {
      throw new OcpValidationError(`authorizeIssuer.${key}`, `Unsupported authorizeIssuer parameter: ${key}`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: [...allowedKeys].join(' | '),
        receivedValue: key,
      });
    }
  }
  const issuer = carrier.snapshot.get('issuer');
  if (typeof issuer !== 'string' || issuer.trim() === '' || issuer !== issuer.trim()) {
    throw new OcpValidationError('authorizeIssuer.issuer', 'issuer must be a non-empty, whitespace-trimmed string.', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty, whitespace-trimmed string',
      receivedValue: issuer,
    });
  }
  if (carrier.snapshot.has('factory') && carrier.snapshot.get('factory') === undefined) {
    throw new OcpValidationError('authorizeIssuer.factory', 'factory must be omitted rather than set to undefined.', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'factory coordinates or omitted property',
    });
  }
  const factoryInput = carrier.snapshot.get('factory');
  const factory = snapshotFactoryCoordinates(factoryInput, 'authorizeIssuer.factory');
  for (const method of [
    ...(factory === undefined ? ['getNetwork'] : []),
    'submitAndWaitForTransactionTree',
    'getEventsByContractId',
  ]) {
    const inspection = inspectCallableDataProperty(client, method);
    if (!inspection.ok) {
      throw new OcpValidationError(`client.${method}`, `ledger client must expose a callable ${method} method.`, {
        code: inspection.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'callable data method',
        receivedValue: inspection.receivedValue,
        context: { reason: inspection.reason },
      });
    }
  }

  let templateId: string;
  let contractId: string;

  if (factory !== undefined) {
    ({ templateId, contractId } = factory);
  } else {
    let network: unknown;
    try {
      network = client.getNetwork();
    } catch (error) {
      throw new OcpValidationError('client.network', 'getNetwork() must complete successfully.', {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'supported Canton network',
        receivedValue: error,
      });
    }
    if (typeof network !== 'string') {
      throw new OcpValidationError('client.network', 'ledger client returned a non-string network.', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: network,
      });
    }
    const networkData = Object.prototype.hasOwnProperty.call(factoryContractIdData, network)
      ? (factoryContractIdData[network as keyof typeof factoryContractIdData] as
          | (typeof factoryContractIdData)[keyof typeof factoryContractIdData]
          | undefined)
      : undefined;
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
    issuer,
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
    carrier.observability,
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
