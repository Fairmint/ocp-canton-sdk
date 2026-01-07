/**
 * Integration tests for StockClass operations.
 *
 * This is the **complete example** demonstrating full test coverage for an entity type:
 *
 * - Create and read back as valid OCF
 * - Data round-trip verification
 * - COMMON stock class variant
 * - PREFERRED stock class variant with liquidation preferences
 * - Archive operation
 *
 * Use this file as a reference when adding tests for other entity types.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { createTestStockClassData, generateTestId, setupTestIssuer, setupTestStockClass } from '../utils';

createIntegrationTestSuite('StockClass operations', (getContext) => {
  test('creates stock class and reads it back as valid OCF', async () => {
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
        id: generateTestId('stock-class-common'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });

    expect(ocfResult.stockClass.object_type).toBe('STOCK_CLASS');
    expect(ocfResult.stockClass.name).toBe('Common Stock');
    expect(ocfResult.stockClass.class_type).toBe('COMMON');

    await validateOcfObject(ocfResult.stockClass as unknown as Record<string, unknown>);
  });

  test('stock class data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const originalData = createTestStockClassData({
      id: generateTestId('stock-class-roundtrip'),
      name: 'Roundtrip Test Stock',
      class_type: 'COMMON',
      default_id_prefix: 'RT-',
      initial_shares_authorized: '5000000',
      votes_per_share: '2',
      seniority: '1',
      comments: ['Test comment 1', 'Test comment 2'],
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });

    // Verify data round-trip
    expect(ocfResult.stockClass.id).toBe(originalData.id);
    expect(ocfResult.stockClass.name).toBe(originalData.name);
    expect(ocfResult.stockClass.class_type).toBe(originalData.class_type);
    expect(ocfResult.stockClass.default_id_prefix).toBe(originalData.default_id_prefix);
    expect(ocfResult.stockClass.initial_shares_authorized).toBe(originalData.initial_shares_authorized);
    expect(ocfResult.stockClass.votes_per_share).toBe(originalData.votes_per_share);
    expect(ocfResult.stockClass.seniority).toBe(originalData.seniority);
  });

  test('creates COMMON stock class', async () => {
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
        id: generateTestId('stock-class-common-variant'),
        name: 'Common Stock Class A',
        class_type: 'COMMON',
        default_id_prefix: 'CSA-',
        initial_shares_authorized: '20000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });

    expect(ocfResult.stockClass.class_type).toBe('COMMON');
    expect(ocfResult.stockClass.name).toBe('Common Stock Class A');
    await validateOcfObject(ocfResult.stockClass as unknown as Record<string, unknown>);
  });

  test('creates PREFERRED stock class with liquidation preferences', async () => {
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
        id: generateTestId('stock-class-preferred'),
        name: 'Series A Preferred',
        class_type: 'PREFERRED',
        default_id_prefix: 'PS-A-',
        initial_shares_authorized: '1000000',
        votes_per_share: '1',
        seniority: '2',
        price_per_share: { amount: '10.00', currency: 'USD' },
        liquidation_preference_multiple: '1',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });

    expect(ocfResult.stockClass.class_type).toBe('PREFERRED');
    expect(ocfResult.stockClass.name).toBe('Series A Preferred');
    expect(ocfResult.stockClass.seniority).toBe('2');
    await validateOcfObject(ocfResult.stockClass as unknown as Record<string, unknown>);
  });

  test('deletes stock class', async () => {
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
        id: generateTestId('stock-class-delete-test'),
        name: 'Stock To Delete',
        class_type: 'COMMON',
        default_id_prefix: 'STD-',
        initial_shares_authorized: '1000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Build and execute delete command
    const deleteCmd = ctx.ocp.OpenCapTable.stockClass.buildDeleteStockClassCommand({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassId: stockClassSetup.stockClassData.id,
    });

    const validDisclosedContracts = deleteCmd.disclosedContracts.filter(
      (dc) => dc.createdEventBlob && dc.createdEventBlob.length > 0
    );

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [deleteCmd.command],
      actAs: [ctx.issuerParty],
      disclosedContracts: validDisclosedContracts,
    });

    // Delete operation succeeded if no error thrown
  });
});
