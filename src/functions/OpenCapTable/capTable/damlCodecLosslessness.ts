export interface LosslessCodecMismatch {
  readonly decoderPath: string;
  readonly decoderMessage: string;
}

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
 * Encoded-only fields are allowed because generated DAML codecs materialize omitted optional values as null. Every field
 * actually present in the raw JSON value must remain identical, and the raw value must use JSON-like own-property
 * structures so inherited or sparse data cannot be consumed invisibly by a generated decoder.
 */
export function findLosslessCodecMismatch(
  raw: unknown,
  encoded: unknown,
  decoderPath = 'input'
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

    for (let index = 0; index < raw.length; index += 1) {
      const mismatch = findLosslessCodecMismatch(raw[index], encoded[index], `${decoderPath}[${index}]`);
      if (mismatch) return mismatch;
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

    for (const key of Object.getOwnPropertyNames(raw)) {
      const childPath = objectPath(decoderPath, key);
      if (!hasOwnField(encoded, key)) {
        return {
          decoderPath: childPath,
          decoderMessage: 'raw field was discarded by the generated codec',
        };
      }

      const mismatch = findLosslessCodecMismatch(raw[key], encoded[key], childPath);
      if (mismatch) return mismatch;
    }
    return null;
  }

  return Object.is(raw, encoded)
    ? null
    : {
        decoderPath,
        decoderMessage: `raw ${valueKind(raw)} was decoded and encoded as ${valueKind(encoded)}`,
      };
}
