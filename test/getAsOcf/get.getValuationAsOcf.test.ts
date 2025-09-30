import { OcpClient } from '../../src';

describe('get: getValuationAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.valuation.getValuationAsOcf({ contractId: 'valuation-minimal' });
    expect(res).toEqual({
      valuation: {
        object_type: 'VALUATION',
        id: 'val-1',
        provider: undefined,
        board_approval_date: undefined,
        stockholder_approval_date: undefined,
        comments: [],
        price_per_share: { amount: '1.00', currency: 'USD' },
        effective_date: '2025-01-01',
        valuation_type: '409A'
      },
      contractId: 'valuation-minimal'
    });
  });
});


