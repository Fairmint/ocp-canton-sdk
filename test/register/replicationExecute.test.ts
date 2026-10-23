/**
 * Replication end to end over a simulated ledger: a fresh book from the production fixtures, every record created and
 * the split recorded by the split procedure; a second run that writes nothing; corrections restating, ending and
 * recreating lots, the recreated state's `seq` read from the ledger; derived-form trade records skipped, and a
 * settlement's new buyer kept until apiv2 reads it back; a delete the writer's references check refuses, refused in
 * the plan; a bulk correction written in several restatements; a run that plans again after a failed step; and a
 * restatement planned again when its lot changed after it was planned.
 */

import { OcpContractError, OcpErrorCodes } from '../../src/errors';
import { mapOcfObjectTypeToEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { stockSecurityWire } from '../../src/register/bookSimulation';
import { executeReplication } from '../../src/register/replication/execute';
import { planReplication } from '../../src/register/replication/plan';
import type {
  ReplicationError,
  ReplicationPlan,
  ReplicationProgress,
  ReplicationSource,
} from '../../src/register/replication/types';
import type { OcfIssuer } from '../../src/types/native';
import { buildOcfManifest } from '../../src/utils/cantonOcfExtractor';
import { ocfDeepEqual } from '../../src/utils/ocfComparison';
import { normalizeOcfData } from '../../src/utils/planSecurityAliases';
import { vestingTerms } from './bookFixtures';
import { damlData, recordEvent, stateEvent } from './registerLedgerFixtures';
import {
  acceptance,
  D2024,
  derived,
  issuance,
  issuer,
  manifestOf,
  out,
  stakeholder,
  standardBook,
  stockClass,
  transfer,
  type OcfJson,
} from './replayFixtures';
import { productionBook, productionIssuer, productionRecords, SPLIT_ID } from './replicationFixtures';
import { SimulatedLedger } from './simulatedLedger';

async function plan(ledger: SimulatedLedger, source: ReplicationSource): Promise<ReplicationPlan> {
  const writer = ledger.writer();
  await writer.refresh();
  return planReplication({ source, index: writer.index, options: { ledger: ledger.ledger.asClient() } });
}

/** Replicate a source into the ledger's book with a writer of its own; returns the writer. */
async function replicate(ledger: SimulatedLedger, source: ReplicationSource) {
  const writer = ledger.writer();
  await writer.refresh();
  const planned = await planReplication({ source, index: writer.index, options: { ledger: ledger.ledger.asClient() } });
  const result = await executeReplication(writer, planned);
  return { writer, planned, result };
}

function standardLedger(): SimulatedLedger {
  const ledger = new SimulatedLedger();
  ledger.setup(issuer() as unknown as OcfIssuer);
  return ledger;
}

function stateOf(ledger: SimulatedLedger, securityId: string) {
  return ledger.book.stateOf(securityId)?.state ?? null;
}

describe('executeReplication: a fresh book from the production fixtures', () => {
  it('creates every record in replay order, the split by the split procedure, and a second run writes nothing', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());

    const { planned, result, writer } = await replicate(ledger, productionBook());

    expect(planned.status).toBe('ready');
    expect(planned.violation).toBeNull();
    expect(planned.refusals).toEqual([]);
    expect(planned.diff.creates).toHaveLength(productionRecords().length - 1);
    expect(planned.steps.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);
    // Definitions first, the stock dated before the split, the split, then everything dated on or after it.
    expect(planned.steps[0]).toMatchObject({
      kind: 'apply',
      recordIds: [
        'test-stakeholder-individual-001',
        'test-stakeholder-institution-001',
        'test-vesting-terms-001',
        'test-legend-001',
        'test-stock-class-common-001',
        'test-stock-class-preferred-001',
        'test-stock-plan-001',
      ],
    });
    expect(planned.steps[1]?.kind === 'apply' ? planned.steps[1].recordIds : []).toEqual([
      'test-stock-issuance-founders-001',
      'test-convertible-note-001',
      'test-stock-issuance-vesting-001',
    ]);
    expect(planned.steps[2]).toMatchObject({ kind: 'split', recordIds: [SPLIT_ID] });
    const last = planned.steps[3];
    const lastIds = last?.kind === 'apply' ? last.recordIds : [];
    // A valuation is written on its effective date, after the split of its class.
    expect(lastIds.indexOf('test-valuation-001')).toBeGreaterThan(lastIds.indexOf('test-stock-plan-pool-adj-001'));
    expect(lastIds.indexOf('test-valuation-001')).toBeLessThan(lastIds.indexOf('test-equity-comp-exercise-001'));
    expect(lastIds[lastIds.length - 1]).toBe('test-document-001');

    expect(ledger.choices()).toEqual([
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_FreezeClass',
      'CapTable_Apply',
      'CapTable_UnfreezeClass',
      'CapTable_Apply',
    ]);
    expect(result).toMatchObject({ transactions: 6, replans: 1, plan: { status: 'current', steps: [] } });
    expect(result.committed).toHaveLength(4);
    expect(result.executed.map((step) => step.kind)).toEqual(['apply', 'apply', 'split', 'apply']);

    // The book holds every source record as the source has it.
    const exported = buildOcfManifest(writer.index);
    const source = productionRecords().map((record) => normalizeOcfData(record));
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
    expect(onBook).toHaveLength(source.length);
    for (const record of source) {
      const match = onBook.find((candidate) => candidate.id === record.id);
      expect(match !== undefined && ocfDeepEqual(record, match)).toBe(true);
    }
    // The transfer applied the split to its source at its own date: 1,000,000 became 10,000,000.
    expect(stateOf(ledger, 'test-security-transfer-balance-001')).toMatchObject({ quantity: '9950000' });
    expect(writer.index.epochOf('test-stock-class-common-001')?.epoch).toMatchObject({
      frozen: false,
      splits: [{ split_id: SPLIT_ID, date: '2024-06-15' }],
    });

    const again = await plan(ledger, productionBook());
    expect(again).toMatchObject({ status: 'current', steps: [], refusals: [], violation: null });
    expect(again.diff.total).toBe(0);
    const submitted = ledger.ledger.submitted.length;
    const noop = await executeReplication(ledger.writer(), again);
    expect(noop).toMatchObject({ transactions: 0, replans: 0, executed: [] });
    expect(ledger.ledger.submitted).toHaveLength(submitted);
  });

  it('reports each step and plan, and plans the same from the source as items', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    const writer = ledger.writer();
    await writer.refresh();
    const items = productionRecords().map((data) => ({
      entityType: mapOcfObjectTypeToEntityType(String(data.object_type)) ?? 'issuer',
      data,
    }));
    const planned = await planReplication({ source: items, index: writer.index });
    const fromManifest = await planReplication({ source: productionBook(), index: writer.index });
    expect(planned.steps).toEqual(fromManifest.steps);
    const progress: ReplicationProgress[] = [];
    await executeReplication(writer, planned, {
      onProgress: (event) => {
        progress.push(event);
        throw new Error('ignored');
      },
    });
    expect(progress.map((event) => [event.phase, event.plan, event.step, event.kind])).toEqual([
      ['step', 1, 0, 'apply'],
      ['step', 1, 1, 'apply'],
      ['step', 1, 2, 'split'],
      ['step', 1, 3, 'apply'],
      ['replan', 2, 0, null],
    ]);
    expect(progress[4]?.transactions).toBe(6);
  });

  it('plans again from the updated index after a failed step, and resumes where the book stands', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    // The definitions commit; the next Apply is refused, as a concurrent write could have it refused.
    ledger.ledger.next({ outcome: 'commit' }, { outcome: 'reject', message: 'contract not active' });

    const { result } = await replicate(ledger, productionBook());

    expect(result.plan.status).toBe('current');
    expect(result.replans).toBe(2);
    expect(ledger.choices()).toEqual([
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_Apply',
      'CapTable_FreezeClass',
      'CapTable_Apply',
      'CapTable_UnfreezeClass',
      'CapTable_Apply',
    ]);
    expect(result.transactions).toBe(6);
  });

  it('stops on a failure planning again cannot help, carrying what it wrote', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    ledger.ledger.next({ outcome: 'reject', message: 'ID already used' });

    const error = (await replicate(ledger, productionBook()).catch((caught: unknown) => caught)) as ReplicationError;

    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({ code: OcpErrorCodes.CHOICE_FAILED });
    expect(error.replication).toMatchObject({ transactions: 0, replans: 0, executed: [] });
  });

  it('stops at once on an unknown outcome, which the writer must reconcile first', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    ledger.ledger.next({ outcome: 'commit' }, { outcome: 'unknown' });

    const error = (await replicate(ledger, productionBook()).catch((caught: unknown) => caught)) as ReplicationError;

    expect(error).toMatchObject({ code: OcpErrorCodes.OUTCOME_UNKNOWN, classification: 'unresolved_command' });
    expect(error.replication).toMatchObject({ transactions: 1, replans: 0 });
  });

  it('refuses a plan of another book', async () => {
    const ledger = new SimulatedLedger();
    ledger.setup(productionIssuer());
    const planned = await plan(ledger, productionBook());
    await expect(executeReplication(ledger.writer(), { ...planned, capTableId: 'other' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'plan',
    });
  });
});

