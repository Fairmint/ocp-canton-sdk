import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, type OcpErrorCode } from '../../../errors';
import { toSafeDiagnosticValue } from '../../../errors/OcpError';
import { boundedDiagnosticPath } from '../../../errors/diagnosticValue';

export type PlainDataIssueKind =
  | 'accessor'
  | 'cycle'
  | 'inherited'
  | 'invalid-array'
  | 'invalid-object'
  | 'invalid-primitive'
  | 'limit'
  | 'non-enumerable'
  | 'proxy'
  | 'sparse-array'
  | 'symbol'
  | 'undefined';

/** Internal, trap-free structural failure converted by each public boundary to its own SDK error. */
export class PlainDataValidationError extends Error {
  readonly code: OcpErrorCode;
  readonly containerPath: string;
  readonly expectedType: string;
  readonly fieldPath: string;
  readonly issueKind: PlainDataIssueKind;
  readonly receivedValue: unknown;

  constructor(
    fieldPath: string,
    containerPath: string,
    message: string,
    issueKind: PlainDataIssueKind,
    receivedValue: unknown,
    code: OcpErrorCode = OcpErrorCodes.INVALID_TYPE
  ) {
    super(message);
    this.name = 'PlainDataValidationError';
    this.code = code;
    this.containerPath = containerPath;
    this.expectedType =
      issueKind === 'invalid-primitive' && code === OcpErrorCodes.INVALID_FORMAT
        ? 'finite JSON number'
        : 'plain JSON value with own enumerable data properties and dense arrays';
    this.fieldPath = fieldPath;
    this.issueKind = issueKind;
    this.receivedValue = toSafeDiagnosticValue(receivedValue);
  }
}

interface PlainDataValidationOptions {
  readonly allowUndefinedObjectProperties?: boolean;
}

interface VisitFrame {
  readonly kind: 'visit';
  readonly allowUndefined: boolean;
  readonly containerPath: string;
  readonly depth: number;
  readonly fieldPath: string;
  readonly value: unknown;
}

interface LeaveFrame {
  readonly kind: 'leave';
  readonly value: object;
}

type ValidationFrame = VisitFrame | LeaveFrame;

const PROXY_PROTOTYPE = Symbol('proxy-prototype');
const MAX_PATH_KEY_LENGTH = 128;
const MAX_PLAIN_DATA_ARRAY_LENGTH = 100_000;
const MAX_PLAIN_DATA_CONTAINER_PROPERTIES = 100_000;
const MAX_PLAIN_DATA_DEPTH = 100;
const MAX_PLAIN_DATA_PROTOTYPE_DEPTH = 100;
const MAX_PLAIN_DATA_VISITED_VALUES = 250_000;

function boundedKey(key: string): string {
  return key.length <= MAX_PATH_KEY_LENGTH ? key : `${key.slice(0, MAX_PATH_KEY_LENGTH)}…[length=${key.length}]`;
}

function propertyPath(parent: string, key: string): string {
  const diagnosticKey = boundedKey(key);
  return boundedDiagnosticPath(
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(diagnosticKey)
      ? `${parent}.${diagnosticKey}`
      : `${parent}[${JSON.stringify(diagnosticKey)}]`
  );
}

function symbolPath(parent: string, key: symbol): string {
  const { description } = key;
  const boundedDescription =
    description === undefined ? '' : description.length <= 128 ? description : `${description.slice(0, 128)}…`;
  return boundedDiagnosticPath(`${parent}[Symbol(${boundedDescription})]`);
}

function canonicalArrayIndex(key: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return undefined;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < 0xffff_ffff ? index : undefined;
}

function fail(
  fieldPath: string,
  containerPath: string,
  message: string,
  issueKind: PlainDataIssueKind,
  receivedValue: unknown,
  code?: OcpErrorCode
): never {
  throw new PlainDataValidationError(fieldPath, containerPath, message, issueKind, receivedValue, code);
}

