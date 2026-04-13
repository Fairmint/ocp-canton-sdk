/**
 * Tests for the damlToOcf dispatcher and helper functions.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  convertToOcf,
  ENTITY_DATA_FIELD_MAP,
  extractCreateArgument,
  extractEntityData,
  getEntityAsOcf,
  type SupportedOcfReadType,
} from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { getStakeholderAsOcf } from '../../src/functions/OpenCapTable/stakeholder/getStakeholderAsOcf';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { getStockIssuanceAsOcf } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { getStockTransferAsOcf } from '../../src/functions/OpenCapTable/stockTransfer/getStockTransferAsOcf';

function buildCreatedEventsResponse(createArgument: Record<string, unknown>, templateId?: string) {
  return {
    created: {
      createdEvent: {
        ...(templateId ? { templateId } : {}),
        createArgument,
      },
    },
  };
}

describe('damlToOcf dispatcher', () => {
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
  });

  describe('get*AsOcf readAs forwarding', () => {
    it.each([
      [
        'getIssuerAsOcf',
        async (client: LedgerJsonApiClient) =>
          getIssuerAsOcf(client, { contractId: 'issuer-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            issuer_data: {
              id: 'iss-1',
              legal_name: 'Issuer Corp',
              country_of_formation: 'US',
              formation_date: '2025-01-01T00:00:00Z',
              tax_ids: [],
            },
          },
          Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId
        ),
      ],
      [
        'getStakeholderAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStakeholderAsOcf(client, { contractId: 'stakeholder-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            stakeholder_data: {
              id: 'sh-1',
              name: { legal_name: 'Holder 1' },
              stakeholder_type: 'OcfStakeholderTypeIndividual',
              addresses: [],
              tax_ids: [],
            },
          },
          Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId
        ),
      ],
      [
        'getStockClassAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStockClassAsOcf(client, { contractId: 'stock-class-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            stock_class_data: {
              id: 'sc-1',
              name: 'Common',
              class_type: 'OcfStockClassTypeCommon',
              default_id_prefix: 'CS-',
              initial_shares_authorized: '1000',
              votes_per_share: '1',
              seniority: '1',
              conversion_rights: [],
              comments: [],
            },
          },
          Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId
        ),
      ],
      [
        'getStockIssuanceAsOcf',
        async (client: LedgerJsonApiClient) =>
          getStockIssuanceAsOcf(client, { contractId: 'stock-issuance-cid', readAs: ['issuer::p'] }),
        buildCreatedEventsResponse(
          {
            issuance_data: {
              id: 'tx-1',
              date: '2025-01-01T00:00:00Z',
              security_id: 'sec-1',
              custom_id: 'custom-sec-1',
              stakeholder_id: 'sh-1',
              stock_class_id: 'sc-1',
              share_price: { amount: '1.00', currency: 'USD' },
              quantity: '10',
              security_law_exemptions: [],
              share_numbers_issued: [],
              vestings: [],
              stock_legend_ids: [],
              comments: [],
            },
          },
          Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId
        ),
      ],
      [
        'getEntityAsOcf(stockAcceptance)',
        async (client: LedgerJsonApiClient) =>
          getEntityAsOcf(client, 'stockAcceptance', 'stock-acceptance-cid', { readAs: ['issuer::p'] }),
        buildCreatedEventsResponse({
          acceptance_data: {
            id: 'acc-1',
            date: '2025-01-01T00:00:00Z',
            security_id: 'sec-1',
            comments: [],
          },
        }),
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
  });

  describe('extractEntityData', () => {
    it('extracts entity data for stakeholder', () => {
      const createArgument = {
        stakeholder_data: { id: 'sh-1', name: { legal_name: 'Test Corp' } },
      };

      const result = extractEntityData('stakeholder', createArgument);
      expect(result).toEqual({ id: 'sh-1', name: { legal_name: 'Test Corp' } });
    });

    it('extracts entity data for stockAcceptance', () => {
      const createArgument = {
        acceptance_data: { id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' },
      };

      const result = extractEntityData('stockAcceptance', createArgument);
      expect(result).toEqual({ id: 'acc-1', date: '2025-01-01T00:00:00Z', security_id: 'sec-1' });
    });

    it('extracts stakeholderRelationshipChangeEvent data from canonical event_data key', () => {
      const createArgument = {
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

    it('extracts vestingStart data from legacy vesting_start_data key', () => {
      const createArgument = {
        vesting_start_data: {
          id: 'vs-legacy-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
        },
      };

      const result = extractEntityData('vestingStart', createArgument);
      expect(result).toEqual({
        id: 'vs-legacy-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        vesting_condition_id: 'vc-1',
      });
    });

    it('extracts vestingEvent data from canonical vesting_data key', () => {
      const createArgument = {
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

    it('extracts vestingEvent data from legacy vesting_event_data key', () => {
      const createArgument = {
        vesting_event_data: {
          id: 've-legacy-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          vesting_condition_id: 'vc-1',
        },
      };

      const result = extractEntityData('vestingEvent', createArgument);
      expect(result).toEqual({
        id: 've-legacy-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        vesting_condition_id: 'vc-1',
      });
    });

    it('extracts vestingAcceleration data from canonical acceleration_data key', () => {
      const createArgument = {
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

    it('extracts vestingAcceleration data from legacy vesting_acceleration_data key', () => {
      const createArgument = {
        vesting_acceleration_data: {
          id: 'va-legacy-1',
          date: '2025-01-01T00:00:00Z',
          security_id: 'sec-1',
          quantity: '10',
          reason_text: 'Acceleration trigger',
        },
      };

      const result = extractEntityData('vestingAcceleration', createArgument);
      expect(result).toEqual({
        id: 'va-legacy-1',
        date: '2025-01-01T00:00:00Z',
        security_id: 'sec-1',
        quantity: '10',
        reason_text: 'Acceleration trigger',
      });
    });

    it('throws when createArgument is not an object', () => {
      expect(() => extractEntityData('stakeholder', null)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', 'string')).toThrow(OcpParseError);
    });

    it('throws when expected field is missing', () => {
      const createArgument = { wrong_field: { id: 'test' } };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(
        "Expected field 'stakeholder_data' not found"
      );
    });

    it('throws when entity data is not an object', () => {
      const createArgument = { stakeholder_data: 'not an object' };

      expect(() => extractEntityData('stakeholder', createArgument)).toThrow(OcpParseError);
      expect(() => extractEntityData('stakeholder', createArgument)).toThrow('is not an object');
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
          valuation_type: 'OcfValuationType409A',
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
        expect(() => convertToOcf('unsupported' as SupportedOcfReadType, {})).toThrow(OcpParseError);
      });

      it('includes entity type in error message', () => {
        try {
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
