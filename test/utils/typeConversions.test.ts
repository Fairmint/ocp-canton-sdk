/** Unit tests for typeConversions utility functions. */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  type DamlMapSchema,
  damlMonetaryToNative,
  damlMonetaryToNativeWithValidation,
  ensureArray,
  monetaryToDaml,
  nonEmptyArrayOrUndefined,
  normalizeNumericString,
  parseDamlMap,
  quantityTransferToNative,
  toNonEmptyArray,
} from '../../src/utils/typeConversions';

const STRING_DAML_MAP_SCHEMA = {
  key: {
    expectedType: 'string',
    is: (value: unknown): value is string => typeof value === 'string',
  },
  value: {
    expectedType: 'string',
    is: (value: unknown): value is string => typeof value === 'string',
  },
} satisfies DamlMapSchema<string, string>;

function parseStringDamlMap(data: unknown): Array<[string, string]> {
  return parseDamlMap(data, STRING_DAML_MAP_SCHEMA);
}

describe('normalizeNumericString', () => {
  describe('valid inputs', () => {
    test('handles integers without decimal point', () => {
      expect(normalizeNumericString('5000000')).toBe('5000000');
      expect(normalizeNumericString('0')).toBe('0');
      expect(normalizeNumericString('123')).toBe('123');
    });

    test('removes trailing zeros after decimal point', () => {
      expect(normalizeNumericString('5000000.0000000000')).toBe('5000000');
      expect(normalizeNumericString('123.4500')).toBe('123.45');
      expect(normalizeNumericString('100.00')).toBe('100');
    });

    test('preserves significant decimal digits', () => {
      expect(normalizeNumericString('123.456')).toBe('123.456');
      expect(normalizeNumericString('0.5')).toBe('0.5');
      expect(normalizeNumericString('1.1')).toBe('1.1');
    });

    test('handles negative numbers', () => {
      expect(normalizeNumericString('-123')).toBe('-123');
      expect(normalizeNumericString('-123.4500')).toBe('-123.45');
      expect(normalizeNumericString('-100.00')).toBe('-100');
    });
  });

  describe('invalid inputs - scientific notation', () => {
    test('rejects lowercase e notation with OcpValidationError', () => {
      expect(() => normalizeNumericString('1.5e10')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('1.5e10')).toThrow('Scientific notation is not supported');
      expect(() => normalizeNumericString('1e5')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('2.5e-3')).toThrow(OcpValidationError);
    });

    test('rejects uppercase E notation with OcpValidationError', () => {
      expect(() => normalizeNumericString('1.5E10')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('1.5E10')).toThrow('Scientific notation is not supported');
      expect(() => normalizeNumericString('1E5')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('2.5E-3')).toThrow(OcpValidationError);
    });
  });

  describe('invalid inputs - malformed strings', () => {
    test('rejects non-numeric strings with OcpValidationError', () => {
      expect(() => normalizeNumericString('abc')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('abc')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('12.34.56')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('12,345')).toThrow(OcpValidationError);
    });

    test('rejects empty or invalid formats with OcpValidationError', () => {
      expect(() => normalizeNumericString('')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('')).toThrow('Invalid numeric string format');
      expect(() => normalizeNumericString('.')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('-.5')).toThrow(OcpValidationError);
    });

    test('rejects strings with spaces with OcpValidationError', () => {
      expect(() => normalizeNumericString('123 456')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString(' 123')).toThrow(OcpValidationError);
      expect(() => normalizeNumericString('123 ')).toThrow(OcpValidationError);
    });

    test.each(['1e5', 'not-a-number'])('reports invalid input %p at a caller-supplied field path', (value) => {
      try {
        normalizeNumericString(value, 'convertibleIssuance.pro_rata');
        throw new Error('Expected numeric validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          fieldPath: 'convertibleIssuance.pro_rata',
          receivedValue: value,
        });
      }
    });
  });
});

describe('ensureArray', () => {
  describe('normalizes null/undefined to empty array', () => {
    test('returns empty array for null', () => {
      expect(ensureArray(null)).toEqual([]);
    });

    test('returns empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([]);
    });
  });

  describe('preserves existing arrays', () => {
    test('returns same array for non-empty array', () => {
      const input = [1, 2, 3];
      expect(ensureArray(input)).toBe(input);
    });

    test('returns same array for empty array', () => {
      const input: number[] = [];
      expect(ensureArray(input)).toBe(input);
    });

    test('works with object arrays', () => {
      const input = [{ country: 'US', tax_id: '12-3456789' }];
      expect(ensureArray(input)).toBe(input);
    });

    test('works with string arrays', () => {
      const input = ['comment 1', 'comment 2'];
      expect(ensureArray(input)).toBe(input);
    });
  });
});

