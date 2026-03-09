/** Unit tests for stock issuance DAML→OCF read conversions. */

import { damlStockIssuanceDataToNative } from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';

function makeMinimalDamlStockIssuance(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-id',
    date: '2024-01-15T00:00:00Z',
    security_id: 'sec-1',
    custom_id: 'CS-1',
    stakeholder_id: 'sh-1',
    stock_class_id: 'sc-1',
    share_price: { amount: '1.00', currency: 'USD' },
    quantity: '100',
    security_law_exemptions: [],
    stock_legend_ids: [],
    comments: [],
    ...overrides,
  };
}

describe('damlStockIssuanceDataToNative', () => {
  describe('issuance_type handling (DAML Optional enum)', () => {
    test('returns RSA when issuance_type is OcfStockIssuanceRSA', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: 'OcfStockIssuanceRSA' });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.issuance_type).toBe('RSA');
    });

    test('returns FOUNDERS_STOCK when issuance_type is OcfStockIssuanceFounders', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: 'OcfStockIssuanceFounders' });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.issuance_type).toBe('FOUNDERS_STOCK');
    });

    test('omits issuance_type when DAML value is null (Optional None)', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: null });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.issuance_type).toBeUndefined();
    });

    test('omits issuance_type when DAML field is undefined (absent)', () => {
      const daml = makeMinimalDamlStockIssuance();
      delete daml.issuance_type;
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.issuance_type).toBeUndefined();
    });

    test('throws for unknown DAML issuance type string', () => {
      const daml = makeMinimalDamlStockIssuance({ issuance_type: 'OcfStockIssuanceUnknown' });
      expect(() => damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0])).toThrow(
        'Unknown DAML stock issuance type: OcfStockIssuanceUnknown'
      );
    });
  });

  describe('required field extraction', () => {
    test('extracts all required fields correctly', () => {
      const daml = makeMinimalDamlStockIssuance();
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.id).toBe('test-id');
      expect(result.security_id).toBe('sec-1');
      expect(result.custom_id).toBe('CS-1');
      expect(result.stakeholder_id).toBe('sh-1');
      expect(result.stock_class_id).toBe('sc-1');
      expect(result.quantity).toBe('100');
      expect(result.share_price).toEqual({ amount: '1', currency: 'USD' });
    });
  });

  describe('optional field handling', () => {
    test('includes vesting_terms_id when present', () => {
      const daml = makeMinimalDamlStockIssuance({ vesting_terms_id: 'vt-1' });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.vesting_terms_id).toBe('vt-1');
    });

    test('omits vesting_terms_id when null', () => {
      const daml = makeMinimalDamlStockIssuance({ vesting_terms_id: null });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.vesting_terms_id).toBeUndefined();
    });

    test('includes stock_plan_id when present', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_plan_id: 'sp-1' });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.stock_plan_id).toBe('sp-1');
    });

    test('omits stock_plan_id when null', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_plan_id: null });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.stock_plan_id).toBeUndefined();
    });

    test('includes cost_basis when present', () => {
      const daml = makeMinimalDamlStockIssuance({ cost_basis: { amount: '0', currency: 'USD' } });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.cost_basis).toEqual({ amount: '0', currency: 'USD' });
    });

    test('omits cost_basis when null', () => {
      const daml = makeMinimalDamlStockIssuance({ cost_basis: null });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.cost_basis).toBeUndefined();
    });
  });

  describe('array field handling', () => {
    test('handles security_law_exemptions array', () => {
      const daml = makeMinimalDamlStockIssuance({
        security_law_exemptions: [{ description: 'SEC Rule 701', jurisdiction: 'US' }],
      });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.security_law_exemptions).toEqual([{ description: 'SEC Rule 701', jurisdiction: 'US' }]);
    });

    test('handles empty security_law_exemptions', () => {
      const daml = makeMinimalDamlStockIssuance({ security_law_exemptions: [] });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.security_law_exemptions).toEqual([]);
    });

    test('handles stock_legend_ids array', () => {
      const daml = makeMinimalDamlStockIssuance({ stock_legend_ids: ['leg-1', 'leg-2'] });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.stock_legend_ids).toEqual(['leg-1', 'leg-2']);
    });

    test('handles comments array', () => {
      const daml = makeMinimalDamlStockIssuance({ comments: ['note 1', 'note 2'] });
      const result = damlStockIssuanceDataToNative(daml as Parameters<typeof damlStockIssuanceDataToNative>[0]);
      expect(result.comments).toEqual(['note 1', 'note 2']);
    });
  });
});
