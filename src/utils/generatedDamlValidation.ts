import { types as nodeUtilTypes } from 'node:util';

import { OcpErrorCodes, OcpParseError } from '../errors';
import { toSafeDiagnosticValue } from '../errors/OcpError';

interface GeneratedDamlCodec<T> {
  decode(input: unknown): T;
  encode(value: T): unknown;
}

interface DecodeGeneratedDamlOptions {
  classification?: string;
  context?: Record<string, unknown>;
}

function boundedReceivedValue(value: unknown): unknown {
  return toSafeDiagnosticValue(value);
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function rejectProxy(value: unknown, source: string): void {
  if (isObjectLike(value) && nodeUtilTypes.isProxy(value)) {
    invalidGeneratedJson(source, 'Generated DAML JSON must not contain proxies', value);
  }
}

function invalidGeneratedJson(
  source: string,
  message: string,
  receivedValue: unknown,
  classification = 'invalid_generated_daml_json'
): never {
  throw new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification,
    context: { receivedValue: boundedReceivedValue(receivedValue) },
  });
}

function propertyPath(parent: string, key: PropertyKey): string {
  return typeof key === 'string' ? `${parent}.${key}` : parent;
}

/**
 * Ensure a purported ledger payload is ordinary JSON before any property is read.
 *
 * This rejects accessors, custom prototypes, sparse arrays, symbols, cycles, and
 * non-JSON primitive values. Besides making the conversion boundary predictable,
 * it prevents getters or proxy-like class instances from running inside decoders.
 */
export function assertSafeGeneratedDamlJson(value: unknown, source: string, ancestors = new WeakSet<object>()): void {
  rejectProxy(value, source);
  if (value === undefined) {
    return invalidGeneratedJson(source, 'Generated DAML JSON must not contain undefined', value);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return invalidGeneratedJson(source, 'Generated DAML JSON numbers must be finite', value);
    }
    return;
  }
  if (typeof value !== 'object') {
    return invalidGeneratedJson(source, 'Generated DAML payload must contain only JSON values', value);
  }
  if (ancestors.has(value)) {
    return invalidGeneratedJson(source, 'Cyclic generated DAML JSON is not supported', value, 'cyclic_ledger_json');
  }

  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  const hasValidPrototype = isArray
    ? prototype === Array.prototype
    : prototype === Object.prototype || prototype === null;
  if (!hasValidPrototype) {
    return invalidGeneratedJson(source, 'Generated DAML JSON must use only plain objects and arrays', value);
  }

  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  let expectedArrayIndex = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === 'symbol') {
      return invalidGeneratedJson(source, 'Generated DAML JSON must not contain symbol properties', value);
    }
    if (isArray && key === 'length') continue;

    const descriptor = descriptors[key];
    const childPath = propertyPath(source, key);
    if (!('value' in descriptor)) {
      return invalidGeneratedJson(childPath, 'Generated DAML JSON must not contain accessors', value);
    }
    if (!descriptor.enumerable) {
      return invalidGeneratedJson(childPath, 'Generated DAML JSON properties must be enumerable', descriptor.value);
    }
    if (isArray) {
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= value.length) {
        return invalidGeneratedJson(
          childPath,
          'Generated DAML arrays must not contain custom properties',
          descriptor.value
        );
      }
      if (index !== expectedArrayIndex) {
        return invalidGeneratedJson(
          `${source}[${expectedArrayIndex}]`,
          'Generated DAML arrays must be dense',
          undefined
        );
      }
      expectedArrayIndex += 1;
    }
    assertSafeGeneratedDamlJson(descriptor.value, isArray ? `${source}[${key}]` : childPath, ancestors);
  }

  if (isArray && expectedArrayIndex !== value.length) {
    return invalidGeneratedJson(`${source}[${expectedArrayIndex}]`, 'Generated DAML arrays must be dense', undefined);
  }
  ancestors.delete(value);
}

function firstLossyPath(source: unknown, encoded: unknown, fieldPath: string): string | undefined {
  rejectProxy(source, fieldPath);
  rejectProxy(encoded, fieldPath);
  if (source === null || typeof source !== 'object') {
    return Object.is(source, encoded) ? undefined : fieldPath;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(encoded) || source.length !== encoded.length) return fieldPath;
    for (let index = 0; index < source.length; index += 1) {
      const mismatch = firstLossyPath(source[index], encoded[index], `${fieldPath}[${index}]`);
      if (mismatch !== undefined) return mismatch;
    }
    return undefined;
  }
  if (encoded === null || typeof encoded !== 'object' || Array.isArray(encoded)) return fieldPath;

  const encodedRecord = encoded as Record<string, unknown>;
  for (const [key, child] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(encodedRecord, key)) return `${fieldPath}.${key}`;
    const mismatch = firstLossyPath(child, encodedRecord[key], `${fieldPath}.${key}`);
    if (mismatch !== undefined) return mismatch;
  }
  return undefined;
}

