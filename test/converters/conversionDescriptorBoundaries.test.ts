import { OcpError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import {
  convertibleIssuanceDataToDaml,
  type ConvertibleIssuanceInput,
} from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import {
  convertibleMechanismFromDaml,
  convertibleMechanismToDaml,
  warrantMechanismFromDaml,
  warrantMechanismToDaml,
} from '../../src/functions/OpenCapTable/shared/conversionMechanisms';
import { requireDenseArray } from '../../src/functions/OpenCapTable/shared/ocfValues';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import {
  warrantIssuanceDataToDaml,
  type WarrantIssuanceInput,
} from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import type {
  ConvertibleConversionMechanism,
  OcfStockClass,
  OcfStockClassConversionRatioAdjustment,
  PersistedWarrantConversionMechanism,
} from '../../src/types';

const PROXY_MODES = ['benign', 'throwing', 'revoked'] as const;
type ProxyMode = (typeof PROXY_MODES)[number];

interface ProxyFixture<T extends object> {
  readonly value: T;
  readonly trapCalls: () => number;
}

function proxyFixture<T extends object>(target: T, mode: ProxyMode): ProxyFixture<T> {
  let calls = 0;
  if (mode === 'revoked') {
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();
    return { value: revocable.proxy, trapCalls: () => calls };
  }

  const visit = (): void => {
    calls += 1;
    if (mode === 'throwing') throw new Error('Proxy trap must not execute');
  };
  const handler: ProxyHandler<T> = {
    get(targetValue, property, receiver) {
      visit();
      return Reflect.get(targetValue, property, receiver);
    },
    getOwnPropertyDescriptor(targetValue, property) {
      visit();
      return Reflect.getOwnPropertyDescriptor(targetValue, property);
    },
    getPrototypeOf(targetValue) {
      visit();
      return Reflect.getPrototypeOf(targetValue);
    },
    has(targetValue, property) {
      visit();
      return Reflect.has(targetValue, property);
    },
    ownKeys(targetValue) {
      visit();
      return Reflect.ownKeys(targetValue);
    },
  };
  return { value: new Proxy(target, handler), trapCalls: () => calls };
}

function captureError(action: () => unknown): OcpError {
  try {
    action();
  } catch (error) {
    if (error instanceof OcpError) return error;
    throw error;
  }
  throw new Error('Expected action to throw');
}

function expectBoundaryError(action: () => unknown, fieldPath: string): OcpValidationError {
  const error = captureError(action);
  expect(error).toBeInstanceOf(OcpValidationError);
  expect(error).toMatchObject({
    name: 'OcpValidationError',
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    fieldPath,
  });
  return error as OcpValidationError;
}

function expectProxyBoundary(action: () => unknown, fieldPath: string, fixture: ProxyFixture<object>): void {
  expectBoundaryError(action, fieldPath);
  expect(fixture.trapCalls()).toBe(0);
}

const RULES = {
  include_outstanding_shares: true,
  include_outstanding_options: false,
  include_outstanding_unissued_options: true,
  include_this_security: true,
  include_other_converting_securities: false,
  include_option_pool_topup_for_promised_options: true,
  include_additional_option_pool_topup: false,
  include_new_money: true,
};

const CONVERTIBLE_MECHANISMS: readonly ConvertibleConversionMechanism[] = [
  {
    type: 'SAFE_CONVERSION',
    conversion_mfn: false,
    conversion_discount: '0.2',
    conversion_valuation_cap: { amount: '10000000', currency: 'USD' },
    capitalization_definition_rules: RULES,
    exit_multiple: { numerator: '2', denominator: '1' },
  },
  {
    type: 'CONVERTIBLE_NOTE_CONVERSION',
    interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01' }],
    day_count_convention: 'ACTUAL_365',
    interest_payout: 'DEFERRED',
    interest_accrual_period: 'MONTHLY',
    compounding_type: 'SIMPLE',
  },
  { type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom conversion' },
  { type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION', converts_to_percent: '0.05' },
  { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '25000' },
];

const WARRANT_MECHANISMS: readonly PersistedWarrantConversionMechanism[] = [
  { type: 'CUSTOM_CONVERSION', custom_conversion_description: 'Custom exercise' },
  { type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION', converts_to_percent: '0.01' },
  { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' },
  {
    type: 'VALUATION_BASED_CONVERSION',
    valuation_type: 'CAP',
    valuation_amount: { amount: '10000000', currency: 'USD' },
  },
  { type: 'PPS_BASED_CONVERSION', description: 'Next financing price', discount: false },
];

function convertibleInput(
  mechanism: ConvertibleConversionMechanism = CONVERTIBLE_MECHANISMS[0] as ConvertibleConversionMechanism
): ConvertibleIssuanceInput {
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

function warrantInput(
  mechanism: PersistedWarrantConversionMechanism = WARRANT_MECHANISMS[0] as PersistedWarrantConversionMechanism
): WarrantIssuanceInput {
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

function stockClassInput(): OcfStockClass {
  return {
    object_type: 'STOCK_CLASS',
    id: 'preferred',
    name: 'Preferred',
    class_type: 'PREFERRED',
    default_id_prefix: 'PA-',
    initial_shares_authorized: '1000',
    votes_per_share: '1',
    seniority: '1',
    conversion_rights: [
      {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: '2', denominator: '1' },
          rounding_type: 'NORMAL',
        },
        converts_to_stock_class_id: 'common',
      },
    ],
  };
}

function ratioAdjustmentInput(): OcfStockClassConversionRatioAdjustment {
  return {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id: 'ratio-adjustment',
    date: '2026-01-01',
    stock_class_id: 'preferred',
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: { amount: '1', currency: 'USD' },
      ratio: { numerator: '2', denominator: '1' },
      rounding_type: 'NORMAL',
    },
  };
}

function maximumLengthSparseArray<T>(firstItem: T): T[] {
  const values = [firstItem];
  values.length = 0xffff_ffff;
  return values;
}

function nonEnumerableItemArray<T>(item: T): T[] {
  const values = [item];
  Object.defineProperty(values, '0', {
    configurable: true,
    enumerable: false,
    value: item,
    writable: true,
  });
  return values;
}

function expectArrayBoundary(action: () => unknown, fieldPath: string, code: string): void {
  expect(captureError(action)).toMatchObject({
    name: 'OcpValidationError',
    code,
    fieldPath,
  });
}

function convertibleDamlWithInterestRates(interestRates: unknown[]): Record<string, unknown> {
  const note = CONVERTIBLE_MECHANISMS[1] as ConvertibleConversionMechanism;
  const daml = convertibleIssuanceDataToDaml(convertibleInput(note)) as unknown as Record<string, unknown>;
  const triggers = daml.conversion_triggers as Array<Record<string, unknown>>;
  const trigger = triggers[0] as Record<string, unknown>;
  const right = trigger.conversion_right as Record<string, unknown>;
  const mechanism = right.conversion_mechanism as Record<string, unknown>;
  const mechanismValue = mechanism.value as Record<string, unknown>;
  return {
    ...daml,
    conversion_triggers: [
      {
        ...trigger,
        conversion_right: {
          ...right,
          conversion_mechanism: {
            ...mechanism,
            value: { ...mechanismValue, interest_rates: interestRates },
          },
        },
      },
    ],
  };
}

function stockClassDamlWithConversionRights(conversionRights: unknown[]): Record<string, unknown> {
  return {
    ...(stockClassDataToDaml(stockClassInput()) as unknown as Record<string, unknown>),
    conversion_rights: conversionRights,
  };
}

describe.each([
  [
    'ConvertibleIssuance',
    convertibleInput,
    'convertibleIssuance',
    (data: unknown) => convertibleIssuanceDataToDaml(data as ConvertibleIssuanceInput),
    (data: unknown) => convertToDaml('convertibleIssuance', data as never),
    'conversion_triggers',
  ],
  [
    'WarrantIssuance',
    warrantInput,
    'warrantIssuance',
    (data: unknown) => warrantIssuanceDataToDaml(data as WarrantIssuanceInput),
    (data: unknown) => convertToDaml('warrantIssuance', data as never),
    'exercise_triggers',
  ],
] as const)('%s descriptor-first writer boundaries', (_name, makeInput, rootPath, direct, generic, triggerKey) => {
  it.each(PROXY_MODES)('rejects %s root and nested mechanism Proxies without invoking traps', (mode) => {
    for (const write of [direct, generic]) {
      const root = proxyFixture(makeInput(), mode);
      expectProxyBoundary(() => write(root.value), rootPath, root);

      const input = makeInput() as unknown as Record<string, unknown>;
      const triggers = input[triggerKey] as Array<Record<string, unknown>>;
      const trigger = triggers[0] as Record<string, unknown>;
      const right = trigger.conversion_right as Record<string, unknown>;
      const mechanism = proxyFixture(right.conversion_mechanism as object, mode);
      const nested = {
        ...input,
        [triggerKey]: [
          {
            ...trigger,
            conversion_right: { ...right, conversion_mechanism: mechanism.value },
          },
        ],
      };
      expectProxyBoundary(
        () => write(nested),
        `${rootPath}.${triggerKey}.0.conversion_right.conversion_mechanism`,
        mechanism
      );
    }
  });

  it('rejects an accessor-backed nested record without invoking the getter', () => {
    for (const write of [direct, generic]) {
      let getterCalls = 0;
      const input = makeInput() as unknown as Record<string, unknown>;
      const triggers = input[triggerKey] as Array<Record<string, unknown>>;
      const trigger = { ...(triggers[0] as Record<string, unknown>) };
      Object.defineProperty(trigger, 'conversion_right', {
        configurable: true,
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error('getter must not execute');
        },
      });
      expectBoundaryError(
        () => write({ ...input, [triggerKey]: [trigger] }),
        `${rootPath}.${triggerKey}.0.conversion_right`
      );
      expect(getterCalls).toBe(0);
    }
  });
});

describe('exact conversion mechanism writer shapes', () => {
  it.each(CONVERTIBLE_MECHANISMS)('rejects an extra field on convertible variant $type', (mechanism) => {
    expectBoundaryError(
      () => convertibleMechanismToDaml({ ...mechanism, future: true } as never),
      'conversion_mechanism.future'
    );
  });

  it.each(WARRANT_MECHANISMS)('rejects an extra field on warrant variant $type', (mechanism) => {
    expectBoundaryError(
      () => warrantMechanismToDaml({ ...mechanism, future: true } as never),
      'conversion_mechanism.future'
    );
  });

  it.each([
    [
      'Monetary',
      {
        type: 'SAFE_CONVERSION',
        conversion_mfn: false,
        conversion_valuation_cap: { amount: '100', currency: 'USD', future: true },
      },
      'conversion_mechanism.conversion_valuation_cap.future',
    ],
    [
      'Ratio',
      {
        type: 'SAFE_CONVERSION',
        conversion_mfn: false,
        exit_multiple: { numerator: '2', denominator: '1', future: true },
      },
      'conversion_mechanism.exit_multiple.future',
    ],
    [
      'capitalization rules',
      { type: 'SAFE_CONVERSION', conversion_mfn: false, capitalization_definition_rules: { ...RULES, future: true } },
      'conversion_mechanism.capitalization_definition_rules.future',
    ],
    [
      'interest rate',
      {
        type: 'CONVERTIBLE_NOTE_CONVERSION',
        interest_rates: [{ rate: '0.08', accrual_start_date: '2026-01-01', future: true }],
        day_count_convention: 'ACTUAL_365',
        interest_payout: 'DEFERRED',
        interest_accrual_period: 'MONTHLY',
        compounding_type: 'SIMPLE',
      },
      'conversion_mechanism.interest_rates.0.future',
    ],
  ] as const)('rejects an extra nested %s field', (_name, mechanism, fieldPath) => {
    expectBoundaryError(() => convertibleMechanismToDaml(mechanism as never), fieldPath);
  });

  it('rejects non-enumerable, accessor-backed, and custom-prototype mechanisms', () => {
    const hidden = { type: 'SAFE_CONVERSION' } as Record<string, unknown>;
    Object.defineProperty(hidden, 'conversion_mfn', { configurable: true, enumerable: false, value: false });
    expectBoundaryError(() => convertibleMechanismToDaml(hidden as never), 'conversion_mechanism.conversion_mfn');

    let getterCalls = 0;
    const accessor = { type: 'SAFE_CONVERSION' } as Record<string, unknown>;
    Object.defineProperty(accessor, 'conversion_mfn', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error('getter must not execute');
      },
    });
    expectBoundaryError(() => convertibleMechanismToDaml(accessor as never), 'conversion_mechanism.conversion_mfn');
    expect(getterCalls).toBe(0);

    const inherited = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, {
      type: 'SAFE_CONVERSION',
      conversion_mfn: false,
    });
    expectBoundaryError(() => convertibleMechanismToDaml(inherited as never), 'conversion_mechanism');
  });
});

