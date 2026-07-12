import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, OcpValidationError } from './errors';
import { toSafeDiagnosticText, toSafeDiagnosticValue } from './errors/OcpError';
import type { CommandContext, CommandObservabilityOptions, CommandTelemetry } from './observabilityTypes';
import { mergeCommandContextSnapshots, snapshotCommandContext } from './utils/commandContext';
import {
  inspectExactObject,
  toExactDataValidationError,
  type ExactDataFailure,
  type ExactObjectSnapshot,
} from './utils/exactObject';
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
const SUBMIT_TRACE_CONTEXT_KEY_SET: ReadonlySet<string> = new Set(SUBMIT_TRACE_CONTEXT_KEYS);
const SUBMIT_TRANSACTION_TREE_PARAM_KEYS = [
  ...REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEYS,
  ...OPTIONAL_SUBMIT_TRANSACTION_TREE_PARAM_KEYS,
] as const satisfies ReadonlyArray<keyof SubmitTransactionTreeParams>;
const REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEY_SET: ReadonlySet<keyof SubmitTransactionTreeParams> = new Set(
  REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEYS
);
/** Plain ledger submit parameters with omission-only, immutable top-level and command-context fields. */
export type AppliedCommandContext = Readonly<Omit<SubmitTransactionTreeParams, keyof CommandContext>> & CommandContext;

export function mergeCommandContext(
  ...contexts: Array<Partial<CommandContext> | undefined>
): CommandContext | undefined {
  return mergeCommandContextSnapshots(contexts);
}

function throwSubmitObjectFailure(root: string, subject: string, failure: ExactDataFailure): never {
  throw toExactDataValidationError(root, failure, {
    message: `${subject} must be a plain object containing own data properties only; rejected ${failure.reason}.`,
    expectedType: `plain ${subject} object with own data properties only`,
  });
}

function requiredSubmitParameter(
  snapshot: ExactObjectSnapshot,
  key: keyof RequiredSubmitTransactionTreeParams,
  root: string
): unknown {
  if (!snapshot.has(key)) {
    throw new OcpValidationError(`${root}.${key}`, `${key} is required.`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'defined own data property',
    });
  }
  const value = snapshot.get(key);
  if (value === undefined) {
    throw new OcpValidationError(`${root}.${key}`, `${key} must not be undefined.`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'defined own data property',
      receivedValue: value,
    });
  }
  return value;
}

function snapshotSubmitTransactionTreeParams(params: SubmitTransactionTreeParams): SubmitTransactionTreeParams {
  const inspection = inspectExactObject(params);
  if (!inspection.ok) throwSubmitObjectFailure('submitParams', 'ledger submit parameters', inspection);

  // Keep required fields materialized. The typed assertion is localized after a
  // descriptor-safe read; the Canton client remains responsible for command decoding.
  const requiredSubmitParams: RequiredSubmitTransactionTreeParams = {
    commands: requiredSubmitParameter(
      inspection.snapshot,
      'commands',
      'submitParams'
    ) as SubmitTransactionTreeParams['commands'],
  };
  const snapshot: SubmitTransactionTreeParams = { ...requiredSubmitParams };

  // Project every optional canonical field from its captured data descriptor and
  // intentionally exclude unknown caller-specific data properties.
  for (const key of SUBMIT_TRANSACTION_TREE_PARAM_KEYS) {
    if (REQUIRED_SUBMIT_TRANSACTION_TREE_PARAM_KEY_SET.has(key)) continue;
    if (!inspection.snapshot.has(key)) continue;
    const value = inspection.snapshot.get(key);
    if (value === undefined) {
      throw new OcpValidationError(
        `submitParams.${String(key)}`,
        `${String(key)} must be omitted rather than undefined.`,
        {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'defined value or omitted property',
          receivedValue: value,
        }
      );
    }
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false,
    });
  }

  return Object.freeze(snapshot);
}

function snapshotSubmitTraceContext(traceContext: SubmitTraceContext): NonNullable<CommandContext['traceContext']> {
  const inspection = inspectExactObject(traceContext, { allowedKeys: SUBMIT_TRACE_CONTEXT_KEY_SET });
  if (!inspection.ok) throwSubmitObjectFailure('submitParams.traceContext', 'trace context', inspection);

  const projected: Partial<SubmitTraceContext> = {};
  for (const key of SUBMIT_TRACE_CONTEXT_KEYS) {
    if (!inspection.snapshot.has(key)) continue;
    const value = inspection.snapshot.get(key);
    if (value === undefined) {
      throw new OcpValidationError(
        `submitParams.traceContext.${String(key)}`,
        `${String(key)} must be omitted rather than undefined.`,
        {
          code: OcpErrorCodes.INVALID_TYPE,
          expectedType: 'defined value or omitted property',
          receivedValue: value,
        }
      );
    }
    Object.defineProperty(projected, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false,
    });
  }

  const context = snapshotCommandContext(
    {
      traceContext: projected,
    },
    'submitParams'
  );
  if (context?.traceContext === undefined) {
    throw new OcpValidationError('submitParams.traceContext', 'traceContext snapshot could not be created.', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'valid trace context',
      receivedValue: traceContext,
    });
  }
  return context.traceContext;
}

function applyMergedCommandContext(
  params: SubmitTransactionTreeParams,
  context: CommandContext | undefined
): AppliedCommandContext {
  const snapshot = snapshotSubmitTransactionTreeParams(params);
  const { workflowId, commandId, submissionId, traceContext, ...submitParams } = snapshot;
  const normalizedTraceContext = traceContext === undefined ? undefined : snapshotSubmitTraceContext(traceContext);
  const appliedContext = mergeCommandContext(
    {
      ...(workflowId !== undefined ? { workflowId } : {}),
      ...(commandId !== undefined ? { commandId } : {}),
      ...(submissionId !== undefined ? { submissionId } : {}),
      ...(normalizedTraceContext !== undefined ? { traceContext: normalizedTraceContext } : {}),
    },
    context
  );

  return Object.freeze({
    ...submitParams,
    ...(appliedContext?.workflowId !== undefined ? { workflowId: appliedContext.workflowId } : {}),
    ...(appliedContext?.commandId !== undefined ? { commandId: appliedContext.commandId } : {}),
    ...(appliedContext?.submissionId !== undefined ? { submissionId: appliedContext.submissionId } : {}),
    ...(appliedContext?.traceContext !== undefined ? { traceContext: appliedContext.traceContext } : {}),
  });
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

/**
 * Apply command context to a plain ledger-submit carrier.
 *
 * Runtime inputs must use own data properties on a plain or null-prototype object.
 * Proxies, accessors, symbols, and custom prototypes are rejected without invoking traps.
 */
export function applyCommandContext<T extends SubmitTransactionTreeParams>(
  params: T,
  options?: CommandObservabilityOptions
): AppliedCommandContext {
  const safeOptions = snapshotCommandObservabilityOptions(options);
  const context = mergeCommandContext(safeOptions?.defaultContext, safeOptions?.context);
  return applyMergedCommandContext(params, context);
}

export async function submitObservedTransactionTree(
  client: Pick<LedgerJsonApiClient, 'submitAndWaitForTransactionTree'>,
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
