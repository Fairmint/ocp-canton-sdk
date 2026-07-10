import { OcpValidationError } from '../../src/errors';
import { damlConvertibleCancellationToNative } from '../../src/functions/OpenCapTable/convertibleCancellation';

describe('Convertible cancellation converters', () => {
  test('converts DAML data to a canonical cancellation event', () => {
    const result = damlConvertibleCancellationToNative({
      id: 'convertible-cancellation-1',
      date: '2026-07-09T00:00:00.000Z',
      security_id: 'convertible-security-1',
      amount: { amount: '1250.5000000000', currency: 'USD' },
      balance_security_id: 'convertible-security-balance-1',
      reason_text: 'Partial repayment',
      comments: ['Board approved'],
    });

    expect(result).toEqual({
      object_type: 'TX_CONVERTIBLE_CANCELLATION',
      id: 'convertible-cancellation-1',
      date: '2026-07-09',
      security_id: 'convertible-security-1',
      amount: { amount: '1250.5', currency: 'USD' },
      balance_security_id: 'convertible-security-balance-1',
      reason_text: 'Partial repayment',
      comments: ['Board approved'],
    });
  });

  test('rejects DAML data without the required amount', () => {
    expect(() =>
      damlConvertibleCancellationToNative({
        id: 'convertible-cancellation-2',
        date: '2026-07-09T00:00:00.000Z',
        security_id: 'convertible-security-2',
        reason_text: 'Missing amount',
        comments: [],
      })
    ).toThrow(OcpValidationError);
  });
});
