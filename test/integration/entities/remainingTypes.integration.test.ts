/**
 * Integration tests for remaining OCF type operations via batch API.
 *
 * Tests the batch API for stakeholder change events.
 *
 * Note: Some event types (stakeholderRelationshipChangeEvent, stockPlanReturnToPool) are
 * not yet fully supported in the CI test environment's DAML contract. These converters
 * are tested via unit tests. Integration tests will be expanded when the DAML contract
 * adds support.
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
  createTestStakeholderStatusChangeData,
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
});
