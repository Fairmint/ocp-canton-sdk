import { OcpErrorCodes, OcpParseError } from '../../../errors';

export interface LosslessCodecMismatch {
  readonly decoderPath: string;
  readonly decoderMessage: string;
}

interface GeneratedDamlCodec<T> {
  readonly decoder: { runWithException(input: unknown): T };
  encode(value: T): unknown;
}

export interface LosslessDamlDecodeOptions {
  /** Root path used for exact lossy-field attribution. */
  readonly rootPath: string;
  /** Human-readable generated value name used in decoder failures. */
  readonly description: string;
  /** Source used when the generated decoder or encoder rejects the value. */
  readonly decodeSource?: string;
  /** Additional structured error context. */
  readonly context?: Readonly<Record<string, unknown>>;
  /** Direct converters historically treat a present undefined generated Optional as null. */
  readonly allowUndefinedOptional?: boolean;
  /** Direct converters may expose a historically optional empty generated list as null. */
  readonly allowNullishEmptyArray?: boolean;
}

interface LosslessDamlComparison<T> {
  /** Decoder input used for permissive direct-reader defaults. Defaults to the raw input. */
  readonly decodeInput?: unknown;
  /** Raw subtree compared with the encoded subtree. Defaults to the original helper input. */
  readonly raw?: unknown;
  /** Select the encoded subtree corresponding to `raw`. Defaults to the complete encoded value. */
  readonly encoded?: (value: unknown) => unknown;
  /** Select the decoded subtree that callers receive. Defaults to the complete decoded value. */
  readonly decoded?: (value: T) => unknown;
}

interface LosslessComparisonState {
  /** Raw object currently being compared and the encoded object at the same path. */
  readonly activeRawPairs: WeakMap<object, object>;
  /** Encoded object currently being compared and the raw object at the same path. */
  readonly activeEncodedPairs: WeakMap<object, object>;
}

/**
 * Objects returned by a successful generated decoder are safe to re-encode without decoding again.
 *
 * Re-encoding is still performed on cache hits so a caller cannot mutate a validated object and then
 * bypass losslessness checks merely because its identity was seen before.
 */
const generatedDecodedValues = new WeakSet<object>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function valueKind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function objectPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

function inheritedEnumerableField(value: object): string | undefined {
  for (const key in value) {
    if (!hasOwnField(value, key)) return key;
  }
  return undefined;
}

function symbolFieldMismatch(value: object, decoderPath: string): LosslessCodecMismatch | null {
  const symbol = Object.getOwnPropertySymbols(value)[0];
  return symbol === undefined
    ? null
    : {
        decoderPath: `${decoderPath}[${String(symbol)}]`,
        decoderMessage: 'raw symbol field cannot be represented by the generated codec',
      };
}

function customPrototypeMismatch(
  value: object,
  expectedPrototype: object,
  decoderPath: string,
  kind: 'array' | 'object'
): LosslessCodecMismatch | null {
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype === expectedPrototype || (kind === 'object' && prototype === null)) return null;

  return {
    decoderPath,
    decoderMessage: `raw ${kind} uses a custom prototype that cannot be represented by the generated codec`,
  };
}

/**
 * Find the first raw value that a generated decode/encode round trip discarded or normalized.
 *
 * Generated DAML codecs materialize omitted optionals as null, so encoded-only fields are allowed. Every field actually
 * present in the raw JSON must remain identical, and arrays/records must use ordinary JSON own-property structures.
 */
function cyclicGraphMismatch(
  raw: object,
  encoded: object,
  decoderPath: string,
  state: LosslessComparisonState
): LosslessCodecMismatch | null {
  const previousEncoded = state.activeRawPairs.get(raw);
  if (previousEncoded !== undefined) {
    return {
      decoderPath,
      decoderMessage:
        previousEncoded === encoded
          ? 'raw graph contains a cyclic reference that cannot be represented by generated DAML JSON'
          : 'raw graph contains a cyclic reference that was encoded as a different object',
    };
  }

  const previousRaw = state.activeEncodedPairs.get(encoded);
  if (previousRaw !== undefined) {
    return {
      decoderPath,
      decoderMessage:
        previousRaw === raw
          ? 'encoded graph contains a cyclic reference that cannot represent generated DAML JSON'
          : 'encoded graph contains a cyclic reference for a different raw object',
    };
  }

  return null;
}

