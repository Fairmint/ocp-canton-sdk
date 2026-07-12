import type {
  CapitalizationDefinitionRules,
  ConvertibleConversionMechanism,
  OcfStockClass,
  PersistedStockClassRatioConversionMechanism,
  WarrantConversionMechanism,
} from '../../src';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  convertibleIssuanceDataToDaml,
  type ConvertibleIssuanceInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import {
  damlConvertibleIssuanceDataToNative as convertTypedConvertibleIssuance,
  type DamlConvertibleIssuanceData,
} from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import {
  capitalizationRulesToDaml,
  convertibleMechanismFromDaml,
  convertibleMechanismToDaml,
  ratioMechanismFromDaml,
  ratioMechanismToDaml,
  warrantMechanismFromDaml,
  warrantMechanismToDaml,
} from '../../src/functions/OpenCapTable/shared/conversionMechanisms';
import { requireDecimalString } from '../../src/functions/OpenCapTable/shared/ocfValues';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import {
  warrantIssuanceDataToDaml,
  type WarrantIssuanceInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { parseOcfEntityInput } from '../../src/utils/ocfZodSchemas';

const damlConvertibleIssuanceDataToNative = (value: unknown) =>
  convertTypedConvertibleIssuance(value as DamlConvertibleIssuanceData);

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

function captureParseError(action: () => unknown): OcpParseError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpParseError) return error;
    throw error;
  }
  throw new Error('Expected OcpParseError');
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
    mechanism: {
      type: 'VALUATION_BASED_CONVERSION',
      valuation_type: 'ACTUAL',
      valuation_amount: { amount: '9000000', currency: 'USD' },
    },
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
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
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
    object_type: 'TX_WARRANT_ISSUANCE',
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

  test.each([
    ['0', '0'],
    ['.5', '0.5'],
    ['0.5', '0.5'],
    ['.0000000001', '0.0000000001'],
    ['1', '1'],
    ['1.0000000000', '1'],
  ] as const)('canonicalizes schema-valid Percentage %s through direct helpers', (rate, expected) => {
    const encoded = convertibleMechanismToDaml({
      type: 'CONVERTIBLE_NOTE_CONVERSION',
      interest_rates: [{ rate, accrual_start_date: '2026-01-01' }],
      day_count_convention: 'ACTUAL_365',
      interest_payout: 'DEFERRED',
      interest_accrual_period: 'ANNUAL',
      compounding_type: 'SIMPLE',
    });
    if (encoded.tag !== 'OcfConvMechNote') throw new Error('Expected generated note mechanism');

    expect(requireFirst(encoded.value.interest_rates, 'encoded note interest rate').rate).toBe(expected);
    const decoded = convertibleMechanismFromDaml(encoded);
    if (decoded.type !== 'CONVERTIBLE_NOTE_CONVERSION') throw new Error('Expected decoded note mechanism');
    expect(requireFirst(decoded.interest_rates, 'decoded note interest rate').rate).toBe(expected);
  });

  test.each([
    ['.5', '0.5'],
    ['.0000000001', '0.0000000001'],
  ] as const)(
    'round-trips schema-valid leading-decimal Percentage %s through the public dispatcher',
    (value, expected) => {
      const input = {
        ...convertibleInput({ type: 'SAFE_CONVERSION', conversion_mfn: false, conversion_discount: value }),
        object_type: 'TX_CONVERTIBLE_ISSUANCE' as const,
      };
      const encoded = convertToDaml('convertibleIssuance', input);
      const decoded = damlConvertibleIssuanceDataToNative(encoded);
      const mechanism = requireFirst(decoded.conversion_triggers, 'decoded convertible trigger').conversion_right
        .conversion_mechanism;
      if (mechanism.type !== 'SAFE_CONVERSION') throw new Error('Expected decoded SAFE mechanism');

      expect(mechanism.conversion_discount).toBe(expected);
    }
  );

  const invalidOcfPercentageLexemes = [
    ['leading plus', '+0.2', OcpErrorCodes.INVALID_FORMAT],
    ['negative zero', '-0', OcpErrorCodes.INVALID_FORMAT],
    ['redundant leading zero', '00.2', OcpErrorCodes.INVALID_FORMAT],
    ['trailing decimal point', '0.', OcpErrorCodes.INVALID_FORMAT],
    ['trailing decimal point at one', '1.', OcpErrorCodes.INVALID_FORMAT],
    ['exponent notation', '1e-1', OcpErrorCodes.INVALID_FORMAT],
    ['value above one', '1.1', OcpErrorCodes.OUT_OF_RANGE],
    ['eleven fractional digits', '0.12345678901', OcpErrorCodes.INVALID_FORMAT],
  ] as const;

  const percentageWriters: ReadonlyArray<{
    name: string;
    directFieldPath: string;
    genericFieldPath: string;
    direct: (value: string) => unknown;
    generic: (value: string) => unknown;
  }> = [
    {
      name: 'SAFE discount',
      directFieldPath: 'conversion_mechanism.conversion_discount',
      genericFieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount',
      direct: (value) =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: value,
        }),
      generic: (value) =>
        convertToDaml('convertibleIssuance', {
          ...convertibleInput({
            type: 'SAFE_CONVERSION',
            conversion_mfn: false,
            conversion_discount: value,
          }),
          object_type: 'TX_CONVERTIBLE_ISSUANCE',
        }),
    },
    {
      name: 'note discount',
      directFieldPath: 'conversion_mechanism.conversion_discount',
      genericFieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount',
      direct: (value) =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          conversion_discount: value,
        }),
      generic: (value) =>
        convertToDaml('convertibleIssuance', {
          ...convertibleInput({
            type: 'CONVERTIBLE_NOTE_CONVERSION',
            interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
            day_count_convention: 'ACTUAL_365',
            interest_payout: 'DEFERRED',
            interest_accrual_period: 'ANNUAL',
            compounding_type: 'SIMPLE',
            conversion_discount: value,
          }),
          object_type: 'TX_CONVERTIBLE_ISSUANCE',
        }),
    },
    {
      name: 'note interest rate',
      directFieldPath: 'conversion_mechanism.interest_rates[0].rate',
      genericFieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.interest_rates[0].rate',
      direct: (value) =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: value, accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
        }),
      generic: (value) =>
        convertToDaml('convertibleIssuance', {
          ...convertibleInput({
            type: 'CONVERTIBLE_NOTE_CONVERSION',
            interest_rates: [{ rate: value, accrual_start_date: '2026-01-01' }],
            day_count_convention: 'ACTUAL_365',
            interest_payout: 'DEFERRED',
            interest_accrual_period: 'ANNUAL',
            compounding_type: 'SIMPLE',
          }),
          object_type: 'TX_CONVERTIBLE_ISSUANCE',
        }),
    },
    {
      name: 'convertible fixed percentage',
      directFieldPath: 'conversion_mechanism.converts_to_percent',
      genericFieldPath:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.converts_to_percent',
      direct: (value) =>
        convertibleMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: value,
        }),
      generic: (value) =>
        convertToDaml('convertibleIssuance', {
          ...convertibleInput({
            type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
            converts_to_percent: value,
          }),
          object_type: 'TX_CONVERTIBLE_ISSUANCE',
        }),
    },
    {
      name: 'warrant fixed percentage',
      directFieldPath: 'conversion_mechanism.converts_to_percent',
      genericFieldPath:
        'warrantIssuance.exercise_triggers[0].conversion_right.conversion_mechanism.converts_to_percent',
      direct: (value) =>
        warrantMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: value,
        }),
      generic: (value) =>
        convertToDaml('warrantIssuance', {
          ...warrantInput({
            type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
            converts_to_percent: value,
          }),
          object_type: 'TX_WARRANT_ISSUANCE',
        }),
    },
    {
      name: 'warrant PPS percentage discount',
      directFieldPath: 'conversion_mechanism.discount_percentage',
      genericFieldPath:
        'warrantIssuance.exercise_triggers[0].conversion_right.conversion_mechanism.discount_percentage',
      direct: (value) =>
        warrantMechanismToDaml({
          type: 'PPS_BASED_CONVERSION',
          description: 'Discount',
          discount: true,
          discount_percentage: value,
        }),
      generic: (value) =>
        convertToDaml('warrantIssuance', {
          ...warrantInput({
            type: 'PPS_BASED_CONVERSION',
            description: 'Discount',
            discount: true,
            discount_percentage: value,
          }),
          object_type: 'TX_WARRANT_ISSUANCE',
        }),
    },
  ];

  for (const writer of percentageWriters) {
    test.each(invalidOcfPercentageLexemes)(
      `rejects a %s ${writer.name} at its direct writer path`,
      (_syntax, value, code) => {
        expect(captureValidationError(() => writer.direct(value))).toMatchObject({
          code,
          fieldPath: writer.directFieldPath,
          receivedValue: value,
        });
      }
    );

    test.each(invalidOcfPercentageLexemes)(
      `rejects a %s ${writer.name} at its generic writer path`,
      (_syntax, value, code) => {
        expect(captureValidationError(() => writer.generic(value))).toMatchObject({
          code,
          fieldPath: writer.genericFieldPath,
          receivedValue: value,
        });
      }
    );
  }

  test.each([
    {
      name: 'SAFE discount',
      read: () => {
        const encoded = convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: '0.2',
        });
        if (encoded.tag !== 'OcfConvMechSAFE') throw new Error('Expected generated SAFE mechanism');
        const decoded = convertibleMechanismFromDaml({
          ...encoded,
          value: { ...encoded.value, conversion_discount: '+000.2000' },
        });
        if (decoded.type !== 'SAFE_CONVERSION') throw new Error('Expected decoded SAFE mechanism');
        return decoded.conversion_discount;
      },
    },
    {
      name: 'note discount and interest rate',
      read: () => {
        const encoded = convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          conversion_discount: '0.2',
        });
        if (encoded.tag !== 'OcfConvMechNote') throw new Error('Expected generated note mechanism');
        const encodedRate = requireFirst(encoded.value.interest_rates, 'encoded note interest rate');
        const decoded = convertibleMechanismFromDaml({
          ...encoded,
          value: {
            ...encoded.value,
            conversion_discount: '+000.2000',
            interest_rates: [{ ...encodedRate, rate: '+000.2000' }],
          },
        });
        if (decoded.type !== 'CONVERTIBLE_NOTE_CONVERSION') throw new Error('Expected decoded note mechanism');
        expect(requireFirst(decoded.interest_rates, 'decoded note interest rate').rate).toBe('0.2');
        return decoded.conversion_discount;
      },
    },
    {
      name: 'convertible fixed percentage',
      read: () => {
        const encoded = convertibleMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '0.2',
        });
        if (encoded.tag !== 'OcfConvMechPercentCapitalization') {
          throw new Error('Expected generated convertible percentage mechanism');
        }
        const decoded = convertibleMechanismFromDaml({
          ...encoded,
          value: { ...encoded.value, converts_to_percent: '+000.2000' },
        });
        if (decoded.type !== 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION') {
          throw new Error('Expected decoded convertible percentage mechanism');
        }
        return decoded.converts_to_percent;
      },
    },
    {
      name: 'warrant fixed percentage',
      read: () => {
        const encoded = warrantMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '0.2',
        });
        if (encoded.tag !== 'OcfWarrantMechanismPercentCapitalization') {
          throw new Error('Expected generated warrant percentage mechanism');
        }
        const decoded = warrantMechanismFromDaml({
          ...encoded,
          value: { ...encoded.value, converts_to_percent: '+000.2000' },
        });
        if (decoded.type !== 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION') {
          throw new Error('Expected decoded warrant percentage mechanism');
        }
        return decoded.converts_to_percent;
      },
    },
    {
      name: 'warrant PPS percentage discount',
      read: () => {
        const encoded = warrantMechanismToDaml({
          type: 'PPS_BASED_CONVERSION',
          description: 'Discount',
          discount: true,
          discount_percentage: '0.2',
        });
        if (encoded.tag !== 'OcfWarrantMechanismPpsBased') throw new Error('Expected generated PPS mechanism');
        const decoded = warrantMechanismFromDaml({
          ...encoded,
          value: { ...encoded.value, discount_percentage: '+000.2000' },
        });
        if (decoded.type !== 'PPS_BASED_CONVERSION' || !decoded.discount) {
          throw new Error('Expected decoded discounted PPS mechanism');
        }
        return decoded.discount_percentage;
      },
    },
  ])('canonicalizes signed generated-DAML Numeric Percentage values for $name', ({ read }) => {
    expect(read()).toBe('0.2');
  });

  it('keeps leading-decimal values invalid for general OCF Numeric fields', () => {
    expect(captureValidationError(() => requireDecimalString('.5', 'numeric'))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'numeric',
      receivedValue: '.5',
    });
  });

  it('parses and round-trips the stock-class right ratio mechanism through StockClass', () => {
    const ratio: PersistedStockClassRatioConversionMechanism = {
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

describe('generated DAML Optional record boundaries', () => {
  it('rejects a Some-wrapped Monetary instead of accepting a non-generated compatibility shape', () => {
    const generated = convertibleMechanismToDaml({
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
      conversion_valuation_cap: { amount: '1000000', currency: 'USD' },
    });
    if (generated.tag !== 'OcfConvMechSAFE') throw new Error('Expected generated SAFE mechanism');

    const wrapped = {
      ...generated,
      value: {
        ...generated.value,
        conversion_valuation_cap: {
          tag: 'Some',
          value: generated.value.conversion_valuation_cap,
        },
      },
    };
    const error = captureValidationError(() => convertibleMechanismFromDaml(wrapped));

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'direct Monetary record or null',
      fieldPath: 'conversion_mechanism.conversion_valuation_cap',
    });
    expect(error.message).toContain('generated DAML Optional encoding');
  });

  it('rejects a Some-wrapped Ratio instead of accepting a non-generated compatibility shape', () => {
    const error = captureValidationError(() =>
      ratioMechanismFromDaml(
        {
          conversion_mechanism: 'OcfConversionMechanismRatioConversion',
          ratio: { tag: 'Some', value: { numerator: '2', denominator: '1' } },
          conversion_price: { amount: '10', currency: 'USD' },
        },
        'stockClass.conversion_right'
      )
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'direct Ratio record or null',
      fieldPath: 'stockClass.conversion_right.ratio',
    });
    expect(error.message).toContain('generated DAML Optional encoding');
  });
});

