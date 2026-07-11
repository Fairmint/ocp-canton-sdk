import { createTestEquityCompensationIssuanceData } from '../integration/utils/setupTestData';

describe('integration test data factories', () => {
  test('omits undefined equity-compensation relationship IDs', () => {
    const issuance = createTestEquityCompensationIssuanceData({
      stakeholder_id: 'stakeholder-1',
    });

    expect(Object.prototype.hasOwnProperty.call(issuance, 'stock_plan_id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(issuance, 'stock_class_id')).toBe(false);
  });

  test('preserves defined equity-compensation relationship IDs', () => {
    const issuance = createTestEquityCompensationIssuanceData({
      stakeholder_id: 'stakeholder-1',
      stock_plan_id: 'plan-1',
      stock_class_id: 'class-1',
    });

    expect(issuance).toMatchObject({
      stock_plan_id: 'plan-1',
      stock_class_id: 'class-1',
    });
  });
});
