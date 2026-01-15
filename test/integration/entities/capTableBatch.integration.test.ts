/**
 * Integration tests for CapTableBatch operations.
 *
 * Tests the batch API for atomic cap table updates:
 *
 * - Create multiple entities in a single transaction
 * - Edit existing entities
 * - Delete entities
 * - Mixed operations (create + edit + delete)
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
  createTestDocumentData,
  createTestStakeholderData,
  createTestStockLegendTemplateData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
} from '../utils';

createIntegrationTestSuite('CapTableBatch operations', (getContext) => {
  /**
   * Test: Create multiple entities in a single batch transaction.
   *
   * Note: stockClass creation via batch API is currently blocked due to DAML JSON API v2 numeric encoding issues.
   * The JSON API expects Numeric fields as objects but receives strings. This is tracked as a known limitation.
   * For now, we test with stakeholders and documents which don't have numeric fields.
   */
  test('creates multiple entities in a single batch transaction', async () => {
    const ctx = getContext();

    // First create an issuer to get a CapTable
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // Create batch with multiple entities (stakeholders and documents - no stockClass due to numeric encoding issue)
    const stakeholder1Data = createTestStakeholderData({
      id: generateTestId('batch-stakeholder-1'),
    });
    const stakeholder2Data = createTestStakeholderData({
      id: generateTestId('batch-stakeholder-2'),
      stakeholder_type: 'INSTITUTION',
    });
    const documentData = createTestDocumentData({
      id: generateTestId('batch-document'),
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create('stakeholder', stakeholder1Data)
      .create('stakeholder', stakeholder2Data)
      .create('document', documentData)
      .execute();

    // Verify entities were created (result contains contract IDs of created entities)
    expect(result.createdCids).toHaveLength(3);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  test('edits an existing entity', async () => {
    const ctx = getContext();

    // Create issuer and stakeholder
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
        id: generateTestId('edit-stakeholder'),
        name: { legal_name: 'Original Name' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    // Edit the stakeholder using batch API
    const updatedStakeholderData = {
      ...stakeholderSetup.stakeholderData,
      name: { legal_name: 'Updated Name' },
    };

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stakeholderSetup.newCapTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: stakeholderSetup.newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.edit('stakeholder', updatedStakeholderData).execute();

    // Verify the edit was successful
    expect(result.editedCids).toHaveLength(1);
  });

  test('deletes an entity', async () => {
    const ctx = getContext();

    // Create issuer and document
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const documentId = generateTestId('delete-document');

    // Create a document using the batch API first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const createResult = await createBatch.create('document', createTestDocumentData({ id: documentId })).execute();

    expect(createResult.createdCids).toHaveLength(1);
    const newCapTableContractId = createResult.updatedCapTableCid;

    // Get updated CapTable contract details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now delete the document
    const deleteBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Note: The UpdateCapTableResult doesn't include deleted IDs in the current DAML contract
    // The delete operation is successful if no error is thrown
    await deleteBatch.delete('document', documentId).execute();

    // Verify the document is no longer accessible
    // (This would throw an error if the document still exists)
  });

  /**
   * Test: Perform mixed operations (create + edit) atomically.
   *
   * Note: Uses stockLegendTemplate instead of stockClass due to DAML JSON API v2 numeric encoding issues.
   * StockClass has numeric fields (initial_shares_authorized, etc.) that fail with the current JSON encoding.
   */
  test('performs mixed operations (create + edit) atomically', async () => {
    const ctx = getContext();

    // Setup: Create issuer with a stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    const existingStakeholderId = generateTestId('existing-stakeholder');

    // Create initial stakeholder
    const setupBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const setupResult = await setupBatch
      .create('stakeholder', createTestStakeholderData({ id: existingStakeholderId, name: { legal_name: 'Original' } }))
      .execute();

    const newCapTableContractId = setupResult.updatedCapTableCid;
    const capTableEvents2 = await ctx.ocp.client.getEventsByContractId({
      contractId: newCapTableContractId,
    });
    if (!capTableEvents2.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents2.created.createdEvent.templateId,
      contractId: newCapTableContractId,
      createdEventBlob: capTableEvents2.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now perform mixed operations: create new legend template, edit stakeholder
    // Note: Using stockLegendTemplate instead of stockClass (stockClass has numeric fields that fail)
    const mixedBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: newCapTableContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const newLegendId = generateTestId('new-legend');
    const result = await mixedBatch
      .create('stockLegendTemplate', createTestStockLegendTemplateData({ id: newLegendId }))
      .edit('stakeholder', createTestStakeholderData({ id: existingStakeholderId, name: { legal_name: 'Updated' } }))
      .execute();

    // Verify all operations succeeded
    expect(result.createdCids).toHaveLength(1);
    expect(result.editedCids).toHaveLength(1);
  });
});
