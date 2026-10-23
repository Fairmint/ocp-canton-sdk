/**
 * Integration tests for stock class adjustment types via `CapTable_Apply`.
 *
 * Tests creating and reading:
 * - StockClassSplit (through the split procedure: freeze the class, record the split, unfreeze)
 * - StockClassConversionRatioAdjustment
 * - StockConsolidation and StockReissuance (bundled stock events that write their resulting issuance with them)
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { recordSplit } from '../../../src/register/checks/splits';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestStockIssuanceData,
  generateDateString,
  generateTestId,
  readTestBook,
  setupPreferredStockClassWithRatioConversionRight,
  setupStockSecurity,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Stock Class Adjustments', (getContext) => {
  /**
   * Test: Create a stock class split.
   *
   * Stock splits multiply existing shares by a ratio (e.g., 2-for-1 split). The ledger records a split only on a frozen
   * class, so the SDK's procedure freezes the class, records the split and unfreezes it, under one lease.
   */
  test('creates stock class split', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // Create a real stock class first; the ledger validates stock_class_id references.
    const stockSecurity = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });

    const splitId = generateTestId('stock-class-split');
    const result = await recordSplit(book.writer, {
      id: splitId,
      date: generateDateString(0),
      stock_class_id: stockSecurity.stockClassId,
      split_ratio: { numerator: '2', denominator: '1' },
      comments: ['2-for-1 stock split'],
      object_type: 'TX_STOCK_CLASS_SPLIT',
    });

    expect(result.freeze).not.toBeNull();
    expect(result.split?.result.records.get(splitId)?.entityType).toBe('stockClassSplit');
    expect(result.unfreeze).not.toBeNull();

    // The split reads back as OCF, and the class is not frozen any more
    const readBack = await ctx.ocp.OpenCapTable.stockClassSplit.get({
      contractId: result.split?.result.records.get(splitId)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data).toMatchObject({
      object_type: 'TX_STOCK_CLASS_SPLIT',
      stock_class_id: stockSecurity.stockClassId,
      split_ratio: { numerator: '2', denominator: '1' },
    });
    const index = await readTestBook(book);
    expect(index.epochOf(stockSecurity.stockClassId)?.epoch.frozen).toBe(false);
    expect(index.epochOf(stockSecurity.stockClassId)?.epoch.splits).toHaveLength(1);

    // Lots are split lazily: the state keeps its quantity until its next event, and reads scale by the split
    expect(index.stateOf(stockSecurity.securityId)?.state.quantity).toBe('1000');
    expect(index.currentQuantity(stockSecurity.securityId, generateDateString(0))).toBe('2000');
  });

  /**
   * Test: Create a stock class conversion ratio adjustment.
   *
   * Adjusts the conversion ratio for convertible instruments targeting a stock class.
   */
  test('creates stock class conversion ratio adjustment', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // A preferred stock class with a ratio conversion right for adjustment validation.
    const stockClasses = await setupPreferredStockClassWithRatioConversionRight(book);

    const adjustmentId = generateTestId('conversion-ratio-adj');
    const created = await applyOperations(book, [
      {
        kind: 'record',
        type: 'stockClassConversionRatioAdjustment',
        data: {
          id: adjustmentId,
          date: generateDateString(0),
          stock_class_id: stockClasses.preferredStockClassId,
          new_ratio_conversion_mechanism: {
            type: 'RATIO_CONVERSION',
            conversion_price: { amount: '0', currency: 'USD' },
            ratio: { numerator: '3', denominator: '2' },
            rounding_type: 'NORMAL',
          },
          comments: ['Anti-dilution adjustment'],
          object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
        },
      },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockClassConversionRatioAdjustment.get({
      contractId: created.get(adjustmentId)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.stock_class_id).toBe(stockClasses.preferredStockClassId);
    expect(readBack.data.new_ratio_conversion_mechanism).toMatchObject({
      type: 'RATIO_CONVERSION',
      ratio: { numerator: '3', denominator: '2' },
    });
  });

  /**
   * Test: Create a stock consolidation.
   *
   * Combines multiple existing securities of one stakeholder and class into a single new security (reverse split).
   */
  test('creates stock consolidation', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // Three lots of one stakeholder and class
    const first = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });
    const shared = { stakeholderId: first.stakeholderId, stockClassId: first.stockClassId };
    const second = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '2000' } });
    const third = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '3000' } });

    const resultingSecurityId = generateTestId('consolidated-security');
    const consolidationDate = generateDateString(0);
    const consolidationId = generateTestId('consolidation');
    const created = await applyOperations(book, [
      {
        kind: 'stockConsolidation',
        consolidation: {
          id: consolidationId,
          date: consolidationDate,
          security_ids: [first.securityId, second.securityId, third.securityId],
          resulting_security_id: resultingSecurityId,
          comments: ['Consolidation of three lots'],
          object_type: 'TX_STOCK_CONSOLIDATION',
        },
        // The resulting security holds the sum of its inputs
        resultingIssuance: createTestStockIssuanceData({
          stakeholder_id: first.stakeholderId,
          stock_class_id: first.stockClassId,
          security_id: resultingSecurityId,
          quantity: '6000',
          date: consolidationDate,
        }),
      },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockConsolidation.get({
      contractId: created.get(consolidationId)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.security_ids).toEqual([first.securityId, second.securityId, third.securityId]);
    expect(readBack.data.resulting_security_id).toBe(resultingSecurityId);

    // The three lots' states ended; the resulting one holds the sum
    const index = await readTestBook(book);
    expect(index.stateOf(first.securityId)).toBeNull();
    expect(index.stateOf(resultingSecurityId)?.state.quantity).toBe('6000');
  });

  /**
   * Test: Create a stock reissuance.
   *
   * Reissues a whole security to new securities of the same class, conserving its quantity.
   */
  test('creates stock reissuance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockSecurity = await setupStockSecurity(book, { issuanceOverrides: { quantity: '5000' } });

    const resultingSecurityId = generateTestId('reissued-security');
    const reissuanceDate = generateDateString(0);
    const reissuanceId = generateTestId('reissuance');
    const created = await applyOperations(book, [
      {
        kind: 'stockReissuance',
        reissuance: {
          id: reissuanceId,
          date: reissuanceDate,
          security_id: stockSecurity.securityId,
          resulting_security_ids: [resultingSecurityId],
          comments: ['Reissued after forfeiture period'],
          object_type: 'TX_STOCK_REISSUANCE',
        },
        resulting: [
          createTestStockIssuanceData({
            stakeholder_id: stockSecurity.stakeholderId,
            stock_class_id: stockSecurity.stockClassId,
            security_id: resultingSecurityId,
            quantity: '5000',
            date: reissuanceDate,
          }),
        ],
      },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockReissuance.get({
      contractId: created.get(reissuanceId)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.security_id).toBe(stockSecurity.securityId);
    expect(readBack.data.resulting_security_ids).toEqual([resultingSecurityId]);
  });

  /**
   * Test: Create multiple adjustments in a single transaction.
   *
   * Demonstrates atomic writes with a consolidation and a reissuance together.
   */
  test('creates multiple adjustments in a single transaction', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // Consolidation needs at least one security of the stakeholder and class; reissuance another
    const first = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });
    const shared = { stakeholderId: first.stakeholderId, stockClassId: first.stockClassId };
    const second = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '2000' } });
    const third = await setupStockSecurity(book, { ...shared, issuanceOverrides: { quantity: '3000' } });

    const consolidatedSecurityId = generateTestId('batch-consolidated-security');
    const reissuedSecurityId = generateTestId('batch-reissued-security');
    const batchDate = generateDateString(0);
    const issuance = (securityId: string, quantity: string) =>
      createTestStockIssuanceData({
        stakeholder_id: first.stakeholderId,
        stock_class_id: first.stockClassId,
        security_id: securityId,
        quantity,
        date: batchDate,
      });

    const summary = await book.writer.apply([
      {
        kind: 'stockConsolidation',
        consolidation: {
          id: generateTestId('batch-consolidation'),
          date: batchDate,
          security_ids: [first.securityId, second.securityId],
          resulting_security_id: consolidatedSecurityId,
          comments: ['Batch consolidation'],
          object_type: 'TX_STOCK_CONSOLIDATION',
        },
        resultingIssuance: issuance(consolidatedSecurityId, '3000'),
      },
      {
        kind: 'stockReissuance',
        reissuance: {
          id: generateTestId('batch-reissue'),
          date: batchDate,
          security_id: third.securityId,
          resulting_security_ids: [reissuedSecurityId],
          comments: ['Batch reissuance'],
          object_type: 'TX_STOCK_REISSUANCE',
        },
        resulting: [issuance(reissuedSecurityId, '3000')],
      },
    ]);

    expect(summary.batches).toHaveLength(1);
    expect(summary.batches[0]?.result.records.size).toBe(4);
  });

  /**
   * Test: Stock class split with approval dates.
   *
   * board_approval_date and stockholder_approval_date are internal SDK extensions, not OCF StockClassSplit schema
   * fields, and the ledger's record does not hold them.
   */
  test('rejects stock class split approval dates not supported by the OCF schema', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const batch = ctx.ocp.OpenCapTable.capTable.apply({
      ...book.writer.capTableAnchor(),
      transferAgent: ctx.transferAgentParty,
      index: book.writer.index,
    });

    expect(() =>
      batch.create('stockClassSplit', {
        id: generateTestId('split-with-dates'),
        date: generateDateString(0),
        stock_class_id: generateTestId('class-with-dates'),
        split_ratio: { numerator: '4', denominator: '1' },
        board_approval_date: generateDateString(-5),
        stockholder_approval_date: generateDateString(-2),
        comments: ['Split with full approval chain'],
        object_type: 'TX_STOCK_CLASS_SPLIT',
      })
    ).toThrow('board_approval_date');
  });
});
