/**
 * Integration tests for the switch to a rebuilt book, teardown, purge and close on OpenCapTable-v35.
 *
 * A book whose correction the restatement limits refuse, or that changes its TA, is rebuilt as a new cap table. The
 * transfer agent has every open trade released, the new book is replicated, `CapTable_BeginTeardown` ends every write
 * to the old one, its open stops are placed again on the new book, and `system_operator` may then purge the old book
 * and close it. Covers:
 *
 * - Readiness: an open settlement hold keeps the old book from teardown
 * - The whole switch: replicate, tear down, carry the stop over, reconcile the stops, purge and close
 * - A torn-down book refuses every write
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/register/teardown
 * ```
 */

import {
  buildBeginTeardownCommand,
  readBeginTeardownResult,
} from '../../../src/functions/OpenCapTable/capTable/teardown';
import {
  checkTeardownReady,
  executeReplication,
  planPurge,
  planReplication,
  planStopReplacement,
  readTeardownBook,
  reconcileStops,
  stopPlacementWrite,
} from '../../../src/replication';
import type { OcfIssuer } from '../../../src/types/native';
import { buildOcfManifest } from '../../../src/utils/cantonOcfExtractor';
import type { IntegrationTestContext } from '../setup';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  cancelHolds,
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockIssuanceData,
  generateDateString,
  generateTestId,
  placeHolds,
  readTestBook,
  setupTestBook,
  type TestBook,
} from '../utils';

/** An old book with a holder's two lots; the first lot is stopped by a case. */
async function oldBookWithLots(
  ctx: IntegrationTestContext,
  issuerData: OcfIssuer
): Promise<{ book: TestBook; lots: [string, string]; caseReference: string }> {
  const book = await setupTestBook(ctx, issuerData);
  const stakeholder = createTestStakeholderData();
  const stockClassId = generateTestId('stock-class');
  const lots: [string, string] = [generateTestId('lot-1'), generateTestId('lot-2')];
  await applyOperations(book, [
    { kind: 'record', type: 'stakeholder', data: stakeholder },
    {
      kind: 'record',
      type: 'stockClass',
      data: {
        object_type: 'STOCK_CLASS',
        id: stockClassId,
        name: 'Common',
        class_type: 'COMMON',
        default_id_prefix: 'CS',
        initial_shares_authorized: '1000000',
        seniority: '1',
        votes_per_share: '1',
        price_per_share: { amount: '1.00', currency: 'USD' },
      },
    },
    ...lots.map((securityId) => ({
      kind: 'record' as const,
      type: 'stockIssuance' as const,
      data: createTestStockIssuanceData({
        stakeholder_id: stakeholder.id,
        stock_class_id: stockClassId,
        security_id: securityId,
        quantity: '1000',
      }),
    })),
  ]);
  return { book, lots, caseReference: generateTestId('case') };
}

/** Replicate an old book's records into a new cap table of the same parties, as the new book's own writer. */
async function rebuild(ctx: IntegrationTestContext, oldBook: TestBook): Promise<TestBook> {
  const newBook = await setupTestBook(ctx, oldBook.issuerData);
  const plan = await planReplication({
    source: buildOcfManifest(await readTestBook(oldBook)),
    index: newBook.writer.index,
    options: { ledger: ctx.ocp.ledger },
  });
  expect(plan.status).toBe('ready');
  await executeReplication(newBook.writer, plan);
  return newBook;
}

