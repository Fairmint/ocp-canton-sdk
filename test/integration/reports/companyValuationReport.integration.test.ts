/**
 * Integration tests for CompanyValuationReport operations.
 *
 * NOTE: These tests require the OCP Factory contract to be deployed.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';

createIntegrationTestSuite('CompanyValuationReport operations', (getContext) => {
  /**
   * NOTE: CompanyValuationReport requires the OCP Factory contract. These tests verify the SDK exports the expected
   * functions.
   */

  test('SDK exports company valuation report functions', () => {
    const ctx = getContext();

    // Verify SDK exports company valuation report functions
    expect(ctx.ocp.OpenCapTableReports.companyValuationReport.create).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTableReports.companyValuationReport.create).toBe('function');

    expect(ctx.ocp.OpenCapTableReports.companyValuationReport.update).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTableReports.companyValuationReport.update).toBe('function');

    expect(ctx.ocp.OpenCapTableReports.companyValuationReport.addObservers).toBeDefined();
    expect(typeof ctx.ocp.OpenCapTableReports.companyValuationReport.addObservers).toBe('function');
  });

  test.skip('full company valuation workflow - requires OCP Factory', async () => {
    // This test would require:
    // 1. Create company valuation report via OCP Factory
    // 2. Update the valuation
    // 3. Add observers
    //
    // Skipped as it requires OCP Factory contract deployment
  });
});
