import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  extractAndDecodeAdministrativeAdjustmentData,
  type AdministrativeAdjustmentEntityType,
} from '../../src/functions/OpenCapTable/capTable/adjustmentContractData';
import {
  decodeDamlEntityData,
  extractAndDecodeDamlEntityData,
} from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { damlStockClassAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { damlStockPlanPoolAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';

interface AdjustmentReadCase {
  readonly entityType: AdministrativeAdjustmentEntityType;
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly subjectField: 'issuer_id' | 'stock_class_id' | 'stock_plan_id';
  readonly data: () => Record<string, unknown>;
  readonly project: (data: Record<string, unknown>) => object;
}

const cases: readonly AdjustmentReadCase[] = [
  {
    entityType: 'issuerAuthorizedSharesAdjustment',
    numericField: 'new_shares_authorized',
    subjectField: 'issuer_id',
    data: () =>
      issuerAuthorizedSharesAdjustmentDataToDaml({
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'issuer-adjustment',
        date: '2026-07-10',
        issuer_id: 'issuer',
        new_shares_authorized: '1',
        comments: ['valid'],
      }),
    project: (data) => damlIssuerAuthorizedSharesAdjustmentDataToNative(data as never),
  },
  {
    entityType: 'stockClassAuthorizedSharesAdjustment',
    numericField: 'new_shares_authorized',
    subjectField: 'stock_class_id',
    data: () =>
      stockClassAuthorizedSharesAdjustmentDataToDaml({
        object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'stock-class-adjustment',
        date: '2026-07-10',
        stock_class_id: 'stock-class',
        new_shares_authorized: '1',
        comments: ['valid'],
      }),
    project: (data) => damlStockClassAuthorizedSharesAdjustmentDataToNative(data as never),
  },
  {
    entityType: 'stockPlanPoolAdjustment',
    numericField: 'shares_reserved',
    subjectField: 'stock_plan_id',
    data: () =>
      stockPlanPoolAdjustmentDataToDaml({
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        id: 'stock-plan-adjustment',
        date: '2026-07-10',
        stock_plan_id: 'stock-plan',
        shares_reserved: '1',
        comments: ['valid'],
      }),
    project: (data) => damlStockPlanPoolAdjustmentDataToNative(data as never),
  },
];

function wrapper(data: Record<string, unknown>): Record<string, unknown> {
  return {
    context: { issuer: 'issuer::party', system_operator: 'operator::party' },
    adjustment_data: data,
  };
}

function readBoundaries(testCase: AdjustmentReadCase, data: Record<string, unknown>): Array<() => unknown> {
  const createArgument = wrapper(data);
  return [
    () => testCase.project(data),
    () => convertToOcf(testCase.entityType, data as never),
    () => decodeDamlEntityData(testCase.entityType, data),
    () => extractAndDecodeAdministrativeAdjustmentData(testCase.entityType, createArgument),
    () => extractAndDecodeDamlEntityData(testCase.entityType, createArgument),
  ];
}

describe('administrative adjustment generated boundaries', () => {
  it.each(cases)('$entityType canonicalizes generated negative zero', (testCase) => {
    const data = { ...testCase.data(), [testCase.numericField]: '-00.0000000000' };
    const projected = testCase.project(data);
    expect(projected).toMatchObject({ [testCase.numericField]: '0' });
    for (const invoke of readBoundaries(testCase, data)) expect(invoke).not.toThrow();
  });

  it.each(cases)('$entityType rejects v35-invalid empty text at every read boundary', (testCase) => {
    for (const data of [
      { ...testCase.data(), id: '' },
      { ...testCase.data(), [testCase.subjectField]: '' },
      { ...testCase.data(), comments: [''] },
    ]) {
      for (const invoke of readBoundaries(testCase, data)) {
        expect(invoke).toThrow(expect.objectContaining({ name: OcpValidationError.name }));
      }
    }
  });

  it.each(cases)('$entityType accepts the full Numeric(10) 28/10 boundary', (testCase) => {
    const value = '9999999999999999999999999999.1234567891';
    const data = { ...testCase.data(), [testCase.numericField]: value };
    expect(testCase.project(data)).toMatchObject({ [testCase.numericField]: value });
    for (const invoke of readBoundaries(testCase, data)) expect(invoke).not.toThrow();
  });

  it.each(
    cases.flatMap((testCase) =>
      [
        ['negative nonzero', '-0.0000000001', OcpErrorCodes.OUT_OF_RANGE],
        ['29 integral digits', '10000000000000000000000000000', OcpErrorCodes.INVALID_FORMAT],
        ['11 fractional digits', '0.12345678901', OcpErrorCodes.INVALID_FORMAT],
      ].map(([name, value, code]) => ({ code, name, testCase, value }))
    )
  )('$testCase.entityType rejects $name across direct and wrapper readers', ({ code, testCase, value }) => {
    const data = { ...testCase.data(), [testCase.numericField]: value };
    for (const invoke of readBoundaries(testCase, data)) {
      expect(invoke).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code,
          fieldPath: `${testCase.entityType}.${testCase.numericField}`,
        })
      );
    }
  });

  it.each(cases)(
    '$entityType accepts generated Numeric(10) exponent wire forms across all read boundaries',
    (testCase) => {
      for (const [value, canonical] of [
        ['1e3', '1000'],
        ['1.25e-1', '0.125'],
        ['-0e20', '0'],
      ] as const) {
        const data = { ...testCase.data(), [testCase.numericField]: value };
        expect(testCase.project(data)).toMatchObject({ [testCase.numericField]: canonical });
        for (const invoke of readBoundaries(testCase, data)) expect(invoke).not.toThrow();
      }
    }
  );

  it.each(cases)('$entityType rejects numeric primitives as generated-structure errors', (testCase) => {
    const data = { ...testCase.data(), [testCase.numericField]: 1 };
    for (const invoke of readBoundaries(testCase, data)) {
      expect(invoke).toThrow(expect.objectContaining({ name: OcpParseError.name }));
    }
  });

  it.each(cases)('$entityType reports invalid required and optional dates contextually', (testCase) => {
    const invalidRequired = { ...testCase.data(), date: '2026-99-99' };
    const invalidOptional = { ...testCase.data(), board_approval_date: '2026-02-30' };
    for (const invoke of readBoundaries(testCase, invalidRequired)) {
      expect(invoke).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          fieldPath: `${testCase.entityType}.date`,
        })
      );
    }
    for (const invoke of readBoundaries(testCase, invalidOptional)) {
      expect(invoke).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          fieldPath: `${testCase.entityType}.board_approval_date`,
        })
      );
    }
  });

  it.each(cases)('$entityType enforces exact generated required and Optional Time wire forms', (testCase) => {
    for (const value of ['2026-07-10', '2026-07-10T00:00:00+00:00', '2026-07-10T00:00:00.1234567Z']) {
      for (const data of [
        { ...testCase.data(), date: value },
        { ...testCase.data(), board_approval_date: value },
      ]) {
        for (const invoke of readBoundaries(testCase, data)) {
          expect(invoke).toThrow(expect.objectContaining({ name: OcpValidationError.name }));
        }
      }
    }
  });

  it.each(cases)('$entityType rejects wrong objects and extra data/wrapper fields losslessly', (testCase) => {
    const extraData = { ...testCase.data(), unexpected: true };
    const extraWrapper = { ...wrapper(testCase.data()), unexpected: true };
    expect(() => testCase.project([] as unknown as Record<string, unknown>)).toThrow(OcpParseError);
    expect(() => decodeDamlEntityData(testCase.entityType, extraData)).toThrow(OcpParseError);
    expect(() => convertToOcf(testCase.entityType, extraData as never)).toThrow(OcpParseError);
    expect(() => extractAndDecodeAdministrativeAdjustmentData(testCase.entityType, extraWrapper)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        source: `damlAdministrativeAdjustmentCreateArgument.${testCase.entityType}`,
        context: expect.objectContaining({ decoderPath: 'input.unexpected' }),
      })
    );
  });

  it.each(cases)('$entityType rejects accessors and proxies before invoking traps', (testCase) => {
    const getter = jest.fn(() => 'poison');
    const accessorData = testCase.data();
    Object.defineProperty(accessorData, testCase.numericField, { enumerable: true, get: getter });
    expect(() => testCase.project(accessorData)).toThrow(OcpParseError);
    expect(getter).not.toHaveBeenCalled();

    const getTrap = jest.fn(Reflect.get);
    const proxy = new Proxy(testCase.data(), { get: getTrap });
    expect(() => decodeDamlEntityData(testCase.entityType, proxy)).toThrow(OcpParseError);
    expect(() => convertToOcf(testCase.entityType, proxy as never)).toThrow(OcpParseError);
    expect(getTrap).not.toHaveBeenCalled();
  });

  it('rejects inherited, symbol, cyclic, revoked-proxy, and huge sparse wrapper data with bounded errors', () => {
    const testCase = cases[0];
    if (testCase === undefined) throw new Error('Missing reader case');
    const inherited = Object.assign(Object.create({ inherited: true }), testCase.data());
    const symbol = { ...testCase.data(), [Symbol('poison')]: true };
    const cyclic = testCase.data() as Record<string, unknown> & { cycle?: unknown };
    cyclic.cycle = cyclic;
    const revoked = Proxy.revocable(testCase.data(), {});
    revoked.revoke();
    const sparse = new Array<string>(100_000);

    for (const data of [inherited, symbol, cyclic, revoked.proxy, { ...testCase.data(), comments: sparse }]) {
      let caught: unknown;
      try {
        extractAndDecodeAdministrativeAdjustmentData(testCase.entityType, wrapper(data));
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({
        name: OcpParseError.name,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
      expect(JSON.stringify(caught).length).toBeLessThan(4_096);
    }
  });

  it('bounds deeply nested, overly wide, and pathological-prototype wrapper inputs', () => {
    const testCase = cases[0];
    if (testCase === undefined) throw new Error('Missing reader case');

    let deep: Record<string, unknown> = testCase.data();
    for (let index = 0; index < 101; index += 1) deep = { nested: deep };
    const denseComments = Array.from({ length: 100_001 }, () => 'valid');
    const wide = { ...testCase.data(), comments: denseComments };
    let prototype: object | null = null;
    for (let index = 0; index < 101; index += 1) prototype = Object.create(prototype);
    const pathologicalPrototype = Object.assign(Object.create(prototype), testCase.data());

    for (const data of [deep, wide, pathologicalPrototype]) {
      for (const invoke of readBoundaries(testCase, data)) {
        const startedAt = Date.now();
        expect(invoke).toThrow(expect.objectContaining({ name: OcpParseError.name }));
        expect(Date.now() - startedAt).toBeLessThan(2_000);
      }
    }
  });

  it.each(cases)('$entityType bounds huge numeric diagnostics', (testCase) => {
    const data = { ...testCase.data(), [testCase.numericField]: '9'.repeat(100_000) };
    let caught: unknown;
    try {
      testCase.project(data);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      name: OcpValidationError.name,
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.${testCase.numericField}`,
    });
    expect(JSON.stringify(caught).length).toBeLessThan(4_096);
  });
});
