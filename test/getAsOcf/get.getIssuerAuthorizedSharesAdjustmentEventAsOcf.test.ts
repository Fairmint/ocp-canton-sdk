import { OcpClient } from '../../src';

describe('get: getIssuerAuthorizedSharesAdjustmentEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({ contractId: 'issuer-authorized-shares-adjustment-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        id: 'ias-1',
        date: '2025-01-06',
        issuer_id: 'issuer-1',
        new_shares_authorized: '1000'
      },
      contractId: 'issuer-authorized-shares-adjustment-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({ contractId: 'issuer-authorized-shares-adjustment-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        id: '1c80380c-37ed-41dd-2fbd-85294bbbeae3',
        date: '2024-10-24',
        issuer_id: '55a78071-41df-461f-ae51-64687653c0ed',
        new_shares_authorized: '100000000000000',
        board_approval_date: '2024-06-19',
        
      },
      contractId: 'issuer-authorized-shares-adjustment-full'
    });
  });
});


