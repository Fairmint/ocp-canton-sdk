import { applyCommandContext, submitObservedTransactionTree } from '../../src/observability';

describe('observability helpers', () => {
  it('applies ledger-supported command context fields without forwarding traceContext', () => {
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
    });
    expect(result).not.toHaveProperty('traceContext');
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
});
