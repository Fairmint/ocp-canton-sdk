import type {
  ConvertibleConversionMechanism,
  OcfStockClass,
  PersistedStockClassRatioConversionMechanism,
  WarrantConversionMechanism,
} from '../../src';
import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import {
  convertibleMechanismFromDaml,
  convertibleMechanismToDaml,
  ratioMechanismFromDaml,
  ratioMechanismToDaml,
  warrantMechanismFromDaml,
  warrantMechanismToDaml,
} from '../../src/functions/OpenCapTable/shared/conversionMechanisms';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';

function captureValidationError(action: () => unknown): OcpValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('Expected OcpValidationError');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireFirst<T>(values: readonly T[], description: string): T {
  const [first] = values;
  if (first === undefined) throw new Error(`Missing ${description}`);
  return first;
}

const NOTE_VALUE = {
  interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01T00:00:00.000Z', accrual_end_date: null }],
  day_count_convention: 'OcfDayCountActual365',
  interest_payout: 'OcfInterestPayoutDeferred',
  interest_accrual_period: 'OcfAccrualAnnual',
  compounding_type: 'OcfSimple',
  conversion_discount: null,
  conversion_valuation_cap: null,
  capitalization_definition: null,
  capitalization_definition_rules: null,
  exit_multiple: null,
  conversion_mfn: null,
};

describe('DAML Numeric(10) conversion boundaries', () => {
  test.each([
    ['leading plus and zeros', '+0001.2300000000', '1.23'],
    ['exactly ten fractional digits', '1.1234567890', '1.123456789'],
    ['exactly twenty-eight integral digits', '9'.repeat(28), '9'.repeat(28)],
  ])('canonicalizes %s on write and read', (_case, value, expected) => {
    const encoded = convertibleMechanismToDaml({
      type: 'FIXED_AMOUNT_CONVERSION',
      converts_to_quantity: value,
    });
    expect(encoded).toMatchObject({
      tag: 'OcfConvMechFixedAmount',
      value: { converts_to_quantity: expected },
    });

    expect(
      convertibleMechanismFromDaml({
        tag: 'OcfConvMechFixedAmount',
        value: { converts_to_quantity: value },
      })
    ).toEqual({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: expected });
  });

  test.each([
    ['eleven fractional digits', '1.00000000000'],
    ['twenty-nine integral digits', '1'.repeat(29)],
  ])('rejects %s with the exact field path on write and read', (_case, value) => {
    const writeError = captureValidationError(() =>
      convertibleMechanismToDaml({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: value })
    );
    expect(writeError).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      receivedValue: value,
    });

    const readError = captureValidationError(() =>
      convertibleMechanismFromDaml({
        tag: 'OcfConvMechFixedAmount',
        value: { converts_to_quantity: value },
      })
    );
    expect(readError).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      receivedValue: value,
    });
  });
});

