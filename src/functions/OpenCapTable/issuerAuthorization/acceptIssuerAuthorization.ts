import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { submitObservedTransaction, type CommandObservabilityOptions } from '../../../observability';
import { moduleEntityOf } from '../../../register/templates';
import type { AcceptIssuerAuthorizationResult } from '../../../types/setup';
import { decodeGeneratedDaml, generatedCodec } from '../../../utils/generatedDamlValidation';
import { requireSetupParty } from '../factory/factoryIdentity';
import { requireExerciseResult } from '../shared/exerciseResult';

export type { AcceptIssuerAuthorizationResult } from '../../../types/setup';

const TA_ACCEPT_CHOICE = 'IssuerAuthorization_TaAccept';

export interface AcceptIssuerAuthorizationParams extends CommandObservabilityOptions {
  /** The authorization `authorizeIssuer` created. */
  authorizationContractId: string;
  /** The transfer agent the authorization pins: the transaction is submitted as this party. */
  transferAgent: string;
  /** Override when your ledger reports a different `IssuerAuthorization` template ID than the bundled default. */
  templateId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createdEventOf(events: unknown, contractId: string): Record<string, unknown> | undefined {
  if (!Array.isArray(events)) return undefined;
  for (const event of events as unknown[]) {
    if (isRecord(event) && isRecord(event.CreatedEvent) && event.CreatedEvent.contractId === contractId) {
      return event.CreatedEvent;
    }
  }
  return undefined;
}

/**
 * Step 2 of the cap table setup: the pinned transfer agent accepts the authorization, which recreates it signed by
 * `system_operator` and the transfer agent. Only then can the issuer's `IssuerAuthorization_CreateCapTable` use it.
 *
 * The result carries the recreated authorization with its created-event blob and synchronizer, which the issuer
 * discloses when it submits step 3 (`buildCreateCapTableCommand`).
 *
 * @throws OcpContractError when the transaction carries no result or the recreated authorization cannot be disclosed
 * @throws OcpParseError when the recreated authorization is not accepted or pins another transfer agent
 */
export async function acceptIssuerAuthorization(
  client: LedgerJsonApiClient,
  params: AcceptIssuerAuthorizationParams
): Promise<AcceptIssuerAuthorizationResult> {
  if (typeof params.authorizationContractId !== 'string' || params.authorizationContractId === '') {
    throw new OcpValidationError('authorizationContractId', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: params.authorizationContractId,
    });
  }
  requireSetupParty(params.transferAgent, 'transferAgent');

  const templateId = params.templateId ?? OCP_TEMPLATES.issuerAuthorization;
  const response = await submitObservedTransaction(
    client,
    {
      commands: [
        {
          ExerciseCommand: {
            templateId,
            contractId: params.authorizationContractId,
            choice: TA_ACCEPT_CHOICE,
            choiceArgument: {},
          },
        },
      ],
      actAs: [params.transferAgent],
    },
    params,
    { operation: 'acceptIssuerAuthorization', templateId, choice: TA_ACCEPT_CHOICE }
  );

  const source = `${TA_ACCEPT_CHOICE}.exerciseResult`;
  const recreatedContractId = requireExerciseResult(response, {
    templateId,
    choice: TA_ACCEPT_CHOICE,
    contractId: params.authorizationContractId,
  });
  if (typeof recreatedContractId !== 'string' || recreatedContractId === '') {
    throw new OcpParseError('The accepted authorization result must be a contract ID', {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: recreatedContractId },
    });
  }

  const created = createdEventOf(response.transaction.events, recreatedContractId);
  if (created === undefined || typeof created.templateId !== 'string') {
    throw new OcpContractError('Expected CreatedEvent not found for the accepted IssuerAuthorization', {
      contractId: recreatedContractId,
      templateId,
      choice: TA_ACCEPT_CHOICE,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  if (moduleEntityOf(created.templateId) !== moduleEntityOf(OCP_TEMPLATES.issuerAuthorization)) {
    throw new OcpParseError(`The accepted authorization has template ${created.templateId}`, {
      source: `${source}.templateId`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
    });
  }
  const authorization = decodeGeneratedDaml(
    created.createArgument,
    generatedCodec(Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization),
    `issuerAuthorization ${recreatedContractId}.createArgument`
  );
  if (!authorization.ta_accepted) {
    throw new OcpParseError('The recreated authorization is not accepted by the transfer agent', {
      source: `issuerAuthorization ${recreatedContractId}.createArgument.ta_accepted`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  if (authorization.context.transfer_agent !== params.transferAgent) {
    throw new OcpParseError('The authorization pins another transfer agent', {
      source: `issuerAuthorization ${recreatedContractId}.createArgument.context.transfer_agent`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: authorization.context.transfer_agent },
    });
  }

  let createdEventBlob = typeof created.createdEventBlob === 'string' ? created.createdEventBlob : '';
  if (createdEventBlob === '') {
    const events = await client.getEventsByContractId({
      contractId: recreatedContractId,
      readAs: [params.transferAgent],
    });
    createdEventBlob = events.created?.createdEvent.createdEventBlob ?? '';
  }
  const { synchronizerId } = response.transaction;
  if (createdEventBlob === '' || typeof synchronizerId !== 'string' || synchronizerId === '') {
    throw new OcpContractError(
      'The accepted authorization cannot be disclosed: no created event blob or synchronizer',
      {
        contractId: recreatedContractId,
        templateId,
        choice: TA_ACCEPT_CHOICE,
        code: OcpErrorCodes.RESULT_NOT_FOUND,
      }
    );
  }

  return {
    updateId: response.transaction.updateId,
    authorization: {
      contractId: recreatedContractId,
      templateId: created.templateId,
      createdEventBlob,
      synchronizerId,
      capTableId: authorization.context.cap_table_id,
      issuer: authorization.context.issuer,
      systemOperator: authorization.context.system_operator,
      transferAgent: authorization.context.transfer_agent,
    },
    response,
  };
}