describe('writer numeric diagnostic paths', () => {
  const malformed = '1e3';

  test.each([
    {
      name: 'convertible SAFE discount',
      fieldPath: 'conversion_mechanism.conversion_discount',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: malformed,
        }),
    },
    {
      name: 'convertible SAFE valuation cap amount',
      fieldPath: 'conversion_mechanism.conversion_valuation_cap.amount',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_valuation_cap: { amount: malformed, currency: 'USD' },
        }),
    },
    {
      name: 'convertible SAFE exit denominator',
      fieldPath: 'conversion_mechanism.exit_multiple.denominator',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          exit_multiple: { numerator: '1', denominator: malformed },
        }),
    },
    {
      name: 'convertible note discount',
      fieldPath: 'conversion_mechanism.conversion_discount',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          conversion_discount: malformed,
        }),
    },
    {
      name: 'convertible note valuation cap amount',
      fieldPath: 'conversion_mechanism.conversion_valuation_cap.amount',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          conversion_valuation_cap: { amount: malformed, currency: 'USD' },
        }),
    },
    {
      name: 'convertible note exit numerator',
      fieldPath: 'conversion_mechanism.exit_multiple.numerator',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          exit_multiple: { numerator: malformed, denominator: '1' },
        }),
    },
    {
      name: 'convertible note exit denominator',
      fieldPath: 'conversion_mechanism.exit_multiple.denominator',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          exit_multiple: { numerator: '1', denominator: malformed },
        }),
    },
    {
      name: 'convertible percent capitalization',
      fieldPath: 'conversion_mechanism.converts_to_percent',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: malformed,
        }),
    },
    {
      name: 'convertible fixed amount',
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      encode: () =>
        convertibleMechanismToDaml({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: malformed,
        }),
    },
    {
      name: 'warrant percent capitalization',
      fieldPath: 'conversion_mechanism.converts_to_percent',
      encode: () =>
        warrantMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: malformed,
        }),
    },
    {
      name: 'warrant fixed amount',
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      encode: () =>
        warrantMechanismToDaml({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: malformed,
        }),
    },
    {
      name: 'warrant valuation amount',
      fieldPath: 'conversion_mechanism.valuation_amount.amount',
      encode: () =>
        warrantMechanismToDaml({
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'CAP',
          valuation_amount: { amount: malformed, currency: 'USD' },
        }),
    },
    {
      name: 'warrant PPS discount amount',
      fieldPath: 'conversion_mechanism.discount_amount.amount',
      encode: () =>
        warrantMechanismToDaml({
          type: 'PPS_BASED_CONVERSION',
          description: 'Discount',
          discount: true,
          discount_amount: { amount: malformed, currency: 'USD' },
        }),
    },
    {
      name: 'stock-class ratio numerator',
      fieldPath: 'conversion_right.conversion_mechanism.ratio.numerator',
      encode: () =>
        ratioMechanismToDaml({
          type: 'RATIO_CONVERSION',
          ratio: { numerator: malformed, denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL',
        }),
    },
    {
      name: 'stock-class ratio denominator',
      fieldPath: 'conversion_right.conversion_mechanism.ratio.denominator',
      encode: () =>
        ratioMechanismToDaml({
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '1', denominator: malformed },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL',
        }),
    },
    {
      name: 'stock-class conversion price amount',
      fieldPath: 'conversion_right.conversion_mechanism.conversion_price.amount',
      encode: () =>
        ratioMechanismToDaml({
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: malformed, currency: 'USD' },
          rounding_type: 'NORMAL',
        }),
    },
  ])('reports malformed $name at its OCF field path', ({ encode, fieldPath }) => {
    const error = captureValidationError(encode);
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath,
      receivedValue: malformed,
    });
  });
});