describe('DAML v34 conversion semantic ranges', () => {
  const cases: ReadonlyArray<{
    name: string;
    fieldPath: string;
    receivedValue: string;
    write: () => unknown;
    read: () => unknown;
  }> = [
    {
      name: 'SAFE discount below zero',
      fieldPath: 'conversion_mechanism.conversion_discount',
      receivedValue: '-0.01',
      write: () =>
        convertibleMechanismToDaml({
          type: 'SAFE_CONVERSION',
          conversion_mfn: false,
          conversion_discount: '-0.01',
        }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechSAFE',
          value: { conversion_mfn: false, conversion_discount: '-0.01' },
        }),
    },
    {
      name: 'SAFE discount at one',
      fieldPath: 'conversion_mechanism.conversion_discount',
      receivedValue: '1',
      write: () =>
        convertibleMechanismToDaml({ type: 'SAFE_CONVERSION', conversion_mfn: false, conversion_discount: '1' }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechSAFE',
          value: { conversion_mfn: false, conversion_discount: '1' },
        }),
    },
    {
      name: 'note rate above one',
      fieldPath: 'conversion_mechanism.interest_rates.0.rate',
      receivedValue: '1.0001',
      write: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '1.0001', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
        }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechNote',
          value: {
            ...NOTE_VALUE,
            interest_rates: [{ ...NOTE_VALUE.interest_rates[0], rate: '1.0001' }],
          },
        }),
    },
    {
      name: 'note discount below zero',
      fieldPath: 'conversion_mechanism.conversion_discount',
      receivedValue: '-0.1',
      write: () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'ANNUAL',
          compounding_type: 'SIMPLE',
          conversion_discount: '-0.1',
        }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechNote',
          value: { ...NOTE_VALUE, conversion_discount: '-0.1' },
        }),
    },
    {
      name: 'fixed amount at zero',
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      receivedValue: '0',
      write: () => convertibleMechanismToDaml({ type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '0' }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechFixedAmount',
          value: { converts_to_quantity: '0' },
        }),
    },
    {
      name: 'capitalization percentage at zero',
      fieldPath: 'conversion_mechanism.converts_to_percent',
      receivedValue: '0',
      write: () =>
        convertibleMechanismToDaml({
          type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
          converts_to_percent: '0',
        }),
      read: () =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechPercentCapitalization',
          value: { converts_to_percent: '0', capitalization_definition: null, capitalization_definition_rules: null },
        }),
    },
    {
      name: 'PPS discount percentage above one',
      fieldPath: 'conversion_mechanism.discount_percentage',
      receivedValue: '1.1',
      write: () =>
        warrantMechanismToDaml({
          type: 'PPS_BASED_CONVERSION',
          description: 'Invalid discount',
          discount: true,
          discount_percentage: '1.1',
        }),
      read: () =>
        warrantMechanismFromDaml({
          tag: 'OcfWarrantMechanismPpsBased',
          value: {
            description: 'Invalid discount',
            discount: true,
            discount_percentage: '1.1',
            discount_amount: null,
          },
        }),
    },
    {
      name: 'ratio numerator below zero',
      fieldPath: 'conversion_mechanism.ratio.numerator',
      receivedValue: '-1',
      write: () =>
        ratioMechanismToDaml(
          {
            type: 'RATIO_CONVERSION',
            ratio: { numerator: '-1', denominator: '1' },
            conversion_price: { amount: '1', currency: 'USD' },
            rounding_type: 'NORMAL',
          },
          'conversion_mechanism'
        ),
      read: () =>
        ratioMechanismFromDaml(
          {
            conversion_mechanism: 'OcfConversionMechanismRatioConversion',
            ratio: { numerator: '-1', denominator: '1' },
            conversion_price: { amount: '1', currency: 'USD' },
          },
          'conversion_mechanism'
        ),
    },
    {
      name: 'ratio denominator at zero',
      fieldPath: 'conversion_mechanism.ratio.denominator',
      receivedValue: '0',
      write: () =>
        ratioMechanismToDaml(
          {
            type: 'RATIO_CONVERSION',
            ratio: { numerator: '1', denominator: '0' },
            conversion_price: { amount: '1', currency: 'USD' },
            rounding_type: 'NORMAL',
          },
          'conversion_mechanism'
        ),
      read: () =>
        ratioMechanismFromDaml(
          {
            conversion_mechanism: 'OcfConversionMechanismRatioConversion',
            ratio: { numerator: '1', denominator: '0' },
            conversion_price: { amount: '1', currency: 'USD' },
          },
          'conversion_mechanism'
        ),
    },
    {
      name: 'monetary amount below zero',
      fieldPath: 'conversion_mechanism.valuation_amount.amount',
      receivedValue: '-0.01',
      write: () =>
        warrantMechanismToDaml({
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'ACTUAL',
          valuation_amount: { amount: '-0.01', currency: 'USD' },
        }),
      read: () =>
        warrantMechanismFromDaml({
          tag: 'OcfWarrantMechanismValuationBased',
          value: {
            valuation_type: 'ACTUAL',
            valuation_amount: { amount: '-0.01', currency: 'USD' },
            capitalization_definition: null,
            capitalization_definition_rules: null,
          },
        }),
    },
  ];

  test.each(cases)('rejects $name on write with exact diagnostics', ({ write, fieldPath, receivedValue }) => {
    expect(captureValidationError(write)).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath,
      receivedValue,
    });
  });

  test.each(cases)('rejects $name on read with exact diagnostics', ({ read, fieldPath, receivedValue }) => {
    expect(captureValidationError(read)).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath,
      receivedValue,
    });
  });

  it('accepts the precise inclusive and exclusive boundary endpoints', () => {
    expect(
      convertibleMechanismToDaml({ type: 'SAFE_CONVERSION', conversion_mfn: false, conversion_discount: '0' })
    ).toBeDefined();
    expect(
      convertibleMechanismToDaml({
        type: 'CONVERTIBLE_NOTE_CONVERSION',
        interest_rates: [
          { rate: '0', accrual_start_date: '2026-01-01' },
          { rate: '1', accrual_start_date: '2026-02-01' },
        ],
        day_count_convention: 'ACTUAL_365',
        interest_payout: 'DEFERRED',
        interest_accrual_period: 'ANNUAL',
        compounding_type: 'SIMPLE',
      })
    ).toBeDefined();
    expect(
      warrantMechanismToDaml({
        type: 'PPS_BASED_CONVERSION',
        description: 'Full price reduction boundary',
        discount: true,
        discount_percentage: '1',
      })
    ).toBeDefined();
  });
});