function firstInheritedEnumerableKey(
  prototype: object,
  fieldPath: string,
  receivedValue: object
): string | symbol | undefined {
  let current: object | null = prototype;
  let depth = 0;
  while (current !== null) {
    depth += 1;
    if (depth > MAX_PLAIN_DATA_PROTOTYPE_DEPTH) {
      fail(
        fieldPath,
        fieldPath,
        `${fieldPath} prototype chain must not exceed ${MAX_PLAIN_DATA_PROTOTYPE_DEPTH} levels`,
        'limit',
        receivedValue,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }
    if (nodeUtilTypes.isProxy(current)) return PROXY_PROTOTYPE;
    const keys = Reflect.ownKeys(current);
    if (keys.length > MAX_PLAIN_DATA_CONTAINER_PROPERTIES) {
      fail(
        fieldPath,
        fieldPath,
        `${fieldPath} prototype must not contain more than ${MAX_PLAIN_DATA_CONTAINER_PROPERTIES} own properties`,
        'limit',
        receivedValue,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor?.enumerable === true) return key;
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

function validatePrototype(value: object, fieldPath: string): void {
  const expectedPrototype = Array.isArray(value) ? Array.prototype : Object.prototype;
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype === expectedPrototype || (!Array.isArray(value) && prototype === null)) return;

  if (prototype !== null) {
    const inheritedKey = firstInheritedEnumerableKey(prototype, fieldPath, value);
    if (typeof inheritedKey === 'string') {
      const diagnosticKey = boundedKey(inheritedKey);
      fail(
        propertyPath(fieldPath, inheritedKey),
        fieldPath,
        `the key '${diagnosticKey}' is inherited rather than an own property`,
        'inherited',
        value
      );
    }
    if (typeof inheritedKey === 'symbol') {
      const proxyPrototype = inheritedKey === PROXY_PROTOTYPE;
      fail(
        proxyPrototype ? fieldPath : symbolPath(fieldPath, inheritedKey),
        fieldPath,
        proxyPrototype ? `${fieldPath} must not inherit from a Proxy` : 'Inherited symbol fields are not supported',
        proxyPrototype ? 'proxy' : 'inherited',
        value
      );
    }
  }

  fail(
    fieldPath,
    fieldPath,
    `${fieldPath} must use ${Array.isArray(value) ? 'Array.prototype' : 'Object.prototype or null'}`,
    Array.isArray(value) ? 'invalid-array' : 'invalid-object',
    value
  );
}

function descriptorValue(value: object, key: PropertyKey, fieldPath: string, containerPath: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) {
    fail(fieldPath, containerPath, `${fieldPath} must be an own data property`, 'invalid-object', value);
  }
  if (!('value' in descriptor)) {
    fail(fieldPath, containerPath, `${fieldPath} must not be an accessor property`, 'accessor', value);
  }
  if (!descriptor.enumerable && key !== 'length') {
    fail(fieldPath, containerPath, `${fieldPath} must be an enumerable JSON property`, 'non-enumerable', value);
  }
  return descriptor.value;
}

function arrayChildren(value: unknown[], fieldPath: string, childDepth: number): VisitFrame[] {
  const keys = Reflect.ownKeys(value);
  if (keys.length - 1 > MAX_PLAIN_DATA_CONTAINER_PROPERTIES) {
    fail(
      fieldPath,
      fieldPath,
      `${fieldPath} must not contain more than ${MAX_PLAIN_DATA_CONTAINER_PROPERTIES} own properties`,
      'limit',
      value,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }
  const indices = new Set<number>();
  let length: number | undefined;
  for (const key of keys) {
    if (typeof key === 'symbol') {
      fail(symbolPath(fieldPath, key), fieldPath, 'Symbol array fields are not supported', 'symbol', value);
    }
    if (key === 'length') {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'number') {
        fail(`${fieldPath}.length`, fieldPath, 'Array length must be an own data property', 'invalid-array', value);
      }
      length = descriptor.value;
      continue;
    }
    const index = canonicalArrayIndex(key);
    if (index === undefined) {
      fail(propertyPath(fieldPath, key), fieldPath, 'Non-index array fields are not supported', 'invalid-array', value);
    }
    indices.add(index);
  }

  if (length === undefined) {
    fail(`${fieldPath}.length`, fieldPath, 'Array length must be an own data property', 'invalid-array', value);
  }
  if (indices.size !== length) {
    let missingIndex = 0;
    while (indices.has(missingIndex)) missingIndex += 1;
    fail(
      `${fieldPath}[${missingIndex}]`,
      fieldPath,
      'list element is missing or inherited rather than an own property',
      'sparse-array',
      value
    );
  }
  if (length > MAX_PLAIN_DATA_ARRAY_LENGTH) {
    fail(
      fieldPath,
      fieldPath,
      `${fieldPath} must not contain more than ${MAX_PLAIN_DATA_ARRAY_LENGTH} items`,
      'limit',
      value,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }

  return [...indices].map((index) => {
    const elementPath = `${fieldPath}[${index}]`;
    return {
      kind: 'visit' as const,
      allowUndefined: false,
      containerPath: fieldPath,
      depth: childDepth,
      fieldPath: elementPath,
      value: descriptorValue(value, String(index), elementPath, fieldPath),
    };
  });
}

function objectChildren(
  value: Record<PropertyKey, unknown>,
  fieldPath: string,
  childDepth: number,
  allowUndefinedObjectProperties: boolean
): VisitFrame[] {
  const children: VisitFrame[] = [];
  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_PLAIN_DATA_CONTAINER_PROPERTIES) {
    fail(
      fieldPath,
      fieldPath,
      `${fieldPath} must not contain more than ${MAX_PLAIN_DATA_CONTAINER_PROPERTIES} own properties`,
      'limit',
      value,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }
  for (const key of keys) {
    if (typeof key === 'symbol') {
      fail(symbolPath(fieldPath, key), fieldPath, 'Symbol object fields are not supported', 'symbol', value);
    }
    const childPath = propertyPath(fieldPath, key);
    children.push({
      kind: 'visit',
      allowUndefined: allowUndefinedObjectProperties,
      containerPath: fieldPath,
      depth: childDepth,
      fieldPath: childPath,
      value: descriptorValue(value, key, childPath, fieldPath),
    });
  }
  return children;
}

/**
 * Assert a complete runtime value is JSON-like without invoking getters, proxy traps, coercion hooks, or O(length)
 * sparse-array iteration. The traversal is iterative so deeply nested containers fail or complete without overflowing
 * the JavaScript call stack.
 */
export function assertPlainDataValue(
  value: unknown,
  fieldPath: string,
  options: PlainDataValidationOptions = {}
): void {
  const activeAncestors = new Set<object>();
  const completedObjects = new WeakSet<object>();
  let visitedValues = 0;
  const stack: ValidationFrame[] = [
    { kind: 'visit', allowUndefined: false, containerPath: fieldPath, depth: 0, fieldPath, value },
  ];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.kind === 'leave') {
      activeAncestors.delete(frame.value);
      completedObjects.add(frame.value);
      continue;
    }

    const current = frame.value;
    visitedValues += 1;
    if (visitedValues > MAX_PLAIN_DATA_VISITED_VALUES) {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `${fieldPath} must not contain more than ${MAX_PLAIN_DATA_VISITED_VALUES} nested values`,
        'limit',
        current,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }
    if (current === undefined) {
      if (frame.allowUndefined) continue;
      fail(frame.fieldPath, frame.containerPath, `${frame.fieldPath} must not be undefined`, 'undefined', current);
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
    if (typeof current === 'number') {
      if (Number.isFinite(current)) continue;
      fail(
        frame.fieldPath,
        frame.containerPath,
        `${frame.fieldPath} must be a finite JSON number`,
        'invalid-primitive',
        current,
        OcpErrorCodes.INVALID_FORMAT
      );
    }
    if (typeof current !== 'object') {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `${frame.fieldPath} must contain only JSON-compatible primitive values`,
        'invalid-primitive',
        current
      );
    }
    if (nodeUtilTypes.isProxy(current)) {
      fail(frame.fieldPath, frame.containerPath, `${frame.fieldPath} must not be a Proxy`, 'proxy', current);
    }
    if (activeAncestors.has(current)) {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `${frame.fieldPath} must not contain a cyclic reference`,
        'cycle',
        current,
        OcpErrorCodes.INVALID_FORMAT
      );
    }
    if (completedObjects.has(current)) continue;
    if (frame.depth >= MAX_PLAIN_DATA_DEPTH) {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `${fieldPath} nesting must not exceed ${MAX_PLAIN_DATA_DEPTH} levels`,
        'limit',
        current,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }

    validatePrototype(current, frame.fieldPath);
    const children = Array.isArray(current)
      ? arrayChildren(current, frame.fieldPath, frame.depth + 1)
      : objectChildren(
          current as Record<PropertyKey, unknown>,
          frame.fieldPath,
          frame.depth + 1,
          options.allowUndefinedObjectProperties === true
        );

    activeAncestors.add(current);
    stack.push({ kind: 'leave', value: current });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) stack.push(child);
    }
  }
}

/**
 * Clone a value that already passed {@link assertPlainDataValue} without property reads.
 * Separate source and decoder snapshots keep a mutating codec from altering either the
 * caller's object or the raw value used for the losslessness comparison.
 */
function cloneValidatedPlainDataValueInternal<T>(value: T, clones: WeakMap<object, object>): T {
  if (value === null || typeof value !== 'object') return value;
  const existing = clones.get(value);
  if (existing !== undefined) return existing as T;

  const clone: object = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  clones.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new TypeError('cloneValidatedPlainDataValue requires a validated plain data value');
    }
    Object.defineProperty(clone, key, {
      ...descriptor,
      value: cloneValidatedPlainDataValueInternal(descriptor.value, clones),
    });
  }
  return clone as T;
}

export function cloneValidatedPlainDataValue<T>(value: T): T {
  return cloneValidatedPlainDataValueInternal(value, new WeakMap<object, object>());
}
