import { OcpClient } from '../../src';

describe('get: getStockIssuanceAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockIssuance.getStockIssuanceAsOcf({ contractId: 'stock-issuance-minimal' });
    expect(res).toEqual({
      stockIssuance: {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'si-1',
        date: '2025-01-02',
        security_id: 'sec-1',
        custom_id: 'SI-1',
        stakeholder_id: 'st-1',
        stock_class_id: 'sc-1',
        share_price: { amount: '1.00', currency: 'USD' },
        quantity: '100',
        stock_legend_ids: [],
        security_law_exemptions: []
      },
      contractId: 'stock-issuance-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockIssuance.getStockIssuanceAsOcf({ contractId: 'stock-issuance-full' });
    expect(res).toEqual({
      stockIssuance: {
        object_type: 'TX_STOCK_ISSUANCE',
        id: '6057992e-ebc4-e178-cf20-338b7effda82',
        date: '2023-11-06',
        security_id: '688b5ce6-d742-dbab-8fce-b2751424d750',
        custom_id: 'CS-2',
        stakeholder_id: '6e59643b-1a68-41cb-b700-2374fed7ba60',
        stock_class_id: '6c143645-9699-4b47-9edb-782108da60bd',
        
        share_price: { amount: '0.0000100000', currency: 'USD' },
        quantity: '1000000000',
        stock_legend_ids: [],
        security_law_exemptions: [
          { description: 'Issued under Israeli Securities Law, which typically allows founders to receive shares without the need for public registration when certain conditions are met.', jurisdiction: 'IL' }
        ]
      },
      contractId: 'stock-issuance-full'
    });
  });
});