describe('canonical monetary, valuation, and mechanism roots', () => {
  test.each(['usd', 'US', 'USDD', '12$'])('rejects currency %p on both write and read', (currency) => {
    const writeError = captureValidationError(() =>
      warrantMechanismToDaml({
        type: 'VALUATION_BASED_CONVERSION',
        valuation_type: 'ACTUAL',
        valuation_amount: { amount: '1', currency },
      })
    );
    expect(writeError).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.valuation_amount.currency',
      receivedValue: currency,
    });

    const readError = captureValidationError(() =>
      warrantMechanismFromDaml({
        tag: 'OcfWarrantMechanismValuationBased',
        value: {
          valuation_type: 'ACTUAL',
          valuation_amount: { amount: '1', currency },
          capitalization_definition: null,
          capitalization_definition_rules: null,
        },
      })
    );
    expect(readError).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.valuation_amount.currency',
      receivedValue: currency,
    });
  });

  test.each(['CAP', 'FIXED', 'ACTUAL'] as const)(
    'requires valuation_amount for %s on write and read',
    (valuationType) => {
      const writeError = captureValidationError(() =>
        warrantMechanismToDaml({
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: valuationType,
        } as unknown as WarrantConversionMechanism)
      );
      expect(writeError).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'conversion_mechanism.valuation_amount',
        receivedValue: undefined,
      });

      const readError = captureValidationError(() =>
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
      expect(readError).toMatchObject({
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'conversion_mechanism.valuation_amount',
        receivedValue: null,
      });
    }
  );

  it('rejects blank capitalization definitions on read', () => {
    const error = captureValidationError(() =>
      convertibleMechanismFromDaml({
        tag: 'OcfConvMechSAFE',
        value: { conversion_mfn: false, capitalization_definition: '   ' },
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'conversion_mechanism.capitalization_definition',
      receivedValue: '   ',
    });
  });

  test.each([
    ['convertible writer', () => convertibleMechanismToDaml(null as unknown as ConvertibleConversionMechanism)],
    ['convertible reader', () => convertibleMechanismFromDaml(null)],
    ['warrant writer', () => warrantMechanismToDaml(null as unknown as WarrantConversionMechanism)],
    ['warrant reader', () => warrantMechanismFromDaml(null)],
    ['ratio writer', () => ratioMechanismToDaml(null as unknown as PersistedStockClassRatioConversionMechanism)],
  ])('classifies a missing %s mechanism root as required', (_name, action) => {
    expect(captureValidationError(action)).toMatchObject({ code: OcpErrorCodes.REQUIRED_FIELD_MISSING });
  });

  it('rejects JavaScript numbers for generated DAML Numeric fields', () => {
    expect(
      captureValidationError(() =>
        convertibleMechanismFromDaml({
          tag: 'OcfConvMechFixedAmount',
          value: { converts_to_quantity: 10 },
        })
      )
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'conversion_mechanism.converts_to_quantity',
      receivedValue: 10,
    });
  });
});