createIntegrationTestSuite('Teardown, purge and close', (getContext) => {
  test('an open settlement hold keeps the old book from teardown until the trade is released', async () => {
    const ctx = getContext();
    const issuerData = createTestIssuerData();
    const { book: oldBook, lots } = await oldBookWithLots(ctx, issuerData);
    const newBook = await rebuild(ctx, oldBook);
    const today = generateDateString(0);

    const [hold] = await placeHolds(oldBook, {
      holdType: 'REGISTER_SETTLEMENT',
      reference: generateTestId('trade'),
      date: today,
      reasonText: 'Trade placed for settlement',
      lots: [{ security_id: lots[0], quantity: '500' }],
    });

    // The rebuild holds every record, but the trade is open: the TA must release it first
    let oldIndex = await readTestBook(oldBook);
    const blocked = checkTeardownReady({
      oldIndex,
      newIndex: await readTestBook(newBook),
      drainOffset: oldIndex.offset,
      asOf: today,
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.issues.map((issue) => issue.condition)).toEqual(['settlement_hold']);

    await cancelHolds(oldBook, {
      date: today,
      holds: [{ security_id: lots[0], hold_id: hold?.hold_id ?? '', reason_text: 'Rebuilding the book' }],
    });
    oldIndex = await readTestBook(oldBook);
    const ready = checkTeardownReady({
      oldIndex,
      newIndex: await readTestBook(newBook),
      drainOffset: oldIndex.offset,
      asOf: today,
    });
    expect(ready).toMatchObject({ ready: true, issues: [], differences: [] });
  });

  test('switches to a rebuilt book: teardown, the stop carried over, purge and close', async () => {
    const ctx = getContext();
    const { book: oldBook, lots, caseReference } = await oldBookWithLots(ctx, createTestIssuerData());
    const today = generateDateString(0);

    // A case stops the first lot of the old book
    await placeHolds(oldBook, {
      holdType: 'STOP_TRANSFER',
      reference: caseReference,
      date: today,
      reasonText: 'Court order',
      lots: [{ security_id: lots[0] }],
    });

    // Steps 1 to 3: the old book is drained (no writer is sending it anything), the new book holds every record, and
    // the transfer agent commits CapTable_BeginTeardown
    const newBook = await rebuild(ctx, oldBook);
    const drained = await readTestBook(oldBook);
    const readiness = checkTeardownReady({
      oldIndex: drained,
      newIndex: await readTestBook(newBook),
      drainOffset: drained.offset,
    });
    expect(readiness).toMatchObject({ ready: true, issues: [] });

    const begun = await oldBook.writer.submit({
      scopes: [{ scope: 'issuer', mode: 'exclusive' }],
      build: () =>
        buildBeginTeardownCommand({
          ...oldBook.writer.capTableAnchor(),
          transferAgent: ctx.transferAgentParty,
        }),
      decode: (response) => readBeginTeardownResult(response),
    });
    expect(begun.result).toBeTruthy();

    // The torn-down book refuses every write
    await expect(
      applyOperations(oldBook, [{ kind: 'record', type: 'stakeholder', data: createTestStakeholderData() }])
    ).rejects.toThrow();

    // Step 4: the old book read at or after the commit: every open stop on it is placed again on the new book
    const oldAtTeardown = await readTeardownBook(ctx.ocp.ledger, {
      capTableId: oldBook.context.cap_table_id,
      readAs: ctx.transferAgentParty,
    });
    expect(oldAtTeardown.anchor?.status).toBe('TEARING_DOWN');
    const replacement = planStopReplacement({
      oldIndexAtTeardown: oldAtTeardown,
      newIndex: await readTestBook(newBook),
    });
    expect(replacement.unmapped).toEqual([]);
    expect(replacement.placements).toHaveLength(1);
    expect(replacement.stops).toMatchObject([
      { securityId: lots[0], reference: caseReference, reasonText: 'Court order' },
    ]);

    for (const placement of replacement.placements) {
      const { kind: _kind, ...write } = stopPlacementWrite(placement, today);
      await placeHolds(newBook, write);
    }

    // Step 5: every open stop of the old book has its match on the new one
    const reconciliation = reconcileStops(oldAtTeardown, await readTestBook(newBook));
    expect(reconciliation).toMatchObject({ reconciled: true, mismatches: [] });
    expect(reconciliation.matched).toHaveLength(1);

    // The optional purge, as system_operator: batches of at most 500 contracts, then CapTable_Close
    const purge = planPurge(oldAtTeardown);
    expect(purge.status).toBe('ready');
    expect(purge.commands.length).toBe(purge.batches.length + 1);
    for (const command of purge.commands) {
      await ctx.ocp.ledger.submitAndWaitForTransaction({
        commands: [command.command],
        actAs: command.actAs,
        disclosedContracts: command.disclosedContracts,
      });
    }

    // The old book leaves its anchor as a tombstone and nothing else; the new book is untouched and Active
    const closed = await readTeardownBook(ctx.ocp.ledger, {
      capTableId: oldBook.context.cap_table_id,
      readAs: ctx.transferAgentParty,
    });
    expect(closed.anchor?.status).toBe('CLOSED');
    expect(closed.counts()).toEqual({ anchors: 1, records: 0, states: 0, epochs: 0, shards: 0 });
    expect(planPurge(closed)).toMatchObject({ status: 'closed', commands: [] });
    const rebuilt = await readTestBook(newBook);
    expect(rebuilt.anchor?.status).toBe('ACTIVE');
    expect(rebuilt.openHolds(lots[0], today)).toMatchObject([{ hold_type: 'STOP_TRANSFER', reference: caseReference }]);
  });
});
