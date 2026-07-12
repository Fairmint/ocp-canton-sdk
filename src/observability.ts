import type { LedgerJsonApiClient, TraceContext } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';
import { toSafeDiagnosticText, toSafeDiagnosticValue } from './errors/OcpError';
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

interface ObservedErrorDiagnostics {
  readonly errorType: string;
  readonly errorMessage: string;
}

function ownDiagnosticString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'string'
    ? descriptor.value
    : undefined;
}

function nativeErrorName(value: unknown): string | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    nodeUtilTypes.isProxy(value) ||
    !nodeUtilTypes.isNativeError(value)
  ) {
    return undefined;
  }
  try {
    let current: object | null = value;
    while (current !== null) {
      if (nodeUtilTypes.isProxy(current)) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(current, 'name');
      if (descriptor !== undefined) {
        return 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : undefined;
      }
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Derive bounded rejection diagnostics without invoking user-controlled traps, accessors, or coercion hooks. */
function observedErrorDiagnostics(error: unknown): ObservedErrorDiagnostics {
  const diagnostic = toSafeDiagnosticValue(error);
  const containerType = ownDiagnosticString(diagnostic, 'containerType');
  const valueType = ownDiagnosticString(diagnostic, 'valueType');
  const safeName = ownDiagnosticString(diagnostic, 'name');
  const safeMessage = ownDiagnosticString(diagnostic, 'message');
  const errorType =
    containerType === 'error'
      ? (nativeErrorName(error) ?? safeName ?? 'Error')
      : (containerType ?? valueType ?? typeof error);
  return Object.freeze({
    errorType,
    errorMessage: safeMessage ?? toSafeDiagnosticText(diagnostic),
  });
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
    runBestEffort(() => {
      const { errorType, errorMessage } = observedErrorDiagnostics(error);
      return safeOptions?.logger?.error('Canton command failed', {
        ...logContext,
        durationMs,
        errorType,
        errorMessage,
      });
    });
    runBestEffort(() => {
      const { errorType } = observedErrorDiagnostics(error);
      return safeOptions?.metrics?.commandFailed(templateId, choice, errorType);
    });
    throw error;
  }
}
