import type { CommandContext, ReadonlyTraceContext } from '../observabilityTypes';

interface MutableCommandContext {
  workflowId?: string;
  commandId?: string;
  submissionId?: string;
  traceContext?: ReadonlyTraceContext;
}

function snapshotTraceContext(traceContext: ReadonlyTraceContext): ReadonlyTraceContext {
  const { traceId, spanId, parentSpanId, metadata: inputMetadata } = traceContext;
  const metadata = inputMetadata === undefined ? undefined : Object.freeze({ ...inputMetadata });
  return Object.freeze({
    ...(traceId !== undefined ? { traceId } : {}),
    ...(spanId !== undefined ? { spanId } : {}),
    ...(parentSpanId !== undefined ? { parentSpanId } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

export function snapshotCommandContext(context: Partial<CommandContext> | undefined): CommandContext | undefined {
  if (context === undefined) {
    return undefined;
  }
  const { workflowId, commandId, submissionId, traceContext } = context;
  const snapshot: MutableCommandContext = {};
  if (workflowId !== undefined) snapshot.workflowId = workflowId;
  if (commandId !== undefined) snapshot.commandId = commandId;
  if (submissionId !== undefined) snapshot.submissionId = submissionId;
  if (traceContext !== undefined) snapshot.traceContext = snapshotTraceContext(traceContext);
  return Object.keys(snapshot).length > 0 ? Object.freeze(snapshot) : undefined;
}

export function mergeCommandContextSnapshots(
  contexts: ReadonlyArray<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  const merged: MutableCommandContext = {};
  for (const context of contexts) {
    if (context === undefined) continue;
    const { workflowId, commandId, submissionId, traceContext } = context;
    if (workflowId !== undefined) merged.workflowId = workflowId;
    if (commandId !== undefined) merged.commandId = commandId;
    if (submissionId !== undefined) merged.submissionId = submissionId;
    if (traceContext !== undefined) merged.traceContext = traceContext;
  }
  return snapshotCommandContext(merged);
}
