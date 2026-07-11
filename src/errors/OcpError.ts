import { types as nodeUtilTypes } from 'node:util';

import type { OcpErrorCode } from './codes';

export type OcpErrorContext = Record<string, unknown>;

export interface OcpErrorDetails {
  /** Structured failure classification for machine-readable diagnostics */
  classification?: string;
  /** Structured context attached to the failure */
  context?: OcpErrorContext;
}

const MAX_DIAGNOSTIC_STRING_LENGTH = 256;
const MAX_DIAGNOSTIC_CONTAINER_ITEMS = 20;
const MAX_DIAGNOSTIC_DEPTH = 4;

interface DiagnosticState {
  readonly ancestors: WeakSet<object>;
  readonly depth: number;
}

function truncatedString(value: string): unknown {
  if (value.length <= MAX_DIAGNOSTIC_STRING_LENGTH) return value;
  return {
    valueType: 'string',
    length: value.length,
    preview: `${value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH)}...`,
  };
}

function diagnosticObjectSummary(containerType: 'array' | 'object', details: Record<string, unknown> = {}): unknown {
  return { containerType, ...details };
}

/**
 * Convert arbitrary diagnostic data into a bounded, JSON-serializable value.
 *
 * This helper is deliberately descriptor-based and rejects proxies before any
 * reflection so diagnostics cannot execute getters or proxy traps while an
 * earlier validation failure is being reported.
 */
export function toSafeDiagnosticValue(
  value: unknown,
  state: DiagnosticState = { ancestors: new WeakSet<object>(), depth: 0 }
): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'string') return truncatedString(value);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : { valueType: 'number', value: String(value) };
  }
  if (typeof value === 'bigint') {
    const decimal = value.toString();
    return { valueType: 'bigint', value: truncatedString(decimal) };
  }
  if (typeof value === 'symbol') {
    return { valueType: 'symbol', value: truncatedString(String(value)) };
  }

  const objectLike = typeof value === 'object' || typeof value === 'function';
  if (!objectLike) return { valueType: typeof value };
  if (nodeUtilTypes.isProxy(value)) return { containerType: 'proxy' };
  if (typeof value === 'function') return { valueType: 'function' };

  const objectValue = value;
  if (state.ancestors.has(objectValue)) return { containerType: 'cyclic' };
  if (state.depth >= MAX_DIAGNOSTIC_DEPTH) {
    return diagnosticObjectSummary(Array.isArray(objectValue) ? 'array' : 'object', { truncated: true });
  }

  const isArray = Array.isArray(objectValue);
  if (isArray && objectValue.length > MAX_DIAGNOSTIC_CONTAINER_ITEMS) {
    return diagnosticObjectSummary('array', { length: objectValue.length });
  }

  const prototype = Object.getPrototypeOf(objectValue);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    return diagnosticObjectSummary(isArray ? 'array' : 'object', { customPrototype: true });
  }

  const ownKeys = Reflect.ownKeys(objectValue);
  if (ownKeys.length > MAX_DIAGNOSTIC_CONTAINER_ITEMS + (isArray ? 1 : 0)) {
    return diagnosticObjectSummary(isArray ? 'array' : 'object', { ownPropertyCount: ownKeys.length });
  }
  if (ownKeys.some((key) => typeof key === 'symbol' || key.length > MAX_DIAGNOSTIC_STRING_LENGTH)) {
    return diagnosticObjectSummary(isArray ? 'array' : 'object', { nonStandardKeys: true });
  }

  state.ancestors.add(objectValue);
  const childState = { ancestors: state.ancestors, depth: state.depth + 1 };
  try {
    if (isArray) {
      const result: unknown[] = [];
      for (let index = 0; index < objectValue.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index));
        if (descriptor === undefined || !('value' in descriptor)) {
          return diagnosticObjectSummary('array', { length: objectValue.length, nonDataElements: true });
        }
        result.push(toSafeDiagnosticValue(descriptor.value, childState));
      }
      return result;
    }

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      if (descriptor === undefined) continue;
      Object.defineProperty(result, key, {
        value: 'value' in descriptor ? toSafeDiagnosticValue(descriptor.value, childState) : { valueType: 'accessor' },
        enumerable: true,
        configurable: true,
        writable: false,
      });
    }
    return result;
  } finally {
    state.ancestors.delete(objectValue);
  }
}

/** Sanitize a context object before callers spread canonical fields into it. */
export function toSafeDiagnosticContext(context: OcpErrorContext | undefined): OcpErrorContext {
  if (context === undefined) return {};
  const safe = toSafeDiagnosticValue(context);
  return safe !== null && typeof safe === 'object' && !Array.isArray(safe)
    ? (safe as OcpErrorContext)
    : { receivedContext: safe };
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
    Object.defineProperty(this, 'cause', {
      value: cause,
      enumerable: false,
      configurable: true,
      writable: false,
    });
    this.classification = details?.classification;
    this.context = details?.context ? (toSafeDiagnosticValue(details.context) as OcpErrorContext) : undefined;

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    Error.captureStackTrace(this, this.constructor);
  }
}
