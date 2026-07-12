import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';
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

interface EnvelopeDiagnostics {
  readonly contractId: string;
  readonly operation?: string;
}

function isProxyValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && nodeUtilTypes.isProxy(value);
}

function envelopePropertyPath(parent: string, key: PropertyKey): string {
  if (typeof key === 'symbol') return `${parent}[symbol]`;
  const stringKey = String(key);
  const boundedKey = stringKey.length <= 128 ? stringKey : `${stringKey.slice(0, 128)}…[length=${stringKey.length}]`;
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(boundedKey)
    ? `${parent}.${boundedKey}`
    : `${parent}[${JSON.stringify(boundedKey)}]`;
}

function invalidEnvelopeShape(
  fieldPath: string,
  message: string,
  receivedValue: unknown,
  diagnostics: EnvelopeDiagnostics
): never {
  throw new OcpParseError(`Invalid contract events response at ${fieldPath}: ${message}`, {
    source: `contract ${diagnostics.contractId}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_contract_events_response_shape',
    context: {
      contractId: diagnostics.contractId,
      operation: diagnostics.operation,
      fieldPath,
      receivedValue,
    },
  });
}

function requireEnvelopeRecord(
  value: unknown,
  fieldPath: string,
  diagnostics: EnvelopeDiagnostics
): Record<string, unknown> {
  const proxy = isProxyValue(value);
  if (proxy) invalidEnvelopeShape(fieldPath, 'must not be a Proxy', value, diagnostics);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidEnvelopeShape(fieldPath, 'must be a plain object', value, diagnostics);
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== null && prototype !== Object.prototype) {
    invalidEnvelopeShape(fieldPath, 'must use Object.prototype or null', value, diagnostics);
  }
  for (const key of Reflect.ownKeys(value)) {
    const propertyPath = envelopePropertyPath(fieldPath, key);
    if (typeof key === 'symbol') {
      invalidEnvelopeShape(propertyPath, 'must not be a symbol property', value, diagnostics);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      invalidEnvelopeShape(propertyPath, 'must be an own data property', value, diagnostics);
    }
    if (!descriptor.enumerable) {
      invalidEnvelopeShape(propertyPath, 'must be enumerable', value, diagnostics);
    }
  }
  return value as Record<string, unknown>;
}

function ownEnvelopeField(record: object, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, field);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function preflightCreatedEvent(
  eventsResponse: unknown,
  diagnostics: EnvelopeDiagnostics
): Record<string, unknown> | undefined {
  const response = requireEnvelopeRecord(eventsResponse, 'response', diagnostics);
  const created = ownEnvelopeField(response, 'created');
  if (created === null || created === undefined) return undefined;
  const createdRecord = requireEnvelopeRecord(created, 'response.created', diagnostics);
  const createdEvent = ownEnvelopeField(createdRecord, 'createdEvent');
  if (createdEvent === null || createdEvent === undefined) return undefined;
  return requireEnvelopeRecord(createdEvent, 'response.created.createdEvent', diagnostics);
}

export function extractCreateArgument(
  eventsResponse: ContractEventsResponse,
  contractId: string,
  diagnostics: { operation?: string } = {}
): unknown {
  const createdEvent = preflightCreatedEvent(eventsResponse, {
    contractId,
    ...(diagnostics.operation === undefined ? {} : { operation: diagnostics.operation }),
  });
  if (createdEvent === undefined) {
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

  const createArgument = ownEnvelopeField(createdEvent, 'createArgument');
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
  const proxy =
    createArgument !== null &&
    (typeof createArgument === 'object' || typeof createArgument === 'function') &&
    nodeUtilTypes.isProxy(createArgument);
  const array = !proxy && Array.isArray(createArgument);
  if (proxy || !createArgument || typeof createArgument !== 'object' || array) {
    throw new OcpParseError('Contract createArgument must be an object', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_create_argument_shape',
      context: {
        contractId,
        operation: diagnostics.operation,
        templateId: diagnostics.templateId,
        receivedType: proxy ? 'proxy' : array ? 'array' : typeof createArgument,
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
  const pendingResponse: unknown = client.getEventsByContractId({
    contractId: params.contractId,
    ...ledgerReadScope(params),
  });
  const eventsResponse: unknown =
    isProxyValue(pendingResponse) || !nodeUtilTypes.isPromise(pendingResponse)
      ? pendingResponse
      : await pendingResponse;

  const createdEvent = preflightCreatedEvent(eventsResponse, {
    contractId: params.contractId,
    operation: options.operation,
  });
  if (createdEvent === undefined) {
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

  const rawCreateArgument = ownEnvelopeField(createdEvent, 'createArgument');
  if (rawCreateArgument === null || rawCreateArgument === undefined) {
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

  const rawTemplateId = ownEnvelopeField(createdEvent, 'templateId');
  const rawPackageName = ownEnvelopeField(createdEvent, 'packageName');
  const templateId = typeof rawTemplateId === 'string' ? rawTemplateId : undefined;
  const packageName = typeof rawPackageName === 'string' ? rawPackageName : undefined;
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

  const createArgument = requireCreateArgumentRecord(rawCreateArgument, params.contractId, {
    operation: options.operation,
    ...(templateId !== undefined ? { templateId } : {}),
  });

  return {
    contractId: params.contractId,
    createArgument,
    createdEvent,
    ...(templateId !== undefined ? { templateId } : {}),
    ...(packageName !== undefined ? { packageName } : {}),
    ...(templateIdentity !== undefined ? { templateIdentity } : {}),
  };
}