describe('writer discriminator diagnostic paths', () => {
  test.each([
    {
      name: 'convertible mechanism',
      fieldPath: 'convertibleIssuance.conversion_triggers.1.conversion_right.conversion_mechanism',
      encode: (fieldPath: string) =>
        convertibleMechanismToDaml(
          { type: 'UNSUPPORTED_CONVERSION' } as unknown as ConvertibleConversionMechanism,
          fieldPath
        ),
    },
    {
      name: 'warrant mechanism',
      fieldPath: 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism',
      encode: (fieldPath: string) =>
        warrantMechanismToDaml({ type: 'UNSUPPORTED_CONVERSION' } as unknown as WarrantConversionMechanism, fieldPath),
    },
    {
      name: 'stock-class ratio mechanism',
      fieldPath: 'stockClass.conversion_rights.1.conversion_mechanism',
      encode: (fieldPath: string) =>
        ratioMechanismToDaml(
          { type: 'UNSUPPORTED_CONVERSION' } as unknown as PersistedStockClassRatioConversionMechanism,
          fieldPath
        ),
    },
  ])('reports an unknown $name at its caller-supplied path', ({ encode, fieldPath }) => {
    try {
      encode(fieldPath);
      throw new Error('Expected unknown mechanism validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: fieldPath,
      });
    }
  });

  it('rejects a null convertible mechanism with a typed field-specific error', () => {
    const fieldPath = 'convertibleIssuance.conversion_triggers.1.conversion_right.conversion_mechanism';
    const error = captureValidationError(() =>
      convertibleMechanismToDaml(null as unknown as ConvertibleConversionMechanism, fieldPath)
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'ConvertibleConversionMechanism object',
      fieldPath,
      receivedValue: null,
    });
  });

  it('rejects an unknown warrant valuation type at its caller-supplied path', () => {
    const fieldPath = 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism';
    try {
      warrantMechanismToDaml(
        {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'UNKNOWN_VALUATION',
          valuation_amount: { amount: '1', currency: 'USD' },
        } as unknown as WarrantConversionMechanism,
        fieldPath
      );
      throw new Error('Expected valuation type validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: `${fieldPath}.valuation_type`,
      });
    }
  });
});