function findLosslessCodecMismatchInternal(
  raw: unknown,
  encoded: unknown,
  decoderPath: string,
  options: {
    readonly allowUndefinedOptional?: boolean;
    readonly allowNullishEmptyArray?: boolean;
  },
  state: LosslessComparisonState
): LosslessCodecMismatch | null {
  if (Array.isArray(raw)) {
    if (!Array.isArray(encoded)) {
      return {
        decoderPath,
        decoderMessage: `raw array was decoded and encoded as ${valueKind(encoded)}`,
      };
    }

    for (let index = 0; index < raw.length; index += 1) {
      if (!hasOwnField(raw, String(index))) {
        return {
          decoderPath: `${decoderPath}[${index}]`,
          decoderMessage: 'raw array element is missing or inherited rather than an own property',
        };
      }
    }

    if (raw.length !== encoded.length) {
      return {
        decoderPath: `${decoderPath}[${Math.min(raw.length, encoded.length)}]`,
        decoderMessage: `raw array length ${raw.length} was decoded and encoded as length ${encoded.length}`,
      };
    }

    const cycleMismatch = cyclicGraphMismatch(raw, encoded, decoderPath, state);
    if (cycleMismatch) return cycleMismatch;

    state.activeRawPairs.set(raw, encoded);
    state.activeEncodedPairs.set(encoded, raw);
    try {
      for (let index = 0; index < raw.length; index += 1) {
        const mismatch = findLosslessCodecMismatchInternal(
          raw[index],
          encoded[index],
          `${decoderPath}[${index}]`,
          options,
          state
        );
        if (mismatch) return mismatch;
      }
    } finally {
      state.activeRawPairs.delete(raw);
      state.activeEncodedPairs.delete(encoded);
    }

    const canonicalIndexFields = new Set(Array.from({ length: raw.length }, (_, index) => String(index)));
    const extraField = Object.getOwnPropertyNames(raw).find(
      (field) => field !== 'length' && !canonicalIndexFields.has(field)
    );
    if (extraField !== undefined) {
      return {
        decoderPath: objectPath(decoderPath, extraField),
        decoderMessage: 'raw array field was discarded by the generated codec',
      };
    }

    const symbolMismatch = symbolFieldMismatch(raw, decoderPath);
    if (symbolMismatch) return symbolMismatch;

    const inheritedField = inheritedEnumerableField(raw);
    if (inheritedField !== undefined) {
      return {
        decoderPath: objectPath(decoderPath, inheritedField),
        decoderMessage: 'raw array field is inherited rather than an own property',
      };
    }

    return customPrototypeMismatch(raw, Array.prototype, decoderPath, 'array');
  }

  if (isRecord(raw)) {
    if (!isRecord(encoded)) {
      return {
        decoderPath,
        decoderMessage: `raw object was decoded and encoded as ${valueKind(encoded)}`,
      };
    }

    const symbolMismatch = symbolFieldMismatch(raw, decoderPath);
    if (symbolMismatch) return symbolMismatch;

    const inheritedField = inheritedEnumerableField(raw);
    if (inheritedField !== undefined) {
      return {
        decoderPath: objectPath(decoderPath, inheritedField),
        decoderMessage: 'raw field is inherited rather than an own property',
      };
    }

    const inheritedDecodedField = Object.getOwnPropertyNames(encoded).find(
      (field) => !hasOwnField(raw, field) && field in raw
    );
    if (inheritedDecodedField !== undefined) {
      return {
        decoderPath: objectPath(decoderPath, inheritedDecodedField),
        decoderMessage: 'raw field is inherited rather than an own property',
      };
    }

    const prototypeMismatch = customPrototypeMismatch(raw, Object.prototype, decoderPath, 'object');
    if (prototypeMismatch) return prototypeMismatch;

    const cycleMismatch = cyclicGraphMismatch(raw, encoded, decoderPath, state);
    if (cycleMismatch) return cycleMismatch;

    state.activeRawPairs.set(raw, encoded);
    state.activeEncodedPairs.set(encoded, raw);
    try {
      for (const key of Object.getOwnPropertyNames(raw)) {
        const childPath = objectPath(decoderPath, key);
        if (!hasOwnField(encoded, key)) {
          return {
            decoderPath: childPath,
            decoderMessage: 'raw field was discarded by the generated codec',
          };
        }

        const mismatch = findLosslessCodecMismatchInternal(raw[key], encoded[key], childPath, options, state);
        if (mismatch) return mismatch;
      }
    } finally {
      state.activeRawPairs.delete(raw);
      state.activeEncodedPairs.delete(encoded);
    }
    return null;
  }

  const valuesMatch =
    Object.is(raw, encoded) ||
    (options.allowUndefinedOptional === true && raw === undefined && encoded === null) ||
    (options.allowNullishEmptyArray === true &&
      (raw === null || raw === undefined) &&
      Array.isArray(encoded) &&
      encoded.length === 0);
  if (valuesMatch) return null;
  return {
    decoderPath,
    decoderMessage: `raw ${valueKind(raw)} was decoded and encoded as ${valueKind(encoded)}`,
  };
}

