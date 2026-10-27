import {
  isDefiniteCantonMutationRejection,
  normalizeCantonError,
  readCantonDefiniteAnswer,
  UnknownMutationOutcomeError,
  type LedgerJsonApiClient,
  type TraceContext,
} from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from './errors';

type SubmitTransactionParams = Parameters<LedgerJsonApiClient['submitAndWaitForTransaction']>[0];
type SubmitTransactionResponse = Awaited<ReturnType<LedgerJsonApiClient['submitAndWaitForTransaction']>>;
type TraceableSubmitTransactionParams = SubmitTransactionParams & { traceContext?: TraceContext };

export interface CommandContext {
  /** Business process ID persisted by Canton on submitted commands. */
  workflowId?: string;
  /** Unique command ID for deduplication and operator diagnostics. */
  commandId?: string;
  /** Unique submission ID for retry tracking through completions. */
  submissionId?: string;
  /** Distributed tracing metadata forwarded to Canton command submissions and SDK logs. */
  traceContext?: TraceContext;
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

function applyMergedCommandContext<T extends SubmitTransactionParams>(
  params: T,
  context: CommandContext | undefined
): T & TraceableSubmitTransactionParams {
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

export function applyCommandContext<T extends SubmitTransactionParams>(
  params: T,
  options?: CommandObservabilityOptions
): T & TraceableSubmitTransactionParams {
  const context = mergeCommandContext(options?.defaultContext, options?.context);
  return applyMergedCommandContext(params, context);
}

export async function submitObservedTransaction(
  client: LedgerJsonApiClient,
  params: SubmitTransactionParams,
  options: CommandObservabilityOptions | undefined,
  telemetry: CommandTelemetry
): Promise<SubmitTransactionResponse> {
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
    const response = await client.submitAndWaitForTransaction(submitParams);
    const durationMs = Date.now() - startedAt;
    runBestEffort(() =>
      options?.logger?.info('Canton command succeeded', {
        ...logContext,
        updateId: response.transaction.updateId,
        durationMs,
      })
    );
    runBestEffort(() => options?.metrics?.commandSucceeded(templateId, choice, durationMs));
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorType = error instanceof Error ? error.name : typeof error;
    const failure = commandFailure(error, telemetry, submitParams);
    runBestEffort(() =>
      options?.logger?.error('Canton command failed', {
        ...logContext,
        durationMs,
        errorType,
        errorMessage: error instanceof Error ? error.message : String(error),
        ...(failure.outcome !== undefined ? { outcome: failure.outcome } : {}),
        ...(failure.causeMessage !== undefined ? { causeMessage: failure.causeMessage } : {}),
      })
    );
    runBestEffort(() => options?.metrics?.commandFailed(templateId, choice, errorType));
    throw failure.error;
  }
}

interface CommandFailure {
  readonly error: unknown;
  /** `unknown` when the ledger may have committed the command, `rejected` when it definitely did not */
  readonly outcome?: 'unknown' | 'rejected';
  /** The transport's own error behind an unknown outcome: the HTTP status and the Canton error body */
  readonly causeMessage?: string;
}

// By class, or by name and shape for an error from another copy of canton-node-sdk in the consumer's tree.
function isUnknownMutationOutcome(
  error: unknown
): error is Pick<UnknownMutationOutcomeError, 'cause' | 'endpoint' | 'attempts'> {
  if (error instanceof UnknownMutationOutcomeError) return true;
  return (
    error instanceof Error &&
    error.name === 'UnknownMutationOutcomeError' &&
    (error as { cause?: unknown }).cause instanceof Error
  );
}

function isDefiniteRejection(error: unknown): boolean {
  return isDefiniteCantonMutationRejection(error) || readCantonDefiniteAnswer(error) === true;
}

/**
 * What a failed submission means for the caller. canton-node-sdk reports a submission whose response it lost as an
 * `UnknownMutationOutcomeError` and hides the transport's error, HTTP status and Canton body included, in its `cause`;
 * the SDK surfaces that cause as `OUTCOME_UNKNOWN`, which is not retryable as such: the cause is often deterministic
 * (a 500 for a payload Canton cannot decode fails again), and a caller that reconciles the command decides. A response
 * that proves the ledger refused the command is `CHOICE_FAILED`. The SDK never resubmits.
 */
function commandFailure(
  error: unknown,
  telemetry: CommandTelemetry,
  submitParams: TraceableSubmitTransactionParams
): CommandFailure {
  const action = telemetry.choice ?? telemetry.operation;
  const diagnostics = {
    operation: telemetry.operation,
    commandId: submitParams.commandId,
    submissionId: submitParams.submissionId,
  };
  if (isUnknownMutationOutcome(error)) {
    const { cause } = error;
    const status = normalizeCantonError(cause)?.status;
    if (isDefiniteRejection(cause)) {
      return {
        error: rejection(action, cause, telemetry, { ...diagnostics, status }),
        outcome: 'rejected',
        causeMessage: cause.message,
      };
    }
    return {
      error: new OcpContractError(`The outcome of ${action} is unknown: ${cause.message}`, {
        code: OcpErrorCodes.OUTCOME_UNKNOWN,
        cause,
        templateId: telemetry.templateId,
        choice: telemetry.choice,
        retryable: false,
        classification: 'unknown_mutation_outcome',
        context: { ...diagnostics, status, endpoint: error.endpoint, attempts: error.attempts },
      }),
      outcome: 'unknown',
      causeMessage: cause.message,
    };
  }
  if (error instanceof Error && isDefiniteRejection(error)) {
    return {
      error: rejection(action, error, telemetry, { ...diagnostics, status: normalizeCantonError(error)?.status }),
      outcome: 'rejected',
    };
  }
  return { error };
}

function rejection(
  action: string,
  cause: Error,
  telemetry: CommandTelemetry,
  context: Record<string, unknown>
): OcpContractError {
  return new OcpContractError(`${action} was rejected: ${cause.message}`, {
    code: OcpErrorCodes.CHOICE_FAILED,
    cause,
    templateId: telemetry.templateId,
    choice: telemetry.choice,
    retryable: false,
    classification: 'definite_rejection',
    context,
  });
}
