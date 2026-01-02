/**
 * Integration tests for StockIssuance operations.
 *
 * Tests the full lifecycle of StockIssuance entities:
 *
 * - Create stock issuance and read back as valid OCF
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
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStockIssuanceData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockClass,
  setupTestStockIssuance,
} from '../utils';

createIntegrationTestSuite('StockIssuance operations', (getContext) => {
  test('creates stock issuance and reads it back as valid OCF', async () => {
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
      stakeholderData: {
        id: generateTestId('stakeholder-for-issuance'),
        name: { legal_name: 'Shareholder One' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-issuance'),
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
        id: generateTestId('issuance-ocf-test'),
        quantity: '50000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockIssuance.getStockIssuanceAsOcf({
      contractId: issuanceSetup.stockIssuanceContractId,
    });

    expect(ocfResult.stockIssuance.object_type).toBe('TX_STOCK_ISSUANCE');
    expect(ocfResult.stockIssuance.quantity).toBe('50000');

    await validateOcfObject(ocfResult.stockIssuance as unknown as Record<string, unknown>);
  });

  test('stock issuance data round-trips correctly', async () => {
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
      stakeholderData: {
        id: generateTestId('stakeholder-for-issuance-rt'),
        name: { legal_name: 'Roundtrip Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-issuance-rt'),
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS-',
        initial_shares_authorized: '10000000',
        votes_per_share: '1',
        seniority: '1',
      },
    });

    const originalData = createTestStockIssuanceData(
      stakeholderSetup.stakeholderData.id,
      stockClassSetup.stockClassData.id,
      {
        id: generateTestId('issuance-roundtrip'),
        quantity: '75000',
        share_price: { amount: '2.50', currency: 'USD' },
        comments: ['Roundtrip test issuance'],
      }
    );

    const issuanceSetup = await setupTestStockIssuance(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      stockClassId: stockClassSetup.stockClassData.id,
      stockIssuanceData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockIssuance.getStockIssuanceAsOcf({
      contractId: issuanceSetup.stockIssuanceContractId,
    });

    expect(ocfResult.stockIssuance.id).toBe(originalData.id);
    expect(ocfResult.stockIssuance.stakeholder_id).toBe(originalData.stakeholder_id);
    expect(ocfResult.stockIssuance.stock_class_id).toBe(originalData.stock_class_id);
    expect(ocfResult.stockIssuance.quantity).toBe(originalData.quantity);
  });

  test('creates founders stock issuance', async () => {
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
      stakeholderData: {
        id: generateTestId('founder-stakeholder'),
        name: { legal_name: 'Founder One' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-founders'),
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
        id: generateTestId('founders-issuance'),
        quantity: '1000000',
        share_price: { amount: '0.001', currency: 'USD' },
        issuance_type: 'FOUNDERS_STOCK',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockIssuance.getStockIssuanceAsOcf({
      contractId: issuanceSetup.stockIssuanceContractId,
    });

    expect(ocfResult.stockIssuance.object_type).toBe('TX_STOCK_ISSUANCE');
    await validateOcfObject(ocfResult.stockIssuance as unknown as Record<string, unknown>);
  });

  test('archives stock issuance', async () => {
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
      stakeholderData: {
        id: generateTestId('stakeholder-for-archive-issuance'),
        name: { legal_name: 'Archive Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      stockClassData: {
        id: generateTestId('stock-class-for-archive-issuance'),
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
        id: generateTestId('issuance-archive-test'),
        quantity: '10000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const archiveCmd = ctx.ocp.OpenCapTable.stockIssuance.buildArchiveStockIssuanceByIssuerCommand({
      contractId: issuanceSetup.stockIssuanceContractId,
    });

    await ctx.ocp.client.submitAndWaitForTransactionTree({
      commands: [archiveCmd],
      actAs: [ctx.issuerParty],
    });

    // Archive operation succeeded if no error thrown
  });
});