const CONVERTIBLE_INPUT = {
  id: 'convertible-cardinality',
  date: '2026-01-01',
  security_id: 'convertible-security',
  custom_id: 'SAFE-1',
  stakeholder_id: 'stakeholder-1',
  investment_amount: { amount: '100', currency: 'USD' },
  convertible_type: 'SAFE' as const,
  conversion_triggers: [
    {
      type: 'ELECTIVE_AT_WILL' as const,
      trigger_id: 'trigger-1',
      conversion_right: {
        type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
        conversion_mechanism: { type: 'SAFE_CONVERSION' as const, conversion_mfn: false },
      },
    },
  ] as const,
  seniority: 1,
  security_law_exemptions: [],
};

describe('generated DAML Numeric wire representation', () => {
  it('rejects raw scalar and JavaScript-number initial-shares compatibility shapes', () => {
    const stock = stockClassDataToDaml(STOCK_CLASS_INPUT);

    expect(
      captureValidationError(() => damlStockClassDataToNative({ ...stock, initial_shares_authorized: '1000000' }))
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'stockClass.initial_shares_authorized',
      receivedValue: '1000000',
    });
    expect(
      captureValidationError(() =>
        damlStockClassDataToNative({
          ...stock,
          initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: 1000000 },
        })
      )
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'stockClass.initial_shares_authorized.value',
      receivedValue: 1000000,
    });
  });

  it('rejects JavaScript numbers across issuance and stock-class Numeric readers', () => {
    const convertible = convertibleIssuanceDataToDaml(
      CONVERTIBLE_INPUT as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]
    );
    expect(
      captureValidationError(() =>
        damlConvertibleIssuanceDataToNative({
          ...convertible,
          investment_amount: { amount: 100, currency: 'USD' },
        })
      )
    ).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.investment_amount.amount',
      receivedValue: 100,
    });

    const warrant = warrantIssuanceDataToDaml({
      id: 'numeric-wire-warrant',
      date: '2026-01-01',
      security_id: 'warrant-security',
      custom_id: 'W-NUMERIC',
      stakeholder_id: 'stakeholder-1',
      purchase_price: { amount: '1', currency: 'USD' },
      security_law_exemptions: [],
      quantity: '10',
      exercise_triggers: [],
      vestings: [{ date: '2026-02-01', amount: '1' }],
    });
    for (const [payload, fieldPath, receivedValue] of [
      [{ ...warrant, purchase_price: { amount: 1, currency: 'USD' } }, 'warrantIssuance.purchase_price.amount', 1],
      [{ ...warrant, quantity: 10 }, 'warrantIssuance.quantity', 10],
      [
        { ...warrant, vestings: [{ date: '2026-02-01T00:00:00.000Z', amount: 1 }] },
        'warrantIssuance.vestings.0.amount',
        1,
      ],
    ] as const) {
      expect(captureValidationError(() => damlWarrantIssuanceDataToNative(payload))).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath,
        receivedValue,
      });
    }

    const stock = stockClassDataToDaml(STOCK_CLASS_INPUT);
    expect(captureValidationError(() => damlStockClassDataToNative({ ...stock, votes_per_share: 1 }))).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'stockClass.votes_per_share',
      receivedValue: 1,
    });
  });

  it('rejects the non-generated tagged ratio-mechanism object', () => {
    const tagged = { tag: 'OcfConversionMechanismRatioConversion' };
    const error = captureValidationError(() =>
      ratioMechanismFromDaml(
        {
          conversion_mechanism: tagged,
          ratio: { numerator: '1', denominator: '1' },
          conversion_price: { amount: '1', currency: 'USD' },
        },
        'conversion_mechanism'
      )
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'conversion_mechanism.type',
      receivedValue: tagged,
    });
  });
});

