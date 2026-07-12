import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, type OcpErrorCode } from '../../../errors';
import { boundedDiagnosticPath } from '../../../errors/diagnosticValue';
import { toSafeDiagnosticValue } from '../../../errors/OcpError';

export type PlainDataIssueKind =
  | 'accessor'
  | 'cycle'
  | 'inherited'
  | 'invalid-array'
  | 'invalid-object'
  | 'invalid-primitive'
  | 'non-enumerable'
  | 'proxy'
  | 'sparse-array'
  | 'symbol'
  | 'too-deep'
  | 'too-large'
  | 'undefined';

/** Defensive limits applied before generated codecs or recursive losslessness checks run. */
export const PLAIN_DATA_LIMITS = {
  maxArrayLength: 20_000,
  maxDepth: 128,
  maxNodes: 200_000,
  maxObjectProperties: 20_000,
} as const;

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
    this.containerPath = boundedDiagnosticPath(containerPath);
    this.expectedType =
      issueKind === 'invalid-primitive' && code === OcpErrorCodes.INVALID_FORMAT
        ? 'finite JSON number'
        : issueKind === 'too-deep'
          ? `plain JSON value nested at most ${PLAIN_DATA_LIMITS.maxDepth} levels`
          : issueKind === 'too-large'
            ? 'plain JSON value within SDK container and node limits'
            : 'plain JSON value with own enumerable data properties and dense arrays';
    this.fieldPath = boundedDiagnosticPath(fieldPath);
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

function boundedKey(key: string): string {
  return key.length <= MAX_PATH_KEY_LENGTH ? key : `${key.slice(0, MAX_PATH_KEY_LENGTH)}…[length=${key.length}]`;
}

function propertyPath(parent: string, key: string): string {
  const diagnosticKey = boundedKey(key);
  const path = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(diagnosticKey)
    ? `${boundedDiagnosticPath(parent)}.${diagnosticKey}`
    : `${boundedDiagnosticPath(parent)}[${JSON.stringify(diagnosticKey)}]`;
  return boundedDiagnosticPath(path);
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

function firstInheritedEnumerableKey(prototype: object): string | symbol | undefined {
  let current: object | null = prototype;
  while (current !== null) {
    if (nodeUtilTypes.isProxy(current)) return PROXY_PROTOTYPE;
    for (const key of Reflect.ownKeys(current)) {
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
    const inheritedKey = firstInheritedEnumerableKey(prototype);
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

function arrayChildren(value: unknown[], fieldPath: string, depth: number): VisitFrame[] {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || typeof lengthDescriptor.value !== 'number') {
    fail(`${fieldPath}.length`, fieldPath, 'Array length must be an own data property', 'invalid-array', value);
  }
  if (lengthDescriptor.value > PLAIN_DATA_LIMITS.maxArrayLength) {
    fail(
      `${fieldPath}.length`,
      fieldPath,
      `${fieldPath} must contain at most ${PLAIN_DATA_LIMITS.maxArrayLength} elements`,
      'too-large',
      lengthDescriptor.value,
      OcpErrorCodes.OUT_OF_RANGE
    );
  }

  const keys = Reflect.ownKeys(value);
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

  return [...indices].map((index) => {
    const elementPath = `${fieldPath}[${index}]`;
    return {
      kind: 'visit' as const,
      allowUndefined: false,
      containerPath: fieldPath,
      depth: depth + 1,
      fieldPath: elementPath,
      value: descriptorValue(value, String(index), elementPath, fieldPath),
    };
  });
}

function objectChildren(
  value: Record<PropertyKey, unknown>,
  fieldPath: string,
  allowUndefinedObjectProperties: boolean,
  depth: number
): VisitFrame[] {
  const children: VisitFrame[] = [];
  const keys = Reflect.ownKeys(value);
  if (keys.length > PLAIN_DATA_LIMITS.maxObjectProperties) {
    fail(
      fieldPath,
      fieldPath,
      `${fieldPath} must contain at most ${PLAIN_DATA_LIMITS.maxObjectProperties} properties`,
      'too-large',
      keys.length,
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
      depth: depth + 1,
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
  const stack: ValidationFrame[] = [
    { kind: 'visit', allowUndefined: false, containerPath: fieldPath, depth: 0, fieldPath, value },
  ];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.kind === 'leave') {
      activeAncestors.delete(frame.value);
      completedObjects.add(frame.value);
      continue;
    }

    visitedNodes += 1;
    if (visitedNodes > PLAIN_DATA_LIMITS.maxNodes) {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `Plain JSON input must contain at most ${PLAIN_DATA_LIMITS.maxNodes} values`,
        'too-large',
        visitedNodes,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }
    if (frame.depth > PLAIN_DATA_LIMITS.maxDepth) {
      fail(
        frame.fieldPath,
        frame.containerPath,
        `Plain JSON input must be nested at most ${PLAIN_DATA_LIMITS.maxDepth} levels`,
        'too-deep',
        frame.depth,
        OcpErrorCodes.OUT_OF_RANGE
      );
    }

    const current = frame.value;
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

    validatePrototype(current, frame.fieldPath);
    const children = Array.isArray(current)
      ? arrayChildren(current, frame.fieldPath, frame.depth)
      : objectChildren(
          current as Record<PropertyKey, unknown>,
          frame.fieldPath,
          options.allowUndefinedObjectProperties === true,
          frame.depth
        );

    activeAncestors.add(current);
    stack.push({ kind: 'leave', value: current });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) stack.push(child);
    }
  }
}
