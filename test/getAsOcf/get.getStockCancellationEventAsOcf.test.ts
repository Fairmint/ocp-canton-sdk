import { OcpClient } from '../../src';

describe('get: getStockCancellationEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockCancellation.getStockCancellationEventAsOcf({ contractId: 'stock-cancellation-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'scancel-1',
        date: '2025-01-05',
        security_id: 'sec-1',
        quantity: '10',
        reason_text: 'Cancelled shares'
      },
      contractId: 'stock-cancellation-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockCancellation.getStockCancellationEventAsOcf({ contractId: 'stock-cancellation-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'ba60e9d6-1e85-43ac-94bc-f0c4745a2dbe',
        date: '2025-04-04',
        security_id: '65296909-0c42-4678-b7d2-5eccd8b10bdc',
        quantity: '1411765',
        balance_security_id: '00000000-0000-0000-0000-000000000000',
        reason_text: 'Left company',
        
      },
      contractId: 'stock-cancellation-full'
    });
  });
});


