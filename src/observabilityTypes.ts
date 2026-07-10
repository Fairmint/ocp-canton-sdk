import type { TraceContext } from '@fairmint/canton-node-sdk';

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
