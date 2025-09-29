import { OcpClient } from '../src';

describe('get: getWarrantIssuanceAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.warrantIssuance.getWarrantIssuanceAsOcf({ contractId: 'warrant-issuance-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'wi-1',
        date: '2025-01-04',
        security_id: 'warr-1',
        custom_id: 'W-1',
        stakeholder_id: 'st-1',
        quantity: '1000',
        exercise_price: null,
        purchase_price: { amount: '10', currency: 'USD' },
        exercise_triggers: [
          {
            type: 'AUTOMATIC_ON_CONDITION',
            trigger_id: 'wi-1-warrant-trigger-1',
            conversion_right: {
              type: 'WARRANT_CONVERSION_RIGHT',
              conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1000' }
            }
          }
        ],
        quantity_source: 'UNSPECIFIED'
      },
      contractId: 'warrant-issuance-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.warrantIssuance.getWarrantIssuanceAsOcf({ contractId: 'warrant-issuance-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: '66d91301-1382-4564-a0cf-75a5a4524294',
        date: '2022-02-01',
        security_id: 'c49f6af2-d128-4221-86d5-fd22eec90764',
        custom_id: 'W-1',
        stakeholder_id: '7971bced-e9b8-4bc5-b028-e726c1c87215',
        quantity: '100000',
        quantity_source: 'HUMAN_ESTIMATED',
        exercise_price: { amount: '1.00', currency: 'USD' },
        purchase_price: { amount: '1000.00', currency: 'USD' },
        exercise_triggers: [],
        
      },
      contractId: 'warrant-issuance-full'
    });
  });
});


