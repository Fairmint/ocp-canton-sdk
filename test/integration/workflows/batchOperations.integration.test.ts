/**
 * Integration tests for batch operations.
 *
 * These tests verify that multiple operations are submitted atomically through `CapTable_Apply`, both through the
 * writer and through the builder whose command the caller submits, ensuring all-or-nothing semantics.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { readApplyResult } from '../../../src/functions/OpenCapTable/capTable/apply';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestStakeholderData,
  createTestStockLegendTemplateData,
  generateTestId,
  readTestBook,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Batch operations', (getContext) => {
  /**
   * Test: Create multiple stakeholders in a single transaction, submitting the built command ourselves.
   *
   * The builder produces the `CapTable_Apply` command with its inputs resolved from the key index; the transfer agent
   * is the only controller, so it needs no disclosed contracts.
   */
  test('creates multiple stakeholders in single batch transaction', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx, {
      id: generateTestId('batch-issuer'),
      legal_name: 'Batch Test Corp',
    });

    const stakeholder1 = createTestStakeholderData({
      id: generateTestId('batch-sh-1'),
      name: { legal_name: 'Batch Stakeholder 1' },
    });
    const stakeholder2 = createTestStakeholderData({
      id: generateTestId('batch-sh-2'),
      name: { legal_name: 'Batch Stakeholder 2' },
      stakeholder_type: 'INSTITUTION',
    });

    const cmd = ctx.ocp.OpenCapTable.capTable
      .apply({
        ...book.writer.capTableAnchor(),
        transferAgent: ctx.transferAgentParty,
        index: await readTestBook(book),
      })
      .create('stakeholder', stakeholder1)
      .create('stakeholder', stakeholder2)
      .build();
    expect(cmd.actAs).toEqual([ctx.transferAgentParty]);

    // Submit the command via the ledger client
    const result = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [cmd.command],
      actAs: cmd.actAs,
      disclosedContracts: cmd.disclosedContracts,
    });

    // Verify both stakeholders were created, by the choice's result
    const created = readApplyResult(result);
    expect([...created.records.keys()].sort()).toEqual([stakeholder1.id, stakeholder2.id].sort());

    const stakeholderOcf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: created.records.get(stakeholder1.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(stakeholderOcf.data.name.legal_name).toBe('Batch Stakeholder 1');
    await validateOcfObject(stakeholderOcf.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Create stakeholder followed by legend template in sequence.
   *
   * This test verifies that related entities can be created in sequence, with each subsequent write made on the book
   * the previous one left.
   */
  test('creates stakeholder followed by legend template in sequence', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx, {
      id: generateTestId('batch-seq-issuer'),
      legal_name: 'Batch Sequence Corp',
    });

    const stakeholderData = createTestStakeholderData({
      id: generateTestId('batch-stakeholder'),
      name: { legal_name: 'Batch Stakeholder' },
    });
    const stakeholderCreated = await applyOperations(book, [
      { kind: 'record', type: 'stakeholder', data: stakeholderData },
    ]);

    const legendData = createTestStockLegendTemplateData({
      id: generateTestId('batch-legend'),
      name: 'Batch Legend Template',
    });
    const legendCreated = await applyOperations(book, [
      { kind: 'record', type: 'stockLegendTemplate', data: legendData },
    ]);

    // Verify both entities
    const stakeholderOcf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: stakeholderCreated.get(stakeholderData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(stakeholderOcf.data.name.legal_name).toBe('Batch Stakeholder');
    await validateOcfObject(stakeholderOcf.data as unknown as Record<string, unknown>);

    const legendOcf = await ctx.ocp.OpenCapTable.stockLegendTemplate.get({
      contractId: legendCreated.get(legendData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(legendOcf.data.name).toBe('Batch Legend Template');
    await validateOcfObject(legendOcf.data as unknown as Record<string, unknown>);
  });

  /**
   * Test: Sequential operations maintain state correctly.
   *
   * This test verifies that a chain of operations maintains proper state, with each step building on the previous one's
   * results.
   */
  test('sequential operations maintain cap table state across transactions', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx, {
      id: generateTestId('seq-state-issuer'),
      legal_name: 'Sequential State Corp',
    });

    const stakeholders = [
      createTestStakeholderData({
        id: generateTestId('seq-sh-1'),
        name: { legal_name: 'First Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
      }),
      createTestStakeholderData({
        id: generateTestId('seq-sh-2'),
        name: { legal_name: 'Second Stakeholder' },
        stakeholder_type: 'INSTITUTION',
      }),
      createTestStakeholderData({
        id: generateTestId('seq-sh-3'),
        name: { legal_name: 'Third Stakeholder' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['ADVISOR'],
      }),
    ];
    for (const stakeholder of stakeholders) {
      await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholder }]);
    }

    // Verify all three stakeholders exist and are readable, and valid OCF
    const index = await readTestBook(book);
    for (const stakeholder of stakeholders) {
      const record = index.record(stakeholder.id);
      expect(record).not.toBeNull();
      const ocf = await ctx.ocp.OpenCapTable.stakeholder.get({
        contractId: record?.contractId ?? '',
        readAs: [ctx.transferAgentParty],
      });
      expect(ocf.data.name.legal_name).toBe(stakeholder.name.legal_name);
      await validateOcfObject(ocf.data as unknown as Record<string, unknown>);
    }
  });

  /**
   * Test: Builder client API for command submission.
   *
   * This test demonstrates proper usage of the client API for submitting a batch: `execute()` builds the command,
   * submits it as the transfer agent and reads the result.
   */
  test('builder client API creates and submits commands correctly', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx, {
      id: generateTestId('txbatch-issuer'),
      legal_name: 'TxBatch Test Corp',
    });

    const stakeholderData = createTestStakeholderData({
      id: generateTestId('txbatch-stakeholder'),
      name: { legal_name: 'TxBatch Stakeholder' },
    });

    const result = await ctx.ocp.OpenCapTable.capTable
      .apply({
        ...book.writer.capTableAnchor(),
        transferAgent: ctx.transferAgentParty,
        index: await readTestBook(book),
      })
      .create('stakeholder', stakeholderData)
      .execute();

    // Verify result structure
    expect(result.response.transaction).toBeDefined();
    expect(result.updateId).toBe(result.response.transaction.updateId);

    // Verify created stakeholder
    const ocfResult = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: result.records.get(stakeholderData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.id).toBe(stakeholderData.id);
    expect(ocfResult.data.name.legal_name).toBe('TxBatch Stakeholder');
  });
  /**
   * Test: Builder client API for a restatement.
   *
   * `CapTable_Restate` edits and deletes records among the inputs it is given, which the key index resolves.
   */
  test('restate builder edits and deletes in one transaction', async () => {
    const ctx = getContext();

    const book = await setupTestBook(ctx);
    const toEdit = createTestStakeholderData({
      id: generateTestId('restate-edit'),
      name: { legal_name: 'Before' },
    });
    const toDelete = createTestStakeholderData({ id: generateTestId('restate-delete') });
    await applyOperations(book, [
      { kind: 'record', type: 'stakeholder', data: toEdit },
      { kind: 'record', type: 'stakeholder', data: toDelete },
    ]);

    const result = await ctx.ocp.OpenCapTable.capTable
      .restate({
        ...book.writer.capTableAnchor(),
        transferAgent: ctx.transferAgentParty,
        index: await readTestBook(book),
      })
      .edit('stakeholder', { ...toEdit, name: { legal_name: 'After' } })
      .delete(toDelete.id)
      .execute();

    // The edit's new contract is the only one created
    expect([...result.records.keys()]).toEqual([toEdit.id]);
    const edited = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: result.records.get(toEdit.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(edited.data.name.legal_name).toBe('After');
    expect((await readTestBook(book)).record(toDelete.id)).toBeNull();
  });
});
