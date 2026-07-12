import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable/CapTableBatch';
import { buildOcfCreateData } from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import type {
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockPlanPoolAdjustment,
} from '../../src/types/native';

type AdministrativeAdjustmentEntityType =
  | 'issuerAuthorizedSharesAdjustment'
  | 'stockClassAuthorizedSharesAdjustment'
  | 'stockPlanPoolAdjustment';
type AdministrativeAdjustment =
  | OcfIssuerAuthorizedSharesAdjustment
  | OcfStockClassAuthorizedSharesAdjustment
  | OcfStockPlanPoolAdjustment;

interface AdjustmentWriterCase {
  readonly entityType: AdministrativeAdjustmentEntityType;
  readonly objectType:
    | 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT'
    | 'TX_STOCK_PLAN_POOL_ADJUSTMENT';
  readonly subjectField: 'issuer_id' | 'stock_class_id' | 'stock_plan_id';
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly base: () => AdministrativeAdjustment;
  readonly direct: (input: AdministrativeAdjustment) => Record<string, unknown>;
}

const cases: readonly AdjustmentWriterCase[] = [
  {
    entityType: 'issuerAuthorizedSharesAdjustment',
    objectType: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    subjectField: 'issuer_id',
    numericField: 'new_shares_authorized',
    base: () => ({
      object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'issuer-adjustment',
      date: '2026-07-10',
      issuer_id: 'issuer',
      new_shares_authorized: '1000',
    }),
    direct: (input) => issuerAuthorizedSharesAdjustmentDataToDaml(input as OcfIssuerAuthorizedSharesAdjustment),
  },
  {
    entityType: 'stockClassAuthorizedSharesAdjustment',
    objectType: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    subjectField: 'stock_class_id',
    numericField: 'new_shares_authorized',
    base: () => ({
      object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      id: 'stock-class-adjustment',
      date: '2026-07-10',
      stock_class_id: 'stock-class',
      new_shares_authorized: '2000',
    }),
    direct: (input) => stockClassAuthorizedSharesAdjustmentDataToDaml(input as OcfStockClassAuthorizedSharesAdjustment),
  },
  {
    entityType: 'stockPlanPoolAdjustment',
    objectType: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    subjectField: 'stock_plan_id',
    numericField: 'shares_reserved',
    base: () => ({
      object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
      id: 'stock-plan-adjustment',
      date: '2026-07-10',
      stock_plan_id: 'stock-plan',
      shares_reserved: '3000',
    }),
    direct: (input) => stockPlanPoolAdjustmentDataToDaml(input as OcfStockPlanPoolAdjustment),
  },
];

function writerBoundaries(testCase: AdjustmentWriterCase, input: AdministrativeAdjustment): Array<() => unknown> {
  return [
    () => testCase.direct(input),
    () => convertToDaml(...([testCase.entityType, input] as never)),
    () => convertOperationToDaml({ type: testCase.entityType, data: input } as never),
    () => buildOcfCreateData(...([testCase.entityType, input] as never)),
    () => {
      const batch = new CapTableBatch({ capTableContractId: 'cap-table', actAs: ['issuer::party'] });
      batch.create(...([testCase.entityType, input] as never));
      return batch.build();
    },
  ];
}

function withField(testCase: AdjustmentWriterCase, field: string, value: unknown): AdministrativeAdjustment {
  return { ...testCase.base(), [field]: value };
}

