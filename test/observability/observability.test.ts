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
      callerMetadata: 'preserved',
    });
    expect(commandId).toBe('command-call');
  });

  it('returns a plain submit result without promising prototype-only caller members', () => {
    class SubmitParamsWithHelper {
      readonly commands = [];
      readonly actAs = ['issuer::party'];

      helper(): string {
        return 'prototype-only';
      }
    }

    const result = applyCommandContext(new SubmitParamsWithHelper(), {
      context: { workflowId: 'workflow-from-context' },
    });
    const { workflowId } = result;

    expect(workflowId).toBe('workflow-from-context');
    expect(result).not.toHaveProperty('helper');
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
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
