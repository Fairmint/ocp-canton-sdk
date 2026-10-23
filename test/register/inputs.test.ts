import { OcpValidationError } from '../../src/errors';
import { claimHash, coveringShardPrefix, deriveId, INITIAL_SHARD_PREFIXES } from '../../src/register/ids';
import { requirementsOf, resolveInputs } from '../../src/register/inputs';
import type { ApplyOperation, BookWrite, DerivedRole, OpenHold, ResolvedInputs } from '../../src/types/register';
import {
  baseBook,
  CONTEXT,
  document,
  financing,
  idsInShardOf,
  initialShardOf,
  stakeholder,
  stockAcceptance,
  stockClass,
  stockClassSplit,
  stockIssuance,
  stockPlan,
  stockState,
  stockTransfer,
  TestBook,
  vestingStart,
  vestingTerms,
  warrantIssuance,
} from './bookFixtures';

function derived(securityId: string, seq: number, role: DerivedRole, index = 0): string {
  return deriveId({ capTableId: CONTEXT.cap_table_id, securityId, seq, role, index });
}

function apply(...operations: ApplyOperation[]): BookWrite {
  return { kind: 'apply', operations };
}

function refusal(run: () => unknown): OcpValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof OcpValidationError) return error;
    throw error;
  }
  throw new Error('resolveInputs did not refuse');
}

function claimShards(...claims: Array<['object' | 'security', string]>): string[] {
  return [...new Set(claims.map(([namespace, id]) => initialShardOf(namespace, id)))];
}

