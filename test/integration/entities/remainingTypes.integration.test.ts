/**
 * Integration tests for remaining OCF type operations via `CapTable_Apply`.
 *
 * Tests stakeholder change events.
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
  applyOperations,
  createTestStakeholderData,
  createTestStakeholderRelationshipChangeData,
  createTestStakeholderStatusChangeData,
  generateTestId,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Remaining OCF Types via CapTable_Apply', (getContext) => {
  /**
   * Test: Create stakeholder status change event.
   *
   * This tracks when a stakeholder's employment/engagement status changes.
   */
  test('creates stakeholder status change event', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stakeholder = createTestStakeholderData({ id: generateTestId('stakeholder') });
    await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);

    const statusChangeData = createTestStakeholderStatusChangeData({
      id: generateTestId('status-change'),
      stakeholder_id: stakeholder.id,
      new_status: 'LEAVE_OF_ABSENCE',
      comments: ['Medical leave starting'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'stakeholderStatusChangeEvent', data: statusChangeData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stakeholderStatusChangeEvent.get({
      contractId: created.get(statusChangeData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.new_status).toBe('LEAVE_OF_ABSENCE');
    expect(readBack.data.stakeholder_id).toBe(stakeholder.id);
    await validateOcfObject(readBack.data as unknown as Record<string, unknown>);
  });

  /** Test: Create stakeholder relationship change event. */
  test('creates stakeholder relationship change event', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stakeholder = createTestStakeholderData({ id: generateTestId('stakeholder') });
    await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);

    const relationshipChange = createTestStakeholderRelationshipChangeData({
      id: generateTestId('relationship-change'),
      stakeholder_id: stakeholder.id,
      relationship_started: 'ADVISOR',
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'stakeholderRelationshipChangeEvent', data: relationshipChange },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stakeholderRelationshipChangeEvent.get({
      contractId: created.get(relationshipChange.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.relationship_started).toBe('ADVISOR');
    expect(readBack.data.stakeholder_id).toBe(stakeholder.id);
  });
});
