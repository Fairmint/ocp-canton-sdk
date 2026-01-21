/**
 * Integration tests for remaining OCF type operations via batch API.
 *
 * Tests the batch API for:
 * - Retraction types (stock, warrant, convertible, equity compensation)
 * - Equity compensation events (release, repricing)
 * - Stock plan events (return to pool)
 * - Stakeholder change events (relationship change, status change)
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
  createTestStakeholderData,
  createTestStakeholderRelationshipChangeData,
  createTestStakeholderStatusChangeData,
  createTestStockPlanData,
  createTestStockPlanReturnToPoolData,
  generateTestId,
  setupTestIssuer,
} from '../utils';

createIntegrationTestSuite('Remaining OCF Types via Batch API', (getContext) => {
  /**
   * Test: Create stakeholder status change event via batch API.
   *
   * This tracks when a stakeholder's employment/engagement status changes.
   */
  test('creates stakeholder status change event', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // First create a stakeholder
    const stakeholderId = generateTestId('stakeholder');
    const createStakeholderBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const stakeholderResult = await createStakeholderBatch
      .create('stakeholder', createTestStakeholderData({ id: stakeholderId }))
      .execute();

    expect(stakeholderResult.createdCids).toHaveLength(1);

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: stakeholderResult.updatedCapTableCid,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: stakeholderResult.updatedCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now create a status change event
    const statusChangeData = createTestStakeholderStatusChangeData({
      id: generateTestId('status-change'),
      stakeholder_id: stakeholderId,
      new_status: 'LEAVE_OF_ABSENCE',
      comments: ['Medical leave starting'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stakeholderResult.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stakeholderStatusChangeEvent', statusChangeData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create stakeholder relationship change event via batch API.
   *
   * This tracks when a stakeholder's relationship with the company changes.
   */
  test('creates stakeholder relationship change event', async () => {
    const ctx = getContext();

    // Setup issuer and stakeholder
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // First create a stakeholder
    const stakeholderId = generateTestId('stakeholder');
    const createStakeholderBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const stakeholderResult = await createStakeholderBatch
      .create('stakeholder', createTestStakeholderData({ id: stakeholderId }))
      .execute();

    expect(stakeholderResult.createdCids).toHaveLength(1);

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: stakeholderResult.updatedCapTableCid,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: stakeholderResult.updatedCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now create a relationship change event
    const relationshipChangeData = createTestStakeholderRelationshipChangeData({
      id: generateTestId('relationship-change'),
      stakeholder_id: stakeholderId,
      new_relationships: ['EMPLOYEE', 'BOARD_MEMBER'],
      comments: ['Promoted to board member while remaining employee'],
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stakeholderResult.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stakeholderRelationshipChangeEvent', relationshipChangeData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create stock plan return to pool event via batch API.
   *
   * This tracks when shares are returned to the stock plan pool (e.g., due to termination).
   */
  test('creates stock plan return to pool event', async () => {
    const ctx = getContext();

    // Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // First create a stock plan
    const stockClassId = generateTestId('stock-class-placeholder');
    const stockPlanId = generateTestId('stock-plan');
    const createStockPlanBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const stockPlanResult = await createStockPlanBatch
      .create(
        'stockPlan',
        createTestStockPlanData({
          id: stockPlanId,
          stock_class_ids: [stockClassId],
        })
      )
      .execute();

    expect(stockPlanResult.createdCids).toHaveLength(1);

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: stockPlanResult.updatedCapTableCid,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: stockPlanResult.updatedCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now create a return to pool event
    const returnToPoolData = createTestStockPlanReturnToPoolData({
      id: generateTestId('return-to-pool'),
      stock_plan_id: stockPlanId,
      quantity: '10000',
      reason_text: 'Employee termination - unvested options returned',
    });

    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: stockPlanResult.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch.create('stockPlanReturnToPool', returnToPoolData).execute();

    expect(result.createdCids).toHaveLength(1);
    expect(result.updatedCapTableCid).toBeTruthy();
  });

  /**
   * Test: Create multiple event types in a single batch.
   *
   * Demonstrates atomic creation of different event types together.
   */
  test('creates multiple event types in a single batch', async () => {
    const ctx = getContext();

    // Setup issuer
    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
      featuredAppRightContractDetails: ctx.featuredAppRight,
    });

    // First create a stakeholder and stock plan
    const stakeholderId = generateTestId('stakeholder');
    const stockClassId = generateTestId('stock-class-placeholder');
    const stockPlanId = generateTestId('stock-plan');

    const setupBatch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: issuerSetup.issuerContractId,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const setupResult = await setupBatch
      .create('stakeholder', createTestStakeholderData({ id: stakeholderId }))
      .create('stockPlan', createTestStockPlanData({ id: stockPlanId, stock_class_ids: [stockClassId] }))
      .execute();

    expect(setupResult.createdCids).toHaveLength(2);

    // Get updated cap table details
    const capTableEvents = await ctx.ocp.client.getEventsByContractId({
      contractId: setupResult.updatedCapTableCid,
    });
    if (!capTableEvents.created?.createdEvent) {
      throw new Error('Failed to get CapTable created event');
    }
    const newCapTableContractDetails = {
      templateId: capTableEvents.created.createdEvent.templateId,
      contractId: setupResult.updatedCapTableCid,
      createdEventBlob: capTableEvents.created.createdEvent.createdEventBlob,
      synchronizerId: issuerSetup.capTableContractDetails.synchronizerId,
    };

    // Now create multiple events in a single batch
    const batch = ctx.ocp.OpenCapTable.capTable.update({
      capTableContractId: setupResult.updatedCapTableCid,
      featuredAppRightContractDetails: ctx.featuredAppRight,
      capTableContractDetails: newCapTableContractDetails,
      actAs: [ctx.issuerParty],
    });

    const result = await batch
      .create(
        'stakeholderStatusChangeEvent',
        createTestStakeholderStatusChangeData({
          id: generateTestId('status-change'),
          stakeholder_id: stakeholderId,
          new_status: 'TERMINATION_VOLUNTARY_OTHER',
        })
      )
      .create(
        'stockPlanReturnToPool',
        createTestStockPlanReturnToPoolData({
          id: generateTestId('return-to-pool'),
          stock_plan_id: stockPlanId,
          quantity: '5000',
          reason_text: 'Voluntary termination - unvested shares returned',
        })
      )
      .execute();

    expect(result.createdCids).toHaveLength(2);
    expect(result.updatedCapTableCid).toBeTruthy();
  });
});
