/**
 * Tests for validation in DAML-to-OCF converters (getAs* functions).
 *
 * These tests verify that the converters fail fast with clear error messages when
 * required fields are missing or invalid in the DAML contract data.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { getConvertibleCancellationAsOcf } from '../../src/functions/OpenCapTable/convertibleCancellation/getConvertibleCancellationAsOcf';
import { getEquityCompensationIssuanceAsOcf } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { damlStakeholderRelationshipChangeEventToNative } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/damlToOcf';
import { getStakeholderRelationshipChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/getStakeholderRelationshipChangeEventAsOcf';
import {
  damlStakeholderStatusChangeEventToNative,
  type DamlStakeholderStatusChangeData,
} from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/damlToOcf';
import { getStakeholderStatusChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/getStakeholderStatusChangeEventAsOcf';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import {
  damlStockPlanDataToNative,
  getStockPlanAsOcf,
} from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { validateOcfObject } from '../utils/ocfSchemaValidator';

/** Ledger template ids for mocks — must match `readSingleContract` `expectedTemplateId` on each getter. */
const MOCK_LEDGER_TEMPLATE_IDS = {
  equityCompensationIssuance:
    Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
  vestingTerms: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
  stockClass: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
  stockPlan: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
  stakeholderRelationshipChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
} as const;

/**
 * Creates a mock LedgerJsonApiClient with the given createArgument data
 */
