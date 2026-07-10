import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';

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
});
