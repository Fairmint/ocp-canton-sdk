import { Map as DamlMap, Text } from '@daml/types';

import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import { decodeGeneratedDaml } from '../../src/utils/generatedDamlValidation';

interface TestPayload {
  readonly genMap: ReadonlyArray<readonly [unknown, unknown]>;
  readonly ordered: readonly string[];
}

function encodeWith(transform: (payload: TestPayload) => unknown): {
  readonly decode: (input: unknown) => TestPayload;
  readonly encode: (payload: TestPayload) => unknown;
} {
  return {
    decode: (input) => input as TestPayload,
    encode: transform,
  };
}

describe('decodeGeneratedDaml GenMap losslessness', () => {
  test('detaches and freezes the persistent DAML Map representation returned by generated decoders', () => {
    const damlMapCodec = DamlMap(Text, Text);
    let retainedDecodedMap: ReturnType<typeof damlMapCodec.decoder.runWithException> | undefined;
    const decode = jest.fn((input: unknown) => {
      const record = input as { readonly map: unknown };
      retainedDecodedMap = damlMapCodec.decoder.runWithException(record.map);
      return { map: retainedDecodedMap };
    });

    const decoded = decodeGeneratedDaml(
      { map: [['key', 'value']] },
      {
        decode,
        encode: (value) => ({ map: damlMapCodec.encode(value.map) }),
      },
      'payload',
      { genMapPaths: ['payload.map'] }
    );

    expect(decode).toHaveBeenCalledTimes(1);
    expect(decoded.map).not.toBe(retainedDecodedMap);
    expect(decoded.map.get('key')).toBe('value');
    expect(decoded.map.set('key', 'changed').get('key')).toBe('changed');
    expect(decoded.map.get('key')).toBe('value');
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.map)).toBe(true);
    expect(Object.isFrozen((decoded.map as unknown as { _kvs: unknown })._kvs)).toBe(true);
  });

  test('compares configured GenMaps by key while preserving source insertion order', () => {
    const input: TestPayload = {
      genMap: [
        ['z-last', { value: 'z' }],
        ['__proto__', { value: 'prototype-safe' }],
        ['a-first', { value: 'a' }],
        ['constructor', { value: 'constructor-safe' }],
      ],
      ordered: ['first', 'second'],
    };
    const codec = encodeWith((payload) => ({
      ...payload,
      genMap: [...payload.genMap].sort(([left], [right]) => String(left).localeCompare(String(right))),
    }));

    const decoded = decodeGeneratedDaml(input, codec, 'payload', {
      genMapPaths: ['payload.genMap'],
    });

    expect(decoded).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.genMap)).toBe(true);
    expect(decoded.genMap.map(([key]) => key)).toEqual(['z-last', '__proto__', 'a-first', 'constructor']);
  });

  test('does not let a generated decoder mutate source evidence', () => {
    const input: TestPayload = {
      genMap: [['key', 'value']],
      ordered: ['must-remain'],
    };
    const decode = jest.fn((value: unknown): TestPayload => {
      const decoderOwned = value as Record<string, unknown>;
      delete decoderOwned.ordered;
      return decoderOwned as unknown as TestPayload;
    });

    expect(() => decodeGeneratedDaml(input, { decode, encode: (value) => value }, 'payload')).toThrow(
      expect.objectContaining({
        classification: 'lossy_generated_decode',
        source: 'payload.ordered',
      })
    );
    expect(decode.mock.calls[0]?.[0]).not.toBe(input);
    expect(input.ordered).toEqual(['must-remain']);
  });

  test('detects a decoder mutation against an independent source snapshot', () => {
    const input: TestPayload = {
      genMap: [['safe', { value: 'original' }]],
      ordered: ['first', 'second'],
    };
    const decode = jest.fn((value: unknown) => {
      const payload = value as { ordered: string[] };
      payload.ordered[0] = 'mutated';
      return value as TestPayload;
    });
    const encode = jest.fn((payload: TestPayload) => payload);

    expect(() => decodeGeneratedDaml(input, { decode, encode }, 'payload')).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_generated_decode',
        source: 'payload.ordered[0]',
      })
    );

    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode.mock.calls[0]?.[0]).not.toBe(input);
    expect(input.ordered).toEqual(['first', 'second']);
  });

  test('detaches exact JSON values without serialization or prototype setters', () => {
    const record = Object.create(null) as Record<string, { negativeZero: number }>;
    Object.defineProperty(record, '__proto__', {
      value: { negativeZero: -0 },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const input = { record };
    const decode = jest.fn((value: unknown) => value as typeof input);

    const decoded = decodeGeneratedDaml(input, { decode, encode: (value) => value }, 'payload');

    expect(decoded).not.toBe(input);
    expect(decoded.record).not.toBe(record);
    expect(Object.getPrototypeOf(decoded.record)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(decoded.record, '__proto__')).toBe(true);
    const clonedProtoKey = Object.getOwnPropertyDescriptor(decoded.record, '__proto__')?.value as
      | { negativeZero: number }
      | undefined;
    expect(Object.is(clonedProtoKey?.negativeZero, -0)).toBe(true);
  });

  test('uses collision-free structural key identities', () => {
    const input: TestPayload = {
      genMap: [
        [{ left: '1:a', right: 'b' }, { id: 'first' }],
        [{ left: '1', right: 'a:b' }, { id: 'second' }],
        [[1, '2:3'], { id: 'third' }],
      ],
      ordered: [],
    };
    const codec = encodeWith((payload) => ({
      ...payload,
      genMap: [...payload.genMap]
        .reverse()
        .map(([key, value]) => [
          key !== null && typeof key === 'object' && !Array.isArray(key)
            ? Object.fromEntries(Object.entries(key).reverse())
            : key,
          value,
        ]),
    }));

    expect(() =>
      decodeGeneratedDaml(input, codec, 'payload', {
        genMapPaths: ['payload.genMap'],
      })
    ).not.toThrow();
  });

  test('still reports actual GenMap value alteration at the original tuple path', () => {
    const input: TestPayload = {
      genMap: [
        ['z', { value: 'original-z' }],
        ['a', { value: 'original-a' }],
      ],
      ordered: [],
    };
    const codec = encodeWith((payload) => ({
      ...payload,
      genMap: [
        ['a', { value: 'original-a' }],
        ['z', { value: 'altered-z' }],
      ],
    }));

    expect(() =>
      decodeGeneratedDaml(input, codec, 'payload', {
        genMapPaths: ['payload.genMap'],
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_generated_decode',
        source: 'payload.genMap[0][1].value',
      })
    );
  });

  test('rejects duplicate semantic keys even when property order differs', () => {
    const input: TestPayload = {
      genMap: [
        [{ left: 'same', right: 'key' }, 'first'],
        [{ right: 'key', left: 'same' }, 'second'],
      ],
      ordered: [],
    };

    expect(() =>
      decodeGeneratedDaml(
        input,
        encodeWith((payload) => payload),
        'payload',
        {
          genMapPaths: ['payload.genMap'],
        }
      )
    ).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_generated_decode',
        source: 'payload.genMap[1][0]',
      })
    );
  });

  test('keeps every non-GenMap array order-sensitive', () => {
    const input: TestPayload = {
      genMap: [
        ['z', 'last'],
        ['a', 'first'],
      ],
      ordered: ['first', 'second'],
    };
    const codec = encodeWith((payload) => ({
      ...payload,
      genMap: [...payload.genMap].reverse(),
      ordered: [...payload.ordered].reverse(),
    }));

    expect(() =>
      decodeGeneratedDaml(input, codec, 'payload', {
        genMapPaths: ['payload.genMap'],
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_generated_decode',
        source: 'payload.ordered[0]',
      })
    );
  });

  test.each(['accessor', 'proxy'] as const)('rejects a %s before invoking traps or the codec', (kind) => {
    const getter = jest.fn(() => [['a', 'value']]);
    const getTrap = jest.fn(Reflect.get);
    const raw: TestPayload = { genMap: [], ordered: [] };
    const input =
      kind === 'accessor'
        ? Object.defineProperty({ ordered: [] }, 'genMap', { enumerable: true, get: getter })
        : new Proxy(raw, { get: getTrap });
    const decode = jest.fn((value: unknown) => value as TestPayload);
    const encode = jest.fn((value: TestPayload) => value);

    expect(() =>
      decodeGeneratedDaml(input, { decode, encode }, 'payload', {
        genMapPaths: ['payload.genMap'],
      })
    ).toThrow(OcpParseError);
    expect(getter).not.toHaveBeenCalled();
    expect(getTrap).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });
});
