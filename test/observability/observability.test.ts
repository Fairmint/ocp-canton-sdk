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
    };

    const result = applyCommandContext(params as never, {
      defaultContext: {
        workflowId: 'workflow-default',
        commandId: 'command-default',
      },
      context: {
        commandId: 'command-call',
        submissionId: 'submission-call',
        traceContext: { traceId: 'trace-1', spanId: 'span-1' },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      workflowId: 'workflow-default',
      commandId: 'command-call',
      submissionId: 'submission-call',
      traceContext: { traceId: 'trace-1', spanId: 'span-1' },
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
