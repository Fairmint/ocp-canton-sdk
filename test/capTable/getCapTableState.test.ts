/**
 * Unit tests for getCapTableState function.
 *
 * These tests verify that the function correctly extracts entity data from
 * Canton JSON API v2 responses, which use 'createArgument' (not 'payload')
 * for the contract data.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { getCapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';

// Mock the canton-node-sdk
jest.mock('@fairmint/canton-node-sdk');

describe('getCapTableState', () => {
  let mockClient: jest.Mocked<LedgerJsonApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      getActiveContracts: jest.fn(),
    } as unknown as jest.Mocked<LedgerJsonApiClient>;
  });

  describe('JSON API v2 response format', () => {
    it('should extract entities from createArgument field (not payload)', async () => {
      // This test verifies the fix for the bug where getCapTableState looked for
      // 'payload' instead of 'createArgument', causing Canton to report 0 objects
      // even when the cap table had entities.

      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                // This is the correct field name per Canton JSON API v2
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: {
                    'stakeholder-1': 'stakeholder-contract-1',
                    'stakeholder-2': 'stakeholder-contract-2',
                  },
                  stock_classes: {
                    'stock-class-1': 'stock-class-contract-1',
                  },
                  stock_plans: {},
                  vesting_terms: {},
                  stock_legend_templates: {},
                  documents: {},
                  valuations: {},
                  stock_issuances: {
                    'stock-issuance-1': 'stock-issuance-contract-1',
                  },
                  stock_cancellations: {},
                  stock_transfers: {},
                  // ... other empty fields
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: 'OpenCapTable-v30',
                offset: 1000,
                nodeId: 1,
                contractKey: null,
                interfaceViews: [],
              },
              synchronizerId: 'sync-1',
              reassignmentCounter: 0,
            },
          },
        },
      ];

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      // Verify the function was called
      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: expect.any(Array),
      });

      // Verify entities were correctly extracted
      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // This is the critical assertion - stakeholders should be extracted
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(2);
      expect(stakeholders!.has('stakeholder-1')).toBe(true);
      expect(stakeholders!.has('stakeholder-2')).toBe(true);

      // Verify stock classes were extracted
      const stockClasses = result!.entities.get('stockClass');
      expect(stockClasses).toBeDefined();
      expect(stockClasses!.size).toBe(1);
      expect(stockClasses!.has('stock-class-1')).toBe(true);

      // Verify stock issuances were extracted
      const stockIssuances = result!.entities.get('stockIssuance');
      expect(stockIssuances).toBeDefined();
      expect(stockIssuances!.size).toBe(1);
      expect(stockIssuances!.has('stock-issuance-1')).toBe(true);

      // Verify contractIds map is also populated
      const stakeholderContractIds = result!.contractIds.get('stakeholder');
      expect(stakeholderContractIds).toBeDefined();
      expect(stakeholderContractIds!.get('stakeholder-1')).toBe('stakeholder-contract-1');
      expect(stakeholderContractIds!.get('stakeholder-2')).toBe('stakeholder-contract-2');
    });

    it('should return null when no cap table exists', async () => {
      mockClient.getActiveContracts.mockResolvedValue([]);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).toBeNull();
    });

    it('should handle empty entity maps gracefully', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: {},
                  stock_classes: {},
                  stock_plans: {},
                  // All entity maps are empty
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: 'OpenCapTable-v30',
                offset: 1000,
                nodeId: 1,
                contractKey: null,
                interfaceViews: [],
              },
              synchronizerId: 'sync-1',
              reassignmentCounter: 0,
            },
          },
        },
      ];

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      // Empty maps should not be added to entities
      expect(result!.entities.size).toBe(0);
    });
  });
});
