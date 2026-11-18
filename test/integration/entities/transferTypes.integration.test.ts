/**
 * Integration tests for transfer types via `CapTable_Apply`.
 *
 * Tests creating and reading:
 * - StockTransfer: a bundled event that writes the buyer's and the balance's issuances with it
 * - ConvertibleTransfer, EquityCompensationTransfer, WarrantTransfer: plain records whose resulting securities are
 *   issued first
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
  createTestConvertibleTransferData,
  createTestEquityCompensationTransferData,
  createTestStockIssuanceData,
  createTestStockTransferData,
  createTestWarrantTransferData,
  generateTestId,
  issueConvertibleSecurities,
  issueEquityCompensationSecurities,
  issueWarrantSecurities,
  readTestBook,
  setupConvertibleSecurity,
  setupEquityCompensationSecurity,
  setupStakeholder,
  setupStockSecurity,
  setupTestBook,
  setupWarrantSecurity,
} from '../utils';

createIntegrationTestSuite('Transfer Type operations', (getContext) => {
  /** Test: Create StockTransfer with its resulting issuances and balance, and read it back as OCF */
  test('creates stock transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stockSecurity = await setupStockSecurity(book);

    // A transfer of 1,000 shares to two new securities; the rest of the lot stays as the balance
    const buyer = await setupStakeholder(book);
    const transferData = createTestStockTransferData({
      security_id: stockSecurity.securityId,
      quantity: '1000',
      resulting_security_ids: [generateTestId('result-1'), generateTestId('result-2')],
      balance_security_id: generateTestId('balance'),
      consideration_text: 'Transfer consideration',
    });
    const output = (securityId: string, stakeholderId: string, quantity: string) =>
      createTestStockIssuanceData({
        stakeholder_id: stakeholderId,
        stock_class_id: stockSecurity.stockClassId,
        security_id: securityId,
        quantity,
        date: transferData.date,
      });

    const created = await applyOperations(book, [
      {
        kind: 'stockTransfer',
        transfer: transferData,
        resulting: [
          output(transferData.resulting_security_ids[0] ?? '', buyer, '600'),
          output(transferData.resulting_security_ids[1] ?? '', buyer, '400'),
        ],
        balance: output(transferData.balance_security_id ?? '', stockSecurity.stakeholderId, '9999000'),
      },
    ]);
    expect(created.get(transferData.id)?.entityType).toBe('stockTransfer');

    const ocfResult = await ctx.ocp.OpenCapTable.stockTransfer.get({
      contractId: created.get(transferData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    // Validate structure
    expect(ocfResult.data.object_type).toBe('TX_STOCK_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.data.balance_security_id).toBe(transferData.balance_security_id);

    // Validate against OCF schema
    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);

    // The source security's state ended; its outputs have states
    const index = await readTestBook(book);
    expect(index.stateOf(stockSecurity.securityId)).toBeNull();
    expect(index.stateOf(transferData.resulting_security_ids[0] ?? '')?.state.quantity).toBe('600');
    expect(index.stateOf(transferData.balance_security_id ?? '')?.state.quantity).toBe('9999000');
  });

  /** Test: Create ConvertibleTransfer and read it back as OCF */
  test('creates convertible transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const convertibleSecurity = await setupConvertibleSecurity(book);

    const transferData = createTestConvertibleTransferData({
      security_id: convertibleSecurity.securityId,
      amount: { amount: '75000', currency: 'USD' },
      resulting_security_ids: [generateTestId('conv-result')],
      consideration_text: 'Convertible note transfer',
    });

    // Resulting securities must resolve to convertible issuances in the cap table's final state.
    await issueConvertibleSecurities(book, {
      stakeholderId: convertibleSecurity.stakeholderId,
      securityIds: transferData.resulting_security_ids,
      issuanceDate: transferData.date,
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'convertibleTransfer', data: transferData }]);

    const ocfResult = await ctx.ocp.OpenCapTable.convertibleTransfer.get({
      contractId: created.get(transferData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_CONVERTIBLE_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.amount.amount).toBe(transferData.amount.amount);
    expect(ocfResult.data.amount.currency).toBe(transferData.amount.currency);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /** Test: Create EquityCompensationTransfer and read it back as OCF */
  test('creates equity compensation transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const eqCompSecurity = await setupEquityCompensationSecurity(book);

    const transferData = createTestEquityCompensationTransferData({
      security_id: eqCompSecurity.securityId,
      quantity: '10000',
      resulting_security_ids: [generateTestId('eq-result')],
      balance_security_id: generateTestId('eq-balance'),
      consideration_text: 'Stock option transfer',
    });

    // Balance and resulting securities must resolve to equity compensation issuances in the final state.
    await issueEquityCompensationSecurities(book, {
      stakeholderId: eqCompSecurity.stakeholderId,
      stockClassId: eqCompSecurity.stockClassId,
      securityIds: [...transferData.resulting_security_ids, transferData.balance_security_id ?? ''],
      issuanceDate: transferData.date,
    });
    const created = await applyOperations(book, [
      { kind: 'record', type: 'equityCompensationTransfer', data: transferData },
    ]);

    const ocfResult = await ctx.ocp.OpenCapTable.equityCompensationTransfer.get({
      contractId: created.get(transferData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_EQUITY_COMPENSATION_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);
    expect(ocfResult.data.balance_security_id).toBe(transferData.balance_security_id);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });

  /** Test: Create WarrantTransfer and read it back as OCF */
  test('creates warrant transfer and reads it back as valid OCF', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const warrantSecurity = await setupWarrantSecurity(book);

    const transferData = createTestWarrantTransferData({
      security_id: warrantSecurity.securityId,
      quantity: '5000',
      resulting_security_ids: [generateTestId('warrant-result-1'), generateTestId('warrant-result-2')],
      consideration_text: 'Warrant transfer to new holder',
    });

    // Resulting securities must resolve to warrant issuances in the cap table's final state.
    await issueWarrantSecurities(book, {
      stakeholderId: warrantSecurity.stakeholderId,
      securityIds: transferData.resulting_security_ids,
      issuanceDate: transferData.date,
    });
    const created = await applyOperations(book, [{ kind: 'record', type: 'warrantTransfer', data: transferData }]);

    const ocfResult = await ctx.ocp.OpenCapTable.warrantTransfer.get({
      contractId: created.get(transferData.id)?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });

    expect(ocfResult.data.object_type).toBe('TX_WARRANT_TRANSFER');
    expect(ocfResult.data.id).toBe(transferData.id);
    expect(ocfResult.data.security_id).toBe(transferData.security_id);
    expect(ocfResult.data.quantity).toBe(transferData.quantity);
    expect(ocfResult.data.resulting_security_ids).toEqual(transferData.resulting_security_ids);

    await validateOcfObject(ocfResult.data as unknown as Record<string, unknown>);
  });
});
