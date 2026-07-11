import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { damlEquityCompensationIssuanceDataToNative } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import { damlStockIssuanceDataToNative } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { damlStockPlanPoolAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
import { expectInvalidDate } from '../utils/dateValidationAssertions';

const ISSUER_ADJUSTMENT_BASE = {
  id: 'adjustment-1',
  issuer_id: 'issuer-1',
  date: '2024-01-15T00:00:00Z',
  new_shares_authorized: '1000',
};

const STOCK_PLAN_POOL_ADJUSTMENT_BASE = {
  id: 'pool-adjustment-1',
  date: '2024-01-15T00:00:00Z',
  stock_plan_id: 'plan-1',
  shares_reserved: '1000',
  board_approval_date: null,
  stockholder_approval_date: null,
  comments: [],
};

const EQUITY_COMPENSATION_ISSUANCE_BASE = {
  id: 'equity-compensation-1',
  date: '2024-01-15T00:00:00Z',
  security_id: 'security-1',
  custom_id: 'OPTION-1',
  stakeholder_id: 'stakeholder-1',
  compensation_type: 'OcfCompensationTypeOption',
  quantity: '1000',
  exercise_price: { amount: '1', currency: 'USD' },
  expiration_date: null,
  board_approval_date: null,
  stockholder_approval_date: null,
  termination_exercise_windows: [],
  security_law_exemptions: [],
  comments: [],
};

const EQUITY_COMPENSATION_WRITE_BASE = {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
  id: 'equity-compensation-1',
  date: '2024-01-15',
  security_id: 'security-1',
  custom_id: 'OPTION-1',
  stakeholder_id: 'stakeholder-1',
  compensation_type: 'OPTION' as const,
  quantity: '1000',
  exercise_price: { amount: '1', currency: 'USD' },
  expiration_date: null,
  termination_exercise_windows: [],
  security_law_exemptions: [],
};

const STOCK_ISSUANCE_WRITE_BASE: Parameters<typeof stockIssuanceDataToDaml>[0] = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'stock-issuance-1',
  date: '2024-01-15',
  security_id: 'security-1',
  custom_id: 'CS-1',
  stakeholder_id: 'stakeholder-1',
  stock_class_id: 'stock-class-1',
  share_price: { amount: '1', currency: 'USD' },
  quantity: '100',
  security_law_exemptions: [],
  stock_legend_ids: [],
};

const STOCK_CLASS_WRITE_BASE: Parameters<typeof stockClassDataToDaml>[0] = {
  object_type: 'STOCK_CLASS',
  id: 'preferred-1',
  name: 'Preferred',
  class_type: 'PREFERRED',
  default_id_prefix: 'P-',
  initial_shares_authorized: '1000',
  votes_per_share: '1',
  seniority: '1',
  conversion_rights: [],
};

