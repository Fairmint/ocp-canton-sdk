import {
  OcpContractError,
  OcpError,
  OcpErrorCodes,
  OcpNetworkError,
  OcpParseError,
  OcpValidationError,
} from '../../src/errors';
import { toSafeDiagnosticText } from '../../src/errors/OcpError';

describe('OcpError', () => {
  it.each([
    ['plain text', 'abcdefgh', 5, 'ab...'],
    ['tiny text limit', 'abcdefgh', 2, 'ab'],
    ['serialized diagnostics', { value: 'abcdefgh' }, 10, '{"value...'],
  ] as const)('keeps truncated %s within the requested maximum', (_case, value, maximumLength, expected) => {
    const result = toSafeDiagnosticText(value, maximumLength);

    expect(result).toBe(expected);
    expect(result.length).toBeLessThanOrEqual(maximumLength);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN, 10_000])(
    'keeps a non-bounded requested maximum %p within the global text limit',
    (maximumLength) => {
      expect(toSafeDiagnosticText('x'.repeat(2_000), maximumLength).length).toBeLessThanOrEqual(768);
    }
  );

  it('should create a base error with message and code', () => {
    const error = new OcpError('Test error', OcpErrorCodes.CHOICE_FAILED);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OcpError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('CHOICE_FAILED');
    expect(error.name).toBe('OcpError');
    expect(error.cause).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(error, 'cause')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(error, 'classification')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(error, 'context')).toBe(true);
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = new OcpError('Wrapper error', OcpErrorCodes.CONNECTION_FAILED, cause);

    expect(error.cause).toBe(cause);
    expect(error.cause?.message).toBe('Original error');
  });

  it('should have a proper stack trace', () => {
    const error = new OcpError('Test error', OcpErrorCodes.CHOICE_FAILED);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('OcpError');
  });

  it('sanitizes descriptor values without invoking accessors and deeply freezes context', () => {
    const getter = jest.fn(() => 'secret');
    const context: Record<string, unknown> = { nested: { values: ['one'] } };
    Object.defineProperty(context, 'accessor', { enumerable: true, get: getter });

    const error = new OcpError('safe', OcpErrorCodes.INVALID_RESPONSE, undefined, {
      classification: 'probe',
      context,
    });

    expect(getter).not.toHaveBeenCalled();
    expect(error.context?.accessor).toEqual({ valueType: 'accessor' });
    expect(Object.isFrozen(error.context)).toBe(true);
    expect(Object.isFrozen(error.context?.nested)).toBe(true);
    expect(Object.isFrozen((error.context?.nested as { values: unknown[] }).values)).toBe(true);
    expect(() => {
      (error.context as Record<string, unknown>).nested = 'changed';
    }).toThrow(TypeError);
  });

  it('globally bounds serialized diagnostics', () => {
    const error = new OcpError('x'.repeat(10_000), OcpErrorCodes.INVALID_RESPONSE, undefined, {
      context: { values: Array.from({ length: 12 }, (_, index) => `${index}:${'y'.repeat(1_000)}`) },
    });

    expect(JSON.stringify(error).length).toBeLessThanOrEqual(2_048);
  });
});

describe('OcpValidationError', () => {
  it('should create a validation error with field path and message', () => {
    const error = new OcpValidationError('stakeholder.id', 'Required field is missing or empty');

    expect(error).toBeInstanceOf(OcpError);
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error.message).toBe("Validation error at 'stakeholder.id': Required field is missing or empty");
    expect(error.fieldPath).toBe('stakeholder.id');
    expect(error.code).toBe('REQUIRED_FIELD_MISSING');
    expect(error.name).toBe('OcpValidationError');
    expect(error.context).toEqual({ fieldPath: 'stakeholder.id' });
    expect(Object.prototype.hasOwnProperty.call(error.context ?? {}, 'expectedType')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(error.context ?? {}, 'receivedValue')).toBe(false);
  });

  it('should include expected type and received value', () => {
    const error = new OcpValidationError('stockIssuance.quantity', 'Must be a positive number', {
      expectedType: 'number',
      receivedValue: -5,
    });

    expect(error.expectedType).toBe('number');
    expect(error.receivedValue).toBe(-5);
  });

  it('should support custom error codes', () => {
    const error = new OcpValidationError('issuer.formation_date', 'Invalid date format', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });

    expect(error.code).toBe('INVALID_FORMAT');
  });

  it('should handle undefined received value', () => {
    const error = new OcpValidationError('stakeholder.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: undefined,
    });

    expect(error.receivedValue).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(error, 'receivedValue')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(error.context ?? {}, 'receivedValue')).toBe(false);
  });

  it('should handle null received value', () => {
    const error = new OcpValidationError('stakeholder.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: null,
    });

    expect(error.receivedValue).toBeNull();
  });
});

