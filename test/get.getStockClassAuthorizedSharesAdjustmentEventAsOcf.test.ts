import { OcpClient } from '../src';

describe('get: getStockClassAuthorizedSharesAdjustmentEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf({ contractId: 'stock-class-authorized-shares-adjustment-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'scas-1',
        date: '2025-01-07',
        stock_class_id: 'sc-1',
        new_shares_authorized: '500'
      },
      contractId: 'stock-class-authorized-shares-adjustment-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf({ contractId: 'stock-class-authorized-shares-adjustment-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'bc2e4a2c-8b00-4725-84e6-d905ca4dfa1d',
        date: '2024-10-01',
        stock_class_id: '6c143645-9699-4b47-9edb-782108da60bd',
        new_shares_authorized: '15000000',
        board_approval_date: '2024-10-01',
        
      },
      contractId: 'stock-class-authorized-shares-adjustment-full'
    });
  });
});


