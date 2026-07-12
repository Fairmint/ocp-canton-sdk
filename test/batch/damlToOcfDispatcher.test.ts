/**
 * Tests for the damlToOcf dispatcher and helper functions.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { ENTITY_REGISTRY, isOcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  convertToOcf,
  decodeDamlEntityData,
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  extractCreateArgument,
  extractEntityData,
  getEntityAsOcf,
  type SupportedOcfReadType,
} from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { issuerDataToDaml } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { getStakeholderAsOcf } from '../../src/functions/OpenCapTable/stakeholder/getStakeholderAsOcf';
import { stakeholderDataToDaml } from '../../src/functions/OpenCapTable/stakeholder/stakeholderDataToDaml';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import { getStockIssuanceAsOcf } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { getStockTransferAsOcf } from '../../src/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';
import {
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
} from '../integration/utils/setupTestData';

const GENERATED_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

function buildCreatedEventsResponse(createArgument: Record<string, unknown>, templateId: string, contractId: string) {
  return {
    created: {
      createdEvent: {
        contractId,
        templateId,
        createArgument: { context: GENERATED_CONTEXT, ...createArgument },
      },
    },
  };
}

describe('damlToOcf dispatcher', () => {
  describe('generated DAML decoding', () => {
    const documentData = {
      id: 'document-1',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      comments: [],
      related_objects: [],
      path: null,
      uri: 'https://example.com/document.pdf',
    };

    it('accepts a lossless generated decode and re-encode', () => {
      expect(decodeDamlEntityData('document', documentData)).toEqual(documentData);
    });

    it.each(['OcfRelUnknown', ''])('classifies an unknown relationship enum %p before generated decoding', (value) => {
      expect(() =>
        decodeDamlEntityData('stakeholderRelationshipChangeEvent', {
          id: 'relationship-invalid',
          date: '2026-01-01T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          comments: [],
          relationship_started: value,
          relationship_ended: 'OcfRelEmployee',
        })
      ).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'damlToOcf.stakeholderRelationshipChangeEvent.relationship_started',
        })
      );
    });

    it.each([
      [
        'document path',
        'document',
        { ...documentData, path: 42 },
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'lossy_daml_decode',
          source: 'document.path',
        },
      ],
      [
        'issuer subdivision',
        'issuer',
        {
          id: 'issuer-1',
          country_of_formation: 'US',
          formation_date: '2026-01-01T00:00:00.000Z',
          legal_name: 'Issuer Inc.',
          comments: [],
          tax_ids: [],
          country_subdivision_of_formation: 42,
          country_subdivision_name_of_formation: 'Delaware',
        },
        {
          name: OcpValidationError.name,
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: 'issuer.country_subdivision_of_formation',
        },
      ],
      [
        'vesting quantity',
        'vestingTerms',
        {
          id: 'vesting-1',
          allocation_type: 'OcfAllocationCumulativeRounding',
          description: 'Vesting',
          name: 'Vesting',
          comments: [],
          vesting_conditions: [
            {
              id: 'condition-1',
              trigger: { tag: 'OcfVestingStartTrigger', value: {} },
              next_condition_ids: [],
              description: null,
              portion: { numerator: '1', denominator: '4', remainder: false },
              quantity: true,
            },
          ],
        },
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'lossy_daml_decode',
          source: 'vestingTerms.vesting_conditions[0].quantity',
        },
      ],
      [
        'nested vesting period extra',
        'vestingTerms',
        {
          id: 'vesting-extra-period-field',
          allocation_type: 'OcfAllocationCumulativeRounding',
          description: 'Vesting',
          name: 'Vesting',
          comments: [],
          vesting_conditions: [
            {
              id: 'condition-1',
              trigger: { tag: 'OcfVestingStartTrigger', value: {} },
              next_condition_ids: ['condition-2'],
              description: null,
              portion: { numerator: '1', denominator: '4', remainder: false },
              quantity: null,
            },
            {
              id: 'condition-2',
              trigger: {
                tag: 'OcfVestingScheduleRelativeTrigger',
                value: {
                  relative_to_condition_id: 'condition-1',
                  period: {
                    tag: 'OcfVestingPeriodDays',
                    value: { length_: '1', occurrences: '1', cliff_installment: null, unexpected: true },
                  },
                },
              },
              next_condition_ids: [],
              description: null,
              portion: null,
              quantity: '1',
            },
          ],
        },
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'lossy_daml_decode',
          source: 'vestingTerms.vesting_conditions[1].trigger.value.period.value.unexpected',
        },
      ],
    ] as const)('rejects malformed generated decoding of %s', (_case, entityType, input, expected) => {
      expect(() => decodeDamlEntityData(entityType, input)).toThrow(expect.objectContaining(expected));
    });

    it('rejects cyclic ledger JSON before generated decoding', () => {
      const cyclic = { ...documentData } as Record<string, unknown>;
      cyclic.self = cyclic;

      expect(() => decodeDamlEntityData('document', cyclic)).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          classification: 'cyclic_ledger_json',
          source: 'document.self',
        })
      );
    });

    it.each([
      [
        'ratio adjustment with a null mechanism',
        'stockClassConversionRatioAdjustment',
        'damlToOcf.stockClassConversionRatioAdjustment',
        OcpErrorCodes.SCHEMA_MISMATCH,
        {
          id: 'ratio-null-mechanism',
          date: '2026-01-01T00:00:00.000Z',
          stock_class_id: 'class-1',
          new_ratio_conversion_mechanism: null,
          comments: [],
        },
      ],
      [
        'issuer with an unknown initial-shares enum',
        'issuer',
        'issuer.initial_shares_authorized.value',
        OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        {
          id: 'issuer-unknown-shares',
          legal_name: 'Issuer Inc.',
          formation_date: '2026-01-01T00:00:00.000Z',
          country_of_formation: 'US',
          country_subdivision_of_formation: null,
          country_subdivision_name_of_formation: null,
          initial_shares_authorized: {
            tag: 'OcfInitialSharesEnum',
            value: 'OcfAuthorizedSharesSurprise',
          },
          tax_ids: [],
          comments: [],
        },
      ],
    ] as const)('rejects malformed generated data for %s', (_case, entityType, source, code, input) => {
      expect(() => decodeDamlEntityData(entityType, input)).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code,
          source,
        })
      );
    });
  });

  describe('extractCreateArgument', () => {
    it('extracts createArgument from valid events response', () => {
      const eventsResponse = {
        created: {
          createdEvent: {
            createArgument: { id: 'test', data: 'value' },
          },
        },
      };

      const result = extractCreateArgument(eventsResponse, 'contract-123');
      expect(result).toEqual({ id: 'test', data: 'value' });
    });

    it('throws OcpParseError when created event is missing', () => {
      const eventsResponse = {};

      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(OcpParseError);
      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(
        'Invalid contract events response: missing created event'
      );
    });

    it('throws OcpParseError when createArgument is missing', () => {
      const eventsResponse = {
        created: {
          createdEvent: {},
        },
      };

      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(OcpParseError);
      expect(() => extractCreateArgument(eventsResponse, 'contract-123')).toThrow(
        'Invalid contract events response: missing create argument'
      );
    });

    it('includes contract ID in error context', () => {
      const eventsResponse = {};

      try {
        extractCreateArgument(eventsResponse, 'my-contract-456');
      } catch (e) {
        const error = e as OcpParseError;
        expect(error.source).toBe('contract my-contract-456');
        expect(error.code).toBe(OcpErrorCodes.INVALID_RESPONSE);
      }
    });
  });

  describe('getEntityAsOcf', () => {
    it('forwards readAs to ledger contract reads', async () => {
      const mockClient = {
        getEventsByContractId: jest.fn().mockRejectedValue(new Error('boom')),
      } as unknown as LedgerJsonApiClient;

      await expect(
        getEntityAsOcf(mockClient, 'stockTransfer', 'contract-123', {
          readAs: ['issuer::party-123'],
        })
      ).rejects.toThrow('boom');

      expect(mockClient.getEventsByContractId).toHaveBeenCalledWith({
        contractId: 'contract-123',
        readAs: ['issuer::party-123'],
      });
    });

    it('rejects a same-field contract from the wrong generated template before conversion', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue(
        buildCreatedEventsResponse(
          {
            retraction_data: {
              id: 'warrant-retraction-1',
              date: '2025-01-01T00:00:00Z',
              security_id: 'warrant-1',
              reason_text: 'Wrong reader',
              comments: [],
            },
          },
          Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetraction.templateId,
          'wrong-template-cid'
        )
      );
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(getEntityAsOcf(mockClient, 'stockRetraction', 'wrong-template-cid')).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'module_entity_mismatch',
      });
    });

    it('enforces the full generated wrapper for generic acceptance reads', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'acceptance-cid',
            templateId: Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance.templateId,
            createArgument: {
              acceptance_data: {
                id: 'acceptance-1',
                date: '2025-01-01T00:00:00Z',
                security_id: 'security-1',
                comments: [],
              },
            },
          },
        },
      });
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(getEntityAsOcf(mockClient, 'stockAcceptance', 'acceptance-cid')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_create_argument',
        source: 'damlToOcf.stockAcceptance.createArgument',
        context: {
          entityType: 'stockAcceptance',
          decoderPath: 'input',
          decoderMessage: expect.stringContaining("key 'context' is required"),
        },
      });
    });

    it('enforces the full generated wrapper for generic cancellation reads', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'cancellation-cid',
            templateId: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
            createArgument: {
              cancellation_data: {
                id: 'cancellation-1',
                date: '2025-01-01T00:00:00Z',
                quantity: '1',
                reason_text: 'Cancelled',
                security_id: 'security-1',
                comments: [],
                balance_security_id: null,
              },
            },
          },
        },
      });
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(getEntityAsOcf(mockClient, 'stockCancellation', 'cancellation-cid')).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_create_argument',
        source: 'damlToOcf.stockCancellation.createArgument',
        context: {
          entityType: 'stockCancellation',
          decoderPath: 'input',
          decoderMessage: expect.stringContaining("key 'context' is required"),
        },
      });
    });

    it('rejects a contract whose generated decoder would erase a present optional', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue(
        buildCreatedEventsResponse(
          {
            document_data: {
              id: 'document-lossy',
              md5: 'd41d8cd98f00b204e9800998ecf8427e',
              comments: [],
              related_objects: [],
              path: 42,
              uri: 'https://example.com/document.pdf',
            },
          },
          Fairmint.OpenCapTable.OCF.Document.Document.templateId,
          'document-lossy'
        )
      );

      await expect(
        getEntityAsOcf({ getEventsByContractId } as unknown as LedgerJsonApiClient, 'document', 'document-lossy')
      ).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_daml_decode',
        source: 'document.path',
      });
    });

    it('rejects duplicate vesting next_condition_ids after lossless generic decoding', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue(
        buildCreatedEventsResponse(
          {
            vesting_terms_data: {
              id: 'vesting-duplicates',
              allocation_type: 'OcfAllocationCumulativeRounding',
              description: 'Vesting',
              name: 'Vesting',
              comments: [],
              vesting_conditions: [
                {
                  id: 'condition-1',
                  trigger: { tag: 'OcfVestingStartTrigger', value: {} },
                  next_condition_ids: ['condition-2', 'condition-2'],
                  description: null,
                  portion: { numerator: '1', denominator: '4', remainder: false },
                  quantity: null,
                },
              ],
            },
          },
          Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
          'vesting-duplicates'
        )
      );

      await expect(
        getEntityAsOcf(
          { getEventsByContractId } as unknown as LedgerJsonApiClient,
          'vestingTerms',
          'vesting-duplicates'
        )
      ).rejects.toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'vestingTerms.vesting_conditions[0].next_condition_ids[1]',
        receivedValue: 'condition-2',
      });
    });

    it.each([
      [
        'stockClassConversionRatioAdjustment',
        Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustment.templateId,
        'adjustment_data',
        OcpErrorCodes.SCHEMA_MISMATCH,
        {
          id: 'ratio-null-mechanism',
          date: '2026-01-01T00:00:00.000Z',
          stock_class_id: 'class-1',
          new_ratio_conversion_mechanism: null,
          comments: [],
        },
      ],
      [
        'issuer',
        Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
        'issuer_data',
        OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        {
          id: 'issuer-unknown-shares',
          legal_name: 'Issuer Inc.',
          formation_date: '2026-01-01T00:00:00.000Z',
          country_of_formation: 'US',
          country_subdivision_of_formation: null,
          country_subdivision_name_of_formation: null,
          initial_shares_authorized: {
            tag: 'OcfInitialSharesEnum',
            value: 'OcfAuthorizedSharesSurprise',
          },
          tax_ids: [],
          comments: [],
        },
      ],
      [
        'vestingTerms',
        Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
        'vesting_terms_data',
        OcpErrorCodes.INVALID_FORMAT,
        {
          id: 'vesting-fractional-period',
          name: 'Fractional period',
          description: 'Invalid generated DAML Int',
          allocation_type: 'OcfAllocationCumulativeRounding',
          vesting_conditions: [
            {
              id: 'condition-relative',
              description: null,
              quantity: '100',
              portion: null,
              trigger: {
                tag: 'OcfVestingScheduleRelativeTrigger',
                value: {
                  relative_to_condition_id: 'condition-start',
                  period: {
                    tag: 'OcfVestingPeriodDays',
                    value: { length_: '1.5', occurrences: '1', cliff_installment: null },
                  },
                },
              },
              next_condition_ids: [],
            },
          ],
          comments: [],
        },
      ],
    ] as const)(
      'generic reader rejects malformed conditional data for %s',
      async (entityType, templateId, field, expectedCode, data) => {
        const getEventsByContractId = jest
          .fn()
          .mockResolvedValue(buildCreatedEventsResponse({ [field]: data }, templateId, `${entityType}-malformed`));

        await expect(
          getEntityAsOcf(
            { getEventsByContractId } as unknown as LedgerJsonApiClient,
            entityType,
            `${entityType}-malformed`
          )
        ).rejects.toMatchObject({ code: expectedCode });
      }
    );
  });

  describe('ENTITY_TEMPLATE_ID_MAP', () => {
    const entityTypes = Object.keys(ENTITY_REGISTRY).filter(isOcfEntityType);

    it('covers every registered entity exactly once', () => {
      expect(Object.keys(ENTITY_TEMPLATE_ID_MAP).sort()).toEqual([...entityTypes].sort());
    });

    it.each(entityTypes)('maps %s to its generated OCF template identity', (entityType) => {
      const generatedName = `${entityType.charAt(0).toUpperCase()}${entityType.slice(1)}`;
      const expectedModuleEntityPath = `Fairmint.OpenCapTable.OCF.${generatedName}:${generatedName}`;

      expect(ENTITY_TEMPLATE_ID_MAP[entityType]).toBe(ENTITY_REGISTRY[entityType].templateId);
      expect(ENTITY_TEMPLATE_ID_MAP[entityType].split(':').slice(1).join(':')).toBe(expectedModuleEntityPath);
    });
  });

  describe('get*AsOcf readAs forwarding', () => {
    it.each([
      [
        'getIssuerAsOcf',
        async (client: LedgerJsonApiClient) =>
          getIssuerAsOcf(client, { contractId: 'issuer-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            issuer_data: issuerDataToDaml(createTestIssuerData({ id: 'iss-1', legal_name: 'Issuer Corp' })),
          },
          Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
          'issuer-cid'
        ),
      ],
      [
        'getStakeholderAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStakeholderAsOcf(client, { contractId: 'stakeholder-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            stakeholder_data: stakeholderDataToDaml(createTestStakeholderData({ id: 'sh-1' })),
          },
          Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
          'stakeholder-cid'
        ),
      ],
      [
        'getStockClassAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStockClassAsOcf(client, { contractId: 'stock-class-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            stock_class_data: stockClassDataToDaml(createTestStockClassData({ id: 'sc-1', name: 'Common' })),
          },
          Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
          'stock-class-cid'
        ),
      ],
      [
        'getStockIssuanceAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStockIssuanceAsOcf(client, { contractId: 'stock-issuance-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            issuance_data: stockIssuanceDataToDaml(
              createTestStockIssuanceData({
                id: 'tx-1',
                security_id: 'sec-1',
                stakeholder_id: 'sh-1',
                stock_class_id: 'sc-1',
                quantity: '10',
              })
            ),
          },
          Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
          'stock-issuance-cid'
        ),
      ],
      [
        'getEntityAsOcf(stockAcceptance)',
        async (client: LedgerJsonApiClient) =>
          getEntityAsOcf(client, 'stockAcceptance', 'stock-acceptance-cid', { readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            context: {
              issuer: 'issuer::p',
              system_operator: 'system-operator::p',
            },
            acceptance_data: {
              id: 'acc-1',
              date: '2025-01-01T00:00:00Z',
              security_id: 'sec-1',
              comments: [],
            },
          },
          Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptance.templateId,
          'stock-acceptance-cid'
        ),
      ],
    ])('%s forwards readAs to getEventsByContractId', async (_name, invoke, response) => {
      const getEventsByContractId = jest.fn().mockResolvedValue(response);
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(invoke(mockClient)).resolves.toBeDefined();

      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: expect.any(String),
        readAs: ['issuer::p'],
      });
    });

    it('getStockTransferAsOcf forwards readAs to getEventsByContractId', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue({ created: null });
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(
        getStockTransferAsOcf(mockClient, { contractId: 'transfer-cid', readAs: ['issuer::p'] })
      ).rejects.toThrow(OcpContractError);

      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: 'transfer-cid',
        readAs: ['issuer::p'],
      });
    });

    it('rejects a malformed stock-transfer result container with field context', async () => {
      const getEventsByContractId = jest.fn().mockResolvedValue(
        buildCreatedEventsResponse(
          {
            transfer_data: {
              id: 'transfer-1',
              date: '2026-01-01T00:00:00Z',
              security_id: 'security-1',
              quantity: '1',
              resulting_security_ids: 'security-2',
              balance_security_id: null,
              consideration_text: null,
              comments: [],
            },
          },
          Fairmint.OpenCapTable.OCF.StockTransfer.StockTransfer.templateId,
          'transfer-cid'
        )
      );
      const mockClient = { getEventsByContractId } as unknown as LedgerJsonApiClient;

      await expect(getStockTransferAsOcf(mockClient, { contractId: 'transfer-cid' })).rejects.toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'stockTransfer.resulting_security_ids',
        expectedType: 'array',
        receivedValue: 'security-2',
      } satisfies Partial<OcpValidationError>);
    });
  });

  describe('extractEntityData', () => {
    it('extracts entity data for stakeholder', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        stakeholder_data: { id: 'sh-1', name: { legal_name: 'Test Corp' } },
      };

      const result = extractEntityData('stakeholder', createArgument);
      expect(result).toEqual({ id: 'sh-1', name: { legal_name: 'Test Corp' } });
    });

    it('rejects an entity-data accessor without invoking it', () => {
      const getter = jest.fn(() => ({ id: 'sh-accessor' }));
      const createArgument: Record<string, unknown> = { context: GENERATED_CONTEXT };
      Object.defineProperty(createArgument, 'stakeholder_data', { enumerable: true, get: getter });

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'damlToOcf.stakeholder.createArgument.stakeholder_data',
        })
      );
      expect(getter).not.toHaveBeenCalled();
    });

    it('rejects inherited entity data instead of reading through the prototype', () => {
      const createArgument = Object.create({ stakeholder_data: { id: 'sh-inherited' } }) as Record<string, unknown>;

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'damlToOcf.stakeholder.createArgument',
        })
      );
    });

    it('extracts entity data for stockAcceptance', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        acceptance_data: { id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' },
      };

      const result = extractEntityData('stockAcceptance', createArgument);
      expect(result).toEqual({ id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' });
    });

    it('extracts stockPlan data from the canonical plan_data key', () => {
      const planData = {
        id: 'plan-1',
        plan_name: '2025 Equity Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['class-1'],
      };

      expect(extractEntityData('stockPlan', { context: GENERATED_CONTEXT, plan_data: planData })).toEqual(planData);
    });

    it('rejects the non-contract stock_plan_data key for stockPlan', () => {
      const extract = () =>
        extractEntityData('stockPlan', {
          context: GENERATED_CONTEXT,
          stock_plan_data: { id: 'plan-invalid-1' },
        });

      expect(extract).toThrow(OcpParseError);
      expect(extract).toThrow('Unexpected generated DAML field stock_plan_data');
    });

    it('extracts stakeholderRelationshipChangeEvent data from canonical event_data key', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        event_data: {
          id: 'rce-1',
          date: '2025-01-01T00:00:00Z',
          stakeholder_id: 'sh-1',
          relationship_started: 'OcfRelAdvisor',
          relationship_ended: null,
          comments: [],
        },
      };

      const result = extractEntityData('stakeholderRelationshipChangeEvent', createArgument);
      expect(result).toEqual({
        id: 'rce-1',
        date: '2025-01-01T00:00:00Z',
        stakeholder_id: 'sh-1',
        relationship_started: 'OcfRelAdvisor',
        relationship_ended: null,
        comments: [],
      });
    });

    it('extracts stakeholderStatusChangeEvent data from canonical event_data key', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        event_data: {
          id: 'sce-1',
          date: '2025-01-01T00:00:00Z',
          stakeholder_id: 'sh-1',
          new_status: 'OcfStakeholderStatusActive',
          comments: [],
        },
      };

      const result = extractEntityData('stakeholderStatusChangeEvent', createArgument);
      expect(result).toEqual({
        id: 'sce-1',
        date: '2025-01-01T00:00:00Z',
        stakeholder_id: 'sh-1',
        new_status: 'OcfStakeholderStatusActive',
        comments: [],
      });
    });

    it('extracts vestingStart data from canonical vesting_data key', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        vesting_data: { id: 'vs-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1', vesting_condition_id: 'vc-1' },
      };

      const result = extractEntityData('vestingStart', createArgument);
      expect(result).toEqual({
        id: 'vs-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        vesting_condition_id: 'vc-1',
      });
    });

    it('extracts vestingEvent data from canonical vesting_data key', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        vesting_data: { id: 've-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1', vesting_condition_id: 'vc-1' },
      };

      const result = extractEntityData('vestingEvent', createArgument);
      expect(result).toEqual({
        id: 've-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        vesting_condition_id: 'vc-1',
      });
    });

    it('extracts vestingAcceleration data from canonical acceleration_data key', () => {
      const createArgument = {
        context: GENERATED_CONTEXT,
        acceleration_data: {
          id: 'va-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '10',
          reason_text: 'Acceleration trigger',
        },
      };

      const result = extractEntityData('vestingAcceleration', createArgument);
      expect(result).toEqual({
        id: 'va-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        quantity: '10',
        reason_text: 'Acceleration trigger',
      });
    });

    it.each([
      {
        entityType: 'stakeholderStatusChangeEvent',
        generatedField: 'event_data',
        nonGeneratedField: 'status_change_data',
      },
      { entityType: 'vestingStart', generatedField: 'vesting_data', nonGeneratedField: 'vesting_start_data' },
      { entityType: 'vestingEvent', generatedField: 'vesting_data', nonGeneratedField: 'vesting_event_data' },
      {
        entityType: 'vestingAcceleration',
        generatedField: 'acceleration_data',
        nonGeneratedField: 'vesting_acceleration_data',
      },
    ] as const)(
      '$entityType accepts only generated $generatedField and rejects $nonGeneratedField',
      ({ entityType, generatedField, nonGeneratedField }) => {
        const data = { id: 'exact-wrapper' };
        expect(ENTITY_DATA_FIELD_MAP[entityType]).toBe(generatedField);
        expect(extractEntityData(entityType, { context: GENERATED_CONTEXT, [generatedField]: data })).toEqual(data);
        expect(() =>
          extractEntityData(entityType, {
            context: GENERATED_CONTEXT,
            [nonGeneratedField]: data,
          })
        ).toThrow(
          expect.objectContaining({
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source: `damlToOcf.${entityType}.createArgument.${nonGeneratedField}`,
          })
        );
      }
    );

    it('throws when createArgument is not an object', () => {
      expect(() => extractEntityData('stakeholder', null)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', 'string')).toThrow(OcpParseError);
    });

    it('uses the full createArgument path when the expected field is missing', () => {
      expect(() => extractEntityData('stakeholder', { context: GENERATED_CONTEXT })).toThrow(
        expect.objectContaining({
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'damlToOcf.stakeholder.createArgument',
        })
      );
    });

    it('rejects unexpected generic wrapper fields', () => {
      expect(() =>
        extractEntityData('stakeholder', {
          context: GENERATED_CONTEXT,
          stakeholder_data: { id: 'stakeholder-extra' },
          unexpected: true,
        })
      ).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'damlToOcf.stakeholder.createArgument.unexpected',
        })
      );
    });

    it.each([
      ['missing', undefined, 'damlToOcf.stakeholder.createArgument.context'],
      ['non-record', null, 'damlToOcf.stakeholder.createArgument.context'],
      [
        'missing system operator',
        { issuer: GENERATED_CONTEXT.issuer },
        'damlToOcf.stakeholder.createArgument.context.system_operator',
      ],
    ] as const)('rejects %s generic wrapper context', (_case, context, source) => {
      const createArgument = {
        ...(context === undefined ? {} : { context }),
        stakeholder_data: { id: 'stakeholder-context' },
      };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(
        expect.objectContaining({ code: OcpErrorCodes.SCHEMA_MISMATCH, source })
      );
    });

    it('throws when entity data is not an object', () => {
      const createArgument = { context: GENERATED_CONTEXT, stakeholder_data: 'not an object' };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', createArgument)).toThrow('must be a record');
    });
  });

  describe('ENTITY_DATA_FIELD_MAP', () => {
    it('has mappings for all supported entity types', () => {
      const supportedTypes: SupportedOcfReadType[] = [
        'stockAcceptance',
        'convertibleAcceptance',
        'equityCompensationAcceptance',
        'warrantAcceptance',
        'valuation',
        'vestingStart',
        'vestingEvent',
        'vestingAcceleration',
        'stockReissuance',
        'stockClassSplit',
        'stockConsolidation',
        'stockClassConversionRatioAdjustment',
      ];

      for (const type of supportedTypes) {
        expect(ENTITY_DATA_FIELD_MAP[type]).toBeDefined();
        expect(typeof ENTITY_DATA_FIELD_MAP[type]).toBe('string');
      }
    });

    it('maps acceptance types to acceptance_data', () => {
      expect(ENTITY_DATA_FIELD_MAP.stockAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.convertibleAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.warrantAcceptance).toBe('acceptance_data');
      expect(ENTITY_DATA_FIELD_MAP.equityCompensationAcceptance).toBe('acceptance_data');
    });

    it('maps vesting types to deployed DAML wrapper keys', () => {
      expect(ENTITY_DATA_FIELD_MAP.vestingStart).toBe('vesting_data');
      expect(ENTITY_DATA_FIELD_MAP.vestingEvent).toBe('vesting_data');
      expect(ENTITY_DATA_FIELD_MAP.vestingAcceleration).toBe('acceleration_data');
    });
  });

  describe('convertToOcf', () => {
    describe('acceptance types', () => {
      it('converts stockAcceptance', () => {
        const damlData = {
          id: 'acc-1',
          date: '2025-01-15T00:00:00Z',
          security_id: 'sec-1',
          comments: [],
        };

        const result = convertToOcf('stockAcceptance', damlData);

        expect(result.id).toBe('acc-1');
        expect(result.date).toBe('2025-01-15');
        expect(result.security_id).toBe('sec-1');
      });

      it('converts convertibleAcceptance', () => {
        const damlData = {
          id: 'conv-acc-1',
          date: '2025-02-20T00:00:00Z',
          security_id: 'conv-sec-1',
          comments: ['test comment'],
        };

        const result = convertToOcf('convertibleAcceptance', damlData);

        expect(result.id).toBe('conv-acc-1');
        expect(result.security_id).toBe('conv-sec-1');
        expect(result.comments).toEqual(['test comment']);
      });
    });

    describe('valuation', () => {
      it('converts valuation with all fields', () => {
        const damlData = {
          id: 'val-1',
          stock_class_id: 'sc-1',
          provider: 'Test Provider',
          board_approval_date: '2025-01-10T00:00:00Z',
          stockholder_approval_date: null,
          price_per_share: { amount: '10.00', currency: 'USD' },
          effective_date: '2025-01-15T00:00:00Z',
          valuation_type: 'OcfValuationType409A' as const,
          comments: [],
        };

        const result = convertToOcf('valuation', damlData);

        expect(result.id).toBe('val-1');
        expect(result.stock_class_id).toBe('sc-1');
        expect(result.provider).toBe('Test Provider');
        // damlMonetaryToNative normalizes amounts
        expect(result.price_per_share).toEqual({ amount: '10', currency: 'USD' });
        expect(result.valuation_type).toBe('409A');
      });
    });

    describe('vesting types', () => {
      it('converts vestingStart', () => {
        const damlData = {
          id: 'vs-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
          comments: [],
        };

        const result = convertToOcf('vestingStart', damlData);

        expect(result.id).toBe('vs-1');
        expect(result.security_id).toBe('sec-1');
        expect(result.vesting_condition_id).toBe('vc-1');
      });

      it('converts vestingEvent', () => {
        const damlData = {
          id: 've-1',
          date: '2025-06-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
          comments: [],
        };

        const result = convertToOcf('vestingEvent', damlData);

        expect(result.id).toBe('ve-1');
        expect(result.vesting_condition_id).toBe('vc-1');
      });

      it('converts vestingAcceleration', () => {
        const damlData = {
          id: 'va-1',
          date: '2025-06-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '1000',
          reason_text: 'Early exit',
          comments: [],
        };

        const result = convertToOcf('vestingAcceleration', damlData);

        expect(result.id).toBe('va-1');
        expect(result.quantity).toBe('1000');
        expect(result.reason_text).toBe('Early exit');
      });
    });

    describe('transfer types', () => {
      it('converts stockTransfer with quantity', () => {
        const damlData = {
          id: 'xfer-1',
          date: '2025-03-15T00:00:00Z',
          security_id: 'sec-1',
          quantity: '100',
          resulting_security_ids: ['sec-2'],
          balance_security_id: 'sec-3',
          consideration_text: 'Sale to investor',
          comments: [],
        };

        const result = convertToOcf('stockTransfer', damlData);

        expect(result.id).toBe('xfer-1');
        expect(result.quantity).toBe('100');
        expect(result.resulting_security_ids).toEqual(['sec-2']);
        expect((result as unknown as Record<string, unknown>).balance_security_id).toBe('sec-3');
      });

      it('converts convertibleTransfer with amount', () => {
        const damlData = {
          id: 'conv-xfer-1',
          date: '2025-03-15T00:00:00Z',
          security_id: 'conv-sec-1',
          amount: { amount: '5000.00', currency: 'USD' },
          resulting_security_ids: ['conv-sec-2'],
          balance_security_id: null,
          consideration_text: null,
          comments: [],
        };

        const result = convertToOcf('convertibleTransfer', damlData);

        expect(result.id).toBe('conv-xfer-1');
        expect(result.amount).toEqual({ amount: '5000', currency: 'USD' });
        expect(result.resulting_security_ids).toEqual(['conv-sec-2']);
      });
    });

    describe('cancellation types', () => {
      it('converts stockCancellation', () => {
        const damlData = {
          id: 'cancel-1',
          date: '2025-04-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '500',
          balance_security_id: 'sec-2',
          reason_text: 'Cancelled by issuer',
          comments: [],
        };

        const result = convertToOcf('stockCancellation', damlData);

        expect(result.id).toBe('cancel-1');
        expect(result.quantity).toBe('500');
        expect((result as unknown as Record<string, unknown>).reason_text).toBe('Cancelled by issuer');
      });
    });

    describe('stock class adjustments', () => {
      it('converts stockClassSplit', () => {
        const damlData = {
          id: 'split-1',
          date: '2025-05-01T00:00:00Z',
          stock_class_id: 'sc-1',
          split_ratio: { numerator: '2', denominator: '1' },
          comments: [],
        };

        const result = convertToOcf('stockClassSplit', damlData);

        expect(result.id).toBe('split-1');
        expect(result.stock_class_id).toBe('sc-1');
        expect((result as { split_ratio: { numerator: string; denominator: string } }).split_ratio).toEqual({
          numerator: '2',
          denominator: '1',
        });
      });
    });

    describe('error handling', () => {
      it('throws OcpParseError for unsupported entity type', () => {
        // @ts-expect-error exercise the runtime guard for an untyped unsupported caller
        expect(() => convertToOcf('unsupported' as SupportedOcfReadType, {})).toThrow(OcpParseError);
      });

      it('includes entity type in error message', () => {
        try {
          // @ts-expect-error exercise the runtime guard for an untyped unsupported caller
          convertToOcf('unsupported' as SupportedOcfReadType, {});
        } catch (e) {
          const error = e as OcpParseError;
          expect(error.message).toContain('unsupported');
          expect(error.code).toBe(OcpErrorCodes.UNKNOWN_ENTITY_TYPE);
        }
      });
    });
  });
});
