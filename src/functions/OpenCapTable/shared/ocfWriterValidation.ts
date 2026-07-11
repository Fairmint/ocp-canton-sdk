import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import type { OcfDataTypeFor, OcfEntityType } from '../capTable/entityTypes';

function pathFor(parent: string, key: string | number): string {
  return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

function symbolPathFor(parent: string, key: symbol): string {
  return `${parent}[${String(key)}]`;
}

function boundedValueSummary(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length <= 128 ? value : { kind: 'string', length: value.length, preview: value.slice(0, 128) };
  }
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') return { kind: 'bigint', value: value.toString() };
  if (typeof value === 'symbol') return { kind: 'symbol', value: String(value) };
  if (typeof value === 'function') {
    const nameDescriptor = Object.getOwnPropertyDescriptor(value, 'name');
    return {
      kind: 'function',
      name: nameDescriptor !== undefined && 'value' in nameDescriptor ? String(nameDescriptor.value) : null,
    };
  }

  const ownKeyCount = Reflect.ownKeys(value).length;
  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    return {
      kind: 'array',
      length: lengthDescriptor !== undefined && 'value' in lengthDescriptor ? lengthDescriptor.value : null,
      ownKeyCount,
    };
  }
  return { kind: 'object', ownKeyCount };
}

function rejectProxy(value: unknown, fieldPath: string): void {
  if (value !== null && (typeof value === 'object' || typeof value === 'function') && nodeUtilTypes.isProxy(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must not be a Proxy`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'plain non-Proxy JSON value',
      receivedValue: { kind: 'proxy' },
    });
  }
}

function invalidStructure(fieldPath: string, message: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType: 'plain JSON value with own properties and dense arrays',
    receivedValue: boundedValueSummary(receivedValue),
  });
}

function descriptorValue(object: object, key: PropertyKey, fieldPath: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) {
    invalidStructure(fieldPath, `${fieldPath} must be an own data property`, object);
  }
  if (!('value' in descriptor)) {
    invalidStructure(fieldPath, `${fieldPath} must not be an accessor property`, object);
  }
  if (!descriptor.enumerable && key !== 'length') {
    invalidStructure(fieldPath, `${fieldPath} must be an enumerable JSON property`, object);
  }
  return descriptor.value;
}

function canonicalArrayIndex(key: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return undefined;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < 0xffff_ffff ? index : undefined;
}

function assertPlainJsonValue(
  value: unknown,
  fieldPath: string,
  ancestors: Set<object>,
  allowUndefinedProperty: boolean
): void {
  rejectProxy(value, fieldPath);
  if (value === undefined) {
    if (allowUndefinedProperty) return;
    invalidStructure(fieldPath, `${fieldPath} must not be an undefined array element`, value);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a finite JSON number`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'finite JSON number',
      receivedValue: value,
    });
  }
  if (typeof value !== 'object') {
    invalidStructure(fieldPath, `${fieldPath} must contain only JSON-compatible primitive values`, value);
  }
  if (ancestors.has(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must not contain a cyclic reference`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'acyclic JSON value',
      receivedValue: boundedValueSummary(value),
    });
  }

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      invalidStructure(fieldPath, `${fieldPath} must be a plain array`, value);
    }

    const keys = Reflect.ownKeys(value);
    const indices = new Set<number>();
    let length: number | undefined;
    for (const key of keys) {
      if (typeof key === 'symbol') {
        invalidStructure(symbolPathFor(fieldPath, key), 'Symbol array fields are not supported', value);
      }
      if (key === 'length') {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !('value' in descriptor) || typeof descriptor.value !== 'number') {
          invalidStructure(`${fieldPath}.length`, 'Array length must be an own data property', value);
        }
        length = descriptor.value;
        continue;
      }
      const index = canonicalArrayIndex(key);
      if (index === undefined) {
        invalidStructure(
          pathFor(fieldPath, key),
          'Array fields beyond canonical numeric elements are not supported',
          value
        );
      }
      indices.add(index);
    }

    if (length === undefined) {
      invalidStructure(`${fieldPath}.length`, 'Array length must be an own data property', value);
    }
    if (indices.size !== length) {
      let missingIndex = 0;
      while (indices.has(missingIndex)) missingIndex += 1;
      invalidStructure(pathFor(fieldPath, missingIndex), 'Array elements must be dense own properties', value);
    }
    for (const index of indices) {
      const elementPath = pathFor(fieldPath, index);
      assertPlainJsonValue(descriptorValue(value, String(index), elementPath), elementPath, nextAncestors, false);
    }
    return;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  for (const field in value) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      invalidStructure(pathFor(fieldPath, field), 'Inherited object fields are not supported', value);
    }
  }
  if (prototype !== Object.prototype && prototype !== null) {
    invalidStructure(fieldPath, `${fieldPath} must be a plain object`, value);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      invalidStructure(symbolPathFor(fieldPath, key), 'Symbol object fields are not supported', value);
    }
    const propertyPath = pathFor(fieldPath, key);
    assertPlainJsonValue(descriptorValue(value, key, propertyPath), propertyPath, nextAncestors, true);
  }
}

/** Require one direct writer input to use only lossless JSON-like own-property structures. */
export function requirePlainWriterInput(value: unknown, fieldPath: string): Record<string, unknown> {
  rejectProxy(value, fieldPath);
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'plain JSON object',
      receivedValue: value,
    });
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidStructure(fieldPath, `${fieldPath} must be a plain object`, value);
  }
  assertPlainJsonValue(value, fieldPath, new Set(), false);
  return value as Record<string, unknown>;
}

/** Require a dense plain array before a writer maps it. */
export function requireWriterArray(value: unknown, fieldPath: string): readonly unknown[] {
  rejectProxy(value, fieldPath);
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'dense plain array',
      receivedValue: value,
    });
  }
  if (!Array.isArray(value)) {
    invalidStructure(fieldPath, `${fieldPath} must be an array`, value);
  }
  assertPlainJsonValue(value, fieldPath, new Set(), false);
  return value;
}

/** Require an optional dense array, rejecting explicit null. */
export function optionalWriterArray(value: unknown, fieldPath: string): readonly unknown[] {
  if (value === undefined) return [];
  return requireWriterArray(value, fieldPath);
}

/** Require a non-empty string for fields whose reader contract has the same invariant. */
export function requireWriterString(value: unknown, fieldPath: string): string {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a non-empty string`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** Validate the complete canonical OCF shape after contextual writer conversions have run. */
export function validateCanonicalWriterInput<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  objectType: OcfDataTypeFor<EntityType>['object_type'],
  input: Record<string, unknown>,
  fieldPath: string
): void {
  const receivedObjectType = input.object_type;
  if (receivedObjectType !== undefined && receivedObjectType !== objectType) {
    throw new OcpValidationError(`${fieldPath}.object_type`, `${fieldPath}.object_type must be ${objectType}`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: objectType,
      receivedValue: receivedObjectType,
    });
  }
  parseOcfEntityInput(entityType, { ...input, object_type: objectType });
}

/** Encode optional comments without dropping schema-valid empty strings. */
export function commentsToDaml(value: unknown, fieldPath: string): string[] {
  const comments = optionalWriterArray(value, fieldPath);
  return comments.map((comment, index) => {
    if (typeof comment !== 'string') {
      throw new OcpValidationError(pathFor(fieldPath, index), 'Comment must be a string', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string',
        receivedValue: comment,
      });
    }
    return comment;
  });
}

/** Encode security exemptions without accepting inherited, sparse, or incomplete records. */
export function securityLawExemptionsToDaml(
  value: unknown,
  fieldPath: string
): Array<{ description: string; jurisdiction: string }> {
  const exemptions = requireWriterArray(value, fieldPath);
  return exemptions.map((exemption, index) => {
    const path = pathFor(fieldPath, index);
    const record = requirePlainWriterInput(exemption, path);
    for (const field of ['description', 'jurisdiction'] as const) {
      requireWriterString(record[field], pathFor(path, field));
    }
    return { description: record.description as string, jurisdiction: record.jurisdiction as string };
  });
}
