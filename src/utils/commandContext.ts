import type { CommandContext, ReadonlyTraceContext } from '../observabilityTypes';

interface MutableCommandContext {
  workflowId?: string;
  commandId?: string;
  submissionId?: string;
  traceContext?: ReadonlyTraceContext;
}

function snapshotTraceContext(traceContext: ReadonlyTraceContext): ReadonlyTraceContext {
  const metadata = traceContext.metadata === undefined ? undefined : Object.freeze({ ...traceContext.metadata });
  return Object.freeze({
    ...(traceContext.traceId !== undefined ? { traceId: traceContext.traceId } : {}),
    ...(traceContext.spanId !== undefined ? { spanId: traceContext.spanId } : {}),
    ...(traceContext.parentSpanId !== undefined ? { parentSpanId: traceContext.parentSpanId } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

export function snapshotCommandContext(context: Partial<CommandContext> | undefined): CommandContext | undefined {
  if (context === undefined) {
    return undefined;
  }
  const snapshot: MutableCommandContext = {};
  if (context.workflowId !== undefined) snapshot.workflowId = context.workflowId;
  if (context.commandId !== undefined) snapshot.commandId = context.commandId;
  if (context.submissionId !== undefined) snapshot.submissionId = context.submissionId;
  if (context.traceContext !== undefined) snapshot.traceContext = snapshotTraceContext(context.traceContext);
  return Object.keys(snapshot).length > 0 ? Object.freeze(snapshot) : undefined;
}

export function mergeCommandContextSnapshots(
  contexts: ReadonlyArray<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  const merged: MutableCommandContext = {};
  for (const context of contexts) {
    if (context === undefined) continue;
    if (context.workflowId !== undefined) merged.workflowId = context.workflowId;
    if (context.commandId !== undefined) merged.commandId = context.commandId;
    if (context.submissionId !== undefined) merged.submissionId = context.submissionId;
    if (context.traceContext !== undefined) merged.traceContext = context.traceContext;
  }
  return snapshotCommandContext(merged);
}
