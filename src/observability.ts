import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';
import { toSafeDiagnosticText, toSafeDiagnosticValue } from './errors/OcpError';
import type { CommandContext, CommandObservabilityOptions, CommandTelemetry } from './observabilityTypes';
import { mergeCommandContextSnapshots } from './utils/commandContext';
import { snapshotCommandObservabilityOptions } from './utils/observabilityConfig';

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
type SubmitTraceContext = NonNullable<SubmitTransactionTreeParams['traceContext']>;
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
type RequiredSubmitTransactionTreeParams = Pick<SubmitTransactionTreeParams, RequiredKeys<SubmitTransactionTreeParams>>;
type OptionalSubmitTransactionTreeParams = Omit<SubmitTransactionTreeParams, RequiredKeys<SubmitTransactionTreeParams>>;

function exhaustiveKeys<T>() {
  return <const Keys extends ReadonlyArray<keyof T>>(
    keys: Keys & ([Exclude<keyof T, Keys[number]>] extends [never] ? unknown : never)
  ): Keys => keys;
}

const REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEYS = exhaustiveKeys<RequiredSubmitTransactionTreeParams>()(['commands']);
const OPTIONAL_SUBMIT_TRANSACTION_TREE_PARAM_KEYS = exhaustiveKeys<OptionalSubmitTransactionTreeParams>()([
  'commandId',
  'actAs',
  'userId',
  'readAs',
  'workflowId',
  'deduplicationPeriod',
  'minLedgerTimeAbs',
  'minLedgerTimeRel',
  'submissionId',
  'traceContext',
  'disclosedContracts',
  'synchronizerId',
  'packageIdSelectionPreference',
  'prefetchContractKeys',
]);
const SUBMIT_TRACE_CONTEXT_KEYS = exhaustiveKeys<SubmitTraceContext>()([
  'traceId',
  'spanId',
  'parentSpanId',
  'metadata',
]);
const SUBMIT_TRANSACTION_TREE_PARAM_KEYS = [
  ...REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEYS,
  ...OPTIONAL_SUBMIT_TRANSACTION_TREE_PARAM_KEYS,
] as const satisfies ReadonlyArray<keyof SubmitTransactionTreeParams>;
const REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEY_SET: ReadonlySet<keyof SubmitTransactionTreeParams> = new Set(
  REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEYS
);
/** Plain ledger submit parameters with omission-only, immutable command-context fields. */
export type AppliedCommandContext = Omit<SubmitTransactionTreeParams, keyof CommandContext> & CommandContext;

export function mergeCommandContext(
  ...contexts: Array<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  return mergeCommandContextSnapshots(contexts);
}

function snapshotSubmitTransactionTreeParams(params: SubmitTransactionTreeParams): SubmitTransactionTreeParams {
  // Keep required fields materialized even when supplied by a prototype getter or as
  // a non-enumerable property. This literal also becomes a compile-time tripwire if
  // Canton makes another submit field required.
  const requiredSubmitParams: RequiredSubmitTransactionTreeParams = {
    commands: params.commands,
  };
  const snapshot: SubmitTransactionTreeParams = { ...requiredSubmitParams };

  // Read every optional canonical field exactly once, omit undefined values, and
  // intentionally exclude unknown caller-specific properties and methods.
  for (const key of SUBMIT_TRANSACTION_TREE_PARAM_KEYS) {
    if (REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEY_SET.has(key)) continue;
    const value = params[key];
    if (value !== undefined) {
      Object.defineProperty(snapshot, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    }
  }

  return snapshot;
}

function snapshotSubmitTraceContext(traceContext: SubmitTraceContext): CommandContext['traceContext'] {
  const snapshot: Partial<NonNullable<CommandContext['traceContext']>> = {};
  for (const key of SUBMIT_TRACE_CONTEXT_KEYS) {
    const value = traceContext[key];
    if (value !== undefined) {
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value,
        writable: false,
      });
    }
  }
  return Object.freeze(snapshot);
}

function applyMergedCommandContext(
  params: SubmitTransactionTreeParams,
  context: CommandContext | undefined
): AppliedCommandContext {
  const snapshot = snapshotSubmitTransactionTreeParams(params);
  const { workflowId, commandId, submissionId, traceContext, ...submitParams } = snapshot;
  const normalizedTraceContext =
    traceContext === undefined ? undefined : snapshotSubmitTraceContext(traceContext);
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
): AppliedCommandContext {
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
  const safeOptions = snapshotCommandObservabilityOptions(options);
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
