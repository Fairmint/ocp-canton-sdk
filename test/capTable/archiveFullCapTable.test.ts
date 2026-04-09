import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import {
  archiveFullCapTable,
  getSystemOperatorPartyId,
} from '../../src/functions/OpenCapTable/capTable/archiveFullCapTable';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';

const mockArchiveCapTable = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchExecute = jest.fn();
const mockCapTableBatch = jest.fn().mockImplementation(() => ({
  delete: mockBatchDelete,
  execute: mockBatchExecute,
}));

jest.mock('../../src/functions/OpenCapTable/capTable/archiveCapTable', () => ({
  archiveCapTable: (...args: unknown[]) => mockArchiveCapTable(...args),
}));

jest.mock('../../src/functions/OpenCapTable/capTable/CapTableBatch', () => ({
  CapTableBatch: function MockCapTableBatch(...args: unknown[]) {
    return mockCapTableBatch(...args);
  },
}));

const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;
const CURRENT_OCP_PACKAGE_NAME = CURRENT_CAP_TABLE_TEMPLATE_ID.replace(/^#/, '').split(':')[0];

function isCurrentTemplateQuery(templateIds: string[] | undefined): boolean {
  return templateIds?.length === 1 && templateIds[0] === CURRENT_CAP_TABLE_TEMPLATE_ID;
}

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

interface TestIssuerData {
  id: string;
  legal_name: string;
  country_of_formation: string;
  formation_date: string;
}

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
  systemOperatorPartyId: string;
  templateId?: string;
}) {
  const templateId =
    params.templateId ??
    (params.packageName === CURRENT_OCP_PACKAGE_NAME
      ? CURRENT_CAP_TABLE_TEMPLATE_ID
      : `#${params.packageName}:Fairmint.OpenCapTable.CapTable:CapTable`);
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          contractId: params.contractId,
          templateId,
          createArgument: {
            issuer: params.issuerContractId,
            context: {
              system_operator: params.systemOperatorPartyId,
            },
            stakeholders: [],
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

describe('archiveFullCapTable', () => {
  let mockClient: jest.Mocked<LedgerJsonApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      getActiveContracts: jest.fn(),
      getEventsByContractId: jest.fn(),
    } as jest.Mocked<
      Pick<LedgerJsonApiClient, 'getActiveContracts' | 'getEventsByContractId'>
    > as jest.Mocked<LedgerJsonApiClient>;

    mockBatchExecute.mockResolvedValue({ updatedCapTableCid: 'cap-table-updated' });
    mockArchiveCapTable.mockResolvedValue({ updateId: 'archive-update-123' });
    mockClient.getEventsByContractId.mockResolvedValue(
      buildMockIssuerEventsResponse('issuer-contract-456', {
        id: 'issuer-ocf-id-123',
        legal_name: 'Test Corp',
        country_of_formation: 'US',
        formation_date: '2024-01-01T00:00:00Z',
      }) as never
    );
  });

  it('reads system_operator from the CapTable', async () => {
    mockActiveContractsForCapTableState(mockClient, {
      current: [
        buildMockCapTableContract({
          contractId: 'cap-table-v34',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          systemOperatorPartyId: 'current-system-operator',
        }),
      ],
    });

    const result = await getSystemOperatorPartyId(mockClient, 'issuer::party-123');

    expect(result).toBe('current-system-operator');
    expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
      parties: ['issuer::party-123'],
      templateIds: [CURRENT_CAP_TABLE_TEMPLATE_ID],
    });
  });

  it('fails when issuer has multiple CapTables', async () => {
    mockActiveContractsForCapTableState(mockClient, {
      current: [
        buildMockCapTableContract({
          contractId: 'cap-table-a',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          systemOperatorPartyId: 'op-a',
        }),
        buildMockCapTableContract({
          contractId: 'cap-table-b',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          systemOperatorPartyId: 'op-b',
        }),
      ],
    });

    await expect(getSystemOperatorPartyId(mockClient, 'issuer::party-123')).rejects.toThrow(
      /Multiple active CapTable contracts/
    );
  });

  it('uses discovered template id for delete and archive steps', async () => {
    mockActiveContractsForCapTableState(mockClient, {
      current: [
        buildMockCapTableContract({
          contractId: 'cap-table-v34',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          systemOperatorPartyId: 'current-system-operator',
        }),
      ],
    });

    const result = await archiveFullCapTable(mockClient, mockClient, 'issuer::party-123', {
      capTableContractId: 'cap-table-v34',
      entities: new Map<OcfEntityType, Set<string>>([
        ['issuer', new Set(['issuer-ocf-id-123'])],
        ['stakeholder', new Set(['stakeholder-1'])],
      ]),
    });

    expect(mockCapTableBatch).toHaveBeenCalledWith(
      {
        capTableContractId: 'cap-table-v34',
        capTableContractDetails: { templateId: CURRENT_CAP_TABLE_TEMPLATE_ID },
        actAs: ['issuer::party-123'],
      },
      mockClient
    );
    expect(mockBatchDelete).toHaveBeenCalledWith('stakeholder', 'stakeholder-1');
    expect(mockArchiveCapTable).toHaveBeenCalledWith(mockClient, {
      capTableContractId: 'cap-table-updated',
      capTableContractDetails: { templateId: CURRENT_CAP_TABLE_TEMPLATE_ID },
      actAs: ['current-system-operator'],
    });
    expect(result).toEqual({
      archiveUpdateId: 'archive-update-123',
      deletedEntityCount: 1,
    });
  });

  it('uses options.systemOperatorPartyId and skips batch when entities are issuer-only', async () => {
    mockActiveContractsForCapTableState(mockClient, {
      current: [
        buildMockCapTableContract({
          contractId: 'cap-table-v34',
          issuerContractId: 'issuer-contract-456',
          packageName: CURRENT_OCP_PACKAGE_NAME,
          systemOperatorPartyId: 'ledger-system-operator',
        }),
      ],
    });

    await archiveFullCapTable(
      mockClient,
      mockClient,
      'issuer::party-123',
      {
        capTableContractId: 'cap-table-v34',
        entities: new Map<OcfEntityType, Set<string>>([['issuer', new Set(['issuer-ocf-id-123'])]]),
      },
      { systemOperatorPartyId: 'db-system-operator' }
    );

    expect(mockCapTableBatch).not.toHaveBeenCalled();
    expect(mockArchiveCapTable).toHaveBeenCalledWith(mockClient, {
      capTableContractId: 'cap-table-v34',
      capTableContractDetails: { templateId: CURRENT_CAP_TABLE_TEMPLATE_ID },
      actAs: ['db-system-operator'],
    });
  });
});
