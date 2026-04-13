/**
 * Unit tests for getCapTableState function.
 *
 * These tests verify that the function correctly extracts entity data from
 * Canton JSON API v2 responses, which use 'createArgument' (not 'payload')
 * for the contract data.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { CapTable } from '@fairmint/open-captable-protocol-daml-js/lib/Fairmint/OpenCapTable/CapTable/module';
import { OcpErrorCodes } from '../../src/errors';
import { classifyIssuerCapTables, getCapTableState } from '../../src/functions/OpenCapTable/capTable';

// Mock the canton-node-sdk
jest.mock('@fairmint/canton-node-sdk');

const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;
const NON_CURRENT_CAP_TABLE_TEMPLATE_ID = '#OpenCapTable-other:Fairmint.OpenCapTable.CapTable:CapTable';
/** Package segment from the pinned CapTable template (tracks daml-js upgrades). */
const CURRENT_OCP_PACKAGE_NAME = CURRENT_CAP_TABLE_TEMPLATE_ID.replace(/^#/, '').split(':')[0];
const NON_CURRENT_CAP_TABLE_PACKAGE_NAME = 'OpenCapTable-other';

/** Package-id form of the pinned CapTable template (same build as `OCP_TEMPLATES.capTable`). */
const HASH_FORM_CAP_TABLE_TEMPLATE_ID = CapTable.templateIdWithPackageId;

function isCurrentTemplateQuery(templateIds: string[] | undefined): boolean {
  return templateIds?.length === 1 && templateIds[0] === CURRENT_CAP_TABLE_TEMPLATE_ID;
}

/**
 * Test mock: `getActiveContracts` must be called with `templateIds: [OCP_TEMPLATES.capTable]` (package-name symbolic
 * id). The SDK validates each returned row using `packageName` plus the module/entity suffix of `templateId`.
 */
function mockActiveContractsForCapTableState(
  mockClient: jest.Mocked<Pick<LedgerJsonApiClient, 'getActiveContracts'>>,
  responses: { current?: unknown[] }
): void {
  const current = responses.current ?? [];
  mockClient.getActiveContracts.mockImplementation(async (req: { templateIds?: string[] }) => {
    await Promise.resolve();
    const ids = req.templateIds;
    if (isCurrentTemplateQuery(ids)) {
      return current as never;
    }
    throw new Error(`Unexpected getActiveContracts templateIds in test: ${JSON.stringify(ids)}`);
  });
}

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

function buildMockCapTableContract(params: {
  contractId: string;
  issuerContractId: string;
  packageName: string;
  createArgument?: Record<string, unknown>;
  templateId?: unknown;
}) {
  const defaultTemplateId =
    params.packageName === CURRENT_OCP_PACKAGE_NAME
      ? CURRENT_CAP_TABLE_TEMPLATE_ID
      : `#${params.packageName}:Fairmint.OpenCapTable.CapTable:CapTable`;
  const templateId = Object.prototype.hasOwnProperty.call(params, 'templateId') ? params.templateId : defaultTemplateId;
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          contractId: params.contractId,
          templateId,
          createArgument: {
            issuer: params.issuerContractId,
            context: { system_operator: 'system-op::party' },
            ...params.createArgument,
          },
          createdEventBlob: 'blob-data',
          witnessParties: ['party-1'],
          signatories: ['party-1'],
          observers: [],
          createdAt: '2024-01-01T00:00:00Z',
          packageName: params.packageName,
          offset: 1000,
          nodeId: 1,
          contractKey: null,
          interfaceViews: [],
        },
        synchronizerId: 'sync-1',
        reassignmentCounter: 0,
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                // This is the correct field name per Canton JSON API v2
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
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
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
      mockClient.getEventsByContractId.mockResolvedValue(mockIssuerEventsResponse as never);

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
      });

      // Verify issuer contract was fetched
      expect(mockClient.getEventsByContractId).toHaveBeenCalledWith({
        contractId: 'issuer-contract-456',
        readAs: ['issuer::party-123'],
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
      mockActiveContractsForCapTableState(mockClient, {});

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).toBeNull();
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
    ])('should reject returned CapTable rows with a %s templateId', async (_case, templateId) => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-current',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            templateId,
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-current',
        message: 'CapTable contract templateId must be a non-empty string',
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should reject returned rows whose package line does not match the pinned OpenCapTable package', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-other',
            issuerContractId: 'issuer-contract-other',
            packageName: NON_CURRENT_CAP_TABLE_PACKAGE_NAME,
            templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
            createArgument: {
              stakeholders: [['other-stakeholder', 'other-stakeholder-contract']],
            },
          }),
          buildMockCapTableContract({
            contractId: 'cap-table-current',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: {
              stakeholders: [['current-stakeholder', 'current-stakeholder-contract']],
            },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-other',
        message: 'CapTable contract packageName does not match pinned OpenCapTable package line',
        templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should accept hash-form templateId when packageName and module path match the pinned template', async () => {
      const mockCapTableResponse = [
        buildMockCapTableContract({
          contractId: 'cap-table-hash-id',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          templateId: HASH_FORM_CAP_TABLE_TEMPLATE_ID,
          createArgument: {
            stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
          },
        }),
      ];

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-hash',
          legal_name: 'Hash Id Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).not.toBeNull();
      expect(result!.capTableContractId).toBe('cap-table-hash-id');
    });

    it('should reject templateId with empty module path after package reference', async () => {
      const badTemplateId = `${HASH_FORM_CAP_TABLE_TEMPLATE_ID.split(':')[0]}:`;
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-bad-suffix',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            templateId: badTemplateId,
            createArgument: { stakeholders: [['s', 'c']] },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-bad-suffix',
        message: 'CapTable contract templateId is missing module path after package reference',
        templateId: badTemplateId,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
    ])('should reject returned CapTable rows with a %s packageName', async (_case, packageName) => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-bad-pkg',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
        createArgument: { stakeholders: [['s', 'c']] },
      });
      const ce = { ...row.contractEntry.JsActiveContract.createdEvent };
      if (packageName === undefined) {
        delete (ce as { packageName?: string }).packageName;
      } else {
        (ce as { packageName: string }).packageName = packageName;
      }
      mockActiveContractsForCapTableState(mockClient, {
        current: [{ contractEntry: { JsActiveContract: { ...row.contractEntry.JsActiveContract, createdEvent: ce } } }],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-bad-pkg',
        message: 'CapTable contract packageName must be a non-empty string',
        templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should reject when packageName matches but template module path does not', async () => {
      const wrongEntityTemplateId = `#${CURRENT_OCP_PACKAGE_NAME}:Fairmint.OpenCapTable.CapTable:NotCapTable`;
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-wrong-entity',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            templateId: wrongEntityTemplateId,
            createArgument: { stakeholders: [['s', 'c']] },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-wrong-entity',
        message: 'CapTable contract template module path does not match pinned CapTable template',
        templateId: wrongEntityTemplateId,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should parse DAML maps in array-of-tuples format (JSON API v2)', async () => {
      // JSON API v2 can serialize DAML Maps as [[key, value], ...] arrays
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                contractId: 'cap-table-contract-array-format',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-789',
                  context: { system_operator: 'system-op::party' },
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
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
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
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: {
                  issuer: 'issuer-contract-456',
                  context: { system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                },
                createdEventBlob: 'blob-data',
                witnessParties: ['party-1'],
                signatories: ['party-1'],
                observers: [],
                createdAt: '2024-01-01T00:00:00Z',
                packageName: CURRENT_OCP_PACKAGE_NAME,
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

      mockActiveContractsForCapTableState(mockClient, { current: mockCapTableResponse });
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

      mockActiveContractsForCapTableState(mockClient, { current: mockMalformedResponse as unknown[] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toThrow(
        /Invalid CapTable contract response/
      );
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });
  });

  describe('classifyIssuerCapTables', () => {
    it('should classify a single CapTable as current', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-v34',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: {
              stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
            },
          }),
        ],
      });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-id-123',
          legal_name: 'Target Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );

      const result = await classifyIssuerCapTables(mockClient, 'issuer::party-123');

      expect(result.status).toBe('current');
      expect(result.current?.capTableContractId).toBe('cap-table-v34');
      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
      });
    });

    it('should classify as current when templateId is package-id form but packageName matches pinned line', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-pkg-id',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            templateId: HASH_FORM_CAP_TABLE_TEMPLATE_ID,
            createArgument: {
              stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
            },
          }),
        ],
      });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-id-123',
          legal_name: 'Target Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );

      const result = await classifyIssuerCapTables(mockClient, 'issuer::party-123');

      expect(result.status).toBe('current');
      expect(result.current?.capTableContractId).toBe('cap-table-pkg-id');
      expect(result.current?.templateId).toBe(HASH_FORM_CAP_TABLE_TEMPLATE_ID);
    });

    it('should reject a returned row whose package line does not match the pinned OpenCapTable package', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-other',
            issuerContractId: 'issuer-contract-other',
            packageName: NON_CURRENT_CAP_TABLE_PACKAGE_NAME,
            templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
          }),
          buildMockCapTableContract({
            contractId: 'cap-table-current',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
          }),
        ],
      });

      await expect(classifyIssuerCapTables(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-other',
        message: 'CapTable contract packageName does not match pinned OpenCapTable package line',
        templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should classify as none when the current template has no CapTable', async () => {
      mockActiveContractsForCapTableState(mockClient, { current: [] });

      const result = await classifyIssuerCapTables(mockClient, 'issuer::party-123');

      expect(result.status).toBe('none');
      expect(result.current).toBeNull();
      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
      });
    });

    it('should reject when a mismatched package line row is returned', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-other',
            issuerContractId: 'issuer-contract-other',
            packageName: NON_CURRENT_CAP_TABLE_PACKAGE_NAME,
            templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
          }),
        ],
      });

      await expect(classifyIssuerCapTables(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'cap-table-other',
        message: 'CapTable contract packageName does not match pinned OpenCapTable package line',
        templateId: NON_CURRENT_CAP_TABLE_TEMPLATE_ID,
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('should reject multiple active CapTables on the current template', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-a',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
          }),
          buildMockCapTableContract({
            contractId: 'cap-table-b',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
          }),
        ],
      });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-id-123',
          legal_name: 'Dup Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );

      await expect(classifyIssuerCapTables(mockClient, 'issuer::party-123')).rejects.toThrow(
        /Multiple active CapTable contracts/
      );
    });

    it('should return null from getCapTableState when no CapTable exists', async () => {
      mockActiveContractsForCapTableState(mockClient, { current: [] });

      const result = await getCapTableState(mockClient, 'issuer::party-123');

      expect(result).toBeNull();
      expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
        parties: ['issuer::party-123'],
        templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
      });
    });
  });
});
