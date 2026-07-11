import { types as nodeUtilTypes } from 'node:util';

const MAX_DIAGNOSTIC_STRING_LENGTH = 2_048;
const MAX_DIAGNOSTIC_KEY_LENGTH = 64;
const MAX_DIAGNOSTIC_CONTAINER_ITEMS = 8;
const MAX_DIAGNOSTIC_DEPTH = 2;
const MAX_DIAGNOSTIC_NODES = 24;

interface DiagnosticState {
  nodes: number;
  readonly seen: WeakSet<object>;
}

function truncate(value: string, maximum = MAX_DIAGNOSTIC_STRING_LENGTH): string {
  if (value.length <= maximum) return value;
  const suffix = `...[${value.length} chars]`;
  return `${value.slice(0, Math.max(0, maximum - suffix.length))}${suffix}`;
}

/** Bound text that may become part of an SDK diagnostic message. */
export function boundedDiagnosticText(value: string): string {
  return truncate(value, 512);
}

function metadata(type: string, details: Readonly<Record<string, string | number | boolean>> = {}): unknown {
  return { type, ...details };
}

function summarize(value: unknown, depth: number, state: DiagnosticState): unknown {
  if (value === null || value === undefined) return value;

  const valueType = typeof value;
  if (valueType === 'string') return truncate(value as string);
  if (valueType === 'boolean') return value;
  if (valueType === 'number') return value;
  if (valueType === 'bigint') return metadata('bigint');
  if (valueType === 'symbol') {
    const symbolValue = value as symbol;
    const { description } = symbolValue;
    return metadata('symbol', description === undefined ? {} : { description: truncate(description) });
  }

  if (nodeUtilTypes.isProxy(value)) return metadata('proxy');
  if (valueType === 'function') return metadata('function');
  if (valueType !== 'object') return metadata(valueType);

  const object = value;
  if (state.seen.has(object)) return metadata('circular');
  if (depth >= MAX_DIAGNOSTIC_DEPTH || state.nodes >= MAX_DIAGNOSTIC_NODES) {
    return metadata(Array.isArray(object) ? 'array' : 'object');
  }

  state.nodes += 1;
  state.seen.add(object);
  try {
    if (Array.isArray(object)) {
      const { length } = object;
      if (length > MAX_DIAGNOSTIC_CONTAINER_ITEMS) return metadata('array', { length });

      const result: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(object, String(index));
        if (descriptor === undefined) {
          result.push(metadata('array-hole'));
        } else if ('value' in descriptor) {
          result.push(summarize(descriptor.value, depth + 1, state));
        } else {
          result.push(metadata('accessor'));
        }
      }
      return result;
    }

    const prototype = Object.getPrototypeOf(object) as object | null;
    if (prototype !== Object.prototype && prototype !== null) return metadata('object');

    const keys = Object.getOwnPropertyNames(object);
    const symbols = Object.getOwnPropertySymbols(object);
    if (keys.length > MAX_DIAGNOSTIC_CONTAINER_ITEMS || keys.some((key) => key.length > MAX_DIAGNOSTIC_KEY_LENGTH)) {
      return metadata('object', { keys: keys.length, symbolKeys: symbols.length });
    }

    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      const summarized =
        descriptor === undefined
          ? metadata('missing-property')
          : 'value' in descriptor
            ? summarize(descriptor.value, depth + 1, state)
            : metadata('accessor');
      Object.defineProperty(result, key, { configurable: true, enumerable: true, value: summarized, writable: true });
    }
    if (symbols.length > 0) result.$symbolKeys = symbols.length;
    return result;
  } catch {
    return metadata('uninspectable-object');
  } finally {
    state.seen.delete(object);
  }
}

/**
 * Convert arbitrary runtime input into a JSON-safe, size-bounded diagnostic.
 * No getters, custom serializers, or Proxy traps are invoked.
 */
export function toBoundedDiagnosticValue(value: unknown): unknown {
  return summarize(value, 0, { nodes: 0, seen: new WeakSet<object>() });
}