describe('non-empty array helpers', () => {
  test('returns a non-empty tuple without changing its values', () => {
    expect(toNonEmptyArray(['first', 'second'], 'items')).toEqual(['first', 'second']);
  });

  test('uses array length for cardinality even when the element type includes undefined', () => {
    const values: Array<string | undefined> = [undefined];
    expect(toNonEmptyArray(values, 'items')).toEqual([undefined]);
    expect(nonEmptyArrayOrUndefined(values, 'items')).toEqual([undefined]);
  });

  test('rejects an empty required array with field context', () => {
    expect(() => toNonEmptyArray([], 'transfer.resulting_security_ids')).toThrow(OcpValidationError);
    expect(() => toNonEmptyArray([], 'transfer.resulting_security_ids')).toThrow('transfer.resulting_security_ids');
  });

  test.each([
    ['string', 'not-an-array'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects a malformed %s container with a typed field error', (_name, values) => {
    const invokeRequired = () => toNonEmptyArray(values as never, 'transfer.resulting_security_ids');
    const invokeOptional = () => nonEmptyArrayOrUndefined(values as never, 'issuance.vestings');

    expect(invokeRequired).toThrow(OcpValidationError);
    try {
      invokeRequired();
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'transfer.resulting_security_ids',
        expectedType: 'array',
        receivedValue: values,
      });
    }

    expect(invokeOptional).toThrow(OcpValidationError);
    try {
      invokeOptional();
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'issuance.vestings',
        expectedType: 'array',
        receivedValue: values,
      });
    }
  });

  test('converts optional arrays to a non-empty tuple or undefined', () => {
    expect(nonEmptyArrayOrUndefined([], 'items')).toBeUndefined();
    expect(nonEmptyArrayOrUndefined(['only'], 'items')).toEqual(['only']);
  });
});

describe('quantityTransferToNative', () => {
  it.each([
    ['stockTransfer.date', 'stockTransfer.resulting_security_ids'],
    ['warrantTransfer.date', 'warrantTransfer.resulting_security_ids'],
    ['equityCompensationTransfer.date', 'equityCompensationTransfer.resulting_security_ids'],
    ['date', 'resulting_security_ids'],
  ])('reports empty results at the sibling path derived from %s', (dateFieldPath, expectedFieldPath) => {
    try {
      quantityTransferToNative(
        {
          id: 'transfer-1',
          date: '2026-01-01T00:00:00Z',
          security_id: 'security-1',
          quantity: '1',
          resulting_security_ids: [],
        },
        dateFieldPath
      );
      throw new Error('Expected quantityTransferToNative to reject an empty resulting_security_ids array');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect((error as OcpValidationError).fieldPath).toBe(expectedFieldPath);
    }
  });
});

