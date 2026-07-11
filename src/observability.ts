import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { CommandContext, CommandObservabilityOptions, CommandTelemetry } from './observabilityTypes';
import { mergeCommandContextSnapshots } from './utils/commandContext';

export type {
  CommandContext,
  CommandObservabilityOptions,
  CommandTelemetry,
  OcpObservabilityOptions,
  ReadonlyTraceContext,
  SdkLogger,
  SdkMetrics,
} from './observabilityTypes';

type SubmitTransactionTreeParams = Parameters<LedgerJsonApiClient['submitAndWaitForTransactionTree']>[0];
type SubmitTransactionTreeResponse = Awaited<ReturnType<LedgerJsonApiClient['submitAndWaitForTransactionTree']>>;
/** Plain ledger submit parameters with omission-only, immutable command-context fields. */
export type AppliedCommandContext = Omit<SubmitTransactionTreeParams, keyof CommandContext> & CommandContext;

export function mergeCommandContext(
  ...contexts: Array<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  return mergeCommandContextSnapshots(contexts);
}

function applyMergedCommandContext(
  params: SubmitTransactionTreeParams,
  context: CommandContext | undefined
): AppliedCommandContext {
  const { workflowId, commandId, submissionId, traceContext, ...submitParams } = params;
  const normalizedTraceContext =
    traceContext === undefined
      ? undefined
      : {
          ...(traceContext.traceId !== undefined ? { traceId: traceContext.traceId } : {}),
          ...(traceContext.spanId !== undefined ? { spanId: traceContext.spanId } : {}),
          ...(traceContext.parentSpanId !== undefined ? { parentSpanId: traceContext.parentSpanId } : {}),
          ...(traceContext.metadata !== undefined ? { metadata: traceContext.metadata } : {}),
        };
  const appliedContext = mergeCommandContext(
    {
      ...(workflowId !== undefined ? { workflowId } : {}),
      ...(commandId !== undefined ? { commandId } : {}),
      ...(submissionId !== undefined ? { submissionId } : {}),
      ...(normalizedTraceContext !== undefined ? { traceContext: normalizedTraceContext } : {}),
    },
    context
  );

  return {
    ...submitParams,
    ...(appliedContext?.workflowId !== undefined ? { workflowId: appliedContext.workflowId } : {}),
    ...(appliedContext?.commandId !== undefined ? { commandId: appliedContext.commandId } : {}),
    ...(appliedContext?.submissionId !== undefined ? { submissionId: appliedContext.submissionId } : {}),
    ...(appliedContext?.traceContext !== undefined ? { traceContext: appliedContext.traceContext } : {}),
  };
}

function runBestEffort(callback: (() => unknown) | undefined): void {
  try {
    void Promise.resolve(callback?.()).catch(() => {
      // Observability hooks must not change ledger command outcomes.
    });
  } catch {
    // Observability hooks must not change ledger command outcomes.
  }
}

export function applyCommandContext<T extends SubmitTransactionTreeParams>(
  params: T,
  options?: CommandObservabilityOptions
): AppliedCommandContext {
  const context = mergeCommandContext(options?.defaultContext, options?.context);
  return applyMergedCommandContext(params, context);
}

export async function submitObservedTransactionTree(
  client: LedgerJsonApiClient,
  params: SubmitTransactionTreeParams,
  options: CommandObservabilityOptions | undefined,
  telemetry: CommandTelemetry
): Promise<SubmitTransactionTreeResponse> {
  const context = mergeCommandContext(options?.defaultContext, options?.context);
  const submitParams = applyMergedCommandContext(params, context);
  const startedAt = Date.now();
  const templateId = telemetry.templateId ?? 'unknown';
  const choice = telemetry.choice ?? 'unknown';
  const logContext: Record<string, unknown> = {
    operation: telemetry.operation,
    templateId,
    choice,
    workflowId: submitParams.workflowId,
    commandId: submitParams.commandId,
    submissionId: submitParams.submissionId,
    traceContext: submitParams.traceContext,
  };

  runBestEffort(() => options?.logger?.debug('Submitting Canton command', logContext));
  runBestEffort(() => options?.metrics?.commandSubmitted(templateId, choice));

  try {
    const response = await client.submitAndWaitForTransactionTree(submitParams);
    const durationMs = Date.now() - startedAt;
    runBestEffort(() =>
      options?.logger?.info('Canton command succeeded', {
        ...logContext,
        updateId: response.transactionTree.updateId,
        durationMs,
      })
    );
    runBestEffort(() => options?.metrics?.commandSucceeded(templateId, choice, durationMs));
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorType = error instanceof Error ? error.name : typeof error;
    runBestEffort(() =>
      options?.logger?.error('Canton command failed', {
        ...logContext,
        durationMs,
        errorType,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );
    runBestEffort(() => options?.metrics?.commandFailed(templateId, choice, errorType));
    throw error;
  }
}
