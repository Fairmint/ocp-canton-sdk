/**
 * Integration tests for stock class splits on OpenCapTable-v35.
 *
 * Every split uses one procedure, `register.recordSplit`: freeze the class, check that nothing in it is dated on or
 * after the split, record the split and unfreeze. A split touches no stock state: lots keep their quantities and each
 * applies it at its next event, with the floor function the ledger shares with the SDK. Covers:
 *
 * - A split applied to a lot at its next event, and scaled on read
 * - A settlement hold placed before a split, voided from the split's date
 * - A split refused because records are dated on or after it, which leaves the class unfrozen
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/register/splits
 * ```
 */

import { recordSplit } from '../../../src/register/checks/splits';
import { planDraw } from '../../../src/register/draw';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  cancelHolds,
  createTestStockIssuanceData,
  createTestStockTransferData,
  createTestValuationData,
  generateDateString,
  generateTestId,
  placeHolds,
  readTestBook,
  setupStakeholder,
  setupStockSecurity,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Stock class splits', (getContext) => {
  test('applies a split to a lot at its next event, and scales reads before it', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const today = generateDateString(0);

    const lot = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });
    const buyer = await setupStakeholder(book);
    await recordSplit(book.writer, {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: generateTestId('split'),
      date: today,
      stock_class_id: lot.stockClassId,
      split_ratio: { numerator: '3', denominator: '2' },
    });

    // The lot keeps its quantity, in the units of its last event; reads scale it to the date asked
    let index = await readTestBook(book);
    expect(index.stateOf(lot.securityId)?.state.quantity).toBe('1000');
    expect(index.currentQuantity(lot.securityId, today)).toBe('1500');

    // A transfer dated on the split's day is in post-split units: the ledger applies the split to the source first,
    // so the lot of 1,000 is 1,500 shares, 500 of which move to the buyer
    const transferData = createTestStockTransferData({
      security_id: lot.securityId,
      date: today,
      quantity: '500',
      resulting_security_ids: [generateTestId('result')],
      balance_security_id: generateTestId('balance'),
    });
    const output = (securityId: string, stakeholderId: string, quantity: string) =>
      createTestStockIssuanceData({
        stakeholder_id: stakeholderId,
        stock_class_id: lot.stockClassId,
        security_id: securityId,
        quantity,
        date: today,
      });
    await applyOperations(book, [
      {
        kind: 'stockTransfer',
        transfer: transferData,
        resulting: [output(transferData.resulting_security_ids[0] ?? '', buyer, '500')],
        balance: output(transferData.balance_security_id ?? '', lot.stakeholderId, '1000'),
      },
    ]);

    index = await readTestBook(book);
    expect(index.stateOf(lot.securityId)).toBeNull();
    expect(index.stateOf(transferData.resulting_security_ids[0] ?? '')?.state).toMatchObject({
      quantity: '500',
      split_epoch: 1,
    });
    expect(index.stateOf(transferData.balance_security_id ?? '')?.state).toMatchObject({
      quantity: '1000',
      split_epoch: 1,
    });
  });

  /**
   * A settlement hold placed before a split can never be drawn on or after the split's date: the trade's quantity and
   * price per share no longer match the class. Draws are dated on the ledger date, so the split here is dated the day
   * after the hold; the hold stays good for today and is void from the split's date.
   */
  test('a split voids a settlement hold from its date, and the hold can then only be canceled', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const today = generateDateString(0);
    const splitDate = generateDateString(1);

    const lot = await setupStockSecurity(book, {
      issuanceOverrides: { quantity: '1000', cost_basis: { amount: '1000.00', currency: 'USD' } },
    });
    const settlementId = generateTestId('trade');
    const [hold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });
    const holdId = hold?.hold_id ?? '';

    // The split is dated after every record of the class, the hold's included
    await recordSplit(book.writer, {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: generateTestId('split'),
      date: splitDate,
      stock_class_id: lot.stockClassId,
      split_ratio: { numerator: '2', denominator: '1' },
    });

    // Placed before the split: good for the day it was placed, void from the split's date
    const index = await readTestBook(book);
    expect(index.openHolds(lot.securityId, today)).toMatchObject([{ hold_id: holdId, voided: false }]);
    expect(index.openHolds(lot.securityId, splitDate)).toMatchObject([{ hold_id: holdId, voided: true }]);

    // A draw dated on the split's date is refused, as the ledger refuses it
    const state = index.stateOf(lot.securityId);
    const epoch = index.epochOf(lot.stockClassId);
    expect(() =>
      planDraw({
        state: state?.state ?? (undefined as never),
        epochSplits: epoch?.epoch.splits ?? [],
        settlementId,
        holdId,
        quantity: '500',
        sharePrice: { amount: '2.00', currency: 'USD' },
        customId: 'BUY-1',
        originIssuance: { contractId: lot.stockIssuanceContractId, data: lot.issuance },
        date: splitDate,
        capTableId: book.context.cap_table_id,
      })
    ).toThrow(/split/);

    // The TA cancels it, naming the split; the hold occupied the lot's settlement-hold slot until then
    const canceled = await cancelHolds(book, {
      date: today,
      holds: [{ security_id: lot.securityId, hold_id: holdId, reason_text: 'Voided by the split of the class' }],
    });
    expect(canceled.canceled).toHaveLength(1);
    expect((await readTestBook(book)).openHolds(lot.securityId, today)).toEqual([]);
  });

  test('refuses a split when records are dated on or after it, and leaves the class unfrozen', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);

    // A valuation of the class dated today is on or after a split dated today
    const lot = await setupStockSecurity(book, { issuanceOverrides: { quantity: '1000' } });
    const valuation = createTestValuationData({
      id: generateTestId('valuation'),
      stock_class_id: lot.stockClassId,
      effective_date: generateDateString(0),
    });
    await applyOperations(book, [{ kind: 'record', type: 'valuation', data: valuation }]);

    const rejection = await recordSplit(book.writer, {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: generateTestId('split'),
      date: generateDateString(0),
      stock_class_id: lot.stockClassId,
      split_ratio: { numerator: '2', denominator: '1' },
    }).catch((error: unknown) => error);

    expect(rejection).toMatchObject({
      name: 'OcpValidationError',
      classification: 'split_records_on_or_after',
      offenders: [{ objectId: valuation.id, entityType: 'valuation' }],
    });

    // The class was frozen for the check and unfrozen again; no split was recorded
    const index = await readTestBook(book);
    expect(index.epochOf(lot.stockClassId)?.epoch).toMatchObject({ frozen: false, splits: [] });
    expect(index.stateOf(lot.securityId)?.state.quantity).toBe('1000');
  });
});
