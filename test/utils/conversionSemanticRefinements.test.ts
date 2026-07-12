import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';

const BASE_WARRANT = {
  object_type: 'TX_WARRANT_ISSUANCE' as const,
  id: 'warrant-parser-1',
  date: '2026-01-01',
  security_id: 'security-1',
  custom_id: 'W-1',
  stakeholder_id: 'stakeholder-1',
  purchase_price: { amount: '100', currency: 'USD' },
  security_law_exemptions: [],
};

const BASE_CONVERTIBLE = {
  object_type: 'TX_CONVERTIBLE_ISSUANCE' as const,
  id: 'convertible-parser-1',
  date: '2026-01-01',
  security_id: 'security-1',
  custom_id: 'CN-1',
  stakeholder_id: 'stakeholder-1',
  investment_amount: { amount: '100', currency: 'USD' },
  convertible_type: 'SAFE' as const,
  seniority: 1,
  security_law_exemptions: [],
};

const CONVERTIBLE_RIGHT = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
  conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION' as const, converts_to_quantity: '10' },
};

const WARRANT_RIGHT = {
  type: 'WARRANT_CONVERSION_RIGHT' as const,
  conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION' as const, converts_to_quantity: '10' },
};

function warrantWithRight(right: Record<string, unknown>): Record<string, unknown> {
  return {
    ...BASE_WARRANT,
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'trigger-1',
        conversion_right: right,
      },
    ],
  };
}

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
}

