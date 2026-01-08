/**
 * Integration tests for StockTransfer operations.
 *
 * Tests the full lifecycle of StockTransfer entities:
 *
 * - Create stock transfer and read back as valid OCF
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
  createTestStockTransferData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
  setupTestStockIssuance,
  setupTestStockTransfer,
} from '../utils';

createIntegrationTestSuite('StockTransfer operations', (getContext) => {
  test('creates stock transfer and reads it back as valid OCF', async () => {
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
        id: generateTestId('stakeholder-for-transfer'),
        name: { legal_name: 'Transfer Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-transfer'),
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
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-transfer'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Now transfer some shares
    const transferSetup = await setupTestStockTransfer(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '25000',
      stockTransferData: {
        id: generateTestId('transfer-ocf-test'),
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockTransfer.getStockTransferAsOcf({
      contractId: transferSetup.stockTransferContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_STOCK_TRANSFER');
    expect(ocfResult.event.quantity).toBe('25000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('stock transfer data round-trips correctly', async () => {
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
        id: generateTestId('stakeholder-for-transfer-rt'),
        name: { legal_name: 'Roundtrip Transfer Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-transfer-rt'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: stockClassSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stockClassSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-transfer-rt'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const originalData = createTestStockTransferData(issuanceSetup.stockIssuanceData.security_id, '50000', {
      id: generateTestId('transfer-roundtrip'),
      consideration_text: 'Cash consideration',
      comments: ['Roundtrip test transfer'],
    });

    const transferSetup = await setupTestStockTransfer(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '50000',
      stockTransferData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockTransfer.getStockTransferAsOcf({
      contractId: transferSetup.stockTransferContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.security_id).toBe(originalData.security_id);
    expect(ocfResult.event.quantity).toBe(originalData.quantity);
  });

  // TODO: Archive test requires buildDeleteStockTransferCommand to be exposed in OcpClient
  test.skip('archives stock transfer', async () => {
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
        id: generateTestId('stakeholder-for-transfer-archive'),
        name: { legal_name: 'Archive Transfer Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-transfer-archive'),
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
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: {
        id: generateTestId('issuance-for-transfer-archive'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const transferSetup = await setupTestStockTransfer(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '10000',
      stockTransferData: {
        id: generateTestId('transfer-archive-test'),
      },
    });

    // Archive operation not yet exposed in OcpClient
    expect(transferSetup.stockTransferContractId).toBeDefined();
  });
});