function createMockClient(
  dataKey: string,
  data: unknown,
  ledgerMeta?: { templateId?: string; packageName?: string }
): LedgerJsonApiClient {
  const createdEvent: Record<string, unknown> = {
    createArgument: {
      context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
      [dataKey]: data,
    },
  };
  if (ledgerMeta?.templateId !== undefined) {
    createdEvent.templateId = ledgerMeta.templateId;
  }
  if (ledgerMeta?.packageName !== undefined) {
    createdEvent.packageName = ledgerMeta.packageName;
  }
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent,
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
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
      exercise_price: { amount: '1.00', currency: 'USD' },
      expiration_date: null,
      termination_exercise_windows: [],
      security_law_exemptions: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.id'
      );
    });

    test('throws OcpValidationError when date is missing', async () => {
      const { date: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.date'
      );
    });

    test('throws OcpValidationError when security_id is missing', async () => {
      const { security_id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'equityCompensationIssuance.security_id'
      );
    });

    test('throws OcpValidationError when compensation_type is unknown', async () => {
      const invalidData = { ...validIssuanceData, compensation_type: 'UnknownType' };
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'compensation_type'
      );
    });

    test.each(['exercise_price', 'base_price'] as const)(
      'reports the contextual %s path for malformed monetary data',
      async (field) => {
        const invalidData = {
          ...validIssuanceData,
          [field]: { amount: 1, currency: 'USD' },
        };
        const client = createMockClient('issuance_data', invalidData, {
          templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
        });

        await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
          {
            name: 'OcpValidationError',
            code: OcpErrorCodes.INVALID_TYPE,
            fieldPath: `equityCompensationIssuance.${field}.amount`,
            receivedValue: 1,
          }
        );
      }
    );

    test('succeeds with valid data', async () => {
      const client = createMockClient('issuance_data', validIssuanceData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      const result = await getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' });
      expect(result.event.id).toBe('ec-001');
      expect(result.event.compensation_type).toBe('OPTION');
    });
  });

  describe('getConvertibleCancellationAsOcf', () => {
    const validCancellationData = {
      id: 'convertible-cancellation-1',
      date: '2026-07-09T00:00:00.000Z',
      security_id: 'convertible-security-1',
      amount: { amount: '1250.5000000000', currency: 'USD' },
      balance_security_id: 'convertible-security-balance-1',
      reason_text: 'Partial repayment',
      comments: ['Board approved'],
    };

    test('reads the contract and returns the canonical monetary amount', async () => {
      const client = createMockClient('cancellation_data', validCancellationData);

      const result = await getConvertibleCancellationAsOcf(client, {
        contractId: 'convertible-cancellation-contract-1',
      });

      expect(result.contractId).toBe('convertible-cancellation-contract-1');
      expect(result.event.amount).toEqual({ amount: '1250.5', currency: 'USD' });
    });

    test('rejects a fetched cancellation without an amount', async () => {
      const { amount: _, ...invalidData } = validCancellationData;
      const client = createMockClient('cancellation_data', invalidData);

      await expect(
        getConvertibleCancellationAsOcf(client, { contractId: 'convertible-cancellation-contract-2' })
      ).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'convertibleCancellation.amount',
      });
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
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'warrantIssuance.id'
      );
    });

    test('throws OcpValidationError when stakeholder_id is missing', async () => {
      const { stakeholder_id: _, ...invalidData } = validWarrantData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        OcpValidationError
      );
      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'warrantIssuance.stakeholder_id'
      );
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('issuance_data', validWarrantData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

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
      comments: [],
      vesting_conditions: [
        {
          id: 'condition-1',
          description: null,
          quantity: '100',
          portion: null,
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: [],
        },
      ],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('vestingTerms.id');
    });

    test('throws OcpValidationError when name is missing', async () => {
      const { name: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('vestingTerms.name');
    });

    test('throws OcpValidationError when description is missing', async () => {
      const { description: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        'vestingTerms.description'
      );
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('vesting_terms_data', validVestingData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
      });

      const result = await getVestingTermsAsOcf(client, { contractId: 'test-contract' });
      expect(result.vestingTerms.id).toBe('vt-001');
      expect(result.vestingTerms.name).toBe('Standard 4-year Vesting');
    });

    test('dedicated reader rejects an array unit-trigger value at its exact path', async () => {
      const client = createMockClient(
        'vesting_terms_data',
        {
          ...validVestingData,
          vesting_conditions: [
            {
              ...validVestingData.vesting_conditions[0],
              trigger: { tag: 'OcfVestingStartTrigger', value: [] },
            },
          ],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms }
      );

      await expect(getVestingTermsAsOcf(client, { contractId: 'vesting-array-trigger-value' })).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'vestingTerms.vesting_conditions[0].trigger.value',
      });
    });

    test('rejects vesting terms without a condition', async () => {
      const client = createMockClient(
        'vesting_terms_data',
        { ...validVestingData, vesting_conditions: [] },
        {
          templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        }
      );

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        fieldPath: 'vestingTerms.vesting_conditions',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    });

    test('dedicated reader rejects a fractional generated vesting period Int', async () => {
      const client = createMockClient(
        'vesting_terms_data',
        {
          ...validVestingData,
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
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms }
      );

      await expect(getVestingTermsAsOcf(client, { contractId: 'vesting-fractional-period' })).rejects.toMatchObject({
        fieldPath: 'vestingTerms.vesting_conditions[0].trigger.period.length',
        code: OcpErrorCodes.INVALID_FORMAT,
      });
    });

    test('dedicated reader rejects an unexpected relative-period value field at the exact index', async () => {
      const client = createMockClient(
        'vesting_terms_data',
        {
          ...validVestingData,
          vesting_conditions: [
            ...validVestingData.vesting_conditions,
            {
              id: 'condition-relative-extra',
              description: null,
              quantity: '100',
              portion: null,
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
            },
          ],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms }
      );

      await expect(getVestingTermsAsOcf(client, { contractId: 'vesting-extra-period-field' })).rejects.toMatchObject({
        fieldPath: 'vestingTerms.vesting_conditions[1].trigger.period.value.unexpected',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        receivedValue: true,
      });
    });

    test.each([
      ['missing', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['null', null, OcpErrorCodes.INVALID_TYPE],
    ] as const)('dedicated reader classifies a %s relative-period length', async (_case, length, code) => {
      const periodValue: Record<string, unknown> = {
        occurrences: '1',
        cliff_installment: null,
      };
      if (length !== undefined) periodValue.length_ = length;
      const client = createMockClient(
        'vesting_terms_data',
        {
          ...validVestingData,
          vesting_conditions: [
            {
              id: 'condition-relative-length',
              description: null,
              quantity: '100',
              portion: null,
              trigger: {
                tag: 'OcfVestingScheduleRelativeTrigger',
                value: {
                  relative_to_condition_id: 'condition-1',
                  period: { tag: 'OcfVestingPeriodDays', value: periodValue },
                },
              },
              next_condition_ids: [],
            },
          ],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms }
      );

      await expect(
        getVestingTermsAsOcf(client, { contractId: `vesting-${_case}-period-length` })
      ).rejects.toMatchObject({
        fieldPath: 'vestingTerms.vesting_conditions[0].trigger.period.length',
        code,
        receivedValue: length,
      });
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
      comments: [],
    };

    test('throws OcpValidationError when id is missing', async () => {
      const { id: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockClass.id');
    });

    test('throws OcpValidationError when name is missing', async () => {
      const { name: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpValidationError);
      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow('stockClass.name');
    });

    test('handles zero values for votes_per_share correctly', async () => {
      const dataWithZeroVotes = { ...validStockClassData, votes_per_share: '0' };
      const client = createMockClient('stock_class_data', dataWithZeroVotes, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass.votes_per_share).toBe('0');
    });

    test('handles zero values for seniority correctly', async () => {
      const dataWithZeroSeniority = { ...validStockClassData, seniority: '0' };
      const client = createMockClient('stock_class_data', dataWithZeroSeniority, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass.seniority).toBe('0');
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('stock_class_data', validStockClassData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

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
      comments: [],
    };

    test.each([
      {
        description: 'missing',
        value: undefined,
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        source: 'StockPlan.createArgument.plan_data',
      },
      {
        description: 'null',
        value: null,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StockPlan.createArgument.plan_data',
      },
      {
        description: 'a string',
        value: 'invalid',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StockPlan.createArgument.plan_data',
      },
      {
        description: 'a number',
        value: 42,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StockPlan.createArgument.plan_data',
      },
      {
        description: 'an array',
        value: [],
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StockPlan.createArgument.plan_data',
      },
      {
        description: 'an empty object',
        value: {},
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        source: 'stockPlan.id',
      },
      {
        description: 'an object with the wrong fields',
        value: { id: 'sp-invalid', unexpected: true },
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'stockPlan.unexpected',
      },
    ])('throws OcpParseError when plan_data is $description', async ({ value, code, source }) => {
      const client = createMockClient('plan_data', value, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      try {
        await getStockPlanAsOcf(client, { contractId: 'test-contract' });
        throw new Error('Expected StockPlan read to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({ code, source });
      }
    });

    test('reports the exact id path when id is missing from ledger data', async () => {
      const { id: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        source: 'stockPlan.id',
      });
    });

    test('reports the exact plan_name path when plan_name is missing from ledger data', async () => {
      const { plan_name: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        source: 'stockPlan.plan_name',
      });
    });

    test('the exported converter rejects non-object runtime input without a TypeError', () => {
      const convert = () =>
        damlStockPlanDataToNative(null as unknown as Parameters<typeof damlStockPlanDataToNative>[0]);

      expect(convert).toThrow(OcpParseError);
      expect(convert).toThrow('Generated DAML value must be a record');
    });

    test('handles zero values for initial_shares_reserved correctly', async () => {
      const dataWithZeroShares = { ...validStockPlanData, initial_shares_reserved: '0' };
      const client = createMockClient('plan_data', dataWithZeroShares, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      const result = await getStockPlanAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockPlan.initial_shares_reserved).toBe('0');
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('plan_data', validStockPlanData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      const result = await getStockPlanAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockPlan.id).toBe('sp-001');
      expect(result.stockPlan.plan_name).toBe('2024 Equity Incentive Plan');
    });
  });

  describe('stakeholder change-event getters', () => {
    test('reads relationship change event from canonical event_data field', async () => {
      const client = createMockClient(
        'event_data',
        {
          id: 'rel-001',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: 'OcfRelAdvisor',
          relationship_ended: null,
          comments: ['Relationship changed'],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent }
      );

      const result = await getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'test-contract' });
      await validateOcfObject(asRecord(result.event));
      expect(result.event.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(result.event.relationship_started).toBe('ADVISOR');
      expect(result.event.relationship_ended).toBeUndefined();
    });

    test('rejects the legacy relationship_change_data wrapper at its exact path', async () => {
      const client = createMockClient(
        'relationship_change_data',
        {
          id: 'rel-legacy-001',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: null,
          relationship_ended: 'OcfRelEmployee',
          comments: [],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent }
      );

      await expect(
        getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'test-contract' })
      ).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StakeholderRelationshipChangeEvent.createArgument.relationship_change_data',
      });
    });

    test('rejects ambiguous canonical and legacy relationship wrappers instead of choosing one', async () => {
      const canonicalData = {
        id: 'rel-canonical',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        relationship_started: 'OcfRelAdvisor',
        relationship_ended: null,
        comments: [],
      };
      const client = {
        getEventsByContractId: jest.fn().mockResolvedValue({
          created: {
            createdEvent: {
              templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent,
              createArgument: {
                context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
                event_data: canonicalData,
                relationship_change_data: { ...canonicalData, id: 'rel-legacy' },
              },
            },
          },
        }),
      } as unknown as LedgerJsonApiClient;

      await expect(
        getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship-ambiguous' })
      ).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'StakeholderRelationshipChangeEvent.createArgument.relationship_change_data',
      });
    });

    test.each([
      ['unknown root field', { unexpected: true }, 'stakeholderRelationshipChangeEvent.unexpected'],
      ['malformed comments', { comments: 42 }, 'stakeholderRelationshipChangeEvent.comments'],
    ])('direct relationship reader rejects %s losslessly', (_case, fields, source) => {
      expect(() =>
        damlStakeholderRelationshipChangeEventToNative({
          id: 'rel-direct-lossless',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: 'OcfRelEmployee',
          relationship_ended: null,
          comments: [],
          ...fields,
        } as never)
      ).toThrow(expect.objectContaining({ name: OcpParseError.name, code: OcpErrorCodes.SCHEMA_MISMATCH, source }));
    });

    test('dedicated relationship reader rejects unknown event fields losslessly', async () => {
      const client = createMockClient(
        'event_data',
        {
          id: 'rel-dedicated-lossless',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: 'OcfRelEmployee',
          relationship_ended: null,
          comments: [],
          unexpected: true,
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent }
      );

      await expect(
        getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship-lossless' })
      ).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'stakeholderRelationshipChangeEvent.unexpected',
      });
    });

    test.each([
      ['empty', '', OcpErrorCodes.UNKNOWN_ENUM_VALUE],
      ['non-string', 42, OcpErrorCodes.SCHEMA_MISMATCH],
    ] as const)(
      'direct relationship reader rejects a %s started enum instead of omitting it',
      (_case, relationshipStarted, code) => {
        expect(() =>
          damlStakeholderRelationshipChangeEventToNative({
            id: 'rel-direct-invalid',
            date: '2024-01-15T00:00:00.000Z',
            stakeholder_id: 'stakeholder-1',
            relationship_started: relationshipStarted,
            relationship_ended: 'OcfRelEmployee',
            comments: [],
          } as never)
        ).toThrow(
          expect.objectContaining({
            name: OcpParseError.name,
            code,
            source: 'stakeholderRelationshipChangeEvent.relationship_started',
            context: expect.objectContaining({ receivedValue: relationshipStarted }),
          })
        );
      }
    );

    test.each([
      ['empty', '', OcpErrorCodes.UNKNOWN_ENUM_VALUE, 'stakeholderRelationshipChangeEvent.relationship_started'],
      ['non-string', 42, OcpErrorCodes.SCHEMA_MISMATCH, 'stakeholderRelationshipChangeEvent.relationship_started'],
    ] as const)(
      'dedicated relationship reader rejects a %s started enum with field context',
      async (_case, relationshipStarted, code, source) => {
        const client = createMockClient(
          'event_data',
          {
            id: 'rel-dedicated-invalid',
            date: '2024-01-15T00:00:00.000Z',
            stakeholder_id: 'stakeholder-1',
            relationship_started: relationshipStarted,
            relationship_ended: 'OcfRelEmployee',
            comments: [],
          },
          { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent }
        );

        await expect(
          getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship-invalid-started' })
        ).rejects.toMatchObject({
          name: OcpParseError.name,
          code,
          source,
          context: expect.objectContaining({ receivedValue: relationshipStarted }),
        });
      }
    );

    test.each([
      ['started', { relationship_ended: 'OcfRelEmployee' }, { relationship_ended: 'EMPLOYEE' }],
      ['ended', { relationship_started: 'OcfRelAdvisor' }, { relationship_started: 'ADVISOR' }],
    ] as const)('direct relationship reader accepts an omitted %s optional key', (_omitted, fields, expected) => {
      const event = damlStakeholderRelationshipChangeEventToNative({
        id: 'rel-direct-omitted-optional',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        comments: [],
        ...fields,
      } as never);

      expect(event).toEqual({
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'rel-direct-omitted-optional',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        ...expected,
      });
    });

    test.each([
      ['omitted', {}],
      ['null', { relationship_started: null, relationship_ended: null }],
    ] as const)('direct relationship reader rejects a change with both optionals %s', (_case, fields) => {
      expect(() =>
        damlStakeholderRelationshipChangeEventToNative({
          id: 'rel-direct-no-change',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          comments: [],
          ...fields,
        } as never)
      ).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: 'stakeholderRelationshipChangeEvent',
        })
      );
    });

    test.each([
      ['started', { relationship_ended: 'OcfRelEmployee' }, { relationship_ended: 'EMPLOYEE' }],
      ['ended', { relationship_started: 'OcfRelAdvisor' }, { relationship_started: 'ADVISOR' }],
    ] as const)(
      'dedicated relationship reader accepts an omitted %s optional key',
      async (_omitted, fields, expected) => {
        const client = createMockClient(
          'event_data',
          {
            id: 'rel-dedicated-omitted-optional',
            date: '2024-01-15T00:00:00.000Z',
            stakeholder_id: 'stakeholder-1',
            comments: [],
            ...fields,
          },
          { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent }
        );

        const result = await getStakeholderRelationshipChangeEventAsOcf(client, {
          contractId: 'relationship-omitted-optional',
        });

        expect(result.event).toEqual({
          object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
          id: 'rel-dedicated-omitted-optional',
          date: '2024-01-15',
          stakeholder_id: 'stakeholder-1',
          ...expected,
        });
      }
    );

    test('dedicated relationship reader rejects a compatible payload from the wrong template', async () => {
      const client = createMockClient(
        'event_data',
        {
          id: 'rel-wrong-template',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: 'OcfRelEmployee',
          relationship_ended: null,
          comments: [],
        },
        { templateId: '#wrong-package:Other.Module:OtherTemplate' }
      );

      await expect(
        getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship-wrong-template' })
      ).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'module_entity_mismatch',
      });
    });

    test('reads status change event from canonical event_data field', async () => {
      const client = createMockClient('event_data', {
        id: 'status-001',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusActive',
        comments: [],
      });

      const result = await getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' });
      await validateOcfObject(asRecord(result.event));
      expect(result.event.object_type).toBe('CE_STAKEHOLDER_STATUS');
      expect(result.event.new_status).toBe('ACTIVE');
    });

    test.each(
      ['id', 'date', 'stakeholder_id', 'new_status', 'comments'].flatMap((field) => [
        {
          label: `missing ${field}`,
          field,
          remove: true,
          value: undefined,
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        },
        { label: `null ${field}`, field, remove: false, value: null, code: OcpErrorCodes.SCHEMA_MISMATCH },
        { label: `wrong-type ${field}`, field, remove: false, value: 42, code: OcpErrorCodes.SCHEMA_MISMATCH },
      ])
    )('rejects $label status change data with a structured exact-path error', async (testCase) => {
      const eventData: Record<string, unknown> = {
        id: 'status-malformed-comments',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusActive',
        comments: [],
        [testCase.field]: testCase.value,
      };
      if (testCase.remove) delete eventData[testCase.field];
      const client = createMockClient('event_data', eventData);

      await expect(getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
        {
          name: OcpParseError.name,
          code: testCase.code,
          source: `StakeholderStatusChangeEvent.createArgument.event_data.${testCase.field}`,
        }
      );
    });

    test('rejects malformed status change comment elements at their exact index', async () => {
      const client = createMockClient('event_data', {
        id: 'status-malformed-comment-element',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusActive',
        comments: [42],
      });

      await expect(getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'StakeholderStatusChangeEvent.createArgument.event_data.comments[0]',
        }
      );
    });

    test('rejects unknown status change fields instead of dropping them', async () => {
      const client = createMockClient('event_data', {
        id: 'status-unknown-field',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusActive',
        comments: [],
        unexpected: true,
      });

      await expect(getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'StakeholderStatusChangeEvent.createArgument.event_data.unexpected',
        }
      );
    });

    test('rejects unknown status values at the dedicated reader path', async () => {
      const client = createMockClient('event_data', {
        id: 'status-unknown-enum',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusFuture',
        comments: [],
      });

      await expect(getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          source: 'StakeholderStatusChangeEvent.createArgument.event_data.new_status',
        }
      );
    });

    test.each([
      ['missing', undefined, true, 'comments', OcpErrorCodes.REQUIRED_FIELD_MISSING],
      ['null', null, false, 'comments', OcpErrorCodes.SCHEMA_MISMATCH],
      ['non-array', 42, false, 'comments', OcpErrorCodes.SCHEMA_MISMATCH],
      ['malformed element', [42], false, 'comments[0]', OcpErrorCodes.SCHEMA_MISMATCH],
    ])(
      'standalone status converter rejects %s comments with a structured exact-path error',
      (_label, comments, remove, sourceSuffix, code) => {
        const eventData: Record<string, unknown> = {
          id: 'status-standalone-boundary',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          new_status: 'OcfStakeholderStatusActive',
          comments,
        };
        if (remove) delete eventData.comments;

        expect(() =>
          damlStakeholderStatusChangeEventToNative(eventData as unknown as DamlStakeholderStatusChangeData)
        ).toThrow(
          expect.objectContaining({
            name: OcpParseError.name,
            code,
            source: `stakeholderStatusChangeEvent.${sourceSuffix}`,
          })
        );
      }
    );

    test('rejects the non-generated status_change_data wrapper', async () => {
      const client = createMockClient('status_change_data', {
        id: 'status-legacy-001',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusLeaveOfAbsence',
        comments: ['Leave'],
      });

      await expect(getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject(
        {
          name: OcpParseError.name,
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source: 'StakeholderStatusChangeEvent.createArgument.status_change_data',
        }
      );
    });
  });
});
