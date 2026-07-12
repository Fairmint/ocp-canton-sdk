import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, OcpValidationError } from '../errors';
import { diagnosticPropertyPath } from '../errors/diagnosticValue';

export interface ArrayItemContext {
  readonly fieldPath: string;
  readonly index: number;
}

export type ArrayItemParser<T> = (value: unknown, context: ArrayItemContext) => T;

export interface ArrayCardinality {
  readonly maximum?: number;
  readonly minimum?: number;
}

export interface ArrayUniqueness<T> {
  readonly key: (value: T) => string | number;
  readonly expectedType?: string;
}

export interface ParseArraySnapshotOptions<T> {
  readonly cardinality?: ArrayCardinality;
  readonly item: ArrayItemParser<T>;
  readonly uniqueness?: ArrayUniqueness<T>;
}

function invalidArrayShape(
  fieldPath: string,
  message: string,
  expectedType: string,
  receivedValue: unknown
): OcpValidationError {
  return new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    expectedType,
    receivedValue,
  });
}

function validateCardinalityConfiguration(cardinality: ArrayCardinality): void {
  const { maximum, minimum } = cardinality;
  if (minimum !== undefined && (!Number.isSafeInteger(minimum) || minimum < 0)) {
    throw new Error('Array minimum must be a non-negative safe integer');
  }
  if (maximum !== undefined && (!Number.isSafeInteger(maximum) || maximum < 0)) {
    throw new Error('Array maximum must be a non-negative safe integer');
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new Error('Array minimum must not exceed its maximum');
  }
}

/**
 * Copy an untrusted array without invoking Proxy traps or element accessors.
 *
 * The returned array is always a fresh, dense, ordinary Array. Item validation,
 * cardinality, and schema uniqueness are applied before the snapshot is exposed.
 */
export function parseArraySnapshot<T>(value: unknown, fieldPath: string, options: ParseArraySnapshotOptions<T>): T[] {
  const cardinality = options.cardinality ?? {};
  validateCardinalityConfiguration(cardinality);

  if (nodeUtilTypes.isProxy(value)) {
    throw invalidArrayShape(
      fieldPath,
      `${fieldPath} cannot be a JavaScript Proxy`,
      'ordinary JSON array',
      'JavaScript Proxy'
    );
  }
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'array',
      receivedValue: value,
    });
  }
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be an array`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array',
      receivedValue: value,
    });
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw invalidArrayShape(
      fieldPath,
      `${fieldPath} must use the canonical Array prototype`,
      'ordinary JSON array',
      'custom array prototype'
    );
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    throw invalidArrayShape(
      diagnosticPropertyPath(fieldPath, 'length'),
      `${fieldPath}.length must be an own data property`,
      'own array length data property',
      'missing or accessor length property'
    );
  }
  const length = lengthDescriptor.value as number;
  const itemDescriptors = new Map<number, PropertyDescriptor>();

  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'length') continue;
    const propertyPath = diagnosticPropertyPath(fieldPath, key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw invalidArrayShape(
        propertyPath,
        `${propertyPath} must be an own data property`,
        'own array item data property',
        'accessor property'
      );
    }
    if (descriptor.enumerable !== true) {
      throw invalidArrayShape(
        propertyPath,
        `${propertyPath} must be enumerable`,
        'enumerable own array item data property',
        'non-enumerable property'
      );
    }

    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= length) {
      throw invalidArrayShape(
        propertyPath,
        `${propertyPath} is not a canonical array index`,
        'array index or length only',
        descriptor.value
      );
    }
    itemDescriptors.set(index, descriptor);
  }

  const symbol = Object.getOwnPropertySymbols(value)[0];
  if (symbol !== undefined) {
    const propertyPath = diagnosticPropertyPath(fieldPath, symbol);
    throw invalidArrayShape(
      propertyPath,
      `${propertyPath} is not supported on an OCF array`,
      'array without symbol properties',
      symbol
    );
  }

  if (itemDescriptors.size !== length) {
    let missingIndex = 0;
    while (itemDescriptors.has(missingIndex)) missingIndex += 1;
    const itemPath = diagnosticPropertyPath(fieldPath, String(missingIndex));
    throw new OcpValidationError(itemPath, `${itemPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'own array item data property',
      receivedValue: undefined,
    });
  }

  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      const propertyPath = diagnosticPropertyPath(fieldPath, key);
      throw invalidArrayShape(
        propertyPath,
        `${propertyPath} is inherited rather than own`,
        'own array index',
        'inherited property'
      );
    }
  }

  const { maximum, minimum } = cardinality;
  if (minimum !== undefined && length < minimum) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must contain at least ${minimum} item${minimum === 1 ? '' : 's'}`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: `array with at least ${minimum} item${minimum === 1 ? '' : 's'}`,
        receivedValue: value,
        context: { actualItems: length, minimumItems: minimum },
      }
    );
  }
  if (maximum !== undefined && length > maximum) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must contain at most ${maximum} item${maximum === 1 ? '' : 's'}`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: `array with at most ${maximum} item${maximum === 1 ? '' : 's'}`,
        receivedValue: value,
        context: { actualItems: length, maximumItems: maximum },
      }
    );
  }

  const parsed: T[] = [];
  const firstIndexByKey = new Map<string | number, number>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = itemDescriptors.get(index);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new Error(`Dense array descriptor disappeared at index ${index}`);
    }
    const itemPath = diagnosticPropertyPath(fieldPath, String(index));
    const item = options.item(descriptor.value, { fieldPath: itemPath, index });
    if (options.uniqueness !== undefined) {
      const key = options.uniqueness.key(item);
      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex !== undefined) {
        throw new OcpValidationError(itemPath, `${itemPath} duplicates array item ${firstIndex}`, {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: options.uniqueness.expectedType ?? 'unique array item',
          receivedValue: item,
          context: { duplicateIndex: index, duplicateOfIndex: firstIndex },
        });
      }
      firstIndexByKey.set(key, index);
    }
    parsed.push(item);
  }

  return parsed;
}

/** Validate one exact string array item without trimming or coercion. */
export function parseStringArrayItem(value: unknown, context: ArrayItemContext): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(context.fieldPath, `${context.fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
      context: { index: context.index },
    });
  }
  return value;
}
