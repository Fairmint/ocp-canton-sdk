import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';

import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import { ledgerReadScope } from '../../../utils/readScope';
import { findUnsafeJsonIssue } from '../../../utils/safeJson';
import { assertTemplateIdentity, type ParsedTemplateIdentity } from '../../../utils/templateIdentity';

export interface LedgerCreatedEvent {
  contractId?: unknown;
  templateId?: unknown;
  packageName?: unknown;
  createArgument?: unknown;
}

export interface ValidatedLedgerCreatedEvent extends LedgerCreatedEvent {
  contractId: string;
}

export interface ContractEventsResponse {
  created?: {
    createdEvent?: LedgerCreatedEvent | null;
  } | null;
}

export interface SingleContractReadOptions {
  operation: string;
  expectedTemplateId?: string;
  missingDataError?: 'contract' | 'parse';
}

export interface SingleContractReadResult {
  contractId: string;
  createArgument: Record<string, unknown>;
  createdEvent: ValidatedLedgerCreatedEvent;
  templateId?: string;
  packageName?: string;
  templateIdentity?: ParsedTemplateIdentity;
}

function assertSafeLedgerResponse(
  value: unknown,
  contractId: string,
  operation?: string
): asserts value is ContractEventsResponse {
  const source = `contract ${contractId}.eventsResponse`;
  // Let the entity-specific reader classify explicit undefined fields while
  // retaining the descriptor-only proxy/accessor/cycle/bounds preflight here.
  const issue = findUnsafeJsonIssue(value, source, { allowUndefined: true });
  if (issue === undefined) return;
  const createArgumentPath = `${source}.created.createdEvent.createArgument`;
  const isCreateArgumentIssue =
    issue.path === createArgumentPath ||
    issue.path.startsWith(`${createArgumentPath}.`) ||
    issue.path.startsWith(`${createArgumentPath}[`);

  throw new OcpParseError(`Invalid contract events response: ${issue.message}`, {
    source: issue.path,
    code: isCreateArgumentIssue ? OcpErrorCodes.SCHEMA_MISMATCH : OcpErrorCodes.INVALID_RESPONSE,
    classification: isCreateArgumentIssue ? 'invalid_create_argument_json' : 'invalid_ledger_json',
    context: {
      contractId,
      operation,
      issueKind: issue.kind,
      receivedValue: issue.receivedValue,
    },
  });
}

export function extractCreateArgument(
  eventsResponse: ContractEventsResponse,
  contractId: string,
  diagnostics: { operation?: string } = {}
): unknown {
  assertSafeLedgerResponse(eventsResponse, contractId, diagnostics.operation);
  if (!eventsResponse.created?.createdEvent) {
    throw new OcpParseError('Invalid contract events response: missing created event', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'missing_created_event',
      context: {
        contractId,
        operation: diagnostics.operation,
      },
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;
  if (createArgument == null) {
    throw new OcpParseError('Invalid contract events response: missing create argument', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'missing_create_argument',
      context: {
        contractId,
        operation: diagnostics.operation,
      },
    });
  }

  return createArgument;
}

function requireCreateArgumentRecord(
  createArgument: unknown,
  contractId: string,
  diagnostics: { operation: string; templateId?: string }
): Record<string, unknown> {
  if (
    ((typeof createArgument === 'object' && createArgument !== null) || typeof createArgument === 'function') &&
    nodeUtilTypes.isProxy(createArgument)
  ) {
    throw new OcpParseError('Contract createArgument must not be a proxy', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_shape',
      context: {
        contractId,
        operation: diagnostics.operation,
        templateId: diagnostics.templateId,
        receivedValue: createArgument,
      },
    });
  }
  if (!createArgument || typeof createArgument !== 'object' || Array.isArray(createArgument)) {
    throw new OcpParseError('Contract createArgument must be an object', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_shape',
      context: {
        contractId,
        operation: diagnostics.operation,
        templateId: diagnostics.templateId,
        receivedType: Array.isArray(createArgument) ? 'array' : typeof createArgument,
      },
    });
  }

  return createArgument as Record<string, unknown>;
}

