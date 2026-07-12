import type { TraceContext } from '@fairmint/canton-node-sdk';

export interface ReadonlyTraceContext {
  readonly traceId?: NonNullable<TraceContext['traceId']>;
  readonly spanId?: NonNullable<TraceContext['spanId']>;
  readonly parentSpanId?: NonNullable<TraceContext['parentSpanId']>;
  readonly metadata?: Readonly<NonNullable<TraceContext['metadata']>>;
}

export interface CommandContext {
  /** Business process ID persisted by Canton on submitted commands. */
  readonly workflowId?: string;
  /** Unique command ID for deduplication and operator diagnostics. */
  readonly commandId?: string;
  /** Unique submission ID for retry tracking through completions. */
  readonly submissionId?: string;
  /** Distributed tracing metadata forwarded to Canton command submissions and SDK logs. */
  readonly traceContext?: ReadonlyTraceContext;
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
  readonly logger?: SdkLogger;
  readonly metrics?: SdkMetrics;
  readonly defaultContext?: CommandContext;
}

export interface CommandObservabilityOptions extends OcpObservabilityOptions {
  readonly context?: CommandContext;
}

export interface CommandTelemetry {
  readonly operation: string;
  readonly templateId?: string;
  readonly choice?: string;
}
