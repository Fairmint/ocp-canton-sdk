/**
 * Integration tests for CompanyValuationReport operations.
 *
 * Tests the full lifecycle of CompanyValuationReport entities:
 *
 * - Create company valuation report
 * - Update company valuation report
 * - Add observers to report
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';
import { generateTestId, setupTestIssuer, setupTestStockClass } from '../utils';

createIntegrationTestSuite('CompanyValuationReport operations', (getContext) => {
  test('creates company valuation report', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-valuation'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const result = await ctx.ocp.OpenCapTableReports.companyValuationReport.createCompanyValuationReport({
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      valuationData: {
        id: generateTestId('valuation'),
        stock_class_id: stockClassSetup.stockClassData.id,
        price_per_share: { amount: '10.00', currency: 'USD' },
        effective_date: new Date().toISOString().split('T')[0],
        valuation_type: '409A',
      },
    });

    expect(result.contractId).toBeDefined();
    expect(result.updateId).toBeDefined();
  });

  test('updates company valuation report', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-valuation-update'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Create initial valuation
    const createResult = await ctx.ocp.OpenCapTableReports.companyValuationReport.createCompanyValuationReport({
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      valuationData: {
        id: generateTestId('valuation-to-update'),
        stock_class_id: stockClassSetup.stockClassData.id,
        price_per_share: { amount: '10.00', currency: 'USD' },
        effective_date: new Date().toISOString().split('T')[0],
        valuation_type: '409A',
      },
    });

    // Update valuation
    const updateResult = await ctx.ocp.OpenCapTableReports.companyValuationReport.updateCompanyValuationReport({
      companyValuationReportContractId: createResult.contractId,
      issuerParty: ctx.issuerParty,
      valuationData: {
        id: generateTestId('valuation-updated'),
        stock_class_id: stockClassSetup.stockClassData.id,
        price_per_share: { amount: '15.00', currency: 'USD' },
        effective_date: new Date().toISOString().split('T')[0],
        valuation_type: '409A',
      },
    });

    expect(updateResult.contractId).toBeDefined();
    expect(updateResult.contractId).not.toBe(createResult.contractId);
  });

  test('adds observers to company valuation report', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-valuation-observers'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Create valuation
    const createResult = await ctx.ocp.OpenCapTableReports.companyValuationReport.createCompanyValuationReport({
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      valuationData: {
        id: generateTestId('valuation-for-observers'),
        stock_class_id: stockClassSetup.stockClassData.id,
        price_per_share: { amount: '12.00', currency: 'USD' },
        effective_date: new Date().toISOString().split('T')[0],
        valuation_type: '409A',
      },
    });

    // Add observers (using the issuer party as an observer for testing)
    const observerResult =
      await ctx.ocp.OpenCapTableReports.companyValuationReport.addObserversToCompanyValuationReport({
        companyValuationReportContractId: createResult.contractId,
        added: [ctx.issuerParty],
      });

    expect(observerResult.contractId).toBeDefined();
    expect(observerResult.updateId).toBeDefined();
  });
});