describe('exact issuance writer shapes before generic schema parsing', () => {
  it.each([
    [
      'convertible root',
      (data: unknown) => convertibleIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('convertibleIssuance', data as never),
      { ...convertibleInput(), future: true },
      'convertibleIssuance.future',
    ],
    [
      'convertible trigger',
      (data: unknown) => convertibleIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('convertibleIssuance', data as never),
      {
        ...convertibleInput(),
        conversion_triggers: [{ ...convertibleInput().conversion_triggers[0], future: true }],
      },
      'convertibleIssuance.conversion_triggers.0.future',
    ],
    [
      'convertible right',
      (data: unknown) => convertibleIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('convertibleIssuance', data as never),
      {
        ...convertibleInput(),
        conversion_triggers: [
          {
            ...convertibleInput().conversion_triggers[0],
            conversion_right: {
              ...convertibleInput().conversion_triggers[0].conversion_right,
              future: true,
            },
          },
        ],
      },
      'convertibleIssuance.conversion_triggers.0.conversion_right.future',
    ],
    [
      'convertible exemption',
      (data: unknown) => convertibleIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('convertibleIssuance', data as never),
      {
        ...convertibleInput(),
        security_law_exemptions: [{ description: 'Regulation D', jurisdiction: 'US', future: true }],
      },
      'convertibleIssuance.security_law_exemptions.0.future',
    ],
    [
      'warrant root',
      (data: unknown) => warrantIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('warrantIssuance', data as never),
      { ...warrantInput(), future: true },
      'warrantIssuance.future',
    ],
    [
      'warrant vesting',
      (data: unknown) => warrantIssuanceDataToDaml(data as never),
      (data: unknown) => convertToDaml('warrantIssuance', data as never),
      { ...warrantInput(), vestings: [{ date: '2026-02-01', amount: '1', future: true }] },
      'warrantIssuance.vestings.0.future',
    ],
  ] as const)(
    'rejects an extra field on the %s through direct and generic paths',
    (_name, direct, generic, input, path) => {
      expectBoundaryError(() => direct(input), path);
      expectBoundaryError(() => generic(input), path);
    }
  );
});