describe('parseDamlMap', () => {
  describe('null/undefined handling', () => {
    test('returns empty array for null', () => {
      expect(parseStringDamlMap(null)).toEqual([]);
    });

    test('returns empty array for undefined', () => {
      expect(parseStringDamlMap(undefined)).toEqual([]);
    });
  });

  describe('JSON API v2 array format', () => {
    test('parses valid array of tuples', () => {
      const input = [
        ['id1', 'contract1'],
        ['id2', 'contract2'],
      ];
      expect(parseStringDamlMap(input)).toEqual([
        ['id1', 'contract1'],
        ['id2', 'contract2'],
      ]);
    });

    test('handles empty array', () => {
      expect(parseStringDamlMap([])).toEqual([]);
    });

    test('preserves every caller-visible tuple order without treating dangerous strings as object keys', () => {
      const keys = ['__proto__', 'z-last', 'constructor', 'a-first'];
      const permutations = [keys, [...keys].reverse(), [keys[2], keys[0], keys[3], keys[1]]];

      for (const permutation of permutations) {
        const input = permutation.map((key, index) => [key, `contract-${index}`]);
        const parsed = parseStringDamlMap(input);
        expect(parsed.map(([key]) => key)).toEqual(permutation);
        expect([...new Map(parsed).keys()]).toEqual(permutation);
      }
    });

    test('throws on non-array entry', () => {
      const input = [['id1', 'contract1'], 'invalid'];
      expect(() => parseStringDamlMap(input)).toThrow(OcpParseError);
      expect(() => parseStringDamlMap(input)).toThrow('Invalid tuple at index 1');
    });

    test('throws on wrong length tuple', () => {
      const input = [['id1', 'contract1'], ['id2']];
      expect(() => parseStringDamlMap(input)).toThrow(OcpParseError);
      expect(() => parseStringDamlMap(input)).toThrow('expected [key, value]');
    });

    test('rejects a sparse top-level map array instead of skipping the missing tuple', () => {
      const input = new Array<unknown>(1);

      expect(() => parseStringDamlMap(input)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_generated_daml_json',
          source: 'parseDamlMap[0]',
        })
      );
    });

    test('rejects tuple values inherited through an array prototype', () => {
      class InheritedTuple extends Array<unknown> {}
      Object.defineProperties(InheritedTuple.prototype, {
        0: { configurable: true, value: 'inherited-id' },
        1: { configurable: true, value: 'inherited-contract' },
      });
      const tuple = new InheritedTuple(2);

      expect(() => parseStringDamlMap([tuple])).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_generated_daml_json',
          source: 'parseDamlMap[0]',
        })
      );
    });

    test('rejects a proxy before invoking any traps or tuple guards', () => {
      const getTrap = jest.fn(Reflect.get);
      const input = new Proxy([['id1', 'contract1']], { get: getTrap });
      const keyGuard = jest.fn((value: unknown) => typeof value === 'string');
      const valueGuard = jest.fn((value: unknown) => typeof value === 'string');

      expect(() =>
        parseDamlMap(input, {
          key: {
            expectedType: 'string',
            is: (value: unknown): value is string => keyGuard(value),
          },
          value: {
            expectedType: 'string',
            is: (value: unknown): value is string => valueGuard(value),
          },
        })
      ).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_generated_daml_json',
          source: 'parseDamlMap',
        })
      );
      expect(getTrap).not.toHaveBeenCalled();
      expect(keyGuard).not.toHaveBeenCalled();
      expect(valueGuard).not.toHaveBeenCalled();
    });

    test('rejects an accessor tuple element without invoking it', () => {
      const getter = jest.fn(() => 'id1');
      const tuple = ['placeholder', 'contract1'];
      Object.defineProperty(tuple, '0', { enumerable: true, get: getter });

      expect(() => parseStringDamlMap([tuple])).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_generated_daml_json',
          source: 'parseDamlMap[0][0]',
        })
      );
      expect(getter).not.toHaveBeenCalled();
    });

    test('rejects a cyclic map graph before tuple traversal', () => {
      const input: unknown[] = [];
      input.push(input);

      expect(() => parseStringDamlMap(input)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'cyclic_ledger_json',
          source: 'parseDamlMap[0]',
        })
      );
    });

    test('rejects oversized maps with globally bounded diagnostics before tuple traversal', () => {
      const input = new Array<unknown>(100_001).fill(['id1', 'contract1']);
      let caught: unknown;

      try {
        parseStringDamlMap(input);
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'parseDamlMap',
      });
      expect(JSON.stringify(caught).length).toBeLessThan(4_096);
    });

    test('throws on non-string key', () => {
      const input = [
        ['id1', 'contract1'],
        [123, 'contract2'],
      ];
      expect(() => parseStringDamlMap(input)).toThrow(OcpParseError);
      expect(() => parseStringDamlMap(input)).toThrow('expected string, got number');
    });

    test('rejects a value that does not satisfy the required runtime schema', () => {
      const input = [
        ['id1', 'contract1'],
        ['id2', 123],
      ];

      expect(() => parseStringDamlMap(input)).toThrow('Invalid value at tuple index 1 - expected string, got number');

      try {
        parseStringDamlMap(input);
        throw new Error('Expected parseStringDamlMap to throw');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: {
            tupleIndex: 1,
            tuplePosition: 'value',
            tupleKey: 'id2',
            expectedType: 'string',
            receivedType: 'number',
          },
        });
      }
    });

    test('reports exact tuple position for an invalid key', () => {
      const input = [[123, 'contract1']];

      try {
        parseStringDamlMap(input);
        throw new Error('Expected parseStringDamlMap to throw');
      } catch (error: unknown) {
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: {
            tupleIndex: 0,
            tuplePosition: 'key',
            expectedType: 'string',
            receivedType: 'number',
          },
        });
      }
    });

    test('rejects duplicate keys with both tuple indexes', () => {
      const input = [
        ['id1', 'contract1'],
        ['id2', 'contract2'],
        ['id1', 'contract3'],
      ];

      try {
        parseStringDamlMap(input);
        throw new Error('Expected parseStringDamlMap to throw');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          message: 'parseDamlMap: Duplicate key at tuple index 2; first seen at tuple index 0',
          context: {
            tupleIndex: 2,
            tuplePosition: 'key',
            tupleKey: 'id1',
            duplicateTupleIndex: 2,
            originalTupleIndex: 0,
          },
        });
      }
    });
  });

  describe('invalid formats', () => {
    test('throws for object input', () => {
      const input = { id1: 'contract1', id2: 'contract2' };
      expect(() => parseStringDamlMap(input)).toThrow(OcpParseError);
    });

    test('throws for empty object', () => {
      expect(() => parseStringDamlMap({})).toThrow(OcpParseError);
    });

    test('throws on string input', () => {
      expect(() => parseStringDamlMap('invalid')).toThrow(OcpParseError);
      expect(() => parseStringDamlMap('invalid')).toThrow('Expected array of tuples');
    });

    test('throws on number input', () => {
      expect(() => parseStringDamlMap(123)).toThrow(OcpParseError);
      expect(() => parseStringDamlMap(123)).toThrow('got number');
    });

    test('throws on boolean input', () => {
      expect(() => parseStringDamlMap(true)).toThrow(OcpParseError);
      expect(() => parseStringDamlMap(true)).toThrow('got boolean');
    });
  });
});

