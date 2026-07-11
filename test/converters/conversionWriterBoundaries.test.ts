import { OcpErrorCodes } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { damlConvertibleConversionToNative } from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import type { OcfConvertibleConversion, OcfStockClass, OcfStockClassConversionRatioAdjustment } from '../../src/types';

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to throw');
}

function expectBoundaryError(
  action: () => unknown,
  expected: { readonly code: string; readonly fieldPath: string; readonly receivedValue?: unknown }
): void {
  expect(captureError(action)).toMatchObject({ name: 'OcpValidationError', ...expected });
}

const RATIO_ADJUSTMENT: OcfStockClassConversionRatioAdjustment = {
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

const CONVERTIBLE_CONVERSION: OcfConvertibleConversion = {
  object_type: 'TX_CONVERTIBLE_CONVERSION',
  id: 'convertible-conversion',
  date: '2026-01-01',
  reason_text: 'Qualified financing',
  security_id: 'safe-security',
  trigger_id: 'qualified-financing',
  resulting_security_ids: ['preferred-security'],
};

const STOCK_CLASS: OcfStockClass = {
  object_type: 'STOCK_CLASS',
  id: 'preferred',
  name: 'Preferred',
  class_type: 'PREFERRED',
  default_id_prefix: 'PA-',
  initial_shares_authorized: '1000',
  votes_per_share: '1',
  seniority: '1',
};

describe.each([
  [
    'direct',
    (data: unknown) => stockClassConversionRatioAdjustmentDataToDaml(data as OcfStockClassConversionRatioAdjustment),
  ],
  [
    'generic convertToDaml',
    (data: unknown) =>
      convertToDaml('stockClassConversionRatioAdjustment', data as OcfStockClassConversionRatioAdjustment),
  ],
] as const)('ratio-adjustment %s writer boundary', (_name, write) => {
  it.each([
    ['undefined root', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING, 'stockClassConversionRatioAdjustment'],
    ['null root', null, OcpErrorCodes.INVALID_TYPE, 'stockClassConversionRatioAdjustment'],
    ['false root', false, OcpErrorCodes.INVALID_TYPE, 'stockClassConversionRatioAdjustment'],
    [
      'missing object_type',
      { ...RATIO_ADJUSTMENT, object_type: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.object_type',
    ],
    [
      'wrong object_type type',
      { ...RATIO_ADJUSTMENT, object_type: false },
      OcpErrorCodes.INVALID_TYPE,
      'stockClassConversionRatioAdjustment.object_type',
    ],
    [
      'unknown object_type',
      { ...RATIO_ADJUSTMENT, object_type: 'FUTURE' },
      OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      'stockClassConversionRatioAdjustment.object_type',
    ],
    [
      'missing date',
      { ...RATIO_ADJUSTMENT, date: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.date',
    ],
    [
      'null date',
      { ...RATIO_ADJUSTMENT, date: null },
      OcpErrorCodes.INVALID_TYPE,
      'stockClassConversionRatioAdjustment.date',
    ],
    [
      'missing mechanism',
      { ...RATIO_ADJUSTMENT, new_ratio_conversion_mechanism: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
    ],
    [
      'false mechanism',
      { ...RATIO_ADJUSTMENT, new_ratio_conversion_mechanism: false },
      OcpErrorCodes.INVALID_TYPE,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
    ],
  ] as const)('rejects %s without a raw runtime error', (_case, data, code, fieldPath) => {
    expectBoundaryError(() => write(data), { code, fieldPath });
  });

  it.each([
    ['missing', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['false', false, OcpErrorCodes.INVALID_TYPE],
    ['number', 1, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a %s ratio record', (_case, ratio, code) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            ratio,
          },
        }),
      {
        code,
        fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio',
      }
    );
  });

  it.each([
    ['missing', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['false', false, OcpErrorCodes.INVALID_TYPE],
    ['JavaScript number', 1, OcpErrorCodes.INVALID_TYPE],
    ['zero', '0', OcpErrorCodes.OUT_OF_RANGE],
    ['negative', '-1', OcpErrorCodes.OUT_OF_RANGE],
    ['eleven fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
    ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects a %s ratio denominator', (_case, denominator, code) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            ratio: { numerator: '2', denominator },
          },
        }),
      {
        code,
        fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.denominator',
        receivedValue: denominator,
      }
    );
  });

  it.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['false', false, OcpErrorCodes.INVALID_TYPE],
    ['JavaScript number', 1, OcpErrorCodes.INVALID_TYPE],
    ['negative', '-1', OcpErrorCodes.OUT_OF_RANGE],
    ['eleven fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
    ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects a %s conversion-price amount', (_case, amount, code) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            conversion_price: { amount, currency: 'USD' },
          },
        }),
      {
        code,
        fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.amount',
        receivedValue: amount,
      }
    );
  });

  it.each([
    ['missing conversion price', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null conversion price', null, OcpErrorCodes.INVALID_TYPE],
    ['false conversion price', false, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a %s record', (_case, conversionPrice, code) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            conversion_price: conversionPrice,
          },
        }),
      {
        code,
        fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price',
      }
    );
  });

  it.each([
    ['missing currency', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['null currency', null, OcpErrorCodes.INVALID_TYPE],
    ['false currency', false, OcpErrorCodes.INVALID_TYPE],
    ['lowercase currency', 'usd', OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects a %s', (_case, currency, code) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            conversion_price: { amount: '1', currency },
          },
        }),
      {
        code,
        fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.currency',
      }
    );
  });

  it.each([
    ['null mechanism type', { type: null }, OcpErrorCodes.INVALID_TYPE, 'type'],
    ['false mechanism type', { type: false }, OcpErrorCodes.INVALID_TYPE, 'type'],
    ['unknown mechanism type', { type: 'FUTURE' }, OcpErrorCodes.UNKNOWN_ENUM_VALUE, 'type'],
    ['null rounding type', { rounding_type: null }, OcpErrorCodes.INVALID_TYPE, 'rounding_type'],
    ['false rounding type', { rounding_type: false }, OcpErrorCodes.INVALID_TYPE, 'rounding_type'],
    ['unknown rounding type', { rounding_type: 'FUTURE' }, OcpErrorCodes.UNKNOWN_ENUM_VALUE, 'rounding_type'],
  ] as const)('rejects %s exactly', (_case, patch, code, suffix) => {
    expectBoundaryError(
      () =>
        write({
          ...RATIO_ADJUSTMENT,
          new_ratio_conversion_mechanism: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
            ...patch,
          },
        }),
      {
        code,
        fieldPath: `stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.${suffix}`,
      }
    );
  });

  it.each([
    ['null comments', null, OcpErrorCodes.INVALID_TYPE, 'stockClassConversionRatioAdjustment.comments'],
    ['false comments', false, OcpErrorCodes.INVALID_TYPE, 'stockClassConversionRatioAdjustment.comments'],
    [
      'sparse comments',
      new Array(1),
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.comments.0',
    ],
    ['numeric comment', [1], OcpErrorCodes.INVALID_TYPE, 'stockClassConversionRatioAdjustment.comments.0'],
  ] as const)('rejects %s without discarding it', (_case, comments, code, fieldPath) => {
    expectBoundaryError(() => write({ ...RATIO_ADJUSTMENT, comments }), { code, fieldPath });
  });

  it.each([
    ['root', { ...RATIO_ADJUSTMENT, future: true }, 'stockClassConversionRatioAdjustment.future'],
    [
      'board approval',
      { ...RATIO_ADJUSTMENT, board_approval_date: '2025-12-01' },
      'stockClassConversionRatioAdjustment.board_approval_date',
    ],
    [
      'stockholder approval',
      { ...RATIO_ADJUSTMENT, stockholder_approval_date: '2025-12-15' },
      'stockClassConversionRatioAdjustment.stockholder_approval_date',
    ],
    [
      'mechanism',
      {
        ...RATIO_ADJUSTMENT,
        new_ratio_conversion_mechanism: {
          ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
          future: true,
        },
      },
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.future',
    ],
    [
      'ratio',
      {
        ...RATIO_ADJUSTMENT,
        new_ratio_conversion_mechanism: {
          ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
          ratio: { ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism.ratio, future: true },
        },
      },
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.future',
    ],
    [
      'monetary',
      {
        ...RATIO_ADJUSTMENT,
        new_ratio_conversion_mechanism: {
          ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
          conversion_price: {
            ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism.conversion_price,
            future: true,
          },
        },
      },
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.conversion_price.future',
    ],
  ] as const)('rejects an extra %s field instead of dropping it', (_case, data, fieldPath) => {
    expectBoundaryError(() => write(data), { code: OcpErrorCodes.SCHEMA_MISMATCH, fieldPath });
  });

  it('rejects accessor-backed input fields without invoking them', () => {
    const data = { ...RATIO_ADJUSTMENT } as Record<string, unknown>;
    Object.defineProperty(data, 'new_ratio_conversion_mechanism', {
      enumerable: true,
      get: () => {
        throw new Error('must not execute');
      },
    });
    expectBoundaryError(() => write(data), {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
    });
  });

  it('canonicalizes valid values and round-trips every persisted field', () => {
    const daml = write({
      ...RATIO_ADJUSTMENT,
      new_ratio_conversion_mechanism: {
        ...RATIO_ADJUSTMENT.new_ratio_conversion_mechanism,
        conversion_price: { amount: '+000.0000000000', currency: 'USD' },
        ratio: { numerator: '+003.0000000000', denominator: '02.0000000000' },
        rounding_type: 'FLOOR',
      },
      comments: ['', 'kept verbatim'],
    }) as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0];

    expect(daml).toMatchObject({
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '0', currency: 'USD' },
        ratio: { numerator: '3', denominator: '2' },
        rounding_type: 'OcfRoundingFloor',
      },
      comments: ['', 'kept verbatim'],
    });
    expect(damlStockClassConversionRatioAdjustmentToNative(daml)).toMatchObject({
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '0', currency: 'USD' },
        ratio: { numerator: '3', denominator: '2' },
        rounding_type: 'FLOOR',
      },
      comments: ['', 'kept verbatim'],
    });
  });

  it('treats an explicitly undefined optional comments field as absent', () => {
    expect((write({ ...RATIO_ADJUSTMENT, comments: undefined }) as { comments: unknown }).comments).toEqual([]);
  });
});

