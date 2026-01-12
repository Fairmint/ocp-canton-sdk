/**
 * Integration tests for complete stock issuance workflows.
 *
 * These tests exercise end-to-end stock lifecycle operations including:
 *
 * - Full cap table setup → stock issuance
 * - Stock issuance → transfer → balance tracking
 * - Stock issuance → cancellation
 * - Stock issuance → repurchase
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
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockCancellation,
  setupTestStockClass,
  setupTestStockIssuance,
  setupTestStockRepurchase,
  setupTestStockTransfer,
} from '../utils';

createIntegrationTestSuite('Stock issuance workflow', (getContext) => {
  /**
   * Test: Full stock issuance workflow
   *
   * This test verifies the complete happy path for issuing stock:
   *
   * 1. Create issuer
   * 2. Create stakeholder (founder)
   * 3. Create stock class
   * 4. Issue stock to stakeholder
   * 5. Read back and validate all entities
   */
  test('complete stock issuance workflow with all prerequisites', async () => {
    const ctx = getContext();

    // Step 1: Create issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('workflow-issuer'),
        legal_name: 'Stock Workflow Inc',
        formation_date: '2024-01-01',
        country_of_formation: 'US',
      },
    });

    // Step 2: Create stakeholder (founder)
    const founderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('workflow-founder'),
        name: { legal_name: 'Jane Founder', first_name: 'Jane', last_name: 'Founder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['FOUNDER'],
      },
    });

    // Step 3: Create stock class
    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: founderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: founderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('workflow-common'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'WF-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Step 4: Issue stock to founder
    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: founderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('workflow-issuance'),
        quantity: '1000000',
        share_price: { amount: '0.001', currency: 'USD' },
        issuance_type: 'FOUNDERS_STOCK',
        consideration_text: 'Founder stock grant for services',
      },
    });

    // Step 5: Validate all created entities
    const issuerOcf = await ctx.ocp.OpenCapTable.issuer.getIssuerAsOcf({
      contractId: issuerSetup.issuerOcfContractId,
    });
    expect(issuerOcf.issuer.legal_name).toBe('Stock Workflow Inc');
    await validateOcfObject(issuerOcf.issuer as unknown as Record<string, unknown>);

    const stakeholderOcf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: founderSetup.stakeholderContractId,
    });
    expect(stakeholderOcf.stakeholder.name.legal_name).toBe('Jane Founder');
    await validateOcfObject(stakeholderOcf.stakeholder as unknown as Record<string, unknown>);

    const stockClassOcf = await ctx.ocp.OpenCapTable.stockClass.getStockClassAsOcf({
      contractId: stockClassSetup.stockClassContractId,
    });
    expect(stockClassOcf.stockClass.name).toBe('Common Stock');
    await validateOcfObject(stockClassOcf.stockClass as unknown as Record<string, unknown>);

    const issuanceOcf = await ctx.ocp.OpenCapTable.stockIssuance.getStockIssuanceAsOcf({
      contractId: issuanceSetup.stockIssuanceContractId,
    });
    expect(issuanceOcf.stockIssuance.quantity).toBe('1000000');
    expect(issuanceOcf.stockIssuance.stakeholder_id).toBe(founderSetup.stakeholderData.id);
    expect(issuanceOcf.stockIssuance.stock_class_id).toBe(stockClassSetup.stockClassData.id);
    await validateOcfObject(issuanceOcf.stockIssuance as unknown as Record<string, unknown>);
  });

  /**
   * Test: Stock transfer workflow
   *
   * This test verifies partial stock transfer:
   *
   * 1. Setup cap table with issuance
   * 2. Transfer partial shares to new stakeholder
   * 3. Verify transfer record
   */
  test('stock transfer workflow - partial transfer', async () => {
    const ctx = getContext();

    // Setup: Create cap table with initial issuance
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('transfer-issuer'),
        legal_name: 'Transfer Test Corp',
      },
    });

    // Create seller stakeholder
    const sellerSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('transfer-seller'),
        name: { legal_name: 'Seller Person' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Create buyer stakeholder (for resulting security)
    const buyerSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: sellerSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: sellerSetup.newCapTableContractDetails,
      stakeholderData: {
        id: generateTestId('transfer-buyer'),
        name: { legal_name: 'Buyer Institution LLC' },
        stakeholder_type: 'INSTITUTION',
      },
    });

    // Create stock class
    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: buyerSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: buyerSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('transfer-stock-class'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'TR-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Issue stock to seller (10,000 shares)
    const originalQuantity = '10000';
    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: sellerSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('transfer-original-issuance'),
        quantity: originalQuantity,
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Transfer partial shares (2,500 of 10,000)
    const transferQuantity = '2500';
    const resultingSecurityId = generateTestId('transfer-resulting-security');
    const balanceSecurityId = generateTestId('transfer-balance-security');

    const transferSetup = await setupTestStockTransfer(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: transferQuantity,
      stockTransferData: {
        id: generateTestId('transfer-tx'),
        resulting_security_ids: [resultingSecurityId],
        balance_security_id: balanceSecurityId,
        consideration_text: 'Secondary sale at $2.00 per share',
      },
    });

    // Verify transfer record
    const transferOcf = await ctx.ocp.OpenCapTable.stockTransfer.getStockTransferAsOcf({
      contractId: transferSetup.stockTransferContractId,
    });

    expect(transferOcf.event.object_type).toBe('TX_STOCK_TRANSFER');
    expect(transferOcf.event.quantity).toBe(transferQuantity);
    expect(transferOcf.event.security_id).toBe(issuanceSetup.stockIssuanceData.security_id);
    expect(transferOcf.event.resulting_security_ids).toContain(resultingSecurityId);
    expect(transferOcf.event.balance_security_id).toBe(balanceSecurityId);

    await validateOcfObject(transferOcf.event as unknown as Record<string, unknown>);
  });

  /**
   * Test: Stock cancellation workflow
   *
   * This test verifies stock cancellation:
   *
   * 1. Setup cap table with issuance
   * 2. Cancel partial shares
   * 3. Verify cancellation record
   */
  test('stock cancellation workflow', async () => {
    const ctx = getContext();

    // Setup cap table
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('cancel-issuer'),
        legal_name: 'Cancellation Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('cancel-stakeholder'),
        name: { legal_name: 'Departing Employee' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['EMPLOYEE'],
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('cancel-stock-class'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CN-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    // Issue RSA stock (5,000 shares with vesting)
    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('cancel-issuance'),
        quantity: '5000',
        share_price: { amount: '1.00', currency: 'USD' },
        issuance_type: 'RSA',
      },
    });

    // Cancel unvested shares (3,000 of 5,000 - employee left before vesting)
    const cancelQuantity = '3000';
    const balanceSecurityId = generateTestId('cancel-balance-security');

    const cancellationSetup = await setupTestStockCancellation(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: cancelQuantity,
      stockCancellationData: {
        id: generateTestId('cancel-tx'),
        reason_text: 'Employee terminated before vesting - unvested shares cancelled',
        balance_security_id: balanceSecurityId,
      },
    });

    // Verify cancellation record
    const cancellationOcf = await ctx.ocp.OpenCapTable.stockCancellation.getStockCancellationEventAsOcf({
      contractId: cancellationSetup.stockCancellationContractId,
    });

    expect(cancellationOcf.event.object_type).toBe('TX_STOCK_CANCELLATION');
    expect(cancellationOcf.event.quantity).toBe(cancelQuantity);
    expect(cancellationOcf.event.security_id).toBe(issuanceSetup.stockIssuanceData.security_id);
    expect(cancellationOcf.event.balance_security_id).toBe(balanceSecurityId);
    expect(cancellationOcf.event.reason_text).toContain('unvested');

    await validateOcfObject(cancellationOcf.event as unknown as Record<string, unknown>);
  });

  /**
   * Test: Stock repurchase workflow
   *
   * This test verifies company stock buyback:
   *
   * 1. Setup cap table with issuance
   * 2. Repurchase shares at current market price
   * 3. Verify repurchase record
   */
  test('stock repurchase workflow', async () => {
    const ctx = getContext();

    // Setup cap table
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('repurchase-issuer'),
        legal_name: 'Repurchase Test Corp',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('repurchase-stakeholder'),
        name: { legal_name: 'Early Investor' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR'],
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('repurchase-stock-class'),
        name: 'Series A Preferred',
        class_type: 'PREFERRED',
        default_id_prefix: 'RP-',
        initial_shares_authorized: '5000000',
        votes_per_share: '1',
        seniority: '2',
      },
    });

    // Issue preferred stock (100,000 shares at $5.00)
    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('repurchase-issuance'),
        quantity: '100000',
        share_price: { amount: '5.00', currency: 'USD' },
      },
    });

    // Repurchase 25,000 shares at $10.00 (2x appreciation)
    const repurchaseQuantity = '25000';
    const balanceSecurityId = generateTestId('repurchase-balance-security');

    const repurchaseSetup = await setupTestStockRepurchase(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: repurchaseQuantity,
      stockRepurchaseData: {
        id: generateTestId('repurchase-tx'),
        price: { amount: '10.00', currency: 'USD' },
        balance_security_id: balanceSecurityId,
        consideration_text: 'Company buyback at 2x original price',
      },
    });

    // Verify repurchase record
    const repurchaseOcf = await ctx.ocp.OpenCapTable.stockRepurchase.getStockRepurchaseAsOcf({
      contractId: repurchaseSetup.stockRepurchaseContractId,
    });

    expect(repurchaseOcf.event.object_type).toBe('TX_STOCK_REPURCHASE');
    expect(repurchaseOcf.event.quantity).toBe(repurchaseQuantity);
    expect(repurchaseOcf.event.security_id).toBe(issuanceSetup.stockIssuanceData.security_id);
    expect(repurchaseOcf.event.balance_security_id).toBe(balanceSecurityId);
    expect(repurchaseOcf.event.price.amount).toBe('10.00');

    await validateOcfObject(repurchaseOcf.event as unknown as Record<string, unknown>);
  });
});
