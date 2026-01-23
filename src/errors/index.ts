/**
 * Structured error types for the OCP SDK.
 *
 * This module provides a hierarchy of error types for different failure modes,
 * enabling better error handling, debugging, and developer experience.
 *
 * @example Error handling
 * ```typescript
 * import {
 *   OcpError,
 *   OcpValidationError,
 *   OcpContractError,
 *   OcpNetworkError,
 *   OcpParseError,
 *   OcpErrorCodes,
 * } from '@open-captable-protocol/canton';
 *
 * try {
 *   await ocp.OpenCapTable.capTable.update(params).create('stakeholder', data).execute();
 * } catch (error) {
 *   if (error instanceof OcpValidationError) {
 *     // Handle validation errors (invalid input)
 *     console.error(`Invalid input at ${error.fieldPath}: ${error.message}`);
 *   } else if (error instanceof OcpContractError) {
 *     // Handle contract errors (DAML/Canton issues)
 *     console.error(`Contract error on ${error.choice}: ${error.message}`);
 *   } else if (error instanceof OcpNetworkError) {
 *     // Handle network errors (connectivity issues)
 *     console.error(`Network error: ${error.message}`);
 *   } else if (error instanceof OcpParseError) {
 *     // Handle parse errors (data transformation issues)
 *     console.error(`Parse error: ${error.message}`);
 *   } else if (error instanceof OcpError) {
 *     // Handle any other OCP errors
 *     console.error(`OCP Error [${error.code}]: ${error.message}`);
 *   } else {
 *     throw error; // Re-throw unknown errors
 *   }
 * }
 * ```
 */

// Error codes
export { OcpErrorCodes, type OcpErrorCode } from './codes';

// Error classes
export { OcpContractError, type OcpContractErrorOptions } from './OcpContractError';
export { OcpError } from './OcpError';
export { OcpNetworkError, type OcpNetworkErrorOptions } from './OcpNetworkError';
export { OcpParseError, type OcpParseErrorOptions } from './OcpParseError';
export { OcpValidationError, type OcpValidationErrorOptions } from './OcpValidationError';