describe('strict conversion record boundaries', () => {
  const completeNote = {
    type: 'CONVERTIBLE_NOTE_CONVERSION' as const,
    interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }] as [
      { rate: string; accrual_start_date: string },
    ],
    day_count_convention: 'ACTUAL_365' as const,
    interest_payout: 'DEFERRED' as const,
    interest_accrual_period: 'ANNUAL' as const,
    compounding_type: 'SIMPLE' as const,
  };

  test.each([
    {
      name: 'SAFE valuation cap',
      fieldPath: 'conversion_mechanism.conversion_valuation_cap',
      encode: (value: unknown) =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_valuation_cap: value,
        } as unknown as ConvertibleConversionMechanism),
    },
    {
      name: 'note valuation cap',
      fieldPath: 'conversion_mechanism.conversion_valuation_cap',
      encode: (value: unknown) =>
        convertibleMechanismToDaml({
          ...completeNote,
          conversion_valuation_cap: value,
        } as unknown as ConvertibleConversionMechanism),
    },
    {
      name: 'SAFE exit multiple',
      fieldPath: 'conversion_mechanism.exit_multiple',
      encode: (value: unknown) =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          exit_multiple: value,
        } as unknown as ConvertibleConversionMechanism),
    },
    {
      name: 'note exit multiple',
      fieldPath: 'conversion_mechanism.exit_multiple',
      encode: (value: unknown) =>
        convertibleMechanismToDaml({
          ...completeNote,
          exit_multiple: value,
        } as unknown as ConvertibleConversionMechanism),
    },
  ])('rejects malformed optional $name instead of normalizing it to absence', ({ encode, fieldPath }) => {
    for (const value of [null, 0, false, '']) {
      const error = captureValidationError(() => encode(value));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        receivedValue: value,
      });
    }
  });

  test.each([null, false, 0, ''])('rejects malformed capitalization rules %p instead of dropping them', (value) => {
    const fieldPath = 'conversion_mechanism.capitalization_definition_rules';
    const error = captureValidationError(() =>
      capitalizationRulesToDaml(value as unknown as CapitalizationDefinitionRules, fieldPath)
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath,
      receivedValue: value,
    });
  });

  it('attributes an incomplete capitalization rule set to the exact missing flag', () => {
    const fieldPath =
      'convertibleIssuance.conversion_triggers.1.conversion_right.conversion_mechanism.capitalization_definition_rules';
    const error = captureValidationError(() =>
      capitalizationRulesToDaml(
        { include_outstanding_shares: true } as unknown as CapitalizationDefinitionRules,
        fieldPath
      )
    );

    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: `${fieldPath}.include_outstanding_options`,
      receivedValue: undefined,
    });
  });

  test.each([
    ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['string', 'false', OcpErrorCodes.INVALID_TYPE],
    ['number', 0, OcpErrorCodes.INVALID_TYPE],
    ['object', {}, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a required SAFE conversion_mfn %s precisely', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleMechanismToDaml({
        type: 'SAFE_CONVERSION',
        conversion_mfn: value,
      } as unknown as ConvertibleConversionMechanism)
    );

    expect(error).toMatchObject({
      code,
      fieldPath: 'conversion_mechanism.conversion_mfn',
      receivedValue: value,
    });
  });

  it('preserves canonical optional Note conversion_mfn values and omission', () => {
    const omitted = convertibleMechanismToDaml(completeNote);
    const disabled = convertibleMechanismToDaml({ ...completeNote, conversion_mfn: false });
    const enabled = convertibleMechanismToDaml({ ...completeNote, conversion_mfn: true });
    if (omitted.tag !== 'OcfConvMechNote' || disabled.tag !== 'OcfConvMechNote' || enabled.tag !== 'OcfConvMechNote') {
      throw new Error('Expected convertible note mechanisms');
    }

    expect(omitted.value.conversion_mfn).toBeNull();
    expect(disabled.value.conversion_mfn).toBe(false);
    expect(enabled.value.conversion_mfn).toBe(true);
  });

  test.each([null, 'false', 0, {}])(
    'rejects malformed optional Note conversion_mfn %p instead of treating it as absent',
    (value) => {
      const error = captureValidationError(() =>
        convertibleMechanismToDaml({
          ...completeNote,
          conversion_mfn: value,
        } as unknown as ConvertibleConversionMechanism)
      );

      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'conversion_mechanism.conversion_mfn',
        receivedValue: value,
      });
    }
  );

  test.each(['CAP', 'FIXED', 'ACTUAL'] as const)(
    'requires valuation_amount for a %s warrant mechanism',
    (valuationType) => {
      const fieldPath = 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism.valuation_amount';
      for (const value of [undefined, null]) {
        const error = captureValidationError(() =>
          warrantMechanismToDaml(
            {
              type: 'VALUATION_BASED_CONVERSION',
              valuation_type: valuationType,
              valuation_amount: value,
            } as unknown as WarrantConversionMechanism,
            fieldPath.replace(/\.valuation_amount$/, '')
          )
        );
        expect(error).toMatchObject({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath,
          receivedValue: value,
        });
      }
    }
  );

  test.each(['CAP', 'FIXED', 'ACTUAL'] as const)(
    'rejects a scalar valuation_amount for a %s warrant mechanism',
    (valuationType) => {
      const value = 0;
      const fieldPath = 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism.valuation_amount';
      const error = captureValidationError(() =>
        warrantMechanismToDaml(
          {
            type: 'VALUATION_BASED_CONVERSION',
            valuation_type: valuationType,
            valuation_amount: value,
          } as unknown as WarrantConversionMechanism,
          fieldPath.replace(/\.valuation_amount$/, '')
        )
      );

      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        receivedValue: value,
      });
    }
  );

  it('preserves valid zero strings in Monetary records while requiring positive ratio components', () => {
    const safe = convertibleMechanismToDaml({
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
      conversion_valuation_cap: { amount: '0', currency: 'USD' },
      exit_multiple: { numerator: '1', denominator: '1' },
    });
    if (safe.tag !== 'OcfConvMechSAFE') throw new Error('Expected SAFE mechanism');

    expect(safe.value.conversion_valuation_cap).toEqual({ amount: '0', currency: 'USD' });
    expect(safe.value.exit_multiple).toEqual({ numerator: '1', denominator: '1' });

    const warrant = warrantMechanismToDaml({
      type: 'VALUATION_BASED_CONVERSION',
      valuation_type: 'CAP',
      valuation_amount: { amount: '0', currency: 'USD' },
    });
    if (warrant.tag !== 'OcfWarrantMechanismValuationBased') throw new Error('Expected valuation mechanism');
    expect(warrant.value.valuation_amount).toEqual({ amount: '0', currency: 'USD' });
  });

  it('rejects the same lossy shapes at the public parser boundary', () => {
    const invalid = convertibleInput({
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
      conversion_valuation_cap: null,
    } as unknown as ConvertibleConversionMechanism);

    expect(() =>
      parseOcfEntityInput('convertibleIssuance', {
        ...invalid,
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
      })
    ).toThrow(OcpValidationError);

    const missingWarrantValuation = warrantInput({
      type: 'VALUATION_BASED_CONVERSION',
      valuation_type: 'CAP',
    } as unknown as WarrantConversionMechanism);
    expect(() =>
      parseOcfEntityInput('warrantIssuance', {
        ...missingWarrantValuation,
        object_type: 'TX_WARRANT_ISSUANCE',
      })
    ).toThrow(OcpValidationError);
  });

  it('rejects malformed future-round flags at both public issuance parsers', () => {
    const convertible = convertibleInput({ type: 'SAFE_CONVERSION', conversion_mfn: false });
    const convertibleTrigger = requireFirst(convertible.conversion_triggers, 'convertible trigger');
    const warrant = warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1' });
    const warrantTrigger = requireFirst(warrant.exercise_triggers, 'warrant trigger');

    expect(() =>
      parseOcfEntityInput('convertibleIssuance', {
        ...convertible,
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        conversion_triggers: [
          {
            ...convertibleTrigger,
            conversion_right: { ...convertibleTrigger.conversion_right, converts_to_future_round: 0 },
          },
        ],
      })
    ).toThrow(OcpValidationError);
    expect(() =>
      parseOcfEntityInput('warrantIssuance', {
        ...warrant,
        object_type: 'TX_WARRANT_ISSUANCE',
        exercise_triggers: [
          {
            ...warrantTrigger,
            conversion_right: { ...warrantTrigger.conversion_right, converts_to_future_round: 'false' },
          },
        ],
      })
    ).toThrow(OcpValidationError);
  });
});

