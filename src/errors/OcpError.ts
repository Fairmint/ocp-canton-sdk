import type { OcpErrorCode } from './codes';
import { boundedDiagnosticText, toBoundedDiagnosticContext, toBoundedDiagnosticValue } from './diagnosticValue';

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

  /** Structured context attached to the failure */
  readonly context: OcpErrorContext | undefined;

  constructor(message: string, code: OcpErrorCode, cause?: Error, details?: OcpErrorDetails) {
    super(boundedDiagnosticText(message));
    this.name = 'OcpError';
    this.code = code;
    Object.defineProperty(this, 'cause', { configurable: true, enumerable: false, value: cause, writable: false });
    this.classification =
      details?.classification === undefined ? undefined : boundedDiagnosticText(details.classification);
    this.context = toBoundedDiagnosticContext(details?.context);

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    Error.captureStackTrace(this, this.constructor);
  }

  /** Return a globally bounded JSON-safe representation for logs and telemetry. */
  toJSON(): Record<string, unknown> {
    const ownDataValue = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(this, key);
      return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
    };
    const rawName = ownDataValue('name');
    const rawMessage = ownDataValue('message');
    const rawCode = ownDataValue('code');
    const rawClassification = ownDataValue('classification');
    const rawContext = ownDataValue('context');
    const result: Record<string, unknown> = {
      name: typeof rawName === 'string' ? boundedDiagnosticText(rawName) : 'OcpError',
      message: typeof rawMessage === 'string' ? boundedDiagnosticText(rawMessage) : 'OCP SDK error',
      code: toBoundedDiagnosticValue(rawCode),
      ...(typeof rawClassification === 'string' ? { classification: boundedDiagnosticText(rawClassification) } : {}),
      ...(rawContext !== undefined ? { context: toBoundedDiagnosticContext(rawContext) } : {}),
    };

    for (const key of [
      'fieldPath',
      'expectedType',
      'receivedValue',
      'source',
      'contractId',
      'templateId',
      'choice',
      'endpoint',
      'statusCode',
    ]) {
      const value = ownDataValue(key);
      if (value !== undefined) result[key] = toBoundedDiagnosticValue(value);
    }
    return result;
  }
}
