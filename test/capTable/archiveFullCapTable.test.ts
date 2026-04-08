import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import {
  CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
  KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES,
  getOpenCapTableCapTableTemplateIds,
} from '../../src/functions/OpenCapTable/capTable';
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
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          contractId: params.contractId,
          templateId: params.templateId ?? `#${params.packageName}:Fairmint.OpenCapTable.CapTable:CapTable`,
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

const LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE = KNOWN_OPEN_CAP_TABLE_PACKAGE_LINES.find(
  (packageLine) => packageLine !== CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE
);

if (!LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE) {
  throw new Error('Expected at least one legacy OpenCapTable package line in test fixtures');
}

const LEGACY_CAP_TABLE_TEMPLATE_ID = getOpenCapTableCapTableTemplateIds([LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE])[0];

describe('archiveFullCapTable version-aware archive support', () => {
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

  it('reads system_operator from a legacy CapTable package line', async () => {
    mockClient.getActiveContracts.mockResolvedValue([
      buildMockCapTableContract({
        contractId: 'cap-table-legacy',
        issuerContractId: 'issuer-contract-456',
        packageName: LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'legacy-system-operator',
      }),
    ] as never);

    const result = await getSystemOperatorPartyId(mockClient, 'issuer::party-123');

    expect(result).toBe('legacy-system-operator');
    expect(mockClient.getActiveContracts).toHaveBeenCalledWith({
      parties: ['issuer::party-123'],
      templateIds: getOpenCapTableCapTableTemplateIds(),
    });
  });

  it('fails explicitly when issuer has multiple CapTable matches and no contract id hint', async () => {
    mockClient.getActiveContracts.mockResolvedValue([
      buildMockCapTableContract({
        contractId: 'cap-table-current',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'current-system-operator',
      }),
      buildMockCapTableContract({
        contractId: 'cap-table-legacy',
        issuerContractId: 'issuer-contract-456',
        packageName: LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'legacy-system-operator',
      }),
    ] as never);

    await expect(getSystemOperatorPartyId(mockClient, 'issuer::party-123')).rejects.toThrow(
      'Expected exactly one CapTable contract when reading archive context'
    );
  });

  it('uses discovered legacy template id for both delete and archive steps', async () => {
    mockClient.getActiveContracts.mockResolvedValue([
      buildMockCapTableContract({
        contractId: 'cap-table-legacy',
        issuerContractId: 'issuer-contract-456',
        packageName: LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'legacy-system-operator',
      }),
    ] as never);
    mockBatchExecute.mockResolvedValue({ updatedCapTableCid: 'cap-table-legacy-updated' });

    const result = await archiveFullCapTable(mockClient, mockClient, 'issuer::party-123', {
      capTableContractId: 'cap-table-legacy',
      entities: new Map<OcfEntityType, Set<string>>([
        ['issuer', new Set(['issuer-ocf-id-123'])],
        ['stakeholder', new Set(['stakeholder-1'])],
      ]),
    });

    expect(mockCapTableBatch).toHaveBeenCalledWith(
      {
        capTableContractId: 'cap-table-legacy',
        capTableContractDetails: { templateId: LEGACY_CAP_TABLE_TEMPLATE_ID },
        actAs: ['issuer::party-123'],
      },
      mockClient
    );
    expect(mockBatchDelete).toHaveBeenCalledWith('stakeholder', 'stakeholder-1');
    expect(mockArchiveCapTable).toHaveBeenCalledWith(mockClient, {
      capTableContractId: 'cap-table-legacy-updated',
      capTableContractDetails: { templateId: LEGACY_CAP_TABLE_TEMPLATE_ID },
      actAs: ['legacy-system-operator'],
    });
    expect(result).toEqual({
      archiveUpdateId: 'archive-update-123',
      deletedEntityCount: 1,
    });
  });

  it('can disambiguate multiple matches with cantonState contract id while keeping caller override simple', async () => {
    mockClient.getActiveContracts.mockResolvedValue([
      buildMockCapTableContract({
        contractId: 'cap-table-current',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'current-system-operator',
      }),
      buildMockCapTableContract({
        contractId: 'cap-table-legacy',
        issuerContractId: 'issuer-contract-456',
        packageName: LEGACY_OPEN_CAP_TABLE_PACKAGE_LINE,
        systemOperatorPartyId: 'legacy-system-operator',
      }),
    ] as never);

    await archiveFullCapTable(
      mockClient,
      mockClient,
      'issuer::party-123',
      {
        capTableContractId: 'cap-table-legacy',
        entities: new Map<OcfEntityType, Set<string>>([['issuer', new Set(['issuer-ocf-id-123'])]]),
      },
      { systemOperatorPartyId: 'db-system-operator' }
    );

    expect(mockCapTableBatch).not.toHaveBeenCalled();
    expect(mockArchiveCapTable).toHaveBeenCalledWith(mockClient, {
      capTableContractId: 'cap-table-legacy',
      capTableContractDetails: { templateId: LEGACY_CAP_TABLE_TEMPLATE_ID },
      actAs: ['db-system-operator'],
    });
  });
});
