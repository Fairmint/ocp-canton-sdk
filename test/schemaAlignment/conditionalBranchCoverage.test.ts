import Ajv, { type AnySchema, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import path from 'path';
import { OcpValidationError } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';
import { dereferencePinnedSchemaFile } from './schemaConformanceHarness';

const SCHEMA_ROOT = path.resolve(__dirname, '../../libs/Open-Cap-Format-OCF/schema');

function stripSchemaIdentifiers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSchemaIdentifiers);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '$id' && key !== '$schema')
      .map(([key, child]) => [key, stripSchemaIdentifiers(child)])
  );
}

function compilePinnedSchema(relativePath: string): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(stripSchemaIdentifiers(dereferencePinnedSchemaFile(SCHEMA_ROOT, relativePath)) as AnySchema);
}

const issuerBase = {
  object_type: 'ISSUER',
  id: 'issuer-1',
  legal_name: 'Schema Inc.',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
};

const stockClassBase = {
  object_type: 'STOCK_CLASS',
  id: 'class-1',
  name: 'Common',
  class_type: 'COMMON',
  default_id_prefix: 'CS-',
  votes_per_share: '1',
  seniority: '1',
};

const stockPlanBase = {
  object_type: 'STOCK_PLAN',
  id: 'plan-1',
  plan_name: '2026 Plan',
  initial_shares_reserved: '1000',
};

const conversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION',
    converts_to_quantity: '1',
  },
};

const convertibleBase = {
  object_type: 'TX_CONVERTIBLE_ISSUANCE',
  id: 'conv-1',
  date: '2026-01-01',
  security_id: 'sec-1',
  custom_id: 'SAFE-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  investment_amount: { amount: '100', currency: 'USD' },
  convertible_type: 'SAFE',
  seniority: 1,
};

const warrantConversionRight = {
  type: 'WARRANT_CONVERSION_RIGHT',
  conversion_mechanism: {
    type: 'FIXED_AMOUNT_CONVERSION',
    converts_to_quantity: '1',
  },
};

const warrantBase = {
  object_type: 'TX_WARRANT_ISSUANCE',
  id: 'warrant-1',
  date: '2026-01-01',
  security_id: 'warrant-security-1',
  custom_id: 'W-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  purchase_price: { amount: '100', currency: 'USD' },
};

const equityCompensationBase = {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  id: 'equity-comp-1',
  date: '2026-01-01',
  security_id: 'equity-security-1',
  custom_id: 'OPTION-1',
  stakeholder_id: 'stakeholder-1',
  security_law_exemptions: [],
  quantity: '100',
  expiration_date: null,
  termination_exercise_windows: [],
};

function expectAcceptedInitialShares(base: Record<string, unknown>, initialSharesAuthorized: string): void {
  expect(parseOcfObject({ ...base, initial_shares_authorized: initialSharesAuthorized })).toMatchObject({
    initial_shares_authorized: initialSharesAuthorized,
  });
}

function expectAcceptedConvertibleTrigger(trigger: Record<string, unknown>): void {
  expect(parseOcfObject({ ...convertibleBase, conversion_triggers: [trigger] })).toMatchObject({
    conversion_triggers: [trigger],
  });
}

function expectAcceptedWarrantTrigger(trigger: Record<string, unknown>): void {
  expect(parseOcfObject({ ...warrantBase, exercise_triggers: [trigger] })).toMatchObject({
    exercise_triggers: [trigger],
  });
}

