import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { parseArraySnapshot, parseStringArrayItem } from '../../src/utils/arrayCardinality';

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected array validation to fail');
}

describe('parseArraySnapshot', () => {
  it('returns a fresh dense snapshot and supports exact cardinality', () => {
    const input = ['first', 'second'];
    const parsed = parseArraySnapshot(input, 'items', {
      cardinality: { minimum: 2, maximum: 2 },
      item: parseStringArrayItem,
    });

    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    input[0] = 'mutated';
    expect(parsed).toEqual(['first', 'second']);
  });

  it.each([
    {
      cardinality: { minimum: 2 },
      expectedContext: { actualItems: 1, minimumItems: 2 },
      expectedMessage: 'at least 2 items',
      input: ['one'],
    },
    {
      cardinality: { maximum: 1 },
      expectedContext: { actualItems: 2, maximumItems: 1 },
      expectedMessage: 'at most 1 item',
      input: ['one', 'two'],
    },
  ])('rejects array cardinality outside $cardinality', ({ cardinality, expectedContext, expectedMessage, input }) => {
    const error = captureValidationError(() =>
      parseArraySnapshot(input, 'items', { cardinality, item: parseStringArrayItem })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'items',
    });
    expect(error.message).toContain(expectedMessage);
    expect(error.context).toMatchObject(expectedContext);
  });

  it('reports an exact item path for invalid element types', () => {
    const error = captureValidationError(() =>
      parseArraySnapshot(['valid', 42], 'transfer.resulting_security_ids', { item: parseStringArrayItem })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      fieldPath: 'transfer.resulting_security_ids.1',
      receivedValue: 42,
    });
  });

  it('reports the duplicate item and its first index', () => {
    const error = captureValidationError(() =>
      parseArraySnapshot(['first', 'duplicate', 'duplicate'], 'transfer.resulting_security_ids', {
        item: parseStringArrayItem,
        uniqueness: { key: (value) => value },
      })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'transfer.resulting_security_ids.2',
      receivedValue: 'duplicate',
    });
    expect(error.context).toMatchObject({ duplicateIndex: 2, duplicateOfIndex: 1 });
  });

  it('rejects a sparse array at its first missing index', () => {
    const error = captureValidationError(() =>
      parseArraySnapshot(new Array(1), 'transfer.resulting_security_ids', { item: parseStringArrayItem })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'transfer.resulting_security_ids.0',
    });
  });

  it('rejects an accessor element without invoking its getter', () => {
    let getterReads = 0;
    const input: string[] = [];
    Object.defineProperty(input, '0', {
      configurable: true,
      enumerable: true,
      get() {
        getterReads += 1;
        return 'secret';
      },
    });
    input.length = 1;

    const error = captureValidationError(() =>
      parseArraySnapshot(input, 'transfer.resulting_security_ids', { item: parseStringArrayItem })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'transfer.resulting_security_ids.0',
      receivedValue: 'accessor property',
    });
    expect(getterReads).toBe(0);
  });

  it('rejects a Proxy without invoking any traps', () => {
    let trapCalls = 0;
    const input = new Proxy(['secret'], {
      get(target, property, receiver) {
        trapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        trapCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        trapCalls += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        trapCalls += 1;
        return Reflect.ownKeys(target);
      },
    });

    const error = captureValidationError(() =>
      parseArraySnapshot(input, 'transfer.resulting_security_ids', { item: parseStringArrayItem })
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'transfer.resulting_security_ids',
      receivedValue: 'JavaScript Proxy',
    });
    expect(trapCalls).toBe(0);
  });
});
