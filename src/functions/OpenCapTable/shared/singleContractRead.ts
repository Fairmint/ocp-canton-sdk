import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import { ledgerReadScope } from '../../../utils/readScope';
import { assertTemplateIdentity, type ParsedTemplateIdentity } from '../../../utils/templateIdentity';

export interface LedgerCreatedEvent {
  contractId?: string;
  templateId?: unknown;
  packageName?: unknown;
  createArgument?: unknown;
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
  createdEvent: LedgerCreatedEvent;
  templateId?: string;
  packageName?: string;
  templateIdentity?: ParsedTemplateIdentity;
}

export function extractCreateArgument(
  eventsResponse: ContractEventsResponse,
  contractId: string,
  diagnostics: { operation?: string } = {}
): unknown {
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

  return createArgument as Record<string, unknown>;
}

function requireCreateArgumentRecord(
  createArgument: unknown,
  contractId: string,
  diagnostics: { operation: string; templateId?: string }
): Record<string, unknown> {
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

export async function readSingleContract(
  client: LedgerJsonApiClient,
  params: GetByContractIdParams,
  options: SingleContractReadOptions
): Promise<SingleContractReadResult> {
  const eventsResponse = (await client.getEventsByContractId({
    contractId: params.contractId,
    ...ledgerReadScope(params),
  })) as ContractEventsResponse;

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
          templateId,
          packageName,
        },
        options.expectedTemplateId,
        {
          contractId: params.contractId,
          operation: options.operation,
          message:
            templateId === undefined && packageName === undefined
              ? 'Contract template identity is missing; cannot validate expected template'
              : undefined,
        }
      )
    : undefined;

  const createArgument = requireCreateArgumentRecord(createdEvent.createArgument, params.contractId, {
    operation: options.operation,
    templateId,
  });

  return {
    contractId: params.contractId,
    createArgument,
    createdEvent,
    templateId,
    packageName,
    templateIdentity,
  };
}