const OPTIONAL_READ_DATE_CASES: Array<{
  name: string;
  fieldPath: string;
  convert: (value: unknown) => unknown;
}> = [
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `issuer adjustment ${field}`,
    fieldPath: `issuerAuthorizedSharesAdjustment.${field}`,
    convert: (value: unknown) =>
      damlIssuerAuthorizedSharesAdjustmentDataToNative({
        ...ISSUER_ADJUSTMENT_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock plan pool adjustment ${field}`,
    fieldPath: `stockPlanPoolAdjustment.${field}`,
    convert: (value: unknown) =>
      damlStockPlanPoolAdjustmentDataToNative({
        ...STOCK_PLAN_POOL_ADJUSTMENT_BASE,
        [field]: value,
      }),
  })),
  ...(['expiration_date', 'board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `equity compensation issuance ${field}`,
    fieldPath: `equityCompensationIssuance.${field}`,
    convert: (value: unknown) =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class ${field}`,
    fieldPath: `stockClass.${field}`,
    convert: (value: unknown) =>
      damlStockClassDataToNative({
        ...stockClassDataToDaml(STOCK_CLASS_WRITE_BASE),
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock issuance ${field}`,
    fieldPath: `stockIssuance.${field}`,
    convert: (value: unknown) =>
      damlStockIssuanceDataToNative({
        ...stockIssuanceDataToDaml(STOCK_ISSUANCE_WRITE_BASE),
        [field]: value,
      }),
  })),
];

const OPTIONAL_WRITE_DATE_CASES: Array<{
  name: string;
  field: 'board_approval_date' | 'stockholder_approval_date';
  fieldPath: string;
  convert: (value: unknown) => Record<string, unknown>;
}> = [
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `issuer adjustment ${field}`,
    field,
    fieldPath: `issuerAuthorizedSharesAdjustment.${field}`,
    convert: (value: unknown) =>
      issuerAuthorizedSharesAdjustmentDataToDaml({
        ...ISSUER_ADJUSTMENT_BASE,
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        [field]: value,
      } as unknown as Parameters<typeof issuerAuthorizedSharesAdjustmentDataToDaml>[0]),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock plan pool adjustment ${field}`,
    field,
    fieldPath: `stockPlanPoolAdjustment.${field}`,
    convert: (value: unknown) =>
      stockPlanPoolAdjustmentDataToDaml({
        ...STOCK_PLAN_POOL_ADJUSTMENT_BASE,
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        [field]: value,
      } as unknown as Parameters<typeof stockPlanPoolAdjustmentDataToDaml>[0]),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `equity compensation issuance ${field}`,
    field,
    fieldPath: `equityCompensationIssuance.${field}`,
    convert: (value: unknown) =>
      equityCompensationIssuanceDataToDaml({
        ...EQUITY_COMPENSATION_WRITE_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class ${field}`,
    field,
    fieldPath: `stockClass.${field}`,
    convert: (value: unknown) =>
      stockClassDataToDaml({
        ...STOCK_CLASS_WRITE_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock issuance ${field}`,
    field,
    fieldPath: `stockIssuance.${field}`,
    convert: (value: unknown) =>
      stockIssuanceDataToDaml({
        ...STOCK_ISSUANCE_WRITE_BASE,
        [field]: value,
      }),
  })),
];

describe('DAML read converter date boundaries', () => {
  test('preserves the lexical date when an offset crosses the UTC day', () => {
    const result = damlStockClassSplitToNative({
      id: 'split-1',
      date: '2024-01-15T23:30:00-05:00',
      stock_class_id: 'class-1',
      split_ratio: { numerator: '2', denominator: '1' },
      comments: [],
    });

    expect(result.date).toBe('2024-01-15');
  });

  test.each(['2024-02-30T00:00:00Z', '2024-01-15T00:00:00', '2024-01-15T25:00:00Z'])(
    'rejects malformed required converter date %s',
    (date) => {
      expectInvalidDate(
        () =>
          damlStockClassSplitToNative({
            id: 'split-1',
            date,
            stock_class_id: 'class-1',
            split_ratio: { numerator: '2', denominator: '1' },
            comments: [],
          }),
        'stockClassSplit.date',
        date
      );
    }
  );

  test('identifies the exact invalid optional approval field', () => {
    const boardApprovalDate = '2023-02-29T00:00:00Z';

    expectInvalidDate(
      () =>
        damlIssuerAuthorizedSharesAdjustmentDataToNative({
          id: 'adjustment-1',
          issuer_id: 'issuer-1',
          date: '2024-01-15T00:00:00Z',
          new_shares_authorized: '1000',
          board_approval_date: boardApprovalDate,
        }),
      'issuerAuthorizedSharesAdjustment.board_approval_date',
      boardApprovalDate
    );
  });

  test('rejects a non-string optional date at the runtime ledger boundary', () => {
    const stockholderApprovalDate = { seconds: 1 };

    expectInvalidDate(
      () =>
        damlIssuerAuthorizedSharesAdjustmentDataToNative({
          id: 'adjustment-1',
          issuer_id: 'issuer-1',
          date: '2024-01-15T00:00:00Z',
          new_shares_authorized: '1000',
          stockholder_approval_date: stockholderApprovalDate,
        }),
      'issuerAuthorizedSharesAdjustment.stockholder_approval_date',
      stockholderApprovalDate,
      OcpErrorCodes.INVALID_TYPE
    );
  });

  test.each(OPTIONAL_READ_DATE_CASES)('rejects a present empty $name', ({ convert, fieldPath }) => {
    expectInvalidDate(() => convert(''), fieldPath, '');
  });

  test.each(OPTIONAL_READ_DATE_CASES)('rejects a present non-string $name', ({ convert, fieldPath }) => {
    const invalidDate = { seconds: 1 };
    expectInvalidDate(() => convert(invalidDate), fieldPath, invalidDate, OcpErrorCodes.INVALID_TYPE);
  });

  test.each(OPTIONAL_READ_DATE_CASES)('accepts a null $name as absent', ({ convert }) => {
    expect(() => convert(null)).not.toThrow();
  });

  test('rejects an undefined required-nullable equity expiration on readback', () => {
    expectInvalidDate(
      () =>
        damlEquityCompensationIssuanceDataToNative({
          ...EQUITY_COMPENSATION_ISSUANCE_BASE,
          expiration_date: undefined,
        }),
      'equityCompensationIssuance.expiration_date',
      undefined,
      OcpErrorCodes.INVALID_TYPE
    );
  });
});

describe('OCF write converter optional date boundaries', () => {
  test.each(OPTIONAL_WRITE_DATE_CASES)('rejects a present empty $name', ({ convert, fieldPath }) => {
    expectInvalidDate(() => convert(''), fieldPath, '');
  });

  test.each(OPTIONAL_WRITE_DATE_CASES)('rejects a present non-string $name', ({ convert, fieldPath }) => {
    const invalidDate = { seconds: 1 };
    expectInvalidDate(() => convert(invalidDate), fieldPath, invalidDate, OcpErrorCodes.INVALID_TYPE);
  });

  test.each(OPTIONAL_WRITE_DATE_CASES)('encodes a null or undefined $name as absent', ({ convert, field }) => {
    expect(convert(null)[field]).toBeNull();
    expect(convert(undefined)[field]).toBeNull();
  });

  test('reports contextual paths for required and nested write dates', () => {
    expectInvalidDate(
      () =>
        issuerAuthorizedSharesAdjustmentDataToDaml({
          ...ISSUER_ADJUSTMENT_BASE,
          object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
          date: '',
        }),
      'issuerAuthorizedSharesAdjustment.date',
      ''
    );

    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          vestings: [
            { date: '2024-01-15', amount: '1' },
            { date: '', amount: '1' },
          ],
        }),
      'equityCompensationIssuance.vestings.1.date',
      ''
    );
  });

  test('validates an equity-compensation vesting date before filtering its zero amount', () => {
    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          vestings: [{ date: 'not-a-date', amount: '0' }],
        }),
      'equityCompensationIssuance.vestings.0.date',
      'not-a-date'
    );
  });

  test('reports original array indexes for nested issuance dates', () => {
    expectInvalidDate(
      () =>
        damlEquityCompensationIssuanceDataToNative({
          ...EQUITY_COMPENSATION_ISSUANCE_BASE,
          vestings: [
            { date: '2024-01-15T00:00:00Z', amount: '1' },
            { date: '', amount: '1' },
          ],
        }),
      'equityCompensationIssuance.vestings[1].date',
      ''
    );

    expectInvalidDate(
      () =>
        stockIssuanceDataToDaml({
          ...STOCK_ISSUANCE_WRITE_BASE,
          vestings: [
            { date: '2024-01-15', amount: '0' },
            { date: '', amount: '1' },
          ],
        }),
      'stockIssuance.vestings.1.date',
      ''
    );
  });

  test('reports the original array index for an invalid equity-compensation vesting amount', () => {
    const invalidAmount = { value: '1' };
    try {
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        vestings: [
          { date: '2024-01-15T00:00:00Z', amount: '1' },
          { date: '2024-01-16T00:00:00Z', amount: invalidAmount },
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'equityCompensationIssuance.vestings[1].amount',
        receivedValue: invalidAmount,
      });
      return;
    }
    throw new Error('Expected invalid vesting amount to be rejected');
  });

  test.each([
    ['undefined', undefined, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a required-nullable equity expiration when %s', (_case, value, code) => {
    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          expiration_date: value,
        } as unknown as Parameters<typeof equityCompensationIssuanceDataToDaml>[0]),
      'equityCompensationIssuance.expiration_date',
      value,
      code
    );
  });

  test('accepts explicit null for a required-nullable equity expiration', () => {
    expect(equityCompensationIssuanceDataToDaml(EQUITY_COMPENSATION_WRITE_BASE).expiration_date).toBeNull();
  });
});
