import type { OcpErrorCode } from './codes';

export type OcpErrorContext = Record<string, unknown>;

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
  readonly cause?: Error;

  /** Structured failure classification for machine-readable diagnostics */
  readonly classification?: string;

  /** Structured context attached to the failure */
  readonly context?: OcpErrorContext;

  constructor(message: string, code: OcpErrorCode, cause?: Error, details?: OcpErrorDetails) {
    super(message);
    this.name = 'OcpError';
    this.code = code;
    this.cause = cause;
    this.classification = details?.classification;
    this.context = details?.context;

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    Error.captureStackTrace(this, this.constructor);
  }
}
