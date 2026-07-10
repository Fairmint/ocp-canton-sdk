import { OcpValidationError } from '../../src/errors';
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

describe('conversion semantic parser refinements', () => {
  const customMechanism = {
    type: 'CUSTOM_CONVERSION',
    custom_conversion_description: 'Custom terms',
  };

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

  it('rejects a mechanism that does not belong to the conversion-right variant', () => {
    const invalid = warrantWithRight({
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: customMechanism,
    });
    expect(() => parseOcfEntityInput('warrantIssuance', invalid)).toThrow(OcpValidationError);
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
    expect(() => parseOcfEntityInput('warrantIssuance', warrantWithConvertibleRight)).toThrow(
      /does not permit conversion right/
    );
  });
});
