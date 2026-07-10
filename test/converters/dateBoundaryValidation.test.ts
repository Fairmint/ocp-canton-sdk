import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { damlEquityCompensationIssuanceDataToNative } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { damlStockPlanPoolAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';

function expectInvalidDate(
  action: () => unknown,
  fieldPath: string,
  receivedValue: unknown,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): void {
  try {
    action();
    throw new Error('Expected converter date validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code,
      fieldPath,
      receivedValue,
    });
  }
}

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
  expiration_date: null,
  board_approval_date: null,
  stockholder_approval_date: null,
  termination_exercise_windows: [],
  security_law_exemptions: [],
  comments: [],
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
});
