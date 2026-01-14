/**
 * Integration tests for WarrantIssuance operations.
 *
 * Tests the full lifecycle of WarrantIssuance entities:
 *
 * - Create warrant issuance and read back as valid OCF
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
  createTestWarrantIssuanceData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
  setupTestWarrantIssuance,
} from '../utils';

createIntegrationTestSuite('WarrantIssuance operations', (getContext) => {
  test('creates warrant issuance and reads it back as valid OCF', async () => {
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
        id: generateTestId('stakeholder-for-warrant'),
        name: { legal_name: 'Warrant Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const warrantSetup = await setupTestWarrantIssuance(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      warrantIssuanceData: {
        id: generateTestId('warrant-ocf-test'),
        quantity: '10000',
        exercise_price: { amount: '5.00', currency: 'USD' },
        purchase_price: { amount: '0.01', currency: 'USD' },
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.warrantIssuance.getWarrantIssuanceAsOcf({
      contractId: warrantSetup.warrantIssuanceContractId,
    });

    expect(ocfResult.event.object_type).toBe('TX_WARRANT_ISSUANCE');
    expect(ocfResult.event.quantity).toBe('10000');

    await validateOcfObject(ocfResult.event as unknown as Record<string, unknown>);
  });

  test('warrant issuance data round-trips correctly', async () => {
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
        id: generateTestId('stakeholder-for-warrant-rt'),
        name: { legal_name: 'Roundtrip Warrant Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const originalData = createTestWarrantIssuanceData(stakeholderSetup.stakeholderData.id, {
      id: generateTestId('warrant-roundtrip'),
      quantity: '15000',
      exercise_price: { amount: '3.50', currency: 'USD' },
      purchase_price: { amount: '0.05', currency: 'USD' },
      comments: ['Roundtrip test warrant'],
    });

    const warrantSetup = await setupTestWarrantIssuance(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      warrantIssuanceData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.warrantIssuance.getWarrantIssuanceAsOcf({
      contractId: warrantSetup.warrantIssuanceContractId,
    });

    expect(ocfResult.event.id).toBe(originalData.id);
    expect(ocfResult.event.stakeholder_id).toBe(originalData.stakeholder_id);
    expect(ocfResult.event.quantity).toBe(originalData.quantity);
  });

  test('deletes warrant issuance', async () => {
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
        id: generateTestId('stakeholder-for-warrant-archive'),
        name: { legal_name: 'Archive Warrant Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    const warrantSetup = await setupTestWarrantIssuance(ctx.ocp, {
      issuerContractId: stakeholderSetup.newCapTableContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      stakeholderId: stakeholderSetup.stakeholderData.id,
      warrantIssuanceData: {
        id: generateTestId('warrant-archive-test'),
        quantity: '5000',
        exercise_price: { amount: '4.00', currency: 'USD' },
        purchase_price: { amount: '0.01', currency: 'USD' },
      },
    });

    // Build and execute delete command using the NEW CapTable contract from warrantSetup
    const deleteCmd = buildUpdateCapTableCommand(
      {
        capTableContractId: warrantSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: warrantSetup.newCapTableContractDetails,
      },
      { deletes: [{ type: 'warrantIssuance', id: warrantSetup.warrantIssuanceData.id }] }
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
