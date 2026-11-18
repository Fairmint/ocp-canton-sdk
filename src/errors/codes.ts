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
  /** A submission was sent, but whether the ledger committed it is unknown; the cause says why the response was lost */
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',

  // Network errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Parse errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  UNKNOWN_ENUM_VALUE: 'UNKNOWN_ENUM_VALUE',
  UNKNOWN_ENTITY_TYPE: 'UNKNOWN_ENTITY_TYPE',
} as const;

export type OcpErrorCode = (typeof OcpErrorCodes)[keyof typeof OcpErrorCodes];
