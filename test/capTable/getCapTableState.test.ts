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

/**
 * Issuer data type for test fixtures.
 */
interface TestIssuerData {
  id: string;
  legal_name: string;
  country_of_formation: string;
  formation_date: string;
}

/**
 * Builds a mock issuer events response for getEventsByContractId.
 * Extracted to reduce duplication across tests (DRY principle).
 */
function buildMockIssuerEventsResponse(contractId: string, issuerData: TestIssuerData) {
  return {
    created: {
      createdEvent: {
        contractId,
        createArgument: {
          issuer_data: issuerData,
        },
      },
    },
  };
}

describe('getCapTableState', () => {
  let mockClient: jest.Mocked<LedgerJsonApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use Pick to create a properly typed partial mock with only the methods we need
    mockClient = {
      getActiveContracts: jest.fn(),
      getEventsByContractId: jest.fn(),
    } as jest.Mocked<
      Pick<LedgerJsonApiClient, 'getActiveContracts' | 'getEventsByContractId'>
    > as jest.Mocked<LedgerJsonApiClient>;
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
                  stakeholders: [
                    ['stakeholder-1', 'stakeholder-contract-1'],
                    ['stakeholder-2', 'stakeholder-contract-2'],
                  ],
                  stock_classes: [['stock-class-1', 'stock-class-contract-1']],
                  stock_plans: [],
                  vesting_terms: [],
                  stock_legend_templates: [],
                  documents: [],
                  valuations: [],
                  stock_issuances: [['stock-issuance-1', 'stock-issuance-contract-1']],
                  stock_cancellations: [],
                  stock_transfers: [],
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

      // Mock issuer contract fetch
      const mockIssuerEventsResponse = buildMockIssuerEventsResponse('issuer-contract-456', {
        id: 'issuer-ocf-id-123',
        legal_name: 'Test Corp',
        country_of_formation: 'US',
        formation_date: '2024-01-01T00:00:00Z',
      });

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      // Verify the function was called
      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: expect.any(Array),
      });

      // Verify issuer contract was fetched
      expect(mockClient.getEventsByContractId).toHaveBeenCalledWith({
        contractId: 'issuer-contract-456',
      });

      // Verify entities were correctly extracted
      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // Verify issuer is included in entities
      const issuers = result!.entities.get('issuer');
      expect(issuers).toBeDefined();
      expect(issuers!.size).toBe(1);
      expect(issuers!.has('issuer-ocf-id-123')).toBe(true);

      // Verify issuer contractIds map is populated
      const issuerContractIds = result!.contractIds.get('issuer');
      expect(issuerContractIds).toBeDefined();
      expect(issuerContractIds!.get('issuer-ocf-id-123')).toBe('issuer-contract-456');

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

    it('should parse DAML maps in array-of-tuples format (JSON API v2)', async () => {
      // JSON API v2 can serialize DAML Maps as [[key, value], ...] arrays
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-array-format',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-789',
                  // Array-of-tuples format for DAML Maps
                  stakeholders: [
                    ['stakeholder-a', 'stakeholder-contract-a'],
                    ['stakeholder-b', 'stakeholder-contract-b'],
                    ['stakeholder-c', 'stakeholder-contract-c'],
                  ],
                  stock_classes: [['stock-class-x', 'stock-class-contract-x']],
                  stock_plans: [],
                  vesting_terms: [],
                  stock_issuances: [
                    ['issuance-1', 'issuance-contract-1'],
                    ['issuance-2', 'issuance-contract-2'],
                  ],
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: 'OpenCapTable-v31',
                offset: 2000,
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

      // Mock issuer contract fetch
      const mockIssuerEventsResponse = buildMockIssuerEventsResponse('issuer-contract-789', {
        id: 'issuer-ocf-id-789',
        legal_name: 'Array Format Corp',
        country_of_formation: 'US',
        formation_date: '2024-01-01T00:00:00Z',
      });

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-456');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-array-format');
      expect(result!.issuerContractId).toBe('issuer-contract-789');

      // Verify issuer is included in entities
      const issuers = result!.entities.get('issuer');
      expect(issuers).toBeDefined();
      expect(issuers!.size).toBe(1);
      expect(issuers!.has('issuer-ocf-id-789')).toBe(true);

      // Verify stakeholders from array format
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(3);
      expect(stakeholders!.has('stakeholder-a')).toBe(true);
      expect(stakeholders!.has('stakeholder-b')).toBe(true);
      expect(stakeholders!.has('stakeholder-c')).toBe(true);

      // Verify contractIds are correctly parsed from array format
      const stakeholderContractIds = result!.contractIds.get('stakeholder');
      expect(stakeholderContractIds!.get('stakeholder-a')).toBe('stakeholder-contract-a');
      expect(stakeholderContractIds!.get('stakeholder-b')).toBe('stakeholder-contract-b');

      // Verify stock issuances from array format
      const stockIssuances = result!.entities.get('stockIssuance');
      expect(stockIssuances).toBeDefined();
      expect(stockIssuances!.size).toBe(2);
    });

    it('should include issuer even when other entity maps are empty', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: [],
                  stock_classes: [],
                  stock_plans: [],
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

      // Mock issuer contract fetch
      const mockIssuerEventsResponse = buildMockIssuerEventsResponse('issuer-contract-456', {
        id: 'issuer-only-ocf-id',
        legal_name: 'Empty Cap Table Corp',
        country_of_formation: 'US',
        formation_date: '2024-01-01T00:00:00Z',
      });

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      // Issuer should still be included even when other maps are empty
      expect(result!.entities.size).toBe(1);
      expect(result!.entities.get('issuer')!.has('issuer-only-ocf-id')).toBe(true);
    });

    it('should continue without issuer in entities if issuer fetch fails', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
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
      // Simulate issuer fetch failure
      mockClient.getEventsByContractId.mockRejectedValue(new Error('Contract not found'));

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // Issuer should NOT be in entities (fetch failed)
      expect(result!.entities.get('issuer')).toBeUndefined();

      // But other entities should still be there
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(1);
    });

    it('should not add issuer to entities when issuer_data.id is empty string', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
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

      // Mock issuer contract with empty string ID
      const mockIssuerEventsResponse = {
        created: {
          createdEvent: {
            contractId: 'issuer-contract-456',
            createArgument: {
              issuer_data: {
                id: '', // Empty string - should not be added to entities
                legal_name: 'Empty ID Corp',
                country_of_formation: 'US',
                formation_date: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      };

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // Issuer should NOT be in entities (empty ID)
      expect(result!.entities.get('issuer')).toBeUndefined();
      expect(result!.contractIds.get('issuer')).toBeUndefined();

      // But other entities should still be there
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(1);
    });

    it('should not add issuer to entities when issuer_data.id is missing', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
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

      // Mock issuer contract with missing id field
      const mockIssuerEventsResponse = {
        created: {
          createdEvent: {
            contractId: 'issuer-contract-456',
            createArgument: {
              issuer_data: {
                // id is missing entirely
                legal_name: 'Missing ID Corp',
                country_of_formation: 'US',
                formation_date: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      };

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // Issuer should NOT be in entities (missing ID)
      expect(result!.entities.get('issuer')).toBeUndefined();
      expect(result!.contractIds.get('issuer')).toBeUndefined();

      // But other entities should still be there
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(1);
    });

    it('should handle issuer response with missing createdEvent gracefully', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-123',
                templateId: 'pkg:Fairmint.OpenCapTable.CapTable:CapTable',
                createArgument: {
                  issuer: 'issuer-contract-456',
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
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

      // Mock issuer response with missing createdEvent (malformed response)
      const mockIssuerEventsResponse = {
        created: {
          // createdEvent is missing
        },
      };

      mockClient.getActiveContracts.mockResolvedValue(mockCapTableResponse);
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-contract-123');
      expect(result!.issuerContractId).toBe('issuer-contract-456');

      // Issuer should NOT be in entities (malformed response)
      expect(result!.entities.get('issuer')).toBeUndefined();

      // But other entities should still be there
      const stakeholders = result!.entities.get('stakeholder');
      expect(stakeholders).toBeDefined();
      expect(stakeholders!.size).toBe(1);
    });

    it('should throw when JsActiveContract structure is incomplete', async () => {
      const mockMalformedResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              // Missing createdEvent entirely
              synchronizerId: 'sync-1',
            },
          },
        },
      ];

      mockClient.getActiveContracts.mockResolvedValue(mockMalformedResponse as unknown as never);

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toThrow(
        /Invalid CapTable contract response/
      );
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });
  });

  describe('Strict response format enforcement', () => {
    it('should reject legacy top-level payload format', async () => {
      const mockLegacyResponse = [
        {
          contractEntry: {
            // No JsActiveContract - empty or different union variant
          },
          contractId: 'legacy-cap-table-789',
          payload: {
            issuer: 'legacy-issuer-contract',
            stakeholders: [
              ['sh-1', 'sh-contract-1'],
              ['sh-2', 'sh-contract-2'],
            ],
            stock_classes: [['sc-1', 'sc-contract-1']],
            stock_issuances: [],
          },
        },
      ];

      mockClient.getActiveContracts.mockResolvedValue(mockLegacyResponse as unknown as never);

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toThrow(
        /Invalid CapTable contract response/
      );
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should reject legacy nested contract.payload format', async () => {
      const mockNestedLegacyResponse = [
        {
          contractEntry: {},
          contract_id: 'nested-legacy-cap-table',
          contract: {
            payload: {
              issuer: 'nested-legacy-issuer',
              stakeholders: [['nested-sh-1', 'nested-sh-contract-1']],
              stock_plans: [['plan-1', 'plan-contract-1']],
            },
          },
        },
      ];

      mockClient.getActiveContracts.mockResolvedValue(mockNestedLegacyResponse as unknown as never);

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toThrow(
        /Invalid CapTable contract response/
      );
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });
  });
});
