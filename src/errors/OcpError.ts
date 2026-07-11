import type { OcpErrorCode } from './codes';
import { boundedDiagnosticText, toSafeDiagnosticContext } from './diagnostics';

export type OcpErrorContext = Record<string, unknown>;

/** @internal */
export function contextOrUndefined(context: OcpErrorContext): OcpErrorContext | undefined {
  return Object.keys(context).length === 0 ? undefined : context;
}

export interface OcpErrorDetails {
  /** Structured failure classification for machine-readable diagnostics */
  classification?: string;
  /** Structured context attached to the failure */
  context?: OcpErrorContext;
}

/**
 * Base error class for all OCP SDK errors.
 *
 * Provides structured error information including an error code and optional cause.
 * All OCP-specific errors extend this class, allowing consumers to catch all SDK
 * errors with a single `catch (error instanceof OcpError)` check.
 *
 * @example
 * ```typescript
 * try {
 *   const built = ocp.OpenCapTable.issuer.buildCreate({ ... });
 * } catch (error) {
 *   if (error instanceof OcpError) {
 *     console.error(`OCP Error [${error.code}]: ${error.message}`);
 *   }
 * }
 * ```
 */
export class OcpError extends Error {
  /** Error code for programmatic handling */
  readonly code: OcpErrorCode;

  /** The original error that caused this error, if any */
  readonly cause: Error | undefined;

  /** Structured failure classification for machine-readable diagnostics */
  readonly classification: string | undefined;

  /** Bounded JSON-safe structured context attached to the failure */
  readonly context: OcpErrorContext | undefined;

  constructor(message: string, code: OcpErrorCode, cause?: Error, details?: OcpErrorDetails) {
    super(boundedDiagnosticText(message));
    this.name = 'OcpError';
    this.code = code;
    this.cause = cause;
    Object.defineProperty(this, 'cause', { enumerable: false });
    this.classification =
      details?.classification === undefined ? undefined : boundedDiagnosticText(details.classification, 128);
    this.context = details?.context === undefined ? undefined : toSafeDiagnosticContext(details.context);

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    Error.captureStackTrace(this, this.constructor);
  }
}