const conversionMechanismCases = [
  { type: 'SAFE_CONVERSION', conversion_mfn: false },
  {
    type: 'CONVERTIBLE_NOTE_CONVERSION',
    interest_rates: [],
    day_count_convention: 'ACTUAL_365',
    interest_payout: 'CASH',
    interest_accrual_period: 'ANNUAL',
    compounding_type: 'SIMPLE',
  },
  { type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Contract-specific conversion' },
  { type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION', converts_to_percent: '0.1' },
  { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '10' },
  {
    type: 'RATIO_CONVERSION',
    ratio: { numerator: '1', denominator: '1' },
    conversion_price: { amount: '1', currency: 'USD' },
    rounding_type: 'NORMAL',
  },
  { type: 'VALUATION_BASED_CONVERSION', valuation_type: 'ACTUAL' },
  { type: 'PPS_BASED_CONVERSION', description: 'Future round price', discount: false },
] as const;

const conversionMechanismByType = new Map(conversionMechanismCases.map((mechanism) => [mechanism.type, mechanism]));

function requireConversionMechanism(type: (typeof conversionMechanismCases)[number]['type']): Record<string, unknown> {
  const mechanism = conversionMechanismByType.get(type);
  if (!mechanism) throw new Error(`Missing conversion mechanism fixture: ${type}`);
  return mechanism;
}

describe('exact OCF conditional branch coverage', () => {
  it('accepts StockPlan deprecated stock_class_id branch at raw ingestion', () => {
    expect(parseOcfObject({ ...stockPlanBase, stock_class_id: 'class-legacy' })).toMatchObject({
      stock_class_ids: ['class-legacy'],
    });
  });

  it('accepts StockPlan canonical stock_class_ids branch', () => {
    expect(parseOcfObject({ ...stockPlanBase, stock_class_ids: ['class-1'] })).toMatchObject({
      stock_class_ids: ['class-1'],
    });
  });

  it.each([
    { label: 'neither class field', input: stockPlanBase },
    {
      label: 'both class fields',
      input: { ...stockPlanBase, stock_class_id: 'class-legacy', stock_class_ids: ['class-1'] },
    },
  ])('rejects StockPlan $label outside both oneOf branches', ({ input }) => {
    expect(() => parseOcfObject(input)).toThrow(OcpValidationError);
  });

  it('accepts Issuer AuthorizedShares initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(issuerBase, 'UNLIMITED');
  });

  it('accepts Issuer Numeric initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(issuerBase, '1000.5');
  });

  it('accepts StockClass AuthorizedShares initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(stockClassBase, 'NOT APPLICABLE');
  });

  it('accepts StockClass Numeric initial_shares_authorized branch', () => {
    expectAcceptedInitialShares(stockClassBase, '1000.5');
  });

  it.each([
    { label: 'Issuer', input: issuerBase },
    { label: 'StockClass', input: stockClassBase },
  ])('rejects $label initial_shares_authorized outside both oneOf branches', ({ input }) => {
    expect(() => parseOcfObject({ ...input, initial_shares_authorized: 'NOT_APPLICABLE' })).toThrow(OcpValidationError);
  });

  it('accepts ConvertibleIssuance AUTOMATIC_ON_CONDITION trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'AUTOMATIC_ON_CONDITION',
      trigger_id: 'automatic-condition',
      trigger_condition: 'A qualified financing closes',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance AUTOMATIC_ON_DATE trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'AUTOMATIC_ON_DATE',
      trigger_id: 'automatic-date',
      trigger_date: '2027-01-01',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_AT_WILL trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'elective-at-will',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_IN_RANGE trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_IN_RANGE',
      trigger_id: 'elective-range',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance ELECTIVE_ON_CONDITION trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'ELECTIVE_ON_CONDITION',
      trigger_id: 'elective-condition',
      trigger_condition: 'The holder elects after a qualified financing',
      conversion_right: conversionRight,
    });
  });

  it('accepts ConvertibleIssuance UNSPECIFIED trigger branch', () => {
    expectAcceptedConvertibleTrigger({
      type: 'UNSPECIFIED',
      trigger_id: 'unspecified',
      conversion_right: conversionRight,
    });
  });

  it('rejects a ConvertibleIssuance trigger outside every anyOf branch', () => {
    expect(() =>
      parseOcfObject({
        ...convertibleBase,
        conversion_triggers: [
          {
            type: 'UNKNOWN',
            trigger_id: 'unknown',
            conversion_right: conversionRight,
          },
        ],
      })
    ).toThrow(OcpValidationError);
  });

  it.each([
    {
      type: 'AUTOMATIC_ON_CONDITION',
      trigger_id: 'warrant-condition',
      trigger_condition: 'A financing closes',
      conversion_right: warrantConversionRight,
    },
    {
      type: 'AUTOMATIC_ON_DATE',
      trigger_id: 'warrant-date',
      trigger_date: '2027-01-01',
      conversion_right: warrantConversionRight,
    },
    {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'warrant-at-will',
      conversion_right: warrantConversionRight,
    },
    {
      type: 'ELECTIVE_IN_RANGE',
      trigger_id: 'warrant-range',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      conversion_right: warrantConversionRight,
    },
    {
      type: 'ELECTIVE_ON_CONDITION',
      trigger_id: 'warrant-elective-condition',
      trigger_condition: 'The holder elects',
      conversion_right: warrantConversionRight,
    },
    {
      type: 'UNSPECIFIED',
      trigger_id: 'warrant-unspecified',
      conversion_right: warrantConversionRight,
    },
  ])('accepts WarrantIssuance $type exercise-trigger branch', (trigger) => {
    expectAcceptedWarrantTrigger(trigger);
  });

  it('rejects a WarrantIssuance trigger outside every anyOf branch', () => {
    expect(() =>
      parseOcfObject({
        ...warrantBase,
        exercise_triggers: [{ type: 'UNKNOWN', trigger_id: 'unknown', conversion_right: warrantConversionRight }],
      })
    ).toThrow(OcpValidationError);
  });

  it.each([
    { compensation_type: 'OPTION', exercise_price: { amount: '1', currency: 'USD' } },
    { compensation_type: 'OPTION_NSO', exercise_price: { amount: '1', currency: 'USD' } },
    { compensation_type: 'OPTION_ISO', exercise_price: { amount: '1', currency: 'USD' } },
    { compensation_type: 'RSU' },
    { compensation_type: 'CSAR', base_price: { amount: '1', currency: 'USD' } },
    { compensation_type: 'SSAR', base_price: { amount: '1', currency: 'USD' } },
  ])('accepts EquityCompensationIssuance $compensation_type branch', (pricing) => {
    expect(parseOcfObject({ ...equityCompensationBase, ...pricing })).toMatchObject(pricing);
  });

  it('rejects EquityCompensationIssuance outside every compensation anyOf branch', () => {
    expect(() => parseOcfObject({ ...equityCompensationBase, compensation_type: 'UNKNOWN_COMPENSATION' })).toThrow(
      OcpValidationError
    );
  });

  it.each([null, '2027-01-01'])('accepts EquityCompensationIssuance expiration_date branch %#', (expirationDate) => {
    expect(
      parseOcfObject({
        ...equityCompensationBase,
        compensation_type: 'RSU',
        expiration_date: expirationDate,
      })
    ).toMatchObject({ expiration_date: expirationDate });
  });

  it('rejects EquityCompensationIssuance expiration_date outside both oneOf branches', () => {
    expect(() =>
      parseOcfObject({
        ...equityCompensationBase,
        compensation_type: 'RSU',
        expiration_date: { year: 2027 },
      })
    ).toThrow(OcpValidationError);
  });

  it.each(conversionMechanismCases)('accepts ConversionRight $type conversion_mechanism branch', (mechanism) => {
    const validate = compilePinnedSchema('primitives/types/conversion_rights/ConversionRight.schema.json');
    expect(validate({ conversion_mechanism: mechanism })).toBe(true);
  });

  it('rejects ConversionRight conversion_mechanism outside every oneOf branch', () => {
    const validate = compilePinnedSchema('primitives/types/conversion_rights/ConversionRight.schema.json');
    expect(validate({ conversion_mechanism: { type: 'UNKNOWN' } })).toBe(false);
  });

  it.each([
    {
      rightType: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: requireConversionMechanism('SAFE_CONVERSION'),
    },
    {
      rightType: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: requireConversionMechanism('CUSTOM_CONVERSION'),
    },
    {
      rightType: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: requireConversionMechanism('RATIO_CONVERSION'),
    },
  ])('accepts ConversionTrigger $rightType conversion_right branch', ({ rightType, conversion_mechanism }) => {
    const validate = compilePinnedSchema('primitives/types/conversion_triggers/ConversionTrigger.schema.json');
    expect(
      validate({
        type: 'UNSPECIFIED',
        trigger_id: 'trigger-1',
        conversion_right: { type: rightType, conversion_mechanism },
      })
    ).toBe(true);
  });

  it('rejects ConversionTrigger conversion_right outside every oneOf branch', () => {
    const validate = compilePinnedSchema('primitives/types/conversion_triggers/ConversionTrigger.schema.json');
    expect(
      validate({
        type: 'UNSPECIFIED',
        trigger_id: 'trigger-1',
        conversion_right: { type: 'UNKNOWN', conversion_mechanism: { type: 'UNKNOWN' } },
      })
    ).toBe(false);
  });

  const specializedConversionRightCases = [
    ...[
      'SAFE_CONVERSION',
      'CONVERTIBLE_NOTE_CONVERSION',
      'CUSTOM_CONVERSION',
      'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
      'FIXED_AMOUNT_CONVERSION',
    ].map((mechanismType) => ({
      right: 'ConvertibleConversionRight',
      rightType: 'CONVERTIBLE_CONVERSION_RIGHT',
      mechanismType: mechanismType as (typeof conversionMechanismCases)[number]['type'],
    })),
    {
      right: 'StockClassConversionRight',
      rightType: 'STOCK_CLASS_CONVERSION_RIGHT',
      mechanismType: 'RATIO_CONVERSION' as const,
    },
    ...[
      'CUSTOM_CONVERSION',
      'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
      'FIXED_AMOUNT_CONVERSION',
      'VALUATION_BASED_CONVERSION',
      'PPS_BASED_CONVERSION',
    ].map((mechanismType) => ({
      right: 'WarrantConversionRight',
      rightType: 'WARRANT_CONVERSION_RIGHT',
      mechanismType: mechanismType as (typeof conversionMechanismCases)[number]['type'],
    })),
  ];

  it.each(specializedConversionRightCases)(
    'accepts $right $mechanismType conversion_mechanism branch',
    ({ right, rightType, mechanismType }) => {
      const validate = compilePinnedSchema(`types/conversion_rights/${right}.schema.json`);
      expect(validate({ type: rightType, conversion_mechanism: requireConversionMechanism(mechanismType) })).toBe(true);
    }
  );

  it.each(['ConvertibleConversionRight', 'StockClassConversionRight', 'WarrantConversionRight'])(
    'rejects $right conversion_mechanism outside every oneOf branch',
    (right) => {
      const validate = compilePinnedSchema(`types/conversion_rights/${right}.schema.json`);
      expect(validate({ conversion_mechanism: { type: 'UNKNOWN' } })).toBe(false);
    }
  );

  it.each([
    { valuation_type: 'CAP', valuation_amount: { amount: '1000000', currency: 'USD' } },
    { valuation_type: 'FIXED', valuation_amount: { amount: '1000000', currency: 'USD' } },
    { valuation_type: 'ACTUAL' },
  ])('accepts ValuationBasedConversionMechanism $valuation_type branch', (valuation) => {
    const validate = compilePinnedSchema('types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json');
    expect(validate({ type: 'VALUATION_BASED_CONVERSION', ...valuation })).toBe(true);
  });

  it('rejects ValuationBasedConversionMechanism outside every oneOf branch', () => {
    const validate = compilePinnedSchema('types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json');
    expect(validate({ type: 'VALUATION_BASED_CONVERSION', valuation_type: 'CAP' })).toBe(false);
  });

  it.each([
    { label: 'percentage discount', discount: true, discount_percentage: '0.2' },
    { label: 'amount discount', discount: true, discount_amount: { amount: '1', currency: 'USD' } },
    { label: 'no discount', discount: false },
  ])('accepts SharePriceBasedConversionMechanism $label branch', ({ label: _label, ...discount }) => {
    const validate = compilePinnedSchema('types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json');
    expect(validate({ type: 'PPS_BASED_CONVERSION', description: 'Future round price', ...discount })).toBe(true);
  });

  it('rejects SharePriceBasedConversionMechanism outside every oneOf branch', () => {
    const validate = compilePinnedSchema('types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json');
    expect(validate({ type: 'PPS_BASED_CONVERSION', description: 'Missing discount detail', discount: true })).toBe(
      false
    );
  });

  it.each([{ portion: { numerator: '1', denominator: '4' } }, { quantity: '25' }])(
    'accepts VestingCondition amount branch %#',
    (amount) => {
      const validate = compilePinnedSchema('types/vesting/VestingCondition.schema.json');
      expect(
        validate({
          id: 'condition-1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: [],
          ...amount,
        })
      ).toBe(true);
    }
  );

  it('rejects VestingCondition outside both amount oneOf branches', () => {
    const validate = compilePinnedSchema('types/vesting/VestingCondition.schema.json');
    expect(validate({ id: 'condition-1', trigger: { type: 'VESTING_START_DATE' }, next_condition_ids: [] })).toBe(
      false
    );
  });

  it.each([
    { type: 'VESTING_START_DATE' },
    { type: 'VESTING_SCHEDULE_ABSOLUTE', date: '2027-01-01' },
    {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: { type: 'DAYS', length: 1, occurrences: 1 },
      relative_to_condition_id: 'condition-0',
    },
    { type: 'VESTING_EVENT' },
  ])('accepts VestingCondition $type trigger branch', (trigger) => {
    const validate = compilePinnedSchema('types/vesting/VestingCondition.schema.json');
    expect(
      validate({
        id: 'condition-1',
        portion: { numerator: '1', denominator: '4' },
        trigger,
        next_condition_ids: [],
      })
    ).toBe(true);
  });

  it('rejects VestingCondition trigger outside every oneOf branch', () => {
    const validate = compilePinnedSchema('types/vesting/VestingCondition.schema.json');
    expect(
      validate({
        id: 'condition-1',
        portion: { numerator: '1', denominator: '4' },
        trigger: { type: 'UNKNOWN' },
        next_condition_ids: [],
      })
    ).toBe(false);
  });

  it.each([
    { type: 'DAYS', length: 1, occurrences: 1 },
    { type: 'MONTHS', length: 1, occurrences: 1, day_of_month: '01' },
  ])('accepts VestingScheduleRelativeTrigger $type period branch', (period) => {
    const validate = compilePinnedSchema('types/vesting/VestingScheduleRelativeTrigger.schema.json');
    expect(validate({ type: 'VESTING_SCHEDULE_RELATIVE', period, relative_to_condition_id: 'condition-0' })).toBe(true);
  });

  it('rejects VestingScheduleRelativeTrigger period outside both oneOf branches', () => {
    const validate = compilePinnedSchema('types/vesting/VestingScheduleRelativeTrigger.schema.json');
    expect(
      validate({
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: { type: 'YEARS', length: 1, occurrences: 1 },
        relative_to_condition_id: 'condition-0',
      })
    ).toBe(false);
  });
});
