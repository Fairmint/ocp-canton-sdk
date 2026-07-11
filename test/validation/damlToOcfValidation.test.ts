/**
 * Tests for validation in DAML-to-OCF converters (getAs* functions).
 *
 * These tests verify that the converters fail fast with clear error messages when
 * required fields are missing or invalid in the DAML contract data.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../src/errors';
import { getConvertibleCancellationAsOcf } from '../../src/functions/OpenCapTable/convertibleCancellation/getConvertibleCancellationAsOcf';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { getEquityCompensationIssuanceAsOcf } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { getStakeholderRelationshipChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/getStakeholderRelationshipChangeEventAsOcf';
import { getStakeholderStatusChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/getStakeholderStatusChangeEventAsOcf';
import { getStockClassAsOcf } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { stockPlanDataToDaml } from '../../src/functions/OpenCapTable/stockPlan/createStockPlan';
import {
  damlStockPlanDataToNative,
  getStockPlanAsOcf,
} from '../../src/functions/OpenCapTable/stockPlan/getStockPlanAsOcf';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { getVestingTermsAsOcf } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import {
  createTestStockClassData,
  createTestStockPlanData,
  createTestVestingTermsData,
} from '../integration/utils/setupTestData';
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
      ...(ledgerMeta?.context !== undefined ? { context: ledgerMeta.context } : {}),
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

    async function expectStructuralFailure(data: object, field: string): Promise<void> {
      const client = createMockClient('issuance_data', data, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.equityCompensationIssuance,
      });

      try {
        await getEquityCompensationIssuanceAsOcf(client, { contractId: 'test-contract' });
        throw new Error(`Expected equity issuance decoder to reject ${field}`);
      } catch (error: unknown) {
        expect(error).toMatchObject({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: { entityType: 'equityCompensationIssuance' },
        });
        const parseError = error as OcpParseError;
        expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(
          field
        );
      }
    }

    test('throws OcpParseError when id is structurally missing', async () => {
      const { id: _, ...invalidData } = validIssuanceData;
      await expectStructuralFailure(invalidData, 'id');
    });

    test('throws OcpParseError when date is structurally missing', async () => {
      const { date: _, ...invalidData } = validIssuanceData;
      await expectStructuralFailure(invalidData, 'date');
    });

    test('throws OcpParseError when security_id is structurally missing', async () => {
      const { security_id: _, ...invalidData } = validIssuanceData;
      await expectStructuralFailure(invalidData, 'security_id');
    });

    test('throws OcpParseError when compensation_type is structurally unknown', async () => {
      const invalidData = { ...validIssuanceData, compensation_type: 'UnknownType' };
      await expectStructuralFailure(invalidData, 'compensation_type');
    });

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
        source: 'damlCancellationCreateArgument.convertibleCancellation',
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

    async function expectStructuralFailure(data: object, field: string): Promise<void> {
      const client = createMockClient('issuance_data', data, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.warrantIssuance,
      });

      try {
        await getWarrantIssuanceAsOcf(client, { contractId: 'test-contract' });
        throw new Error(`Expected warrant issuance decoder to reject ${field}`);
      } catch (error: unknown) {
        expect(error).toMatchObject({
          name: 'OcpParseError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          context: { entityType: 'warrantIssuance' },
        });
        const parseError = error as OcpParseError;
        expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(
          field
        );
      }
    }

    test('throws OcpParseError when id is structurally missing', async () => {
      const { id: _, ...invalidData } = validWarrantData;
      await expectStructuralFailure(invalidData, 'id');
    });

    test('throws OcpParseError when stakeholder_id is structurally missing', async () => {
      const { stakeholder_id: _, ...invalidData } = validWarrantData;
      await expectStructuralFailure(invalidData, 'stakeholder_id');
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
    const validVestingData = vestingTermsDataToDaml(
      createTestVestingTermsData({
        id: 'vt-001',
        name: 'Standard 4-year Vesting',
        description: 'Standard vesting with 1-year cliff',
      })
    );

    test('throws OcpParseError when id is structurally missing', async () => {
      const { id: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpParseError);
    });

    test('throws OcpParseError when name is structurally missing', async () => {
      const { name: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpParseError);
    });

    test('throws OcpParseError when description is structurally missing', async () => {
      const { description: _, ...invalidData } = validVestingData;
      const client = createMockClient('vesting_terms_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      await expect(getVestingTermsAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpParseError);
    });

    test('succeeds with valid data', async () => {
      const client = createMockClient('vesting_terms_data', validVestingData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.vestingTerms,
        context: VESTING_CONTEXT,
      });

      const result = await getVestingTermsAsOcf(client, { contractId: 'test-contract' });
      expect(result.vestingTerms.id).toBe('vt-001');
      expect(result.vestingTerms.name).toBe('Standard 4-year Vesting');
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
  });

  describe('getStockClassAsOcf', () => {
    const validStockClassData = stockClassDataToDaml(createTestStockClassData({ id: 'sc-001', name: 'Common Stock' }));

    test('throws OcpParseError when id is structurally missing', async () => {
      const { id: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpParseError);
    });

    test('throws OcpParseError when name is structurally missing', async () => {
      const { name: _, ...invalidData } = validStockClassData;
      const client = createMockClient('stock_class_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockClass,
      });

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(OcpParseError);
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
    const validStockPlanData = stockPlanDataToDaml(
      createTestStockPlanData({
        id: 'sp-001',
        plan_name: '2024 Equity Incentive Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-001'],
      })
    );

    test.each([
      { description: 'missing', value: undefined, source: 'stockPlan' },
      { description: 'null', value: null, source: 'stockPlan' },
      { description: 'a string', value: 'invalid', source: 'stockPlan' },
      { description: 'a number', value: 42, source: 'stockPlan' },
      { description: 'an array', value: [], source: 'stockPlan' },
      { description: 'an empty object', value: {}, source: 'damlEntityData.stockPlan' },
      {
        description: 'an object with the wrong fields',
        value: { id: 'sp-invalid', unexpected: true },
        source: 'damlEntityData.stockPlan',
      },
    ])('throws OcpParseError when plan_data is $description', async ({ value, source }) => {
      const client = createMockClient('plan_data', value, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      try {
        await getStockPlanAsOcf(client, { contractId: 'test-contract' });
        throw new Error('Expected StockPlan read to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpParseError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          source,
        });
      }
    });

    test('throws a schema mismatch when id is missing from ledger data', async () => {
      const { id: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlEntityData.stockPlan',
      });
    });

    test('throws a schema mismatch when plan_name is missing from ledger data', async () => {
      const { plan_name: _, ...invalidData } = validStockPlanData;
      const client = createMockClient('plan_data', invalidData, {
        templateId: MOCK_LEDGER_TEMPLATE_IDS.stockPlan,
      });

      await expect(getStockPlanAsOcf(client, { contractId: 'test-contract' })).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlEntityData.stockPlan',
      });
    });

    test('the exported converter rejects non-object runtime input without a TypeError', () => {
      const convert = () =>
        damlStockPlanDataToNative(null as unknown as Parameters<typeof damlStockPlanDataToNative>[0]);

      expect(convert).toThrow(OcpParseError);
      expect(convert).toThrow('StockPlan data must be a non-null object');
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
      const client = createMockClient('event_data', {
        id: 'rel-001',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        relationship_started: 'OcfRelAdvisor',
        relationship_ended: null,
        comments: ['Relationship changed'],
      });

      const result = await getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'test-contract' });
      await validateOcfObject(asRecord(result.event));
      expect(result.event.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(result.event.relationship_started).toBe('ADVISOR');
      expect(result.event.relationship_ended).toBeUndefined();
    });

    test('reads relationship change event from legacy relationship_change_data field', async () => {
      const client = createMockClient('relationship_change_data', {
        id: 'rel-legacy-001',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        relationship_started: null,
        relationship_ended: 'OcfRelEmployee',
        comments: [],
      });

      const result = await getStakeholderRelationshipChangeEventAsOcf(client, { contractId: 'test-contract' });
      await validateOcfObject(asRecord(result.event));
      expect(result.event.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(result.event.relationship_started).toBeUndefined();
      expect(result.event.relationship_ended).toBe('EMPLOYEE');
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

    test('reads status change event from legacy status_change_data field', async () => {
      const client = createMockClient('status_change_data', {
        id: 'status-legacy-001',
        date: '2024-01-15T00:00:00.000Z',
        stakeholder_id: 'stakeholder-1',
        new_status: 'OcfStakeholderStatusLeaveOfAbsence',
        comments: ['Leave'],
      });

      const result = await getStakeholderStatusChangeEventAsOcf(client, { contractId: 'test-contract' });
      await validateOcfObject(asRecord(result.event));
      expect(result.event.object_type).toBe('CE_STAKEHOLDER_STATUS');
      expect(result.event.new_status).toBe('LEAVE_OF_ABSENCE');
    });
  });
});
