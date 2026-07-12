import { types as nodeUtilTypes } from 'node:util';

import { OcpErrorCodes, OcpValidationError } from '../errors';

export type ExactDataFailureReason =
  | 'invalid_type'
  | 'proxy'
  | 'non_plain_prototype'
  | 'symbol_key'
  | 'unknown_key'
  | 'accessor'
  | 'reflection_error'
  | 'sparse_array'
  | 'array_too_large';

export interface ExactDataFailure {
  readonly ok: false;
  readonly reason: ExactDataFailureReason;
  readonly key: PropertyKey | undefined;
  readonly receivedValue: unknown;
}

export interface ExactObjectSnapshot {
  readonly keys: readonly string[];
  has(key: string): boolean;
  get(key: string): unknown;
}

export interface ExactObjectSuccess {
  readonly ok: true;
  readonly snapshot: ExactObjectSnapshot;
}

export type ExactObjectInspection = ExactObjectSuccess | ExactDataFailure;

export interface InspectExactObjectOptions {
  /** When omitted, every own string key is accepted. */
  readonly allowedKeys?: ReadonlySet<string>;
}

export interface ExactDataValidationErrorOptions {
  readonly message: string;
  readonly expectedType: string;
}

function failure(reason: ExactDataFailureReason, receivedValue: unknown, key?: PropertyKey): ExactDataFailure {
  return Object.freeze({ ok: false, reason, key, receivedValue });
}

/** Convert a descriptor-safe inspection failure into the SDK's structured validation error shape. */
export function toExactDataValidationError(
  root: string,
  inspectionFailure: ExactDataFailure,
  options: ExactDataValidationErrorOptions
): OcpValidationError {
  const fieldPath = typeof inspectionFailure.key === 'string' ? `${root}.${inspectionFailure.key}` : root;
  return new OcpValidationError(fieldPath, options.message, {
    code: inspectionFailure.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
    expectedType: options.expectedType,
    receivedValue: inspectionFailure.receivedValue,
    context: { reason: inspectionFailure.reason },
  });
}

function objectSnapshot(values: ReadonlyMap<string, unknown>, keys: readonly string[]): ExactObjectSnapshot {
  const frozenKeys = Object.freeze([...keys]);
  return Object.freeze({
    keys: frozenKeys,
    has: (key: string): boolean => values.has(key),
    get: (key: string): unknown => values.get(key),
  });
}

/**
 * Read an exact plain object through own data descriptors only.
 *
 * Proxies are rejected before reflection, accessors are never invoked, custom
 * prototypes cannot contribute inherited configuration, and every accepted
 * value is read exactly once from its descriptor.
 */
export function inspectExactObject(value: unknown, options: InspectExactObjectOptions = {}): ExactObjectInspection {
  if (typeof value !== 'object' || value === null) {
    return failure('invalid_type', value);
  }
  if (nodeUtilTypes.isProxy(value)) {
    return failure('proxy', value);
  }
  if (Array.isArray(value)) {
    return failure('invalid_type', value);
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return failure('non_plain_prototype', value);
    }

    const ownKeys = Reflect.ownKeys(value);
    const values = new Map<string, unknown>();
    const keys: string[] = [];
    for (const key of ownKeys) {
      if (typeof key === 'symbol') {
        return failure('symbol_key', value, key);
      }
      if (options.allowedKeys !== undefined && !options.allowedKeys.has(key)) {
        return failure('unknown_key', value, key);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        return failure('reflection_error', value, key);
      }
      if (!('value' in descriptor)) {
        return failure('accessor', value, key);
      }
      values.set(key, descriptor.value);
      keys.push(key);
    }

    return Object.freeze({ ok: true, snapshot: objectSnapshot(values, keys) });
  } catch {
    return failure('reflection_error', value);
  }
}

export interface ExactArraySuccess {
  readonly ok: true;
  readonly values: readonly unknown[];
}

export type ExactArrayInspection = ExactArraySuccess | ExactDataFailure;

export interface OwnDataPropertySuccess {
  readonly ok: true;
  readonly present: boolean;
  readonly value: unknown;
}

export type OwnDataPropertyInspection = OwnDataPropertySuccess | ExactDataFailure;

/** Read one own data property from an object whose other keys and prototype are intentionally unconstrained. */
export function inspectOwnDataProperty(value: unknown, key: string): OwnDataPropertyInspection {
  if (typeof value !== 'object' || value === null) {
    return failure('invalid_type', value, key);
  }
  if (nodeUtilTypes.isProxy(value)) {
    return failure('proxy', value, key);
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      return Object.freeze({ ok: true, present: false, value: undefined });
    }
    if (!('value' in descriptor)) {
      return failure('accessor', value, key);
    }
    return Object.freeze({ ok: true, present: true, value: descriptor.value });
  } catch {
    return failure('reflection_error', value, key);
  }
}

/** Validate a callable data property on an object or its prototype chain without invoking accessors. */
export function inspectCallableDataProperty(value: unknown, key: string): ExactDataFailure | { readonly ok: true } {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return failure('invalid_type', value, key);
  }
  if (nodeUtilTypes.isProxy(value)) {
    return failure('proxy', value, key);
  }
  try {
    let current: object | null = value;
    while (current !== null) {
      if (nodeUtilTypes.isProxy(current)) {
        return failure('proxy', value, key);
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor !== undefined) {
        if (!('value' in descriptor)) {
          return failure('accessor', value, key);
        }
        if (typeof descriptor.value !== 'function') {
          return failure('invalid_type', descriptor.value, key);
        }
        return nodeUtilTypes.isProxy(descriptor.value)
          ? failure('proxy', descriptor.value, key)
          : Object.freeze({ ok: true });
      }
      current = Object.getPrototypeOf(current);
    }
    return failure('unknown_key', value, key);
  } catch {
    return failure('reflection_error', value, key);
  }
}

/** Read a plain, dense array through data descriptors without invoking accessors. */
export function inspectExactArray(value: unknown, maximumLength = 10_000): ExactArrayInspection {
  if (typeof value !== 'object' || value === null) {
    return failure('invalid_type', value);
  }
  if (nodeUtilTypes.isProxy(value)) {
    return failure('proxy', value);
  }
  if (!Array.isArray(value)) {
    return failure('invalid_type', value);
  }

  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return failure('non_plain_prototype', value);
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number'
    ) {
      return failure('reflection_error', value, 'length');
    }
    const length = lengthDescriptor.value;
    if (length > maximumLength) {
      return failure('array_too_large', value, 'length');
    }

    const ownKeys = Reflect.ownKeys(value);
    const expectedKeys = new Set(['length', ...Array.from({ length }, (_unused, index) => String(index))]);
    for (const key of ownKeys) {
      if (typeof key === 'symbol') {
        return failure('symbol_key', value, key);
      }
      if (!expectedKeys.has(key)) {
        return failure('unknown_key', value, key);
      }
    }

    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        return failure('sparse_array', value, key);
      }
      if (!('value' in descriptor)) {
        return failure('accessor', value, key);
      }
      values.push(descriptor.value);
    }
    return Object.freeze({ ok: true, values: Object.freeze(values) });
  } catch {
    return failure('reflection_error', value);
  }
}
