import { types as nodeUtilTypes } from 'node:util';

const MAX_DIAGNOSTIC_TEXT_LENGTH = 512;
const MAX_DIAGNOSTIC_STRING_LENGTH = 128;
const MAX_DIAGNOSTIC_KEYS = 32;
const MAX_DIAGNOSTIC_DEPTH = 4;

function boundedString(value: string, limit: number): string | Readonly<Record<string, unknown>> {
  if (value.length <= limit) return value;
  return Object.freeze({ kind: 'string', length: value.length, preview: value.slice(0, limit) });
}

/** Bound an error message without losing the original size as diagnostic evidence. */
export function boundedDiagnosticText(value: string, limit = MAX_DIAGNOSTIC_TEXT_LENGTH): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}… [truncated; original length ${value.length}]`;
}

function safeFunctionName(value: object): string | Readonly<Record<string, unknown>> | null {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'name');
  if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'string') return null;
  return boundedString(descriptor.value, MAX_DIAGNOSTIC_STRING_LENGTH);
}

function summaryForObject(value: object, keys?: readonly PropertyKey[]): Readonly<Record<string, unknown>> {
  if (nodeUtilTypes.isProxy(value)) return Object.freeze({ kind: 'proxy' });
  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    return Object.freeze({
      kind: 'array',
      length:
        lengthDescriptor !== undefined && 'value' in lengthDescriptor && typeof lengthDescriptor.value === 'number'
          ? lengthDescriptor.value
          : null,
      ownKeyCount: keys?.length ?? Reflect.ownKeys(value).length,
    });
  }
  return Object.freeze({ kind: 'object', ownKeyCount: keys?.length ?? Reflect.ownKeys(value).length });
}

function safeDiagnosticValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'string') return boundedString(value, MAX_DIAGNOSTIC_STRING_LENGTH);
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    return Object.freeze({ kind: 'number', value: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' });
  }
  if (typeof value === 'bigint')
    return Object.freeze({ kind: 'bigint', sign: value < 0n ? 'negative' : 'nonnegative' });
  if (typeof value === 'symbol') {
    const { description } = value;
    return Object.freeze({
      kind: 'symbol',
      description: description === undefined ? null : boundedString(description, MAX_DIAGNOSTIC_STRING_LENGTH),
    });
  }
  if (typeof value === 'function') {
    if (nodeUtilTypes.isProxy(value)) return Object.freeze({ kind: 'proxy' });
    return Object.freeze({ kind: 'function', name: safeFunctionName(value) });
  }

  if (nodeUtilTypes.isProxy(value)) return Object.freeze({ kind: 'proxy' });
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return Object.freeze({ kind: 'uninspectable-object' });
  }
  if (ancestors.has(value)) return Object.freeze({ ...summaryForObject(value, keys), cyclic: true });
  if (depth >= MAX_DIAGNOSTIC_DEPTH || keys.length > MAX_DIAGNOSTIC_KEYS) return summaryForObject(value, keys);

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== null && prototype !== Object.prototype && prototype !== Array.prototype) {
    return summaryForObject(value, keys);
  }

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length =
      lengthDescriptor !== undefined && 'value' in lengthDescriptor && typeof lengthDescriptor.value === 'number'
        ? lengthDescriptor.value
        : null;
    if (length === null || length > MAX_DIAGNOSTIC_KEYS) return summaryForObject(value, keys);

    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) {
        return summaryForObject(value, keys);
      }
      result.push(safeDiagnosticValue(descriptor.value, depth + 1, nextAncestors));
    }
    return Object.freeze(result);
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string') return summaryForObject(value, keys);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) {
      return summaryForObject(value, keys);
    }
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      value: safeDiagnosticValue(descriptor.value, depth + 1, nextAncestors),
      writable: false,
    });
  }
  return Object.freeze(result);
}

/** Convert arbitrary runtime evidence to a bounded, trap-free, JSON-safe value. */
export function toSafeDiagnosticValue(value: unknown): unknown {
  return safeDiagnosticValue(value, 0, new Set());
}

/** Render arbitrary runtime evidence without invoking user coercion hooks. */
export function describeDiagnosticValue(value: unknown): string {
  const safeValue = toSafeDiagnosticValue(value);
  if (typeof safeValue === 'string') return boundedDiagnosticText(safeValue);
  if (safeValue === undefined) return 'undefined';
  try {
    return boundedDiagnosticText(JSON.stringify(safeValue));
  } catch {
    return '<unserializable value>';
  }
}

/** Sanitize structured error context while retaining its small canonical fields. */
export function toSafeDiagnosticContext(context: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const safe = toSafeDiagnosticValue(context);
  if (safe !== null && typeof safe === 'object' && !Array.isArray(safe)) {
    return safe as Record<string, unknown>;
  }
  return { diagnosticContext: safe };
}
