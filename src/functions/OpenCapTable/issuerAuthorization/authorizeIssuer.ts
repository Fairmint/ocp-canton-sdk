import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';
import { findCreatedEventByTemplateId } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';

export interface AuthorizeIssuerParams {
  issuer: string; // Party ID of the issuer to authorize
  /** Override: factory contract ID (e.g. for staging). Requires factoryTemplateId. */
  factoryContractId?: string;
  /** Override: factory template ID (e.g. for staging). Required when factoryContractId is set. */
  factoryTemplateId?: string;
}

export interface AuthorizeIssuerResult extends DisclosedContract {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
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
  if (params.factoryTemplateId != null && params.factoryContractId == null) {
    throw new OcpValidationError(
      'factoryContractId',
      'factoryContractId is required when factoryTemplateId is provided',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  if (params.factoryContractId != null && params.factoryTemplateId == null) {
    throw new OcpValidationError('factoryTemplateId', 'factoryTemplateId is required when factoryContractId is set', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  let templateId: string;
  let contractId: string;

  if (params.factoryContractId != null && params.factoryTemplateId != null) {
    templateId = params.factoryTemplateId;
    contractId = params.factoryContractId;
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
  const response = (await client.submitAndWaitForTransactionTree({
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
  })) as SubmitAndWaitForTransactionTreeResponse;

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