describe('non-empty collection boundaries', () => {
  it('rejects empty convertible conversion_triggers on write and read', () => {
    const writeError = captureValidationError(() =>
      convertibleIssuanceDataToDaml({ ...CONVERTIBLE_INPUT, conversion_triggers: [] } as never)
    );
    expect(writeError).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'convertibleIssuance.conversion_triggers',
      receivedValue: [],
    });

    const encoded = convertibleIssuanceDataToDaml(
      CONVERTIBLE_INPUT as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]
    );
    const readError = captureValidationError(() =>
      damlConvertibleIssuanceDataToNative({ ...encoded, conversion_triggers: [] })
    );
    expect(readError).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'convertibleIssuance.conversion_triggers',
      receivedValue: [],
    });
  });

  it('accepts empty note interest_rates on write and read', () => {
    const encoded = convertibleMechanismToDaml({
      type: 'CONVERTIBLE_NOTE_CONVERSION',
      interest_rates: [],
      day_count_convention: 'ACTUAL_365',
      interest_payout: 'DEFERRED',
      interest_accrual_period: 'ANNUAL',
      compounding_type: 'SIMPLE',
    });
    expect(encoded).toMatchObject({ tag: 'OcfConvMechNote', value: { interest_rates: [] } });

    expect(
      convertibleMechanismFromDaml({ tag: 'OcfConvMechNote', value: { ...NOTE_VALUE, interest_rates: [] } })
    ).toMatchObject({ type: 'CONVERTIBLE_NOTE_CONVERSION', interest_rates: [] });
  });

  it('rejects explicitly empty warrant vestings on write while decoding DAML [] as omission', () => {
    const input = {
      id: 'warrant-cardinality',
      date: '2026-01-01',
      security_id: 'warrant-security',
      custom_id: 'W-1',
      stakeholder_id: 'stakeholder-1',
      purchase_price: { amount: '1', currency: 'USD' },
      security_law_exemptions: [],
      exercise_triggers: [],
    };
    const writeError = captureValidationError(() => warrantIssuanceDataToDaml({ ...input, vestings: [] } as never));
    expect(writeError).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'warrantIssuance.vestings',
      receivedValue: [],
    });

    const decoded = damlWarrantIssuanceDataToNative(warrantIssuanceDataToDaml(input));
    expect(decoded).not.toHaveProperty('vestings');
  });
});

describe('canonical warrant convertible rights', () => {
  it('round-trips the APIv2 CONVERTIBLE_CONVERSION_RIGHT + SAFE shape', () => {
    const input = {
      id: 'warrant-safe',
      date: '2026-01-01',
      security_id: 'warrant-security',
      custom_id: 'W-SAFE-1',
      stakeholder_id: 'stakeholder-1',
      purchase_price: { amount: '100', currency: 'USD' },
      security_law_exemptions: [],
      exercise_triggers: [
        {
          type: 'AUTOMATIC_ON_CONDITION' as const,
          trigger_id: 'safe-conversion',
          trigger_condition: 'qualified financing closes',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
            conversion_mechanism: {
              type: 'SAFE_CONVERSION' as const,
              conversion_mfn: false,
              conversion_discount: '0.2',
            },
          },
        },
      ],
    };

    const encoded = warrantIssuanceDataToDaml(input);
    const encodedRight = requireFirst(encoded.exercise_triggers, 'encoded warrant trigger').conversion_right;
    expect(encodedRight).toMatchObject({
      tag: 'OcfRightConvertible',
      value: {
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: { tag: 'OcfConvMechSAFE', value: { conversion_mfn: false } },
      },
    });

    const decoded = damlWarrantIssuanceDataToNative(encoded);
    expect(requireFirst(decoded.exercise_triggers, 'decoded warrant trigger').conversion_right).toEqual(
      requireFirst(input.exercise_triggers, 'input warrant trigger').conversion_right
    );
  });
});

