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
 * npm run test:integration
 * ```
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { buildUpdateCapTableCommand } from '../../../src/functions/OpenCapTable';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStockPlanData,
  generateTestId,
  setupTestIssuer,
  setupTestStockClass,
  setupTestStockPlan,
} from '../utils';

createIntegrationTestSuite('StockPlan operations', (getContext) => {
  test('creates stock plan and reads it back as valid OCF', async () => {
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
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
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
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
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

  test('deletes stock plan', async () => {
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
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stockClassIds: [stockClassSetup.stockClassData.id],
      stockPlanData: {
        id: generateTestId('plan-archive-test'),
        plan_name: 'Plan To Archive',
        initial_shares_reserved: '250000',
      },
    });

    // Build and execute delete command using the NEW CapTable contract from planSetup
    const deleteCmd = buildUpdateCapTableCommand(
      {
        capTableContractId: planSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: planSetup.newCapTableContractDetails,
      },
      { deletes: [{ type: 'stockPlan', id: planSetup.stockPlanData.id }] }
    );

    const validDisclosedContracts = deleteCmd.disclosedContracts.filter(
      (dc: DisclosedContract) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [deleteCmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    // Delete operation succeeded if no error thrown
  });
});
