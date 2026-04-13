/**
 * Shared classification for ledger contract reads (getEventsByContractId, manifest extraction).
 *
 * Used by {@link getCapTableState} and {@link extractCantonOcfManifest} so visibility vs schema vs
 * archival failures stay consistent.
 *
 * @module contractReadDiagnostics
 */

import { OcpErrorCodes, type OcpErrorCode } from '../errors/codes';
import { OcpError, type OcpErrorContext } from '../errors/OcpError';

export type ContractReadFailureKind = 'not_found' | 'visibility' | 'auth' | 'schema' | 'network' | 'unknown';

export interface ContractReadOutcome {
  classification: ContractReadFailureKind;
  retryable: boolean;
  benignMissing: boolean;
}

function classifyByOcpCode(code: OcpErrorCode): ContractReadFailureKind | null {
  switch (code) {
    case OcpErrorCodes.CONTRACT_NOT_FOUND:
      return 'not_found';
    case OcpErrorCodes.AUTHORIZATION_FAILED:
      return 'auth';
    case OcpErrorCodes.SCHEMA_MISMATCH:
    case OcpErrorCodes.INVALID_RESPONSE:
    case OcpErrorCodes.REQUIRED_FIELD_MISSING:
    case OcpErrorCodes.INVALID_TYPE:
    case OcpErrorCodes.INVALID_FORMAT:
    case OcpErrorCodes.OUT_OF_RANGE:
    case OcpErrorCodes.UNKNOWN_ENUM_VALUE:
    case OcpErrorCodes.UNKNOWN_ENTITY_TYPE:
      return 'schema';
    case OcpErrorCodes.CONNECTION_FAILED:
    case OcpErrorCodes.TIMEOUT:
    case OcpErrorCodes.RATE_LIMITED:
      return 'network';
    case OcpErrorCodes.CHOICE_FAILED:
    case OcpErrorCodes.RESULT_NOT_FOUND:
      return null;
    default:
      return null;
  }
}

function refineUnknownOcpError(error: OcpError): ContractReadFailureKind {
  const cls = (error.classification ?? '').toLowerCase();
  const msg = error.message.toLowerCase();

  if (cls.includes('visibility') || cls.includes('readas') || cls.includes('not_visible')) {
    return 'visibility';
  }
  if (cls.includes('auth') || cls.includes('forbidden') || cls.includes('unauthorized')) {
    return 'auth';
  }
  if (cls.includes('network') || cls.includes('timeout') || cls.includes('connection') || cls.includes('rate_limit')) {
    return 'network';
  }
  if (cls.includes('not_found') || cls.includes('archived') || cls.includes('inactive')) {
    return 'not_found';
  }
  if (
    cls.includes('schema') ||
    cls.includes('parse') ||
    cls.includes('missing_') ||
    cls.includes('invalid') ||
    cls.includes('mismatch')
  ) {
    return 'schema';
  }

  if (msg.includes('readas') || msg.includes('not visible') || msg.includes('visibility')) {
    return 'visibility';
  }

  return 'unknown';
}

/**
 * Classify a failed contract read for cap-table state vs manifest extraction.
 *
 * Prefer {@link OcpError} `code` / `classification` over message substring heuristics so
 * parse/schema errors that mention “not found” (e.g. missing nested DAML fields) are not
 * treated as benign ledger archival.
 */
export function classifyContractReadFailure(error: unknown): ContractReadFailureKind {
  if (error instanceof OcpError) {
    const byCode = classifyByOcpCode(error.code);
    if (byCode !== null) {
      return byCode;
    }
    return refineUnknownOcpError(error);
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // Schema / parse shapes first — avoids "... not found ... create argument" → not_found
  if (
    lower.includes('data not found') ||
    lower.includes('create argument') ||
    lower.includes('createargument') ||
    lower.includes('invalid contract events response') ||
    lower.includes('issuer contract events response') ||
    lower.includes('schema') ||
    lower.includes('parse') ||
    lower.includes('validation error') ||
    lower.includes('required field') ||
    lower.includes('unknown enum') ||
    lower.includes('invalid type') ||
    lower.includes('invalid format')
  ) {
    return 'schema';
  }

  if (lower.includes('readas') || lower.includes('not visible') || lower.includes('visibility')) {
    return 'visibility';
  }

  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('unauthorised') ||
    lower.includes('authentication')
  ) {
    return 'auth';
  }

  if (
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('socket hang up') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('http 502') ||
    lower.includes('http 503') ||
    lower.includes('http 504') ||
    lower.includes('http 429') ||
    lower.includes('rate limit') ||
    lower.includes('fetch failed')
  ) {
    return 'network';
  }

  // Ledger / archival not-found (narrow; generic "not found" only after schema rules)
  if (
    lower.includes('contract_events_not_found') ||
    lower.includes('inactive contract') ||
    /\barchived\b/.test(lower) ||
    lower.includes('not found')
  ) {
    return 'not_found';
  }

  return 'unknown';
}

export function contractReadFailureCode(kind: ContractReadFailureKind): OcpErrorCode {
  switch (kind) {
    case 'auth':
    case 'visibility':
      return OcpErrorCodes.AUTHORIZATION_FAILED;
    case 'schema':
      return OcpErrorCodes.SCHEMA_MISMATCH;
    case 'network':
      return OcpErrorCodes.CONNECTION_FAILED;
    case 'not_found':
      return OcpErrorCodes.CONTRACT_NOT_FOUND;
    case 'unknown':
      return OcpErrorCodes.CHOICE_FAILED;
  }
}

/** Fields used to populate `OcpContractError` `context` for issuer / manifest read failures. */
export interface ContractReadDiagnosticsOcpContextInput {
  classification: ContractReadFailureKind;
  operation: string;
  contractId: string;
  entityType: string;
  issuerPartyId?: string;
  objectId?: string;
  attempts?: number;
  readAs?: string[];
}

/**
 * Builds a plain `OcpErrorContext` from structured contract-read diagnostics (no casts).
 */
export function contractReadDiagnosticsToOcpContext(input: ContractReadDiagnosticsOcpContextInput): OcpErrorContext {
  const ctx: OcpErrorContext = {
    classification: input.classification,
    operation: input.operation,
    contractId: input.contractId,
    entityType: input.entityType,
  };
  if (input.issuerPartyId !== undefined) {
    ctx.issuerPartyId = input.issuerPartyId;
  }
  if (input.objectId !== undefined) {
    ctx.objectId = input.objectId;
  }
  if (input.attempts !== undefined) {
    ctx.attempts = input.attempts;
  }
  if (input.readAs !== undefined) {
    ctx.readAs = input.readAs;
  }
  return ctx;
}

export function isRetryableContractReadFailure(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    return msg.includes('HTTP 429') || msg.includes('HTTP 502') || msg.includes('HTTP 503') || msg.includes('HTTP 504');
  }
  return false;
}

export function analyzeContractReadFailure(error: unknown): ContractReadOutcome {
  const classification = classifyContractReadFailure(error);
  return {
    classification,
    retryable: classification !== 'not_found' && isRetryableContractReadFailure(error),
    benignMissing: classification === 'not_found',
  };
}