describe('OcpContractError', () => {
  it('should create a contract error with message', () => {
    const error = new OcpContractError('Contract not found');

    expect(error).toBeInstanceOf(OcpError);
    expect(error).toBeInstanceOf(OcpContractError);
    expect(error.message).toBe('Contract not found');
    expect(error.code).toBe('CHOICE_FAILED');
    expect(error.name).toBe('OcpContractError');
  });

  it('should include contract details', () => {
    const error = new OcpContractError('UpdateCapTable result not found in transaction tree', {
      contractId: 'abc123',
      templateId: 'Fairmint.OpenCapTable.CapTable:CapTable',
      choice: 'UpdateCapTable',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });

    expect(error.contractId).toBe('abc123');
    expect(error.templateId).toBe('Fairmint.OpenCapTable.CapTable:CapTable');
    expect(error.choice).toBe('UpdateCapTable');
    expect(error.code).toBe('RESULT_NOT_FOUND');
  });

  it('should not let caller context override canonical contract fields on error.context', () => {
    const error = new OcpContractError('Mismatch', {
      contractId: 'real-cid',
      templateId: 'Real:Template',
      choice: 'RealChoice',
      context: {
        contractId: 'spoof-cid',
        templateId: 'Spoof:Template',
        choice: 'SpoofChoice',
        extra: 'kept',
      },
    });

    expect(error.context?.contractId).toBe('real-cid');
    expect(error.context?.templateId).toBe('Real:Template');
    expect(error.context?.choice).toBe('RealChoice');
    expect(error.context?.extra).toBe('kept');
  });

  it('should not overwrite caller context with undefined canonical fields', () => {
    const error = new OcpContractError('Partial', {
      context: { contractId: 'from-context', note: 'x' },
    });

    expect(error.context?.contractId).toBe('from-context');
    expect(error.context?.note).toBe('x');
    expect(Object.prototype.hasOwnProperty.call(error.context ?? {}, 'templateId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(error.context ?? {}, 'choice')).toBe(false);
  });

  it('should include cause when provided', () => {
    const cause = new Error('DAML error');
    const error = new OcpContractError('Choice execution failed', {
      contractId: 'abc123',
      cause,
    });

    expect(error.cause).toBe(cause);
  });
});

describe('OcpNetworkError', () => {
  it('should create a network error with message', () => {
    const error = new OcpNetworkError('Connection refused');

    expect(error).toBeInstanceOf(OcpError);
    expect(error).toBeInstanceOf(OcpNetworkError);
    expect(error.message).toBe('Connection refused');
    expect(error.code).toBe('CONNECTION_FAILED');
    expect(error.name).toBe('OcpNetworkError');
    expect(error.context).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(error, 'endpoint')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(error, 'statusCode')).toBe(true);
  });

  it('should include network details', () => {
    const error = new OcpNetworkError('Service unavailable', {
      endpoint: 'http://localhost:3975',
      statusCode: 503,
      code: OcpErrorCodes.CONNECTION_FAILED,
    });

    expect(error.endpoint).toBe('http://localhost:3975');
    expect(error.statusCode).toBe(503);
  });

  it('should support timeout errors', () => {
    const error = new OcpNetworkError('Request timed out', {
      endpoint: 'http://localhost:3975/v2/commands/submit-and-wait',
      code: OcpErrorCodes.TIMEOUT,
    });

    expect(error.code).toBe('TIMEOUT');
    expect(error.endpoint).toContain('submit-and-wait');
  });

  it('should include cause when provided', () => {
    const cause = new Error('ECONNREFUSED');
    const error = new OcpNetworkError('Failed to connect to Canton JSON API', {
      cause,
    });

    expect(error.cause).toBe(cause);
  });
});

describe('OcpParseError', () => {
  it('should create a parse error with message', () => {
    const error = new OcpParseError('Failed to parse response');

    expect(error).toBeInstanceOf(OcpError);
    expect(error).toBeInstanceOf(OcpParseError);
    expect(error.message).toBe('Failed to parse response');
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.name).toBe('OcpParseError');
    expect(error.context).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(error, 'source')).toBe(true);
  });

  it('should include source information', () => {
    const error = new OcpParseError('Unknown DAML stakeholder type: InvalidType', {
      source: 'stakeholder.stakeholder_type',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });

    expect(error.source).toBe('stakeholder.stakeholder_type');
    expect(error.code).toBe('UNKNOWN_ENUM_VALUE');
  });

  it('should include cause when provided', () => {
    const cause = new SyntaxError('Unexpected token');
    const error = new OcpParseError('Invalid JSON in response', {
      source: 'API response body',
      cause,
    });

    expect(error.cause).toBe(cause);
    expect(error.source).toBe('API response body');
  });

  it('preserves caller source context unless a defined canonical source overrides it', () => {
    expect(new OcpParseError('x', { context: { source: 'upstream', note: 'kept' } }).context).toMatchObject({
      source: 'upstream',
      note: 'kept',
    });
    expect(
      new OcpParseError('x', { source: 'canonical', context: { source: 'upstream', note: 'kept' } }).context
    ).toMatchObject({ source: 'canonical', note: 'kept' });
  });
});

