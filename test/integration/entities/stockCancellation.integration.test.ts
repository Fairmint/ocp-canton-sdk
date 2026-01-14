/**
 * Integration tests for StockCancellation operations.
 *
 * Tests the full lifecycle of StockCancellation entities:
 *
 * - Create stock cancellation and read back as valid OCF
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
  createTestStockCancellationData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestStockCancellation,
  setupTestStockClass,
  setupTestStockIssuance,
} from '../utils';

createIntegrationTestSuite('StockCancellation operations', (getContext) => {
  test('creates stock cancellation and reads it back as valid OCF', async () => {
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
        id: generateTestId('stakeholder-for-cancellation'),
        name: { legal_name: 'Cancellation Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-cancellation'),
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
        id: generateTestId('issuance-for-cancellation'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    // Now cancel some shares
    const cancellationSetup = await setupTestStockCancellation(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '25000',
      stockCancellationData: {
        id: generateTestId('cancellation-ocf-test'),
        reason_text: 'Test cancellation',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockCancellation.getStockCancellationEventAsOcf({
      contractId: cancellationSetup.stockCancellationContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_STOCK_CANCELLATION');
    expect(ocfResult.event.quantity).toBe('25000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('stock cancellation data round-trips correctly', async () => {
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
        id: generateTestId('stakeholder-for-cancellation-rt'),
        name: { legal_name: 'Roundtrip Cancellation Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-cancellation-rt'),
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
        id: generateTestId('issuance-for-cancellation-rt'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const originalData = createTestStockCancellationData(issuanceSetup.stockIssuanceData.security_id, '50000', {
      id: generateTestId('cancellation-roundtrip'),
      reason_text: 'Roundtrip test cancellation reason',
      comments: ['Roundtrip test cancellation'],
    });

    const cancellationSetup = await setupTestStockCancellation(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '50000',
      stockCancellationData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.stockCancellation.getStockCancellationEventAsOcf({
      contractId: cancellationSetup.stockCancellationContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.security_id).toBe(originalData.security_id);
    expect(ocfResult.event.quantity).toBe(originalData.quantity);
    expect(ocfResult.event.reason_text).toBe(originalData.reason_text);
  });

  test('deletes stock cancellation', async () => {
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
        id: generateTestId('stakeholder-for-cancellation-archive'),
        name: { legal_name: 'Archive Cancellation Shareholder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const stockClassSetup = await setupTestStockClass(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stockClassData: {
        id: generateTestId('stock-class-for-cancellation-archive'),
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
        id: generateTestId('issuance-for-cancellation-archive'),
        quantity: '100000',
        share_price: { amount: '1.00', currency: 'USD' },
      },
    });

    const cancellationSetup = await setupTestStockCancellation(ctx.ocp, {
      issuerContractId: issuanceSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuanceSetup.newCapTableContractDetails,
      securityId: issuanceSetup.stockIssuanceData.security_id,
      quantity: '10000',
      stockCancellationData: {
        id: generateTestId('cancellation-archive-test'),
        reason_text: 'Archive test cancellation',
      },
    });

    // Build and execute delete command using the NEW CapTable contract from cancellationSetup
    const deleteCmd = buildUpdateCapTableCommand(
      {
        capTableContractId: cancellationSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: cancellationSetup.newCapTableContractDetails,
      },
      { deletes: [{ type: 'stockCancellation', id: cancellationSetup.stockCancellationData.id }] }
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
