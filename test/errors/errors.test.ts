import {
  OcpContractError,
  OcpError,
  OcpErrorCodes,
  OcpNetworkError,
  OcpParseError,
  OcpValidationError,
} from '../../src/errors';

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function wideSharedTree(depth: number): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: 'value' };
  for (let level = 0; level < depth; level += 1) {
    const parent: Record<string, unknown> = {};
    for (let branch = 0; branch < 20; branch += 1) parent[`branch_${branch}`] = value;
    value = parent;
  }
  return value;
}

function hostileContextCases(): ReadonlyArray<{
  readonly context: Record<string, unknown>;
  readonly label: string;
  readonly trapCount: () => number;
}> {
  let throwingTrapCount = 0;
  const throwingTrap = (): never => {
    throwingTrapCount += 1;
    throw new Error('context trap must not run');
  };
  const throwingContext = new Proxy<Record<string, unknown>>(
    {},
    {
      get: throwingTrap,
      getOwnPropertyDescriptor: throwingTrap,
      getPrototypeOf: throwingTrap,
      ownKeys: throwingTrap,
    }
  );

  let revokedTrapCount = 0;
  const revokedTrap = (): never => {
    revokedTrapCount += 1;
    throw new Error('revoked context trap must not run');
  };
  const revoked = Proxy.revocable<Record<string, unknown>>(
    {},
    {
      get: revokedTrap,
      getOwnPropertyDescriptor: revokedTrap,
      getPrototypeOf: revokedTrap,
      ownKeys: revokedTrap,
    }
  );
  revoked.revoke();

  return [
    { context: throwingContext, label: 'throwing Proxy', trapCount: () => throwingTrapCount },
    { context: revoked.proxy, label: 'revoked Proxy', trapCount: () => revokedTrapCount },
  ];
}

describe('OcpError', () => {
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

  it('preserves __proto__ as inert JSON evidence instead of mutating the diagnostic prototype', () => {
    const receivedValue = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(receivedValue, '__proto__', {
      enumerable: true,
      value: { polluted: true },
    });

    const error = new OcpValidationError('field', 'Invalid value', { receivedValue });
    const diagnostic = error.receivedValue as Record<string, unknown>;

    expect(Object.getPrototypeOf(diagnostic)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(diagnostic, '__proto__')).toBe(true);
    const serialized = JSON.parse(JSON.stringify(diagnostic)) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(serialized, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(serialized, '__proto__')?.value).toEqual({ polluted: true });
  });

  it('bounds enormous diagnostic key names in received values and contexts', () => {
    const longKey = 'k'.repeat(100_000);
    const evidence = { [longKey]: 1 };
    const validationError = new OcpValidationError('root', 'bad', { receivedValue: evidence });
    const errors = [
      validationError,
      new OcpError('bad', OcpErrorCodes.INVALID_FORMAT, undefined, { context: { evidence } }),
    ];

    for (const error of errors) {
      const serialized = JSON.stringify(error);
      expect(serializedBytes(error)).toBeLessThan(4_096);
      expect(serialized).toContain('truncated-key');
      expect(serialized).toContain('length=100000');
      expect(serialized).not.toContain('k'.repeat(1_000));
    }

    const received = validationError.receivedValue as Record<string, unknown>;
    expect(Reflect.ownKeys(received).every((key) => typeof key === 'symbol' || key.length < 200)).toBe(true);
  });

  it.each([3, 4])('applies one total budget to a 20-way shared tree at depth %i', (depth) => {
    const evidence = wideSharedTree(depth);
    const errors = [
      new OcpValidationError('root', 'bad', { receivedValue: evidence }),
      new OcpError('bad', OcpErrorCodes.INVALID_FORMAT, undefined, { context: { evidence } }),
    ];

    for (const error of errors) {
      const serialized = JSON.stringify(error);
      expect(serializedBytes(error)).toBeLessThan(4_096);
      expect(serialized).toContain('diagnostic-truncation');
      expect(serialized).toMatch(/(?:byte|entry|node|serialized-byte)-(?:budget|limit)/);
    }
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

  it('sanitizes throwing and revoked context Proxies without invoking their traps', () => {
    for (const attack of hostileContextCases()) {
      const error = new OcpContractError(`Contract context: ${attack.label}`, {
        contractId: 'cid',
        context: attack.context,
      });

      expect(attack.trapCount()).toBe(0);
      expect(error.context).toEqual(expect.objectContaining({ contractId: 'cid', kind: 'proxy' }));
      expect(serializedBytes(error)).toBeLessThan(4_096);
    }
  });

  it('bounds public contract metadata and serialized context globally', () => {
    const enormous = 'm'.repeat(100_000);
    const error = new OcpContractError('Enormous contract diagnostics', {
      choice: enormous,
      context: { [enormous]: enormous },
      contractId: enormous,
      templateId: enormous,
    });

    for (const value of [error.contractId, error.templateId, error.choice]) {
      expect(value).toContain('[truncated; original length 100000]');
      expect(value?.length).toBeLessThan(512);
    }
    for (const property of ['contractId', 'templateId', 'choice']) {
      expect(Object.getOwnPropertyDescriptor(error, property)?.enumerable).toBe(false);
    }
    const serialized = JSON.stringify(error);
    expect(serializedBytes(error)).toBeLessThan(4_096);
    expect(serialized).toContain('truncated-key');
    expect(serialized).not.toContain('m'.repeat(1_000));
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

  it('sanitizes throwing and revoked context Proxies without invoking their traps', () => {
    for (const attack of hostileContextCases()) {
      const error = new OcpNetworkError(`Network context: ${attack.label}`, {
        context: attack.context,
        endpoint: 'https://example.test',
      });

      expect(attack.trapCount()).toBe(0);
      expect(error.context).toEqual(expect.objectContaining({ endpoint: 'https://example.test', kind: 'proxy' }));
      expect(serializedBytes(error)).toBeLessThan(4_096);
    }
  });

  it('bounds public network metadata and serialized context globally', () => {
    const enormous = 'n'.repeat(100_000);
    const error = new OcpNetworkError('Enormous network diagnostics', {
      context: { [enormous]: enormous },
      endpoint: enormous,
      statusCode: { [enormous]: enormous } as unknown as number,
    });

    expect(error.endpoint).toContain('[truncated; original length 100000]');
    expect(error.endpoint?.length).toBeLessThan(512);
    expect(error.statusCode).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(error, 'endpoint')?.enumerable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(error, 'statusCode')?.enumerable).toBe(false);
    const serialized = JSON.stringify(error);
    expect(serializedBytes(error)).toBeLessThan(4_096);
    expect(serialized).toContain('truncated-key');
    expect(serialized).not.toContain('n'.repeat(1_000));
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
});

describe('Error hierarchy', () => {
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