describe('runtime-total conversion mechanism boundaries', () => {
  const note = {
    type: 'CONVERTIBLE_NOTE_CONVERSION' as const,
    interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
    day_count_convention: 'ACTUAL_365' as const,
    interest_payout: 'DEFERRED' as const,
    interest_accrual_period: 'ANNUAL' as const,
    compounding_type: 'SIMPLE' as const,
  };

  test.each([
    ['undefined', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['record', {}, OcpErrorCodes.INVALID_TYPE],
  ] as const)('classifies a %s note interest_rates collection', (_case, value, code) => {
    const error = captureValidationError(() =>
      convertibleMechanismToDaml({ ...note, interest_rates: value } as unknown as ConvertibleConversionMechanism)
    );
    expect(error).toMatchObject({
      code,
      fieldPath: 'conversion_mechanism.interest_rates',
      receivedValue: value,
    });
  });

  test.each([null, 42, false])('rejects malformed second note interest-rate record %p at its index', (value) => {
    const error = captureValidationError(() =>
      convertibleMechanismToDaml({
        ...note,
        interest_rates: [note.interest_rates[0], value],
      } as unknown as ConvertibleConversionMechanism)
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'conversion_mechanism.interest_rates[1]',
      receivedValue: value,
    });
  });

  test.each([
    ['day_count_convention', 'NOT_A_DAY_COUNT'],
    ['interest_payout', 'NOT_A_PAYOUT'],
    ['interest_accrual_period', 'NOT_A_PERIOD'],
    ['compounding_type', 'NOT_COMPOUNDING'],
  ] as const)('classifies note enum %s values without serializing undefined', (field, unknownValue) => {
    for (const missingValue of [undefined, null]) {
      const error = captureValidationError(() => convertibleMechanismToDaml({ ...note, [field]: missingValue }));
      expect(error).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: `conversion_mechanism.${field}`,
        receivedValue: missingValue,
      });
    }

    const wrongType = captureValidationError(() => convertibleMechanismToDaml({ ...note, [field]: 42 }));
    expect(wrongType).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: `conversion_mechanism.${field}`,
      receivedValue: 42,
    });

    try {
      convertibleMechanismToDaml({ ...note, [field]: unknownValue });
      throw new Error('Expected unknown note enum validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: `conversion_mechanism.${field}`,
      });
    }
  });

  test.each([
    {
      name: 'convertible custom',
      encode: (description: unknown) =>
        convertibleMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: description,
        } as unknown as ConvertibleConversionMechanism),
    },
    {
      name: 'warrant custom',
      encode: (description: unknown) =>
        warrantMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: description,
        } as unknown as WarrantConversionMechanism),
    },
  ])('strictly validates the $name description', ({ encode }) => {
    for (const value of [undefined, null]) {
      expect(captureValidationError(() => encode(value))).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'conversion_mechanism.custom_conversion_description',
        receivedValue: value,
      });
    }
    expect(captureValidationError(() => encode(42))).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'conversion_mechanism.custom_conversion_description',
      receivedValue: 42,
    });
    expect(captureValidationError(() => encode(''))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.custom_conversion_description',
      receivedValue: '',
    });
    expect(encode('   ')).toMatchObject({ value: { custom_conversion_description: '   ' } });
  });

  function pps(value: Record<string, unknown>): WarrantConversionMechanism {
    return { type: 'PPS_BASED_CONVERSION', ...value } as unknown as WarrantConversionMechanism;
  }

  test.each([
    [
      'description missing',
      { discount: false },
      'conversion_mechanism.description',
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
    ],
    [
      'description wrong type',
      { description: 42, discount: false },
      'conversion_mechanism.description',
      OcpErrorCodes.INVALID_TYPE,
    ],
    ['discount missing', { description: 'PPS' }, 'conversion_mechanism.discount', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    [
      'discount wrong type',
      { description: 'PPS', discount: 'true' },
      'conversion_mechanism.discount',
      OcpErrorCodes.INVALID_TYPE,
    ],
  ] as const)('classifies a PPS %s', (_case, value, fieldPath, code) => {
    const error = captureValidationError(() => warrantMechanismToDaml(pps(value)));
    expect(error).toMatchObject({ code, fieldPath });
  });

  it('rejects an empty PPS description', () => {
    expect(
      captureValidationError(() => warrantMechanismToDaml(pps({ description: '', discount: false })))
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.description',
      receivedValue: '',
    });
  });

  test.each([
    ['discounted with no details', { description: 'PPS', discount: true }],
    [
      'discounted with both details',
      {
        description: 'PPS',
        discount: true,
        discount_percentage: '0.2',
        discount_amount: { amount: '1', currency: 'USD' },
      },
    ],
    ['non-discounted with percentage', { description: 'PPS', discount: false, discount_percentage: '0.2' }],
    [
      'non-discounted with amount',
      { description: 'PPS', discount: false, discount_amount: { amount: '1', currency: 'USD' } },
    ],
  ] as const)('rejects a PPS mechanism that is %s', (_case, value) => {
    expect(captureValidationError(() => warrantMechanismToDaml(pps(value)))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.discount',
    });
  });

  const ratio = {
    type: 'RATIO_CONVERSION' as const,
    ratio: { numerator: '1', denominator: '1' },
    conversion_price: { amount: '1', currency: 'USD' },
    rounding_type: 'NORMAL' as const,
  };

  test.each([
    ['ratio', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['ratio', null, OcpErrorCodes.INVALID_TYPE],
    ['conversion_price', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['conversion_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['rounding_type', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['rounding_type', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
  ] as const)('classifies missing ratio mechanism %s=%p', (field, value, code) => {
    const error = captureValidationError(() => ratioMechanismToDaml({ ...ratio, [field]: value }));
    expect(error).toMatchObject({
      code,
      fieldPath: `conversion_right.conversion_mechanism.${field}`,
      receivedValue: value,
    });
  });

  test.each([
    ['null root', null, 'stockClass.conversion_right'],
    ['scalar root', 42, 'stockClass.conversion_right'],
    [
      'missing constructor',
      { ratio: ratio.ratio, conversion_price: ratio.conversion_price },
      'stockClass.conversion_right.type',
    ],
    [
      'wrong constructor type',
      { conversion_mechanism: false, ratio: ratio.ratio, conversion_price: ratio.conversion_price },
      'stockClass.conversion_right.type',
    ],
  ] as const)('rejects ratio reader %s', (_case, value, fieldPath) => {
    const error = captureValidationError(() =>
      ratioMechanismFromDaml(value as unknown as Record<string, unknown>, 'stockClass.conversion_right')
    );
    expect(error).toMatchObject({ fieldPath });
  });

  test.each([
    {
      name: 'convertible fixed quantity',
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      encode: (value: unknown) =>
        convertibleMechanismToDaml({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: value,
        } as unknown as ConvertibleConversionMechanism),
    },
    {
      name: 'warrant fixed quantity',
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      encode: (value: unknown) =>
        warrantMechanismToDaml({
          type: 'FIXED_AMOUNT_CONVERSION',
          converts_to_quantity: value,
        } as unknown as WarrantConversionMechanism),
    },
  ])('classifies required numeric values for $name', ({ encode, fieldPath }) => {
    for (const value of [undefined, null]) {
      expect(captureValidationError(() => encode(value))).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath,
        receivedValue: value,
      });
    }
    expect(captureValidationError(() => encode(false))).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath,
      receivedValue: false,
    });
    expect(captureValidationError(() => encode('1e3'))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath,
      receivedValue: '1e3',
    });
  });

  test.each([
    ['missing root', undefined, 'conversion_mechanism', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null root', null, 'conversion_mechanism', OcpErrorCodes.INVALID_TYPE],
    ['scalar root', 42, 'conversion_mechanism', OcpErrorCodes.INVALID_TYPE],
    ['missing tag', { value: {} }, 'conversion_mechanism.tag', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['wrong tag type', { tag: 42, value: {} }, 'conversion_mechanism.tag', OcpErrorCodes.INVALID_TYPE],
    ['missing value', { tag: 'OcfConvMechCustom' }, 'conversion_mechanism.value', OcpErrorCodes.REQUIRED_FIELD_MISSING],
  ] as const)('classifies a tagged reader %s', (_case, value, fieldPath, code) => {
    const error = captureValidationError(() => convertibleMechanismFromDaml(value));
    expect(error).toMatchObject({ code, fieldPath });
  });

  test.each([
    {
      name: 'convertible custom reader',
      decode: (description: unknown) =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: description },
        }),
    },
    {
      name: 'warrant custom reader',
      decode: (description: unknown) =>
        warrantMechanismFromDaml({
          tag: 'OcfWarrantMechanismCustom',
          value: { custom_conversion_description: description },
        }),
    },
  ])('strictly validates $name descriptions', ({ decode }) => {
    for (const value of [undefined, null]) {
      expect(captureValidationError(() => decode(value))).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'conversion_mechanism.custom_conversion_description',
        receivedValue: value,
      });
    }
    expect(captureValidationError(() => decode(42))).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'conversion_mechanism.custom_conversion_description',
      receivedValue: 42,
    });
    expect(captureValidationError(() => decode(''))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.custom_conversion_description',
      receivedValue: '',
    });
    expect(decode('   ')).toMatchObject({ custom_conversion_description: '   ' });
  });

  test.each([
    [
      'convertible outer variant',
      () => {
        const value = convertibleMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'Exact convertible mechanism',
        }) as unknown as Record<string, unknown>;
        value.future = true;
        return () => convertibleMechanismFromDaml(value);
      },
      'conversion_mechanism.future',
    ],
    [
      'convertible inner record',
      () => {
        const value = convertibleMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'Exact convertible mechanism',
        }) as unknown as { value: Record<string, unknown> };
        value.value.future = true;
        return () => convertibleMechanismFromDaml(value);
      },
      'conversion_mechanism.value.future',
    ],
    [
      'warrant outer variant',
      () => {
        const value = warrantMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'Exact warrant mechanism',
        }) as unknown as Record<string, unknown>;
        value.future = true;
        return () => warrantMechanismFromDaml(value);
      },
      'conversion_mechanism.future',
    ],
    [
      'warrant inner record',
      () => {
        const value = warrantMechanismToDaml({
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'Exact warrant mechanism',
        }) as unknown as { value: Record<string, unknown> };
        value.value.future = true;
        return () => warrantMechanismFromDaml(value);
      },
      'conversion_mechanism.value.future',
    ],
  ] as const)('rejects a discarded generated $name field', (_name, buildAction, source) => {
    expect(captureParseError(buildAction())).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source,
    });
  });

  test.each([
    ['CAP', 'OcfValuationCap'],
    ['FIXED', 'OcfValuationFixed'],
  ] as const)('requires a DAML valuation amount for %s formulas', (_nativeType, valuationType) => {
    const error = captureValidationError(() =>
      warrantMechanismFromDaml({
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: valuationType,
          valuation_amount: null,
          capitalization_definition: null,
          capitalization_definition_rules: null,
        },
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'conversion_mechanism.valuation_amount',
      receivedValue: null,
    });
  });
});