/** Decode through a generated codec and prove that encoding it cannot discard or alter source JSON. */
export function decodeGeneratedDaml<T>(
  input: unknown,
  codec: GeneratedDamlCodec<T>,
  source: string,
  options: DecodeGeneratedDamlOptions = {}
): T {
  assertSafeGeneratedDamlJson(input, source);

  let decoded: T;
  try {
    decoded = codec.decode(input);
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    const detail = cause?.message ?? String(error);
    throw new OcpParseError(`Invalid generated DAML data at ${source}: ${detail}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: options.classification ?? 'invalid_generated_daml_data',
      ...(cause ? { cause } : {}),
      context: options.context,
    });
  }

  let encoded: unknown;
  try {
    encoded = codec.encode(decoded);
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    const detail = cause?.message ?? String(error);
    throw new OcpParseError(`Unable to encode generated DAML data at ${source}: ${detail}`, {
      source,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'invalid_generated_daml_encoding',
      ...(cause ? { cause } : {}),
      context: options.context,
    });
  }
  assertSafeGeneratedDamlJson(encoded, `${source}.__encoded`);
  const lossyPath = firstLossyPath(input, encoded, source);
  if (lossyPath !== undefined) {
    throw new OcpParseError(`Generated DAML decoding would discard or alter ${lossyPath}`, {
      source: lossyPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_generated_decode',
      context: options.context,
    });
  }
  return decoded;
}

export function requireGeneratedRecord(value: unknown, source: string): Record<string, unknown> {
  if (value === undefined) {
    throw new OcpParseError('Required generated DAML record is missing', {
      source,
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      context: { receivedValue: value },
    });
  }
  rejectProxy(value, source);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalidGeneratedJson(source, 'Generated DAML value must be a record', value);
  }
  return value as Record<string, unknown>;
}

export function rejectUnknownGeneratedFields(
  value: Record<string, unknown>,
  source: string,
  allowedFields: readonly string[]
): void {
  rejectProxy(value, source);
  const allowed = new Set(allowedFields);
  const unknownField = Object.keys(value).find((field) => !allowed.has(field));
  if (unknownField !== undefined) {
    return invalidGeneratedJson(
      `${source}.${unknownField}`,
      `Unexpected generated DAML field ${unknownField}`,
      value[unknownField]
    );
  }
}

export function requireGeneratedString(value: unknown, source: string): string {
  if (value === undefined) {
    throw new OcpParseError('Required generated DAML Text is missing', {
      source,
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      context: { receivedValue: value },
    });
  }
  if (typeof value !== 'string') {
    return invalidGeneratedJson(source, 'Generated DAML Text must be a string', value);
  }
  return value;
}

export function requireGeneratedArray(value: unknown, source: string): unknown[] {
  if (value === undefined) {
    throw new OcpParseError('Required generated DAML List is missing', {
      source,
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      context: { receivedValue: value },
    });
  }
  rejectProxy(value, source);
  if (!Array.isArray(value)) {
    return invalidGeneratedJson(source, 'Generated DAML List must be an array', value);
  }
  return value;
}

export function requireGeneratedStringArray(value: unknown, source: string): string[] {
  const array = requireGeneratedArray(value, source);
  return array.map((item, index) => requireGeneratedString(item, `${source}[${index}]`));
}

export interface GeneratedCreateArgumentShape {
  readonly dataField: string;
  readonly fallbackDataFields?: readonly string[];
}

function generatedWrapperMismatch(source: string, message: string, context?: Record<string, unknown>): never {
  throw new OcpParseError(message, {
    source,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    classification: 'invalid_generated_create_argument',
    context,
  });
}

/**
 * Validate an exact generated template create-argument wrapper and return its data record.
 *
 * Generated OCP templates share the canonical `{ context, *_data }` shape. The
 * context and data wrappers are validated before any field is read, and exactly
 * one canonical/fallback data field must be present.
 */
export function extractGeneratedCreateArgumentData(
  createArgument: unknown,
  source: string,
  shape: GeneratedCreateArgumentShape
): Record<string, unknown> {
  assertSafeGeneratedDamlJson(createArgument, source);
  const argument = requireGeneratedRecord(createArgument, source);
  const candidateDataFields = [shape.dataField, ...(shape.fallbackDataFields ?? [])];
  rejectUnknownGeneratedFields(argument, source, ['context', ...candidateDataFields]);

  const contextPath = `${source}.context`;
  if (!Object.prototype.hasOwnProperty.call(argument, 'context')) {
    return generatedWrapperMismatch(contextPath, 'Generated createArgument is missing its canonical context');
  }
  const context = requireGeneratedRecord(argument.context, contextPath);
  rejectUnknownGeneratedFields(context, contextPath, ['issuer', 'system_operator']);
  for (const field of ['issuer', 'system_operator'] as const) {
    const fieldPath = `${contextPath}.${field}`;
    if (!Object.prototype.hasOwnProperty.call(context, field)) {
      return generatedWrapperMismatch(fieldPath, `Generated createArgument context is missing ${field}`);
    }
    if (typeof context[field] !== 'string') {
      return generatedWrapperMismatch(fieldPath, `Generated createArgument context ${field} must be a string`, {
        receivedValue: context[field],
      });
    }
  }

  const presentDataFields = candidateDataFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(argument, field)
  );
  if (presentDataFields.length === 0) {
    return generatedWrapperMismatch(
      `${source}.${shape.dataField}`,
      `Generated createArgument is missing data field ${shape.dataField}`,
      { expectedDataFields: candidateDataFields }
    );
  }
  if (presentDataFields.length > 1) {
    return generatedWrapperMismatch(source, 'Generated createArgument contains ambiguous data fields', {
      presentDataFields,
    });
  }

  const dataField = presentDataFields[0];
  return requireGeneratedRecord(argument[dataField], `${source}.${dataField}`);
}