describe('administrative adjustment writers', () => {
  it.each(cases)(
    '$entityType preserves non-empty whitespace text and canonicalizes negative zero at every writer path',
    (testCase) => {
      const input = {
        ...testCase.base(),
        id: '   ',
        [testCase.subjectField]: '   ',
        [testCase.numericField]: '-00.0000000000',
        comments: ['   '],
      } as AdministrativeAdjustment;

      const direct = testCase.direct(input);
      expect(direct).toMatchObject({
        id: '   ',
        [testCase.subjectField]: '   ',
        [testCase.numericField]: '0',
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: ['   '],
      });
      for (const invoke of writerBoundaries(testCase, input)) expect(invoke).not.toThrow();
    }
  );

  it.each(cases)('$entityType rejects empty IDs, subject IDs, and comment items at every writer path', (testCase) => {
    for (const [field, value, fieldPath, code] of [
      ['id', '', `${testCase.entityType}.id`, OcpErrorCodes.REQUIRED_FIELD_MISSING],
      [
        testCase.subjectField,
        '',
        `${testCase.entityType}.${testCase.subjectField}`,
        OcpErrorCodes.REQUIRED_FIELD_MISSING,
      ],
      ['comments', [''], `${testCase.entityType}.comments[0]`, OcpErrorCodes.INVALID_FORMAT],
    ] as const) {
      const input = withField(testCase, field, value);
      for (const invoke of writerBoundaries(testCase, input)) {
        expect(invoke).toThrow(
          expect.objectContaining({
            name: OcpValidationError.name,
            code,
            fieldPath,
          })
        );
      }
    }
  });

  it.each(cases)('$entityType accepts the full Numeric(10) 28/10 boundary', (testCase) => {
    const value = '9999999999999999999999999999.1234567891';
    const input = withField(testCase, testCase.numericField, value);
    expect(testCase.direct(input)).toMatchObject({ [testCase.numericField]: value });
    for (const invoke of writerBoundaries(testCase, input)) expect(invoke).not.toThrow();
  });

  it.each(
    cases.flatMap((testCase) =>
      [
        ['negative nonzero', '-0.0000000001', OcpErrorCodes.OUT_OF_RANGE],
        ['29 integral digits', '10000000000000000000000000000', OcpErrorCodes.INVALID_FORMAT],
        ['11 fractional digits', '0.12345678901', OcpErrorCodes.INVALID_FORMAT],
        ['scientific notation', '1e3', OcpErrorCodes.INVALID_FORMAT],
        ['number primitive', 1, OcpErrorCodes.INVALID_TYPE],
      ].map(([name, value, code]) => ({ code, name, testCase, value }))
    )
  )('$testCase.entityType rejects $name at every writer path', ({ code, testCase, value }) => {
    const input = withField(testCase, testCase.numericField, value);
    for (const invoke of writerBoundaries(testCase, input)) {
      expect(invoke).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code,
          fieldPath: `${testCase.entityType}.${testCase.numericField}`,
        })
      );
    }
  });

  it.each(cases)('$entityType rejects explicit null approval dates at every writer path', (testCase) => {
    const input = withField(testCase, 'board_approval_date', null);
    for (const invoke of writerBoundaries(testCase, input)) {
      expect(invoke).toThrow(
        expect.objectContaining({
          name: OcpValidationError.name,
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: `${testCase.entityType}.board_approval_date`,
        })
      );
    }
  });

  it.each(cases)('$entityType rejects missing and wrong object_type plus extra fields', (testCase) => {
    const missingObjectType = { ...testCase.base() } as Record<string, unknown>;
    delete missingObjectType.object_type;
    const wrongObjectType = { ...testCase.base(), object_type: 'WRONG_OBJECT_TYPE' };
    const extraField = { ...testCase.base(), unexpected: true };

    expect(() => testCase.direct(missingObjectType as unknown as AdministrativeAdjustment)).toThrow(
      expect.objectContaining({ fieldPath: `${testCase.entityType}.object_type` })
    );
    expect(() => testCase.direct(wrongObjectType as AdministrativeAdjustment)).toThrow(
      expect.objectContaining({ fieldPath: `${testCase.entityType}.object_type` })
    );
    expect(() => testCase.direct(extraField as AdministrativeAdjustment)).toThrow(OcpValidationError);
  });

  it.each(cases)('$entityType rejects accessors and proxies without invoking traps', (testCase) => {
    const idGetter = jest.fn(() => 'poison');
    const accessorInput = testCase.base();
    Object.defineProperty(accessorInput, 'id', { enumerable: true, get: idGetter });
    expect(() => testCase.direct(accessorInput)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        fieldPath: `${testCase.entityType}.id`,
      })
    );
    expect(idGetter).not.toHaveBeenCalled();

    const getTrap = jest.fn(Reflect.get);
    const proxy = new Proxy(testCase.base(), { get: getTrap });
    expect(() => testCase.direct(proxy)).toThrow(
      expect.objectContaining({ name: OcpValidationError.name, fieldPath: testCase.entityType })
    );
    expect(getTrap).not.toHaveBeenCalled();
  });

  it('rejects inherited, symbol, cyclic, revoked-proxy, and huge sparse writer data with bounded diagnostics', () => {
    const testCase = cases[0];
    if (testCase === undefined) throw new Error('Missing writer case');
    const inherited = Object.assign(Object.create({ inherited: true }), testCase.base());
    const symbol = { ...testCase.base(), [Symbol('poison')]: true };
    const cyclic = testCase.base() as AdministrativeAdjustment & { cycle?: unknown };
    cyclic.cycle = cyclic;
    const revoked = Proxy.revocable(testCase.base(), {});
    revoked.revoke();
    const sparse = new Array<string>(100_000);

    for (const input of [inherited, symbol, cyclic, revoked.proxy, { ...testCase.base(), comments: sparse }]) {
      let caught: unknown;
      try {
        testCase.direct(input as AdministrativeAdjustment);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(OcpValidationError);
      expect(JSON.stringify(caught).length).toBeLessThan(4_096);
    }
  });

  it.each(cases)('$entityType bounds huge numeric diagnostics', (testCase) => {
    const input = withField(testCase, testCase.numericField, '9'.repeat(100_000));
    let caught: unknown;
    try {
      testCase.direct(input);
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
