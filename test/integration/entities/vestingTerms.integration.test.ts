/**
 * Integration tests for VestingTerms operations.
 *
 * Tests the full lifecycle of VestingTerms entities:
 *
 * - Create vesting terms and read back as valid OCF
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
import { createTestVestingTermsData, generateTestId, setupTestIssuer, setupTestVestingTerms } from '../utils';

createIntegrationTestSuite('VestingTerms operations', (getContext) => {
  test('creates vesting terms and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const vestingSetup = await setupTestVestingTerms(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      vestingTermsData: {
        id: generateTestId('vesting-ocf-test'),
        name: 'Test Vesting Schedule',
      },
    });

    const ocfResult = await ctx.ocp.OpenCapTable.vestingTerms.getVestingTermsAsOcf({
      contractId: vestingSetup.vestingTermsContractId,
    });

    expect(ocfResult.vestingTerms.object_type).toBe('VESTING_TERMS');
    expect(ocfResult.vestingTerms.name).toBe('Test Vesting Schedule');

    await validateOcfObject(ocfResult.vestingTerms as unknown as Record<string, unknown>);
  });

  test('vesting terms data round-trips correctly', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const originalData = createTestVestingTermsData({
      id: generateTestId('vesting-roundtrip'),
      name: 'Roundtrip Vesting',
      description: 'Standard 4 year vesting for roundtrip test',
    });

    const vestingSetup = await setupTestVestingTerms(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      vestingTermsData: originalData,
    });

    const ocfResult = await ctx.ocp.OpenCapTable.vestingTerms.getVestingTermsAsOcf({
      contractId: vestingSetup.vestingTermsContractId,
    });

    expect(ocfResult.vestingTerms.id).toBe(originalData.id);
    expect(ocfResult.vestingTerms.name).toBe(originalData.name);
    expect(ocfResult.vestingTerms.description).toBe(originalData.description);
    expect(ocfResult.vestingTerms.allocation_type).toBe(originalData.allocation_type);
  });

  test('deletes vesting terms', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const vestingSetup = await setupTestVestingTerms(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      vestingTermsData: {
        id: generateTestId('vesting-archive-test'),
        name: 'Vesting To Archive',
      },
    });

    // Build and execute delete command using the NEW CapTable contract from vestingSetup
    const deleteCmd = buildUpdateCapTableCommand(
      {
        capTableContractId: vestingSetup.newCapTableContractId,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: vestingSetup.newCapTableContractDetails,
      },
      { deletes: [{ type: 'vestingTerms', id: vestingSetup.vestingTermsData.id }] }
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
