/**
 * Integration tests for the `CapTable_Apply` and `CapTable_Restate` writes.
 *
 * Tests the atomic cap table writes the transfer agent makes:
 *
 * - Create multiple entities in a single transaction
 * - Edit and delete existing entities through a restatement
 * - Mixed edits and deletes, and the IDs a deletion releases
 * - Local refusals that mirror the ledger's (empty batch, malformed record)
 * - Batches the writer splits to stay within the ledger's caps
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { OcpValidationError } from '../../../src/errors';
import { validateOcfObject } from '../../utils/ocfSchemaValidator';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestDocumentData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockLegendTemplateData,
  createTestStockPlanData,
  createTestVestingTermsData,
  generateTestId,
  readRecordAsOcf,
  readTestBook,
  restateOperations,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('CapTable_Apply and CapTable_Restate operations', (getContext) => {
  /** Test: Create multiple entities in a single Apply transaction. */
  test('creates multiple entities in a single transaction', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stakeholder1Data = createTestStakeholderData({ id: generateTestId('batch-stakeholder-1') });
    const stakeholder2Data = createTestStakeholderData({
      id: generateTestId('batch-stakeholder-2'),
      stakeholder_type: 'INSTITUTION',
    });
    const documentData = createTestDocumentData({ id: generateTestId('batch-document') });

    const summary = await book.writer.apply([
      { kind: 'record', type: 'stakeholder', data: stakeholder1Data },
      { kind: 'record', type: 'stakeholder', data: stakeholder2Data },
      { kind: 'record', type: 'document', data: documentData },
    ]);

    // One transaction created all three records
    expect(summary.batches).toHaveLength(1);
    const [batch] = summary.batches;
    expect([...(batch?.result.records.keys() ?? [])].sort()).toEqual(
      [stakeholder1Data.id, stakeholder2Data.id, documentData.id].sort()
    );

    // The book as read from the ledger holds them, and the first stakeholder reads back
    const index = await readTestBook(book);
    expect(index.counts().records).toBe(4);
    const readBack = await readRecordAsOcf(book, 'STAKEHOLDER', stakeholder1Data.id);
    expect(readBack.data.id).toBe(stakeholder1Data.id);
  });

  test('edits an existing entity', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stakeholderData = createTestStakeholderData({
      id: generateTestId('edit-stakeholder'),
      name: { legal_name: 'Original Name' },
      stakeholder_type: 'INDIVIDUAL',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: stakeholderData }]);
    const originalContractId = created.get(stakeholderData.id)?.contractId;

    // Edit the stakeholder with a restatement
    const edited = await restateOperations(book, [
      { kind: 'edit', type: 'stakeholder', data: { ...stakeholderData, name: { legal_name: 'Updated Name' } } },
    ]);

    // The edit archives the contract and creates another under the same object ID
    const editedRef = edited.get(stakeholderData.id);
    expect(editedRef).toBeDefined();
    expect(editedRef?.contractId).not.toBe(originalContractId);
    const readBack = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: editedRef?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.name.legal_name).toBe('Updated Name');
  });

  test('deletes an entity and releases its ID', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const documentData = createTestDocumentData({ id: generateTestId('delete-document') });
    await applyOperations(book, [{ kind: 'record', type: 'document', data: documentData }]);
    expect(book.writer.index.record(documentData.id)).not.toBeNull();

    // Delete the document
    await restateOperations(book, [{ kind: 'delete', objectId: documentData.id }]);

    // The book no longer holds it, from the ledger's active contract set either
    expect(book.writer.index.record(documentData.id)).toBeNull();
    expect((await readTestBook(book)).record(documentData.id)).toBeNull();

    // The deletion released the ID: it can be used again
    const recreated = await applyOperations(book, [{ kind: 'record', type: 'document', data: documentData }]);
    expect(recreated.get(documentData.id)).toBeDefined();
  });

  /**
   * Test: Edit and delete operations in a single restatement.
   *
   * Apply creates and Restate edits and deletes, so a mixed batch is one of each kind of change, atomically.
   */
  test('performs edit and delete in a single restatement', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const toEdit = createTestStakeholderData({
      id: generateTestId('edit-stakeholder'),
      name: { legal_name: 'To Be Edited' },
    });
    const toDelete = createTestStakeholderData({
      id: generateTestId('delete-stakeholder'),
      name: { legal_name: 'To Be Deleted' },
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'stakeholder', data: toEdit },
      { kind: 'record', type: 'stakeholder', data: toDelete },
    ]);
    expect(created.size).toBe(2);

    const restated = await restateOperations(book, [
      { kind: 'edit', type: 'stakeholder', data: { ...toEdit, name: { legal_name: 'Successfully Edited' } } },
      { kind: 'delete', objectId: toDelete.id },
    ]);

    // Only the edit creates a contract; the deleted record is gone
    expect([...restated.keys()]).toEqual([toEdit.id]);
    const editedOcf = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: restated.get(toEdit.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(editedOcf.data.name.legal_name).toBe('Successfully Edited');
    expect((await readTestBook(book)).record(toDelete.id)).toBeNull();
  });

  test('creates stock legend template and edits a stakeholder in successive writes', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const existing = createTestStakeholderData({
      id: generateTestId('existing-stakeholder'),
      name: { legal_name: 'Original' },
    });
    await applyOperations(book, [{ kind: 'record', type: 'stakeholder', data: existing }]);

    const legend = createTestStockLegendTemplateData({ id: generateTestId('new-legend') });
    const created = await applyOperations(book, [{ kind: 'record', type: 'stockLegendTemplate', data: legend }]);
    const edited = await restateOperations(book, [
      { kind: 'edit', type: 'stakeholder', data: { ...existing, name: { legal_name: 'Updated' } } },
    ]);

    expect(created.size).toBe(1);
    expect(edited.size).toBe(1);
  });

  /**
   * Test: Create stock plan.
   *
   * Stock plans manage equity compensation programs like option pools. The ledger validates that every id in
   * stock_class_ids resolves to an existing StockClass, so a real stock class is created first (here in the same
   * transaction: references resolve against the transaction's final state).
   */
  test('creates stock plan entity', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockClassData = createTestStockClassData();
    const stockPlanData = createTestStockPlanData({
      id: generateTestId('stock-plan'),
      plan_name: '2024 Equity Incentive Plan',
      initial_shares_reserved: '5000000',
      stock_class_ids: [stockClassData.id],
      default_cancellation_behavior: 'RETURN_TO_POOL',
    });

    const created = await applyOperations(book, [
      { kind: 'record', type: 'stockClass', data: stockClassData },
      { kind: 'record', type: 'stockPlan', data: stockPlanData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockPlan.get({
      contractId: created.get(stockPlanData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.plan_name).toBe('2024 Equity Incentive Plan');
    expect(readBack.data.stock_class_ids).toEqual([stockClassData.id]);
    await validateOcfObject(readBack.data as unknown as Record<string, unknown>);
  });

  test('creates vesting terms entity', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const vestingTermsData = createTestVestingTermsData({
      id: generateTestId('vesting-terms'),
      name: 'Standard 4-Year Vesting',
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'vestingTerms', data: vestingTermsData }]);

    const readBack = await ctx.ocp.OpenCapTable.vestingTerms.get({
      contractId: created.get(vestingTermsData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.name).toBe('Standard 4-Year Vesting');
    expect(readBack.data.vesting_conditions).toHaveLength(vestingTermsData.vesting_conditions.length);
  });

  /** Test: An empty batch is refused before it is submitted, as the ledger refuses it. */
  test('throws error when building an empty batch', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const batch = ctx.ocp.OpenCapTable.capTable.apply({
      ...book.writer.capTableAnchor(),
      transferAgent: ctx.transferAgentParty,
      index: book.writer.index,
    });

    expect(() => batch.build()).toThrow('CapTable_Apply needs at least one operation');
  });

  /** Test: A record with a missing required field is refused where it is added. */
  test('throws error when creating stakeholder without id', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const batch = ctx.ocp.OpenCapTable.capTable.apply({
      ...book.writer.capTableAnchor(),
      transferAgent: ctx.transferAgentParty,
      index: book.writer.index,
    });

    const invalidStakeholderData = {
      id: '', // Empty ID should fail validation
      name: { legal_name: 'Test' },
      stakeholder_type: 'INDIVIDUAL' as const,
      object_type: 'STAKEHOLDER' as const,
    };

    // Validation happens synchronously, with the field path in the error
    expect(() => batch.create('stakeholder', invalidStakeholderData)).toThrow("'stakeholder.id'");
    expect(() => batch.create('stakeholder', invalidStakeholderData)).toThrow(OcpValidationError);
  });

  /** Test: Many entities in one transaction. */
  test('handles a transaction with many entities', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const operations = Array.from({ length: 10 }, (_unused, i) => ({
      kind: 'record' as const,
      type: 'stakeholder' as const,
      data: createTestStakeholderData({
        id: generateTestId(`batch-member-${i}`),
        name: { legal_name: `Batch Member ${i}` },
      }),
    }));
    const summary = await book.writer.apply(operations);

    expect(summary.batches).toHaveLength(1);
    expect(summary.batches[0]?.result.records.size).toBe(10);
  });
  /**
   * Test: A write over a transaction's size budget is split by the writer into consecutive transactions, each made on
   * the book the previous one left. The SDK's budget is 8 MB and the ledger's caps (500 operations, 500 claimed IDs)
   * split a write the same way; a small budget shows it without a large transaction.
   */
  test('splits a write over the size budget into transactions', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx, {}, { sizing: { byteBudget: 40_000 } });

    const operations = Array.from({ length: 120 }, (_unused, i) => ({
      kind: 'record' as const,
      type: 'stakeholder' as const,
      data: createTestStakeholderData({
        id: generateTestId(`bulk-${i}`),
        name: { legal_name: `Bulk Holder ${i}` },
      }),
    }));
    const summary = await book.writer.apply(operations);

    // Every operation was written once, in order, and each transaction carries its share of them
    expect(summary.batches.length).toBeGreaterThan(1);
    expect(summary.batches.flatMap((batch) => batch.sources)).toEqual(operations.map((_operation, i) => i));

    const index = await readTestBook(book);
    expect(index.counts().records).toBe(121);
  });
});
