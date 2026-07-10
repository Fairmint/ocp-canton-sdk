import type {
  CapitalizationDefinitionRules,
  ConvertibleConversionMechanism,
  OcfStockClass,
  RatioConversionMechanism,
  WarrantConversionMechanism,
} from '../../src';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  convertibleIssuanceDataToDaml,
  type ConvertibleIssuanceInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import {
  convertibleMechanismFromDaml,
  convertibleMechanismToDaml,
  warrantMechanismToDaml,
} from '../../src/functions/OpenCapTable/shared/conversionMechanisms';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import {
  warrantIssuanceDataToDaml,
  type WarrantIssuanceInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { parseOcfEntityInput } from '../../src/utils/ocfZodSchemas';

function requireFirst<T>(values: readonly T[], description: string): T {
  const [first] = values;
  if (first === undefined) throw new Error(`Missing ${description}`);
  return first;
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

const RULES: CapitalizationDefinitionRules = {
  include_outstanding_shares: true,
  include_outstanding_options: false,
  include_outstanding_unissued_options: true,
  include_this_security: true,
  include_other_converting_securities: false,
  include_option_pool_topup_for_promised_options: true,
  include_additional_option_pool_topup: false,
  include_new_money: true,
};

const CONVERTIBLE_MECHANISMS: ReadonlyArray<{
  name: string;
  mechanism: ConvertibleConversionMechanism;
}> = [
  {
    name: 'SAFE',
    mechanism: {
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
      conversion_discount: '0.2',
      conversion_valuation_cap: { amount: '10000000', currency: 'USD' },
      conversion_timing: 'POST_MONEY',
      capitalization_definition: 'Fully diluted post-money capitalization',
      capitalization_definition_rules: RULES,
      exit_multiple: { numerator: '2', denominator: '1' },
    },
  },
  {
    name: 'convertible note',
    mechanism: {
      type: 'CONVERTIBLE_NOTE_CONVERSION',
      interest_rates: [
        { rate: '0.08', accrual_start_date: '2026-01-01', accrual_end_date: '2026-06-30' },
        { rate: '0.1', accrual_start_date: '2026-07-01' },
      ],
      day_count_convention: 'ACTUAL_365',
      interest_payout: 'DEFERRED',
      interest_accrual_period: 'MONTHLY',
      compounding_type: 'COMPOUNDING',
      conversion_discount: '0.15',
      conversion_valuation_cap: { amount: '12000000', currency: 'USD' },
      capitalization_definition: 'Fully diluted capitalization',
      capitalization_definition_rules: RULES,
      exit_multiple: { numerator: '3', denominator: '2' },
      conversion_mfn: true,
    },
  },
  {
    name: 'custom',
    mechanism: {
      type: 'CUSTOM_CONVERSION',
      custom_conversion_description: 'Convert under section 4.2 of the instrument',
    },
  },
  {
    name: 'percent capitalization',
    mechanism: {
      type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
      converts_to_percent: '0.05',
      capitalization_definition: 'Post-money capitalization',
      capitalization_definition_rules: RULES,
    },
  },
  {
    name: 'fixed amount',
    mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '25000' },
  },
];

const WARRANT_MECHANISMS: ReadonlyArray<{ name: string; mechanism: WarrantConversionMechanism }> = [
  {
    name: 'custom',
    mechanism: {
      type: 'CUSTOM_CONVERSION',
      custom_conversion_description: 'Exercise under the custom warrant formula',
    },
  },
  {
    name: 'percent capitalization',
    mechanism: {
      type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
      converts_to_percent: '0.01',
      capitalization_definition: 'Fully diluted capitalization',
      capitalization_definition_rules: RULES,
    },
  },
  {
    name: 'fixed amount',
    mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' },
  },
  {
    name: 'valuation cap',
    mechanism: {
      type: 'VALUATION_BASED_CONVERSION',
      valuation_type: 'CAP',
      valuation_amount: { amount: '10000000', currency: 'USD' },
      capitalization_definition_rules: RULES,
    },
  },
  {
    name: 'fixed valuation',
    mechanism: {
      type: 'VALUATION_BASED_CONVERSION',
      valuation_type: 'FIXED',
      valuation_amount: { amount: '8000000', currency: 'USD' },
    },
  },
  {
    name: 'actual valuation',
    mechanism: { type: 'VALUATION_BASED_CONVERSION', valuation_type: 'ACTUAL' },
  },
  {
    name: 'PPS percentage discount',
    mechanism: {
      type: 'PPS_BASED_CONVERSION',
      description: '20% below the next financing price',
      discount: true,
      discount_percentage: '0.2',
    },
  },
  {
    name: 'PPS amount discount',
    mechanism: {
      type: 'PPS_BASED_CONVERSION',
      description: 'One dollar below the next financing price',
      discount: true,
      discount_amount: { amount: '1', currency: 'USD' },
    },
  },
  {
    name: 'PPS without discount',
    mechanism: {
      type: 'PPS_BASED_CONVERSION',
      description: 'The next financing price',
      discount: false,
    },
  },
];

function convertibleInput(mechanism: ConvertibleConversionMechanism): ConvertibleIssuanceInput {
  return {
    id: 'convertible-1',
    date: '2026-01-01',
    security_id: 'security-1',
    custom_id: 'CN-1',
    stakeholder_id: 'stakeholder-1',
    investment_amount: { amount: '500000', currency: 'USD' },
    convertible_type: 'CONVERTIBLE_SECURITY',
    conversion_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'convertible-trigger-1',
        conversion_right: {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: mechanism,
          converts_to_future_round: true,
        },
      },
    ],
    seniority: 1,
    security_law_exemptions: [{ description: 'Regulation D', jurisdiction: 'US' }],
  };
}

