import { OcpErrorCodes, type OcpErrorCode } from './codes';
import { OcpError } from './OcpError';

export interface OcpParseErrorOptions {
  /** Description of the data source being parsed */
  source?: string;
  /** The original error that caused this error */
  cause?: Error;
  /** Specific parse error code (defaults to INVALID_RESPONSE) */
  code?: OcpErrorCode;
}

/**
 * Errors from parsing or transforming data.
 *
 * Thrown when data cannot be parsed or transformed, such as invalid
 * DAML responses, unknown enum values, or schema mismatches.
 *
 * @example
 * ```typescript
 * throw new OcpParseError('Unknown DAML stakeholder type: InvalidType', {
 *   source: 'stakeholder.stakeholder_type',
 *   code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
 * });
 * ```
 *
 * @example Catching parse errors
 * ```typescript
 * try {
 *   const result = await ocp.OpenCapTable.stakeholder.getStakeholderAsOcf(params);
 * } catch (error) {
 *   if (error instanceof OcpParseError) {
 *     console.error(`Parse error in ${error.source}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class OcpParseError extends OcpError {
  /** Description of the data source being parsed */
  readonly source?: string;

  constructor(message: string, options?: OcpParseErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.INVALID_RESPONSE;
    super(message, code, options?.cause);
    this.name = 'OcpParseError';
    this.source = options?.source;
  }
}
