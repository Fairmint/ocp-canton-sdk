/**
 * Integration tests for StockPlan operations.
 *
 * Tests the full lifecycle of StockPlan entities:
 *
 * - Create stock plan and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';
import {
  createTestStockPlanData,
  generateTestId,
  setupTestIssuer,
  setupTestStockClass,
  setupTestStockPlan,
} from '../utils';

createIntegrationTestSuite('StockPlan operations', (getContext) => {
  test('creates stock plan and reads it back as valid OCF', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-plan'),
        name: 'Common Stock for Plan',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const planSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-ocf-test'),
        plan_name: 'Test Equity Incentive Plan',
        initial_shares_reserved: '500000',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockPlan.getStockPlanAsOcf({
      contractId: planSetup.stockPlanContractId,
    });

    expect(ocfResult.stockPlan.object_type).toBe('STOCK_PLAN');
    expect(ocfResult.stockPlan.plan_name).toBe('Test Equity Incentive Plan');

    await validateOcfObject(ocfResult.stockPlan as unknown as Record<string, unknown>);
  });

  test('stock plan data round-trips correctly', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-plan-rt'),
        name: 'Common Stock for Roundtrip Plan',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const originalData = createTestStockPlanData([stockClassSetup.stockClassData.id], {
      id: generateTestId('plan-roundtrip'),
      plan_name: 'Roundtrip Plan',
      initial_shares_reserved: '750000',
      default_cancellation_behavior: 'RETURN_TO_POOL',
      comments: ['Roundtrip test plan'],
    });

    const planSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockPlan.getStockPlanAsOcf({
      contractId: planSetup.stockPlanContractId,
    });

    expect(ocfResult.stockPlan.id).toBe(originalData.id);
    expect(ocfResult.stockPlan.plan_name).toBe(originalData.plan_name);
    expect(ocfResult.stockPlan.initial_shares_reserved).toBe(originalData.initial_shares_reserved);
  });

  test('archives stock plan', async () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-archive-plan'),
        name: 'Common Stock for Archive Plan',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const planSetup = await setupTestStockPlan(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-archive-test'),
        plan_name: 'Plan To Archive',
        initial_shares_reserved: '250000',
      },
    });

    const archiveCmd = ctx.ocp.OpenCapTable.stockPlan.buildArchiveStockPlanByIssuerCommand({
      contractId: planSetup.stockPlanContractId,
    });

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});
