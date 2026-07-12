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
const MAX_DIAGNOSTIC_TEXT_LENGTH = 768;
const MAX_DIAGNOSTIC_CONTAINER_ITEMS = 12;
const MAX_DIAGNOSTIC_DEPTH = 6;
const MAX_DIAGNOSTIC_NODES = 48;
const MAX_DIAGNOSTIC_STRING_BUDGET = 1_024;
const MAX_DIAGNOSTIC_JSON_LENGTH = 2_048;

interface DiagnosticBudget {
  nodesRemaining: number;
  stringCharactersRemaining: number;
}

interface DiagnosticState {
  readonly ancestors: WeakSet<object>;
  readonly depth: number;
  readonly budget: DiagnosticBudget;
}

function diagnosticState(): DiagnosticState {
  return {
    ancestors: new WeakSet<object>(),
    depth: 0,
    budget: {
      nodesRemaining: MAX_DIAGNOSTIC_NODES,
      stringCharactersRemaining: MAX_DIAGNOSTIC_STRING_BUDGET,
    },
  };
}

function truncatedString(value: string, state: DiagnosticState): unknown {
  const available = Math.max(0, Math.min(MAX_DIAGNOSTIC_STRING_LENGTH, state.budget.stringCharactersRemaining));
  const preview = value.slice(0, available);
  state.budget.stringCharactersRemaining -= preview.length;
  if (value.length <= available) return value;
  return {
    valueType: 'string',
    length: value.length,
    ...(preview.length > 0 ? { preview: `${preview}...` } : {}),
  };
}

function diagnosticObjectSummary(
  containerType: 'array' | 'object' | 'error' | 'proxy',
  details: Record<string, unknown> = {}
): unknown {
  return { containerType, ...details };
}

function safeDataDescriptorValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function sanitizeDiagnosticValue(value: unknown, state: DiagnosticState): unknown {
  if (state.budget.nodesRemaining <= 0) return { truncated: true, reason: 'diagnostic_budget' };
  state.budget.nodesRemaining -= 1;

  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return truncatedString(value, state);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : { valueType: 'number', value: String(value) };
  }
  if (typeof value === 'bigint') {
    const sign = value === 0n ? 'zero' : value < 0n ? 'negative' : 'positive';
    return { valueType: 'bigint', sign };
  }
  if (typeof value === 'symbol') {
    const { description } = value;
    return {
      valueType: 'symbol',
      ...(description === undefined ? {} : { description: truncatedString(description, state) }),
    };
  }

  const objectLike = typeof value === 'object' || typeof value === 'function';
  if (!objectLike) return { valueType: typeof value };
  if (nodeUtilTypes.isProxy(value)) return diagnosticObjectSummary('proxy');
  if (typeof value === 'function') return { valueType: 'function' };

  const objectValue = value;
  if (state.ancestors.has(objectValue)) return { containerType: 'cyclic' };
  if (state.depth >= MAX_DIAGNOSTIC_DEPTH) {
    return diagnosticObjectSummary(Array.isArray(objectValue) ? 'array' : 'object', { truncated: true });
  }

  if (nodeUtilTypes.isNativeError(objectValue)) {
    const rawMessage = safeDataDescriptorValue(objectValue, 'message');
    const rawName = safeDataDescriptorValue(objectValue, 'name');
    return diagnosticObjectSummary('error', {
      name: typeof rawName === 'string' ? truncatedString(rawName, state) : 'Error',
      ...(typeof rawMessage === 'string' ? { message: truncatedString(rawMessage, state) } : {}),
    });
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
  const childState = { ancestors: state.ancestors, depth: state.depth + 1, budget: state.budget };
  try {
    if (isArray) {
      const result: unknown[] = [];
      for (let index = 0; index < objectValue.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, String(index));
        if (descriptor === undefined || !('value' in descriptor)) {
          return diagnosticObjectSummary('array', { length: objectValue.length, nonDataElements: true });
        }
        result.push(sanitizeDiagnosticValue(descriptor.value, childState));
      }
      return result;
    }

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      if (descriptor === undefined) continue;
      Object.defineProperty(result, key, {
        value:
          'value' in descriptor ? sanitizeDiagnosticValue(descriptor.value, childState) : { valueType: 'accessor' },
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

function freezeDiagnosticValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      freezeDiagnosticValue(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

/**
 * Convert arbitrary diagnostic data into a bounded, JSON-serializable value.
 *
 * This helper is deliberately descriptor-based and rejects proxies before any
 * reflection so diagnostics cannot execute getters or proxy traps while an
 * earlier validation failure is being reported.
 */
export function toSafeDiagnosticValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  const sanitized = sanitizeDiagnosticValue(value, diagnosticState());
  const serialized = JSON.stringify(sanitized);
  return freezeDiagnosticValue(
    serialized.length <= MAX_DIAGNOSTIC_JSON_LENGTH
      ? sanitized
      : {
          truncated: true,
          reason: 'diagnostic_size',
          serializedLength: serialized.length,
        }
  );
}

/** Bound a public diagnostic string without invoking coercion hooks. */
export function toSafeDiagnosticText(value: unknown, maximumLength = MAX_DIAGNOSTIC_TEXT_LENGTH): string {
  if (value === undefined) return 'undefined';
  const requestedMaximumLength = Number.isFinite(maximumLength)
    ? Math.floor(maximumLength)
    : MAX_DIAGNOSTIC_TEXT_LENGTH;
  const boundedMaximumLength = Math.max(0, Math.min(MAX_DIAGNOSTIC_TEXT_LENGTH, requestedMaximumLength));
  const truncate = (text: string): string => {
    if (text.length <= boundedMaximumLength) return text;
    const suffix = boundedMaximumLength >= 3 ? '...' : '';
    return `${text.slice(0, boundedMaximumLength - suffix.length)}${suffix}`;
  };
  if (typeof value === 'string') {
    return truncate(value);
  }
  const safe = toSafeDiagnosticValue(value);
  return truncate(JSON.stringify(safe));
}

function isOcpErrorContext(value: unknown): value is OcpErrorContext {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Sanitize a context object before callers spread canonical fields into it. */
export function toSafeDiagnosticContext(context: OcpErrorContext | undefined): OcpErrorContext {
  if (context === undefined) return Object.freeze({});
  const safe = toSafeDiagnosticValue(context);
  return isOcpErrorContext(safe) ? safe : (freezeDiagnosticValue({ receivedContext: safe }) as OcpErrorContext);
}

/** Merge defined canonical fields into sanitized caller context without erasing caller-only diagnostics. */
export function mergeDiagnosticContext(
  context: OcpErrorContext | undefined,
  canonicalFields: Readonly<Record<string, unknown>>
): OcpErrorContext {
  const merged = { ...toSafeDiagnosticContext(context) };
  for (const [field, value] of Object.entries(canonicalFields)) {
    if (value !== undefined) merged[field] = value;
  }
  return toSafeDiagnosticContext(merged);
}

/** Define sanitized public error fields without exposing them through enumeration or mutation. */
export function defineReadonlyErrorFields(error: object, fields: Readonly<Record<string, unknown>>): void {
  for (const [property, value] of Object.entries(fields)) {
    Object.defineProperty(error, property, {
      value,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
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
    super(toSafeDiagnosticText(message));
    this.name = 'OcpError';
    const safeCode = (typeof code === 'string' ? toSafeDiagnosticText(code, 128) : 'INVALID_RESPONSE') as OcpErrorCode;
    const classification =
      details?.classification === undefined ? undefined : toSafeDiagnosticText(details.classification, 256);
    const context = details?.context === undefined ? undefined : toSafeDiagnosticContext(details.context);
    this.code = safeCode;
    this.classification = classification;
    this.context = context;
    defineReadonlyErrorFields(this, { code: safeCode, cause, classification, context });

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    Error.captureStackTrace(this, this.constructor);
  }

  /** Return a globally bounded, JSON-safe representation for logs and telemetry. */
  toJSON(): unknown {
    return toSafeDiagnosticValue({
      name: this.name,
      code: this.code,
      message: this.message,
      classification: this.classification,
      context: this.context,
      ...(this.cause !== undefined ? { cause: this.cause } : {}),
    });
  }
}
