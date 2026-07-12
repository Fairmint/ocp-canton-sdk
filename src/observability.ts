import type { LedgerJsonApiClient, TraceContext } from '@fairmint/canton-node-sdk';
import type { CommandContext, CommandObservabilityOptions, CommandTelemetry } from './observabilityTypes';
import { mergeCommandContextSnapshots } from './utils/commandContext';
import { snapshotCommandObservabilityCarrier, snapshotCommandObservabilityOptions } from './utils/observabilityConfig';

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
type TraceableSubmitTransactionTreeParams = SubmitTransactionTreeParams & { traceContext?: TraceContext };

export function mergeCommandContext(
  ...contexts: Array<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  return mergeCommandContextSnapshots(contexts);
}

function applyMergedCommandContext<T extends SubmitTransactionTreeParams>(
  params: T,
  context: CommandContext | undefined
): T & TraceableSubmitTransactionTreeParams {
  if (!context) return params;

  return {
    ...params,
    ...(context.workflowId !== undefined ? { workflowId: context.workflowId } : {}),
    ...(context.commandId !== undefined ? { commandId: context.commandId } : {}),
    ...(context.submissionId !== undefined ? { submissionId: context.submissionId } : {}),
    ...(context.traceContext !== undefined ? { traceContext: context.traceContext } : {}),
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
): T & TraceableSubmitTransactionTreeParams {
  const safeOptions = snapshotCommandObservabilityOptions(options);
  const context = mergeCommandContext(safeOptions?.defaultContext, safeOptions?.context);
  return applyMergedCommandContext(params, context);
}

export async function submitObservedTransactionTree(
  client: LedgerJsonApiClient,
  params: SubmitTransactionTreeParams,
  options: CommandObservabilityOptions | undefined,
  telemetry: CommandTelemetry
): Promise<SubmitTransactionTreeResponse> {
  const safeOptions = options === undefined ? undefined : snapshotCommandObservabilityCarrier(options);
  const context = mergeCommandContext(safeOptions?.defaultContext, safeOptions?.context);
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

  runBestEffort(() => safeOptions?.logger?.debug('Submitting Canton command', logContext));
  runBestEffort(() => safeOptions?.metrics?.commandSubmitted(templateId, choice));

  try {
    const response = await client.submitAndWaitForTransactionTree(submitParams);
    const durationMs = Date.now() - startedAt;
    runBestEffort(() =>
      safeOptions?.logger?.info('Canton command succeeded', {
        ...logContext,
        updateId: response.transactionTree.updateId,
        durationMs,
      })
    );
    runBestEffort(() => safeOptions?.metrics?.commandSucceeded(templateId, choice, durationMs));
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorType = error instanceof Error ? error.name : typeof error;
    runBestEffort(() =>
      safeOptions?.logger?.error('Canton command failed', {
        ...logContext,
        durationMs,
        errorType,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );
    runBestEffort(() => safeOptions?.metrics?.commandFailed(templateId, choice, errorType));
    throw error;
  }
}
