/**
 * Integration tests for holds and settlement on OpenCapTable-v35.
 *
 * A trade's lots are put on `REGISTER_SETTLEMENT` hold, then `CapTable_Settle` draws them: the buyer's security and
 * the seller's balance are created, and the result carries the delivered terms. There is no delivery proof: the
 * settling transaction's result is the record. Covers:
 *
 * - Placing a settlement hold and reading its record
 * - Settling 750 of 1,000 shares, whose delivered terms equal the draw `planDraw` planned
 * - A draw of the whole hold, canceling holds, and a stop that cancels a settlement hold
 * - A settlement dated off the ledger date, which the ledger refuses
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/register/holdsSettlement
 * ```
 */

import { findSettleResults } from '../../../src/functions/OpenCapTable/capTable/settle';
import { planDraw } from '../../../src/register/draw';
import type { PlannedDraw } from '../../../src/types/register';
import type { IntegrationTestContext } from '../setup';
import { createIntegrationTestSuite } from '../setup';
import {
  cancelHolds,
  generateDateString,
  generateTestId,
  placeHolds,
  readTestBook,
  settle,
  setupStakeholder,
  setupStockSecurity,
  setupTestBook,
  type StockSecuritySetup,
  type TestBook,
} from '../utils';

/** A trade's seller lot of 1,000 shares with a 1,000.00 USD cost basis, and its buyer. */
async function tradeBook(ctx: IntegrationTestContext): Promise<{
  book: TestBook;
  lot: StockSecuritySetup;
  buyerStakeholderId: string;
  today: string;
}> {
  const book = await setupTestBook(ctx);
  const lot = await setupStockSecurity(book, {
    issuanceOverrides: { quantity: '1000', cost_basis: { amount: '1000.00', currency: 'USD' } },
  });
  const buyerStakeholderId = await setupStakeholder(book);
  return { book, lot, buyerStakeholderId, today: generateDateString(0) };
}

/** Plan the draw of a lot under a settlement, from the book as the writer's index holds it. */
function planLotDraw(
  book: TestBook,
  lot: StockSecuritySetup,
  draw: { settlementId: string; holdId: string; quantity: string; date: string }
): PlannedDraw {
  const { index } = book.writer;
  const state = index.stateOf(lot.securityId);
  const epoch = index.epochOf(lot.stockClassId);
  if (state === null || epoch === null) throw new Error('The lot has no state or its class no epoch');
  return planDraw({
    state: state.state,
    epochSplits: epoch.epoch.splits,
    settlementId: draw.settlementId,
    holdId: draw.holdId,
    quantity: draw.quantity,
    sharePrice: { amount: '2.00', currency: 'USD' },
    customId: `BUY-${lot.securityId}`,
    originIssuance: { contractId: lot.stockIssuanceContractId, data: lot.issuance },
    date: draw.date,
    capTableId: book.context.cap_table_id,
  });
}

