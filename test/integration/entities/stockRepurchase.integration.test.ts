/**
 * Integration tests for StockRepurchase operations.
 *
 * Tests the full lifecycle of StockRepurchase entities:
 *
 * - Create stock repurchase and read back as valid OCF
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
  createTestStockRepurchaseData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
  setupTestStockIssuance,
  setupTestStockRepurchase,
} from '../utils';

createIntegrationTestSuite('StockRepurchase operations', (getContext) => {
  test('creates stock repurchase and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-repurchase'),
        name: { legal_name: 'Repurchase Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-repurchase'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // First create a stock issuance
    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-repurchase'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Now repurchase some shares
    const repurchaseSetup = await setupTestStockRepurchase(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '25000',
      stockRepurchaseData: {
        id: generateTestId('repurchase-ocf-test'),
        price: { amount: '1.50', currency: 'USD' },
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockRepurchase.getStockRepurchaseAsOcf({
      contractId: repurchaseSetup.stockRepurchaseContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_STOCK_REPURCHASE');
    expect(ocfResult.event.quantity).toBe('25000');
    expect(ocfResult.event.price.amount).toBe('1.5');
    expect(ocfResult.event.price.currency).toBe('USD');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('stock repurchase data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-repurchase-rt'),
        name: { legal_name: 'Roundtrip Repurchase Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-repurchase-rt'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-repurchase-rt'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const originalData = createTestStockRepurchaseData(issuanceSetup.stockIssuanceData.security_id, '50000', {
      id: generateTestId('repurchase-roundtrip'),
      price: { amount: '2.00', currency: 'USD' },
      consideration_text: 'Cash consideration for stock repurchase',
      comments: ['Roundtrip test repurchase'],
    });

    const repurchaseSetup = await setupTestStockRepurchase(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '50000',
      stockRepurchaseData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockRepurchase.getStockRepurchaseAsOcf({
      contractId: repurchaseSetup.stockRepurchaseContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.security_id).toBe(originalData.security_id);
    expect(ocfResult.event.quantity).toBe(String(originalData.quantity));
    expect(ocfResult.event.price.amount).toBe('2');
    expect(ocfResult.event.price.currency).toBe('USD');
    expect(ocfResult.event.consideration_text).toBe(originalData.consideration_text);
  });

  test('deletes stock repurchase', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-for-repurchase-delete'),
        name: { legal_name: 'Delete Repurchase Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-repurchase-delete'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-repurchase-delete'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const repurchaseSetup = await setupTestStockRepurchase(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '10000',
      stockRepurchaseData: {
        id: generateTestId('repurchase-delete-test'),
        price: { amount: '1.25', currency: 'USD' },
      },
    });

    // Build and execute delete command
    const deleteCmd = ctx.ocp.OpenCapTable.stockRepurchase.buildDeleteStockRepurchaseCommand({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockRepurchaseId: repurchaseSetup.stockRepurchaseData.id,
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