describe('stock-class and adjustment descriptor boundaries', () => {
  it.each(PROXY_MODES)('rejects a %s stock-class conversion-right Proxy without invoking traps', (mode) => {
    for (const write of [
      (data: unknown) => stockClassDataToDaml(data as OcfStockClass),
      (data: unknown) => convertToDaml('stockClass', data as OcfStockClass),
    ]) {
      const input = stockClassInput();
      const right = proxyFixture(input.conversion_rights?.[0] as object, mode);
      expectProxyBoundary(
        () => write({ ...input, conversion_rights: [right.value] }),
        'stockClass.conversion_rights.0',
        right
      );
    }
  });

  it('rejects a stock-class conversion-right accessor without invoking it', () => {
    let getterCalls = 0;
    const right = { ...stockClassInput().conversion_rights?.[0] } as Record<string, unknown>;
    Object.defineProperty(right, 'conversion_mechanism', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error('getter must not execute');
      },
    });
    expectBoundaryError(
      () => stockClassDataToDaml({ ...stockClassInput(), conversion_rights: [right] } as never),
      'stockClass.conversion_rights.0.conversion_mechanism'
    );
    expect(getterCalls).toBe(0);
  });

  it.each([
    ['direct', (data: unknown) => stockClassConversionRatioAdjustmentDataToDaml(data as never)],
    ['generic', (data: unknown) => convertToDaml('stockClassConversionRatioAdjustment', data as never)],
  ] as const)('rejects a non-enumerable comments property through the %s adjustment writer', (_name, write) => {
    const input = ratioAdjustmentInput() as unknown as Record<string, unknown>;
    Object.defineProperty(input, 'comments', { configurable: true, enumerable: false, value: ['hidden'] });
    expectBoundaryError(() => write(input), 'stockClassConversionRatioAdjustment.comments');
  });
});