describe('reader discriminator diagnostic paths', () => {
  it('reports an unknown warrant valuation type at its caller-supplied path', () => {
    const field = 'warrantIssuance.exercise_triggers.1.conversion_right.conversion_mechanism';
    try {
      warrantMechanismFromDaml(
        {
          tag: 'OcfWarrantMechanismValuationBased',
          value: {
            valuation_type: 'UNKNOWN_VALUATION',
            valuation_amount: null,
            capitalization_definition: null,
            capitalization_definition_rules: null,
          },
        },
        field
      );
      throw new Error('Expected valuation type validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: `${field}.valuation_type`,
      });
    }
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

  it('reports the convertible field path for a malformed pro_rata string', () => {
    const input = {
      ...convertibleInput({ type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' }),
      pro_rata: '1e3',
    };

    const error = captureValidationError(() => convertibleIssuanceDataToDaml(input));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleIssuance.pro_rata',
      receivedValue: '1e3',
    });
  });

  it('reports the warrant field path for a malformed quantity string', () => {
    const input = {
      ...warrantInput({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }),
      quantity: 'not-a-number',
    };

    const error = captureValidationError(() => warrantIssuanceDataToDaml(input));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'warrantIssuance.quantity',
      receivedValue: 'not-a-number',
    });
  });
});

