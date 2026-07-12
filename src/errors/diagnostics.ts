import { types as nodeUtilTypes } from 'node:util';

const MAX_DIAGNOSTIC_TEXT_LENGTH = 512;
const MAX_DIAGNOSTIC_STRING_LENGTH = 128;
const MAX_DIAGNOSTIC_KEY_LENGTH = 96;
const MAX_DIAGNOSTIC_KEYS_PER_CONTAINER = 32;
const MAX_DIAGNOSTIC_DEPTH = 4;
const MAX_DIAGNOSTIC_NODES = 48;
const MAX_DIAGNOSTIC_ENTRIES = 48;
const MAX_DIAGNOSTIC_BYTE_BUDGET = 512;
const MAX_DIAGNOSTIC_SERIALIZED_BYTES = 768;

type DiagnosticTruncationReason =
  | 'byte-budget'
  | 'depth-limit'
  | 'entry-budget'
  | 'node-budget'
  | 'per-container-entry-limit'
  | 'serialized-byte-limit';

interface DiagnosticBudget {
  exhaustedReason: DiagnosticTruncationReason | undefined;
  remainingBytes: number;
  remainingEntries: number;
  remainingNodes: number;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function serializedByteLength(value: unknown): number {
  if (value === undefined) return 0;
  return utf8ByteLength(JSON.stringify(value));
}

function exhaustBudget(budget: DiagnosticBudget, reason: DiagnosticTruncationReason): void {
  budget.exhaustedReason ??= reason;
}

function consumeNode(budget: DiagnosticBudget): boolean {
  if (budget.remainingNodes <= 0) {
    exhaustBudget(budget, 'node-budget');
    return false;
  }
  budget.remainingNodes -= 1;
  return true;
}

function consumeEntry(budget: DiagnosticBudget): boolean {
  if (budget.remainingEntries <= 0) {
    exhaustBudget(budget, 'entry-budget');
    return false;
  }
  budget.remainingEntries -= 1;
  return true;
}

function consumeBytes(budget: DiagnosticBudget, bytes: number): boolean {
  if (bytes > budget.remainingBytes) {
    exhaustBudget(budget, 'byte-budget');
    return false;
  }
  budget.remainingBytes -= bytes;
  return true;
}

function truncationMarker(
  reason: DiagnosticTruncationReason,
  omittedEntries?: number
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    kind: 'diagnostic-truncation',
    reason,
    ...(omittedEntries !== undefined && omittedEntries > 0 ? { omittedEntries } : {}),
  });
}

function budgetedValue(value: unknown, budget: DiagnosticBudget): unknown {
  return consumeBytes(budget, serializedByteLength(value))
    ? value
    : truncationMarker(budget.exhaustedReason ?? 'byte-budget');
}

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

function summaryForObject(
  value: object,
  keys?: readonly PropertyKey[],
  reason?: DiagnosticTruncationReason
): Readonly<Record<string, unknown>> {
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
      ...(reason === undefined ? {} : { truncated: true, truncationReason: reason }),
    });
  }
  return Object.freeze({
    kind: 'object',
    ownKeyCount: keys?.length ?? Reflect.ownKeys(value).length,
    ...(reason === undefined ? {} : { truncated: true, truncationReason: reason }),
  });
}

function diagnosticKey(key: string, ordinal: number): string {
  if (key.length <= MAX_DIAGNOSTIC_KEY_LENGTH) return key;
  const preview = key
    .slice(0, 48)
    .replace(/[^\u0020-\u007e]/g, '?')
    .replace(/[\[\]]/g, '?');
  return `[truncated-key#${ordinal};length=${key.length};preview=${preview}]`;
}

function uniqueDiagnosticKey(result: object, preferred: string): string {
  if (!Object.prototype.hasOwnProperty.call(result, preferred)) return preferred;
  let suffix = 1;
  while (Object.prototype.hasOwnProperty.call(result, `${preferred}#${suffix}`)) suffix += 1;
  return `${preferred}#${suffix}`;
}