describe('descriptor-first generated DAML readers', () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly fieldPath: string;
    readonly build: () => unknown;
    readonly direct: (value: unknown) => unknown;
    readonly generic: (value: unknown) => unknown;
  }> = [
    {
      name: 'ConvertibleIssuance',
      fieldPath: 'convertibleIssuance',
      build: () => convertibleIssuanceDataToDaml(convertibleInput()),
      direct: (value) => damlConvertibleIssuanceDataToNative(value),
      generic: (value) => convertToOcf('convertibleIssuance', value as never),
    },
    {
      name: 'WarrantIssuance',
      fieldPath: 'warrantIssuance',
      build: () => warrantIssuanceDataToDaml(warrantInput()),
      direct: (value) => damlWarrantIssuanceDataToNative(value),
      generic: (value) => convertToOcf('warrantIssuance', value as never),
    },
    {
      name: 'StockClass',
      fieldPath: 'stockClass',
      build: () => stockClassDataToDaml(stockClassInput()),
      direct: (value) => damlStockClassDataToNative(value),
      generic: (value) => convertToOcf('stockClass', value as never),
    },
    {
      name: 'StockClassConversionRatioAdjustment',
      fieldPath: 'stockClassConversionRatioAdjustment',
      build: () => stockClassConversionRatioAdjustmentDataToDaml(ratioAdjustmentInput()),
      direct: (value) => damlStockClassConversionRatioAdjustmentToNative(value as never),
      generic: (value) => convertToOcf('stockClassConversionRatioAdjustment', value as never),
    },
  ];

  it.each(cases)('rejects root Proxies for $name without invoking traps', ({ fieldPath, build, direct, generic }) => {
    for (const read of [direct, generic]) {
      for (const mode of PROXY_MODES) {
        const root = proxyFixture(build() as object, mode);
        expectProxyBoundary(() => read(root.value), fieldPath, root);
      }
    }
  });

  it.each(cases)('rejects root accessors for $name without invoking them', ({ fieldPath, build, direct, generic }) => {
    for (const read of [direct, generic]) {
      let getterCalls = 0;
      const value = { ...(build() as Record<string, unknown>) };
      const [firstKey] = Object.keys(value);
      if (firstKey === undefined) throw new Error('Expected generated record fields');
      Object.defineProperty(value, firstKey, {
        configurable: true,
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error('getter must not execute');
        },
      });
      expectBoundaryError(() => read(value), `${fieldPath}.${firstKey}`);
      expect(getterCalls).toBe(0);
    }
  });

  it.each(cases)(
    'rejects non-enumerable, custom-prototype, cyclic, and BigInt $name records',
    ({ fieldPath, build, direct, generic }) => {
      for (const read of [direct, generic]) {
        const hidden = { ...(build() as Record<string, unknown>) };
        const [firstKey] = Object.keys(hidden);
        if (firstKey === undefined) throw new Error('Expected generated record fields');
        Object.defineProperty(hidden, firstKey, {
          configurable: true,
          enumerable: false,
          value: hidden[firstKey],
        });
        expectBoundaryError(() => read(hidden), `${fieldPath}.${firstKey}`);

        const customPrototype = { ...(build() as Record<string, unknown>) };
        Object.setPrototypeOf(customPrototype, { inherited: true });
        expectBoundaryError(() => read(customPrototype), fieldPath);

        const cyclic = { ...(build() as Record<string, unknown>) };
        cyclic.circular = cyclic;
        expectBoundaryError(() => read(cyclic), `${fieldPath}.circular`);

        const bigint = { ...(build() as Record<string, unknown>), future: 1n };
        expectBoundaryError(() => read(bigint), `${fieldPath}.future`);
      }
    }
  );

  it.each(PROXY_MODES)('rejects a %s nested generated mechanism Proxy without invoking traps', (mode) => {
    const convertible = convertibleIssuanceDataToDaml(convertibleInput()) as unknown as Record<string, unknown>;
    const triggers = convertible.conversion_triggers as Array<Record<string, unknown>>;
    const trigger = triggers[0] as Record<string, unknown>;
    const right = trigger.conversion_right as Record<string, unknown>;
    const mechanism = proxyFixture(right.conversion_mechanism as object, mode);
    const value = {
      ...convertible,
      conversion_triggers: [{ ...trigger, conversion_right: { ...right, conversion_mechanism: mechanism.value } }],
    };
    expectProxyBoundary(
      () => damlConvertibleIssuanceDataToNative(value),
      'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism',
      mechanism
    );
  });

  it.each(PROXY_MODES)('rejects %s direct mechanism-reader Proxies without invoking traps', (mode) => {
    const convertible = proxyFixture(convertibleMechanismToDaml(CONVERTIBLE_MECHANISMS[0] as never), mode);
    expectProxyBoundary(() => convertibleMechanismFromDaml(convertible.value), 'conversion_mechanism', convertible);

    const warrant = proxyFixture(warrantMechanismToDaml(WARRANT_MECHANISMS[0] as never), mode);
    expectProxyBoundary(() => warrantMechanismFromDaml(warrant.value), 'conversion_mechanism', warrant);
  });
});

