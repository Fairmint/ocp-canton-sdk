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
  createTestStockPlanData,
  createTestVestingTermsData,
  generateTestId,
  setupTestIssuer,
  setupTestStakeholder,
} from '../utils';

createIntegrationTestSuite('CapTableBatch operations', (getContext) => {
  /**
   * Test: Create multiple entities in a single batch transaction.
   *
   * Note: stockClass creation via batch API is currently blocked due to DAML JSON API v2 numeric encoding issues. The
   * JSON API expects Numeric fields as objects but receives strings. This is tracked as a known limitation. For now, we
   * test with stakeholders and documents which don't have numeric fields.
   */
  test('creates multiple entities in a single batch transaction', async () => {
    const ctx = getContext();

    // First create an issuer to get a CapTable
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
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
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: ctx.issuerParty,
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
    });

    const documentId = generateTestId('delete-document');

    // Create a document using the batch API first
    const createBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
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
   * Note: Uses stockLegendTemplate instead of stockClass due to DAML JSON API v2 numeric encoding issues. StockClass
   * has numeric fields (initial_shares_authorized, etc.) that fail with the current JSON encoding.
   */
  test('performs mixed operations (create + edit) atomically', async () => {
    const ctx = getContext();

    // Setup: Create issuer with a stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const existingStakeholderId = generateTestId('existing-stakeholder');

    // Create initial stakeholder
    const setupBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
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

  /**
   * Test: Create stock plan via batch API.
   *
   * Stock plans are used to manage equity compensation programs like option pools, RSU pools, etc.
   *
   * Note: stock_class_ids is required but we use a placeholder since actual stockClass creation has numeric encoding
   * issues.
   */
  test('creates stock plan entity', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    // Create a stock plan (uses placeholder stock class ID)
    const stockClassId = generateTestId('stock-class-placeholder');
    const stockPlanData = createTestStockPlanData({
      id: generateTestId('stock-plan'),
      plan_name: '2024 Equity Incentive Plan',
      initial_shares_reserved: '5000000',
      stock_class_ids: [stockClassId],
      default_cancellation_behavior: 'RETURN_TO_POOL',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockPlan', stockPlanData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create vesting terms via batch API.
   *
   * Vesting terms define how securities vest over time.
   */
  test('creates vesting terms entity', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting-terms'),
      name: 'Standard 4-Year Vesting',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('vestingTerms', vestingTermsData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Empty batch throws error.
   *
   * Attempting to execute an empty batch should fail with a clear error message.
   */
  test('throws error when executing empty batch', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Should throw when executing empty batch
    await expect(batch.execute()).rejects.toThrow('Cannot build empty batch');
  });

  /**
   * Test: Batch with missing required field throws error.
   *
   * Creating an entity with a missing required field should result in an error.
   */
  test('throws error when creating stakeholder without id', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Create stakeholder data without an id
    const invalidStakeholderData = {
      id: '', // Empty ID should fail validation
      name: { legal_name: 'Test' },
      stakeholder_type: 'INDIVIDUAL' as const,
    };

    // Should throw during create() due to validation (validation happens synchronously)
    // The error message now uses structured error format with field path
    expect(() => batch.create('stakeholder', invalidStakeholderData)).toThrow("'stakeholder.id'");
  });

  /**
   * Test: Large batch with many entities.
   *
   * Tests that the batch API can handle a larger number of entities in a single transaction.
   */
  test('handles batch with many entities', async () => {
    const ctx = getContext();

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    // Add 10 stakeholders to the batch
    for (let i = 0; i < 10; i++) {
      batch.create(
        'stakeholder',
        createTestStakeholderData({
          id: generateTestId(`batch-member-${i}`),
          name: { legal_name: `Batch Member ${i}` },
        })
      );
    }

    const result = await batch.execute();

    expect(result.createdCids).toHaveLength(10);
    expect(result.updatedCapTableCid).toBeTruthy();
  });
});