function warrantInput(mechanism: WarrantConversionMechanism): WarrantIssuanceInput {
  return {
    id: 'warrant-1',
    date: '2026-01-01',
    security_id: 'security-2',
    custom_id: 'W-1',
    stakeholder_id: 'stakeholder-1',
    purchase_price: { amount: '100', currency: 'USD' },
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'warrant-trigger-1',
        conversion_right: {
          type: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: mechanism,
          converts_to_stock_class_id: 'class-1',
        },
      },
    ],
    security_law_exemptions: [{ description: 'Section 4(a)(2)', jurisdiction: 'US' }],
  };
}

describe('canonical conversion mechanism matrices', () => {
  test.each(CONVERTIBLE_MECHANISMS)('parses and round-trips convertible $name', ({ mechanism }) => {
    const input = convertibleInput(mechanism);
    expect(() =>
      parseOcfEntityInput('convertibleIssuance', {
        ...input,
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
      })
    ).not.toThrow();

    const roundTripped = damlConvertibleIssuanceDataToNative(convertibleIssuanceDataToDaml(input));
    expect(
      requireFirst(roundTripped.conversion_triggers, 'round-tripped convertible trigger').conversion_right
    ).toEqual(requireFirst(input.conversion_triggers, 'input convertible trigger').conversion_right);
  });

  test.each(WARRANT_MECHANISMS)('parses and round-trips warrant $name', ({ mechanism }) => {
    const input = warrantInput(mechanism);
    expect(() =>
      parseOcfEntityInput('warrantIssuance', {
        ...input,
        object_type: 'TX_WARRANT_ISSUANCE',
      })
    ).not.toThrow();

    const roundTripped = damlWarrantIssuanceDataToNative(warrantIssuanceDataToDaml(input));
    expect(requireFirst(roundTripped.exercise_triggers, 'round-tripped warrant trigger').conversion_right).toEqual(
      requireFirst(input.exercise_triggers, 'input warrant trigger').conversion_right
    );
  });

  it('parses and round-trips the stock-class right ratio mechanism through StockClass', () => {
    const ratio: RatioConversionMechanism = {
      type: 'RATIO_CONVERSION',
      ratio: { numerator: '3', denominator: '2' },
      conversion_price: { amount: '10', currency: 'USD' },
      rounding_type: 'NORMAL',
    };
    const input: OcfStockClass = {
      object_type: 'STOCK_CLASS',
      id: 'class-1',
      name: 'Series Seed',
      class_type: 'PREFERRED',
      default_id_prefix: 'SEED',
      initial_shares_authorized: '1000000',
      votes_per_share: '1',
      seniority: '1',
      conversion_rights: [
        {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: ratio,
          converts_to_stock_class_id: 'common-1',
        },
      ],
    };

    expect(() => parseOcfEntityInput('stockClass', input)).not.toThrow();
    const roundTripped = damlStockClassDataToNative(stockClassDataToDaml(input));
    expect(roundTripped.conversion_rights).toEqual(input.conversion_rights);
  });

  it('round-trips a stock-class right ratio mechanism through WarrantIssuance', () => {
    const input: WarrantIssuanceInput = {
      ...warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1' }),
      exercise_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'stock-class-trigger',
          conversion_right: {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '1', denominator: '1' },
              conversion_price: { amount: '2', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'class-1',
          },
        },
      ],
    };

    expect(() =>
      parseOcfEntityInput('warrantIssuance', {
        ...input,
        object_type: 'TX_WARRANT_ISSUANCE',
      })
    ).not.toThrow();
    const roundTripped = damlWarrantIssuanceDataToNative(warrantIssuanceDataToDaml(input));
    expect(requireFirst(roundTripped.exercise_triggers, 'round-tripped warrant trigger').conversion_right).toEqual(
      requireFirst(input.exercise_triggers, 'input warrant trigger').conversion_right
    );
  });
});

