import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { createFactory } from '../../../src/functions/OpenCapTable/factory/createFactory';
import type { SubmitAndWaitForTransactionResponse } from '../../../src/types/common';

describe('createFactory', () => {
  let mockClient: jest.Mocked<Pick<LedgerJsonApiClient, 'submitAndWaitForTransaction'>>;

  const systemOperator = 'system-operator::1220deadbeef';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      submitAndWaitForTransaction: jest.fn(),
    };
  });

  it('returns contractId, templateId, and updateId on success', async () => {
    const factoryTemplateId = OCP_TEMPLATES.ocpFactory;
    const mockContractId = 'factory-contract-cid';
    const mockUpdateId = 'update-abc';

    mockClient.submitAndWaitForTransaction.mockResolvedValue({
      transaction: {
        updateId: mockUpdateId,
        commandId: 'cmd-1',
        workflowId: '',
        offset: 1,
        events: [
          {
            CreatedEvent: {
              templateId: factoryTemplateId,
              contractId: mockContractId,
            },
          },
        ],
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionResponse);

    const result = await createFactory(mockClient as unknown as LedgerJsonApiClient, { systemOperator });

    expect(result).toEqual({
      contractId: mockContractId,
      templateId: factoryTemplateId,
      updateId: mockUpdateId,
    });
    expect(mockClient.submitAndWaitForTransaction).toHaveBeenCalledWith({
      commands: [
        {
          CreateCommand: {
            templateId: factoryTemplateId,
            createArguments: { system_operator: systemOperator },
          },
        },
      ],
      actAs: [systemOperator],
    });
  });

  it('uses params.templateId when provided', async () => {
    const customTemplateId = 'custom::pkg::OcpFactory';
    const mockContractId = 'factory-contract-cid';
    const mockUpdateId = 'update-xyz';

    mockClient.submitAndWaitForTransaction.mockResolvedValue({
      transaction: {
        updateId: mockUpdateId,
        commandId: 'cmd-2',
        workflowId: '',
        offset: 1,
        events: [
          {
            CreatedEvent: {
              templateId: customTemplateId,
              contractId: mockContractId,
            },
          },
        ],
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionResponse);

    const result = await createFactory(mockClient as unknown as LedgerJsonApiClient, {
      systemOperator,
      templateId: customTemplateId,
    });

    expect(result.templateId).toBe(customTemplateId);
    expect(mockClient.submitAndWaitForTransaction).toHaveBeenCalledWith({
      commands: [
        {
          CreateCommand: {
            templateId: customTemplateId,
            createArguments: { system_operator: systemOperator },
          },
        },
      ],
      actAs: [systemOperator],
    });
  });

  it('passes command context and emits observability hooks', async () => {
    const factoryTemplateId = OCP_TEMPLATES.ocpFactory;
    const mockContractId = 'factory-contract-cid';
    const mockUpdateId = 'update-observed';
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

    mockClient.submitAndWaitForTransaction.mockResolvedValue({
      transaction: {
        updateId: mockUpdateId,
        commandId: 'cmd-observed',
        workflowId: 'workflow-observed',
        offset: 1,
        events: [
          {
            CreatedEvent: {
              templateId: factoryTemplateId,
              contractId: mockContractId,
            },
          },
        ],
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionResponse);

    await createFactory(mockClient as unknown as LedgerJsonApiClient, {
      systemOperator,
      logger,
      metrics,
      context: {
        workflowId: 'workflow-observed',
        commandId: 'cmd-observed',
        submissionId: 'submission-observed',
        traceContext: { traceId: 'trace-observed', spanId: 'span-observed' },
      },
    });

    expect(mockClient.submitAndWaitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow-observed',
        commandId: 'cmd-observed',
        submissionId: 'submission-observed',
        traceContext: { traceId: 'trace-observed', spanId: 'span-observed' },
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Submitting Canton command',
      expect.objectContaining({
        operation: 'createFactory',
        traceContext: { traceId: 'trace-observed', spanId: 'span-observed' },
      })
    );
    expect(metrics.commandSubmitted).toHaveBeenCalledWith(factoryTemplateId, 'Create');
    expect(metrics.commandSucceeded).toHaveBeenCalledWith(factoryTemplateId, 'Create', expect.any(Number));
  });

  it('throws OcpContractError when CreatedEvent is missing', async () => {
    mockClient.submitAndWaitForTransaction.mockResolvedValue({
      transaction: {
        updateId: 'update-x',
        commandId: 'cmd-empty',
        workflowId: '',
        effectiveAt: '2026-02-17T00:00:00Z',
        offset: 1,
        events: [],
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    });

    await expect(createFactory(mockClient as unknown as LedgerJsonApiClient, { systemOperator })).rejects.toThrow(
      'Expected CreatedEvent not found for OcpFactory'
    );
  });
});
