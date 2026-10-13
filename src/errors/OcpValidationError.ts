import { OcpErrorCodes, type OcpErrorCode } from './codes';
import {
  defineReadonlyErrorFields,
  mergeDiagnosticContext,
  OcpError,
  toSafeDiagnosticText,
  toSafeDiagnosticValue,
  type OcpErrorContext,
} from './OcpError';

export interface OcpValidationErrorOptions {
  /** The expected type for this field */
  expectedType?: string;
  /** The actual value received; unsafe or oversized values are summarized on the resulting error */
  receivedValue?: unknown;
  /** Specific validation error code (defaults to REQUIRED_FIELD_MISSING) */
  code?: OcpErrorCode;
  /** Structured failure classification override */
  classification?: string;
  /** Additional structured diagnostics context */
  context?: OcpErrorContext;
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

  /** A bounded, JSON-safe representation of the value that was received */
  readonly receivedValue?: unknown;

  constructor(fieldPath: string, message: string, options?: OcpValidationErrorOptions) {
    const code = options?.code ?? OcpErrorCodes.REQUIRED_FIELD_MISSING;
    const safeFieldPath = toSafeDiagnosticText(fieldPath, 512);
    const safeMessage = toSafeDiagnosticText(message);
    const expectedType =
      options?.expectedType === undefined ? undefined : toSafeDiagnosticText(options.expectedType, 512);
    const receivedValue =
      options?.receivedValue === undefined ? undefined : toSafeDiagnosticValue(options.receivedValue);
    const context = mergeDiagnosticContext(options?.context, { fieldPath: safeFieldPath, expectedType, receivedValue });
    super(`Validation error at '${safeFieldPath}': ${safeMessage}`, code, undefined, {
      classification: options?.classification ?? 'validation_error',
      context,
    });
    this.name = 'OcpValidationError';
    this.fieldPath = safeFieldPath;
    this.expectedType = expectedType;
    this.receivedValue = receivedValue;
    defineReadonlyErrorFields(this, { fieldPath: safeFieldPath, expectedType, receivedValue });
  }
}
