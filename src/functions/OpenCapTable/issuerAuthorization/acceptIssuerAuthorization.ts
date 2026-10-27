import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { submitObservedTransaction, type CommandObservabilityOptions } from '../../../observability';
import { parseCreatedEvent } from '../../../register/admissionRules';
import { moduleEntityOf, OPEN_CAP_TABLE_PACKAGE_NAME } from '../../../register/templates';
import type { AcceptIssuerAuthorizationResult } from '../../../types/setup';
import { decodeGeneratedDaml, generatedCodec } from '../../../utils/generatedDamlValidation';
import { requireSetupParty, validateFactoryId } from '../factory/factoryIdentity';
import { requireExerciseResult } from '../shared/exerciseResult';

export type { AcceptIssuerAuthorizationResult } from '../../../types/setup';

const TA_ACCEPT_CHOICE = 'IssuerAuthorization_TaAccept';

/**
 * The cap table the transfer agent consents to sign. Anyone can create an `OcpFactory` with themselves as
 * `system_operator` and pin a real transfer agent, so the transfer agent accepts only an authorization of the
 * published `system_operator` and factory, for the issuer it expects.
 */
export interface ExpectedIssuerAuthorization {
  /** The issuer the authorization must name */
  issuer: string;
  /** The `system_operator` that must have created the authorization: its only signatory */
  systemOperator: string;
  /** The factory whose counter must have issued its cap table ID (`<factoryId>-<n>`) */
  factoryId: string;
  /** The cap table ID it must name, when the caller knows it (`authorizeIssuer`'s `capTableId`) */
  capTableId?: string;
}

export interface AcceptIssuerAuthorizationParams extends CommandObservabilityOptions {
  /** The authorization `authorizeIssuer` created. */
  authorizationContractId: string;
  /** The transfer agent the authorization pins: the transaction is submitted as this party. */
  transferAgent: string;
  /** What the authorization must say, checked on the ledger's copy before the transfer agent signs anything */
  expected: ExpectedIssuerAuthorization;
  /** Override when your ledger reports a different `IssuerAuthorization` template ID than the bundled default. */
  templateId?: string;
}

/**
 * `setup.acceptAuthorization`'s parameters: the client's factory identity gives the expected `system_operator` and
 * factory.
 */
export type AcceptAuthorizationParams = Omit<AcceptIssuerAuthorizationParams, 'expected'> & {
  expected: Omit<ExpectedIssuerAuthorization, 'systemOperator' | 'factoryId'>;
};

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

function validateExpected(expected: unknown): asserts expected is ExpectedIssuerAuthorization {
  if (!isRecord(expected)) {
    throw new OcpValidationError(
      'expected',
      'Give the issuer, system_operator and factory the authorization must name',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: expected }
    );
  }
  requireSetupParty(expected.issuer, 'expected.issuer');
  requireSetupParty(expected.systemOperator, 'expected.systemOperator');
  validateFactoryId(expected.factoryId, 'expected.factoryId');
  if (expected.capTableId !== undefined && (typeof expected.capTableId !== 'string' || expected.capTableId === '')) {
    throw new OcpValidationError('expected.capTableId', 'The cap table ID, when given, must be a non-empty string', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: expected.capTableId,
    });
  }
}

/** Whether a cap table ID is one the factory's counter issues: `<factoryId>-<n>`, `n` from 1. */
function issuedByFactory(capTableId: string, factoryId: string): boolean {
  const prefix = `${factoryId}-`;
  return capTableId.startsWith(prefix) && /^[1-9][0-9]*$/.test(capTableId.slice(prefix.length));
}

/**
 * Read the authorization as the transfer agent and refuse it unless it is an active, not yet accepted
 * `OpenCapTable-v35` `IssuerAuthorization` signed by the expected `system_operator` alone, naming the expected issuer,
 * this transfer agent and a cap table ID of the expected factory.
 */
