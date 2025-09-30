import { OcpClient } from '../../src';

describe('get: getStockPlanPoolAdjustmentEventAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({ contractId: 'stock-plan-pool-adjustment-minimal' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        id: 'sppa-1',
        date: '2025-01-08',
        stock_plan_id: 'sp-1',
        shares_reserved: '10000'
      },
      contractId: 'stock-plan-pool-adjustment-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({ contractId: 'stock-plan-pool-adjustment-full' });
    expect(res).toEqual({
      event: {
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        id: '282200ac-926d-49d2-957b-084db9c07c38',
        date: '2022-10-31',
        stock_plan_id: 'deb6f0e7-106c-44eb-8363-44048dc63dd4',
        shares_reserved: '400',
        board_approval_date: '2022-10-31',
        
      },
      contractId: 'stock-plan-pool-adjustment-full'
    });
  });
});