const INAPPLICABLE_FIELDS = [
  'ceiling_price_per_share',
  'custom_description',
  'discount_rate',
  'expires_at',
  'floor_price_per_share',
  'percent_of_capitalization',
  'reference_share_price',
  'reference_valuation_price_per_share',
  'valuation_cap',
] as const;

const STOCK_CLASS_INPUT: OcfStockClass = {
  object_type: 'STOCK_CLASS',
  id: 'series-a',
  name: 'Series A',
  class_type: 'PREFERRED',
  default_id_prefix: 'SA-',
  initial_shares_authorized: '1000000',
  votes_per_share: '1',
  seniority: '1',
  conversion_rights: [
    {
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      converts_to_stock_class_id: 'common',
      conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '1', denominator: '1' },
        conversion_price: { amount: '1', currency: 'USD' },
        rounding_type: 'NORMAL',
      },
    },
  ],
};

describe('DAML v34 stock-class nonnegative ranges', () => {
  test.each(['votes_per_share', 'seniority', 'liquidation_preference_multiple', 'participation_cap_multiple'] as const)(
    'rejects negative %s on write with the exact field path',
    (field) => {
      const value = '-0.1';
      const error = captureValidationError(() => stockClassDataToDaml({ ...STOCK_CLASS_INPUT, [field]: value }));
      expect(error).toMatchObject({
        code: OcpErrorCodes.OUT_OF_RANGE,
        fieldPath: `stockClass.${field}`,
        receivedValue: value,
      });
    }
  );

  test.each([
    ['votes_per_share', 'stockClass.votes_per_share'],
    ['seniority', 'stockClass.seniority'],
    ['liquidation_preference_multiple', 'stockClass.liquidation_preference_multiple'],
    ['participation_cap_multiple', 'stockClass.participation_cap_multiple'],
  ] as const)('rejects negative %s on read with the exact field path', (field, fieldPath) => {
    const value = '-0.1';
    const encoded = stockClassDataToDaml(STOCK_CLASS_INPUT);
    const error = captureValidationError(() => damlStockClassDataToNative({ ...encoded, [field]: value }));
    expect(error).toMatchObject({ code: OcpErrorCodes.OUT_OF_RANGE, fieldPath, receivedValue: value });
  });

  it('rejects negative numeric initial_shares_authorized on read', () => {
    const value = '-1';
    const encoded = stockClassDataToDaml(STOCK_CLASS_INPUT);
    const error = captureValidationError(() =>
      damlStockClassDataToNative({
        ...encoded,
        initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value },
      })
    );
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      fieldPath: 'stockClass.initial_shares_authorized.value',
      receivedValue: value,
    });
  });
});

function firstStockRight(payload: Record<string, unknown>): Record<string, unknown> {
  return requireFirst(payload.conversion_rights as Array<Record<string, unknown>>, 'stock-class conversion right');
}

function firstWarrantStockRight(payload: Record<string, unknown>): Record<string, unknown> {
  const trigger = requireFirst(
    payload.exercise_triggers as Array<Record<string, unknown>>,
    'warrant stock-class trigger'
  );
  const variant = trigger.conversion_right as { value: Record<string, unknown> };
  return variant.value;
}

