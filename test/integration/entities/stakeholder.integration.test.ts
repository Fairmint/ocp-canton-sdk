/**
 * Integration tests for Stakeholder operations.
 *
 * Tests the full lifecycle of Stakeholder entities:
 *
 * - Create individual stakeholder and read back as valid OCF
 * - Create institutional stakeholder
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import { applyOperations, createTestStakeholderData, generateTestId, setupTestBook } from '../utils';

createIntegrationTestSuite('Stakeholder operations', (getContext) => {
  test('creates stakeholder and reads it back as valid OCF', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx);

    const stakeholder = createTestStakeholderData({
      id: generateTestId('stakeholder-ocf-test'),
      name: { legal_name: 'John Doe', first_name: 'John', last_name: 'Doe' },
      stakeholder_type: 'INDIVIDUAL',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);

    // Read back as OCF
    const ocfResult = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: created.get(stakeholder.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    // Validate OCF structure
    expect(ocfResult.data.object_type).toBe('STAKEHOLDER');
    expect(ocfResult.data.name.legal_name).toBe('John Doe');
    expect(ocfResult.data.stakeholder_type).toBe('INDIVIDUAL');

    // Validate against official OCF schema
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  test('creates institutional stakeholder', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx);

    const stakeholder = createTestStakeholderData({
      id: generateTestId('stakeholder-institution'),
      name: { legal_name: 'Venture Capital Fund LP' },
      stakeholder_type: 'INSTITUTION',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);

    const ocfResult = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: created.get(stakeholder.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.stakeholder_type).toBe('INSTITUTION');
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });
});