describe('executeReplication: corrections', () => {
  it('restates a lot whose issuance is edited, and the next run writes nothing', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const corrected = standardBook();
    const s1 = corrected.transactions.find((record) => record.id === 'ISS-S-A1') as OcfJson;
    s1.quantity = '650';

    const planned = await plan(ledger, corrected);

    expect(planned.status).toBe('ready');
    expect(planned.diff.edits.map((item) => item.id)).toEqual(['ISS-S-A1']);
    expect(planned.steps).toEqual([
      expect.objectContaining({
        kind: 'restate',
        recordIds: ['ISS-S-A1'],
        securityIds: ['S-A1'],
        operations: [
          expect.objectContaining({ kind: 'edit', type: 'stockIssuance' }),
          {
            kind: 'setState',
            state: expect.objectContaining({ security_id: 'S-A1', quantity: '650', accelerated_since_snapshot: null }),
          },
        ],
      }),
    ]);
    const seqBefore = stateOf(ledger, 'S-A1')?.seq ?? -1;
    const result = await executeReplication(ledger.writer(), planned);

    expect(result.plan.status).toBe('current');
    expect(ledger.choices()[ledger.choices().length - 1]).toBe('CapTable_Restate');
    expect(stateOf(ledger, 'S-A1')).toMatchObject({ quantity: '650', seq: seqBefore + 1 });
    expect(ledger.book.record('ISS-S-A1')?.data).toMatchObject({ quantity: '650' });
  });

  it('ends a lot whose issuance is deleted', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const corrected = standardBook();
    corrected.transactions = corrected.transactions.filter((record) => record.id !== 'ISS-S-A2');

    const planned = await plan(ledger, corrected);

    expect(planned.steps).toEqual([
      expect.objectContaining({
        kind: 'restate',
        operations: [
          { kind: 'delete', objectId: 'ISS-S-A2' },
          { kind: 'endState', securityId: 'S-A2' },
        ],
      }),
    ]);
    const result = await executeReplication(ledger.writer(), planned);
    expect(result.plan.status).toBe('current');
    expect(stateOf(ledger, 'S-A2')).toBeNull();
    expect(ledger.book.record('ISS-S-A2')).toBeNull();
  });

  it.each([
    ['in a later transaction, from the consumed state', true],
    ['in the transaction that created the state, from the operations before it', false],
  ])(
    'recreates the source of a deleted transfer with the ledger seq + 1, the state ended %s',
    async (_label, separately) => {
      const ledger = standardLedger();
      const accepted = standardBook(acceptance('ACC-1', 'S-A1', '2024-02-01'));
      const withTransfer = standardBook(
        acceptance('ACC-1', 'S-A1', '2024-02-01'),
        transfer('TR-1', 'S-A1', '600', ['S-B1'], null),
        out('S-B1', 'SH-B', '600')
      );
      if (separately) await replicate(ledger, accepted);
      await replicate(ledger, withTransfer);
      expect(stateOf(ledger, 'S-A1')).toBeNull();

      const planned = await plan(ledger, accepted);

      expect(planned.status).toBe('ready');
      const [step] = planned.steps;
      expect(step).toMatchObject({ kind: 'restate', recordIds: ['ISS-S-B1', 'TR-1'], securityIds: ['S-B1', 'S-A1'] });
      // The ended state had seq 1 (the acceptance's); its recreation takes 2, which no event derived an ID at.
      expect(step?.kind === 'restate' ? step.operations : []).toEqual([
        { kind: 'delete', objectId: 'ISS-S-B1' },
        { kind: 'delete', objectId: 'TR-1' },
        { kind: 'endState', securityId: 'S-B1' },
        {
          kind: 'setState',
          state: expect.objectContaining({
            security_id: 'S-A1',
            quantity: '600',
            last_event_date: '2024-02-01',
            origin_transaction_id: 'ISS-S-A1',
            seq: 2,
          }),
        },
      ]);
      const result = await executeReplication(ledger.writer(), planned);
      expect(result.plan.status).toBe('current');
      expect(stateOf(ledger, 'S-A1')).toMatchObject({ quantity: '600', seq: 2 });
      expect(stateOf(ledger, 'S-B1')).toBeNull();
      expect(ledger.book.record('TR-1')).toBeNull();
    }
  );

  it('plans a restatement again when the TA records a snapshot on its lot after it was planned', async () => {
    const ledger = standardLedger();
    const terms: OcfJson = { ...vestingTerms('VT-1') };
    const onTerms = (quantity: string): OcfJson =>
      issuance('S-V1', 'SH-A', 'CLS-A', quantity, D2024, { vesting_terms_id: 'VT-1' });
    await replicate(ledger, standardBook(terms, onTerms('1000')));
    const ta = ledger.writer();
    await ta.refresh();
    await ta.apply([{ kind: 'vestingSnapshot', securityId: 'S-V1', asOf: D2024, vested: '100' }]);

    const planned = await plan(ledger, standardBook(terms, onTerms('900')));
    const [step] = planned.steps;
    expect(step).toMatchObject({
      kind: 'restate',
      basis: [
        { kind: 'state', id: 'S-V1', contractId: ledger.book.stateOf('S-V1')?.contractId },
        { kind: 'record', id: 'ISS-S-V1', contractId: ledger.book.record('ISS-S-V1')?.contractId },
      ],
      operations: [
        expect.objectContaining({ kind: 'edit' }),
        {
          kind: 'setState',
          state: expect.objectContaining({ quantity: '900', snapshot: { as_of: D2024, vested: '100' } }),
        },
      ],
    });

    // The TA records a newer snapshot once the run has begun, before the restatement is written.
    let recorded = false;
    const result = await executeReplication(ledger.writer(), planned, {
      onProgress: ({ phase, kind }) => {
        if (recorded || phase !== 'step' || kind !== 'restate') return;
        recorded = true;
        const current = ledger.book.stateOf('S-V1');
        if (current === null) throw new Error('S-V1 has no state');
        const { context: _context, ...payload } = stockSecurityWire({
          ...current.state,
          seq: current.state.seq + 1,
          snapshot: { as_of: D2024, vested: '300' },
          accelerated_since_snapshot: null,
        });
        ledger.ledger.commit({ archived: [current.contractId], created: [stateEvent('cid-ta-snapshot', payload)] });
      },
    });

    expect(recorded).toBe(true);
    expect(result.plan.status).toBe('current');
    expect(result.replans).toBe(2);
    expect(result.executed.map((executed) => executed.kind)).toEqual(['restate']);
    // The newer snapshot stands: the restatement planned before it was never written over it.
    expect(stateOf(ledger, 'S-V1')).toMatchObject({ quantity: '900', snapshot: { as_of: D2024, vested: '300' } });
    const restatements = ledger.ledger.submitted.filter(
      (submission) =>
        (submission.commands as Array<{ ExerciseCommand?: { choice?: string } }>)[0]?.ExerciseCommand?.choice ===
        'CapTable_Restate'
    );
    expect(restatements).toHaveLength(1);
  });

  it('skips the trade records a register choice wrote, and never edits or deletes them', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    // CapTable_Settle drew all of S-A2 for SH-B: the transfer, the buyer's issuance and state, all in derived form.
    const transferId = derived('S-A2', 0, 'event');
    const buyerIssuance = derived('S-A2', 0, 'resulting_issuance');
    const buyerSecurity = derived('S-A2', 0, 'resulting_security');
    const trade = transfer(transferId, 'S-A2', '400', [buyerSecurity], null, '2024-05-01');
    const bought = { ...issuance(buyerSecurity, 'SH-B', 'CLS-A', '400', '2024-05-01'), id: buyerIssuance };
    ledger.ledger.commit({
      archived: [ledger.book.stateOf('S-A2')?.contractId ?? ''],
      created: [
        recordEvent('cid-trade', 'stockTransfer', damlData('stockTransfer', trade)),
        recordEvent('cid-bought', 'stockIssuance', damlData('stockIssuance', bought)),
        stateEvent('cid-bought-state', {
          security_id: buyerSecurity,
          issue_date: '2024-05-01',
          last_event_date: '2024-05-01',
          origin_transaction_id: buyerIssuance,
          quantity: '400.0000000000',
          seq: '0',
          stakeholder_id: 'SH-B',
          stock_class_id: 'CLS-A',
          holds: [],
          derived_ids: false,
        }),
      ],
    });

    // apiv2 read the trade back, with an edited comment on the transfer; the source never had the buyer's issuance.
    const readBack = standardBook({ ...trade, comments: ['edited in PostgreSQL'] });
    const planned = await plan(ledger, readBack);

    expect(planned.status).toBe('current');
    expect(planned.steps).toEqual([]);
    expect(planned.diff).toMatchObject({ creates: [], edits: [], deletes: [] });
    expect(planned.notices).toEqual([
      expect.objectContaining({ kind: 'derived_form_differs', id: transferId, entityType: 'stockTransfer' }),
    ]);

    const unchanged = await plan(ledger, standardBook(trade, bought));
    expect(unchanged.status).toBe('current');
    expect(unchanged.notices.map((notice) => [notice.kind, notice.id])).toEqual([
      ['derived_form_skipped', transferId],
      ['derived_form_skipped', buyerIssuance],
    ]);

    const missing = derived('S-A1', 0, 'event');
    const unknown = await plan(ledger, standardBook(transfer(missing, 'S-A1', '600', ['S-X'], null)));
    expect(unknown.notices).toEqual([expect.objectContaining({ kind: 'derived_form_missing', id: missing })]);
  });

  describe("keeps a settlement's new buyer that apiv2 has not read back yet", () => {
    const buyerIssuance = derived('S-A2', 0, 'resulting_issuance');
    const buyerSecurity = derived('S-A2', 0, 'resulting_security');

    /** The standard book, and a settlement of S-A2 to a new buyer SH-NEW, whose stakeholder it claimed. */
    async function settledToNewBuyer(): Promise<SimulatedLedger> {
      const ledger = standardLedger();
      await replicate(ledger, standardBook());
      // CapTable_Settle with SettleBuyerNew claims the buyer's ID as Apply claims any writer-chosen one.
      const writer = ledger.writer();
      await writer.refresh();
      await writer.apply([{ kind: 'record', type: 'stakeholder', data: stakeholder('SH-NEW') as never }], {
        checks: false,
      });
      const trade = transfer(derived('S-A2', 0, 'event'), 'S-A2', '400', [buyerSecurity], null, '2024-05-01');
      const bought = { ...issuance(buyerSecurity, 'SH-NEW', 'CLS-A', '400', '2024-05-01'), id: buyerIssuance };
      ledger.ledger.commit({
        archived: [ledger.book.stateOf('S-A2')?.contractId ?? ''],
        created: [
          recordEvent('cid-trade', 'stockTransfer', damlData('stockTransfer', trade)),
          recordEvent('cid-bought', 'stockIssuance', damlData('stockIssuance', bought)),
          stateEvent('cid-bought-state', {
            security_id: buyerSecurity,
            issue_date: '2024-05-01',
            last_event_date: '2024-05-01',
            origin_transaction_id: buyerIssuance,
            quantity: '400.0000000000',
            seq: '0',
            stakeholder_id: 'SH-NEW',
            stock_class_id: 'CLS-A',
            holds: [],
            delivery: { reference: 'trade-1', seller_stakeholder_id: 'SH-A', transfer_id: trade.id as string },
            derived_ids: false,
          }),
        ],
      });
      return ledger;
    }

    it.each([
      ['on', true],
      ['off', false],
    ])('never deletes it, with the writer checks %s', async (_label, checks) => {
      const ledger = await settledToNewBuyer();
      // PostgreSQL has not read the trade back, and has a new stakeholder of its own to replicate.
      const planned = await plan(ledger, standardBook(stakeholder('SH-C')));

      expect(planned.status).toBe('ready');
      expect(planned.diff).toMatchObject({
        creates: [expect.objectContaining({ id: 'SH-C' })],
        edits: [],
        deletes: [],
      });
      expect(planned.steps.map((step) => step.kind)).toEqual(['apply']);
      expect(planned.notices).toEqual([
        expect.objectContaining({
          kind: 'register_named_kept',
          id: 'SH-NEW',
          entityType: 'stakeholder',
          message: expect.stringContaining(`names it: it is never deleted`) as unknown,
        }),
      ]);

      const writer = ledger.writer();
      await writer.refresh();
      const result = await executeReplication(writer, planned, { checks });
      expect(result.plan.status).toBe('current');
      expect(result.executed.map((step) => step.kind)).toEqual(['apply']);
      expect(ledger.book.record('SH-NEW')).not.toBeNull();
      expect(ledger.book.record('SH-C')).not.toBeNull();
      expect(stateOf(ledger, buyerSecurity)).toMatchObject({ stakeholder_id: 'SH-NEW' });
    });

    it('edits it like any stakeholder once apiv2 has read it back', async () => {
      const ledger = await settledToNewBuyer();
      const renamed = { ...stakeholder('SH-NEW'), name: { legal_name: 'New Buyer LLC' } };
      const planned = await plan(ledger, standardBook(renamed));

      expect(planned.status).toBe('ready');
      expect(planned.diff.edits.map((item) => item.id)).toEqual(['SH-NEW']);
      expect(planned.steps.map((step) => step.kind)).toEqual(['restate']);
      await executeReplication(ledger.writer(), planned);
      expect(ledger.book.record('SH-NEW')?.data).toMatchObject({ name: { legal_name: 'New Buyer LLC' } });
    });
  });

  it('refuses in the plan a delete that the writer references check refuses', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    // SH-B holds nothing and nothing names it; SH-A holds S-A1 and S-A2, whose issuances the source keeps.
    const source = manifestOf([
      issuer(),
      stakeholder('SH-B'),
      stockClass('CLS-A'),
      issuance('S-A1', 'SH-A', 'CLS-A', '600', D2024),
      issuance('S-A2', 'SH-A', 'CLS-A', '400', D2024),
    ]);
    const planned = await plan(ledger, source);

    expect(planned.status).toBe('refused');
    expect(planned.steps).toEqual([]);
    expect(planned.refusals.map((refusal) => [refusal.rule, refusal.recordIds])).toEqual([
      ['references', ['SH-A', 'ISS-S-A1']],
      ['references', ['SH-A', 'ISS-S-A2']],
      ['references', ['SH-A']],
    ]);
    expect(planned.refusals[0]?.message).toBe(
      "The restatement would be refused by the writer's references check: TX_STOCK_ISSUANCE ISS-S-A1 would be left " +
        'with a broken reference: Stock issuance stakeholder not found: SH-A'
    );
    expect(planned.refusals[2]?.message).toContain('Stakeholder SH-A still holds 2 outstanding stock securities');
    const writer = ledger.writer();
    await writer.refresh();
    const result = await executeReplication(writer, planned, { checks: false });
    expect(result.executed).toEqual([]);
    expect(ledger.book.record('SH-A')).not.toBeNull();
  });

  it('leaves the hold pair out of the source', async () => {
    const ledger = standardLedger();
    await replicate(ledger, standardBook());
    const hold = {
      object_type: 'TX_STOCK_HOLD',
      id: 'HOLD-1',
      date: D2024,
      security_id: 'S-A1',
      hold_type: 'STOP_TRANSFER',
      reference: 'stop-1',
      reason_text: 'Court order',
    };
    const planned = await plan(
      ledger,
      manifestOf([
        ...standardBook().transactions,
        hold,
        ...standardBook().stakeholders,
        ...standardBook().stockClasses,
        issuer(),
      ])
    );
    expect(planned.status).toBe('current');
    expect(planned.notices).toEqual([expect.objectContaining({ kind: 'hold_pair', id: 'HOLD-1' })]);
  });

  it('writes a bulk correction above one restatement in several, each in one transaction', async () => {
    const ledger = standardLedger();
    const ids = Array.from({ length: 501 }, (_, n) => `SH-${String(n).padStart(3, '0')}`);
    await replicate(ledger, standardBook(...ids.map(stakeholder)));
    const renamed = ids.map((id) => ({ ...stakeholder(id), name: { legal_name: `${id} (new address)` } }));

    const writer = ledger.writer();
    await writer.refresh();
    const planned = await planReplication({ source: standardBook(...renamed), index: writer.index });
    expect(planned.status).toBe('ready');
    expect(planned.steps.map((step) => (step.kind === 'restate' ? step.recordIds.length : step.kind))).toEqual([
      250, 250, 1,
    ]);

    const before = ledger.choices().length;
    const result = await executeReplication(writer, planned);
    expect(result.plan.status).toBe('current');
    expect(ledger.choices().slice(before)).toEqual(['CapTable_Restate', 'CapTable_Restate', 'CapTable_Restate']);
    const names = ids.map(
      (id) => (ledger.book.record(id)?.data as { name?: { legal_name?: string } } | null)?.name?.legal_name
    );
    expect(names).toEqual(ids.map((id) => `${id} (new address)`));
    await expect(plan(ledger, standardBook(...renamed))).resolves.toMatchObject({ status: 'current', steps: [] });
  });
});