describe('strict optional PPS discount fields', () => {
  function percentageMechanism(value: unknown): WarrantConversionMechanism {
    return {
      type: 'PPS_BASED_CONVERSION',
      description: 'Percentage discount',
      discount: true,
      discount_percentage: value,
    } as unknown as WarrantConversionMechanism;
  }

  function amountMechanism(value: unknown): WarrantConversionMechanism {
    return {
      type: 'PPS_BASED_CONVERSION',
      description: 'Amount discount',
      discount: true,
      discount_amount: value,
    } as unknown as WarrantConversionMechanism;
  }

  test.each([null, 0.2, { decimal: '0.2' }])(
    'rejects non-string discount_percentage value %p with a typed validation error',
    (value) => {
      const error = captureValidationError(() => warrantMechanismToDaml(percentageMechanism(value)));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'positive percentage decimal string or omitted property',
        fieldPath: 'conversion_mechanism.discount_percentage',
        receivedValue: value,
      });
    }
  );

  test.each([null, 42, '1 USD'])('rejects non-object discount_amount value %p', (value) => {
    const error = captureValidationError(() => warrantMechanismToDaml(amountMechanism(value)));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object or omitted property',
      fieldPath: 'conversion_mechanism.discount_amount',
      receivedValue: value,
    });
  });

  it('rejects a discount_amount with a non-string amount', () => {
    const value = { amount: null, currency: 'USD' };
    const error = captureValidationError(() => warrantMechanismToDaml(amountMechanism(value)));
    expect(error).toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'canonical OCF decimal string',
      fieldPath: 'conversion_mechanism.discount_amount.amount',
      receivedValue: null,
    });
  });

  it('rejects a discount_amount with a non-string currency', () => {
    const value = { amount: '1', currency: null };
    const error = captureValidationError(() => warrantMechanismToDaml(amountMechanism(value)));
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'three-letter uppercase currency code',
      fieldPath: 'conversion_mechanism.discount_amount.currency',
      receivedValue: null,
    });
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
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
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
          valuation_amount: { amount: '1', currency: 'USD' },
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

  test.each(writers.map((writer) => ({ ...writer, value: '   ' })))(
    'preserves a whitespace-only $name definition',
    ({ encode, value }) => {
      expect(encode(value)).toMatchObject({ value: { capitalization_definition: value } });
    }
  );

  test.each(writers)('rejects an empty $name definition', ({ encode }) => {
    expect(captureValidationError(() => encode(''))).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.capitalization_definition',
      receivedValue: '',
    });
  });

  test.each(writers.flatMap((writer) => [null, 42].map((value) => ({ ...writer, value }))))(
    'rejects a non-string $name definition',
    ({ encode, value }) => {
      const error = captureValidationError(() => encode(value));
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string or omitted property',
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