describe('Canonical diagnostic context merging', () => {
  it('preserves omitted network and validation diagnostics while defined fields override caller values', () => {
    const networkWithoutCanonical = new OcpNetworkError('x', {
      context: { endpoint: 'upstream', statusCode: 418, note: 'kept' },
    });
    expect(networkWithoutCanonical.context).toMatchObject({ endpoint: 'upstream', statusCode: 418, note: 'kept' });

    const networkWithCanonical = new OcpNetworkError('x', {
      endpoint: 'https://canonical.test',
      statusCode: 503,
      context: { endpoint: 'upstream', statusCode: 418, note: 'kept' },
    });
    expect(networkWithCanonical.context).toMatchObject({
      endpoint: 'https://canonical.test',
      statusCode: 503,
      note: 'kept',
    });

    const validation = new OcpValidationError('canonical.path', 'x', {
      context: { fieldPath: 'upstream.path', expectedType: 'upstream', receivedValue: 'upstream', note: 'kept' },
    });
    expect(validation.context).toMatchObject({
      fieldPath: 'canonical.path',
      expectedType: 'upstream',
      receivedValue: 'upstream',
      note: 'kept',
    });
  });
});

describe('Error hierarchy', () => {
  it.each([
    [
      'validation',
      () => new OcpValidationError('issuer.tax_ids', 'Must be an array', { expectedType: 'array' }),
      ['fieldPath', 'expectedType', 'receivedValue'],
    ],
    [
      'contract',
      () => new OcpContractError('Choice failed', { contractId: 'cid', templateId: 'Module:Template', choice: 'Run' }),
      ['contractId', 'templateId', 'choice'],
    ],
    [
      'network',
      () => new OcpNetworkError('Unavailable', { endpoint: 'https://example.test', statusCode: 503 }),
      ['endpoint', 'statusCode'],
    ],
    ['parse', () => new OcpParseError('Invalid', { source: 'payload' }), ['source']],
  ] as const)('keeps %s-specific fields non-enumerable and immutable', (_kind, createError, fields) => {
    const error = createError();

    for (const field of fields) {
      expect(Object.getOwnPropertyDescriptor(error, field)).toMatchObject({
        enumerable: false,
        configurable: false,
        writable: false,
      });
      expect(Reflect.deleteProperty(error, field)).toBe(false);
      expect(() => Object.defineProperty(error, field, { value: 'mutated' })).toThrow(TypeError);
    }
  });

  it('keeps base structured fields non-enumerable, immutable, and its context frozen', () => {
    const error = new OcpError('base', OcpErrorCodes.INVALID_RESPONSE, undefined, {
      classification: 'probe',
      context: { nested: { value: true } },
    });

    for (const field of ['code', 'cause', 'classification', 'context'] as const) {
      expect(Object.getOwnPropertyDescriptor(error, field)).toMatchObject({
        enumerable: false,
        configurable: false,
        writable: false,
      });
      expect(Reflect.deleteProperty(error, field)).toBe(false);
      expect(() => Object.defineProperty(error, field, { value: 'mutated' })).toThrow(TypeError);
    }
    expect(Object.isFrozen(error.context)).toBe(true);
    expect(Object.isFrozen(error.context?.nested)).toBe(true);
  });

  it('should allow catching all OCP errors with OcpError', () => {
    const errors: Error[] = [
      new OcpError('base', OcpErrorCodes.CHOICE_FAILED),
      new OcpValidationError('field', 'message'),
      new OcpContractError('message'),
      new OcpNetworkError('message'),
      new OcpParseError('message'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(OcpError);
    }
  });

  it('should allow distinguishing error types', () => {
    const validationError = new OcpValidationError('field', 'message');
    const contractError = new OcpContractError('message');
    const networkError = new OcpNetworkError('message');
    const parseError = new OcpParseError('message');

    expect(validationError instanceof OcpValidationError).toBe(true);
    expect(validationError instanceof OcpContractError).toBe(false);
    expect(validationError instanceof OcpNetworkError).toBe(false);
    expect(validationError instanceof OcpParseError).toBe(false);

    expect(contractError instanceof OcpContractError).toBe(true);
    expect(networkError instanceof OcpNetworkError).toBe(true);
    expect(parseError instanceof OcpParseError).toBe(true);
  });
});

describe('OcpErrorCodes', () => {
  it('should have all expected error codes', () => {
    // Validation errors
    expect(OcpErrorCodes.REQUIRED_FIELD_MISSING).toBe('REQUIRED_FIELD_MISSING');
    expect(OcpErrorCodes.INVALID_TYPE).toBe('INVALID_TYPE');
    expect(OcpErrorCodes.INVALID_FORMAT).toBe('INVALID_FORMAT');
    expect(OcpErrorCodes.OUT_OF_RANGE).toBe('OUT_OF_RANGE');

    // Contract errors
    expect(OcpErrorCodes.CONTRACT_NOT_FOUND).toBe('CONTRACT_NOT_FOUND');
    expect(OcpErrorCodes.CHOICE_FAILED).toBe('CHOICE_FAILED');
    expect(OcpErrorCodes.AUTHORIZATION_FAILED).toBe('AUTHORIZATION_FAILED');
    expect(OcpErrorCodes.RESULT_NOT_FOUND).toBe('RESULT_NOT_FOUND');

    // Network errors
    expect(OcpErrorCodes.CONNECTION_FAILED).toBe('CONNECTION_FAILED');
    expect(OcpErrorCodes.TIMEOUT).toBe('TIMEOUT');
    expect(OcpErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');

    // Parse errors
    expect(OcpErrorCodes.INVALID_RESPONSE).toBe('INVALID_RESPONSE');
    expect(OcpErrorCodes.SCHEMA_MISMATCH).toBe('SCHEMA_MISMATCH');
    expect(OcpErrorCodes.UNKNOWN_ENUM_VALUE).toBe('UNKNOWN_ENUM_VALUE');
  });
});
