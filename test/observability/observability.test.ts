import { ApiError, NetworkError, UnknownMutationOutcomeError } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import { applyCommandContext, submitObservedTransaction } from '../../src/observability';

function failingClient(error: unknown) {
  return { submitAndWaitForTransaction: jest.fn().mockRejectedValue(error) };
}

function silentLogger() {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

async function submissionFailure(client: ReturnType<typeof failingClient>, logger = silentLogger()): Promise<unknown> {
  return submitObservedTransaction(
    client as never,
    { commands: [], actAs: ['transfer-agent::1220'] },
    { logger, context: { commandId: 'command-7' } },
    { operation: 'capTable.apply', templateId: 'template-1', choice: 'CapTable_Apply' }
  ).then(
    () => {
      throw new Error('expected the submission to fail');
    },
    (error: unknown) => error
  );
}

const SUBMIT_ENDPOINT = 'http://ledger/v2/commands/submit-and-wait-for-transaction';

describe('observability helpers', () => {
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

  it('emits success logs and metrics around command submission', async () => {
    const client = {
      submitAndWaitForTransaction: jest.fn().mockResolvedValue({
        transaction: {
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

    await submitObservedTransaction(
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

    expect(client.submitAndWaitForTransaction).toHaveBeenCalledWith(
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
      submitAndWaitForTransaction: jest.fn().mockResolvedValue({
        transaction: {
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

    await submitObservedTransaction(
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
      transaction: {
        updateId: 'update-123',
      },
    };
    const client = {
      submitAndWaitForTransaction: jest.fn().mockResolvedValue(response),
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
      submitObservedTransaction(
        client as never,
        { commands: [], actAs: ['issuer::party'] },
        { logger, metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      )
    ).resolves.toBe(response);

    expect(client.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    expect(metrics.commandFailed).not.toHaveBeenCalled();
  });

  it('preserves ledger failures when failure observability hooks throw', async () => {
    const ledgerError = new Error('ledger failed');
    const client = {
      submitAndWaitForTransaction: jest.fn().mockRejectedValue(ledgerError),
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
      submitObservedTransaction(
        client as never,
        { commands: [], actAs: ['issuer::party'] },
        { logger, metrics },
        { operation: 'test.operation', templateId: 'template-1', choice: 'Choice' }
      )
    ).rejects.toBe(ledgerError);

    expect(metrics.commandFailed).toHaveBeenCalledWith('template-1', 'Choice', 'Error');
  });

  it('surfaces the cause of an unknown mutation outcome, not retryable, and never resubmits', async () => {
    // canton-node-sdk wraps a POST whose response it could not trust; the HTTP 500 and Canton body are its cause
    const cause = new ApiError(
      'HTTP 500: COMMAND_PREPROCESSING_FAILED - the command could not be decoded (cause: unexpected field)',
      500,
      'Internal Server Error',
      { code: 'COMMAND_PREPROCESSING_FAILED', cause: 'unexpected field' }
    );
    const client = failingClient(
      new UnknownMutationOutcomeError({ method: 'POST', endpoint: SUBMIT_ENDPOINT, attempts: 1 }, cause)
    );
    const logger = silentLogger();

    const error = await submissionFailure(client, logger);

    expect(error).toBeInstanceOf(OcpContractError);
    const failure = error as OcpContractError;
    expect(failure.code).toBe(OcpErrorCodes.OUTCOME_UNKNOWN);
    expect(failure.message).toBe(
      'The outcome of CapTable_Apply is unknown: HTTP 500: COMMAND_PREPROCESSING_FAILED - the command could not be ' +
        'decoded (cause: unexpected field)'
    );
    expect(failure.cause).toBe(cause);
    expect(failure.retryable).toBe(false);
    expect(failure.classification).toBe('unknown_mutation_outcome');
    expect(failure.choice).toBe('CapTable_Apply');
    expect(failure.context).toMatchObject({
      commandId: 'command-7',
      status: 500,
      endpoint: SUBMIT_ENDPOINT,
      attempts: 1,
      retryable: false,
    });
    expect(client.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Canton command failed',
      expect.objectContaining({
        errorType: 'UnknownMutationOutcomeError',
        outcome: 'unknown',
        causeMessage: cause.message,
        commandId: 'command-7',
      })
    );
  });

  it('recognizes an unknown outcome from another copy of canton-node-sdk by its name and cause', async () => {
    const cause = new ApiError('HTTP 502: Bad Gateway', 502, 'Bad Gateway', {});
    const foreign = Object.assign(new Error('The outcome of POST is unknown after 1 request attempt'), {
      name: 'UnknownMutationOutcomeError',
      cause,
      endpoint: SUBMIT_ENDPOINT,
      attempts: 1,
    });
    const error = await submissionFailure(failingClient(foreign));
    expect(error).toMatchObject({ code: OcpErrorCodes.OUTCOME_UNKNOWN, cause });
    expect((error as OcpContractError).message).toContain('HTTP 502: Bad Gateway');
  });

  it('reports an unknown outcome whose cause carries a definite answer as a rejection', async () => {
    const cause = new ApiError('HTTP 503: SERVICE_NOT_RUNNING', 503, 'Service Unavailable', {
      code: 'SERVICE_NOT_RUNNING',
      definiteAnswer: true,
    });
    const error = await submissionFailure(
      failingClient(new UnknownMutationOutcomeError({ method: 'POST', endpoint: SUBMIT_ENDPOINT, attempts: 1 }, cause))
    );
    expect(error).toMatchObject({ code: OcpErrorCodes.CHOICE_FAILED, cause, retryable: false });
  });

  it('reports a definite 400 rejection as CHOICE_FAILED with the Canton error as cause', async () => {
    const rejection = new ApiError(
      'HTTP 400: DAML_INTERPRETATION_ERROR - Interpretation error: CapTable_Apply takes at most 500 operations',
      400,
      'Bad Request',
      { code: 'DAML_INTERPRETATION_ERROR' }
    );
    const logger = silentLogger();

    const error = await submissionFailure(failingClient(rejection), logger);

    expect(error).toBeInstanceOf(OcpContractError);
    const failure = error as OcpContractError;
    expect(failure.code).toBe(OcpErrorCodes.CHOICE_FAILED);
    expect(failure.message).toBe(`CapTable_Apply was rejected: ${rejection.message}`);
    expect(failure.cause).toBe(rejection);
    expect(failure.retryable).toBe(false);
    expect(failure.classification).toBe('definite_rejection');
    expect(failure.context).toMatchObject({ status: 400, commandId: 'command-7' });
    expect(logger.error).toHaveBeenCalledWith(
      'Canton command failed',
      expect.objectContaining({ outcome: 'rejected' })
    );
  });

  it('passes other failures through unchanged', async () => {
    const network = new NetworkError('Request failed: connect ECONNREFUSED');
    await expect(submissionFailure(failingClient(network))).resolves.toBe(network);
    const throttled = new ApiError('HTTP 429: too many requests', 429, 'Too Many Requests', {});
    await expect(submissionFailure(failingClient(throttled))).resolves.toBe(throttled);
  });
});
