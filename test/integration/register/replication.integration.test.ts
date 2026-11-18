/**
 * Integration tests for replication into an OpenCapTable-v35 book.
 *
 * `planReplication` plans the steps that bring a book to its source records (`CapTable_Apply` in date order, each
 * historical split through the split procedure, `CapTable_Restate` for corrections) and `executeReplication` writes
 * them through the book's writer. The source is the anonymized production fixtures made into one consistent book.
 * Covers:
 *
 * - A fresh book: every record created in replay order, the split recorded by the procedure
 * - A second run, which is a no-op
 * - Corrections: an edit and a delete of records the book holds
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/register/replication
 * ```
 */

import { executeReplication, planReplication } from '../../../src/replication';
import { buildOcfManifest } from '../../../src/utils/cantonOcfExtractor';
import { ocfDeepEqual } from '../../../src/utils/ocfComparison';
import { normalizeOcfData } from '../../../src/utils/planSecurityAliases';
import {
  acceptance,
  manifestOf,
  out,
  standardBook,
  issuer as standardIssuer,
  transfer,
  type OcfJson,
} from '../../register/replayFixtures';
import { productionBook, productionIssuer, productionRecords, SPLIT_ID } from '../../register/replicationFixtures';
import { createIntegrationTestSuite } from '../setup';
import { readTestBook, setupTestBook, type TestBook } from '../utils';

