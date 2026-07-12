import { OcpErrorCodes, OcpValidationError } from '../errors';
import type { CommandContext, ReadonlyTraceContext } from '../observabilityTypes';
import { inspectExactObject, type ExactDataFailure, type ExactObjectSnapshot } from './exactObject';

const COMMAND_CONTEXT_KEYS = new Set(['workflowId', 'commandId', 'submissionId', 'traceContext']);
const TRACE_CONTEXT_KEYS = new Set(['traceId', 'spanId', 'parentSpanId', 'metadata']);

interface MutableCommandContext {
  workflowId?: string;
  commandId?: string;
  submissionId?: string;
  traceContext?: ReadonlyTraceContext;
}

interface MutableTraceContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  metadata?: Readonly<Record<string, string>>;
}

function failurePath(root: string, failure: ExactDataFailure): string {
  return typeof failure.key === 'string' ? `${root}.${failure.key}` : root;
}

function throwExactObjectFailure(root: string, subject: string, failure: ExactDataFailure): never {
  const keyDescription =
    failure.key === undefined
      ? ''
      : typeof failure.key === 'symbol'
        ? ` (${failure.key.description ?? 'symbol'})`
        : ` (${failure.key})`;
  throw new OcpValidationError(
    failurePath(root, failure),
    `${subject} must be an exact plain object containing own data properties only; rejected ${failure.reason}${keyDescription}.`,
    {
      code: failure.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'exact plain object with own data properties only',
      receivedValue: failure.receivedValue,
      context: { reason: failure.reason },
    }
  );
}

function optionalString(snapshot: ExactObjectSnapshot, key: string, root: string): string | undefined {
  if (!snapshot.has(key)) {
    return undefined;
  }
  const value = snapshot.get(key);
  if (typeof value !== 'string') {
    throw new OcpValidationError(`${root}.${key}`, `${key} must be a string when provided.`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string or omitted',
      receivedValue: value,
    });
  }
  return value;
}

function snapshotTraceMetadata(value: unknown, root: string): Readonly<Record<string, string>> {
  const inspection = inspectExactObject(value);
  if (!inspection.ok) {
    throwExactObjectFailure(root, 'trace metadata', inspection);
  }

  const metadata: Record<string, string> = {};
  for (const key of inspection.snapshot.keys) {
    const metadataValue = inspection.snapshot.get(key);
    if (typeof metadataValue !== 'string') {
      throw new OcpValidationError(`${root}.${key}`, 'trace metadata values must be strings.', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: metadataValue,
      });
    }
    Object.defineProperty(metadata, key, {
      value: metadataValue,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(metadata);
}

function snapshotTraceContext(value: unknown, root: string): ReadonlyTraceContext {
  const inspection = inspectExactObject(value, { allowedKeys: TRACE_CONTEXT_KEYS });
  if (!inspection.ok) {
    throwExactObjectFailure(root, 'trace context', inspection);
  }

  const traceContext: MutableTraceContext = {};
  const traceId = optionalString(inspection.snapshot, 'traceId', root);
  const spanId = optionalString(inspection.snapshot, 'spanId', root);
  const parentSpanId = optionalString(inspection.snapshot, 'parentSpanId', root);
  if (traceId !== undefined) traceContext.traceId = traceId;
  if (spanId !== undefined) traceContext.spanId = spanId;
  if (parentSpanId !== undefined) traceContext.parentSpanId = parentSpanId;
  if (inspection.snapshot.has('metadata')) {
    traceContext.metadata = snapshotTraceMetadata(inspection.snapshot.get('metadata'), `${root}.metadata`);
  }
  return Object.freeze(traceContext);
}

export function snapshotCommandContext(value: unknown, root = 'commandContext'): CommandContext | undefined {
  if (value === undefined) {
    return undefined;
  }
  const inspection = inspectExactObject(value, { allowedKeys: COMMAND_CONTEXT_KEYS });
  if (!inspection.ok) {
    throwExactObjectFailure(root, 'command context', inspection);
  }

  const snapshot: MutableCommandContext = {};
  const workflowId = optionalString(inspection.snapshot, 'workflowId', root);
  const commandId = optionalString(inspection.snapshot, 'commandId', root);
  const submissionId = optionalString(inspection.snapshot, 'submissionId', root);
  if (workflowId !== undefined) snapshot.workflowId = workflowId;
  if (commandId !== undefined) snapshot.commandId = commandId;
  if (submissionId !== undefined) snapshot.submissionId = submissionId;
  if (inspection.snapshot.has('traceContext')) {
    snapshot.traceContext = snapshotTraceContext(inspection.snapshot.get('traceContext'), `${root}.traceContext`);
  }
  return Object.keys(snapshot).length > 0 ? Object.freeze(snapshot) : undefined;
}

export function mergeCommandContextSnapshots(
  contexts: ReadonlyArray<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  const merged: MutableCommandContext = {};
  for (let index = 0; index < contexts.length; index += 1) {
    const context = snapshotCommandContext(contexts[index], `commandContext[${index}]`);
    if (context === undefined) continue;
    if (context.workflowId !== undefined) merged.workflowId = context.workflowId;
    if (context.commandId !== undefined) merged.commandId = context.commandId;
    if (context.submissionId !== undefined) merged.submissionId = context.submissionId;
    if (context.traceContext !== undefined) merged.traceContext = context.traceContext;
  }
  return snapshotCommandContext(merged);
}
