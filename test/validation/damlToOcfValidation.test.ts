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
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
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
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { validateOcfObject } from '../utils/ocfSchemaValidator';

/** Ledger template ids for mocks — must match `readSingleContract` `expectedTemplateId` on each getter. */
const MOCK_LEDGER_TEMPLATE_IDS = {
  convertibleCancellation: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
  equityCompensationIssuance:
    Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
  warrantIssuance: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
  vestingTerms: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
  stockClass: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
  stockPlan: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
  stakeholderRelationshipChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEvent.templateId,
  stakeholderStatusChangeEvent:
    Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEvent.templateId,
} as const;

const VESTING_CONTEXT = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

/**
 * Creates a mock LedgerJsonApiClient with the given createArgument data
 */
function createMockClient(
  dataKey: string,
  data: unknown,
  ledgerMeta?: {
    templateId?: string;
    packageName?: string;
    context?: { issuer: string; system_operator: string };
  }
): LedgerJsonApiClient {
  const createdEvent: Record<string, unknown> = {
    createArgument: {
      context: ledgerMeta?.context ?? { issuer: 'issuer::party', system_operator: 'system-operator::party' },
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
    getEventsByContractId: jest.fn().mockImplementation(async ({ contractId }: { contractId: string }) => {
      await Promise.resolve();
      return {
        created: {
          createdEvent: { contractId, ...createdEvent },
        },
      };
    }),
  } as unknown as LedgerJsonApiClient;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected action to throw');
}

async function captureRejection(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

describe('DAML to OCF Validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEquityCompensationIssuanceAsOcf', () => {
    const validIssuanceData = equityCompensationIssuanceDataToDaml({
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'ec-001',
      date: '2024-01-15',
      security_id: 'sec-001',
      custom_id: 'ECI-001',
      stakeholder_id: 'sh-001',
      compensation_type: 'OPTION',
      quantity: '1000',
      exercise_price: { amount: '1.00', currency: 'USD' },
      expiration_date: null,
      termination_exercise_windows: [],
      security_law_exemptions: [],
    });

    test('throws OcpParseError when id is missing from generated DAML', async () => {
      const { id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.equityCompensationIssuance',
        context: { decoderPath: 'input.issuance_data' },
      });
    });

    test('throws OcpParseError when date is missing from generated DAML', async () => {
      const { date: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.equityCompensationIssuance',
        context: { decoderPath: 'input.issuance_data' },
      });
    });

    test('throws OcpParseError when security_id is missing from generated DAML', async () => {
      const { security_id: _, ...invalidData } = validIssuanceData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.equityCompensationIssuance',
        context: { decoderPath: 'input.issuance_data' },
      });
    });

    test('throws OcpParseError when the generated compensation_type is unknown', async () => {
      const invalidData = { ...validIssuanceData, compensation_type: 'UnknownType' };
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      await expect(getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.equityCompensationIssuance',
        context: { decoderPath: 'input.issuance_data.compensation_type' },
      });
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

        const result = getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' });
        await expect(result).rejects.toBeInstanceOf(OcpParseError);
        await expect(result).rejects.toThrow(`input.issuance_data.${field}`);
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
      const client = createMockClient('cancellation_data', validCancellationData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.convertibleCancellation,
        context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
      });

      const result = await getConvertibleCancellationAsOcf(client, {
        contractId: 'convertible-cancellation-contract-1',
      });

      expect(result.contractId).toBe('convertible-cancellation-contract-1');
      expect(result.event.amount).toEqual({ amount: '1250.5', currency: 'USD' });
    });

    test('rejects a fetched cancellation without an amount', async () => {
      const { amount: _, ...invalidData } = validCancellationData;
      const client = createMockClient('cancellation_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.convertibleCancellation,
        context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
      });

      await expect(
        getConvertibleCancellationAsOcf(client, { contractId: 'convertible-cancellation-contract-2' })
      ).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlToOcf.convertibleCancellation.createArgument',
        context: {
          entityType: 'convertibleCancellation',
          decoderPath: 'input.cancellation_data',
          decoderMessage: expect.stringContaining("key 'amount' is required"),
        },
      });
    });
  });

  describe('getWarrantIssuanceAsOcf', () => {
    const validWarrantData = warrantIssuanceDataToDaml({
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'wi-001',
      date: '2024-01-15',
      security_id: 'sec-001',
      custom_id: 'WI-001',
      stakeholder_id: 'sh-001',
      purchase_price: { amount: '1.00', currency: 'USD' },
      exercise_triggers: [],
      security_law_exemptions: [],
    });

    test('throws OcpParseError when id is missing from generated DAML', async () => {
      const { id: _, ...invalidData } = validWarrantData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.warrantIssuance',
        context: { decoderPath: 'input.issuance_data' },
      });
    });

    test('throws OcpParseError when stakeholder_id is missing from generated DAML', async () => {
      const { stakeholder_id: _, ...invalidData } = validWarrantData;
      const client = createMockClient('issuance_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      await expect(getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlComplexIssuanceCreateArgument.warrantIssuance',
        context: { decoderPath: 'input.issuance_data' },
      });
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('issuance_data', validWarrantData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      const result = await getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' });
      expect(result.event.id).toBe('wi-001');
      expect(result.event.purchase_price.amount).toBe('1');
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

    test('rejects a generated wrapper when id is missing', async () => {
      const { id: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlVestingCreateArgument.vestingTerms',
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data',
          decoderMessage: expect.stringContaining("'id'"),
        }),
      });
    });

    test('rejects a generated wrapper when name is missing', async () => {
      const { name: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlVestingCreateArgument.vestingTerms',
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data',
          decoderMessage: expect.stringContaining("'name'"),
        }),
      });
    });

    test('rejects a generated wrapper when description is missing', async () => {
      const { description: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlVestingCreateArgument.vestingTerms',
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data',
          decoderMessage: expect.stringContaining("'description'"),
        }),
      });
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('vesting_terms_data', validVestingData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      const result = await getVestingTermsAsOcf(client, { contractId: 'test-contract' });
      expect(result.event.id).toBe('vt-001');
      expect(result.event.name).toBe('Standard 4-year Vesting');
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
        source: 'damlVestingCreateArgument.vestingTerms',
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data.vesting_conditions[0].trigger',
        }),
      });
    });

    test('rejects vesting terms without a condition', async () => {
      const client = createMockClient(
        'vesting_terms_data',
        { ...validVestingData, vesting_conditions: [] },
        {
          templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
          context: VESTING_CONTEXT,
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

    test('dedicated reader rejects an unexpected relative-period value field at the exact wrapper path', async () => {
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
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlVestingCreateArgument.vestingTerms',
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data.vesting_conditions[1].trigger.value.period.value.unexpected',
        }),
      });
    });

    test.each([
      ['missing', undefined, 'required'],
      ['null', null, 'string'],
    ] as const)('dedicated reader classifies a %s relative-period length', async (_case, length, messageFragment) => {
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
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlVestingCreateArgument.vestingTerms',
        message: expect.stringContaining(messageFragment),
        context: expect.objectContaining({
          decoderPath: 'input.vesting_terms_data.vesting_conditions[0].trigger',
        }),
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
      const convert = () => damlStockPlanDataToNative(null);

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
    const context = { issuer: 'issuer::party', system_operator: 'system-operator::party' } as const;

    test('reads exact relationship wrapper data and preserves both allowed changes', async () => {
      const client = createMockClient(
        'event_data',
        {
          id: '',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: '',
          relationship_started: 'OcfRelAdvisor',
          relationship_ended: 'OcfRelAdvisor',
          comments: ['', 'duplicate', 'duplicate'],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent, context }
      );

      const result = await getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship' });
      expect(result.event).toEqual({
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: '',
        date: '2024-01-15',
        stakeholder_id: '',
        relationship_started: 'ADVISOR',
        relationship_ended: 'ADVISOR',
        comments: ['', 'duplicate', 'duplicate'],
      });
      await validateOcfObject(asRecord(result.event));
    });

    test('rejects a legacy relationship wrapper at its exact lossless path', async () => {
      const client = createMockClient(
        'relationship_change_data',
        {
          id: 'legacy',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: 'OcfRelAdvisor',
          relationship_ended: null,
          comments: [],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderRelationshipChangeEvent, context }
      );

      const error = await captureRejection(
        getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'relationship-legacy' })
      );
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
      expect(parseError.source).toBe(
        'damlToOcf.stakeholderRelationshipChangeEvent.createArgument.relationship_change_data'
      );
    });

    test.each([
      [{ relationship_started: 'OcfRelAdvisor', relationship_ended: null }, { relationship_started: 'ADVISOR' }],
      [{ relationship_started: null, relationship_ended: 'OcfRelEmployee' }, { relationship_ended: 'EMPLOYEE' }],
      [
        { relationship_started: 'OcfRelAdvisor', relationship_ended: 'OcfRelEmployee' },
        { relationship_started: 'ADVISOR', relationship_ended: 'EMPLOYEE' },
      ],
    ] as const)('accepts every relationship presence branch', (relationships, expected) => {
      const event = damlStakeholderRelationshipChangeEventToNative({
        id: 'relationship-direct',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        comments: [],
        ...relationships,
      });
      expect(event).toEqual({
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'relationship-direct',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        ...expected,
      });
    });

    test('rejects a malformed relationship enum without treating it as absent', () => {
      const error = captureThrown(() =>
        damlStakeholderRelationshipChangeEventToNative({
          id: 'relationship-invalid',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: '' as never,
          relationship_ended: 'OcfRelEmployee',
          comments: [],
        })
      );
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.UNKNOWN_ENUM_VALUE);
      expect(parseError.source).toBe('stakeholderRelationshipChangeEvent.relationship_started');
    });

    test('rejects a relationship event with neither change', () => {
      const error = captureThrown(() =>
        damlStakeholderRelationshipChangeEventToNative({
          id: 'relationship-empty',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          relationship_started: null,
          relationship_ended: null,
          comments: [],
        })
      );
      expect(error).toBeInstanceOf(OcpValidationError);
      const validationError = error as OcpValidationError;
      expect(validationError.code).toBe(OcpErrorCodes.REQUIRED_FIELD_MISSING);
      expect(validationError.fieldPath).toBe('stakeholderRelationshipChangeEvent');
    });

    test.each([
      ['OcfStakeholderStatusActive', 'ACTIVE'],
      ['OcfStakeholderStatusLeaveOfAbsence', 'LEAVE_OF_ABSENCE'],
      ['OcfStakeholderStatusTerminationVoluntaryOther', 'TERMINATION_VOLUNTARY_OTHER'],
      ['OcfStakeholderStatusTerminationVoluntaryGoodCause', 'TERMINATION_VOLUNTARY_GOOD_CAUSE'],
      ['OcfStakeholderStatusTerminationVoluntaryRetirement', 'TERMINATION_VOLUNTARY_RETIREMENT'],
      ['OcfStakeholderStatusTerminationInvoluntaryOther', 'TERMINATION_INVOLUNTARY_OTHER'],
      ['OcfStakeholderStatusTerminationInvoluntaryDeath', 'TERMINATION_INVOLUNTARY_DEATH'],
      ['OcfStakeholderStatusTerminationInvoluntaryDisability', 'TERMINATION_INVOLUNTARY_DISABILITY'],
      ['OcfStakeholderStatusTerminationInvoluntaryWithCause', 'TERMINATION_INVOLUNTARY_WITH_CAUSE'],
    ] as const)('maps generated status %s to canonical %s', (generated, canonical) => {
      const event = damlStakeholderStatusChangeEventToNative({
        id: 'status-direct',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: generated,
        comments: ['', 'duplicate', 'duplicate'],
      });
      expect(event).toEqual({
        object_type: 'CE_STAKEHOLDER_STATUS',
        id: 'status-direct',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_status: canonical,
        comments: ['', 'duplicate', 'duplicate'],
      });
    });

    test('reads an exact status wrapper and validates template identity', async () => {
      const client = createMockClient(
        'event_data',
        {
          id: 'status-1',
          date: '2024-01-15T00:00:00.000Z',
          stakeholder_id: 'stakeholder-1',
          new_status: 'OcfStakeholderStatusActive',
          comments: [],
        },
        { templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderStatusChangeEvent, context }
      );
      const result = await getStakeholderStatusChangeEventAsOcf(client, { contractId: 'status' });
      expect(result.event).toEqual({
        object_type: 'CE_STAKEHOLDER_STATUS',
        id: 'status-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_status: 'ACTIVE',
      });
    });

    test('rejects unknown status values with exact field context in direct and ledger reads', async () => {
      const invalidData = {
        id: 'status-invalid',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusFuture',
        comments: [],
      };
      const directError = captureThrown(() =>
        damlStakeholderStatusChangeEventToNative(invalidData as DamlStakeholderStatusChangeData)
      ) as OcpParseError;
      expect(directError).toBeInstanceOf(OcpParseError);
      expect(directError.code).toBe(OcpErrorCodes.UNKNOWN_ENUM_VALUE);
      expect(directError.source).toBe('stakeholderStatusChangeEvent.new_status');

      const client = createMockClient('event_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stakeholderStatusChangeEvent,
        context,
      });
      const ledgerError = (await captureRejection(
        getStakeholderStatusChangeEventAsOcf(client, { contractId: 'status-invalid' })
      )) as OcpParseError;
      expect(ledgerError).toBeInstanceOf(OcpParseError);
      expect(ledgerError.code).toBe(OcpErrorCodes.UNKNOWN_ENUM_VALUE);
      expect(ledgerError.source).toBe('damlToOcf.stakeholderStatusChangeEvent.createArgument.event_data.new_status');
    });
  });
});
