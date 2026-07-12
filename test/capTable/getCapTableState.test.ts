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
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import { classifyIssuerCapTables, getCapTableState } from '../../src/functions/OpenCapTable/capTable';
import {
  FIELD_TO_ENTITY_TYPE,
  SECURITY_ID_FIELD_TO_ENTITY_TYPE,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { requireDefined } from '../../src/utils/requireDefined';
import { completeCapTableCreateArgument, REQUIRED_CAP_TABLE_MAP_FIELDS } from './capTableTestFixtures';

// Mock the canton-node-sdk
jest.mock('@fairmint/canton-node-sdk');

const CURRENT_CAP_TABLE_TEMPLATE_ID = OCP_TEMPLATES.capTable;
const NON_CURRENT_CAP_TABLE_TEMPLATE_ID = '#OpenCapTable-other:Fairmint.OpenCapTable.CapTable:CapTable';
/** Package segment from the pinned CapTable template (tracks daml-js upgrades). */
const CURRENT_OCP_PACKAGE_NAME = requireDefined(
  CURRENT_CAP_TABLE_TEMPLATE_ID.replace(/^#/, '').split(':')[0],
  'current OCP package name'
);
const NON_CURRENT_CAP_TABLE_PACKAGE_NAME = 'OpenCapTable-other';

/** Package-id form of the pinned CapTable template (same build as `OCP_TEMPLATES.capTable`). */
const HASH_FORM_CAP_TABLE_TEMPLATE_ID = CapTable.templateIdWithPackageId;
const CURRENT_CREATED_EVENT_OPENAPI_FIELDS = {
  representativePackageId: requireDefined(
    HASH_FORM_CAP_TABLE_TEMPLATE_ID.split(':')[0],
    'representative package ID in hash-form CapTable template id'
  ),
  acsDelta: true,
} as const;

const ADVERSARIAL_MAP_KEYS = ['__proto__', 'constructor', 'z-last', 'a-first'] as const;

/** Stable pseudo-random permutation so every field exercises a different wire order without a flaky test. */
function permutedMapKeys(field: string): string[] {
  const keys = [...ADVERSARIAL_MAP_KEYS];
  let state = [...field].reduce((hash, character) => (Math.imul(hash, 33) ^ character.charCodeAt(0)) >>> 0, 5381);
  for (let index = keys.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const target = state % (index + 1);
    const currentValue = requireDefined(keys[index], `${field} permutation value ${index}`);
    const targetValue = requireDefined(keys[target], `${field} permutation value ${target}`);
    keys[index] = targetValue;
    keys[target] = currentValue;
  }
  return keys;
}

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
  mockClient.getActiveContracts.mockImplementation(
    async (req: Parameters<LedgerJsonApiClient['getActiveContracts']>[0]) => {
      await Promise.resolve();
      const ids = req.templateIds;
      if (isCurrentTemplateQuery(ids)) {
        return current as never;
      }
      throw new Error(`Unexpected getActiveContracts templateIds in test: ${JSON.stringify(ids)}`);
    }
  );
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
  const hasTemplateId = Object.prototype.hasOwnProperty.call(params, 'templateId');
  const templateId = hasTemplateId ? params.templateId : defaultTemplateId;
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
          contractId: params.contractId,
          ...(templateId !== undefined ? { templateId } : {}),
          createArgument: completeCapTableCreateArgument({
            issuer: params.issuerContractId,
            context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
            ...params.createArgument,
          }),
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
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                // This is the correct field name per Canton JSON API v2
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
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
                  stock_issuances_by_security_id: [['security-1', 'stock-issuance-contract-1']],
                  stock_cancellations: [],
                  stock_transfers: [],
                  // ... other empty fields
                }),
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

    it('accepts independent tuple permutations and dangerous keys in every CapTable GenMap', async () => {
      const objectIdFieldByEntityType = new Map(
        Object.entries(FIELD_TO_ENTITY_TYPE).map(([field, entityType]) => [entityType, field])
      );
      const entriesByField = Object.fromEntries(
        REQUIRED_CAP_TABLE_MAP_FIELDS.map((field) => {
          const securityEntityType = SECURITY_ID_FIELD_TO_ENTITY_TYPE[field];
          const contractIdField =
            securityEntityType === undefined
              ? field
              : requireDefined(objectIdFieldByEntityType.get(securityEntityType), `${field} object-ID field`);
          return [field, permutedMapKeys(field).map((key, index) => [key, `contract-${contractIdField}-${index}`])];
        })
      );
      const row = buildMockCapTableContract({
        contractId: 'cap-table-permuted-maps',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
        createArgument: entriesByField,
      });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-id-123',
          legal_name: 'Permuted Map Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );

      const result = requireDefined(await getCapTableState(mockClient, 'issuer::party-123'), 'CapTable state');

      for (const field of REQUIRED_CAP_TABLE_MAP_FIELDS) {
        const expectedKeys = permutedMapKeys(field);
        if (Object.prototype.hasOwnProperty.call(FIELD_TO_ENTITY_TYPE, field)) {
          const entityType = requireDefined(FIELD_TO_ENTITY_TYPE[field], `${field} entity type`);
          expect([...requireDefined(result.contractIds.get(entityType), `${field} contract IDs`).keys()]).toEqual(
            expectedKeys
          );
          expect([...requireDefined(result.entities.get(entityType), `${field} entities`)]).toEqual(expectedKeys);
        } else {
          const entityType = requireDefined(SECURITY_ID_FIELD_TO_ENTITY_TYPE[field], `${field} security entity type`);
          expect([...requireDefined(result.securityIds.get(entityType), `${field} security IDs`)]).toEqual(
            expectedKeys
          );
        }
      }
    });

    it('accepts the current OpenAPI envelope and validates the complete CapTable with the generated decoder', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-generated-decoder',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      mockClient.getEventsByContractId.mockResolvedValue(
        buildMockIssuerEventsResponse('issuer-contract-456', {
          id: 'issuer-ocf-id-123',
          legal_name: 'Generated Decoder Corp',
          country_of_formation: 'US',
          formation_date: '2024-01-01T00:00:00Z',
        }) as never
      );
      const decoderSpy = jest.spyOn(CapTable.decoder, 'runWithException');

      await expect(getCapTableState(mockClient, 'issuer::party-123')).resolves.not.toBeNull();

      expect(row.contractEntry.JsActiveContract.createdEvent).toMatchObject(CURRENT_CREATED_EVENT_OPENAPI_FIELDS);
      expect(decoderSpy).toHaveBeenCalledTimes(1);
      expect(decoderSpy).toHaveBeenCalledWith(row.contractEntry.JsActiveContract.createdEvent.createArgument);
      expect(decoderSpy.mock.calls[0]?.[0]).not.toBe(row.contractEntry.JsActiveContract.createdEvent.createArgument);
    });

    it('validates the active-contract envelope with the canton-node-sdk response schema', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-invalid-offset',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      (row.contractEntry.JsActiveContract.createdEvent as { offset: unknown }).offset = 'not-a-number';
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      const decoderSpy = jest.spyOn(CapTable.decoder, 'runWithException');

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'unknown',
        message: 'Invalid CapTable contract response: Canton JSON API schema mismatch',
        context: { source: 'CapTable.activeContracts' },
      });
      expect(decoderSpy).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it.each([
      {
        caseName: 'missing representativePackageId',
        field: 'representativePackageId',
        value: undefined,
        remove: true,
      },
      { caseName: 'non-string representativePackageId', field: 'representativePackageId', value: 42 },
      { caseName: 'missing acsDelta', field: 'acsDelta', value: undefined, remove: true },
      { caseName: 'non-boolean acsDelta', field: 'acsDelta', value: 'true' },
      { caseName: 'non-string contractKeyHash', field: 'contractKeyHash', value: 42 },
    ] as const)('rejects a $caseName OpenAPI active-contract extension', async ({ field, value, remove }) => {
      const row = buildMockCapTableContract({
        contractId: `cap-table-invalid-${field}`,
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      const createdEvent = row.contractEntry.JsActiveContract.createdEvent as Record<string, unknown>;
      if (remove === true) {
        delete createdEvent[field];
      } else {
        createdEvent[field] = value;
      }
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      const decoderSpy = jest.spyOn(CapTable.decoder, 'runWithException');

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_active_contract_response',
        source: `CapTable.activeContracts[0].contractEntry.JsActiveContract.createdEvent.${field}`,
      });
      expect(decoderSpy).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects duplicate keys in a CapTable map with both exact tuple indexes', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-duplicate-map-key',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: {
              stakeholders: [
                ['stakeholder-1', 'contract-1'],
                ['stakeholder-2', 'contract-2'],
                ['stakeholder-1', 'contract-3'],
              ],
            },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'CapTable.createArgument.stakeholders',
        context: {
          source: 'CapTable.createArgument.stakeholders',
          tupleIndex: 2,
          tuplePosition: 'key',
          tupleKey: 'stakeholder-1',
          duplicateTupleIndex: 2,
          originalTupleIndex: 0,
        },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects duplicate keys in every CapTable GenMap before issuer reads', async () => {
      for (const field of REQUIRED_CAP_TABLE_MAP_FIELDS) {
        mockClient.getActiveContracts.mockReset();
        mockClient.getEventsByContractId.mockClear();
        mockActiveContractsForCapTableState(mockClient, {
          current: [
            buildMockCapTableContract({
              contractId: `cap-table-duplicate-${field}`,
              issuerContractId: 'issuer-contract-456',
              packageName: CURRENT_OCP_PACKAGE_NAME,
              createArgument: {
                [field]: [
                  ['duplicate', 'contract-1'],
                  ['other', 'contract-2'],
                  ['duplicate', 'contract-3'],
                ],
              },
            }),
          ],
        });

        await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: `CapTable.createArgument.${field}`,
          context: {
            tupleIndex: 2,
            tuplePosition: 'key',
            tupleKey: 'duplicate',
            duplicateTupleIndex: 2,
            originalTupleIndex: 0,
          },
        });
        expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
      }
    });

    it('rejects duplicate contract-ID values in every CapTable GenMap before issuer reads', async () => {
      for (const field of REQUIRED_CAP_TABLE_MAP_FIELDS) {
        mockClient.getActiveContracts.mockReset();
        mockClient.getEventsByContractId.mockClear();
        mockActiveContractsForCapTableState(mockClient, {
          current: [
            buildMockCapTableContract({
              contractId: `cap-table-duplicate-value-${field}`,
              issuerContractId: 'issuer-contract-456',
              packageName: CURRENT_OCP_PACKAGE_NAME,
              createArgument: {
                [field]: [
                  ['first-index', 'duplicate-contract-id'],
                  ['second-index', 'duplicate-contract-id'],
                ],
              },
            }),
          ],
        });

        await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'invalid_cap_table_index',
          source: `CapTable.createArgument.${field}[1][1]`,
          context: {
            field,
            contractId: 'duplicate-contract-id',
            tupleIndex: 1,
            originalTupleIndex: 0,
          },
        });
        expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
      }
    });

    it('rejects missing and orphaned security-ID index values for every issuance type', async () => {
      for (const [securityIdField, entityType] of Object.entries(SECURITY_ID_FIELD_TO_ENTITY_TYPE)) {
        const objectIdField = requireDefined(
          Object.entries(FIELD_TO_ENTITY_TYPE).find(([, candidate]) => candidate === entityType)?.[0],
          `${securityIdField} object-ID field`
        );

        for (const direction of ['missing-security-index', 'orphaned-security-index'] as const) {
          mockClient.getActiveContracts.mockReset();
          mockClient.getEventsByContractId.mockClear();
          const createArgument =
            direction === 'missing-security-index'
              ? {
                  [objectIdField]: [['object-id', 'issuance-contract-id']],
                  [securityIdField]: [],
                }
              : {
                  [objectIdField]: [],
                  [securityIdField]: [['security-id', 'issuance-contract-id']],
                };
          mockActiveContractsForCapTableState(mockClient, {
            current: [
              buildMockCapTableContract({
                contractId: `cap-table-${direction}-${securityIdField}`,
                issuerContractId: 'issuer-contract-456',
                packageName: CURRENT_OCP_PACKAGE_NAME,
                createArgument,
              }),
            ],
          });

          const field = direction === 'missing-security-index' ? objectIdField : securityIdField;
          await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
            name: 'OcpParseError',
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            classification: 'invalid_cap_table_index',
            source: `CapTable.createArgument.${field}[0][1]`,
            context: {
              entityType,
              objectIdField,
              securityIdField,
              contractId: 'issuance-contract-id',
              tupleIndex: 0,
            },
          });
          expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
        }
      }
    });

    it('rejects malformed tuple, key, and value shapes in every CapTable GenMap', async () => {
      const malformedCases: ReadonlyArray<{
        readonly name: string;
        readonly map: unknown;
        readonly expectedContext: Record<string, unknown>;
      }> = [
        {
          name: 'one-element tuple',
          map: [['id-only']],
          expectedContext: { tupleIndex: 0, expectedType: '[string, value] tuple', receivedLength: 1 },
        },
        {
          name: 'non-string key',
          map: [[42, 'contract-id']],
          expectedContext: { tupleIndex: 0, tuplePosition: 'key', receivedType: 'number' },
        },
        {
          name: 'non-string value',
          map: [['object-id', { contractId: 'nested' }]],
          expectedContext: {
            tupleIndex: 0,
            tuplePosition: 'value',
            tupleKey: 'object-id',
            receivedType: 'object',
          },
        },
      ];

      for (const field of REQUIRED_CAP_TABLE_MAP_FIELDS) {
        for (const malformed of malformedCases) {
          mockClient.getActiveContracts.mockReset();
          mockClient.getEventsByContractId.mockClear();
          mockActiveContractsForCapTableState(mockClient, {
            current: [
              buildMockCapTableContract({
                contractId: `cap-table-${malformed.name}-${field}`,
                issuerContractId: 'issuer-contract-456',
                packageName: CURRENT_OCP_PACKAGE_NAME,
                createArgument: { [field]: malformed.map },
              }),
            ],
          });

          await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
            name: 'OcpParseError',
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source: `CapTable.createArgument.${field}`,
            context: malformed.expectedContext,
          });
          expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
        }
      }
    });

    it.each([
      {
        caseName: 'numeric entity-map contract ID',
        field: 'stakeholders',
        malformedMap: [['stakeholder-1', 42]],
        tupleKey: 'stakeholder-1',
        receivedType: 'number',
      },
      {
        caseName: 'object security-index contract ID',
        field: 'stock_issuances_by_security_id',
        malformedMap: [['security-1', { contractId: 'not-a-string' }]],
        tupleKey: 'security-1',
        receivedType: 'object',
      },
      {
        caseName: 'empty entity-map contract ID',
        field: 'stakeholders',
        malformedMap: [['stakeholder-2', '']],
        tupleKey: 'stakeholder-2',
        receivedType: 'string',
      },
    ])('rejects a $caseName', async ({ field, malformedMap, receivedType, tupleKey }) => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-malformed-map',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: { [field]: malformedMap },
          }),
        ],
      });

      const read = getCapTableState(mockClient, 'issuer::party-123');

      await expect(read).rejects.toBeInstanceOf(OcpParseError);
      await expect(read).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `CapTable.createArgument.${field}`,
        context: {
          source: `CapTable.createArgument.${field}`,
          tupleIndex: 0,
          tuplePosition: 'value',
          tupleKey,
          expectedType: 'non-empty string contract ID',
          receivedType,
        },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it.each([
      ['object ID', 'stakeholders'],
      ['security ID', 'stock_issuances_by_security_id'],
    ])('rejects an empty %s map key', async (_case, field) => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-empty-map-key',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: { [field]: [['', 'contract-id']] },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `CapTable.createArgument.${field}`,
        context: {
          source: `CapTable.createArgument.${field}`,
          tupleIndex: 0,
          tuplePosition: 'key',
          expectedType: 'non-empty string identifier',
          receivedType: 'string',
        },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects a missing required entity-map field', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-missing-map',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      delete row.contractEntry.JsActiveContract.createdEvent.createArgument.stakeholders;
      mockActiveContractsForCapTableState(mockClient, { current: [row] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'CapTable.createArgument.stakeholders',
        message: "CapTable createArgument requires map field 'stakeholders'; received missing",
        context: {
          source: 'CapTable.createArgument.stakeholders',
          field: 'stakeholders',
          expectedType: 'array of [identifier, contract ID] tuples',
          receivedType: 'missing',
        },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects a createArgument with a custom prototype before reading inherited map fields', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-inherited-map',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      const payload = row.contractEntry.JsActiveContract.createdEvent.createArgument;
      delete payload.stakeholders;
      Object.setPrototypeOf(payload, { stakeholders: [['inherited-id', 'inherited-contract']] });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'CapTable.activeContracts[0].contractEntry.JsActiveContract.createdEvent.createArgument',
        message: 'Generated DAML JSON must use only plain objects and arrays',
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects an array createArgument before interpreting map fields', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-array-create-argument',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      Object.defineProperty(row.contractEntry.JsActiveContract.createdEvent, 'createArgument', {
        configurable: true,
        value: [],
      });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'unknown',
        message: 'Invalid CapTable contract response: Canton JSON API schema mismatch',
        context: { source: 'CapTable.activeContracts' },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects a response with a custom prototype without reading inherited contractEntry', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-inherited-entry',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      const inheritedContractEntry = jest.fn(() => row.contractEntry);
      const inheritedRow = Object.create({
        get contractEntry() {
          return inheritedContractEntry();
        },
      });
      mockActiveContractsForCapTableState(mockClient, { current: [inheritedRow] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'CapTable.activeContracts[0]',
        message: 'Generated DAML JSON must use only plain objects and arrays',
      });
      expect(inheritedContractEntry).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects a null required security-ID map field', async () => {
      const field = 'stock_issuances_by_security_id';
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-null-map',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: { [field]: null },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: `CapTable.createArgument.${field}`,
        message: `CapTable createArgument requires map field '${field}'; received null`,
        context: {
          source: `CapTable.createArgument.${field}`,
          field,
          expectedType: 'array of [identifier, contract ID] tuples',
          receivedType: 'null',
        },
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects a missing context issuer at its exact generated field path', async () => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-missing-context-issuer',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: { context: { system_operator: 'system-op::party' } },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        source: 'CapTable.createArgument.context.issuer',
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it.each([
      ['empty', ''],
      ['different', 'issuer::different-party'],
    ])('rejects an %s context issuer', async (_case, contextIssuer) => {
      mockActiveContractsForCapTableState(mockClient, {
        current: [
          buildMockCapTableContract({
            contractId: 'cap-table-invalid-context-issuer',
            issuerContractId: 'issuer-contract-456',
            packageName: CURRENT_OCP_PACKAGE_NAME,
            createArgument: {
              context: { issuer: contextIssuer, system_operator: 'system-op::party' },
            },
          }),
        ],
      });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'CapTable.createArgument.context.issuer',
      });
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it.each([
      ['payload', 'CapTable.createArgument.unexpected_payload'],
      ['context', 'CapTable.createArgument.context.unexpected_context'],
      ['active-contract wrapper', 'CapTable.activeContracts[0].unexpected_wrapper'],
      [
        'active-contract created event',
        'CapTable.activeContracts[0].contractEntry.JsActiveContract.createdEvent.unexpected_event',
      ],
    ])('rejects an unexpected %s field without invoking the generated decoder', async (location, source) => {
      const row = buildMockCapTableContract({
        contractId: `cap-table-unexpected-${location}`,
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      if (location === 'payload') {
        row.contractEntry.JsActiveContract.createdEvent.createArgument.unexpected_payload = true;
      } else if (location === 'context') {
        const context = row.contractEntry.JsActiveContract.createdEvent.createArgument.context as Record<
          string,
          unknown
        >;
        context.unexpected_context = true;
      } else if (location === 'active-contract created event') {
        (row.contractEntry.JsActiveContract.createdEvent as Record<string, unknown>).unexpected_event = true;
      } else {
        (row as unknown as Record<string, unknown>).unexpected_wrapper = true;
      }
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      const decoderSpy = jest.spyOn(CapTable.decoder, 'runWithException');

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source,
      });
      expect(decoderSpy).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('preflights active-contract accessors without invoking them', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-accessor-map',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      const getter = jest.fn(() => [['stakeholder-1', 'contract-1']]);
      Object.defineProperty(row.contractEntry.JsActiveContract.createdEvent.createArgument, 'stakeholders', {
        enumerable: true,
        get: getter,
      });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'CapTable.activeContracts[0].contractEntry.JsActiveContract.createdEvent.createArgument.stakeholders',
      });
      expect(getter).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects an oversized active-contract map with bounded diagnostics before decoding', async () => {
      const oversizedMap = new Array<unknown>(100_001).fill(['stakeholder-1', 'contract-1']);
      const row = buildMockCapTableContract({
        contractId: 'cap-table-oversized-map',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
        createArgument: { stakeholders: oversizedMap },
      });
      mockActiveContractsForCapTableState(mockClient, { current: [row] });
      const decoderSpy = jest.spyOn(CapTable.decoder, 'runWithException');

      const read = getCapTableState(mockClient, 'issuer::party-123');
      await expect(read).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'CapTable.activeContracts[0].contractEntry.JsActiveContract.createdEvent.createArgument.stakeholders',
      });
      const error = await read.catch((caught: unknown) => caught);
      expect(JSON.stringify(error).length).toBeLessThan(4_096);
      expect(decoderSpy).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
    });

    it('rejects an active-contract proxy without invoking its traps', async () => {
      const row = buildMockCapTableContract({
        contractId: 'cap-table-proxy-wrapper',
        issuerContractId: 'issuer-contract-456',
        packageName: CURRENT_OCP_PACKAGE_NAME,
      });
      const getTrap = jest.fn(Reflect.get);
      const proxy = new Proxy(row, { get: getTrap });
      mockActiveContractsForCapTableState(mockClient, { current: [proxy] });

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_json',
        source: 'CapTable.activeContracts[0]',
      });
      expect(getTrap).not.toHaveBeenCalled();
      expect(mockClient.getEventsByContractId).not.toHaveBeenCalled();
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
        ...(templateId === undefined
          ? {
              contractId: 'unknown',
              message: 'Invalid CapTable contract response: Canton JSON API schema mismatch',
              context: { source: 'CapTable.activeContracts' },
            }
          : {
              contractId: 'cap-table-current',
              message: 'CapTable contract templateId must be a non-empty string',
            }),
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
      const badTemplateId = `${requireDefined(
        HASH_FORM_CAP_TABLE_TEMPLATE_ID.split(':')[0],
        'package reference in hash-form CapTable template id'
      )}:`;
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
        ...(packageName === undefined
          ? {
              contractId: 'unknown',
              message: 'Invalid CapTable contract response: Canton JSON API schema mismatch',
              context: { source: 'CapTable.activeContracts' },
            }
          : {
              contractId: 'cap-table-bad-pkg',
              message: 'CapTable contract packageName must be a non-empty string',
              templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
            }),
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
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-array-format',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-789',
                  context: { issuer: 'issuer::party-456', system_operator: 'system-op::party' },
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
                  stock_issuances_by_security_id: [
                    ['security-2', 'issuance-contract-2'],
                    ['security-1', 'issuance-contract-1'],
                  ],
                }),
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
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [],
                  stock_classes: [],
                  stock_plans: [],
                  // All entity maps are empty
                }),
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

    it.each([
      ['not found', new Error('Contract not found')],
      ['archived', new Error('Contract archived on ledger')],
    ])('should continue without issuer in entities when issuer fetch is %s', async (_case, issuerReadError) => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                }),
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
      mockClient.getEventsByContractId.mockRejectedValue(issuerReadError);

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

    it.each([
      [
        'visibility',
        new Error('Contract not visible for requesting party; supply readAs'),
        OcpErrorCodes.AUTHORIZATION_FAILED,
      ],
      ['auth', new Error('HTTP 403: permission denied'), OcpErrorCodes.AUTHORIZATION_FAILED],
      ['schema', new Error('Schema mismatch in issuer create argument'), OcpErrorCodes.SCHEMA_MISMATCH],
      ['network', new Error('connect ECONNREFUSED 127.0.0.1:3975'), OcpErrorCodes.CONNECTION_FAILED],
    ])('should fail loud when issuer fetch fails due to %s errors', async (_case, issuerReadError, expectedCode) => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                }),
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
      mockClient.getEventsByContractId.mockRejectedValue(issuerReadError);

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: expectedCode,
        contractId: 'issuer-contract-456',
        message: `Failed to fetch issuer contract events (${_case})`,
        diagnostics: {
          classification: _case,
          operation: 'getEventsByContractId',
          entityType: 'issuer',
          contractId: 'issuer-contract-456',
          issuerPartyId: 'issuer::party-123',
        },
      });
    });

    it('should reject when issuer_data.id is empty string', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                }),
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

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'issuer-contract-456',
        message: 'Failed to fetch issuer contract events (schema)',
        diagnostics: {
          classification: 'schema',
          operation: 'getEventsByContractId',
          entityType: 'issuer',
          contractId: 'issuer-contract-456',
          issuerPartyId: 'issuer::party-123',
        },
      });
    });

    it('should reject when issuer_data.id is missing', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                }),
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

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'issuer-contract-456',
        message: 'Failed to fetch issuer contract events (schema)',
        diagnostics: {
          classification: 'schema',
          operation: 'getEventsByContractId',
          entityType: 'issuer',
          contractId: 'issuer-contract-456',
          issuerPartyId: 'issuer::party-123',
        },
      });
    });

    it('should reject malformed issuer responses with missing createdEvent', async () => {
      const mockCapTableResponse = [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: {
                ...CURRENT_CREATED_EVENT_OPENAPI_FIELDS,
                contractId: 'cap-table-contract-123',
                templateId: CURRENT_CAP_TABLE_TEMPLATE_ID,
                createArgument: completeCapTableCreateArgument({
                  issuer: 'issuer-contract-456',
                  context: { issuer: 'issuer::party-123', system_operator: 'system-op::party' },
                  stakeholders: [['stakeholder-1', 'stakeholder-contract-1']],
                }),
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

      await expect(getCapTableState(mockClient, 'issuer::party-123')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        contractId: 'issuer-contract-456',
        message: 'Failed to fetch issuer contract events (schema)',
        diagnostics: {
          classification: 'schema',
          operation: 'getEventsByContractId',
          entityType: 'issuer',
          contractId: 'issuer-contract-456',
          issuerPartyId: 'issuer::party-123',
        },
      });
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

      mockActiveContractsForCapTableState(mockClient, { current: mockMalformedResponse });

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