describe('bounded dense-array validation', () => {
  const noteInterestRatesPath =
    'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.interest_rates.1';
  const generatedNoteInterestRatesPath =
    'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.value.interest_rates.1';

  it('rejects maximum-length sparse nested writer arrays through direct and generic paths', () => {
    const normalNote = CONVERTIBLE_MECHANISMS[1] as ConvertibleConversionMechanism & {
      readonly interest_rates: readonly unknown[];
    };
    const note = { ...normalNote, interest_rates: maximumLengthSparseArray(normalNote.interest_rates[0]) };
    const convertible = convertibleInput(note as never);
    for (const write of [
      () => convertibleIssuanceDataToDaml(convertible),
      () => convertToDaml('convertibleIssuance', convertible as never),
    ]) {
      expectArrayBoundary(write, noteInterestRatesPath, OcpErrorCodes.REQUIRED_FIELD_MISSING);
    }

    const normalStockClass = stockClassInput();
    const right = normalStockClass.conversion_rights?.[0];
    if (right === undefined) throw new Error('Expected stock-class conversion right');
    const stockClass = { ...normalStockClass, conversion_rights: maximumLengthSparseArray(right) };
    for (const write of [() => stockClassDataToDaml(stockClass), () => convertToDaml('stockClass', stockClass)]) {
      expectArrayBoundary(write, 'stockClass.conversion_rights.1', OcpErrorCodes.REQUIRED_FIELD_MISSING);
    }
  });

  it('rejects non-enumerable nested writer array items through direct and generic paths', () => {
    const note = CONVERTIBLE_MECHANISMS[1] as ConvertibleConversionMechanism & {
      readonly interest_rates: readonly unknown[];
    };
    const convertible = convertibleInput({
      ...note,
      interest_rates: nonEnumerableItemArray(note.interest_rates[0]),
    } as never);
    for (const write of [
      () => convertibleIssuanceDataToDaml(convertible),
      () => convertToDaml('convertibleIssuance', convertible as never),
    ]) {
      expectArrayBoundary(
        write,
        'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.interest_rates.0',
        OcpErrorCodes.SCHEMA_MISMATCH
      );
    }

    const stockClass = stockClassInput();
    const right = stockClass.conversion_rights?.[0];
    if (right === undefined) throw new Error('Expected stock-class conversion right');
    const nonEnumerableRights = { ...stockClass, conversion_rights: nonEnumerableItemArray(right) };
    for (const write of [
      () => stockClassDataToDaml(nonEnumerableRights),
      () => convertToDaml('stockClass', nonEnumerableRights),
    ]) {
      expectArrayBoundary(write, 'stockClass.conversion_rights.0', OcpErrorCodes.SCHEMA_MISMATCH);
    }
  });

  it('rejects maximum-length sparse nested reader arrays through direct and generic paths', () => {
    const convertible = convertibleDamlWithInterestRates(maximumLengthSparseArray({}));
    for (const read of [
      () => damlConvertibleIssuanceDataToNative(convertible),
      () => convertToOcf('convertibleIssuance', convertible as never),
    ]) {
      expectArrayBoundary(read, generatedNoteInterestRatesPath, OcpErrorCodes.REQUIRED_FIELD_MISSING);
    }

    const encodedStockClass = stockClassDataToDaml(stockClassInput());
    const right = encodedStockClass.conversion_rights[0];
    if (right === undefined) throw new Error('Expected generated stock-class conversion right');
    const stockClass = stockClassDamlWithConversionRights(maximumLengthSparseArray(right));
    for (const read of [
      () => damlStockClassDataToNative(stockClass),
      () => convertToOcf('stockClass', stockClass as never),
    ]) {
      expectArrayBoundary(read, 'stockClass.conversion_rights.1', OcpErrorCodes.REQUIRED_FIELD_MISSING);
    }
  });

  it('rejects non-enumerable nested reader array items through direct and generic paths', () => {
    const note = CONVERTIBLE_MECHANISMS[1] as ConvertibleConversionMechanism & {
      readonly interest_rates: readonly unknown[];
    };
    const convertible = convertibleDamlWithInterestRates(nonEnumerableItemArray(note.interest_rates[0]));
    for (const read of [
      () => damlConvertibleIssuanceDataToNative(convertible),
      () => convertToOcf('convertibleIssuance', convertible as never),
    ]) {
      expectArrayBoundary(
        read,
        'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.value.interest_rates.0',
        OcpErrorCodes.SCHEMA_MISMATCH
      );
    }

    const encodedStockClass = stockClassDataToDaml(stockClassInput());
    const right = encodedStockClass.conversion_rights[0];
    if (right === undefined) throw new Error('Expected generated stock-class conversion right');
    const stockClass = stockClassDamlWithConversionRights(nonEnumerableItemArray(right));
    for (const read of [
      () => damlStockClassDataToNative(stockClass),
      () => convertToOcf('stockClass', stockClass as never),
    ]) {
      expectArrayBoundary(read, 'stockClass.conversion_rights.0', OcpErrorCodes.SCHEMA_MISMATCH);
    }
  });

  it('rejects non-enumerable items through the direct dense-array primitive', () => {
    expectArrayBoundary(
      () => requireDenseArray(nonEnumerableItemArray('item'), 'items'),
      'items.0',
      OcpErrorCodes.SCHEMA_MISMATCH
    );
  });
});

