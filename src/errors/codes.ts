/**
 * Error codes for OCP SDK errors.
 *
 * These codes allow programmatic handling of specific error conditions.
 */
export const OcpErrorCodes = {
  // Validation errors
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',

  // Contract errors
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  CHOICE_FAILED: 'CHOICE_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  RESULT_NOT_FOUND: 'RESULT_NOT_FOUND',

  // Network errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Parse errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  UNKNOWN_ENUM_VALUE: 'UNKNOWN_ENUM_VALUE',
} as const;

export type OcpErrorCode = (typeof OcpErrorCodes)[keyof typeof OcpErrorCodes];
