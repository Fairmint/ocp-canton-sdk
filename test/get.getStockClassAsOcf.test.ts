import { OcpClient } from '../src';

describe('get: getStockClassAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockClass.getStockClassAsOcf({ contractId: 'stock-class-minimal' });
    expect(res).toEqual({
      stockClass: {
        object_type: 'STOCK_CLASS',
        id: 'sc-1',
        name: 'Class A Common',
        class_type: 'COMMON',
        default_id_prefix: 'CA-',
        initial_shares_authorized: '1000',
        votes_per_share: '1',
        seniority: '1',
        comments: []
      },
      contractId: 'stock-class-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockClass.getStockClassAsOcf({ contractId: 'stock-class-full' });
    expect(res).toEqual({
      stockClass: {
        object_type: 'STOCK_CLASS',
        id: '93feb8f8-f8b6-4be6-ae10-d5cab38a9baf',
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '20000000.0000000000',
        votes_per_share: '1.0000000000',
        seniority: '1.0000000000',
        par_value: { amount: '0.0000100000', currency: 'USD' },
        price_per_share: { amount: '0.0000100000', currency: 'USD' },
        comments: [
          'The corporation is authorized to issue only one class of stock. Directors are elected at each annual meeting of stockholders. The Board of Directors is empowered to adopt, amend, or repeal the Bylaws. Liability of directors for monetary damages for breach of fiduciary duty is eliminated to the fullest extent under applicable law.\nOriginal filename: 20220218 Filed Certificate of Incorporation.pdf'
        ]
      },
      contractId: 'stock-class-full'
    });
  });
});


