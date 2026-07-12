import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import { submitObservedTransactionTree } from '../../../observability';
import { inspectCallableDataProperty } from '../../../utils/exactObject';
import { snapshotFactoryCoordinates } from '../../../utils/factoryCoordinates';
import { commandCarrierKeys, snapshotExactCommandCarrier } from '../../../utils/observabilityConfig';
import type { AuthorizeIssuerParams, AuthorizeIssuerResult } from './types';

export type { AuthorizeIssuerParams, AuthorizeIssuerResult } from './types';

const AUTHORIZE_ISSUER_KEYS = commandCarrierKeys(['issuer', 'factory']);
type LedgerClientMethodName = 'getNetwork' | 'submitAndWaitForTransactionTree' | 'getEventsByContractId';
type LedgerClientMethod<Name extends LedgerClientMethodName> = Extract<
  LedgerJsonApiClient[Name],
  (...args: never[]) => unknown
>;

function captureClientMethod<Name extends LedgerClientMethodName>(
  client: LedgerJsonApiClient,
  method: Name
): LedgerClientMethod<Name> {
  const inspection = inspectCallableDataProperty(client, method);
  if (!inspection.ok) {
    throw new OcpValidationError(`client.${method}`, `ledger client must expose a callable ${method} method.`, {
      code: inspection.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'callable data method',
      receivedValue: inspection.receivedValue,
      context: { reason: inspection.reason },
    });
  }
  return inspection.value as LedgerClientMethod<Name>;
}

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
  const carrier = snapshotExactCommandCarrier(params, AUTHORIZE_ISSUER_KEYS, 'authorizeIssuer');
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
  const submitAndWaitForTransactionTree = captureClientMethod(client, 'submitAndWaitForTransactionTree');
  const getEventsByContractId = captureClientMethod(client, 'getEventsByContractId');

  let templateId: string;
  let contractId: string;

  if (factory !== undefined) {
    ({ templateId, contractId } = factory);
  } else {
    const getNetwork = captureClientMethod(client, 'getNetwork');
    let network: unknown;
    try {
      network = Reflect.apply(getNetwork, client, []);
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
      throw new OcpValidationError('client.network', 'ledger client returned an unsupported network.', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: Object.keys(factoryContractIdData).join(' | '),
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
  const capturedSubmitClient: Pick<LedgerJsonApiClient, 'submitAndWaitForTransactionTree'> = Object.freeze({
    submitAndWaitForTransactionTree: async (submitParams) => {
      const response = await Reflect.apply(submitAndWaitForTransactionTree, client, [submitParams]);
      return response;
    },
  });
  const response = await submitObservedTransactionTree(
    capturedSubmitClient,
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
  const issuerAuthorizationContractEvents = await Reflect.apply(getEventsByContractId, client, [
    { contractId: issuerAuthorizationContractId },
  ]);

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
