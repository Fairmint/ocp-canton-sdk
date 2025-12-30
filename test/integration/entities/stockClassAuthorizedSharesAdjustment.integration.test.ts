/**
 * Integration tests for StockClassAuthorizedSharesAdjustment operations.
 *
 * This demonstrates the **related event pattern** - testing a transaction/event type that modifies a core entity
 * (StockClass).
 *
 * Tests the full lifecycle of StockClassAuthorizedSharesAdjustment:
 *
 * - Create adjustment and read back as valid OCF
 * - Data round-trip verification
 * - Validates stock_class_id reference
 * - Archive operation
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStockClassAuthorizedSharesAdjustmentData,
  generateDateString,
  generateTestId,
  setupTestIssuer,
  setupTestStockClass,
  setupTestStockClassAuthorizedSharesAdjustment,
} from '../utils';

createIntegrationTestSuite('StockClassAuthorizedSharesAdjustment operations', (getContext) => {
  test('creates adjustment and reads it back as valid OCF', async () => {

    const ctx = getContext();

    // Setup: Create issuer and stock class first
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
        id: generateTestId('stock-class-for-adjustment'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'ADJ-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Create the adjustment
    const adjustmentSetup = await setupTestStockClassAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
      adjustmentData: {
        id: generateTestId('adjustment-ocf-test'),
        new_shares_authorized: '25000000',
      },
    });

    // Read back as OCF
    const ocfResult =
      await ctx.ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    // Validate OCF structure
    expect(ocfResult.event.object_type).toBe('TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT');
    expect(ocfResult.event.new_shares_authorized).toBe('25000000');
    expect(ocfResult.event.stock_class_id).toBe(stockClassSetup.stockClassData.id);

    // Validate against official OCF schema
    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('adjustment data round-trips correctly', async () => {

    const ctx = getContext();

    // Setup
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
    });

    const originalData = createTestStockClassAuthorizedSharesAdjustmentData(stockClassSetup.stockClassData.id, {
      id: generateTestId('adjustment-roundtrip'),
      new_shares_authorized: '30000000',
      board_approval_date: '2024-01-15',
      stockholder_approval_date: '2024-01-20',
      comments: ['Roundtrip test comment 1', 'Roundtrip test comment 2'],
    });

    const adjustmentSetup = await setupTestStockClassAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
      adjustmentData: originalData,
    });

    const ocfResult =
      await ctx.ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    // Verify data round-trip
    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.stock_class_id).toBe(originalData.stock_class_id);
    expect(ocfResult.event.new_shares_authorized).toBe(String(originalData.new_shares_authorized));
    expect(ocfResult.event.board_approval_date).toBe(originalData.board_approval_date);
    expect(ocfResult.event.stockholder_approval_date).toBe(originalData.stockholder_approval_date);
  });

  test('adjustment references correct stock class', async () => {

    const ctx = getContext();

    // Setup with specific stock class ID
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stockClassId = generateTestId('specific-stock-class');
    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: stockClassId,
        name: 'Specific Stock Class',
        class_type: 'COMMON',
        default_id_prefix: 'SSC-',
        initial_shares_authorized: '5000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const adjustmentSetup = await setupTestStockClassAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
      adjustmentData: {
        id: generateTestId('adjustment-reference-test'),
        new_shares_authorized: '15000000',
      },
    });

    const ocfResult =
      await ctx.ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    // The adjustment should reference the correct stock class ID
    expect(ocfResult.event.stock_class_id).toBe(stockClassId);
    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('archives adjustment', async () => {

    const ctx = getContext();

    // Setup
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
    });

    const adjustmentSetup = await setupTestStockClassAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
      adjustmentData: {
        id: generateTestId('adjustment-archive-test'),
        new_shares_authorized: '12000000',
      },
    });

    // Build and execute archive command
    const archiveCmd =
      ctx.ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Verify the archive operation succeeded without error
    // The contract is now archived and cannot be exercised again
  });

  test('creates adjustment with all optional fields', async () => {

    const ctx = getContext();

    // Setup
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
    });

    // Create adjustment with all optional fields populated
    const adjustmentSetup = await setupTestStockClassAuthorizedSharesAdjustment(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
      adjustmentData: {
        id: generateTestId('adjustment-full-fields'),
        date: generateDateString(),
        new_shares_authorized: '50000000',
        board_approval_date: generateDateString(-14),
        stockholder_approval_date: generateDateString(-7),
        comments: ['Full fields test', 'Multiple comments supported'],
      },
    });

    const ocfResult =
      await ctx.ocp.OpenCapTable.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf(
        {
          contractId: adjustmentSetup.adjustmentContractId,
        }
      );

    expect(ocfResult.event.new_shares_authorized).toBe('50000000');
    expect(ocfResult.event.board_approval_date).toBeDefined();
    expect(ocfResult.event.stockholder_approval_date).toBeDefined();
    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });
});
