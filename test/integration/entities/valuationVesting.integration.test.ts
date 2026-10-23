/**
 * Integration tests for Valuation and Vesting types via `CapTable_Apply`.
 *
 * Tests:
 * - Valuation (409A valuations): requires an existing stock class
 * - VestingStart (when vesting schedule begins)
 * - VestingEvent (milestone-based vesting events)
 * - VestingAcceleration (accelerated vesting due to M&A, etc.)
 *
 * Valuation tests create a real stock class prerequisite, because the ledger validates stock_class_id references.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/entities/valuationVesting.integration.test.ts
 * ```
 */

import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  createTestValuationData,
  createTestVestingAccelerationData,
  createTestVestingEventData,
  createTestVestingStartData,
  generateTestId,
  setupStockSecurity,
  setupTestBook,
  TEST_VESTING_EVENT_CONDITION_ID,
  TEST_VESTING_START_CONDITION_ID,
} from '../utils';

createIntegrationTestSuite('Valuation and Vesting types via CapTable_Apply', (getContext) => {
  /**
   * Test: Create a valuation (409A).
   *
   * Valuations require a valid stock_class_id that exists in the book.
   */
  test('creates valuation entity', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const valuationData = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '2.50', currency: 'USD' },
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'valuation', data: valuationData }]);

    const ocfResult = await ctx.ocp.OpenCapTable.valuation.get({
      contractId: created.get(valuationData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(ocfResult.data.object_type).toBe('VALUATION');
    expect(ocfResult.data.stock_class_id).toBe(valuationData.stock_class_id);
    expect(Number(ocfResult.data.price_per_share.amount)).toBe(Number(valuationData.price_per_share.amount));
    expect(ocfResult.data.price_per_share.currency).toBe(valuationData.price_per_share.currency);
  });

  /** Test: Create multiple valuations in a single write. */
  test('creates multiple valuations in a single write', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const valuation1 = createTestValuationData({
      id: generateTestId('valuation-1'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '1.50', currency: 'USD' },
      effective_date: '2024-01-01',
    });
    const valuation2 = createTestValuationData({
      id: generateTestId('valuation-2'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '2.25', currency: 'USD' },
      effective_date: '2024-06-01',
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'valuation', data: valuation1 },
      { kind: 'record', type: 'valuation', data: valuation2 },
    ]);

    expect(created.size).toBe(2);
    const ocfResults = await Promise.all(
      [valuation1, valuation2].map(async (valuation) =>
        ctx.ocp.OpenCapTable.valuation.get({
          contractId: created.get(valuation.id)?.contractId ?? '',
          readAs: [ctx.transferAgentParty],
        })
      )
    );
    expect(ocfResults.map((ocf) => ocf.data.id)).toEqual([valuation1.id, valuation2.id]);
  });

  /**
   * Test: Create a vesting start transaction.
   *
   * VestingStart marks when a vesting schedule begins for a security.
   */
  test('creates vesting start transaction', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // Create prerequisite stock security with VestingTerms; the ledger validates the security has VestingTerms and
    // that vesting_condition_id names a VESTING_START_DATE condition in them.
    const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });

    const vestingStartData = createTestVestingStartData({
      id: generateTestId('vesting-start-tx'),
      security_id: stockSecurity.securityId,
      vesting_condition_id: TEST_VESTING_START_CONDITION_ID,
      date: '2024-01-15',
      comments: ['Employee hire date vesting start'],
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'vestingStart', data: vestingStartData }]);

    const ocfResult = await ctx.ocp.OpenCapTable.vestingStart.get({
      contractId: created.get(vestingStartData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_START');
    expect(ocfResult.data.security_id).toBe(vestingStartData.security_id);
    expect(ocfResult.data.vesting_condition_id).toBe(vestingStartData.vesting_condition_id);
  });

  /**
   * Test: Create a vesting event transaction.
   *
   * VestingEvent records when a milestone-based vesting condition is satisfied.
   */
  test('creates vesting event transaction', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // The ledger validates the security has VestingTerms and that vesting_condition_id names a VESTING_EVENT
    // condition in them.
    const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });

    const vestingEventData = createTestVestingEventData({
      id: generateTestId('vesting-event-tx'),
      security_id: stockSecurity.securityId,
      vesting_condition_id: TEST_VESTING_EVENT_CONDITION_ID,
      date: '2024-06-15',
      comments: ['IPO milestone achieved'],
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'vestingEvent', data: vestingEventData }]);

    const ocfResult = await ctx.ocp.OpenCapTable.vestingEvent.get({
      contractId: created.get(vestingEventData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_EVENT');
    expect(ocfResult.data.security_id).toBe(vestingEventData.security_id);
    expect(ocfResult.data.vesting_condition_id).toBe(vestingEventData.vesting_condition_id);
  });

  /**
   * Test: Create a vesting acceleration transaction.
   *
   * VestingAcceleration records when vesting is accelerated (e.g., due to M&A, termination). It names a lot on
   * vesting terms with unvested shares: the ledger refuses to accelerate a lot that is fully vested.
   */
  test('creates vesting acceleration transaction', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });

    const vestingAccelerationData = createTestVestingAccelerationData({
      id: generateTestId('vesting-accel-tx'),
      security_id: stockSecurity.securityId,
      quantity: '50000',
      reason_text: 'Single-trigger acceleration upon company acquisition',
      date: '2024-12-01',
      comments: ['100% acceleration per employment agreement section 5.2', 'Acquisition by Acquirer Inc.'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'vestingAcceleration', data: vestingAccelerationData },
    ]);

    const ocfResult = await ctx.ocp.OpenCapTable.vestingAcceleration.get({
      contractId: created.get(vestingAccelerationData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(ocfResult.data.object_type).toBe('TX_VESTING_ACCELERATION');
    expect(ocfResult.data.security_id).toBe(vestingAccelerationData.security_id);
    expect(ocfResult.data.reason_text).toBe(vestingAccelerationData.reason_text);
  });

  /** Test: Create all vesting types in a single write: they commit atomically. */
  test('creates multiple vesting transactions in a single write', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // VestingStart/VestingEvent target a security with VestingTerms
    const stockSecurity1 = await setupStockSecurity(book, { withVestingTerms: true });
    const stockSecurity2 = await setupStockSecurity(book, { withVestingTerms: true });

    const created = await applyOperations(book, [
      {
        kind: 'record',
        type: 'vestingStart',
        data: createTestVestingStartData({
          id: generateTestId('vs-1'),
          security_id: stockSecurity1.securityId,
          vesting_condition_id: TEST_VESTING_START_CONDITION_ID,
        }),
      },
      {
        kind: 'record',
        type: 'vestingEvent',
        data: createTestVestingEventData({
          id: generateTestId('ve-1'),
          security_id: stockSecurity1.securityId,
          vesting_condition_id: TEST_VESTING_EVENT_CONDITION_ID,
        }),
      },
      {
        kind: 'record',
        type: 'vestingAcceleration',
        data: createTestVestingAccelerationData({
          id: generateTestId('va-1'),
          security_id: stockSecurity2.securityId,
          quantity: '25000',
          reason_text: 'Termination without cause - partial acceleration',
        }),
      },
    ]);

    expect(created.size).toBe(3);
  });

  /** Test: Create valuation and vesting types together in one write. */
  test('creates valuation and vesting types together', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockSecurity = await setupStockSecurity(book, { withVestingTerms: true });

    const valuationData = createTestValuationData({
      id: generateTestId('valuation-combined'),
      stock_class_id: stockSecurity.stockClassId,
      price_per_share: { amount: '3.00', currency: 'USD' },
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'valuation', data: valuationData },
      {
        kind: 'record',
        type: 'vestingStart',
        data: createTestVestingStartData({
          id: generateTestId('vesting-start-combined'),
          security_id: stockSecurity.securityId,
          vesting_condition_id: TEST_VESTING_START_CONDITION_ID,
        }),
      },
      {
        kind: 'record',
        type: 'vestingAcceleration',
        data: createTestVestingAccelerationData({
          id: generateTestId('vesting-accel-combined'),
          security_id: stockSecurity.securityId,
          quantity: '10000',
          reason_text: 'Combined write acceleration test',
        }),
      },
    ]);

    expect(created.size).toBe(3);

    const valuationResult = await ctx.ocp.OpenCapTable.valuation.get({
      contractId: created.get(valuationData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(valuationResult.data.object_type).toBe('VALUATION');
    expect(valuationResult.data.stock_class_id).toBe(stockSecurity.stockClassId);
  });
});