createIntegrationTestSuite('Holds and settlement', (getContext) => {
  test('places a settlement hold on a lot and reads its record', async () => {
    const ctx = getContext();
    const { book, lot, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');

    const [hold, ...rest] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });
    expect(rest).toEqual([]);
    expect(hold).toMatchObject({
      security_id: lot.securityId,
      stakeholder_id: lot.stakeholderId,
      stock_class_id: lot.stockClassId,
      split_epoch: 0,
      canceled_settlement_hold: null,
    });

    // The lot's state carries the open hold, which no split has voided
    const index = await readTestBook(book);
    expect(index.openHolds(lot.securityId, today)).toMatchObject([
      {
        hold_id: hold?.hold_id,
        hold_type: 'REGISTER_SETTLEMENT',
        reference: settlementId,
        quantity: '1000',
        voided: false,
      },
    ]);

    // The register wrote the hold as a record of the Fairmint OCF extension, which reads back as OCF
    const holdRecord = await ctx.ocp.OpenCapTable.stockHold.get({
      contractId: index.record(hold?.hold_id ?? '')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(holdRecord.data).toMatchObject({
      object_type: 'TX_STOCK_HOLD',
      hold_type: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      security_id: lot.securityId,
      quantity: '1000',
    });
  });

  /**
   * The settlement arithmetic a transfer agent needs: 750 of 1,000 shares at 2.00 USD with a 1,000.00 cost basis
   * gives the buyer 750 shares on a 1,500.00 basis and the seller a balance of 250 shares on a 250.00 basis.
   */
  test('settles 750 of 1,000 shares and delivers the terms planDraw planned', async () => {
    const ctx = getContext();
    const { book, lot, buyerStakeholderId, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');

    const [hold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });
    const holdId = hold?.hold_id ?? '';

    const planned = planLotDraw(book, lot, { settlementId, holdId, quantity: '750', date: today });
    expect(planned.lot.buyer_cost_basis).toEqual({ amount: '1500', currency: 'USD' });
    expect(planned.balance).toMatchObject({ quantity: '250', cost_basis: { amount: '250', currency: 'USD' } });

    const { terms, response } = await settle(book, {
      settlementId,
      date: today,
      buyer: { kind: 'existingStakeholder', stakeholderId: buyerStakeholderId },
      lots: [{ kind: 'draw', lot: planned.lot }],
    });

    // The delivered terms are the settlement's result, which equals what planDraw expected
    expect(terms).toMatchObject({
      context: book.context,
      settlement_id: settlementId,
      seller_stakeholder_id: lot.stakeholderId,
      buyer_stakeholder_id: buyerStakeholderId,
      stock_class_id: lot.stockClassId,
      quantity: '750',
    });
    expect(terms.lots).toHaveLength(1);
    const [delivered] = terms.lots;
    expect(delivered).toMatchObject(planned.delivered);

    // findSettleResults reads the same terms from the transaction itself, wherever the settlement was exercised
    const found = findSettleResults(response.transaction);
    expect(found).toHaveLength(1);
    expect(found[0]?.terms).toEqual(terms);
    expect(found[0]?.capTableContractId).toBe(book.capTableContractId);

    // The book after: the seller's lot is consumed into the buyer's security and the seller's balance
    const index = await readTestBook(book);
    expect(index.stateOf(lot.securityId)).toBeNull();
    const draw = delivered?.kind === 'draw' ? delivered : null;
    expect(draw).not.toBeNull();
    const buyerState = index.stateOf(draw?.buyer_security_id ?? '')?.state;
    expect(buyerState).toMatchObject({
      quantity: '750',
      stakeholder_id: buyerStakeholderId,
      holds: [],
      delivery: { reference: settlementId, seller_stakeholder_id: lot.stakeholderId, transfer_id: draw?.transfer_id },
    });
    const balanceState = index.stateOf(draw?.balance_security_id ?? '')?.state;
    expect(balanceState).toMatchObject({ quantity: '250', stakeholder_id: lot.stakeholderId, holds: [] });

    // The transfer and the buyer's and balance's issuances are records the ledger wrote under derived IDs
    const transfer = await ctx.ocp.OpenCapTable.stockTransfer.get({
      contractId: index.record(draw?.transfer_id ?? '')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(transfer.data).toMatchObject({
      quantity: '750',
      security_id: lot.securityId,
      resulting_security_ids: [draw?.buyer_security_id],
      balance_security_id: draw?.balance_security_id,
    });
    const buyerIssuance = await ctx.ocp.OpenCapTable.stockIssuance.get({
      contractId: index.record(draw?.buyer_issuance_id ?? '')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(buyerIssuance.data).toMatchObject({
      quantity: '750',
      share_price: { amount: '2', currency: 'USD' },
      cost_basis: { amount: '1500', currency: 'USD' },
      stakeholder_id: buyerStakeholderId,
    });
    const balanceIssuance = await ctx.ocp.OpenCapTable.stockIssuance.get({
      contractId: index.record(draw?.balance_issuance_id ?? '')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(balanceIssuance.data).toMatchObject({
      quantity: '250',
      cost_basis: { amount: '250', currency: 'USD' },
      stakeholder_id: lot.stakeholderId,
    });
  });

  test('a draw of the whole hold leaves no balance', async () => {
    const ctx = getContext();
    const { book, lot, buyerStakeholderId, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');

    const [hold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });
    const planned = planLotDraw(book, lot, {
      settlementId,
      holdId: hold?.hold_id ?? '',
      quantity: '1000',
      date: today,
    });
    expect(planned.balance).toBeNull();

    const { terms } = await settle(book, {
      settlementId,
      date: today,
      buyer: { kind: 'existingStakeholder', stakeholderId: buyerStakeholderId },
      lots: [{ kind: 'draw', lot: planned.lot }],
    });

    expect(terms.quantity).toBe('1000');
    expect(terms.lots[0]).toMatchObject({ kind: 'draw', balance_security_id: null, balance_state: null });
    expect(terms.lots[0]).toMatchObject(planned.delivered);
  });

  test('cancels a settlement hold, which frees the lot', async () => {
    const ctx = getContext();
    const { book, lot, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');

    const [hold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '400' }],
    });

    const result = await cancelHolds(book, {
      date: today,
      holds: [{ security_id: lot.securityId, hold_id: hold?.hold_id ?? '', reason_text: 'Trade not executed' }],
    });
    expect(result.canceled).toHaveLength(1);

    // The hold is gone from the lot's state; the cancellation is a record that names it
    const index = await readTestBook(book);
    expect(index.openHolds(lot.securityId, today)).toEqual([]);
    const cancellation = await ctx.ocp.OpenCapTable.stockHoldCancellation.get({
      contractId: index.record(result.canceled[0]?.hold_cancellation_id ?? '')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(cancellation.data).toMatchObject({
      object_type: 'TX_STOCK_HOLD_CANCELLATION',
      security_id: lot.securityId,
      reason_text: 'Trade not executed',
    });
  });

  test('a stop cancels the lot settlement hold, so the trade can only be released', async () => {
    const ctx = getContext();
    const { book, lot, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');

    const [settlementHold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });

    const [stop] = await placeHolds(book, {
      holdType: 'STOP_TRANSFER',
      reference: generateTestId('case'),
      date: today,
      reasonText: 'Court order',
      lots: [{ security_id: lot.securityId }],
    });

    // The result names the settlement hold the stop canceled, for the TA to release that trade
    expect(stop?.canceled_settlement_hold).toMatchObject({
      reference: settlementId,
      hold_id: settlementHold?.hold_id,
    });
    const index = await readTestBook(book);
    expect(index.openHolds(lot.securityId, today)).toMatchObject([
      { hold_id: stop?.hold_id, hold_type: 'STOP_TRANSFER' },
    ]);

    // The canceled hold can no longer be drawn: the draw is refused before it is submitted
    expect(() =>
      planLotDraw(book, lot, {
        settlementId,
        holdId: settlementHold?.hold_id ?? '',
        quantity: '10',
        date: today,
      })
    ).toThrow(/stopped|not open/);
  });

  test('refuses a settlement not dated on the ledger date', async () => {
    const ctx = getContext();
    const { book, lot, buyerStakeholderId, today } = await tradeBook(ctx);
    const settlementId = generateTestId('trade');
    const tomorrow = generateDateString(1);

    const [hold] = await placeHolds(book, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: settlementId,
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lot.securityId, quantity: '1000' }],
    });

    // planDraw cannot know the ledger's date, so the draw plans; the ledger refuses the settlement
    const planned = planLotDraw(book, lot, {
      settlementId,
      holdId: hold?.hold_id ?? '',
      quantity: '750',
      date: tomorrow,
    });
    await expect(
      settle(book, {
        settlementId,
        date: tomorrow,
        buyer: { kind: 'existingStakeholder', stakeholderId: buyerStakeholderId },
        lots: [{ kind: 'draw', lot: planned.lot }],
      })
    ).rejects.toThrow(`${tomorrow} is not the ledger date`);

    // Nothing moved: the hold is open and the lot untouched
    const index = await readTestBook(book);
    expect(index.stateOf(lot.securityId)?.state.quantity).toBe('1000');
    expect(index.openHolds(lot.securityId, today)).toHaveLength(1);
  });
});
