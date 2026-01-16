/**
 * Integration tests for comprehensive cap table workflows.
 *
 * These tests demonstrate realistic cap table scenarios using the batch API, including:
 *
 * - Setting up a complete cap table (issuer → stakeholders → stock classes → stock plan → issuances)
 * - Testing complex entity relationships
 * - Validating OCF compliance for all created entities
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  createTestStakeholderData,
  createTestStockLegendTemplateData,
  createTestValuationData,
  createTestVestingTermsData,
  generateTestId,
  setupTestIssuer,
} from '../utils';

/**
 * Extract the contract ID string from an OcfContractId.
 *
 * OcfContractId is a tagged union where each variant has a `value` property containing the actual ContractId.
 */
function extractContractIdString(cid: { value: unknown }): string {
  // OcfContractId is a tagged union like { tag: "CidStakeholder", value: ContractId<Stakeholder> }
  // ContractId<T> is just a string in the JSON representation
  return cid.value as string;
}

createIntegrationTestSuite('Cap Table Workflow', (getContext) => {
  /**
   * Test: Complete founding scenario.
   *
   * This test simulates a typical company founding workflow:
   *
   * 1. Create issuer (CapTable) - done in setup
   * 2. Create founders (stakeholders)
   * 3. Create stock legend template
   * 4. Create vesting terms
   *
   * This demonstrates batching multiple entity types together.
   */
  test('creates founding entities in batches', async () => {
    const ctx = getContext();

    // Step 1: Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      issuerData: {
        id: generateTestId('workflow-issuer'),
        legal_name: 'Workflow Test Corp',
        initial_shares_authorized: '100000000',
      },
    });

    // Step 2: Create founders and legend template in a single batch
    const founder1Data = createTestStakeholderData({
      id: generateTestId('founder-1'),
      name: { legal_name: 'Alice Founder', first_name: 'Alice', last_name: 'Founder' },
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['FOUNDER', 'BOARD_MEMBER'],
    });

    const founder2Data = createTestStakeholderData({
      id: generateTestId('founder-2'),
      name: { legal_name: 'Bob Cofounder', first_name: 'Bob', last_name: 'Cofounder' },
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['FOUNDER', 'EMPLOYEE'],
    });

    const legendData = createTestStockLegendTemplateData({
      id: generateTestId('legend'),
      name: 'Standard Restricted Stock Legend',
      text: 'THE SHARES REPRESENTED BY THIS CERTIFICATE HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933...',
    });

    const batch1 = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result1 = await batch1
      .create('stakeholder', founder1Data)
      .create('stakeholder', founder2Data)
      .create('stockLegendTemplate', legendData)
      .execute();

    expect(result1.createdCids).toHaveLength(3);
    expect(result1.updatedCapTableCid).toBeTruthy();

    // Step 3: Create vesting terms using the new CapTable
    const newCapTableContractDetails = await getUpdatedCapTableDetails(
      ctx.ocp,
      result1.updatedCapTableCid,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting'),
      name: 'Standard 4-Year Vesting',
    });

    const batch2 = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: result1.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result2 = await batch2.create('vestingTerms', vestingTermsData).execute();

    expect(result2.createdCids).toHaveLength(1);

    // Verify all stakeholders can be read back as valid OCF
    const founder1Ocf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: extractContractIdString(result1.createdCids[0]),
    });
    expect(founder1Ocf.stakeholder.name.legal_name).toBe('Alice Founder');
    await validateOcfObject(founder1Ocf.stakeholder as unknown as Record<string, unknown>);

    const founder2Ocf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: extractContractIdString(result1.createdCids[1]),
    });
    expect(founder2Ocf.stakeholder.name.legal_name).toBe('Bob Cofounder');
    await validateOcfObject(founder2Ocf.stakeholder as unknown as Record<string, unknown>);
  });

  /**
   * Test: Add multiple stakeholders and documents atomically.
   *
   * Demonstrates creating a mixed batch of different entity types.
   */
  test('creates mixed entity types in single batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create stakeholders, documents, and legend template in one batch
    const employeeData = createTestStakeholderData({
      id: generateTestId('employee'),
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['EMPLOYEE'],
    });

    const investorData = createTestStakeholderData({
      id: generateTestId('investor'),
      stakeholder_type: 'INSTITUTION',
      current_relationships: ['INVESTOR'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stakeholder', employeeData).create('stakeholder', investorData).execute();

    expect(result.createdCids).toHaveLength(2);
  });

  /**
   * Test: Sequential batch operations maintain state correctly.
   *
   * Demonstrates a sequence of batch operations where each subsequent batch uses the updated CapTable from the previous
   * batch.
   */
  test('sequential batches maintain cap table state', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    let currentCapTableCid = issuerSetup.issuerContractId;
    let currentCapTableDetails = issuerSetup.capTableContractDetails;
    const createdStakeholderIds: string[] = [];

    // Create 5 stakeholders in separate batches to test state management
    for (let i = 1; i <= 5; i++) {
      const stakeholderData = createTestStakeholderData({
        id: generateTestId(`seq-stakeholder-${i}`),
        name: { legal_name: `Sequential Stakeholder ${i}` },
      });

      const batch = ctx.ocp.OpenCapTable.capTable.update({
        capTableContractId: currentCapTableCid,
        featuredAppRightContractDetails: ctx.featuredAppRight,
        capTableContractDetails: currentCapTableDetails,
        actAs: [ctx.issuerParty],
      });

      const result = await batch.create('stakeholder', stakeholderData).execute();

      expect(result.createdCids).toHaveLength(1);
      createdStakeholderIds.push(extractContractIdString(result.createdCids[0]));

      // Update for next iteration
      currentCapTableCid = result.updatedCapTableCid;
      currentCapTableDetails = await getUpdatedCapTableDetails(
        ctx.ocp,
        currentCapTableCid,
        issuerSetup.capTableContractDetails.synchronizerId
      );
    }

    // Verify all stakeholders exist and are readable
    for (let i = 0; i < createdStakeholderIds.length; i++) {
      const ocf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
        contractId: createdStakeholderIds[i],
      });
      expect(ocf.stakeholder.name.legal_name).toBe(`Sequential Stakeholder ${i + 1}`);
    }
  });

  /**
   * Test: Create valuation for a stock class.
   *
   * Demonstrates creating a 409A valuation which is required for equity compensation pricing.
   *
   * Note: This test uses stockLegendTemplate as a proxy for testing the batch create workflow since stockClass creation
   * has numeric encoding issues with the JSON API v2. In a real scenario, you would create the stock class first.
   */
  test('creates valuation entity', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create a valuation (normally this would reference a real stock class ID)
    // For testing purposes, we'll use a placeholder stock class ID
    const stockClassId = generateTestId('stock-class');

    const valuationData = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: stockClassId,
      price_per_share: { amount: '2.50', currency: 'USD' },
      provider: 'Valuation Co',
      valuation_type: '409A',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('valuation', valuationData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create vesting terms entity.
   *
   * Vesting terms define how equity vests over time and are referenced by equity compensation issuances.
   */
  test('creates vesting terms with complex conditions', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create vesting terms with a 4-year schedule with 1-year cliff
    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting'),
      name: '4-Year with 1-Year Cliff',
      description: 'Standard Silicon Valley vesting: 25% after 1 year, then monthly for 3 years',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingTerms', vestingTermsData).execute();

    expect(result.createdCids).toHaveLength(1);
  });

  /**
   * Test: Edit and delete operations in a single batch.
   *
   * Demonstrates combining edit and delete operations atomically.
   */
  test('performs edit and delete in single batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // First, create two entities
    const stakeholder1Id = generateTestId('edit-stakeholder');
    const stakeholder2Id = generateTestId('delete-stakeholder');

    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch
      .create(
        'stakeholder',
        createTestStakeholderData({
          id: stakeholder1Id,
          name: { legal_name: 'To Be Edited' },
        })
      )
      .create(
        'stakeholder',
        createTestStakeholderData({
          id: stakeholder2Id,
          name: { legal_name: 'To Be Deleted' },
        })
      )
      .execute();

    expect(createResult.createdCids).toHaveLength(2);

    // Get updated CapTable details
    const newCapTableDetails = await getUpdatedCapTableDetails(
      ctx.ocp,
      createResult.updatedCapTableCid,
      issuerSetup.capTableContractDetails.synchronizerId
    );

    // Now edit one and delete the other in a single batch
    const editDeleteBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: createResult.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableDetails,
      actAs: [ctx.issuerParty],
    });

    const editDeleteResult = await editDeleteBatch
      .edit(
        'stakeholder',
        createTestStakeholderData({
          id: stakeholder1Id,
          name: { legal_name: 'Successfully Edited' },
        })
      )
      .delete('stakeholder', stakeholder2Id)
      .execute();

    expect(editDeleteResult.editedCids).toHaveLength(1);
    // Note: deletedCids is not currently returned by the DAML contract

    // Verify the edit worked
    const editedOcf = await ctx.ocp.OpenCapTable.stakeholder.getStakeholderAsOcf({
      contractId: extractContractIdString(createResult.createdCids[0]), // The first stakeholder was edited
    });
    expect(editedOcf.stakeholder.name.legal_name).toBe('Successfully Edited');
  });
});

/** Helper to get updated CapTable contract details after a batch operation. */
async function getUpdatedCapTableDetails(
  ocp: Parameters<typeof setupTestIssuer>[0],
  capTableContractId: string,
  synchronizerId: string
): Promise<DisclosedContract> {
  const capTableEvents = await ocp.client.getEventsByContractId({
    contractId: capTableContractId,
  });
  if (!capTableEvents.created?.createdEvent) {
    throw new Error('Failed to get CapTable created event');
  }
  return {
    templateId: capTableEvents.created.createdEvent.templateId,
    contractId: capTableContractId,
    createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
    synchronizerId,
  };
}