describe('globally bounded conversion diagnostics', () => {
  it('bounds huge property names, paths, messages, and serialized output', () => {
    const property = `future_${'x'.repeat(100_000)}`;
    const error = captureError(() =>
      convertibleMechanismToDaml({ ...CONVERTIBLE_MECHANISMS[0], [property]: true } as never)
    );
    expect(error).toBeInstanceOf(OcpValidationError);
    expect((error as OcpValidationError).fieldPath.length).toBeLessThanOrEqual(512);
    expect(error.message.length).toBeLessThanOrEqual(512);
    expect(JSON.stringify(error).length).toBeLessThan(8_192);
  });

  it('bounds huge unknown writer discriminators and generated reader tags', () => {
    const unknown = `FUTURE_${'x'.repeat(100_000)}`;
    const writerError = captureError(() => convertibleMechanismToDaml({ type: unknown } as never));
    expect(writerError).toBeInstanceOf(OcpParseError);
    expect(writerError.message.length).toBeLessThanOrEqual(512);
    expect(JSON.stringify(writerError).length).toBeLessThan(8_192);

    const readerError = captureError(() => convertibleMechanismFromDaml({ tag: unknown, value: {} }));
    expect(readerError).toBeInstanceOf(OcpParseError);
    expect(readerError.message.length).toBeLessThanOrEqual(512);
    expect(JSON.stringify(readerError).length).toBeLessThan(8_192);
  });

  it('serializes hostile context and custom error properties without getters, cycles, or unbounded keys', () => {
    let getterCalls = 0;
    const context: Record<string, unknown> = { huge: 'x'.repeat(100_000) };
    context.circular = context;
    Object.defineProperty(context, 'accessor', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error('getter must not execute');
      },
    });
    const error = new OcpError('x'.repeat(100_000), OcpErrorCodes.SCHEMA_MISMATCH, undefined, { context });
    Object.defineProperty(error, 'x'.repeat(100_000), {
      configurable: true,
      enumerable: true,
      value: 'x'.repeat(100_000),
    });

    const serialized = JSON.stringify(error);
    expect(getterCalls).toBe(0);
    expect(error.message.length).toBeLessThanOrEqual(512);
    expect(serialized.length).toBeLessThan(8_192);
    expect(() => JSON.parse(serialized) as unknown).not.toThrow();
  });
});