describe('strict optional numeric issuance fields', () => {
  it('encodes omitted values as DAML null', () => {
    expect(
      convertibleIssuanceDataToDaml(
        convertibleInput({ type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' })
      ).pro_rata
    ).toBeNull();
    expect(
      warrantIssuanceDataToDaml(warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }))
        .quantity
    ).toBeNull();
    expect(
      warrantIssuanceDataToDaml(warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }))
        .quantity_source
    ).toBeNull();
  });

  it('rejects an explicit null convertible pro_rata at the JavaScript boundary', () => {
    const input = {
      ...convertibleInput({ type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' }),
      pro_rata: null,
    } as unknown as ConvertibleIssuanceInput;

    const error = captureValidationError(() => convertibleIssuanceDataToDaml(input));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'decimal string or omitted property',
      fieldPath: 'convertibleIssuance.pro_rata',
      receivedValue: null,
    });
    expect(error.message).toContain('explicit null is invalid');
  });

  it('rejects an explicit null warrant quantity at the JavaScript boundary', () => {
    const input = {
      ...warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }),
      quantity: null,
    } as unknown as WarrantIssuanceInput;

    const error = captureValidationError(() => warrantIssuanceDataToDaml(input));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'decimal string or omitted property',
      fieldPath: 'warrantIssuance.quantity',
      receivedValue: null,
    });
    expect(error.message).toContain('explicit null is invalid');
  });

  it('rejects an explicit null warrant quantity source at the JavaScript boundary', () => {
    const input = {
      ...warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }),
      quantity_source: null,
    } as unknown as WarrantIssuanceInput;

    const error = captureValidationError(() => warrantIssuanceDataToDaml(input));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'QuantitySourceType or omitted property',
      fieldPath: 'warrantIssuance.quantity_source',
      receivedValue: null,
    });
    expect(error.message).toContain('explicit null is invalid');
  });
});

