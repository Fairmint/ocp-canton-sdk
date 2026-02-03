/**
 * Tests for validation in DAML-to-OCF converters (getAs* functions).
 *
 * These tests verify that the converters fail fast with clear error messages when
 * required fields are missing or invalid in the DAML contract data.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpValidationError } from '../../src/errors';
import { getEquityCompensationIssuanceAsOcf } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { getStockPlanAsOcf } from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';

/**
 * Creates a mock LedgerJsonApiClient with the given createArgument data
 */
function createMockClient(dataKey: string, data: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          createArgument: {
            [dataKey]: data,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('DAML to OCF Validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEquityCompensationIssuanceAsOcf', () => {
    const validIssuanceData = {
      id: 'ec-001',
      date: '2024-01-15T00:00:00.000Z',
      security_id: 'sec-001',
      custom_id: 'ECI-001',
      stakeholder_id: 'sh-001',
      compensation_type: 'OcfCompensationTypeOption',
      quantity: '1000',
      expiration_date: null,
      termination_exercise_windows: [],
      security_law_exemptions: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData);

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.id'
      );
    });

    test('throws OcpValidationError when date is missing', async () => {
      const { date: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData);

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.date'
      );
    });

    test('throws OcpValidationError when security_id is missing', async () => {
      const { security_id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData);

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.security_id'
      );
    });

    test('throws OcpValidationError when compensation_type is unknown', async () => {
      const invalidData = { ...validIssuanceData, compensation_type: 'UnknownType' };
      const client = createMockClient('issuance_data', invalidData);

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'compensation_type'
      );
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('issuance_data', validIssuanceData);

      const result = await getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' });
      expect(result.event.id).toBe('ec-001');
      expect(result.event.compensation_type).toBe('OPTION');
    });
  });

  describe('getWarrantIssuanceAsOcf', () => {
    const validWarrantData = {
      id: 'wi-001',
      date: '2024-01-15T00:00:00.000Z',
      security_id: 'sec-001',
      custom_id: 'WI-001',
      stakeholder_id: 'sh-001',
      purchase_price: { amount: '1.00', currency: 'USD' },
      exercise_triggers: [],
      security_law_exemptions: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validWarrantData;
      const client = createMockClient('issuance_data', invalidData);

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'warrantIssuance.id'
      );
    });

    test('throws OcpValidationError when stakeholder_id is missing', async () => {
      const { stakeholder_id: _, ...invalidData } = validWarrantData;
      const client = createMockClient('issuance_data', invalidData);

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'warrantIssuance.stakeholder_id'
      );
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('issuance_data', validWarrantData);

      const result = await getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' });
      expect(result.warrantIssuance.id).toBe('wi-001');
      expect(result.warrantIssuance.purchase_price.amount).toBe('1');
    });
  });

  describe('getVestingTermsAsOcf', () => {
    const validVestingData = {
      id: 'vt-001',
      name: 'Standard 4-year Vesting',
      description: 'Standard vesting with 1-year cliff',
      allocation_type: 'OcfAllocationCumulativeRounding',
      vesting_conditions: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData);

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('vestingTerms.id');
    });

    test('throws OcpValidationError when name is missing', async () => {
      const { name: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData);

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('vestingTerms.name');
    });

    test('throws OcpValidationError when description is missing', async () => {
      const { description: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData);

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'vestingTerms.description'
      );
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('vesting_terms_data', validVestingData);

      const result = await getVestingTermsAsOcf(client, { contractId: 'test-contract' });
      expect(result.vestingTerms.id).toBe('vt-001');
      expect(result.vestingTerms.name).toBe('Standard 4-year Vesting');
    });
  });

  describe('getStockClassAsOcf', () => {
    const validStockClassData = {
      id: 'sc-001',
      name: 'Common Stock',
      class_type: 'OcfStockClassTypeCommon',
      default_id_prefix: 'CS',
      initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '10000000' },
      votes_per_share: '1',
      seniority: '1',
      conversion_rights: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData);

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockClass.id');
    });

    test('throws OcpValidationError when name is missing', async () => {
      const { name: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData);

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockClass.name');
    });

    test('handles zero values for votes_per_share correctly', async () => {
      const dataWithZeroVotes = { ...validStockClassData, votes_per_share: '0' };
      const client = createMockClient('stock_class_data', dataWithZeroVotes);

      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass.votes_per_share).toBe('0');
    });

    test('handles zero values for seniority correctly', async () => {
      const dataWithZeroSeniority = { ...validStockClassData, seniority: '0' };
      const client = createMockClient('stock_class_data', dataWithZeroSeniority);

      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass.seniority).toBe('0');
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('stock_class_data', validStockClassData);

      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass.id).toBe('sc-001');
      expect(result.stockClass.name).toBe('Common Stock');
    });
  });

  describe('getStockPlanAsOcf', () => {
    const validStockPlanData = {
      id: 'sp-001',
      plan_name: '2024 Equity Incentive Plan',
      initial_shares_reserved: '1000000',
      stock_class_ids: ['sc-001'],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData);

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockPlan.id');
    });

    test('throws OcpValidationError when plan_name is missing', async () => {
      const { plan_name: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData);

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockPlan.plan_name');
    });

    test('handles zero values for initial_shares_reserved correctly', async () => {
      const dataWithZeroShares = { ...validStockPlanData, initial_shares_reserved: '0' };
      const client = createMockClient('plan_data', dataWithZeroShares);

      const result = await getStockPlanAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockPlan.initial_shares_reserved).toBe('0');
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('plan_data', validStockPlanData);

      const result = await getStockPlanAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockPlan.id).toBe('sp-001');
      expect(result.stockPlan.plan_name).toBe('2024 Equity Incentive Plan');
    });
  });
});