describe('conversion semantic parser refinements', () => {
  const customMechanism = {
    type: 'CUSTOM_CONVERSION',
    custom_conversion_description: 'Custom terms',
  };

  it('rejects schema-valid duplicate conversion trigger IDs at typed boundaries', () => {
    const cases = [
      {
        entityType: 'convertibleIssuance' as const,
        field: 'conversion_triggers',
        input: {
          ...BASE_CONVERTIBLE,
          conversion_triggers: [
            { type: 'ELECTIVE_AT_WILL', trigger_id: 'duplicate-id', conversion_right: CONVERTIBLE_RIGHT },
            {
              type: 'AUTOMATIC_ON_DATE',
              trigger_id: 'duplicate-id',
              trigger_date: '2027-01-01',
              conversion_right: CONVERTIBLE_RIGHT,
            },
          ],
        },
      },
      {
        entityType: 'warrantIssuance' as const,
        field: 'exercise_triggers',
        input: {
          ...BASE_WARRANT,
          exercise_triggers: [
            { type: 'ELECTIVE_AT_WILL', trigger_id: 'duplicate-id', conversion_right: WARRANT_RIGHT },
            {
              type: 'AUTOMATIC_ON_DATE',
              trigger_id: 'duplicate-id',
              trigger_date: '2027-01-01',
              conversion_right: WARRANT_RIGHT,
            },
          ],
        },
      },
    ];

    for (const { entityType, field, input } of cases) {
      expect(() => parseOcfObject(input)).not.toThrow();
      expect(captureValidationError(() => parseOcfEntityInput(entityType, input))).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${field}.1.trigger_id`,
        receivedValue: 'duplicate-id',
      });
    }
  });

  it('rejects schema-valid reversed elective conversion ranges at typed boundaries', () => {
    const cases = [
      {
        entityType: 'convertibleIssuance' as const,
        field: 'conversion_triggers',
        input: {
          ...BASE_CONVERTIBLE,
          conversion_triggers: [
            {
              type: 'ELECTIVE_IN_RANGE',
              trigger_id: 'reversed-range',
              start_date: '2027-12-31',
              end_date: '2027-01-01',
              conversion_right: CONVERTIBLE_RIGHT,
            },
          ],
        },
      },
      {
        entityType: 'warrantIssuance' as const,
        field: 'exercise_triggers',
        input: {
          ...BASE_WARRANT,
          exercise_triggers: [
            {
              type: 'ELECTIVE_IN_RANGE',
              trigger_id: 'reversed-range',
              start_date: '2027-12-31',
              end_date: '2027-01-01',
              conversion_right: WARRANT_RIGHT,
            },
          ],
        },
      },
    ];

    for (const { entityType, field, input } of cases) {
      expect(() => parseOcfObject(input)).not.toThrow();
      expect(captureValidationError(() => parseOcfEntityInput(entityType, input))).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: `${field}.0.end_date`,
        receivedValue: '2027-01-01',
      });
    }
  });

  test.each([
    {
      name: 'ACTUAL valuation without its ledger amount',
      right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'VALUATION_BASED_CONVERSION', valuation_type: 'ACTUAL' },
      },
      suffix: 'valuation_amount',
      code: 'REQUIRED_FIELD_MISSING',
    },
    {
      name: 'SAFE discount at one',
      right: {
        type: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false, conversion_discount: '1' },
      },
      suffix: 'conversion_discount',
      code: 'OUT_OF_RANGE',
    },
    {
      name: 'zero fixed quantity',
      right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '0' },
      },
      suffix: 'converts_to_quantity',
      code: 'OUT_OF_RANGE',
    },
    {
      name: 'zero capitalization percent',
      right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION', converts_to_percent: '0' },
      },
      suffix: 'converts_to_percent',
      code: 'OUT_OF_RANGE',
    },
    {
      name: 'zero PPS discount',
      right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'PPS_BASED_CONVERSION',
          description: 'Zero discount',
          discount: true,
          discount_percentage: '0',
        },
      },
      suffix: 'discount_percentage',
      code: 'OUT_OF_RANGE',
    },
    {
      name: 'negative valuation money',
      right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'ACTUAL',
          valuation_amount: { amount: '-1', currency: 'USD' },
        },
      },
      suffix: 'valuation_amount.amount',
      code: 'OUT_OF_RANGE',
    },
  ])('keeps raw OCF schema-faithful but rejects typed $name', ({ right, suffix, code }) => {
    const input = warrantWithRight(right);
    expect(() => parseOcfObject(input)).not.toThrow();

    expect(captureValidationError(() => parseOcfEntityInput('warrantIssuance', input))).toMatchObject({
      code,
      fieldPath: `exercise_triggers.0.conversion_right.conversion_mechanism.${suffix}`,
    });
  });

  test.each([
    ['typed', (value: unknown) => parseOcfEntityInput('stockClass', value)],
    ['raw', (value: unknown) => parseOcfObject(value)],
  ] as const)('%s parser rejects a conversion right without its type discriminator', (_name, parse) => {
    const invalid = {
      object_type: 'STOCK_CLASS',
      id: 'class-parser-1',
      name: 'Series Seed',
      class_type: 'PREFERRED',
      default_id_prefix: 'SEED',
      initial_shares_authorized: '1000000',
      votes_per_share: '1',
      seniority: '1',
      conversion_rights: [
        {
          conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            ratio: { numerator: '2', denominator: '1' },
            conversion_price: { amount: '1', currency: 'USD' },
            rounding_type: 'NORMAL',
          },
        },
      ],
    };
    expect(() => parse(invalid)).toThrow(OcpValidationError);
    expect(() => parse(invalid)).toThrow(/exact type discriminator/);
  });

  test.each([
    {
      name: 'missing discount',
      message: 'requires a boolean discount field',
      mechanism: {
        type: 'PPS_BASED_CONVERSION',
        description: 'Next financing price',
      },
    },
    {
      name: 'false discount with percentage',
      message: 'non-discounted PPS conversion cannot include discount details',
      mechanism: {
        type: 'PPS_BASED_CONVERSION',
        description: 'Contradictory percentage',
        discount: false,
        discount_percentage: '0.10',
      },
    },
    {
      name: 'false discount with amount',
      message: 'non-discounted PPS conversion cannot include discount details',
      mechanism: {
        type: 'PPS_BASED_CONVERSION',
        description: 'Contradictory amount',
        discount: false,
        discount_amount: { amount: '1', currency: 'USD' },
      },
    },
  ])('typed and raw parsers reject PPS $name accepted by the upstream schema gap', ({ mechanism, message }) => {
    const invalid = warrantWithRight({
      type: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: mechanism,
    });
    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(OcpValidationError);
    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(message);
    expect(() => parseOcfObject(invalid)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(invalid)).toThrow(message);
  });

  test.each([
    {
      name: 'without a detail',
      mechanism: {
        type: 'PPS_BASED_CONVERSION',
        description: 'Missing discount detail',
        discount: true,
      },
    },
    {
      name: 'with both details',
      mechanism: {
        type: 'PPS_BASED_CONVERSION',
        description: 'Ambiguous discount details',
        discount: true,
        discount_percentage: '0.10',
        discount_amount: { amount: '1', currency: 'USD' },
      },
    },
  ])('typed and raw parsers reject discounted PPS $name', ({ mechanism }) => {
    const invalid = warrantWithRight({
      type: 'WARRANT_CONVERSION_RIGHT',
      conversion_mechanism: mechanism,
    });
    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(invalid)).toThrow(OcpValidationError);
  });

  it('rejects a mechanism that does not belong to the conversion-right variant', () => {
    const invalid = warrantWithRight({
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: customMechanism,
      converts_to_stock_class_id: 'common-class',
    });
    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(OcpValidationError);
  });

  it('requires a concrete destination for stock-class conversion rights at every parser boundary', () => {
    const invalid = warrantWithRight({
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '1', denominator: '1' },
        conversion_price: { amount: '1', currency: 'USD' },
        rounding_type: 'NORMAL',
      },
    });

    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(
      /requires a non-empty converts_to_stock_class_id/
    );
    expect(() => parseOcfObject(invalid)).toThrow(/requires a non-empty converts_to_stock_class_id/);
  });

  it('does not default omitted capitalization-rule booleans', () => {
    const invalid = {
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-parser-1',
      date: '2026-01-01',
      security_id: 'security-1',
      custom_id: 'CN-1',
      stakeholder_id: 'stakeholder-1',
      investment_amount: { amount: '100', currency: 'USD' },
      convertible_type: 'SAFE',
      seniority: 1,
      security_law_exemptions: [],
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'trigger-1',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'SAFE_CONVERSION',
              conversion_mfn: false,
              capitalization_definition_rules: { include_outstanding_shares: true },
            },
          },
        },
      ],
    };
    expect(() => parseOcfEntityInput('convertibleIssuance', invalid)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(invalid)).toThrow(OcpValidationError);
  });

  it('keeps issuance-specific conversion-right unions sound', () => {
    const convertibleWithWarrantRight = {
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-parser-2',
      date: '2026-01-01',
      security_id: 'security-2',
      custom_id: 'CN-2',
      stakeholder_id: 'stakeholder-1',
      investment_amount: { amount: '100', currency: 'USD' },
      convertible_type: 'CONVERTIBLE_SECURITY',
      seniority: 1,
      security_law_exemptions: [],
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'trigger-2',
          conversion_right: {
            type: 'WARRANT_CONVERSION_RIGHT',
            conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '10' },
          },
        },
      ],
    };
    const warrantWithConvertibleRight = warrantWithRight({
      type: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
    });

    expect(() => parseOcfEntityInput('convertibleIssuance', convertibleWithWarrantRight)).toThrow(
      /does not permit conversion right/
    );
    expect(() => parseOcfEntityInput('warrantIssuance', warrantWithConvertibleRight)).not.toThrow();
  });

  test.each([
    ['conversion_triggers', []],
    ['percent_of_outstanding', '0.1'],
    ['ratio_denominator', '1'],
    ['ratio_numerator', '1'],
  ] as const)('rejects legacy WarrantIssuance field %s at the public parser boundary', (field, legacyValue) => {
    const valid = warrantWithRight({
      type: 'CONVERTIBLE_CONVERSION_RIGHT',
      conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
    });
    expect(() => parseOcfEntityInput('warrantIssuance', { ...valid, [field]: legacyValue })).toThrow(
      OcpValidationError
    );
  });
});