describe('strict optional capitalization definitions', () => {
  function suppliedCapitalizationDefinition(value: unknown): { readonly capitalization_definition?: string } {
    return value === undefined ? {} : { capitalization_definition: value as string };
  }

  const writers: ReadonlyArray<{
    encode: (definition: unknown) => unknown;
    name: string;
  }> = [
    {
      name: 'convertible SAFE',
      encode: (definition) =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          ...suppliedCapitalizationDefinition(definition),
        }),
    },
    {
      name: 'convertible note',
      encode: (definition) =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'MONTHLY',
          compounding_type: 'SIMPLE',
          ...suppliedCapitalizationDefinition(definition),
        }),
    },
    {
      name: 'convertible percent capitalization',
      encode: (definition) =>
        convertibleMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '0.1',
          ...suppliedCapitalizationDefinition(definition),
        }),
    },
    {
      name: 'warrant percent capitalization',
      encode: (definition) =>
        warrantMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '0.1',
          ...suppliedCapitalizationDefinition(definition),
        }),
    },
    {
      name: 'warrant valuation',
      encode: (definition) =>
        warrantMechanismToDaml({
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'ACTUAL',
          ...suppliedCapitalizationDefinition(definition),
        }),
    },
  ];

  test.each(writers)('encodes an omitted $name definition as DAML null', ({ encode }) => {
    expect(encode(undefined)).toMatchObject({ value: { capitalization_definition: null } });
  });

  test.each(writers)('preserves an exact non-blank $name definition', ({ encode }) => {
    const definition = '  Fully diluted capitalization  ';
    expect(encode(definition)).toMatchObject({ value: { capitalization_definition: definition } });
  });

  test.each(writers.flatMap((writer) => ['', '   '].map((value) => ({ ...writer, value }))))(
    'rejects a blank $name definition',
    ({ encode, value }) => {
      const error = captureValidationError(() => encode(value));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'non-blank string or omitted property',
        fieldPath: 'conversion_mechanism.capitalization_definition',
        receivedValue: value,
      });
    }
  );

  test.each(writers.flatMap((writer) => [null, 42].map((value) => ({ ...writer, value }))))(
    'rejects a non-string $name definition',
    ({ encode, value }) => {
      const error = captureValidationError(() => encode(value));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'non-blank string or omitted property',
        fieldPath: 'conversion_mechanism.capitalization_definition',
        receivedValue: value,
      });
    }
  );
});

describe('canonical DAML conversion timing constructors', () => {
  test.each([
    ['PRE_MONEY', 'OcfConvTimingPreMoney'],
    ['POST_MONEY', 'OcfConvTimingPostMoney'],
  ] as const)('round-trips %s through %s', (conversionTiming, damlConstructor) => {
    const mechanism: ConvertibleConversionMechanism = {
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
      conversion_timing: conversionTiming,
    };

    const encoded = convertibleMechanismToDaml(mechanism);
    expect(encoded).toMatchObject({
      tag: 'OcfConvMechSAFE',
      value: { conversion_timing: damlConstructor },
    });
    expect(convertibleMechanismFromDaml(encoded)).toEqual(mechanism);
  });

  test.each(['OcfConversionTimingPreMoney', 'OcfConversionTimingPostMoney'])(
    'rejects non-canonical legacy alias %s',
    (legacyAlias) => {
      const encoded = convertibleMechanismToDaml({
        type: 'SAFE_CONVERSION',
        conversion_mfn: false,
        conversion_timing: 'POST_MONEY',
      });
      if (encoded.tag !== 'OcfConvMechSAFE') throw new Error('Expected SAFE conversion mechanism');
      const malformed = {
        ...encoded,
        value: { ...encoded.value, conversion_timing: legacyAlias },
      };

      expect(() => convertibleMechanismFromDaml(malformed)).toThrow(OcpParseError);
      expect(() => convertibleMechanismFromDaml(malformed)).toThrow(`Unknown conversion_timing: ${legacyAlias}`);
    }
  );
});