function defineDiagnosticProperty(result: object, key: string, value: unknown): void {
  Object.defineProperty(result, key, {
    configurable: false,
    enumerable: true,
    value,
    writable: false,
  });
}

function addObjectTruncation(
  result: Record<string, unknown>,
  reason: DiagnosticTruncationReason,
  omittedEntries: number
): void {
  defineDiagnosticProperty(
    result,
    uniqueDiagnosticKey(result, '[diagnostic-truncation]'),
    truncationMarker(reason, omittedEntries)
  );
}

interface ObjectEntry {
  readonly key: string;
  readonly value: unknown;
}

function plainObjectEntries(value: object, keys: readonly PropertyKey[]): readonly ObjectEntry[] | undefined {
  const entries: ObjectEntry[] = [];
  for (const key of keys) {
    if (typeof key !== 'string') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) return undefined;
    entries.push({ key, value: descriptor.value });
  }
  return entries;
}

function safeDiagnosticArray(
  value: unknown[],
  keys: readonly PropertyKey[],
  depth: number,
  ancestors: ReadonlySet<object>,
  budget: DiagnosticBudget
): unknown {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length =
    lengthDescriptor !== undefined && 'value' in lengthDescriptor && typeof lengthDescriptor.value === 'number'
      ? lengthDescriptor.value
      : null;
  if (length === null || length > MAX_DIAGNOSTIC_KEYS_PER_CONTAINER) {
    return budgetedValue(summaryForObject(value, keys, 'per-container-entry-limit'), budget);
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) {
      return budgetedValue(summaryForObject(value, keys), budget);
    }
    values.push(descriptor.value);
  }
  if (keys.length !== length + 1) return budgetedValue(summaryForObject(value, keys), budget);
  if (!consumeBytes(budget, 2)) return truncationMarker(budget.exhaustedReason ?? 'byte-budget');

  const result: unknown[] = [];
  const nextAncestors = new Set(ancestors).add(value);
  for (let index = 0; index < values.length; index += 1) {
    if (!consumeEntry(budget) || !consumeBytes(budget, index === 0 ? 0 : 1)) {
      result.push(truncationMarker(budget.exhaustedReason ?? 'entry-budget', values.length - index));
      break;
    }
    result.push(safeDiagnosticValue(values[index], depth + 1, nextAncestors, budget));
    if (budget.exhaustedReason !== undefined) {
      const omittedEntries = values.length - index - 1;
      if (omittedEntries > 0) result.push(truncationMarker(budget.exhaustedReason, omittedEntries));
      break;
    }
  }
  return Object.freeze(result);
}

function safeDiagnosticObject(
  value: object,
  keys: readonly PropertyKey[],
  depth: number,
  ancestors: ReadonlySet<object>,
  budget: DiagnosticBudget
): unknown {
  const entries = plainObjectEntries(value, keys);
  if (entries === undefined) return budgetedValue(summaryForObject(value, keys), budget);
  if (!consumeBytes(budget, 2)) return truncationMarker(budget.exhaustedReason ?? 'byte-budget');

  const result: Record<string, unknown> = {};
  const nextAncestors = new Set(ancestors).add(value);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === undefined) break;
    const outputKey = uniqueDiagnosticKey(result, diagnosticKey(entry.key, index));
    const keyBytes = serializedByteLength(outputKey) + 1 + (index === 0 ? 0 : 1);
    if (!consumeEntry(budget) || !consumeBytes(budget, keyBytes)) {
      addObjectTruncation(result, budget.exhaustedReason ?? 'entry-budget', entries.length - index);
      break;
    }
    defineDiagnosticProperty(result, outputKey, safeDiagnosticValue(entry.value, depth + 1, nextAncestors, budget));
    if (budget.exhaustedReason !== undefined) {
      const omittedEntries = entries.length - index - 1;
      if (omittedEntries > 0) addObjectTruncation(result, budget.exhaustedReason, omittedEntries);
      break;
    }
  }
  return Object.freeze(result);
}

