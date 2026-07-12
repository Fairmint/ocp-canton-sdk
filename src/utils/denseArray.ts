import { types as nodeUtilTypes } from 'node:util';
import { OcpErrorCodes, OcpValidationError } from '../errors';
import { diagnosticPropertyPath } from '../errors/diagnosticValue';

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

/**
 * Validate and snapshot one untrusted JSON array without invoking Proxy traps
 * or element accessors.
 *
 * This is the single structural boundary shared by generic array consumers and
 * schema-cardinality parsing. The returned value is always a fresh, dense,
 * ordinary Array populated from inspected own data descriptors.
 */
export function snapshotDenseArrayValues(value: unknown, fieldPath: string): unknown[] {
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

  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = itemDescriptors.get(index);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new Error(`Dense array descriptor disappeared at index ${index}`);
    }
    snapshot[index] = descriptor.value;
  }
  return snapshot;
}