createIntegrationTestSuite('Replication', (getContext) => {
  /** The cap table for the tests of this suite: replicated once, then read by each test. */
  let replicated: Promise<TestBook> | undefined;
  const replicateProductionBook = async (): Promise<TestBook> => {
    replicated ??= (async () => {
      const ctx = getContext();
      const book = await setupTestBook(ctx, productionIssuer());
      const plan = await planReplication({
        source: productionBook(),
        index: book.writer.index,
        options: { ledger: ctx.ocp.ledger },
      });
      expect(plan.status).toBe('ready');
      await executeReplication(book.writer, plan);
      return book;
    })();
    return replicated;
  };

  test('replicates a fixture book: every record created in replay order, the split by the procedure', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx, productionIssuer());

    const plan = await planReplication({
      source: productionBook(),
      index: book.writer.index,
      options: { ledger: ctx.ocp.ledger },
    });
    expect(plan).toMatchObject({ status: 'ready', violation: null, refusals: [] });
    // Everything but the issuer, which the cap table was created with
    expect(plan.diff.creates).toHaveLength(productionRecords().length - 1);
    // Definitions, the stock dated before the split, the split by its own procedure, then everything after it
    expect(plan.steps.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);

    const progress: string[] = [];
    const result = await executeReplication(book.writer, plan, {
      onProgress: (event) => progress.push(`${event.phase}:${event.kind ?? ''}`),
    });
    expect(result.plan).toMatchObject({ status: 'current', steps: [] });
    expect(result.executed.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);
    expect(progress).toContain('step:split');

    // The book as read from the ledger holds every source record as the source has it
    const index = await readTestBook(book);
    expect(index.flags()).toEqual([]);
    const exported = buildOcfManifest(index);
    const onBook = [
      exported.issuer,
      ...exported.stakeholders,
      ...exported.stockClasses,
      ...exported.stockPlans,
      ...exported.vestingTerms,
      ...exported.valuations,
      ...exported.documents,
      ...exported.financings,
      ...exported.stockLegendTemplates,
      ...exported.transactions,
    ].map((record) => normalizeOcfData(record));
    const source = productionRecords().map((record) => normalizeOcfData(record));
    expect(onBook).toHaveLength(source.length);
    for (const record of source) {
      const match = onBook.find((candidate) => candidate.id === record.id);
      expect(match !== undefined && ocfDeepEqual(record, match)).toBe(true);
    }

    // The split was recorded on the class's epoch, which was left unfrozen
    expect(index.epochOf('test-stock-class-common-001')?.epoch).toMatchObject({
      frozen: false,
      splits: [{ split_id: SPLIT_ID, date: '2024-06-15' }],
    });
    // The transfer applied the split to its source at its own date: 1,000,000 became 10,000,000
    expect(index.stateOf('test-security-transfer-balance-001')?.state.quantity).toBe('9950000');
  });

  test('a second run writes nothing', async () => {
    const ctx = getContext();
    const book = await replicateProductionBook();

    // A fresh read of the replicated book, as a restarted writer would plan from
    const index = await readTestBook(book);
    const again = await planReplication({
      source: productionBook(),
      index,
      options: { ledger: ctx.ocp.ledger },
    });
    expect(again).toMatchObject({ status: 'current', steps: [], violation: null, refusals: [] });
    expect(again.diff.creates).toEqual([]);
    expect(again.diff.edits).toEqual([]);
    expect(again.diff.deletes).toEqual([]);

    const writer = ctx.ocp.OpenCapTable.register.writer({
      context: book.context,
      transferAgent: ctx.transferAgentParty,
      index,
      userId: ctx.userId,
    });
    const result = await executeReplication(writer, again);
    expect(result).toMatchObject({ transactions: 0, committed: [], executed: [] });
  });

  test('corrections: an edit and a delete of records the book holds', async () => {
    const ctx = getContext();
    // A book of its own, since the corrections change what the other tests read
    const book = await setupTestBook(ctx, productionIssuer());
    const first = await planReplication({
      source: productionBook(),
      index: book.writer.index,
      options: { ledger: ctx.ocp.ledger },
    });
    await executeReplication(book.writer, first);

    // The source now names the individual stakeholder differently and no longer has the document
    const corrected = productionRecords()
      .filter((record) => record.id !== 'test-document-001')
      .map((record) =>
        record.id === 'test-stakeholder-individual-001' ? { ...record, name: { legal_name: 'Corrected Name' } } : record
      );
    const plan = await planReplication({
      source: manifestOf(corrected),
      index: await readTestBook(book),
      options: { ledger: ctx.ocp.ledger },
    });
    expect(plan.status).toBe('ready');
    expect(plan.steps.map((step) => step.kind)).toEqual(['restate']);
    expect(plan.diff.edits.map((item) => item.id)).toContain('test-stakeholder-individual-001');
    expect(plan.diff.deletes.map((item) => item.id)).toContain('test-document-001');

    await executeReplication(book.writer, plan);

    const index = await readTestBook(book);
    expect(index.record('test-document-001')).toBeNull();
    const stakeholder = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: index.record('test-stakeholder-individual-001')?.contractId ?? '',
      readAs: [ctx.transferAgentParty],
    });
    expect(stakeholder.data.name.legal_name).toBe('Corrected Name');

    // The book is current again
    const again = await planReplication({
      source: manifestOf(corrected),
      index,
      options: { ledger: ctx.ocp.ledger },
    });
    expect(again).toMatchObject({ status: 'current', steps: [] });
  });
  /**
   * Corrections that restate lots, which a book can take while no hold or stop is in the way: an edit of an issuance
   * restates its state, a delete ends it, and a deleted transfer gives its source lot back with the `seq` the ledger
   * read from the ended state, which no event derived an ID at.
   */
  describe('corrections that restate lots', () => {
    async function replicatedStandardBook(
      ctx: ReturnType<typeof getContext>,
      ...records: OcfJson[]
    ): Promise<TestBook> {
      const book = await setupTestBook(ctx, standardIssuer());
      const plan = await planReplication({
        source: standardBook(...records),
        index: book.writer.index,
        options: { ledger: ctx.ocp.ledger },
      });
      expect(plan.status).toBe('ready');
      await executeReplication(book.writer, plan);
      return book;
    }

    test('an edit of an issuance restates the lot', async () => {
      const ctx = getContext();
      const book = await replicatedStandardBook(ctx);

      const corrected = standardBook();
      const s1 = corrected.transactions.find((record) => record.id === 'ISS-S-A1') as OcfJson;
      s1.quantity = '650';
      const plan = await planReplication({
        source: corrected,
        index: await readTestBook(book),
        options: { ledger: ctx.ocp.ledger },
      });
      expect(plan.status).toBe('ready');
      expect(plan.steps.map((step) => step.kind)).toEqual(['restate']);

      const seqBefore = (await readTestBook(book)).stateOf('S-A1')?.state.seq ?? -1;
      const result = await executeReplication(book.writer, plan);
      expect(result.plan.status).toBe('current');

      // The lot's state is its successor, in the corrected quantity
      const index = await readTestBook(book);
      expect(index.stateOf('S-A1')?.state).toMatchObject({ quantity: '650', seq: seqBefore + 1 });
      const issuance = await ctx.ocp.OpenCapTable.stockIssuance.get({
        contractId: index.record('ISS-S-A1')?.contractId ?? '',
        readAs: [ctx.transferAgentParty],
      });
      expect(issuance.data.quantity).toBe('650');
    });

    test('a delete of an issuance ends the lot', async () => {
      const ctx = getContext();
      const book = await replicatedStandardBook(ctx);

      const corrected = standardBook();
      corrected.transactions = corrected.transactions.filter((record) => record.id !== 'ISS-S-A2');
      const plan = await planReplication({
        source: corrected,
        index: await readTestBook(book),
        options: { ledger: ctx.ocp.ledger },
      });
      expect(plan.steps).toMatchObject([
        {
          kind: 'restate',
          operations: [
            { kind: 'delete', objectId: 'ISS-S-A2' },
            { kind: 'endState', securityId: 'S-A2' },
          ],
        },
      ]);
      await executeReplication(book.writer, plan);

      const index = await readTestBook(book);
      expect(index.stateOf('S-A2')).toBeNull();
      expect(index.record('ISS-S-A2')).toBeNull();
      expect(index.stateOf('S-A1')?.state.quantity).toBe('600');
    });

    test('a delete of a transfer gives its source lot back with the ledger seq plus one', async () => {
      const ctx = getContext();
      const accepted = [acceptance('ACC-1', 'S-A1', '2024-02-01')];
      const book = await replicatedStandardBook(
        ctx,
        ...accepted,
        transfer('TR-1', 'S-A1', '600', ['S-B1'], null),
        out('S-B1', 'SH-B', '600')
      );
      expect((await readTestBook(book)).stateOf('S-A1')).toBeNull();

      // The source no longer has the transfer: its output issuance goes, and S-A1 comes back as the acceptance left it
      const plan = await planReplication({
        source: standardBook(...accepted),
        index: await readTestBook(book),
        options: { ledger: ctx.ocp.ledger },
      });
      expect(plan.status).toBe('ready');
      const [step] = plan.steps;
      expect(step).toMatchObject({ kind: 'restate', recordIds: ['ISS-S-B1', 'TR-1'], securityIds: ['S-B1', 'S-A1'] });
      // The ended state had seq 1 (the acceptance's), read from the ledger: its recreation takes 2
      expect(step?.kind === 'restate' ? step.operations : []).toContainEqual({
        kind: 'setState',
        state: expect.objectContaining({
          security_id: 'S-A1',
          quantity: '600',
          last_event_date: '2024-02-01',
          origin_transaction_id: 'ISS-S-A1',
          seq: 2,
        }),
      });
      await executeReplication(book.writer, plan);

      const index = await readTestBook(book);
      expect(index.stateOf('S-A1')?.state).toMatchObject({ quantity: '600', seq: 2 });
      expect(index.stateOf('S-B1')).toBeNull();
      expect(index.record('TR-1')).toBeNull();
    });
  });
});
