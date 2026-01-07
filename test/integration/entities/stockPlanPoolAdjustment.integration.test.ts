/**
 * Integration tests for StockPlanPoolAdjustment operations.
 *
 * Tests the full lifecycle of StockPlanPoolAdjustment entities:
 *
 * - Create adjustment and read back as valid OCF
 * - Data round-trip verification
 * - Archive operation
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStockPlanPoolAdjustmentData,
  generateTestId,
  setupTestIssuer,
  setupTestStockClass,
  setupTestStockPlan,
  setupTestStockPlanPoolAdjustment,
} from '../utils';

createIntegrationTestSuite('StockPlanPoolAdjustment operations', (getContext) => {
  test('creates stock plan pool adjustment and reads it back as valid OCF', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-pool-adj'),
        name: 'Common Stock',
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-for-pool-adj'),
        plan_name: 'Plan for Pool Adjustment',
        initial_shares_reserved: '500000',
      },
    });

    const adjustmentSetup = await setupTestStockPlanPoolAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockPlanId: planSetup.stockPlanData.id,
      adjustmentData: {
        id: generateTestId('pool-adj-ocf-test'),
        shares_reserved: '750000',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({
      contractId: adjustmentSetup.adjustmentContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_STOCK_PLAN_POOL_ADJUSTMENT');
    expect(ocfResult.event.shares_reserved).toBe('750000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('stock plan pool adjustment data round-trips correctly', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-pool-adj-rt'),
        name: 'Common Stock',
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-for-pool-adj-rt'),
        plan_name: 'Plan for Pool Adjustment Roundtrip',
        initial_shares_reserved: '500000',
      },
    });

    const originalData = createTestStockPlanPoolAdjustmentData(planSetup.stockPlanData.id, {
      id: generateTestId('pool-adj-roundtrip'),
      shares_reserved: '1000000',
      comments: ['Roundtrip test adjustment'],
    });

    const adjustmentSetup = await setupTestStockPlanPoolAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockPlanId: planSetup.stockPlanData.id,
      adjustmentData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({
      contractId: adjustmentSetup.adjustmentContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.stock_plan_id).toBe(originalData.stock_plan_id);
    expect(ocfResult.event.shares_reserved).toBe(originalData.shares_reserved);
  });

  // TODO: Archive test requires delete command to be exposed in OcpClient
  test.skip('archives stock plan pool adjustment', async () => {
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-pool-adj-archive'),
        name: 'Common Stock',
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-for-pool-adj-archive'),
        plan_name: 'Plan for Archive',
        initial_shares_reserved: '500000',
      },
    });

    const adjustmentSetup = await setupTestStockPlanPoolAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockPlanId: planSetup.stockPlanData.id,
      adjustmentData: {
        id: generateTestId('pool-adj-archive-test'),
        shares_reserved: '600000',
      },
    });

    // Archive operation not yet exposed in OcpClient
    expect(adjustmentSetup.adjustmentContractId).toBeDefined();
  });
});
