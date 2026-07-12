/**
 * Unit tests for archiveCapTable function.
 *
 * Tests the archive operation including validation, command building,
 * and ledger submission via mocked LedgerJsonApiClient.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { CapTable } from '@fairmint/open-captable-protocol-daml-js/lib/Fairmint/OpenCapTable/CapTable/module';
import { OcpValidationError } from '../../src/errors';
import {
  archiveCapTable,
  buildArchiveCapTableCommand,
  type ArchiveCapTableParams,
} from '../../src/functions/OpenCapTable/capTable/archiveCapTable';

jest.mock('@fairmint/canton-node-sdk');

describe('archiveCapTable', () => {
  let mockClient: jest.Mocked<LedgerJsonApiClient>;

  const validParams: ArchiveCapTableParams = {
    capTableContractId: '00abc123',
    actAs: ['system-operator::1220deadbeef'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      submitAndWaitForTransactionTree: jest.fn(),
    } as unknown as jest.Mocked<LedgerJsonApiClient>;
  });

  describe('validation', () => {
    it('throws OcpValidationError when capTableContractId is empty', async () => {
      await expect(archiveCapTable(mockClient, { ...validParams, capTableContractId: '' })).rejects.toThrow(
        OcpValidationError
      );
    });

    it('throws OcpValidationError when actAs is empty', async () => {
      await expect(archiveCapTable(mockClient, { ...validParams, actAs: [] })).rejects.toThrow(OcpValidationError);
    });

    it('does not call client when validation fails', async () => {
      await expect(archiveCapTable(mockClient, { ...validParams, actAs: [] })).rejects.toThrow();
      expect(mockClient.submitAndWaitForTransactionTree).not.toHaveBeenCalled();
    });

    it('rejects unknown observability typos before submission', async () => {
      await expect(archiveCapTable(mockClient, { ...validParams, loger: {} } as never)).rejects.toMatchObject({
        name: 'OcpValidationError',
        fieldPath: 'archiveCapTable.loger',
      });
      expect(mockClient.submitAndWaitForTransactionTree).not.toHaveBeenCalled();
    });

    it('rejects nested proxies and accessors without invoking traps', async () => {
      const arrayTrap = jest.fn(() => {
        throw new Error('array proxy trap invoked');
      });
      const proxiedActAs = new Proxy([], { get: arrayTrap, ownKeys: arrayTrap });
      await expect(archiveCapTable(mockClient, { ...validParams, actAs: proxiedActAs })).rejects.toMatchObject({
        name: 'OcpValidationError',
        fieldPath: 'archiveCapTable.actAs',
      });
      expect(arrayTrap).not.toHaveBeenCalled();

      const templateGetter = jest.fn(() => CapTable.templateIdWithPackageId);
      const details = {};
      Object.defineProperty(details, 'templateId', { enumerable: true, get: templateGetter });
      await expect(
        archiveCapTable(mockClient, { ...validParams, capTableContractDetails: details as never })
      ).rejects.toMatchObject({
        name: 'OcpValidationError',
        fieldPath: 'archiveCapTable.capTableContractDetails.templateId',
      });
      expect(templateGetter).not.toHaveBeenCalled();
      expect(mockClient.submitAndWaitForTransactionTree).not.toHaveBeenCalled();
    });
  });

  describe('command building', () => {
    it('builds an ExerciseCommand with ArchiveCapTable choice', () => {
      const { command, disclosedContracts } = buildArchiveCapTableCommand(validParams);

      expect(command).toEqual({
        ExerciseCommand: expect.objectContaining({
          contractId: validParams.capTableContractId,
          choice: 'ArchiveCapTable',
          choiceArgument: {},
        }),
      });
      expect(disclosedContracts).toEqual([]);
    });

    it('preserves raw package-id templateId when capTableContractDetails provided', () => {
      const rawLedgerTemplateId = CapTable.templateIdWithPackageId;
      const params: ArchiveCapTableParams = {
        ...validParams,
        capTableContractDetails: { templateId: rawLedgerTemplateId },
      };
      const { command } = buildArchiveCapTableCommand(params);

      expect(command).toEqual({
        ExerciseCommand: expect.objectContaining({
          templateId: rawLedgerTemplateId,
        }),
      });
    });

    it('rejects proxied builder parameters without invoking traps', () => {
      const trap = jest.fn(() => {
        throw new Error('builder proxy trap invoked');
      });
      const proxy = new Proxy({}, { get: trap, ownKeys: trap });

      expect(() => buildArchiveCapTableCommand(proxy as never)).toThrow(
        expect.objectContaining({ name: 'OcpValidationError', fieldPath: 'buildArchiveCapTableCommand' })
      );
      expect(trap).not.toHaveBeenCalled();
    });
  });

  describe('execution', () => {
    it('submits command and returns updateId', async () => {
      const mockUpdateId = 'update-123';
      mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
        transactionTree: {
          updateId: mockUpdateId,
          commandId: 'cmd-1',
          workflowId: '',
          effectiveAt: '2026-02-17T00:00:00Z',
          offset: 1,
          eventsById: {},
          synchronizerId: 'sync-1',
          recordTime: '2026-02-17T00:00:00Z',
        },
      });

      const result = await archiveCapTable(mockClient, validParams);

      expect(result.updateId).toBe(mockUpdateId);
      expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith(
        expect.objectContaining({
          actAs: validParams.actAs,
          commands: [
            expect.objectContaining({
              ExerciseCommand: expect.objectContaining({
                choice: 'ArchiveCapTable',
                contractId: validParams.capTableContractId,
              }),
            }),
          ],
        })
      );
    });

    it('passes readAs and disclosedContracts through', async () => {
      mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
        transactionTree: {
          updateId: 'update-456',
          commandId: 'cmd-2',
          workflowId: '',
          effectiveAt: '2026-02-17T00:00:00Z',
          offset: 2,
          eventsById: {},
          synchronizerId: 'sync-2',
          recordTime: '2026-02-17T00:00:00Z',
        },
      });

      await archiveCapTable(mockClient, { ...validParams, readAs: ['reader-party'] });

      expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith(
        expect.objectContaining({
          readAs: ['reader-party'],
          disclosedContracts: [],
        })
      );
    });

    it('submits detached party arrays and contract details', async () => {
      mockClient.submitAndWaitForTransactionTree.mockResolvedValue({
        transactionTree: {
          updateId: 'update-detached',
          commandId: 'cmd-detached',
          workflowId: '',
          effectiveAt: '2026-02-17T00:00:00Z',
          offset: 3,
          eventsById: {},
          synchronizerId: 'sync-detached',
          recordTime: '2026-02-17T00:00:00Z',
        },
      });
      const actAs = ['system-operator::1220deadbeef'];
      const readAs = ['reader::1220deadbeef'];
      const capTableContractDetails = { templateId: CapTable.templateIdWithPackageId };

      const promise = archiveCapTable(mockClient, {
        capTableContractId: '00abc123',
        capTableContractDetails,
        actAs,
        readAs,
      });
      actAs[0] = 'mutated::party';
      readAs[0] = 'mutated::reader';
      capTableContractDetails.templateId = 'mutated-template';
      await promise;

      expect(mockClient.submitAndWaitForTransactionTree).toHaveBeenCalledWith(
        expect.objectContaining({
          actAs: ['system-operator::1220deadbeef'],
          readAs: ['reader::1220deadbeef'],
          commands: [
            expect.objectContaining({
              ExerciseCommand: expect.objectContaining({ templateId: CapTable.templateIdWithPackageId }),
            }),
          ],
        })
      );
    });

    it('propagates ledger errors', async () => {
      mockClient.submitAndWaitForTransactionTree.mockRejectedValue(new Error('Ledger submission failed'));

      await expect(archiveCapTable(mockClient, validParams)).rejects.toThrow('Ledger submission failed');
    });
  });
});
