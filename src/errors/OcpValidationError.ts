import { OcpErrorCodes, type OcpErrorCode } from './codes';
import { OcpError } from './OcpError';

export interface OcpValidationErrorOptions {
  /** The expected type for this field */
  expectedType?: string;
  /** The actual value received */
  receivedValue?: unknown;
  /** Specific validation error code (defaults to REQUIRED_FIELD_MISSING) */
  code?: OcpErrorCode;
}

/**
 * Validation errors for invalid input data.
 *
 * Thrown when input data fails validation before being sent to DAML contracts.
 * Includes the field path where validation failed and optionally the expected
 * type and received value.
 *
 * @example
 * ```typescript
 * if (!data.id) {
 *   throw new OcpValidationError('stakeholder.id', 'Required field is missing or empty', {
 *     expectedType: 'string',
 *     receivedValue: data.id,
 *   });
 * }
 * ```
 *
 * @example Catching validation errors
 * ```typescript
 * try {
 *   await ocp.OpenCapTable.capTable.update(...).create('stakeholder', data).execute();
 * } catch (error) {
 *   if (error instanceof OcpValidationError) {
 *     console.error(`Validation failed at '${error.fieldPath}': ${error.message}`);
 *     console.error(`Expected: ${error.expectedType}, Got: ${error.receivedValue}`);
 *   }
 * }
 * ```
 */
export class OcpValidationError extends OcpError {
  /** The dot-separated path to the field that failed validation */
  readonly fieldPath: string;

  /** The expected type for this field, if applicable */
  readonly expectedType?: string;

  /** The actual value that was received */
  readonly receivedValue?: unknown;

  constructor(fieldPath: string, message: string, options?: OcpValidationErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.REQUIRED_FIELD_MISSING;
    super(`Validation error at '${fieldPath}': ${message}`, code);
    this.name = 'OcpValidationError';
    this.fieldPath = fieldPath;
    this.expectedType = options?.expectedType;
    this.receivedValue = options?.receivedValue;
  }
}
