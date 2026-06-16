import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { createFactory } from '../../../src/functions/OpenCapTable/factory/createFactory';
import type { SubmitAndWaitForTransactionTreeResponse } from '../../../src/types/common';

describe('createFactory', () => {
  let mockClient: jest.Mocked<Pick<LedgerJsonApiClient, 'submitAndWaitForTransactionTree'>>;

  const systemOperator = 'system-operator::1220deadbeef';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      submitAndWaitForTransactionTree: jest.fn(),
    };
  });

  it('returns contractId, templateId, and updateId on success', async () => {
    const factoryTemplateId = OCP_TEMPLATES.ocpFactory;
    const mockContractId = 'factory-contract-cid';
    const mockUpdateId = 'update-abc';

    mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
      transactionTree: {
        updateId: mockUpdateId,
        commandId: 'cmd-1',
        workflowId: '',
        offset: 1,
        eventsById: {
          e1: {
            CreatedTreeEvent: {
              value: {
                templateId: factoryTemplateId,
                contractId: mockContractId,
              },
            },
          },
        },
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse);

    const result = await createFactory(mockClient as unknown as LedgerJsonApiClient, { systemOperator });

    expect(result).toEqual({
      contractId: mockContractId,
      templateId: factoryTemplateId,
      updateId: mockUpdateId,
    });
    expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith({
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

    mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
      transactionTree: {
        updateId: mockUpdateId,
        commandId: 'cmd-2',
        workflowId: '',
        offset: 1,
        eventsById: {
          e1: {
            CreatedTreeEvent: {
              value: {
                templateId: customTemplateId,
                contractId: mockContractId,
              },
            },
          },
        },
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse);

    const result = await createFactory(mockClient as unknown as LedgerJsonApiClient, {
      systemOperator,
      templateId: customTemplateId,
    });

    expect(result.templateId).toBe(customTemplateId);
    expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith({
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

    mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
      transactionTree: {
        updateId: mockUpdateId,
        commandId: 'cmd-observed',
        workflowId: 'workflow-observed',
        offset: 1,
        eventsById: {
          e1: {
            CreatedTreeEvent: {
              value: {
                templateId: factoryTemplateId,
                contractId: mockContractId,
              },
            },
          },
        },
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    } as unknown as SubmitAndWaitForTransactionTreeResponse);

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

    expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow-observed',
        commandId: 'cmd-observed',
        submissionId: 'submission-observed',
      })
    );
    expect(mockClient.submitAndWaitForTransactionTree.mock.calls[0]?.[0]).not.toHaveProperty('traceContext');
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

  it('throws OcpContractError when CreatedTreeEvent is missing', async () => {
    mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
      transactionTree: {
        updateId: 'update-x',
        commandId: 'cmd-empty',
        workflowId: '',
        effectiveAt: '2026-02-17T00:00:00Z',
        offset: 1,
        eventsById: {},
        synchronizerId: 'sync-1',
        recordTime: '2026-02-17T00:00:00Z',
      },
    });

    await expect(createFactory(mockClient as unknown as LedgerJsonApiClient, { systemOperator })).rejects.toThrow(
      'Expected CreatedTreeEvent not found for OcpFactory'
    );
  });
});
