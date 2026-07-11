/** Direct ledger-reader contracts for the complex issuance transaction families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { getConvertibleIssuanceAsOcf } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import {
  damlEquityCompensationIssuanceDataToNative,
  getEquityCompensationIssuanceAsOcf,
} from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { OcpClient } from '../../src/OcpClient';
import type { OcfConvertibleIssuance, OcfEquityCompensationIssuance, OcfWarrantIssuance } from '../../src/types/native';

type ComplexIssuanceEntityType = Extract<
  OcfEntityType,
  'convertibleIssuance' | 'equityCompensationIssuance' | 'warrantIssuance'
>;
type ComplexIssuance = OcfConvertibleIssuance | OcfEquityCompensationIssuance | OcfWarrantIssuance;

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

function testRecord(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${description} to be an object`);
  }
  return value as Record<string, unknown>;
}

function firstTestRecord(value: unknown, description: string): Record<string, unknown> {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Expected ${description} to be a non-empty array`);
  return testRecord(value[0], `${description}[0]`);
}

function convertibleData(): Record<string, unknown> {
  return {
    ...convertibleIssuanceDataToDaml({
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-issuance-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      custom_id: 'CONV-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Cash investment',
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
      investment_amount: { amount: '1000.00', currency: 'USD' },
      convertible_type: 'SAFE',
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'convertible-trigger-1',
          nickname: 'Holder election',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Convert on mutually agreed terms',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      pro_rata: '0.10',
      seniority: 2,
      comments: ['convertible issued'],
    }),
  };
}

function equityCompensationData(variant: 'OPTION' | 'SAR' | 'RSU' = 'OPTION'): Record<string, unknown> {
  const common = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
    id: `equity-compensation-${variant.toLowerCase()}-1`,
    date: '2026-07-10',
    security_id: `equity-compensation-${variant.toLowerCase()}-security-1`,
    custom_id: `EQUITY-${variant}-1`,
    stakeholder_id: 'stakeholder-1',
    stock_plan_id: 'stock-plan-1',
    stock_class_id: 'stock-class-1',
    board_approval_date: '2026-07-09',
    stockholder_approval_date: '2026-07-08',
    consideration_text: 'Services',
    vesting_terms_id: 'vesting-terms-1',
    quantity: '100.00',
    early_exercisable: false,
    security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
    vestings: [{ date: '2027-07-10', amount: '25.00' }] as [{ date: string; amount: string }],
    expiration_date: '2036-07-10',
    termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER' as const, period: 90, period_type: 'DAYS' as const }],
    comments: ['equity compensation issued'],
  };

  switch (variant) {
    case 'OPTION':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'OPTION_ISO',
        exercise_price: { amount: '2.50', currency: 'USD' },
      });
    case 'SAR':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'CSAR',
        base_price: { amount: '3.50', currency: 'USD' },
      });
    case 'RSU':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'RSU',
      });
  }
}

function warrantData(): Record<string, unknown> {
  return {
    ...warrantIssuanceDataToDaml({
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      custom_id: 'WARRANT-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Commercial agreement',
      security_law_exemptions: [{ description: 'Section 4(a)(2)', jurisdiction: 'US' }],
      quantity: '50.00',
      quantity_source: 'INSTRUMENT_FIXED',
      exercise_price: { amount: '5.00', currency: 'USD' },
      purchase_price: { amount: '25.00', currency: 'USD' },
      exercise_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'warrant-trigger-1',
          nickname: 'Holder exercise',
          conversion_right: {
            type: 'WARRANT_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Exercise under the warrant agreement',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      warrant_expiration_date: '2031-07-10',
      vesting_terms_id: 'vesting-terms-1',
      vestings: [{ date: '2027-07-10', amount: '10.00' }],
      comments: ['warrant issued'],
    }),
  };
}

function warrantStockClassData(): Record<string, unknown> {
  return warrantIssuanceDataToDaml({
    object_type: 'TX_WARRANT_ISSUANCE',
    id: 'warrant-stock-class-issuance-1',
    date: '2026-07-10',
    security_id: 'warrant-stock-class-security-1',
    custom_id: 'WARRANT-STOCK-CLASS-1',
    stakeholder_id: 'stakeholder-1',
    purchase_price: { amount: '25', currency: 'USD' },
    security_law_exemptions: [],
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'stock-class-trigger-1',
        conversion_right: {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            ratio: { numerator: '1', denominator: '2' },
            conversion_price: { amount: '3', currency: 'USD' },
            rounding_type: 'NORMAL',
          },
          converts_to_stock_class_id: 'stock-class-1',
        },
      },
    ],
  });
}

const UNSUPPORTED_STOCK_CLASS_STORAGE_FIELDS = [
  {
    field: 'ceiling_price_per_share',
    value: { amount: '1.12345678901', currency: 'usd' },
  },
  { field: 'custom_description', value: 'Legacy stock-class conversion' },
  { field: 'discount_rate', value: '0.1' },
  { field: 'expires_at', value: '2030-01-01T00:00:00Z' },
  { field: 'floor_price_per_share', value: { amount: '1', currency: 'USD' } },
  { field: 'percent_of_capitalization', value: '10' },
  { field: 'reference_share_price', value: { amount: '1', currency: 'USD' } },
  { field: 'reference_valuation_price_per_share', value: { amount: '1', currency: 'USD' } },
  { field: 'valuation_cap', value: { amount: '1000000', currency: 'USD' } },
] as const;

interface ComplexIssuanceReaderCase {
  readonly entityType: ComplexIssuanceEntityType;
  readonly contractId: string;
  readonly objectType: 'TX_CONVERTIBLE_ISSUANCE' | 'TX_EQUITY_COMPENSATION_ISSUANCE' | 'TX_WARRANT_ISSUANCE';
  readonly validData: () => Record<string, unknown>;
  readonly malformedNumericData: () => Record<string, unknown>;
  readonly semanticallyInvalidNumericData: () => Record<string, unknown>;
  readonly semanticNumericPath: string;
  readonly expectedEvent: ComplexIssuance;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: ComplexIssuance; readonly contractId: string }>;
}

const issuanceReaderCases: readonly ComplexIssuanceReaderCase[] = [
  {
    entityType: 'convertibleIssuance',
    contractId: 'convertible-issuance-cid',
    objectType: 'TX_CONVERTIBLE_ISSUANCE',
    validData: convertibleData,
    malformedNumericData: () => ({
      ...convertibleData(),
      investment_amount: { amount: 17, currency: 'USD' },
    }),
    semanticallyInvalidNumericData: () => ({
      ...convertibleData(),
      investment_amount: { amount: '1e3', currency: 'USD' },
    }),
    semanticNumericPath: 'convertibleIssuance.investment_amount.amount',
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-issuance-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      custom_id: 'CONV-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Cash investment',
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
      investment_amount: { amount: '1000', currency: 'USD' },
      convertible_type: 'SAFE',
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'convertible-trigger-1',
          nickname: 'Holder election',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Convert on mutually agreed terms',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      pro_rata: '0.1',
      seniority: 2,
      comments: ['convertible issued'],
    },
    invoke: async (client, readAs) =>
      getConvertibleIssuanceAsOcf(client, {
        contractId: 'convertible-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'equityCompensationIssuance',
    contractId: 'equity-compensation-issuance-cid',
    objectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    validData: equityCompensationData,
    malformedNumericData: () => ({ ...equityCompensationData(), quantity: 17 }),
    semanticallyInvalidNumericData: () => ({ ...equityCompensationData(), quantity: '1e3' }),
    semanticNumericPath: 'equityCompensationIssuance.quantity',
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'equity-compensation-option-1',
      date: '2026-07-10',
      security_id: 'equity-compensation-option-security-1',
      custom_id: 'EQUITY-OPTION-1',
      stakeholder_id: 'stakeholder-1',
      compensation_type: 'OPTION_ISO',
      exercise_price: { amount: '2.5', currency: 'USD' },
      quantity: '100',
      expiration_date: '2036-07-10',
      termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER', period: 90, period_type: 'DAYS' }],
      early_exercisable: false,
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Services',
      vesting_terms_id: 'vesting-terms-1',
      stock_class_id: 'stock-class-1',
      stock_plan_id: 'stock-plan-1',
      security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
      vestings: [{ date: '2027-07-10', amount: '25' }],
      comments: ['equity compensation issued'],
    },
    invoke: async (client, readAs) =>
      getEquityCompensationIssuanceAsOcf(client, {
        contractId: 'equity-compensation-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'warrantIssuance',
    contractId: 'warrant-issuance-cid',
    objectType: 'TX_WARRANT_ISSUANCE',
    validData: warrantData,
    malformedNumericData: () => ({
      ...warrantData(),
      purchase_price: { amount: 17, currency: 'USD' },
    }),
    semanticallyInvalidNumericData: () => ({
      ...warrantData(),
      purchase_price: { amount: '1e3', currency: 'USD' },
    }),
    semanticNumericPath: 'warrantIssuance.purchase_price.amount',
    expectedEvent: {
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      custom_id: 'WARRANT-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Commercial agreement',
      security_law_exemptions: [{ description: 'Section 4(a)(2)', jurisdiction: 'US' }],
      quantity: '50',
      quantity_source: 'INSTRUMENT_FIXED',
      exercise_price: { amount: '5', currency: 'USD' },
      purchase_price: { amount: '25', currency: 'USD' },
      exercise_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'warrant-trigger-1',
          nickname: 'Holder exercise',
          conversion_right: {
            type: 'WARRANT_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Exercise under the warrant agreement',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      warrant_expiration_date: '2031-07-10',
      vesting_terms_id: 'vesting-terms-1',
      vestings: [{ date: '2027-07-10', amount: '10' }],
      comments: ['warrant issued'],
    },
    invoke: async (client, readAs) => {
      const result = await getWarrantIssuanceAsOcf(client, {
        contractId: 'warrant-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      });
      return { event: result.warrantIssuance, contractId: result.contractId };
    },
  },
];

function createMockClient(
  testCase: ComplexIssuanceReaderCase,
  data: unknown,
  options: { readonly createArgument?: unknown; readonly templateId?: string } = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : { context: VALID_CONTEXT, [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        createArgument,
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

interface IssuanceNumericLocationCase {
  readonly name: string;
  readonly caseIndex: 0 | 1 | 2;
  readonly fieldPath: string;
  readonly setValue: (data: Record<string, unknown>, value: string) => void;
  readonly getValue: (event: ComplexIssuance) => unknown;
}

const issuanceNumericLocationCases: readonly IssuanceNumericLocationCase[] = [
  {
    name: 'convertible investment amount',
    caseIndex: 0,
    fieldPath: 'convertibleIssuance.investment_amount.amount',
    setValue: (data, value) => {
      testRecord(data.investment_amount, 'investment_amount').amount = value;
    },
    getValue: (event) => (event.object_type === 'TX_CONVERTIBLE_ISSUANCE' ? event.investment_amount.amount : undefined),
  },
  {
    name: 'convertible pro rata',
    caseIndex: 0,
    fieldPath: 'convertibleIssuance.pro_rata',
    setValue: (data, value) => {
      data.pro_rata = value;
    },
    getValue: (event) => (event.object_type === 'TX_CONVERTIBLE_ISSUANCE' ? event.pro_rata : undefined),
  },
  {
    name: 'convertible fixed-amount mechanism',
    caseIndex: 0,
    fieldPath: 'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.converts_to_quantity',
    setValue: (data, value) => {
      const trigger = firstTestRecord(data.conversion_triggers, 'conversion_triggers');
      const right = testRecord(trigger.conversion_right, 'conversion_right');
      right.conversion_mechanism = {
        tag: 'OcfConvMechFixedAmount',
        value: { converts_to_quantity: value },
      };
    },
    getValue: (event) => {
      if (event.object_type !== 'TX_CONVERTIBLE_ISSUANCE') return undefined;
      const mechanism = event.conversion_triggers[0].conversion_right.conversion_mechanism;
      return mechanism.type === 'FIXED_AMOUNT_CONVERSION' ? mechanism.converts_to_quantity : undefined;
    },
  },
  {
    name: 'equity compensation quantity',
    caseIndex: 1,
    fieldPath: 'equityCompensationIssuance.quantity',
    setValue: (data, value) => {
      data.quantity = value;
    },
    getValue: (event) => (event.object_type === 'TX_EQUITY_COMPENSATION_ISSUANCE' ? event.quantity : undefined),
  },
  {
    name: 'equity compensation exercise-price amount',
    caseIndex: 1,
    fieldPath: 'equityCompensationIssuance.exercise_price.amount',
    setValue: (data, value) => {
      testRecord(data.exercise_price, 'exercise_price').amount = value;
    },
    getValue: (event) =>
      event.object_type === 'TX_EQUITY_COMPENSATION_ISSUANCE' && 'exercise_price' in event
        ? event.exercise_price.amount
        : undefined,
  },
  {
    name: 'equity compensation vesting amount',
    caseIndex: 1,
    fieldPath: 'equityCompensationIssuance.vestings[0].amount',
    setValue: (data, value) => {
      firstTestRecord(data.vestings, 'vestings').amount = value;
    },
    getValue: (event) =>
      event.object_type === 'TX_EQUITY_COMPENSATION_ISSUANCE' ? event.vestings?.[0]?.amount : undefined,
  },
  {
    name: 'warrant quantity',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.quantity',
    setValue: (data, value) => {
      data.quantity = value;
    },
    getValue: (event) => (event.object_type === 'TX_WARRANT_ISSUANCE' ? event.quantity : undefined),
  },
  {
    name: 'warrant purchase-price amount',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.purchase_price.amount',
    setValue: (data, value) => {
      testRecord(data.purchase_price, 'purchase_price').amount = value;
    },
    getValue: (event) => (event.object_type === 'TX_WARRANT_ISSUANCE' ? event.purchase_price.amount : undefined),
  },
  {
    name: 'warrant exercise-price amount',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.exercise_price.amount',
    setValue: (data, value) => {
      testRecord(data.exercise_price, 'exercise_price').amount = value;
    },
    getValue: (event) => (event.object_type === 'TX_WARRANT_ISSUANCE' ? event.exercise_price?.amount : undefined),
  },
  {
    name: 'warrant vesting amount',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.vestings[0].amount',
    setValue: (data, value) => {
      firstTestRecord(data.vestings, 'vestings').amount = value;
    },
    getValue: (event) => (event.object_type === 'TX_WARRANT_ISSUANCE' ? event.vestings?.[0]?.amount : undefined),
  },
  {
    name: 'warrant fixed-amount mechanism',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.exercise_triggers[0].conversion_right.value.conversion_mechanism.converts_to_quantity',
    setValue: (data, value) => {
      const trigger = firstTestRecord(data.exercise_triggers, 'exercise_triggers');
      const rightVariant = testRecord(trigger.conversion_right, 'conversion_right');
      const right = testRecord(rightVariant.value, 'conversion_right.value');
      right.conversion_mechanism = {
        tag: 'OcfWarrantMechanismFixedAmount',
        value: { converts_to_quantity: value },
      };
    },
    getValue: (event) => {
      if (event.object_type !== 'TX_WARRANT_ISSUANCE') return undefined;
      const right = event.exercise_triggers[0]?.conversion_right;
      const mechanism = right?.type === 'WARRANT_CONVERSION_RIGHT' ? right.conversion_mechanism : undefined;
      return mechanism?.type === 'FIXED_AMOUNT_CONVERSION' ? mechanism.converts_to_quantity : undefined;
    },
  },
];

interface IssuanceCurrencyLocationCase {
  readonly name: string;
  readonly caseIndex: 0 | 1 | 2;
  readonly fieldPath: string;
  readonly dataFactory?: () => Record<string, unknown>;
  readonly setCurrency: (data: Record<string, unknown>, currency: string) => void;
}

const issuanceCurrencyLocationCases: readonly IssuanceCurrencyLocationCase[] = [
  {
    name: 'convertible investment amount',
    caseIndex: 0,
    fieldPath: 'convertibleIssuance.investment_amount.currency',
    setCurrency: (data, currency) => {
      testRecord(data.investment_amount, 'investment_amount').currency = currency;
    },
  },
  {
    name: 'convertible conversion valuation cap',
    caseIndex: 0,
    fieldPath:
      'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap.currency',
    setCurrency: (data, currency) => {
      const trigger = firstTestRecord(data.conversion_triggers, 'conversion_triggers');
      const right = testRecord(trigger.conversion_right, 'conversion_right');
      right.conversion_mechanism = {
        tag: 'OcfConvMechSAFE',
        value: {
          conversion_mfn: false,
          capitalization_definition: null,
          capitalization_definition_rules: null,
          conversion_discount: null,
          conversion_timing: null,
          conversion_valuation_cap: { amount: '10', currency },
          exit_multiple: null,
        },
      };
    },
  },
  {
    name: 'equity compensation exercise price',
    caseIndex: 1,
    fieldPath: 'equityCompensationIssuance.exercise_price.currency',
    setCurrency: (data, currency) => {
      testRecord(data.exercise_price, 'exercise_price').currency = currency;
    },
  },
  {
    name: 'equity compensation base price',
    caseIndex: 1,
    fieldPath: 'equityCompensationIssuance.base_price.currency',
    dataFactory: () => equityCompensationData('SAR'),
    setCurrency: (data, currency) => {
      testRecord(data.base_price, 'base_price').currency = currency;
    },
  },
  {
    name: 'warrant purchase price',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.purchase_price.currency',
    setCurrency: (data, currency) => {
      testRecord(data.purchase_price, 'purchase_price').currency = currency;
    },
  },
  {
    name: 'warrant exercise price',
    caseIndex: 2,
    fieldPath: 'warrantIssuance.exercise_price.currency',
    setCurrency: (data, currency) => {
      testRecord(data.exercise_price, 'exercise_price').currency = currency;
    },
  },
  {
    name: 'warrant valuation amount',
    caseIndex: 2,
    fieldPath:
      'warrantIssuance.exercise_triggers[0].conversion_right.value.conversion_mechanism.valuation_amount.currency',
    setCurrency: (data, currency) => {
      const trigger = firstTestRecord(data.exercise_triggers, 'exercise_triggers');
      const variant = testRecord(trigger.conversion_right, 'conversion_right');
      const right = testRecord(variant.value, 'conversion_right.value');
      right.conversion_mechanism = {
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: 'OcfValuationCap',
          capitalization_definition: null,
          capitalization_definition_rules: null,
          valuation_amount: { amount: '10', currency },
        },
      };
    },
  },
  {
    name: 'warrant PPS discount amount',
    caseIndex: 2,
    fieldPath:
      'warrantIssuance.exercise_triggers[0].conversion_right.value.conversion_mechanism.discount_amount.currency',
    setCurrency: (data, currency) => {
      const trigger = firstTestRecord(data.exercise_triggers, 'exercise_triggers');
      const variant = testRecord(trigger.conversion_right, 'conversion_right');
      const right = testRecord(variant.value, 'conversion_right.value');
      right.conversion_mechanism = {
        tag: 'OcfWarrantMechanismPpsBased',
        value: {
          description: 'Discounted exercise',
          discount: true,
          discount_amount: { amount: '1', currency },
          discount_percentage: null,
        },
      };
    },
  },
  {
    name: 'stock-class conversion price',
    caseIndex: 2,
    fieldPath:
      'warrantIssuance.exercise_triggers[0].conversion_right.value.conversion_mechanism.conversion_price.currency',
    dataFactory: warrantStockClassData,
    setCurrency: (data, currency) => {
      const trigger = firstTestRecord(data.exercise_triggers, 'exercise_triggers');
      const variant = testRecord(trigger.conversion_right, 'conversion_right');
      const right = testRecord(variant.value, 'conversion_right.value');
      testRecord(right.conversion_price, 'conversion_price').currency = currency;
    },
  },
];

function expectDecoderFailure(error: unknown, testCase: ComplexIssuanceReaderCase, field: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType: testCase.entityType,
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  const parseError = error as OcpParseError;
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(field);
}

describe('decoder-backed complex issuance readers', () => {
  it.each(issuanceReaderCases)(
    '$entityType returns its exact canonical event and forwards readAs',
    async (testCase) => {
      const { client, getEventsByContractId } = createMockClient(testCase, testCase.validData());

      await expect(testCase.invoke(client, ['issuer::reader'])).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: testCase.contractId,
        readAs: ['issuer::reader'],
      });
    }
  );

  it.each(issuanceReaderCases)(
    '$entityType succeeds through getEntityAsOcf, its OcpClient namespace, and literal object-type dispatch',
    async (testCase) => {
      const { client } = createMockClient(testCase, testCase.validData());

      await expect(getEntityAsOcf(client, testCase.entityType, testCase.contractId)).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });

      const ocp = new OcpClient({ ledger: client });
      await expect(ocp.OpenCapTable[testCase.entityType].get({ contractId: testCase.contractId })).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      await expect(
        ocp.OpenCapTable.getByObjectType({ objectType: testCase.objectType, contractId: testCase.contractId })
      ).resolves.toEqual({ data: testCase.expectedEvent, contractId: testCase.contractId });
    }
  );

  it.each(issuanceReaderCases)('$entityType rejects numeric primitives at the generated boundary', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.malformedNumericData());

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject a numeric primitive`);
    } catch (error: unknown) {
      expectDecoderFailure(
        error,
        testCase,
        testCase.entityType === 'equityCompensationIssuance' ? 'quantity' : 'amount'
      );
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects semantically invalid numeric strings', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.semanticallyInvalidNumericData());

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: testCase.semanticNumericPath,
    });
  });

  it.each(issuanceNumericLocationCases)(
    '$name rejects Numeric values with more than ten fractional digits',
    async (location) => {
      const testCase = issuanceReaderCases[location.caseIndex];
      if (!testCase) throw new Error(`Missing reader case for ${location.name}`);
      const data = testCase.validData();
      location.setValue(data, '1.12345678901');
      const { client } = createMockClient(testCase, data);

      await expect(testCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: location.fieldPath,
        receivedValue: '1.12345678901',
      });
    }
  );

  it.each(issuanceNumericLocationCases)('$name rejects scientific notation at its exact path', async (location) => {
    const testCase = issuanceReaderCases[location.caseIndex];
    if (!testCase) throw new Error(`Missing reader case for ${location.name}`);
    const data = testCase.validData();
    location.setValue(data, '1e3');
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: location.fieldPath,
      receivedValue: '1e3',
    });
  });

  it.each(issuanceNumericLocationCases)('$name accepts and canonicalizes a leading plus', async (location) => {
    const testCase = issuanceReaderCases[location.caseIndex];
    if (!testCase) throw new Error(`Missing reader case for ${location.name}`);
    const data = testCase.validData();
    location.setValue(data, '+1.2300000000');
    const { client } = createMockClient(testCase, data);

    const result = await testCase.invoke(client);
    expect(location.getValue(result.event)).toBe('1.23');
  });

  it.each(issuanceNumericLocationCases)('$name canonicalizes negative zero', async (location) => {
    const testCase = issuanceReaderCases[location.caseIndex];
    if (!testCase) throw new Error(`Missing reader case for ${location.name}`);
    const data = testCase.validData();
    location.setValue(data, '-0.0000000000');
    const { client } = createMockClient(testCase, data);

    const result = await testCase.invoke(client);
    expect(location.getValue(result.event)).toBe('0');
  });

  it.each(
    issuanceCurrencyLocationCases.flatMap((location) =>
      ['usd', 'US', 'USDX'].map((currency) => ({ location, currency }))
    )
  )('$location.name rejects the non-canonical currency $currency at its exact path', async ({ location, currency }) => {
    const testCase = issuanceReaderCases[location.caseIndex];
    if (!testCase) throw new Error(`Missing reader case for ${location.name}`);
    const data = location.dataFactory?.() ?? testCase.validData();
    location.setCurrency(data, currency);
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: location.fieldPath,
      receivedValue: currency,
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects semantically invalid transaction dates', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(testCase.invoke(client)).rejects.toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT });
  });

  it.each(
    issuanceReaderCases.flatMap((testCase) =>
      ['id', 'security_id', 'custom_id', 'stakeholder_id'].map((field) => ({ testCase, field }))
    )
  )('$testCase.entityType rejects an empty required $field', async ({ testCase, field }) => {
    const data = testCase.validData();
    data[field] = '';
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: `${testCase.entityType}.${field}`,
      receivedValue: '',
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects an empty required comment element', async (testCase) => {
    const data = testCase.validData();
    data.comments = [''];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: `${testCase.entityType}.comments[0]`,
      receivedValue: '',
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects an empty required exemption field', async (testCase) => {
    const data = testCase.validData();
    data.security_law_exemptions = [{ description: '', jurisdiction: 'US' }];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: `${testCase.entityType}.security_law_exemptions[0].description`,
      receivedValue: '',
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing required comments list', async (testCase) => {
    const data = testCase.validData();
    delete data.comments;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject missing comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing required exemption list', async (testCase) => {
    const data = testCase.validData();
    delete data.security_law_exemptions;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject missing security_law_exemptions`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'security_law_exemptions');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects malformed nested exemption data', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 17 }],
    });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject a malformed exemption`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'jurisdiction');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects malformed optional fields losslessly', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      board_approval_date: { seconds: 1 },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.issuance_data.board_approval_date',
        decoderMessage: 'raw object was decoded and encoded as null',
      },
    });
  });

  it.each(issuanceReaderCases)(
    '$entityType accepts omitted optional fields through generated null defaults',
    async (testCase) => {
      const data = testCase.validData();
      delete data.consideration_text;
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      expect(result.event.consideration_text).toBeUndefined();
      expect('consideration_text' in result.event).toBe(false);
    }
  );

  it.each(issuanceReaderCases)('$entityType preserves a present empty optional text value', async (testCase) => {
    const data = testCase.validData();
    data.consideration_text = '';
    const { client } = createMockClient(testCase, data);

    const result = await testCase.invoke(client);
    expect(result.event.consideration_text).toBe('');
    expect('consideration_text' in result.event).toBe(true);
  });

  it.each(['vesting_terms_id', 'stock_class_id', 'stock_plan_id'] as const)(
    'equity compensation preserves a present empty optional %s',
    async (field) => {
      const testCase = issuanceReaderCases[1];
      if (!testCase) throw new Error('Missing equity compensation issuance reader case');
      const data = equityCompensationData();
      data[field] = '';
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      expect(result.event).toHaveProperty(field, '');
      expect(field in result.event).toBe(true);
    }
  );

  it.each(issuanceReaderCases)('$entityType validates a present empty optional Time', async (testCase) => {
    const data = testCase.validData();
    data.board_approval_date = '';
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.board_approval_date`,
      receivedValue: '',
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), unexpected_field: true });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.issuance_data.unexpected_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects fields discarded from the full wrapper', async (testCase) => {
    const createArgument = {
      context: VALID_CONTEXT,
      issuance_data: testCase.validData(),
      unexpected_wrapper_field: true,
    };
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: `damlComplexIssuanceCreateArgument.${testCase.entityType}`,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.unexpected_wrapper_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects unknown context fields losslessly', async (testCase) => {
    const createArgument = {
      context: { ...VALID_CONTEXT, unexpected_context_field: true },
      issuance_data: testCase.validData(),
    };
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context.unexpected_context_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType requires an own complete context', async (testCase) => {
    const inheritedContext = Object.create(VALID_CONTEXT) as Record<string, unknown>;
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: inheritedContext, issuance_data: testCase.validData() },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.context',
        decoderMessage: expect.stringContaining("'issuer'"),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a malformed full-wrapper context', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { context: [], issuance_data: testCase.validData() },
    });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject malformed context`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'context');
    }
  });

  it.each(issuanceReaderCases)('$entityType requires issuance fields as own properties', async (testCase) => {
    const inheritedData = Object.create(testCase.validData()) as Record<string, unknown>;
    const { client } = createMockClient(testCase, inheritedData);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.issuance_data',
        decoderMessage: expect.stringContaining("'id'"),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects sparse required collections', async (testCase) => {
    const data = testCase.validData();
    data.comments = new Array(1);
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.issuance_data.comments[0]',
        decoderMessage: 'list element is missing or inherited rather than an own property',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects sparse entity-specific nested collections', async (testCase) => {
    const data = testCase.validData();
    const field =
      testCase.entityType === 'convertibleIssuance'
        ? 'conversion_triggers'
        : testCase.entityType === 'equityCompensationIssuance'
          ? 'termination_exercise_windows'
          : 'exercise_triggers';
    data[field] = new Array(1);
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: `input.issuance_data.${field}[0]`,
        decoderMessage: 'list element is missing or inherited rather than an own property',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType requires nested record fields as own properties', async (testCase) => {
    const data = testCase.validData();
    data.security_law_exemptions = [Object.create({ description: 'Reg D', jurisdiction: 'US' })];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.issuance_data.security_law_exemptions[0]',
        decoderMessage: expect.stringContaining("'description'"),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing full-wrapper context', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { issuance_data: testCase.validData() },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining("'context'"),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing issuance_data wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: { context: VALID_CONTEXT } });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects whole-createArgument data lookalikes', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: testCase.validData(),
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input',
        decoderMessage: expect.stringContaining('context'),
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects non-object nested issuance data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
      contractId: testCase.contractId,
      templateId: wrongTemplateId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        actualTemplateId: wrongTemplateId,
      },
    });
  });

  it('convertible issuance preserves the non-empty conversion-trigger invariant', async () => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), conversion_triggers: [] });

    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers',
    });
  });

  it.each([
    ['fractional text', '1.5'],
    ['decimal text', '1.0'],
    ['scientific notation', '1e3'],
    ['a leading zero', '01'],
    ['positive overflow', '9007199254740992'],
    ['negative overflow', '-9007199254740992'],
  ])('convertible issuance rejects seniority encoded with %s', async (_description, seniority) => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), seniority });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleIssuance.seniority',
      receivedValue: seniority,
      context: {
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      },
    });
  });

  it.each([
    ['zero', '0', 0],
    ['a negative integer', '-2', -2],
    ['the positive safe boundary', '9007199254740991', Number.MAX_SAFE_INTEGER],
    ['the negative safe boundary', '-9007199254740991', Number.MIN_SAFE_INTEGER],
  ])('convertible issuance accepts seniority encoded as %s', async (_description, seniority, expected) => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), seniority });

    await expect(testCase.invoke(client)).resolves.toMatchObject({
      event: { seniority: expected },
      contractId: testCase.contractId,
    });
  });

  it.each([
    ['fractional text', '1.5'],
    ['a zero-only fractional suffix', '1.0'],
    ['a ten-digit zero-only fractional suffix', '90.0000000000'],
    ['scientific notation', '1e3'],
    ['a leading zero', '090'],
    ['a leading plus', '+1'],
    ['negative zero', '-0'],
    ['positive overflow', '9007199254740992'],
    ['negative overflow', '-9007199254740992'],
  ])('equity compensation issuance rejects a termination period encoded with %s', async (_description, period) => {
    const testCase = issuanceReaderCases[1];
    if (!testCase) throw new Error('Missing equity compensation issuance reader case');
    const data = equityCompensationData();
    const windows = data.termination_exercise_windows as Array<Record<string, unknown>>;
    const window = windows[0];
    if (!window) throw new Error('Missing termination exercise window fixture');
    data.termination_exercise_windows = [{ ...window, period }];
    const { client } = createMockClient(testCase, data);

    expect(() =>
      damlEquityCompensationIssuanceDataToNative(
        data as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
      )
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'equityCompensationIssuance.termination_exercise_windows[0].period',
        receivedValue: period,
      })
    );

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'equityCompensationIssuance.termination_exercise_windows[0].period',
      receivedValue: period,
      context: {
        fieldPath: 'equityCompensationIssuance.termination_exercise_windows[0].period',
        receivedValue: period,
      },
    });
  });

  it.each([
    ['zero', '0', 0],
    ['a negative integer', '-30', -30],
    ['the positive safe boundary', '9007199254740991', Number.MAX_SAFE_INTEGER],
    ['the negative safe boundary', '-9007199254740991', Number.MIN_SAFE_INTEGER],
  ])(
    'equity compensation issuance accepts a termination period encoded as %s',
    async (_description, period, expected) => {
      const testCase = issuanceReaderCases[1];
      if (!testCase) throw new Error('Missing equity compensation issuance reader case');
      const data = equityCompensationData();
      const windows = data.termination_exercise_windows as Array<Record<string, unknown>>;
      const window = windows[0];
      if (!window) throw new Error('Missing termination exercise window fixture');
      data.termination_exercise_windows = [{ ...window, period }];
      const { client } = createMockClient(testCase, data);

      expect(
        damlEquityCompensationIssuanceDataToNative(
          data as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
        ).termination_exercise_windows
      ).toEqual([{ reason: 'VOLUNTARY_OTHER', period: expected, period_type: 'DAYS' }]);

      await expect(testCase.invoke(client)).resolves.toMatchObject({
        event: {
          termination_exercise_windows: [{ period: expected }],
        },
        contractId: testCase.contractId,
      });
    }
  );

  it('warrant issuance rejects a convertible conversion right after exact decoding', async () => {
    const testCase = issuanceReaderCases[2];
    if (!testCase) throw new Error('Missing warrant issuance reader case');
    const data = warrantData();
    const warrantTrigger = (data.exercise_triggers as Array<Record<string, unknown>>)[0];
    const convertibleTrigger = (convertibleData().conversion_triggers as Array<Record<string, unknown>>)[0];
    if (!warrantTrigger || !convertibleTrigger) throw new Error('Missing issuance trigger fixture');
    data.exercise_triggers = [
      {
        ...warrantTrigger,
        conversion_right: { tag: 'OcfRightConvertible', value: convertibleTrigger.conversion_right },
      },
    ];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'warrantIssuance.exercise_triggers[0].conversion_right.tag',
    });
  });

  it.each(UNSUPPORTED_STOCK_CLASS_STORAGE_FIELDS)(
    'the public warrant reader rejects storage-only stock-class field $field instead of dropping it',
    async ({ field, value }) => {
      const testCase = issuanceReaderCases[2];
      if (!testCase) throw new Error('Missing warrant issuance reader case');
      const data = warrantStockClassData();
      const trigger = firstTestRecord(data.exercise_triggers, 'exercise_triggers');
      const rightVariant = testRecord(trigger.conversion_right, 'conversion_right');
      const stockClassRight = testRecord(rightVariant.value, 'conversion_right.value');
      stockClassRight[field] = value;
      const { client } = createMockClient(testCase, data);
      const ocp = new OcpClient({ ledger: client });

      await expect(
        ocp.OpenCapTable.getByObjectType({
          objectType: 'TX_WARRANT_ISSUANCE',
          contractId: testCase.contractId,
        })
      ).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        fieldPath: `warrantIssuance.exercise_triggers[0].conversion_right.value.${field}`,
        expectedType: 'null',
        receivedValue: value,
      });
    }
  );
});

describe('decoder-backed equity-compensation pricing invariants', () => {
  const equityCase = issuanceReaderCases[1];
  if (!equityCase) throw new Error('Missing equity compensation issuance reader case');

  it.each([
    ['OPTION', 'OPTION_ISO', 'exercise_price'],
    ['SAR', 'CSAR', 'base_price'],
    ['RSU', 'RSU', null],
  ] as const)('accepts valid %s pricing', async (variant, compensationType, expectedPriceField) => {
    const { client } = createMockClient(equityCase, equityCompensationData(variant));

    const result = await equityCase.invoke(client);
    if (result.event.object_type !== 'TX_EQUITY_COMPENSATION_ISSUANCE') {
      throw new Error('Expected an equity compensation issuance result');
    }
    expect(result.event.compensation_type).toBe(compensationType);
    if (expectedPriceField !== null) expect(result.event).toHaveProperty(expectedPriceField);
  });

  it.each([
    ['OPTION', 'exercise_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['OPTION', 'base_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['SAR', 'base_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['SAR', 'exercise_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['RSU', 'exercise_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['RSU', 'base_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects invalid %s %s pricing after decoding', async (variant, field, value, expectedCode) => {
    const data = equityCompensationData(variant);
    data[field] = value;
    const { client } = createMockClient(equityCase, data);

    await expect(equityCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: expectedCode,
      fieldPath: `equityCompensationIssuance.${field}`,
    });
  });
});