async function requireExpectedAuthorization(
  client: LedgerJsonApiClient,
  params: AcceptIssuerAuthorizationParams,
  templateId: string
): Promise<void> {
  const { authorizationContractId: contractId, transferAgent, expected } = params;
  const refuse = (message: string, context: Record<string, unknown> = {}): never => {
    throw new OcpContractError(`The transfer agent does not accept authorization ${contractId}: ${message}`, {
      contractId,
      templateId,
      choice: TA_ACCEPT_CHOICE,
      code: OcpErrorCodes.AUTHORIZATION_FAILED,
      classification: 'unexpected_issuer_authorization',
      context,
    });
  };
  const events = await client.getEventsByContractId({ contractId, readAs: [transferAgent] });
  // The ledger may report an active contract's archival as absent or as null
  const { archived, created }: { archived?: unknown; created?: { createdEvent?: unknown } | null } = events;
  if (archived !== undefined && archived !== null) refuse('it is no longer active');
  const parsed = parseCreatedEvent(created?.createdEvent);
  if (!parsed.ok) return refuse(`its created event cannot be read (${parsed.message})`);
  const event = parsed.value;
  if (event.packageName !== OPEN_CAP_TABLE_PACKAGE_NAME) {
    refuse(`its package is ${event.packageName ?? '(none)'}, not ${OPEN_CAP_TABLE_PACKAGE_NAME}`);
  }
  if (moduleEntityOf(event.templateId) !== moduleEntityOf(OCP_TEMPLATES.issuerAuthorization)) {
    refuse(`its template is ${event.templateId}`);
  }
  const authorization = decodeGeneratedDaml(
    event.createArgument,
    generatedCodec(Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization),
    `issuerAuthorization ${contractId}.createArgument`
  );
  if (authorization.ta_accepted) refuse('the transfer agent has accepted it already');
  if (event.signatories.length !== 1 || event.signatories[0] !== expected.systemOperator) {
    refuse(`its signatories are [${event.signatories.join(', ')}], not the expected system_operator alone`, {
      signatories: event.signatories,
      expectedSystemOperator: expected.systemOperator,
    });
  }
  const { context } = authorization;
  const mismatch = (field: string, received: string, wanted: string): void => {
    if (received !== wanted)
      refuse(`its ${field} is ${received}, not ${wanted}`, { field, received, expected: wanted });
  };
  mismatch('system_operator', context.system_operator, expected.systemOperator);
  mismatch('issuer', context.issuer, expected.issuer);
  mismatch('transfer_agent', context.transfer_agent, transferAgent);
  if (expected.capTableId !== undefined) mismatch('cap_table_id', context.cap_table_id, expected.capTableId);
  if (!issuedByFactory(context.cap_table_id, expected.factoryId)) {
    refuse(`its cap table ID ${context.cap_table_id} is not one factory ${expected.factoryId} issues`, {
      field: 'cap_table_id',
      received: context.cap_table_id,
      factoryId: expected.factoryId,
    });
  }
}

/**
 * Step 2 of the cap table setup: the pinned transfer agent accepts the authorization, which recreates it signed by
 * `system_operator` and the transfer agent. Only then can the issuer's `IssuerAuthorization_CreateCapTable` use it.
 *
 * Accepting is the transfer agent's consent to sign the cap table the authorization names, so before submitting
 * anything it reads the authorization and refuses one that is not exactly `expected`: another `system_operator`'s
 * (a factory anyone can create), another issuer's, or a cap table ID outside the factory's.
 *
 * The result carries the recreated authorization with its created-event blob and synchronizer, which the issuer
 * discloses when it submits step 3 (`buildCreateCapTableCommand`).
 *
 * @throws OcpContractError `AUTHORIZATION_FAILED` before anything is submitted when the authorization is not the one
 * expected, is no longer active or is accepted already; when the transaction carries no result or the recreated
 * authorization cannot be disclosed
 * @throws OcpParseError when the authorization does not decode, or the recreated authorization is not accepted or pins
 * another transfer agent
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
  validateExpected(params.expected);

  const templateId = params.templateId ?? OCP_TEMPLATES.issuerAuthorization;
  await requireExpectedAuthorization(client, params, templateId);
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