function missingContractDataError(
  mode: 'contract' | 'parse',
  message: string,
  contractId: string,
  diagnostics: { operation: string; classification: string }
): OcpContractError | OcpParseError {
  const context = {
    contractId,
    operation: diagnostics.operation,
  };

  return mode === 'contract'
    ? new OcpContractError(message, {
        contractId,
        code: OcpErrorCodes.RESULT_NOT_FOUND,
        classification: diagnostics.classification,
        context,
      })
    : new OcpParseError(message, {
        source: `contract ${contractId}`,
        code: OcpErrorCodes.INVALID_RESPONSE,
        classification: diagnostics.classification,
        context,
      });
}

function assertCorrelatedCreatedContractId(
  createdEvent: LedgerCreatedEvent,
  requestedContractId: string,
  operation: string
): asserts createdEvent is ValidatedLedgerCreatedEvent {
  const source = `contract ${requestedContractId}.eventsResponse.created.createdEvent.contractId`;
  if (!Object.prototype.hasOwnProperty.call(createdEvent, 'contractId')) {
    throw new OcpParseError('Invalid contract events response: missing created-event contract ID', {
      source,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'missing_created_contract_id',
      context: {
        contractId: requestedContractId,
        operation,
      },
    });
  }

  const createdContractId = createdEvent.contractId;
  if (typeof createdContractId !== 'string' || createdContractId.length === 0) {
    throw new OcpParseError('Invalid contract events response: created-event contract ID must be a non-empty string', {
      source,
      code: OcpErrorCodes.INVALID_RESPONSE,
      classification: 'invalid_created_contract_id',
      context: {
        contractId: requestedContractId,
        operation,
        receivedValue: createdContractId,
      },
    });
  }

  if (createdContractId !== requestedContractId) {
    throw new OcpContractError('Created-event contract ID does not match the requested contract', {
      contractId: requestedContractId,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'contract_id_mismatch',
      context: {
        operation,
        expectedContractId: requestedContractId,
        actualContractId: createdContractId,
      },
    });
  }
}

export async function readSingleContract(
  client: LedgerJsonApiClient,
  params: GetByContractIdParams,
  options: SingleContractReadOptions
): Promise<SingleContractReadResult> {
  const rawEventsResponse: unknown = await client.getEventsByContractId({
    contractId: params.contractId,
    ...ledgerReadScope(params),
  });
  assertSafeLedgerResponse(rawEventsResponse, params.contractId, options.operation);
  const eventsResponse = rawEventsResponse;

  const createdEvent = eventsResponse.created?.createdEvent;
  if (!createdEvent) {
    throw missingContractDataError(
      options.missingDataError ?? 'contract',
      'Invalid contract events response: missing created event',
      params.contractId,
      {
        operation: options.operation,
        classification: 'missing_created_event',
      }
    );
  }

  assertCorrelatedCreatedContractId(createdEvent, params.contractId, options.operation);

  if (createdEvent.createArgument == null) {
    throw missingContractDataError(
      options.missingDataError ?? 'contract',
      'Invalid contract events response: missing create argument',
      params.contractId,
      {
        operation: options.operation,
        classification: 'missing_create_argument',
      }
    );
  }

  const templateId = typeof createdEvent.templateId === 'string' ? createdEvent.templateId : undefined;
  const packageName = typeof createdEvent.packageName === 'string' ? createdEvent.packageName : undefined;
  const templateIdentity = options.expectedTemplateId
    ? assertTemplateIdentity(
        {
          ...(templateId !== undefined ? { templateId } : {}),
          ...(packageName !== undefined ? { packageName } : {}),
        },
        options.expectedTemplateId,
        {
          contractId: params.contractId,
          operation: options.operation,
          ...(templateId === undefined && packageName === undefined
            ? { message: 'Contract template identity is missing; cannot validate expected template' }
            : {}),
        }
      )
    : undefined;

  const createArgument = requireCreateArgumentRecord(createdEvent.createArgument, params.contractId, {
    operation: options.operation,
    ...(templateId !== undefined ? { templateId } : {}),
  });

  return {
    contractId: createdEvent.contractId,
    createArgument,
    createdEvent,
    ...(templateId !== undefined ? { templateId } : {}),
    ...(packageName !== undefined ? { packageName } : {}),
    ...(templateIdentity !== undefined ? { templateIdentity } : {}),
  };
}