describe.each([
  ['direct', (data: unknown) => convertibleConversionDataToDaml(data as OcfConvertibleConversion)],
  [
    'generic convertToDaml',
    (data: unknown) => convertToDaml('convertibleConversion', data as OcfConvertibleConversion),
  ],
] as const)('ConvertibleConversion %s writer boundary', (_name, write) => {
  it.each([
    ['undefined root', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING, 'convertibleConversion'],
    ['null root', null, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion'],
    ['false root', false, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion'],
    [
      'missing object_type',
      { ...CONVERTIBLE_CONVERSION, object_type: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.object_type',
    ],
    [
      'wrong object_type type',
      { ...CONVERTIBLE_CONVERSION, object_type: false },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.object_type',
    ],
    [
      'unknown object_type',
      { ...CONVERTIBLE_CONVERSION, object_type: 'FUTURE' },
      OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      'convertibleConversion.object_type',
    ],
    [
      'missing id',
      { ...CONVERTIBLE_CONVERSION, id: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.id',
    ],
    ['null id', { ...CONVERTIBLE_CONVERSION, id: null }, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.id'],
    [
      'false reason',
      { ...CONVERTIBLE_CONVERSION, reason_text: false },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.reason_text',
    ],
    [
      'null reason',
      { ...CONVERTIBLE_CONVERSION, reason_text: null },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.reason_text',
    ],
    [
      'missing security',
      { ...CONVERTIBLE_CONVERSION, security_id: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.security_id',
    ],
    [
      'numeric trigger',
      { ...CONVERTIBLE_CONVERSION, trigger_id: 1 },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.trigger_id',
    ],
  ] as const)('rejects %s with an exact structured error', (_case, data, code, fieldPath) => {
    expectBoundaryError(() => write(data), { code, fieldPath });
  });

  it.each([
    ['missing', undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING, 'convertibleConversion.resulting_security_ids'],
    ['null', null, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.resulting_security_ids'],
    ['false', false, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.resulting_security_ids'],
    ['number', 1, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.resulting_security_ids'],
    ['sparse', new Array(1), OcpErrorCodes.REQUIRED_FIELD_MISSING, 'convertibleConversion.resulting_security_ids.0'],
    ['numeric element', [1], OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.resulting_security_ids.0'],
  ] as const)('rejects %s resulting_security_ids', (_case, value, code, fieldPath) => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, resulting_security_ids: value }), {
      code,
      fieldPath,
    });
  });

  it.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.capitalization_definition'],
    ['false', false, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.capitalization_definition'],
    [
      'missing include_stock_class_ids',
      { include_stock_plans_ids: [], include_security_ids: [], exclude_security_ids: [] },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.capitalization_definition.include_stock_class_ids',
    ],
    [
      'false include_stock_class_ids',
      {
        include_stock_class_ids: false,
        include_stock_plans_ids: [],
        include_security_ids: [],
        exclude_security_ids: [],
      },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.capitalization_definition.include_stock_class_ids',
    ],
    [
      'null include_stock_class_ids',
      {
        include_stock_class_ids: null,
        include_stock_plans_ids: [],
        include_security_ids: [],
        exclude_security_ids: [],
      },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.capitalization_definition.include_stock_class_ids',
    ],
    [
      'sparse include_stock_class_ids',
      {
        include_stock_class_ids: new Array(1),
        include_stock_plans_ids: [],
        include_security_ids: [],
        exclude_security_ids: [],
      },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.capitalization_definition.include_stock_class_ids.0',
    ],
    [
      'numeric include_stock_class_ids item',
      { include_stock_class_ids: [1], include_stock_plans_ids: [], include_security_ids: [], exclude_security_ids: [] },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.capitalization_definition.include_stock_class_ids.0',
    ],
  ] as const)('rejects a %s capitalization definition', (_case, value, code, fieldPath) => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, capitalization_definition: value }), {
      code,
      fieldPath,
    });
  });

  it.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['false', false, OcpErrorCodes.INVALID_TYPE],
    ['JavaScript number', 1, OcpErrorCodes.INVALID_TYPE],
    ['eleven fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
    ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects a %s quantity_converted', (_case, value, code) => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, quantity_converted: value }), {
      code,
      fieldPath: 'convertibleConversion.quantity_converted',
      receivedValue: value,
    });
  });

  it.each([
    ['null', null, OcpErrorCodes.INVALID_TYPE],
    ['false', false, OcpErrorCodes.INVALID_TYPE],
    ['number', 1, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a %s optional balance_security_id', (_case, value, code) => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, balance_security_id: value }), {
      code,
      fieldPath: 'convertibleConversion.balance_security_id',
      receivedValue: value,
    });
  });

  it.each([
    ['null comments', null, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.comments'],
    ['false comments', false, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.comments'],
    ['sparse comments', new Array(1), OcpErrorCodes.REQUIRED_FIELD_MISSING, 'convertibleConversion.comments.0'],
    ['numeric comment', [1], OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.comments.0'],
  ] as const)('rejects %s without dropping it', (_case, comments, code, fieldPath) => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, comments }), { code, fieldPath });
  });

  it('rejects nested and root extra fields instead of dropping them', () => {
    expectBoundaryError(() => write({ ...CONVERTIBLE_CONVERSION, future: true }), {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      fieldPath: 'convertibleConversion.future',
    });
    expectBoundaryError(
      () =>
        write({
          ...CONVERTIBLE_CONVERSION,
          capitalization_definition: {
            include_stock_class_ids: [],
            include_stock_plans_ids: [],
            include_security_ids: [],
            exclude_security_ids: [],
            future: true,
          },
        }),
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        fieldPath: 'convertibleConversion.capitalization_definition.future',
      }
    );
  });

  it('preserves schema-valid empty strings and round-trips canonical values', () => {
    const daml = write({
      ...CONVERTIBLE_CONVERSION,
      balance_security_id: '',
      capitalization_definition: {
        include_stock_class_ids: [''],
        include_stock_plans_ids: [],
        include_security_ids: ['security'],
        exclude_security_ids: [],
      },
      quantity_converted: '+000.5000000000',
      comments: ['', 'kept verbatim'],
    }) as Parameters<typeof damlConvertibleConversionToNative>[0];

    expect(daml).toMatchObject({
      balance_security_id: '',
      capitalization_definition: { include_stock_class_ids: [''] },
      quantity_converted: '0.5',
      comments: ['', 'kept verbatim'],
    });
    expect(damlConvertibleConversionToNative(daml)).toMatchObject({
      balance_security_id: '',
      capitalization_definition: { include_stock_class_ids: [''] },
      quantity_converted: '0.5',
      comments: ['', 'kept verbatim'],
    });
  });

  it('treats explicitly undefined optional properties as absent', () => {
    expect(
      write({
        ...CONVERTIBLE_CONVERSION,
        balance_security_id: undefined,
        capitalization_definition: undefined,
        quantity_converted: undefined,
        comments: undefined,
      })
    ).toMatchObject({
      balance_security_id: null,
      capitalization_definition: null,
      quantity_converted: null,
      comments: [],
    });
  });
});

describe('strict stock-class comment writes', () => {
  it.each([
    ['null comments', null, OcpErrorCodes.INVALID_TYPE, 'stockClass.comments'],
    ['false comments', false, OcpErrorCodes.INVALID_TYPE, 'stockClass.comments'],
    ['sparse comments', new Array(1), OcpErrorCodes.REQUIRED_FIELD_MISSING, 'stockClass.comments.0'],
    ['numeric comment', [1], OcpErrorCodes.INVALID_TYPE, 'stockClass.comments.0'],
  ] as const)('rejects %s without filtering it away', (_case, comments, code, fieldPath) => {
    expectBoundaryError(() => stockClassDataToDaml({ ...STOCK_CLASS, comments } as never), { code, fieldPath });
  });

  it('preserves empty and whitespace-only comments through a round trip', () => {
    const daml = stockClassDataToDaml({ ...STOCK_CLASS, comments: ['', '  ', 'kept'] });
    expect(daml.comments).toEqual(['', '  ', 'kept']);
    expect(damlStockClassDataToNative(daml).comments).toEqual(['', '  ', 'kept']);
  });
});