function safeDiagnosticValue(
  value: unknown,
  depth: number,
  ancestors: ReadonlySet<object>,
  budget: DiagnosticBudget
): unknown {
  if (!consumeNode(budget)) return truncationMarker(budget.exhaustedReason ?? 'node-budget');
  if (typeof value === 'string') {
    return budgetedValue(boundedString(value, MAX_DIAGNOSTIC_STRING_LENGTH), budget);
  }
  if (value === null || value === undefined || typeof value === 'boolean') return budgetedValue(value, budget);
  if (typeof value === 'number') {
    const safeNumber = Number.isFinite(value)
      ? value
      : Object.freeze({ kind: 'number', value: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' });
    return budgetedValue(safeNumber, budget);
  }
  if (typeof value === 'bigint') {
    return budgetedValue(Object.freeze({ kind: 'bigint', sign: value < 0n ? 'negative' : 'nonnegative' }), budget);
  }
  if (typeof value === 'symbol') {
    const { description } = value;
    return budgetedValue(
      Object.freeze({
        kind: 'symbol',
        description: description === undefined ? null : boundedString(description, MAX_DIAGNOSTIC_STRING_LENGTH),
      }),
      budget
    );
  }
  if (typeof value === 'function') {
    const safeFunction = nodeUtilTypes.isProxy(value)
      ? Object.freeze({ kind: 'proxy' })
      : Object.freeze({ kind: 'function', name: safeFunctionName(value) });
    return budgetedValue(safeFunction, budget);
  }

  if (nodeUtilTypes.isProxy(value)) return budgetedValue(Object.freeze({ kind: 'proxy' }), budget);
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return budgetedValue(Object.freeze({ kind: 'uninspectable-object' }), budget);
  }
  if (ancestors.has(value)) {
    return budgetedValue(Object.freeze({ ...summaryForObject(value, keys), cyclic: true }), budget);
  }
  if (depth >= MAX_DIAGNOSTIC_DEPTH) {
    return budgetedValue(summaryForObject(value, keys, 'depth-limit'), budget);
  }
  if (keys.length > MAX_DIAGNOSTIC_KEYS_PER_CONTAINER) {
    return budgetedValue(summaryForObject(value, keys, 'per-container-entry-limit'), budget);
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== null && prototype !== Object.prototype && prototype !== Array.prototype) {
    return budgetedValue(summaryForObject(value, keys), budget);
  }

  return Array.isArray(value)
    ? safeDiagnosticArray(value, keys, depth, ancestors, budget)
    : safeDiagnosticObject(value, keys, depth, ancestors, budget);
}

function safeValueKind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function enforceSerializedLimit(value: unknown): unknown {
  const candidateBytes = serializedByteLength(value);
  if (candidateBytes <= MAX_DIAGNOSTIC_SERIALIZED_BYTES) return value;
  return Object.freeze({
    candidateBytes,
    candidateKind: safeValueKind(value),
    kind: 'diagnostic-truncation',
    maxSerializedBytes: MAX_DIAGNOSTIC_SERIALIZED_BYTES,
    reason: 'serialized-byte-limit',
  });
}

/** Convert arbitrary runtime evidence to a bounded, trap-free, JSON-safe value. */
export function toSafeDiagnosticValue(value: unknown): unknown {
  const budget: DiagnosticBudget = {
    exhaustedReason: undefined,
    remainingBytes: MAX_DIAGNOSTIC_BYTE_BUDGET,
    remainingEntries: MAX_DIAGNOSTIC_ENTRIES,
    remainingNodes: MAX_DIAGNOSTIC_NODES,
  };
  return enforceSerializedLimit(safeDiagnosticValue(value, 0, new Set(), budget));
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
