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

  it('projects every canonical submit field exactly once and strips unknown caller members', () => {
    type SubmitParams = Parameters<typeof applyCommandContext>[0];
    type SubmitParamKey = keyof SubmitParams;

    const traceReads = {
      traceId: 0,
      spanId: 0,
      parentSpanId: 0,
      metadata: 0,
    };
    const traceMetadata = { tenant: 'tenant-1' };
    const traceContext = Object.create(null) as NonNullable<SubmitParams['traceContext']>;
    Object.defineProperties(traceContext, {
      traceId: {
        get: () => {
          traceReads.traceId += 1;
          return 'trace-1';
        },
      },
      spanId: {
        get: () => {
          traceReads.spanId += 1;
          return 'span-1';
        },
      },
      parentSpanId: {
        get: () => {
          traceReads.parentSpanId += 1;
          return 'parent-span-1';
        },
      },
      metadata: {
        get: () => {
          traceReads.metadata += 1;
          return traceMetadata;
        },
      },
    });

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
      traceContext,
      disclosedContracts: [],
      synchronizerId: 'synchronizer-1',
      packageIdSelectionPreference: ['package-1'],
      prefetchContractKeys: [],
    };
    const canonicalKeys = Object.keys(values) as SubmitParamKey[];
    const reads = Object.fromEntries(canonicalKeys.map((key) => [key, 0])) as Record<SubmitParamKey, number>;
    const paramsPrototype = Object.create(null) as Record<PropertyKey, unknown>;
    for (const key of canonicalKeys) {
      Object.defineProperty(paramsPrototype, key, {
        get: () => {
          reads[key] += 1;
          return values[key];
        },
      });
    }
    Object.defineProperty(paramsPrototype, 'prototypeHelper', {
      value: () => 'must-not-leak',
    });
    const params = Object.create(paramsPrototype) as SubmitParams & {
      callerMetadata: string;
      ownHelper: () => string;
    };
    // Shadow one prototype getter with a non-enumerable own getter to cover both
    // structural property shapes without changing the canonical read count.
    Object.defineProperty(params, 'readAs', {
      get: () => {
        reads.readAs += 1;
        return values.readAs;
      },
    });
    let unknownGetterReads = 0;
    Object.defineProperties(params, {
      callerMetadata: { enumerable: true, value: 'must-not-leak' },
      ownHelper: {
        enumerable: true,
        get: () => {
          unknownGetterReads += 1;
          return () => 'must-not-leak';
        },
      },
    });
    const unknownSymbol = Symbol('unknown-submit-field');
    Object.defineProperty(params, unknownSymbol, { enumerable: true, value: 'must-not-leak' });

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
    expect(result).not.toHaveProperty('prototypeHelper');
    expect(Reflect.ownKeys(result)).not.toContain(unknownSymbol);
    expect(unknownGetterReads).toBe(0);
    expect(reads).toEqual(Object.fromEntries(canonicalKeys.map((key) => [key, 1])));
    expect(traceReads).toEqual({ traceId: 1, spanId: 1, parentSpanId: 1, metadata: 1 });
    expect(Object.isFrozen(result.traceContext)).toBe(true);
    expect(Object.isFrozen(result.traceContext?.metadata)).toBe(true);

    traceMetadata.tenant = 'mutated';
    expect(result.traceContext?.metadata).toEqual({ tenant: 'tenant-1' });
  });

  it('applies params, default, and call context precedence without letting undefined clear or change ledger fields', () => {
    const defaultReads = { workflowId: 0, commandId: 0, submissionId: 0, traceContext: 0 };
    const defaultContext = Object.create(null) as {
      readonly workflowId?: string;
      readonly commandId?: string;
      readonly submissionId?: string;
      readonly traceContext?: { readonly traceId?: string };
    };
    Object.defineProperties(defaultContext, {
      workflowId: {
        get: () => {
          defaultReads.workflowId += 1;
          return 'workflow-default';
        },
      },
      commandId: {
        get: () => {
          defaultReads.commandId += 1;
          return 'command-default';
        },
      },
      submissionId: {
        get: () => {
          defaultReads.submissionId += 1;
          return 'submission-default';
        },
      },
      traceContext: {
        get: () => {
          defaultReads.traceContext += 1;
          return { traceId: 'trace-default' };
        },
      },
    });
    const callReads = { workflowId: 0, commandId: 0, submissionId: 0, traceContext: 0 };
    const callContext = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(callContext, {
      workflowId: {
        get: () => {
          callReads.workflowId += 1;
          return 'workflow-call';
        },
      },
      commandId: {
        get: () => {
          callReads.commandId += 1;
          return undefined;
        },
      },
      submissionId: {
        get: () => {
          callReads.submissionId += 1;
          return 'submission-call';
        },
      },
      traceContext: {
        get: () => {
          callReads.traceContext += 1;
          return undefined;
        },
      },
      actAs: { enumerable: true, value: ['context::must-not-apply'] },
    });

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
        defaultContext,
        // Deliberately exercise JavaScript callers that provide explicit undefined
        // and an unknown ledger field despite the omission-only TypeScript contract.
        context: callContext,
      }
    );

    expect(result).toMatchObject({
      actAs: ['params::party'],
      workflowId: 'workflow-call',
      commandId: 'command-default',
      submissionId: 'submission-call',
      traceContext: { traceId: 'trace-default' },
    });
    expect(defaultReads).toEqual({ workflowId: 1, commandId: 1, submissionId: 1, traceContext: 1 });
    expect(callReads).toEqual({ workflowId: 1, commandId: 1, submissionId: 1, traceContext: 1 });
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
});