describe('resolveInputs: CapTable_Apply', () => {
  it('reads the class epoch, the shards of the claimed IDs and the referenced records of a primary issuance', () => {
    const index = baseBook()
      .record('stockLegendTemplate', {
        object_type: 'STOCK_LEGEND_TEMPLATE',
        id: 'LEG-1',
        name: 'Legend',
        text: 'Restricted',
      })
      .index();
    const resolved = resolveInputs(
      index,
      apply({
        kind: 'record',
        type: 'stockIssuance',
        data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', stock_legend_ids: ['LEG-1'] }),
      })
    );

    expect(resolved.inputs).toEqual({
      states: [],
      epochs: ['epoch-CLS-A'],
      shards: claimShards(['object', 'ISS-A2'], ['security', 'S-A2']),
      records: [
        { entityType: 'stakeholder', contractId: 'cid-SH-A' },
        { entityType: 'stockClass', contractId: 'cid-CLS-A' },
        { entityType: 'stockLegendTemplate', contractId: 'cid-LEG-1' },
      ],
    });
    expect(resolved.claimed).toEqual([
      { namespace: 'object', id: 'ISS-A2' },
      { namespace: 'security', id: 'S-A2' },
    ]);
    expect(resolved.exceeded).toEqual([]);
  });

  it('needs no input for a class, stakeholder or security that an earlier operation of the batch creates', () => {
    const index = new TestBook().index();
    const resolved = resolveInputs(
      index,
      apply(
        { kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') },
        { kind: 'record', type: 'stockClass', data: stockClass('CLS-N') },
        {
          kind: 'record',
          type: 'stockIssuance',
          data: stockIssuance({ id: 'ISS-N1', security_id: 'S-N1', stakeholder_id: 'SH-N', stock_class_id: 'CLS-N' }),
        },
        { kind: 'record', type: 'stockAcceptance', data: stockAcceptance('ACC-N1', 'S-N1') }
      )
    );

    expect(resolved.inputs.states).toEqual([]);
    expect(resolved.inputs.epochs).toEqual([]);
    expect(resolved.inputs.records).toEqual([]);
    expect(resolved.inputs.shards).toEqual(
      claimShards(
        ['object', 'SH-N'],
        ['object', 'CLS-N'],
        ['object', 'ISS-N1'],
        ['security', 'S-N1'],
        ['object', 'ACC-N1']
      )
    );
    expect(resolved.usage.operations).toBe(4);
  });

  it('derives consecutive IDs for two events on one security in one batch, claiming none', () => {
    const index = baseBook({ seq: 2 }).index();
    const acceptanceId = derived('S-A1', 2, 'event');
    const transferId = derived('S-A1', 3, 'event');
    const resultingId = derived('S-A1', 3, 'resulting_issuance');
    const resultingSecurity = derived('S-A1', 3, 'resulting_security');
    const resolved = resolveInputs(
      index,
      apply(
        { kind: 'record', type: 'stockAcceptance', data: stockAcceptance(acceptanceId, 'S-A1') },
        {
          kind: 'stockTransfer',
          transfer: stockTransfer({ id: transferId, resulting_security_ids: [resultingSecurity] }),
          resulting: [
            stockIssuance({
              id: resultingId,
              security_id: resultingSecurity,
              stakeholder_id: 'SH-B',
              date: '2024-03-01',
              custom_id: 'CS-B1',
            }),
          ],
          balance: null,
        }
      )
    );

    expect(resolved.claimed).toEqual([]);
    expect(resolved.inputs).toEqual({
      states: ['state-S-A1'],
      epochs: ['epoch-CLS-A'],
      shards: [],
      records: [
        { entityType: 'stakeholder', contractId: 'cid-SH-B' },
        { entityType: 'stockClass', contractId: 'cid-CLS-A' },
      ],
    });
  });

  it('claims an event ID that is not the one derived at the simulated seq, and refuses one in the derived form', () => {
    const index = baseBook({ seq: 2 }).index();
    const claimed = resolveInputs(
      index,
      apply(
        { kind: 'record', type: 'stockAcceptance', data: stockAcceptance('ACC-1', 'S-A1') },
        { kind: 'record', type: 'stockAcceptance', data: stockAcceptance(derived('S-A1', 3, 'event'), 'S-A1') }
      )
    );
    expect(claimed.claimed).toEqual([{ namespace: 'object', id: 'ACC-1' }]);

    // The ID derived at seq 2 is no longer the derived one once the first acceptance advanced the seq.
    const stale = derived('S-A1', 2, 'event');
    const error = refusal(() =>
      resolveInputs(
        index,
        apply(
          { kind: 'record', type: 'stockAcceptance', data: stockAcceptance('ACC-1', 'S-A1') },
          { kind: 'record', type: 'stockAcceptance', data: stockAcceptance(stale, 'S-A1') }
        )
      )
    );
    expect(error.message).toContain(`ID ${stale} has this cap table's derived form and cannot be claimed`);
    expect(error.fieldPath).toBe('operations[1]');
    expect(error.classification).toBe('derived_form_claim');
  });

  it('refuses an ID the book or the batch already claims, with the ledger message for its namespace', () => {
    const index = baseBook().index();
    expect(
      refusal(() => resolveInputs(index, apply({ kind: 'record', type: 'stakeholder', data: stakeholder('SH-A') })))
        .message
    ).toContain('ID already used: SH-A');
    expect(
      refusal(() =>
        resolveInputs(
          index,
          apply({ kind: 'record', type: 'stockIssuance', data: stockIssuance({ id: 'ISS-A9', security_id: 'S-A1' }) })
        )
      ).message
    ).toContain('security ID already used: S-A1');
    expect(
      refusal(() =>
        resolveInputs(
          index,
          apply(
            { kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') },
            { kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') }
          )
        )
      ).classification
    ).toBe('claimed_id_used');
  });

  it('refuses a reference to a record that is neither on the book nor in the batch, or of the wrong type', () => {
    const index = baseBook()
      .record('stockPlan', stockPlan('PLAN-1', ['CLS-OTHER']))
      .index();
    expect(
      refusal(() =>
        resolveInputs(
          index,
          apply({
            kind: 'record',
            type: 'stockIssuance',
            data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', stakeholder_id: 'SH-X' }),
          })
        )
      ).message
    ).toContain('Stock issuance stakeholder not found: SH-X');
    expect(
      refusal(() =>
        resolveInputs(
          index,
          apply({
            kind: 'record',
            type: 'stockIssuance',
            data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', stakeholder_id: 'CLS-A' }),
          })
        )
      ).message
    ).toContain('Stock issuance stakeholder CLS-A is a OcfObjectTypeStockClass, not one of [OcfObjectTypeStakeholder]');
    const planError = refusal(() =>
      resolveInputs(
        index,
        apply({
          kind: 'record',
          type: 'stockIssuance',
          data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', stock_plan_id: 'PLAN-1' }),
        })
      )
    );
    expect(planError.message).toContain('Stock issuance stock plan PLAN-1 does not include stock class CLS-A');
    expect(planError.classification).toBe('missing_reference');
  });

  it('accepts a reference to a record that a later operation of the same batch creates', () => {
    const index = baseBook().index();
    const resolved = resolveInputs(
      index,
      apply(
        {
          kind: 'record',
          type: 'stockIssuance',
          data: stockIssuance({ id: 'ISS-A2', security_id: 'S-A2', stakeholder_id: 'SH-N' }),
        },
        { kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') }
      )
    );
    expect(resolved.inputs.records).toEqual([{ entityType: 'stockClass', contractId: 'cid-CLS-A' }]);
  });

  it('writes a vesting start on a stock lot as an event on its state, and on a warrant as a claimed record', () => {
    const index = baseBook()
      .record('vestingTerms', vestingTerms('VT-1'))
      .record('stockIssuance', stockIssuance({ id: 'ISS-V1', security_id: 'S-V1', vesting_terms_id: 'VT-1' }))
      .state(
        stockState({
          security_id: 'S-V1',
          origin_transaction_id: 'ISS-V1',
          vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' },
        })
      )
      .record('warrantIssuance', warrantIssuance('WI-1', 'W-1', { vesting_terms_id: 'VT-1' }))
      .index();

    const onStock = resolveInputs(
      index,
      apply({ kind: 'record', type: 'vestingStart', data: vestingStart(derived('S-V1', 0, 'event'), 'S-V1') })
    );
    expect(onStock.claimed).toEqual([]);
    expect(onStock.inputs).toEqual({
      states: ['state-S-V1'],
      epochs: ['epoch-CLS-A'],
      shards: [],
      records: [
        { entityType: 'stockIssuance', contractId: 'cid-ISS-V1' },
        { entityType: 'vestingTerms', contractId: 'cid-VT-1' },
      ],
    });

    const onWarrant = resolveInputs(
      index,
      apply({ kind: 'record', type: 'vestingStart', data: vestingStart('VS-W1', 'W-1') })
    );
    expect(onWarrant.claimed).toEqual([{ namespace: 'object', id: 'VS-W1' }]);
    expect(onWarrant.inputs).toEqual({
      states: [],
      epochs: [],
      shards: claimShards(['object', 'VS-W1']),
      records: [
        { entityType: 'warrantIssuance', contractId: 'cid-WI-1' },
        { entityType: 'vestingTerms', contractId: 'cid-VT-1' },
      ],
    });

    expect(
      refusal(() =>
        resolveInputs(
          index,
          apply({ kind: 'record', type: 'vestingStart', data: vestingStart('VS-W2', 'W-1', 'milestone') })
        )
      ).message
    ).toContain('Vesting start VS-W2 references vesting condition milestone with the wrong trigger type');
  });

  it('refuses a vesting record on a stock lot that the batch has already ended', () => {
    const index = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('vestingTerms', vestingTerms('VT-1'))
      .record('stockIssuance', stockIssuance({ vesting_terms_id: 'VT-1' }))
      .state(stockState({ vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' } }))
      .index();
    const error = refusal(() =>
      resolveInputs(
        index,
        apply(
          {
            kind: 'record',
            type: 'stockRetraction',
            data: {
              object_type: 'TX_STOCK_RETRACTION',
              id: 'RET-1',
              date: '2024-02-01',
              security_id: 'S-A1',
              reason_text: 'Rescinded',
            },
          },
          { kind: 'record', type: 'vestingStart', data: vestingStart('VS-1', 'S-A1') }
        )
      )
    );
    expect(error.message).toContain(
      'Vesting record (no stock state in this write) security S-A1 is carried by a OcfObjectTypeTxStockIssuance'
    );
  });

  it("reads a reissuance's split from the book, and its source's state and epoch", () => {
    const split = stockClassSplit('SPLIT-1', 'CLS-A', '2024-06-01');
    const book = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .record('stockClassSplit', split)
      .epoch('CLS-A', {
        splits: [{ split_id: 'SPLIT-1', date: '2024-06-01', ratio: { numerator: '2', denominator: '1' } }],
      })
      .record('stockIssuance', stockIssuance())
      .state(stockState())
      .index();
    const resulting = derived('S-A1', 0, 'resulting_security');
    const resolved = resolveInputs(
      book,
      apply({
        kind: 'stockReissuance',
        reissuance: {
          object_type: 'TX_STOCK_REISSUANCE',
          id: derived('S-A1', 0, 'event'),
          date: '2024-07-01',
          security_id: 'S-A1',
          resulting_security_ids: [resulting],
          split_transaction_id: 'SPLIT-1',
        },
        resulting: [
          stockIssuance({
            id: derived('S-A1', 0, 'resulting_issuance'),
            security_id: resulting,
            date: '2024-07-01',
            quantity: '1200',
          }),
        ],
      })
    );
    expect(resolved.claimed).toEqual([]);
    expect(resolved.inputs).toEqual({
      states: ['state-S-A1'],
      epochs: ['epoch-CLS-A'],
      shards: [],
      records: [
        { entityType: 'stockClassSplit', contractId: 'cid-SPLIT-1' },
        { entityType: 'stakeholder', contractId: 'cid-SH-A' },
        { entityType: 'stockClass', contractId: 'cid-CLS-A' },
      ],
    });
  });

  it('reads every input of a consolidation and records it once', () => {
    const index = baseBook()
      .record('stockIssuance', stockIssuance({ id: 'ISS-A2', security_id: 'S-A2' }))
      .state(stockState({ security_id: 'S-A2', origin_transaction_id: 'ISS-A2' }))
      .index();
    const resultSecurity = derived('S-A1', 0, 'resulting_security');
    const resolved = resolveInputs(
      index,
      apply({
        kind: 'stockConsolidation',
        consolidation: {
          object_type: 'TX_STOCK_CONSOLIDATION',
          id: derived('S-A1', 0, 'event'),
          date: '2024-05-01',
          security_ids: ['S-A1', 'S-A2'],
          resulting_security_id: resultSecurity,
        },
        resultingIssuance: stockIssuance({
          id: derived('S-A1', 0, 'resulting_issuance'),
          security_id: resultSecurity,
          date: '2024-05-01',
          quantity: '1200',
        }),
      })
    );
    expect(resolved.inputs.states).toEqual(['state-S-A1', 'state-S-A2']);
    expect(resolved.inputs.epochs).toEqual(['epoch-CLS-A']);
    expect(resolved.claimed).toEqual([]);
  });

  it('reads the state and epoch of a vesting snapshot, and the exact shard of a pre-split', () => {
    const index = baseBook({ vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' } }).index();
    const prefix = INITIAL_SHARD_PREFIXES[7] ?? '';
    const resolved = resolveInputs(
      index,
      apply(
        { kind: 'vestingSnapshot', securityId: 'S-A1', asOf: '2024-06-01', vested: '100' },
        { kind: 'preSplitShard', prefix },
        { kind: 'preSplitShard', prefix: `${prefix}1` }
      )
    );
    expect(resolved.inputs).toEqual({
      states: ['state-S-A1'],
      epochs: ['epoch-CLS-A'],
      shards: [`shard-${prefix}`],
      records: [],
    });
    expect(resolved.usage.shardsCreated).toBe(3);

    expect(
      refusal(() => resolveInputs(index, apply({ kind: 'preSplitShard', prefix: `${prefix}0` }))).message
    ).toContain(`no shard with prefix ${prefix}0 in this write`);
    expect(
      refusal(() =>
        resolveInputs(index, apply({ kind: 'vestingSnapshot', securityId: 'S-X', asOf: '2024-06-01', vested: '1' }))
      ).message
    ).toContain('no active state for security S-X in this write');
  });

  it('splits a full shard on a claim, then claims into the new child with no further input', () => {
    const fill = idsInShardOf('object', 'SH-NEW', 64);
    const book = baseBook();
    for (const id of fill) book.claim('object', id);
    const index = book.index();
    const fullShard = initialShardOf('object', 'SH-NEW');
    const [next] = idsInShardOf('object', 'SH-NEW', 1, 'next');

    const resolved = resolveInputs(
      index,
      apply(
        { kind: 'record', type: 'stakeholder', data: stakeholder('SH-NEW') },
        { kind: 'record', type: 'stakeholder', data: stakeholder(next ?? '') }
      )
    );

    expect(resolved.inputs.shards).toEqual([fullShard]);
    expect(resolved.claimed.map((claim) => claim.id)).toEqual(['SH-NEW', next]);
    // The 65th hash splits the shard into its two children; the second claim rewrites the child it falls in, which the
    // flush creates once: the shard archived, two children and two records.
    expect(resolved.usage.shardsCreated).toBe(2);
    expect(resolved.usage.contractsTouched).toBe(5);
  });

  it('refuses a claim no shard covers', () => {
    const index = new TestBook().index();
    const prefix = coveringShardPrefix(claimHash('object', 'SH-N'), new Set(INITIAL_SHARD_PREFIXES)) ?? '';
    index.remove(`shard-${prefix}`);
    expect(
      refusal(() => resolveInputs(index, apply({ kind: 'record', type: 'stakeholder', data: stakeholder('SH-N') })))
        .message
    ).toContain('no shard in this write covers the ID SH-N');
  });

  it('counts polymorphic references and the records they need', () => {
    const index = baseBook().index();
    const resolved = resolveInputs(
      index,
      apply(
        { kind: 'record', type: 'financing', data: financing('FIN-1', ['ISS-A1']) },
        { kind: 'record', type: 'document', data: document('DOC-1', ['SH-A', 'SH-B', 'SH-A']) }
      )
    );
    expect(resolved.usage.polymorphicReferences).toBe(4);
    expect(resolved.inputs.records).toEqual([
      { entityType: 'stockIssuance', contractId: 'cid-ISS-A1' },
      { entityType: 'stakeholder', contractId: 'cid-SH-A' },
      { entityType: 'stakeholder', contractId: 'cid-SH-B' },
    ]);
  });
});

describe('resolveInputs: stock events with outputs', () => {
  it("derives a cancellation's balance IDs, and reads the epoch of a conversion's resulting class", () => {
    const index = baseBook().record('stockClass', stockClass('CLS-B')).epoch('CLS-B').index();
    const balanceSecurity = derived('S-A1', 0, 'balance_security');
    const cancelled = resolveInputs(
      index,
      apply({
        kind: 'stockCancellation',
        cancellation: {
          object_type: 'TX_STOCK_CANCELLATION',
          id: derived('S-A1', 0, 'event'),
          date: '2024-04-01',
          security_id: 'S-A1',
          quantity: '100',
          balance_security_id: balanceSecurity,
          reason_text: 'Forfeited',
        },
        balance: stockIssuance({
          id: derived('S-A1', 0, 'balance_issuance'),
          security_id: balanceSecurity,
          date: '2024-04-01',
          quantity: '500',
        }),
      })
    );
    expect(cancelled.claimed).toEqual([]);
    expect(cancelled.inputs.states).toEqual(['state-S-A1']);
    // The cancellation and the balance's issuance, the source's state archived and the balance's new state.
    expect(cancelled.usage.contractsTouched).toBe(4);

    const converted = resolveInputs(
      index,
      apply({
        kind: 'stockConversion',
        conversion: {
          object_type: 'TX_STOCK_CONVERSION',
          id: 'CONV-1',
          date: '2024-04-01',
          security_id: 'S-A1',
          quantity_converted: '600',
          resulting_security_ids: ['S-C1'],
        },
        resulting: [stockIssuance({ id: 'ISS-C1', security_id: 'S-C1', stock_class_id: 'CLS-B', date: '2024-04-01' })],
        balance: null,
      })
    );
    expect(converted.inputs.epochs).toEqual(['epoch-CLS-A', 'epoch-CLS-B']);
    expect(converted.claimed.map((claim) => claim.id)).toEqual(['CONV-1', 'ISS-C1', 'S-C1']);

    const repurchased = resolveInputs(
      index,
      apply({
        kind: 'stockRepurchase',
        repurchase: {
          object_type: 'TX_STOCK_REPURCHASE',
          id: derived('S-A1', 0, 'event'),
          date: '2024-04-01',
          security_id: 'S-A1',
          quantity: '600',
          price: { amount: '1', currency: 'USD' },
        },
      })
    );
    expect(repurchased.inputs).toEqual({ states: ['state-S-A1'], epochs: ['epoch-CLS-A'], shards: [], records: [] });
  });

  it('counts at most one more tranche for an acceleration of a tranche lot, and none on terms', () => {
    const tranches = [
      { date: '2024-06-01', amount: '300' },
      { date: '2025-06-01', amount: '300' },
    ];
    const onTranches = resolveInputs(
      baseBook({ vesting: { kind: 'tranches', tranches } }).index(),
      apply({
        kind: 'record',
        type: 'vestingAcceleration',
        data: {
          object_type: 'TX_VESTING_ACCELERATION',
          id: derived('S-A1', 0, 'event'),
          date: '2024-09-01',
          security_id: 'S-A1',
          quantity: '100',
          reason_text: 'Change of control',
        },
      })
    );
    // Two tranches read with the state, three at most written with its successor.
    expect(onTranches.usage.tranches).toBe(5);
    expect(onTranches.inputs.states).toEqual(['state-S-A1']);

    const onTerms = resolveInputs(
      baseBook({ vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' }, accelerated_since_snapshot: '50' }).index(),
      apply({
        kind: 'record',
        type: 'vestingAcceleration',
        data: {
          object_type: 'TX_VESTING_ACCELERATION',
          id: derived('S-A1', 0, 'event'),
          date: '2024-09-01',
          security_id: 'S-A1',
          quantity: '100',
          reason_text: 'Change of control',
        },
      })
    );
    expect(onTerms.usage.tranches).toBe(0);

    const onWarrant = resolveInputs(
      baseBook().record('warrantIssuance', warrantIssuance('WI-1', 'W-1')).index(),
      apply({
        kind: 'record',
        type: 'vestingAcceleration',
        data: {
          object_type: 'TX_VESTING_ACCELERATION',
          id: 'ACC-W1',
          date: '2024-09-01',
          security_id: 'W-1',
          quantity: '100',
          reason_text: 'Change of control',
        },
      })
    );
    expect(onWarrant.inputs.records).toEqual([{ entityType: 'warrantIssuance', contractId: 'cid-WI-1' }]);
  });
});

describe('resolveInputs: CapTable_Restate', () => {
  it('reads an edited record and only the references the edit adds', () => {
    const index = baseBook()
      .record('stakeholder', stakeholder('SH-C'))
      .record('document', document('DOC-1', ['SH-A']))
      .index();
    const resolved = resolveInputs(index, {
      kind: 'restate',
      operations: [{ kind: 'edit', type: 'document', data: document('DOC-1', ['SH-A', 'SH-C']) }],
    });
    expect(resolved.inputs.records).toEqual([
      { entityType: 'document', contractId: 'cid-DOC-1' },
      { entityType: 'stakeholder', contractId: 'cid-SH-C' },
    ]);
    expect(resolved.usage.polymorphicReferences).toBe(1);
    expect(resolved.usage.contractsTouched).toBe(2);
    expect(resolved.claimed).toEqual([]);
  });

  it("deletes a stock issuance with its lot's state, releasing both IDs from their shards", () => {
    const index = baseBook().index();
    const resolved = resolveInputs(index, {
      kind: 'restate',
      operations: [
        { kind: 'delete', objectId: 'ISS-A1' },
        { kind: 'endState', securityId: 'S-A1' },
      ],
    });
    expect(resolved.inputs).toEqual({
      states: ['state-S-A1'],
      epochs: ['epoch-CLS-A'],
      shards: claimShards(['object', 'ISS-A1'], ['security', 'S-A1']),
      records: [{ entityType: 'stockIssuance', contractId: 'cid-ISS-A1' }],
    });
    expect(resolved.released).toEqual([
      { namespace: 'object', id: 'ISS-A1' },
      { namespace: 'security', id: 'S-A1' },
    ]);
  });

  it('keeps the security ID of a lot an event derived IDs from, and reads the consumer of a consumed lot', () => {
    const derivedIndex = baseBook({ derived_ids: true }).index();
    const kept = resolveInputs(derivedIndex, {
      kind: 'restate',
      operations: [
        { kind: 'delete', objectId: 'ISS-A1' },
        { kind: 'endState', securityId: 'S-A1' },
      ],
    });
    expect(kept.released).toEqual([{ namespace: 'object', id: 'ISS-A1' }]);

    const consumed = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance())
      .record('stockTransfer', stockTransfer({ id: 'TR-OLD', resulting_security_ids: ['S-B1'] }))
      .index();
    const resolved = resolveInputs(consumed, { kind: 'restate', operations: [{ kind: 'delete', objectId: 'ISS-A1' }] });
    expect(resolved.inputs.records).toEqual([
      { entityType: 'stockIssuance', contractId: 'cid-ISS-A1' },
      { entityType: 'stockTransfer', contractId: 'cid-TR-OLD' },
    ]);
  });

  it("reads a restated state's old and new class epochs, and a deleted class's epoch", () => {
    const index = baseBook().record('stockClass', stockClass('CLS-B')).epoch('CLS-B').index();
    const moved = resolveInputs(index, {
      kind: 'restate',
      operations: [
        {
          kind: 'setState',
          state: {
            security_id: 'S-A1',
            issue_date: '2024-01-01',
            last_event_date: '2024-01-01',
            origin_transaction_id: 'ISS-A1',
            quantity: '600',
            stakeholder_id: 'SH-A',
            stock_class_id: 'CLS-B',
            vesting: { kind: 'none' },
            snapshot: null,
            accelerated_since_snapshot: null,
          },
        },
      ],
    });
    expect(moved.inputs).toEqual({
      states: ['state-S-A1'],
      epochs: ['epoch-CLS-B', 'epoch-CLS-A'],
      shards: [],
      records: [],
    });

    const deleted = resolveInputs(index, { kind: 'restate', operations: [{ kind: 'delete', objectId: 'CLS-B' }] });
    expect(deleted.inputs.epochs).toEqual(['epoch-CLS-B']);
    expect(deleted.released).toEqual([{ namespace: 'object', id: 'CLS-B' }]);
  });

  it('refuses to recreate a state that is active, and to restate a record the register wrote', () => {
    const holdId = derived('S-A1', 0, 'hold');
    const index = baseBook()
      .record('stockHold', {
        object_type: 'TX_STOCK_HOLD',
        id: holdId,
        date: '2024-02-01',
        security_id: 'S-A1',
        hold_type: 'STOP_TRANSFER',
        reference: 'CASE-1',
        reason_text: 'Court order',
      })
      .index();
    expect(
      refusal(() =>
        resolveInputs(index, {
          kind: 'restate',
          operations: [
            {
              kind: 'setState',
              state: {
                security_id: 'S-A1',
                issue_date: '2024-01-01',
                last_event_date: '2024-01-01',
                origin_transaction_id: 'ISS-A1',
                quantity: '600',
                stakeholder_id: 'SH-A',
                stock_class_id: 'CLS-A',
                vesting: { kind: 'none' },
                snapshot: null,
                accelerated_since_snapshot: null,
                seq: 4,
              },
            },
          ],
        })
      ).message
    ).toContain('security S-A1 has an active state; replace it without a seq');
    expect(
      refusal(() => resolveInputs(index, { kind: 'restate', operations: [{ kind: 'delete', objectId: holdId }] }))
        .message
    ).toContain(`record ${holdId} was written by a register choice and is never restated`);
    expect(
      refusal(() => resolveInputs(index, { kind: 'restate', operations: [{ kind: 'delete', objectId: 'NOPE' }] }))
        .message
    ).toContain('record NOPE is not in this write');
  });
});

describe('resolveInputs: restatements that move, rename and recreate', () => {
  it('reads both grants of a vesting record moved between warrants, and swaps the claim of a renamed security', () => {
    const index = baseBook()
      .record('vestingTerms', vestingTerms('VT-1'))
      .record('warrantIssuance', warrantIssuance('WI-1', 'W-1', { vesting_terms_id: 'VT-1' }))
      .record('warrantIssuance', warrantIssuance('WI-2', 'W-2', { vesting_terms_id: 'VT-1' }))
      .record('vestingStart', vestingStart('VS-1', 'W-1'))
      .index();
    const moved = resolveInputs(index, {
      kind: 'restate',
      operations: [{ kind: 'edit', type: 'vestingStart', data: vestingStart('VS-1', 'W-2') }],
    });
    expect(moved.inputs.records).toEqual([
      { entityType: 'vestingStart', contractId: 'cid-VS-1' },
      { entityType: 'warrantIssuance', contractId: 'cid-WI-1' },
      { entityType: 'warrantIssuance', contractId: 'cid-WI-2' },
      { entityType: 'vestingTerms', contractId: 'cid-VT-1' },
    ]);

    const renamed = resolveInputs(index, {
      kind: 'restate',
      operations: [
        { kind: 'edit', type: 'warrantIssuance', data: warrantIssuance('WI-2', 'W-2B', { vesting_terms_id: 'VT-1' }) },
      ],
    });
    expect(renamed.released).toEqual([{ namespace: 'security', id: 'W-2' }]);
    expect(renamed.claimed).toEqual([{ namespace: 'security', id: 'W-2B' }]);
    expect(renamed.inputs.shards).toEqual(claimShards(['security', 'W-2'], ['security', 'W-2B']));

    const grantDeleted = resolveInputs(index, { kind: 'restate', operations: [{ kind: 'delete', objectId: 'WI-1' }] });
    expect(grantDeleted.released).toEqual([
      { namespace: 'object', id: 'WI-1' },
      { namespace: 'security', id: 'W-1' },
    ]);
    expect(
      refusal(() =>
        resolveInputs(index, {
          kind: 'restate',
          operations: [
            { kind: 'delete', objectId: 'VS-1' },
            { kind: 'delete', objectId: 'VS-1' },
          ],
        })
      ).message
    ).toContain('record VS-1 is edited or deleted more than once in one restatement');
  });

  it('recreates the state of a security whose consuming record the restatement deletes', () => {
    const index = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance())
      .record('stockTransfer', stockTransfer({ id: 'TR-OLD', resulting_security_ids: ['S-B1'] }))
      .index();
    const resolved = resolveInputs(index, {
      kind: 'restate',
      operations: [
        { kind: 'delete', objectId: 'TR-OLD' },
        {
          kind: 'setState',
          state: {
            security_id: 'S-A1',
            issue_date: '2024-01-01',
            last_event_date: '2024-01-01',
            origin_transaction_id: 'ISS-A1',
            quantity: '600',
            stakeholder_id: 'SH-A',
            stock_class_id: 'CLS-A',
            vesting: { kind: 'none' },
            snapshot: null,
            accelerated_since_snapshot: null,
            seq: 3,
          },
        },
      ],
    });
    expect(resolved.inputs).toEqual({
      states: [],
      epochs: ['epoch-CLS-A'],
      shards: claimShards(['object', 'TR-OLD']),
      records: [{ entityType: 'stockTransfer', contractId: 'cid-TR-OLD' }],
    });
    expect(
      refusal(() =>
        resolveInputs(index, {
          kind: 'restate',
          operations: [{ kind: 'endState', securityId: 'S-A1' }],
        })
      ).message
    ).toContain('no active state for security S-A1 in this write');
  });

  it('deletes an issuance with the record that consumed its lot, reading no other consumer', () => {
    const index = new TestBook()
      .record('stakeholder', stakeholder('SH-A'))
      .record('stockClass', stockClass('CLS-A'))
      .epoch('CLS-A')
      .record('stockIssuance', stockIssuance())
      .record('stockTransfer', stockTransfer({ id: 'TR-OLD', resulting_security_ids: ['S-B1'] }))
      .index();
    const resolved = resolveInputs(index, {
      kind: 'restate',
      operations: [
        { kind: 'delete', objectId: 'TR-OLD' },
        { kind: 'delete', objectId: 'ISS-A1' },
      ],
    });
    expect(resolved.inputs.records).toEqual([
      { entityType: 'stockTransfer', contractId: 'cid-TR-OLD' },
      { entityType: 'stockIssuance', contractId: 'cid-ISS-A1' },
    ]);
    expect(resolved.released).toEqual([
      { namespace: 'object', id: 'TR-OLD' },
      { namespace: 'object', id: 'ISS-A1' },
    ]);
  });
});

describe('resolveInputs: holds and settlement', () => {
  const settlementHold: OpenHold = {
    hold_id: derived('S-A1', 0, 'hold'),
    hold_type: 'REGISTER_SETTLEMENT',
    reference: 'T-1',
    split_epoch: 0,
    quantity: '600',
  };

  it("reads each lot's state and class epoch, and supplies a settlement lot's origin issuance", () => {
    const index = baseBook().index();
    const resolved: ResolvedInputs = resolveInputs(index, {
      kind: 'placeHolds',
      holdType: 'REGISTER_SETTLEMENT',
      reference: 'T-1',
      date: '2025-06-02',
      reasonText: 'Trade T-1',
      lots: [{ security_id: 'S-A1', quantity: '600' }],
    });
    expect(resolved.inputs).toEqual({ states: ['state-S-A1'], epochs: ['epoch-CLS-A'], shards: [], records: [] });
    expect([...resolved.originIssuances]).toEqual([['S-A1', 'cid-ISS-A1']]);
    expect(resolved.claimed).toEqual([]);
    expect(resolved.usage.operations).toBe(1);

    const stop = resolveInputs(index, {
      kind: 'placeHolds',
      holdType: 'STOP_TRANSFER',
      reference: 'CASE-1',
      date: '2025-06-02',
      reasonText: 'Court order',
      lots: [{ security_id: 'S-A1' }],
    });
    expect(stop.originIssuances.size).toBe(0);
  });

  it('writes the cancellation of the settlement hold a stop replaces', () => {
    const index = baseBook({ holds: [settlementHold], seq: 1 }).index();
    const stop = resolveInputs(index, {
      kind: 'placeHolds',
      holdType: 'STOP_TRANSFER',
      reference: 'CASE-1',
      date: '2025-06-02',
      reasonText: 'Court order',
      lots: [{ security_id: 'S-A1' }],
    });
    // The hold and the hold cancellation, the archived state and its successor.
    expect(stop.usage.contractsTouched).toBe(4);
    expect(stop.claimed).toEqual([]);
  });

  it("reads cancellations' lots, and resolves a settlement's existing buyer and draws' origins", () => {
    const index = baseBook({ holds: [settlementHold], seq: 1 }).index();
    const cancel = resolveInputs(index, {
      kind: 'cancelHolds',
      date: '2025-06-03',
      holds: [{ security_id: 'S-A1', hold_id: settlementHold.hold_id, reason_text: 'Trade released' }],
    });
    expect(cancel.inputs).toEqual({ states: ['state-S-A1'], epochs: ['epoch-CLS-A'], shards: [], records: [] });

    const draw = {
      security_id: 'S-A1',
      hold_id: settlementHold.hold_id,
      quantity: '400',
      custom_id: 'BUY-1',
      share_price: { amount: '2', currency: 'USD' },
      buyer_cost_basis: { amount: '800', currency: 'USD' },
      balance_cost_basis: null,
      balance_vestings: [],
      origin_issuance: 'cid-ISS-A1',
    };
    const existing = resolveInputs(index, {
      kind: 'settle',
      settlementId: 'T-1',
      date: '2025-06-02',
      buyer: { kind: 'existingStakeholder', stakeholderId: 'SH-B' },
      lots: [{ kind: 'draw', lot: draw }],
    });
    expect(existing.buyer).toEqual({ kind: 'existing', contractId: 'cid-SH-B' });
    expect(existing.inputs).toEqual({ states: ['state-S-A1'], epochs: ['epoch-CLS-A'], shards: [], records: [] });
    expect([...existing.originIssuances]).toEqual([['S-A1', 'cid-ISS-A1']]);
    expect(existing.claimed).toEqual([]);

    const fresh = resolveInputs(index, {
      kind: 'settle',
      settlementId: 'T-1',
      date: '2025-06-02',
      buyer: { kind: 'new', stakeholder: stakeholder('SH-NEW') },
      lots: [{ kind: 'draw', lot: draw }],
    });
    expect(fresh.claimed).toEqual([{ namespace: 'object', id: 'SH-NEW' }]);
    expect(fresh.inputs.shards).toEqual(claimShards(['object', 'SH-NEW']));
    expect(fresh.buyer).toEqual({ kind: 'new', stakeholder: stakeholder('SH-NEW') });

    const tranches = [
      { date: '2024-06-01', amount: '300' },
      { date: '2024-07-01', amount: '300' },
    ];
    const trancheLot = baseBook({ holds: [settlementHold], seq: 1, vesting: { kind: 'tranches', tranches } }).index();
    const partial = resolveInputs(trancheLot, {
      kind: 'settle',
      settlementId: 'T-1',
      date: '2025-06-02',
      buyer: { kind: 'existing', contractId: 'cid-SH-B' },
      lots: [{ kind: 'draw', lot: draw }],
    });
    expect(partial.buyer).toEqual({ kind: 'existing', contractId: 'cid-SH-B' });
    // Two tranches read with the lot, one left on the balance's issuance and one on its state.
    expect(partial.usage.tranches).toBe(4);
    // The transfer, the buyer's and the balance's issuances, the archived lot and the two new states.
    expect(partial.usage.contractsTouched).toBe(6);

    expect(
      refusal(() =>
        resolveInputs(index, {
          kind: 'settle',
          settlementId: 'T-1',
          date: '2025-06-02',
          buyer: { kind: 'existingStakeholder', stakeholderId: 'SH-X' },
          lots: [{ kind: 'draw', lot: draw }],
        })
      ).message
    ).toContain("the buyer's stakeholder SH-X is not on the book");
  });
});

describe('requirementsOf', () => {
  it('lists a stock issuance references as the ledger checks them', () => {
    expect(
      requirementsOf('stockIssuance', stockIssuance({ stock_plan_id: 'PLAN-1', vesting_terms_id: 'VT-1' }))
    ).toEqual([
      { kind: 'object', label: 'Stock issuance stakeholder', object_id: 'SH-A', object_types: ['STAKEHOLDER'] },
      { kind: 'object', label: 'Stock issuance stock class', object_id: 'CLS-A', object_types: ['STOCK_CLASS'] },
      {
        kind: 'plan_includes_class',
        label: 'Stock issuance stock plan',
        stock_plan_id: 'PLAN-1',
        stock_class_id: 'CLS-A',
      },
      { kind: 'object', label: 'Stock issuance vesting terms', object_id: 'VT-1', object_types: ['VESTING_TERMS'] },
    ]);
    expect(requirementsOf('stockTransfer', stockTransfer())).toEqual([]);
    expect(requirementsOf('document', document('DOC-1', ['SH-A', 'SH-A']))).toHaveLength(1);
  });
});
