/**
 * Integration tests for acceptance types via `CapTable_Apply`.
 *
 * Tests creating, reading, editing and deleting:
 * - StockAcceptance
 * - WarrantAcceptance
 * - ConvertibleAcceptance
 * - EquityCompensationAcceptance
 *
 * Acceptances name an existing security, so each test issues one first. Edits and deletes go through
 * `CapTable_Restate`.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../../src/types/native';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  generateDateString,
  generateTestId,
  readTestBook,
  restateOperations,
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupStockSecurity,
  setupTestBook,
  setupWarrantSecurity,
} from '../utils';

/** Create test stock acceptance data with optional overrides. */
function createTestStockAcceptanceData(
  overrides: Omit<Partial<OcfStockAcceptance>, 'object_type'> & { security_id: string }
): OcfStockAcceptance {
  const id = overrides.id ?? generateTestId('stock-accept');
  return {
    id,
    date: generateDateString(0),
    ...overrides,
    object_type: 'TX_STOCK_ACCEPTANCE',
  };
}

/** Create test warrant acceptance data with optional overrides. */
function createTestWarrantAcceptanceData(
  overrides: Omit<Partial<OcfWarrantAcceptance>, 'object_type'> & { security_id: string }
): OcfWarrantAcceptance {
  const id = overrides.id ?? generateTestId('warrant-accept');
  return {
    id,
    date: generateDateString(0),
    ...overrides,
    object_type: 'TX_WARRANT_ACCEPTANCE',
  };
}

/** Create test convertible acceptance data with optional overrides. */
function createTestConvertibleAcceptanceData(
  overrides: Omit<Partial<OcfConvertibleAcceptance>, 'object_type'> & { security_id: string }
): OcfConvertibleAcceptance {
  const id = overrides.id ?? generateTestId('conv-accept');
  return {
    id,
    date: generateDateString(0),
    ...overrides,
    object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
  };
}

/** Create test equity compensation acceptance data with optional overrides. */
function createTestEquityCompensationAcceptanceData(
  overrides: Omit<Partial<OcfEquityCompensationAcceptance>, 'object_type'> & { security_id: string }
): OcfEquityCompensationAcceptance {
  const id = overrides.id ?? generateTestId('equity-accept');
  return {
    id,
    date: generateDateString(0),
    ...overrides,
    object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
  };
}

