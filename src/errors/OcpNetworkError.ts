import { OcpErrorCodes, type OcpErrorCode } from './codes';
import { contextOrUndefined, OcpError, type OcpErrorContext } from './OcpError';

export interface OcpNetworkErrorOptions {
  /** The endpoint that was being accessed */
  endpoint?: string;
  /** The HTTP status code, if applicable */
  statusCode?: number;
  /** The original error that caused this error */
  cause?: Error;
  /** Specific network error code (defaults to CONNECTION_FAILED) */
  code?: OcpErrorCode;
  /** Structured failure classification override */
  classification?: string;
  /** Additional structured diagnostics context */
  context?: OcpErrorContext;
}

/**
 * Network or connectivity errors.
 *
 * Thrown when network operations fail, such as connection failures,
 * timeouts, or rate limiting.
 *
 * @example
 * ```typescript
 * throw new OcpNetworkError('Failed to connect to Canton JSON API', {
 *   endpoint: 'http://localhost:3975',
 *   code: OcpErrorCodes.CONNECTION_FAILED,
 *   cause: originalError,
 * });
 * ```
 *
 * @example Catching network errors
 * ```typescript
 * try {
 *   await ocp.OpenCapTable.issuer.getIssuerAsOcf(params);
 * } catch (error) {
 *   if (error instanceof OcpNetworkError) {
 *     console.error(`Network error: ${error.message}`);
 *     if (error.statusCode === 503) {
 *       console.error('Service unavailable - retry later');
 *     }
 *   }
 * }
 * ```
 */
export class OcpNetworkError extends OcpError {
  /** The endpoint that was being accessed */
  readonly endpoint: string | undefined;

  /** The HTTP status code, if applicable */
  readonly statusCode: number | undefined;

  constructor(message: string, options?: OcpNetworkErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.CONNECTION_FAILED;
    const context = contextOrUndefined({
      ...options?.context,
      ...(options?.endpoint !== undefined ? { endpoint: options.endpoint } : {}),
      ...(options?.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
    });
    super(message, code, options?.cause, {
      classification: options?.classification ?? 'network_error',
      ...(context !== undefined ? { context } : {}),
    });
    this.name = 'OcpNetworkError';
    this.endpoint = options?.endpoint;
    this.statusCode = options?.statusCode;
  }
}
