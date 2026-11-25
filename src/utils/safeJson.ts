import { types as nodeUtilTypes } from 'node:util';

const MAX_JSON_DEPTH = 100;
const MAX_JSON_ARRAY_LENGTH = 100_000;
const MAX_JSON_OWN_PROPERTIES = 100_000;
const MAX_JSON_VISITED_VALUES = 250_000;
const MAX_JSON_PROPERTY_NAME_LENGTH = 512;

export type UnsafeJsonKind =
  | 'accessor'
  | 'array_too_large'
  | 'custom_array_property'
  | 'custom_prototype'
  | 'cycle'
  | 'depth'
  | 'non_data_property'
  | 'non_enumerable_property'
  | 'non_finite_number'
  | 'non_json_value'
  | 'oversized_property_name'
  | 'proxy'
  | 'sparse_array'
  | 'symbol_property'
  | 'too_many_properties'
  | 'too_many_values'
  | 'undefined';

export interface UnsafeJsonIssue {
  readonly kind: UnsafeJsonKind;
  readonly path: string;
  readonly message: string;
  readonly receivedValue: unknown;
}

interface InspectionState {
  readonly ancestors: WeakSet<object>;
  visitedValues: number;
}

function issue(kind: UnsafeJsonKind, path: string, message: string, receivedValue: unknown): UnsafeJsonIssue {
  return { kind, path, message, receivedValue };
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function childPath(parent: string, key: string, isArray: boolean): string {
  return isArray ? `${parent}[${key}]` : `${parent}.${key}`;
}

/**
 * Find the first value that cannot cross a strict JSON boundary safely.
 *
 * The walk rejects proxies before reflection and reads data exclusively through
 * property descriptors. Consequently it never executes getters, setters, proxy
 * traps, or custom coercion hooks. Bounds prevent maliciously deep or wide input
 * from turning validation itself into unbounded work.
 */
export function findUnsafeJsonIssue(
  value: unknown,
  source: string,
  state: InspectionState = { ancestors: new WeakSet<object>(), visitedValues: 0 },
  depth = 0
): UnsafeJsonIssue | undefined {
  state.visitedValues += 1;
  if (state.visitedValues > MAX_JSON_VISITED_VALUES) {
    return issue('too_many_values', source, 'JSON value contains too many nested values', value);
  }

  if (value === undefined) return issue('undefined', source, 'JSON must not contain undefined', value);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? undefined
      : issue('non_finite_number', source, 'JSON numbers must be finite', value);
  }
  if (!isObjectLike(value)) {
    return issue(
      'non_json_value',
      source,
      'JSON must contain only null, booleans, numbers, strings, arrays, and objects',
      value
    );
  }
  if (nodeUtilTypes.isProxy(value)) {
    return issue('proxy', source, 'JSON must not contain proxies', value);
  }
  if (typeof value === 'function') {
    return issue('non_json_value', source, 'JSON must not contain functions', value);
  }
  if (depth >= MAX_JSON_DEPTH) {
    return issue('depth', source, `JSON nesting must not exceed ${MAX_JSON_DEPTH} levels`, value);
  }
  if (state.ancestors.has(value)) {
    return issue('cycle', source, 'Cyclic JSON is not supported', value);
  }

  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  const validPrototype = isArray ? prototype === Array.prototype : prototype === Object.prototype || prototype === null;
  if (!validPrototype) {
    return issue('custom_prototype', source, 'JSON must use only plain objects and arrays', value);
  }
  if (isArray && value.length > MAX_JSON_ARRAY_LENGTH) {
    if (Object.getOwnPropertyDescriptor(value, '0') === undefined) {
      return issue('sparse_array', `${source}[0]`, 'JSON arrays must be dense', undefined);
    }
    return issue('array_too_large', source, `JSON arrays must not exceed ${MAX_JSON_ARRAY_LENGTH} items`, value);
  }

  const ownKeys = Reflect.ownKeys(value);
  const effectiveOwnKeyCount = ownKeys.length - (isArray && ownKeys.includes('length') ? 1 : 0);
  if (effectiveOwnKeyCount > MAX_JSON_OWN_PROPERTIES) {
    return issue(
      'too_many_properties',
      source,
      `JSON containers must not exceed ${MAX_JSON_OWN_PROPERTIES} own properties`,
      value
    );
  }

  state.ancestors.add(value);
  try {
    let expectedArrayIndex = 0;
    for (const key of ownKeys) {
      if (typeof key === 'symbol') {
        return issue('symbol_property', source, 'JSON must not contain symbol properties', value);
      }
      if (isArray && key === 'length') continue;
      if (key.length > MAX_JSON_PROPERTY_NAME_LENGTH) {
        return issue(
          'oversized_property_name',
          source,
          `JSON property names must not exceed ${MAX_JSON_PROPERTY_NAME_LENGTH} characters`,
          value
        );
      }

      const path = childPath(source, key, isArray);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        return issue('non_data_property', path, 'JSON properties must have stable data descriptors', value);
      }
      if (!('value' in descriptor)) {
        return issue('accessor', path, 'JSON must not contain accessors', value);
      }
      if (!descriptor.enumerable) {
        return issue('non_enumerable_property', path, 'JSON properties must be enumerable', descriptor.value);
      }

      if (isArray) {
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= value.length) {
          return issue(
            'custom_array_property',
            path,
            'JSON arrays must not contain custom properties',
            descriptor.value
          );
        }
        if (index !== expectedArrayIndex) {
          return issue('sparse_array', `${source}[${expectedArrayIndex}]`, 'JSON arrays must be dense', undefined);
        }
        expectedArrayIndex += 1;
      }

      const nested = findUnsafeJsonIssue(descriptor.value, path, state, depth + 1);
      if (nested !== undefined) return nested;
    }

    if (isArray && expectedArrayIndex !== value.length) {
      return issue('sparse_array', `${source}[${expectedArrayIndex}]`, 'JSON arrays must be dense', undefined);
    }
    return undefined;
  } finally {
    state.ancestors.delete(value);
  }
}
