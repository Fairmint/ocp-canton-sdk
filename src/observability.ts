import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

type SubmitTransactionTreeParams = Parameters<LedgerJsonApiClient['submitAndWaitForTransactionTree']>[0];
type SubmitTransactionTreeResponse = Awaited<ReturnType<LedgerJsonApiClient['submitAndWaitForTransactionTree']>>;

export interface CommandTraceContext {
  traceId: string;
  spanId: string;
}

export interface CommandContext {
  /** Business process ID persisted by Canton on submitted commands. */
  workflowId?: string;
  /** Unique command ID for deduplication and operator diagnostics. */
  commandId?: string;
  /** Unique submission ID for retry tracking through completions. */
  submissionId?: string;
  /**
   * Distributed tracing metadata for SDK logs.
   *
   * The current canton-node-sdk submit-and-wait schema does not expose a
   * submit-level traceContext field, so this is intentionally not forwarded to
   * the ledger request yet.
   */
  traceContext?: CommandTraceContext;
}

export interface SdkLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface SdkMetrics {
  commandSubmitted(templateId: string, choice: string): void;
  commandSucceeded(templateId: string, choice: string, durationMs: number): void;
  commandFailed(templateId: string, choice: string, errorType: string): void;
}

export interface OcpObservabilityOptions {
  logger?: SdkLogger;
  metrics?: SdkMetrics;
  defaultContext?: Partial<CommandContext>;
}

export interface CommandObservabilityOptions extends OcpObservabilityOptions {
  context?: CommandContext;
}

export interface CommandTelemetry {
  operation: string;
  templateId?: string;
  choice?: string;
}

export function mergeCommandContext(
  ...contexts: Array<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  const merged: CommandContext = {};

  for (const context of contexts) {
    if (!context) continue;
    if (context.workflowId !== undefined) merged.workflowId = context.workflowId;
    if (context.commandId !== undefined) merged.commandId = context.commandId;
    if (context.submissionId !== undefined) merged.submissionId = context.submissionId;
    if (context.traceContext !== undefined) merged.traceContext = context.traceContext;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function applyMergedCommandContext<T extends SubmitTransactionTreeParams>(
  params: T,
  context: CommandContext | undefined
): T {
  if (!context) return params;

  return {
    ...params,
    ...(context.workflowId !== undefined ? { workflowId: context.workflowId } : {}),
    ...(context.commandId !== undefined ? { commandId: context.commandId } : {}),
    ...(context.submissionId !== undefined ? { submissionId: context.submissionId } : {}),
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
): T {
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
    traceContext: context?.traceContext,
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