describe('monetaryToDaml', () => {
  test('normalizes amount with trailing zeros', () => {
    const result = monetaryToDaml({ amount: '100000.00', currency: 'USD' });
    expect(result.amount).toBe('100000');
    expect(result.currency).toBe('USD');
  });

  test('normalizes fractional amount', () => {
    const result = monetaryToDaml({ amount: '0.50', currency: 'USD' });
    expect(result.amount).toBe('0.5');
  });

  test('preserves already-normalized amount', () => {
    const result = monetaryToDaml({ amount: '1000', currency: 'USD' });
    expect(result.amount).toBe('1000');
  });

  test('preserves significant decimals', () => {
    const result = monetaryToDaml({ amount: '99.99', currency: 'USD' });
    expect(result.amount).toBe('99.99');
  });

  test('handles negative amounts', () => {
    const result = monetaryToDaml({ amount: '-500.00', currency: 'EUR' });
    expect(result.amount).toBe('-500');
    expect(result.currency).toBe('EUR');
  });

  test.each([
    ['OCF to DAML', () => monetaryToDaml({ amount: '1e3', currency: 'USD' }, 'stockClass.par_value')],
    ['DAML to OCF', () => damlMonetaryToNative({ amount: '1e3', currency: 'USD' }, 'stockClass.par_value')],
  ])('reports malformed amount for %s at a caller-supplied field path', (_name, convert) => {
    try {
      convert();
      throw new Error('Expected monetary validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath: 'stockClass.par_value.amount',
        receivedValue: '1e3',
      });
    }
  });
});

describe('monetary round-trip normalization', () => {
  test('monetaryToDaml followed by damlMonetaryToNative produces stable output', () => {
    const input = { amount: '100000.00', currency: 'USD' };
    const daml1 = monetaryToDaml(input);
    const native = damlMonetaryToNative(daml1);
    const daml2 = monetaryToDaml(native);
    expect(daml2).toEqual(daml1);
  });

  test('damlMonetaryToNative followed by monetaryToDaml is idempotent', () => {
    const damlInput = { amount: '5000.0000000000', currency: 'USD' };
    const native1 = damlMonetaryToNative(damlInput);
    const daml = monetaryToDaml(native1);
    const native2 = damlMonetaryToNative(daml);
    expect(native2).toEqual(native1);
  });
});

describe('damlMonetaryToNativeWithValidation', () => {
  test.each(['1e2', 'not-a-number', '12.34.56', ''])('reports invalid amount %p at the caller field path', (amount) => {
    try {
      damlMonetaryToNativeWithValidation({ amount, currency: 'USD' }, 'equityCompensationIssuance.exercise_price');
      throw new Error('Expected monetary validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: 'INVALID_FORMAT',
        fieldPath: 'equityCompensationIssuance.exercise_price.amount',
        receivedValue: amount,
      });
    }
  });
});