describe('lossless stock-class storage sentinel decoding', () => {
  test.each(INAPPLICABLE_FIELDS)('StockClass rejects populated inapplicable field %s', (field) => {
    const payload = clone(stockClassDataToDaml(STOCK_CLASS_INPUT)) as unknown as Record<string, unknown>;
    const right = firstStockRight(payload);
    right[field] = 'unexpected';

    expect(captureValidationError(() => damlStockClassDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: `stockClass.conversion_rights.0.${field}`,
      receivedValue: 'unexpected',
    });
  });

  it('StockClass rejects a nested target that diverges from the enclosing right', () => {
    const payload = clone(stockClassDataToDaml(STOCK_CLASS_INPUT)) as unknown as Record<string, unknown>;
    const right = firstStockRight(payload);
    const nested = right.conversion_trigger as Record<string, unknown>;
    const variant = nested.conversion_right as { value: Record<string, unknown> };
    variant.value.converts_to_stock_class_id = 'different-class';

    expect(captureValidationError(() => damlStockClassDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'stockClass.conversion_rights.0.conversion_trigger.conversion_right.value.converts_to_stock_class_id',
      receivedValue: 'different-class',
    });
  });

  it('StockClass rejects a non-deterministic nested trigger id', () => {
    const payload = clone(stockClassDataToDaml(STOCK_CLASS_INPUT)) as unknown as Record<string, unknown>;
    const right = firstStockRight(payload);
    const nested = right.conversion_trigger as Record<string, unknown>;
    nested.trigger_id = 'wrong-id';

    expect(captureValidationError(() => damlStockClassDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'stockClass.conversion_rights.0.conversion_trigger.trigger_id',
      receivedValue: 'wrong-id',
    });
  });

  const warrantInput = {
    id: 'warrant-stock-class',
    date: '2026-01-01',
    security_id: 'warrant-security',
    custom_id: 'W-RATIO-1',
    stakeholder_id: 'stakeholder-1',
    purchase_price: { amount: '1', currency: 'USD' },
    security_law_exemptions: [],
    exercise_triggers: [
      {
        type: 'AUTOMATIC_ON_CONDITION' as const,
        trigger_id: 'conversion-event',
        trigger_condition: 'conversion approved',
        conversion_right: {
          type: 'STOCK_CLASS_CONVERSION_RIGHT' as const,
          converts_to_stock_class_id: 'common',
          conversion_mechanism: {
            type: 'RATIO_CONVERSION' as const,
            ratio: { numerator: '1', denominator: '1' },
            conversion_price: { amount: '1', currency: 'USD' },
            rounding_type: 'NORMAL' as const,
          },
        },
      },
    ],
  };

  test.each(INAPPLICABLE_FIELDS)('WarrantIssuance rejects populated inapplicable field %s', (field) => {
    const payload = clone(warrantIssuanceDataToDaml(warrantInput)) as unknown as Record<string, unknown>;
    const right = firstWarrantStockRight(payload);
    right[field] = 'unexpected';

    expect(captureValidationError(() => damlWarrantIssuanceDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: `warrantIssuance.exercise_triggers.0.conversion_right.value.${field}`,
      receivedValue: 'unexpected',
    });
  });

  it('WarrantIssuance rejects nested trigger fields that diverge from the enclosing trigger', () => {
    const payload = clone(warrantIssuanceDataToDaml(warrantInput)) as unknown as Record<string, unknown>;
    const right = firstWarrantStockRight(payload);
    const nested = right.conversion_trigger as Record<string, unknown>;
    nested.trigger_condition = 'different condition';

    expect(captureValidationError(() => damlWarrantIssuanceDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_trigger.trigger_condition',
      receivedValue: 'different condition',
    });
  });

  it('WarrantIssuance rejects a modified nested placeholder mechanism', () => {
    const payload = clone(warrantIssuanceDataToDaml(warrantInput)) as unknown as Record<string, unknown>;
    const right = firstWarrantStockRight(payload);
    const nested = right.conversion_trigger as Record<string, unknown>;
    const variant = nested.conversion_right as { value: Record<string, unknown> };
    const mechanism = variant.value.conversion_mechanism as { value: Record<string, unknown> };
    mechanism.value.custom_conversion_description = 'Not the storage sentinel';

    expect(captureValidationError(() => damlWarrantIssuanceDataToNative(payload))).toMatchObject({
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath:
        'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_trigger.conversion_right.value.conversion_mechanism.value.custom_conversion_description',
      receivedValue: 'Not the storage sentinel',
    });
  });
});