createIntegrationTestSuite('Acceptance Type operations', (getContext) => {
  /** Test: Create stock acceptance. */
  test('creates stock acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const stockAcceptanceData = createTestStockAcceptanceData({
      id: generateTestId('stock-accept'),
      security_id: stockSecurity.securityId,
      comments: ['Stock acceptance created via CapTable_Apply'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'stockAcceptance', data: stockAcceptanceData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockAcceptance.get({
      contractId: created.get(stockAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data).toMatchObject({
      object_type: 'TX_STOCK_ACCEPTANCE',
      security_id: stockSecurity.securityId,
      comments: ['Stock acceptance created via CapTable_Apply'],
    });
  });

  /** Test: Create warrant acceptance. */
  test('creates warrant acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const warrantSecurity = await setupWarrantSecurity(book);

    const warrantAcceptanceData = createTestWarrantAcceptanceData({
      id: generateTestId('warrant-accept'),
      security_id: warrantSecurity.securityId,
      comments: ['Warrant acceptance created via CapTable_Apply'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'warrantAcceptance', data: warrantAcceptanceData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.warrantAcceptance.get({
      contractId: created.get(warrantAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data).toMatchObject({
      object_type: 'TX_WARRANT_ACCEPTANCE',
      security_id: warrantSecurity.securityId,
    });
  });

  /** Test: Create convertible acceptance. */
  test('creates convertible acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const convertibleSecurity = await setupConvertibleSecurity(book);

    const convertibleAcceptanceData = createTestConvertibleAcceptanceData({
      id: generateTestId('conv-accept'),
      security_id: convertibleSecurity.securityId,
      comments: ['Convertible acceptance created via CapTable_Apply'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'convertibleAcceptance', data: convertibleAcceptanceData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.convertibleAcceptance.get({
      contractId: created.get(convertibleAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data).toMatchObject({
      object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
      security_id: convertibleSecurity.securityId,
    });
  });

  /** Test: Create equity compensation acceptance. */
  test('creates equity compensation acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const equitySecurity = await setupEquityCompensationSecurity(book);

    const equityAcceptanceData = createTestEquityCompensationAcceptanceData({
      id: generateTestId('equity-accept'),
      security_id: equitySecurity.securityId,
      comments: ['Equity compensation acceptance created via CapTable_Apply'],
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'equityCompensationAcceptance', data: equityAcceptanceData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.equityCompensationAcceptance.get({
      contractId: created.get(equityAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data).toMatchObject({
      object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
      security_id: equitySecurity.securityId,
    });
  });

  /** Test: Create all four acceptance types in a single write. */
  test('creates multiple acceptance types in a single write', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    const stockSecurity = await setupStockSecurity(book);
    const warrantSecurity = await setupWarrantSecurity(book);
    const convertibleSecurity = await setupConvertibleSecurity(book);
    const equitySecurity = await setupEquityCompensationSecurity(book);

    const stockAcceptance = createTestStockAcceptanceData({ security_id: stockSecurity.securityId });
    const warrantAcceptance = createTestWarrantAcceptanceData({ security_id: warrantSecurity.securityId });
    const convertibleAcceptance = createTestConvertibleAcceptanceData({
      security_id: convertibleSecurity.securityId,
    });
    const equityAcceptance = createTestEquityCompensationAcceptanceData({ security_id: equitySecurity.securityId });

    const summary = await book.writer.apply([
      { kind: 'record', type: 'stockAcceptance', data: stockAcceptance },
      { kind: 'record', type: 'warrantAcceptance', data: warrantAcceptance },
      { kind: 'record', type: 'convertibleAcceptance', data: convertibleAcceptance },
      { kind: 'record', type: 'equityCompensationAcceptance', data: equityAcceptance },
    ]);

    expect(summary.batches).toHaveLength(1);
    const records = summary.batches[0]?.result.records ?? new Map();
    expect(records.size).toBe(4);
    expect(records.get(stockAcceptance.id)?.entityType).toBe('stockAcceptance');
    expect(records.get(warrantAcceptance.id)?.entityType).toBe('warrantAcceptance');
    expect(records.get(convertibleAcceptance.id)?.entityType).toBe('convertibleAcceptance');
    expect(records.get(equityAcceptance.id)?.entityType).toBe('equityCompensationAcceptance');
  });

  /** Test: Comments are optional. */
  test('creates acceptance without optional comments', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const stockAcceptanceData = createTestStockAcceptanceData({ security_id: stockSecurity.securityId });
    expect(stockAcceptanceData.comments).toBeUndefined();
    const created = await applyOperations(book, [
      { kind: 'record', type: 'stockAcceptance', data: stockAcceptanceData },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockAcceptance.get({
      contractId: created.get(stockAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.security_id).toBe(stockSecurity.securityId);
    expect(readBack.data.comments).toBeUndefined();
  });

  /** Test: Edit an acceptance through a restatement. */
  test('edits stock acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const stockAcceptanceData = createTestStockAcceptanceData({
      id: generateTestId('edit-stock-accept'),
      security_id: stockSecurity.securityId,
      comments: ['Original comment'],
    });
    await applyOperations(book, [{ kind: 'record', type: 'stockAcceptance', data: stockAcceptanceData }]);

    const edited = await restateOperations(book, [
      {
        kind: 'edit',
        type: 'stockAcceptance',
        data: { ...stockAcceptanceData, comments: ['Updated comment'] },
      },
    ]);

    const readBack = await ctx.ocp.OpenCapTable.stockAcceptance.get({
      contractId: edited.get(stockAcceptanceData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(readBack.data.comments).toEqual(['Updated comment']);
  });

  /** Test: Delete an acceptance through a restatement. */
  test('deletes stock acceptance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    const stockAcceptanceData = createTestStockAcceptanceData({
      id: generateTestId('delete-stock-accept'),
      security_id: stockSecurity.securityId,
    });
    await applyOperations(book, [{ kind: 'record', type: 'stockAcceptance', data: stockAcceptanceData }]);
    expect((await readTestBook(book)).record(stockAcceptanceData.id)).not.toBeNull();

    await restateOperations(book, [{ kind: 'delete', objectId: stockAcceptanceData.id }]);

    expect((await readTestBook(book)).record(stockAcceptanceData.id)).toBeNull();
  });
});