export function findLosslessCodecMismatch(
  raw: unknown,
  encoded: unknown,
  decoderPath = 'input',
  options: {
    readonly allowUndefinedOptional?: boolean;
    readonly allowNullishEmptyArray?: boolean;
  } = {}
): LosslessCodecMismatch | null {
  return findLosslessCodecMismatchInternal(raw, encoded, decoderPath, options, {
    activeRawPairs: new WeakMap<object, object>(),
    activeEncodedPairs: new WeakMap<object, object>(),
  });
}

function objectValue(value: unknown): object | undefined {
  return value !== null && typeof value === 'object' ? value : undefined;
}

/** Remember a complete generated-decoder result, including nested records and variants. */
function rememberGeneratedDecodedValue(value: unknown): void {
  const object = objectValue(value);
  if (object === undefined || generatedDecodedValues.has(object)) return;
  generatedDecodedValues.add(object);

  if (Array.isArray(value)) {
    value.forEach(rememberGeneratedDecodedValue);
    return;
  }
  Object.values(value as Record<string, unknown>).forEach(rememberGeneratedDecodedValue);
}

function generatedCodecError(
  phase: 'decode' | 'encode',
  error: unknown,
  options: LosslessDamlDecodeOptions
): OcpParseError {
  const message = error instanceof Error ? error.message : String(error);
  return new OcpParseError(`Invalid generated DAML ${options.description}: ${phase} failed: ${message}`, {
    source: options.decodeSource ?? options.rootPath,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      ...options.context,
      phase,
      rootPath: options.rootPath,
    },
  });
}

function lossyDamlDecodeError(mismatch: LosslessCodecMismatch, options: LosslessDamlDecodeOptions): OcpParseError {
  const suffix = mismatch.decoderPath === 'input' ? '' : mismatch.decoderPath.slice('input'.length);
  const fieldPath = `${options.rootPath}${suffix}`;
  return new OcpParseError(
    `Generated DAML decoding for ${options.description} was lossy at ${fieldPath}: ${mismatch.decoderMessage}`,
    {
      source: fieldPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      context: {
        ...options.context,
        fieldPath,
        decoderPath: mismatch.decoderPath,
        decoderMessage: mismatch.decoderMessage,
      },
    }
  );
}

/** Compare a raw generated value with its encoded form and preserve exact lossy-field diagnostics. */
export function assertLosslessGeneratedDamlRoundTrip(
  raw: unknown,
  encoded: unknown,
  options: LosslessDamlDecodeOptions
): void {
  const mismatch = findLosslessCodecMismatch(raw, encoded, 'input', {
    ...(options.allowUndefinedOptional !== undefined ? { allowUndefinedOptional: options.allowUndefinedOptional } : {}),
    ...(options.allowNullishEmptyArray !== undefined ? { allowNullishEmptyArray: options.allowNullishEmptyArray } : {}),
  });
  if (mismatch) throw lossyDamlDecodeError(mismatch, options);
}

/**
 * Decode and re-encode one generated DAML value, rejecting every discarded or normalized raw field.
 *
 * Values already returned by a generated decoder skip the second decode but are always re-encoded
 * and compared again. This keeps generic -> native conversion single-decode and remains safe after
 * caller mutation.
 */
export function decodeLosslessGeneratedDamlValue<T>(
  codec: GeneratedDamlCodec<T>,
  input: unknown,
  options: LosslessDamlDecodeOptions,
  comparison: LosslessDamlComparison<T> = {}
): T {
  const inputObject = objectValue(input);
  let decoded: T;
  if (inputObject !== undefined && generatedDecodedValues.has(inputObject)) {
    decoded = input as T;
  } else {
    const decodeInput = Object.prototype.hasOwnProperty.call(comparison, 'decodeInput')
      ? comparison.decodeInput
      : input;
    try {
      decoded = codec.decoder.runWithException(decodeInput);
    } catch (error) {
      throw generatedCodecError('decode', error, options);
    }
  }

  let encoded: unknown;
  try {
    encoded = codec.encode(decoded);
  } catch (error) {
    throw generatedCodecError('encode', error, options);
  }

  const rawComparison = comparison.raw === undefined ? input : comparison.raw;
  const encodedComparison = comparison.encoded === undefined ? encoded : comparison.encoded(encoded);
  assertLosslessGeneratedDamlRoundTrip(rawComparison, encodedComparison, options);

  const decodedComparison = comparison.decoded === undefined ? decoded : comparison.decoded(decoded);
  rememberGeneratedDecodedValue(decodedComparison);
  return decoded;
}
