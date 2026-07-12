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

    expect(decoded).toBe(input);
    expect(decoded.genMap.map(([key]) => key)).toEqual(['z-last', '__proto__', 'a-first', 'constructor']);
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
