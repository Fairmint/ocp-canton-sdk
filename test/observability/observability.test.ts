import { applyCommandContext, mergeCommandContext, submitObservedTransactionTree } from '../../src/observability';

describe('observability helpers', () => {
  it('returns an exact frozen command-context snapshot including trace metadata', () => {
    const input = {
      workflowId: 'workflow-original',
      traceContext: {
        traceId: 'trace-original',
        metadata: { tenant: 'tenant-original' },
      },
    };
    const result = mergeCommandContext(input);

    input.workflowId = 'workflow-mutated';
    input.traceContext.traceId = 'trace-mutated';
    input.traceContext.metadata.tenant = 'tenant-mutated';

    expect(result).toEqual({
      workflowId: 'workflow-original',
      traceContext: {
        traceId: 'trace-original',
        metadata: { tenant: 'tenant-original' },
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.traceContext)).toBe(true);
    expect(Object.isFrozen(result?.traceContext?.metadata)).toBe(true);
  });

  it('applies command context fields including traceContext', () => {
    const params = {
      commands: [],
      actAs: ['issuer::party'],
      commandId: 'command-from-params' as const,
      callerMetadata: 'preserved' as const,
    };

    const result = applyCommandContext(params, {
      defaultContext: {
        workflowId: 'workflow-default',
        commandId: 'command-default',
      },
      context: {
        commandId: 'command-call',
        submissionId: 'submission-call',
        traceContext: { traceId: 'trace-1', spanId: 'span-1' },
      },
    });

    const { commandId } = result;

    expect(result).toMatchObject({
      workflowId: 'workflow-default',
      commandId: 'command-call',
      submissionId: 'submission-call',
      traceContext: { traceId: 'trace-1', spanId: 'span-1' },
    });
    expect(result).not.toHaveProperty('callerMetadata');
    expect(commandId).toBe('command-call');
  });

  it('projects canonical own data fields, strips unknown data members, and freezes the result', () => {
    type SubmitParams = Parameters<typeof applyCommandContext>[0];
    type SubmitParamKey = keyof SubmitParams;

    const traceMetadata = { tenant: 'tenant-1' };
    const values: SubmitParams = {
      commands: [],
      commandId: 'command-1',
      actAs: ['issuer::party'],
      userId: 'user-1',
      readAs: ['reader::party'],
      workflowId: 'workflow-1',
      deduplicationPeriod: { Empty: {} },
      minLedgerTimeAbs: '2026-07-12T00:00:00Z',
      minLedgerTimeRel: { seconds: 5 },
      submissionId: 'submission-1',
      traceContext: {
        traceId: 'trace-1',
        spanId: 'span-1',
        parentSpanId: 'parent-span-1',
        metadata: traceMetadata,
      },
      disclosedContracts: [],
      synchronizerId: 'synchronizer-1',
      packageIdSelectionPreference: ['package-1'],
      prefetchContractKeys: [],
    };
    const canonicalKeys = Object.keys(values) as SubmitParamKey[];
    const params = {
      callerMetadata: 'must-not-leak',
      ownHelper: () => 'must-not-leak',
    } as SubmitParams & {
      callerMetadata: string;
      ownHelper: () => string;
    };
    for (const key of canonicalKeys) {
      Object.defineProperty(params, key, {
        configurable: false,
        enumerable: key !== 'readAs',
        value: values[key],
        writable: false,
      });
    }

    const result = applyCommandContext(params);

    expect(Object.keys(result).sort()).toEqual(canonicalKeys.sort());
    expect(result).toEqual({
      ...values,
      traceContext: {
        traceId: 'trace-1',
        spanId: 'span-1',
        parentSpanId: 'parent-span-1',
        metadata: { tenant: 'tenant-1' },
      },
    });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).not.toHaveProperty('callerMetadata');
    expect(result).not.toHaveProperty('ownHelper');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.traceContext)).toBe(true);
    expect(Object.isFrozen(result.traceContext?.metadata)).toBe(true);

    traceMetadata.tenant = 'mutated';
    expect(result.traceContext?.metadata).toEqual({ tenant: 'tenant-1' });
  });

  it('rejects proxy, accessor, symbol, and inherited submit carriers without invoking traps', () => {
    const proxyGet = jest.fn(() => []);
    const proxy = new Proxy({ commands: [] }, { get: proxyGet });
    expect(() => applyCommandContext(proxy)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams' })
    );
    expect(proxyGet).not.toHaveBeenCalled();

    const commandsGetter = jest.fn(() => []);
    const accessorParams = {} as Parameters<typeof applyCommandContext>[0];
    Object.defineProperty(accessorParams, 'commands', { enumerable: true, get: commandsGetter });
    expect(() => applyCommandContext(accessorParams)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams.commands' })
    );
    expect(commandsGetter).not.toHaveBeenCalled();

    const inheritedParams = Object.create({ commands: [] }) as Parameters<typeof applyCommandContext>[0];
    expect(() => applyCommandContext(inheritedParams)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams' })
    );

    const symbol = Symbol('hidden');
    expect(() => applyCommandContext({ commands: [], [symbol]: 'hidden' } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams' })
    );
  });

  it('rejects trace accessors and explicit undefined optional submit fields without invoking accessors', () => {
    const traceIdGetter = jest.fn(() => 'trace-1');
    const traceContext = {} as NonNullable<Parameters<typeof applyCommandContext>[0]['traceContext']>;
    Object.defineProperty(traceContext, 'traceId', { enumerable: true, get: traceIdGetter });
    expect(() => applyCommandContext({ commands: [], traceContext })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams.traceContext.traceId' })
    );
    expect(traceIdGetter).not.toHaveBeenCalled();

    expect(() => applyCommandContext({ commands: [], workflowId: undefined })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams.workflowId' })
    );
    expect(() => applyCommandContext({ commands: [], traceContext: { traceId: undefined } })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams.traceContext.traceId' })
    );
    expect(() => applyCommandContext({} as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'submitParams.commands' })
    );
  });

  it('applies params, default, and call context precedence without omitted fields clearing earlier values', () => {
    const result = applyCommandContext(
      {
        commands: [],
        actAs: ['params::party'],
        workflowId: 'workflow-params',
        commandId: 'command-params',
        submissionId: 'submission-params',
        traceContext: { traceId: 'trace-params' },
      },
      {
        defaultContext: {
          workflowId: 'workflow-default',
          commandId: 'command-default',
          submissionId: 'submission-default',
          traceContext: { traceId: 'trace-default' },
        },
        context: {
          workflowId: 'workflow-call',
          submissionId: 'submission-call',
        },
      }
    );

    expect(result).toMatchObject({
      actAs: ['params::party'],
      workflowId: 'workflow-call',
      commandId: 'command-default',
      submissionId: 'submission-call',
      traceContext: { traceId: 'trace-default' },
    });
  });

  it('merges trace context fields without discarding earlier identifiers', () => {
    const result = mergeCommandContext(
      {
        traceContext: {
          traceId: 'trace-default',
          parentSpanId: 'parent-default',
          metadata: { tenant: 'default' },
        },
      },
      { traceContext: { spanId: 'span-call' } },
      { traceContext: { metadata: { tenant: 'call' } } },
      { traceContext: { traceId: 'trace-call' } }
    );

    expect(result?.traceContext).toEqual({
      traceId: 'trace-call',
      spanId: 'span-call',
      parentSpanId: 'parent-default',
      metadata: { tenant: 'call' },
    });
    expect(Object.isFrozen(result?.traceContext)).toBe(true);
    expect(Object.isFrozen(result?.traceContext?.metadata)).toBe(true);
  });

  it('emits success logs and metrics around command submission', async () => {
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockResolvedValue({
        transactionTree: {
          updateId: 'update-123',
        },
      }),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };

    await submitObservedTransactionTree(
      client as never,
      { commands: [], actAs: ['issuer::party'] },
      {
        logger,
        metrics,
        context: {
          workflowId: 'workflow-1',
          commandId: 'command-1',
          submissionId: 'submission-1',
          traceContext: { traceId: 'trace-1', spanId: 'span-1' },
        },
      },
      { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
    );

    expect(client.submitAndWaitForTransactionTree).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow-1',
        commandId: 'command-1',
        submissionId: 'submission-1',
        traceContext: { traceId: 'trace-1', spanId: 'span-1' },
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Submitting Canton command',
      expect.objectContaining({
        operation: 'test.operation',
        traceContext: { traceId: 'trace-1', spanId: 'span-1' },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Canton command succeeded',
      expect.objectContaining({ updateId: 'update-123' })
    );
    expect(metrics.commandSubmitted).toHaveBeenCalledWith('template-1', 'Choice');
    expect(metrics.commandSucceeded).toHaveBeenCalledWith('template-1', 'Choice', expect.any(Number));
    expect(metrics.commandFailed).not.toHaveBeenCalled();
  });

  it('rejects unknown standalone observability options before submission', async () => {
    const client = {
      submitAndWaitForTransactionTree: jest.fn(),
    };

    await expect(
      submitObservedTransactionTree(client as never, { commands: [] }, { loger: {} } as never, {
        operation: 'test.operation',
        templateId: 'template-1',
        choice: 'Choice',
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'observability.loger',
    });
    expect(client.submitAndWaitForTransactionTree).not.toHaveBeenCalled();
  });

  it('logs traceContext provided directly on submit params', async () => {
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockResolvedValue({
        transactionTree: {
          updateId: 'update-123',
        },
      }),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await submitObservedTransactionTree(
      client as never,
      {
        commands: [],
        actAs: ['issuer::party'],
        traceContext: { traceId: 'trace-from-params', spanId: 'span-from-params' },
      },
      { logger },
      { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Submitting Canton command',
      expect.objectContaining({
        traceContext: { traceId: 'trace-from-params', spanId: 'span-from-params' },
      })
    );
  });

  it('does not let success observability hook failures change command outcomes', async () => {
    const response = {
      transactionTree: {
        updateId: 'update-123',
      },
    };
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockResolvedValue(response),
    };
    const logger = {
      debug: jest.fn(() => {
        throw new Error('debug failed');
      }),
      info: jest.fn(() => {
        throw new Error('info failed');
      }),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const metrics = {
      commandSubmitted: jest.fn(() => {
        throw new Error('submitted failed');
      }),
      commandSucceeded: jest.fn().mockRejectedValue(new Error('succeeded failed')),
      commandFailed: jest.fn(),
    };

    await expect(
      submitObservedTransactionTree(
        client as never,
        { commands: [], actAs: ['issuer::party'] },
        { logger, metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      )
    ).resolves.toBe(response);

    expect(client.submitAndWaitForTransactionTree).toHaveBeenCalledTimes(1);
    expect(metrics.commandFailed).not.toHaveBeenCalled();
  });

  it('preserves ledger failures when failure observability hooks throw', async () => {
    const ledgerError = new Error('ledger failed');
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(ledgerError),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(() => {
        throw new Error('error hook failed');
      }),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(() => {
        throw new Error('failed hook failed');
      }),
    };

    await expect(
      submitObservedTransactionTree(
        client as never,
        { commands: [], actAs: ['issuer::party'] },
        { logger, metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      )
    ).rejects.toBe(ledgerError);

    expect(metrics.commandFailed).toHaveBeenCalledWith('template-1', 'Choice', 'Error');
  });

  it('preserves native Error subclass names without unsafe property access', async () => {
    const ledgerError = new TypeError('typed ledger failure');
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(ledgerError),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };

    await expect(
      submitObservedTransactionTree(
        client as never,
        { commands: [] },
        { metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      )
    ).rejects.toBe(ledgerError);

    expect(metrics.commandFailed).toHaveBeenCalledWith('template-1', 'Choice', 'TypeError');
  });

  it('preserves rejection identity when a proxy throws from error introspection traps', async () => {
    const introspectionError = new Error('getPrototypeOf trap must stay isolated');
    const ledgerRejection = new Proxy(
      {},
      {
        getPrototypeOf: jest.fn(() => {
          throw introspectionError;
        }),
      }
    );
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(ledgerRejection),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };

    let caught: unknown;
    try {
      await submitObservedTransactionTree(
        client as never,
        { commands: [] },
        { logger, metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(ledgerRejection);
    expect(caught).not.toBe(introspectionError);
    expect(logger.error).toHaveBeenCalledWith('Canton command failed', expect.objectContaining({ errorType: 'proxy' }));
    expect(metrics.commandFailed).toHaveBeenCalledWith('template-1', 'Choice', 'proxy');
  });

  it('preserves Error rejection identity when its name accessor throws', async () => {
    const nameError = new Error('name accessor must stay isolated');
    const ledgerRejection = new Error('original ledger failure');
    Object.defineProperty(ledgerRejection, 'name', {
      get: jest.fn(() => {
        throw nameError;
      }),
    });
    const client = {
      submitAndWaitForTransactionTree: jest.fn().mockRejectedValue(ledgerRejection),
    };
    const metrics = {
      commandSubmitted: jest.fn(),
      commandSucceeded: jest.fn(),
      commandFailed: jest.fn(),
    };

    let caught: unknown;
    try {
      await submitObservedTransactionTree(
        client as never,
        { commands: [] },
        { metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(ledgerRejection);
    expect(caught).not.toBe(nameError);
    expect(metrics.commandFailed).toHaveBeenCalledWith('template-1', 'Choice', 'Error');
  });

  it('rejects invalid command-context scalar and nested metadata types', () => {
    expect(() => mergeCommandContext({ workflowId: 123 } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].workflowId' })
    );
    expect(() => mergeCommandContext({ traceContext: { traceId: false, metadata: { tenant: 5 } } } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].traceContext.traceId' })
    );
    expect(() => mergeCommandContext({ traceContext: { metadata: { tenant: 5 } } } as never)).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'commandContext[0].traceContext.metadata.tenant',
      })
    );
    expect(() => mergeCommandContext({ workflowId: undefined })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].workflowId' })
    );
  });

  it('rejects command-context accessors and proxies without invoking them', () => {
    const getter = jest.fn(() => 'workflow');
    const accessorContext = {};
    Object.defineProperty(accessorContext, 'workflowId', { enumerable: true, get: getter });
    const proxyGet = jest.fn(() => {
      throw new Error('proxy trap invoked');
    });
    const proxy = new Proxy({}, { get: proxyGet });

    expect(() => mergeCommandContext(accessorContext)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].workflowId' })
    );
    expect(() => mergeCommandContext(proxy)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0]' })
    );
    expect(getter).not.toHaveBeenCalled();
    expect(proxyGet).not.toHaveBeenCalled();
  });

  it('rejects unknown and symbol command-context keys, including trace metadata symbols', () => {
    const symbol = Symbol('unexpected');
    expect(() => mergeCommandContext({ workflowId: 'workflow', unexpected: true } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].unexpected' })
    );
    expect(() => mergeCommandContext({ workflowId: 'workflow', [symbol]: true } as never)).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0]' })
    );
    expect(() => mergeCommandContext({ traceContext: { metadata: { [symbol]: 'hidden' } } })).toThrow(
      expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'commandContext[0].traceContext.metadata' })
    );
  });

  it('reads supported non-enumerable command-context data once into detached enumerable state', () => {
    const context = {};
    Object.defineProperty(context, 'workflowId', { value: 'workflow', enumerable: false });
    const result = mergeCommandContext(context);

    expect(result).toEqual({ workflowId: 'workflow' });
    expect(Object.keys(result ?? {})).toEqual(['workflowId']);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
