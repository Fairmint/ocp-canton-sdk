import { OcpClient } from '../../src';

describe('get: getEquityCompensationIssuanceEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockPlan.getEquityCompensationIssuanceEventAsOcf({ contractId: 'equity-comp-issuance-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eci-1',
        date: '2025-01-12',
        security_id: 'ps-1',
        custom_id: 'ECI-1',
        stakeholder_id: 'st-1',
        compensation_type: 'OPTION',
        quantity: '100'
      },
      contractId: 'equity-comp-issuance-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockPlan.getEquityCompensationIssuanceEventAsOcf({ contractId: 'equity-comp-issuance-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'ec-1',
        date: '2024-01-01',
        security_id: 'ps-1',
        custom_id: 'ECI-1',
        stakeholder_id: 'st-1',
        compensation_type: 'OPTION',
        quantity: '100',
        exercise_price: { amount: '1.00', currency: 'USD' },
        
      },
      contractId: 'equity-comp-issuance-full'
    });
  });
});


