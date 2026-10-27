/**
 * The offline replay against the Daml Script scenarios of OCP's `Test/daml/OpenCapTable/` (OCP `93ea933`): each valid
 * scenario replays clean to the ledger's state, each refused one yields the same rule, written in the date order a
 * replication writes. A scenario the ledger refuses only for the order its script writes in (an earlier-dated event
 * after a later one) replays clean, because the replay writes in date order.
 */

import { replayOcf } from '../../src/register/replay/replay';
import type { ReplayResult } from '../../src/types/register';
import { buildOcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  baseBook,
  stockIssuance as bookIssuance,
  CONTEXT,
  stockAcceptance,
  stockState,
  stockTransfer,
} from './bookFixtures';
import {
  acceleration,
  acceptance,
  cancellation,
  CAP_TABLE_ID,
  consolidation,
  conversion,
  D2024,
  derived,
  EVENT_DAY,
  issuance,
  lastStep,
  manifestOf,
  out,
  quantityOf,
  reissuance,
  replayBook,
  repurchase,
  retraction,
  rulesOf,
  split,
  SPLIT_DAY,
  stakeholder,
  standardBook,
  stockClass,
  tranche,
  transfer,
  vestingStart,
  vestingTerms,
  type OcfJson,
} from './replayFixtures';

function expectClean(result: ReplayResult): void {
  expect(result.violations).toEqual([]);
}

function expectRefused(result: ReplayResult, rule: string, fragment: string): void {
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0]).toEqual(
    expect.objectContaining({ rule, message: expect.stringContaining(fragment) as unknown })
  );
}

describe('replayOcf: stock events (TestStockEvents.daml)', () => {
  it('a transfer ends its source and starts the resulting and balance states', () => {
    const result = replayBook(
      transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'),
      out('S-B1', 'SH-B', '100'),
      out('S-A1-R', 'SH-A', '500')
    );
    expectClean(result);
    expect(result.states.has('S-A1')).toBe(false);
    expect(result.retired.get('S-A1')).toEqual(
      expect.objectContaining({ securityId: 'S-A1', recordId: 'TR-1', date: EVENT_DAY })
    );
    expect(result.states.get('S-B1')).toEqual({
      security_id: 'S-B1',
      issue_date: EVENT_DAY,
      last_event_date: EVENT_DAY,
      origin_transaction_id: 'ISS-S-B1',
      quantity: '100',
      seq: 0,
      split_epoch: 0,
      stakeholder_id: 'SH-B',
      stock_class_id: 'CLS-A',
      vesting: { kind: 'none' },
      holds: [],
      delivery: null,
      snapshot: null,
      accelerated_since_snapshot: null,
      derived_ids: false,
    });
    expect(quantityOf(result, 'S-A1-R')).toBe('500');
    const step = lastStep(result);
    expect(step).toEqual(
      expect.objectContaining({
        kind: 'apply',
        date: EVENT_DAY,
        recordIds: ['TR-1', 'ISS-S-B1', 'ISS-S-A1-R'],
        securityIds: ['S-A1', 'S-B1', 'S-A1-R'],
        derivedForm: false,
      })
    );
    expect(step?.operation).toEqual({
      kind: 'stockTransfer',
      transfer: expect.objectContaining({ id: 'TR-1' }) as unknown,
      resulting: [expect.objectContaining({ id: 'ISS-S-B1' })],
      balance: expect.objectContaining({ id: 'ISS-S-A1-R' }) as unknown,
    });
  });

  it('refuses an object ID used twice', () => {
    const result = replayBook(
      transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'),
      out('S-B1', 'SH-B', '100'),
      out('S-A1-R', 'SH-A', '500'),
      stakeholder('TR-1')
    );
    expectRefused(result, 'claimed_id', 'ID already used: TR-1');
  });

  it.each([
    [
      'resulting securities that do not hold the quantity',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'), out('S-B1', 'SH-B', '90'), out('S-A1-R', 'SH-A', '500')],
      'conservation',
      'must hold exactly its quantity 100.0',
    ],
    [
      'a balance that does not hold the remainder',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'), out('S-B1', 'SH-B', '100'), out('S-A1-R', 'SH-A', '499')],
      'balance',
      'must hold the remaining 500.0',
    ],
    [
      'a partial transfer without a balance',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], null), out('S-B1', 'SH-B', '100')],
      'balance',
      'needs a balance issuance',
    ],
    [
      'a whole transfer with a balance',
      [transfer('TR-1', 'S-A1', '600', ['S-B1'], 'S-A1-R'), out('S-B1', 'SH-B', '600'), out('S-A1-R', 'SH-A', '0')],
      'balance',
      'has no balance',
    ],
    [
      'a balance the transfer does not name',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-X'), out('S-B1', 'SH-B', '100'), out('S-A1-R', 'SH-A', '500')],
      'balance',
      'needs a balance issuance',
    ],
    [
      'resulting issuances that are not its resulting securities',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'), out('S-B2', 'SH-B', '100'), out('S-A1-R', 'SH-A', '500')],
      'resulting_securities',
      'in order',
    ],
    [
      'a balance that leaves the stakeholder',
      [transfer('TR-1', 'S-A1', '100', ['S-B1'], 'S-A1-R'), out('S-B1', 'SH-B', '100'), out('S-A1-R', 'SH-B', '500')],
      'balance',
      "stay with the source's stakeholder",
    ],
    [
      'more than the security holds',
      [transfer('TR-1', 'S-A1', '700', ['S-B1'], null), out('S-B1', 'SH-B', '700')],
      'balance',
      'event quantity 700.0 exceeds the 600.0 of security S-A1',
    ],
  ])('refuses a transfer with %s', (_case, records: OcfJson[], rule, fragment) => {
    const result = replayBook(...records);
    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        rule,
        message: expect.stringContaining(fragment) as unknown,
        recordIds: expect.arrayContaining(['TR-1']) as unknown,
      })
    );
    expect(result.retired.has('S-A1')).toBe(false);
    expect(quantityOf(result, 'S-A1')).toBe('600');
  });

  it('refuses a whole event that names a balance it does not write', () => {
    expectRefused(
      replayBook(transfer('TR-1', 'S-A1', '600', ['S-B1'], 'S-A1-R'), out('S-B1', 'SH-B', '600')),
      'balance',
      'the event names a balance security but writes none'
    );
  });

  it('replays a record derived at a seq it cannot see (a TA snapshot, a restatement) as the ledger wrote it', () => {
    const acceptanceId = derived('S-A1', 5, 'event');
    const result = replayBook(acceptance(acceptanceId, 'S-A1', EVENT_DAY));
    expectClean(result);
    expect(result.states.get('S-A1')).toEqual(expect.objectContaining({ seq: 1, derived_ids: true }));
  });

  it('dates output issuances on their event, in the units of its split epoch', () => {
    const splitRecord = split('SPLIT-1', 'CLS-A', '2', '1', '2024-02-01');
    const before = '2024-01-15';
    const after = '2024-03-02';
    const refusedWith = (...records: OcfJson[]): ReplayResult => replayBook(splitRecord, ...records);
    expectRefused(
      refusedWith(
        transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A1-R'),
        out('S-B1', 'SH-B', '200', before),
        out('S-A1-R', 'SH-A', '1000')
      ),
      'output_date',
      `output issuance ISS-S-B1 is dated ${before}, not on its event's date ${EVENT_DAY}`
    );
    expectRefused(
      refusedWith(
        transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A1-R'),
        out('S-B1', 'SH-B', '200', after),
        out('S-A1-R', 'SH-A', '1000')
      ),
      'output_date',
      'not on its event'
    );
    expectRefused(
      refusedWith(
        transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A1-R'),
        out('S-B1', 'SH-B', '200'),
        out('S-A1-R', 'SH-A', '1000', before)
      ),
      'output_date',
      'output issuance ISS-S-A1-R'
    );
    expectRefused(
      refusedWith(cancellation('CX-1', 'S-A1', '200', 'S-A1-R'), out('S-A1-R', 'SH-A', '1000', before)),
      'output_date',
      'not on its event'
    );
    expectRefused(
      refusedWith(consolidation('CO-1', ['S-A1', 'S-A2'], 'S-A-C'), out('S-A-C', 'SH-A', '2000', before)),
      'output_date',
      'not on its event'
    );
    const result = refusedWith(
      transfer('TR-1', 'S-A1', '200', ['S-B1'], 'S-A1-R'),
      out('S-B1', 'SH-B', '200'),
      out('S-A1-R', 'SH-A', '1000')
    );
    expectClean(result);
    const buyer = result.states.get('S-B1');
    expect([buyer?.issue_date, buyer?.last_event_date, buyer?.split_epoch, buyer?.quantity]).toEqual([
      EVENT_DAY,
      EVENT_DAY,
      1,
      '200',
    ]);
    expect(result.retired.get('S-A1')?.lastState.quantity).toBe('1200');
  });

  it('keeps a resulting issuance in the source class', () => {
    const result = replayBook(
      stockClass('CLS-B'),
      transfer('TR-1', 'S-A1', '600', ['S-B1'], null),
      issuance('S-B1', 'SH-B', 'CLS-B', '600', EVENT_DAY)
    );
    expectRefused(result, 'class', "a stock transfer's resulting securities stay in the source's class");
  });

  it('refuses a second event on a security the first ended', () => {
    const result = replayBook(
      transfer('TR-1', 'S-A2', '400', ['S-B1'], null),
      out('S-B1', 'SH-B', '400'),
      transfer('TR-2', 'S-A2', '400', ['S-B2'], null),
      out('S-B2', 'SH-B', '400'),
      acceptance('ACC-B2', 'S-B2', '2024-04-01')
    );
    expect(rulesOf(result)).toEqual(['missing_state', 'missing_state']);
    expect(result.violations[0]?.message).toBe(`no active state for security S-A2: TR-1 ended it on ${EVENT_DAY}`);
    expect(result.violations[0]?.recordIds).toEqual(['TR-2', 'ISS-S-B2']);
    // The acceptance names the refused transfer's output.
    expect(result.violations[1]?.message).toBe('no active state for security S-B2: TR-2, which issues it, was refused');
  });

  it('takes the derived IDs of an event without claiming them', () => {
    const transferId = derived('S-A2', 0, 'event');
    const securityId = derived('S-A2', 0, 'resulting_security');
    const result = replayBook(transfer(transferId, 'S-A2', '400', [securityId], null), {
      ...out(securityId, 'SH-B', '400'),
      id: derived('S-A2', 0, 'resulting_issuance'),
    });
    expectClean(result);
    expect(result.states.has(securityId)).toBe(true);
    expect(lastStep(result)?.derivedForm).toBe(true);
    // A claimed ID may not have the book's derived form.
    expectRefused(
      replayBook(stakeholder(`${CAP_TABLE_ID}:abc`)),
      'claimed_id',
      `ID ${CAP_TABLE_ID}:abc has this cap table's derived form and cannot be claimed`
    );
    // Without the cap table ID, the same ID is an ordinary claimed one.
    expectClean(replayOcf(standardBook(stakeholder(`${CAP_TABLE_ID}:abc`))));
  });

  it('writes events on a security in date order whatever the manifest order', () => {
    const result = replayBook(acceptance('ACC-JUN', 'S-A1', '2024-06-01'), acceptance('ACC-MAY', 'S-A1', '2024-05-01'));
    expectClean(result);
    const state = result.states.get('S-A1');
    expect([state?.seq, state?.last_event_date]).toEqual([2, '2024-06-01']);
    const order = result.steps.flatMap((step) => step.recordIds).filter((id) => id.startsWith('ACC-'));
    expect(order).toEqual(['ACC-MAY', 'ACC-JUN']);
  });

  it('refuses an event dated before its security is issued', () => {
    expectRefused(
      replayBook(acceptance('ACC-0', 'S-A1', '2023-12-31')),
      'date_order',
      `event dated 2023-12-31 precedes the last event on security S-A1 (${D2024})`
    );
  });

  it('cancels and repurchases, leaving a balance only where shares remain', () => {
    const result = replayBook(
      cancellation('CXL-1', 'S-A1', '100', 'S-A1-R'),
      out('S-A1-R', 'SH-A', '500'),
      repurchase('REP-1', 'S-A2', '400', null)
    );
    expectClean(result);
    expect(quantityOf(result, 'S-A1-R')).toBe('500');
    expect(result.states.has('S-A2')).toBe(false);
    expect(result.steps.map((step) => step.operation?.kind).slice(-2)).toEqual([
      'stockCancellation',
      'stockRepurchase',
    ]);
  });

  it('ends a retracted security, so a later event finds no state', () => {
    const result = replayBook(retraction('RET-1', 'S-A2', EVENT_DAY), acceptance('ACC-1', 'S-A2', '2024-03-02'));
    expectRefused(result, 'missing_state', `no active state for security S-A2: RET-1 ended it on ${EVENT_DAY}`);
    expect(result.retired.get('S-A2')?.recordId).toBe('RET-1');
  });

  it("converts into another class with the writer's arithmetic", () => {
    const result = replayBook(
      stockClass('CLS-B'),
      conversion('CONV-1', 'S-A2', '400', ['S-A2-C']),
      issuance('S-A2-C', 'SH-A', 'CLS-B', '800', EVENT_DAY)
    );
    expectClean(result);
    expect(result.states.get('S-A2-C')).toEqual(expect.objectContaining({ stock_class_id: 'CLS-B', quantity: '800' }));
  });

  it('conserves the quantity of a same-class reissuance', () => {
    const reissue = reissuance('REISS-1', 'S-A2', ['S-A2-X', 'S-A2-Y']);
    expectRefused(
      replayBook(reissue, out('S-A2-X', 'SH-A', '100'), out('S-A2-Y', 'SH-A', '100')),
      'conservation',
      'must conserve the quantity 400.0'
    );
    const result = replayBook(reissue, out('S-A2-X', 'SH-A', '100'), out('S-A2-Y', 'SH-A', '300'));
    expectClean(result);
    expect(quantityOf(result, 'S-A2-Y')).toBe('300');
  });

  it('consolidates one stakeholder’s lots of one class into their sum', () => {
    expectRefused(
      replayBook(consolidation('CONS-1', ['S-A1', 'S-A2'], 'S-A-ALL'), out('S-A-ALL', 'SH-A', '999')),
      'conservation',
      'must yield the sum'
    );
    expectRefused(
      replayBook(consolidation('CONS-1', ['S-A1', 'S-A1'], 'S-A-ALL'), out('S-A-ALL', 'SH-A', '1200')),
      'resulting_securities',
      'names each security once'
    );
    const result = replayBook(consolidation('CONS-1', ['S-A1', 'S-A2'], 'S-A-ALL'), out('S-A-ALL', 'SH-A', '1000'));
    expectClean(result);
    expect([result.states.has('S-A1'), result.states.has('S-A2'), quantityOf(result, 'S-A-ALL')]).toEqual([
      false,
      false,
      '1000',
    ]);
    expectRefused(
      replayBook(
        stockClass('CLS-B'),
        issuance('S-B1', 'SH-A', 'CLS-B', '5', D2024),
        consolidation('CONS-1', ['S-A1', 'S-B1'], 'S-ALL'),
        out('S-ALL', 'SH-A', '605')
      ),
      'class',
      "a consolidation's securities share one class"
    );
  });

  describe('vesting on outputs', () => {
    const t1 = '2024-02-01';
    const t2 = '2025-02-01';
    const lot = issuance('S-V', 'SH-A', 'CLS-A', '100', D2024, {
      vestings: [tranche('50', t1), tranche('50', t2)],
    });
    const sale = transfer('TR-V', 'S-V', '60', ['S-V-B'], 'S-V-R');
    const buyer = (vestings: OcfJson[]): OcfJson => ({ ...out('S-V-B', 'SH-B', '60'), vestings });
    const balance = (vestings: OcfJson[]): OcfJson => ({ ...out('S-V-R', 'SH-A', '40'), vestings });

    it('moves unvested shares with their tranches', () => {
      expectRefused(
        replayBook(lot, sale, buyer([]), balance([tranche('20', t1), tranche('20', t2)])),
        'vesting',
        'more than the 50.0'
      );
      expectRefused(
        replayBook(lot, sale, buyer([tranche('30', t1), tranche('30', t2)]), balance([])),
        'vesting',
        'explicit vestings that sum'
      );
      const result = replayBook(
        lot,
        sale,
        buyer([tranche('30', t1), tranche('30', t2)]),
        balance([tranche('20', t1), tranche('20', t2)])
      );
      expectClean(result);
      expect(result.states.get('S-V-B')?.vesting).toEqual({
        kind: 'tranches',
        tranches: [
          { date: t1, amount: '30' },
          { date: t2, amount: '30' },
        ],
      });
    });

    it("conserves each date's vested amount", () => {
      expectRefused(
        replayBook(lot, sale, buyer([tranche('30', t1), tranche('30', t2)]), balance([tranche('40', t2)])),
        'vesting',
        'but security S-V has vested 50.0'
      );
      expectRefused(
        replayBook(
          lot,
          sale,
          { ...buyer([]), vesting_terms_id: 'VT-1' },
          balance([tranche('20', t1), tranche('20', t2)])
        ),
        'vesting',
        'replaces them with vesting terms'
      );
      expectRefused(
        replayBook(transfer('TR-F', 'S-A2', '400', ['S-A2-B'], null), {
          ...out('S-A2-B', 'SH-B', '400'),
          vestings: [tranche('400', '2030-01-01')],
        }),
        'vesting',
        'but security S-A2 has vested 400.0'
      );
    });

    it('needs full tranche cover for a partial event', () => {
      expectRefused(
        replayBook(
          issuance('S-P', 'SH-A', 'CLS-A', '100', D2024, { vestings: [tranche('50', D2024)] }),
          transfer('TR-P', 'S-P', '10', ['S-P-B'], 'S-P-R'),
          { ...out('S-P-B', 'SH-B', '10'), vestings: [tranche('10', D2024)] },
          { ...out('S-P-R', 'SH-A', '90'), vestings: [tranche('40', D2024), tranche('50', '2030-01-01')] }
        ),
        'tranche_cover',
        'covering less than its quantity'
      );
    });
  });

  describe('lots on vesting terms', () => {
    const terms = vestingTerms('VT-4Y');
    const lot = issuance('S-V1', 'SH-A', 'CLS-A', '100', D2024, { vesting_terms_id: 'VT-4Y' });
    const day = '2025-03-03';

    it('writes the snapshot an event moving vested shares needs, before it', () => {
      const result = replayBook(
        terms,
        lot,
        transfer('TR-T', 'S-V1', '30', ['S-V1-B'], 'S-V1-R', day),
        out('S-V1-B', 'SH-B', '30', day),
        {
          ...out('S-V1-R', 'SH-A', '70', day),
          vestings: [tranche('10', '2025-03-01'), tranche('60', '2027-01-01')],
        }
      );
      expectClean(result);
      const [snapshot, event] = result.steps.slice(-2);
      expect(snapshot).toEqual({
        kind: 'snapshot',
        operation: { kind: 'vestingSnapshot', securityId: 'S-V1', asOf: day, vested: '40' },
        date: day,
        recordIds: [],
        securityIds: ['S-V1'],
        derivedForm: false,
        impliedBy: 'TR-T',
      });
      expect(event?.recordIds[0]).toBe('TR-T');
      expect(result.retired.get('S-V1')?.lastState).toEqual(
        expect.objectContaining({ seq: 1, snapshot: { as_of: day, vested: '40' }, accelerated_since_snapshot: null })
      );
      expect(quantityOf(result, 'S-V1-R')).toBe('70');
    });

    it('keeps vesting terms on a whole transfer, which needs no snapshot', () => {
      const result = replayBook(terms, lot, transfer('TR-W', 'S-V1', '100', ['S-V1-B'], null, day), {
        ...out('S-V1-B', 'SH-B', '100', day),
        vesting_terms_id: 'VT-4Y',
      });
      expectClean(result);
      expect(result.steps.some((step) => step.kind === 'snapshot')).toBe(false);
      expect(result.states.get('S-V1-B')?.vesting).toEqual({ kind: 'on_terms', vesting_terms_id: 'VT-4Y' });
    });

    it('refuses a snapshot that leaves out the accelerations since the last one', () => {
      const result = replayBook(
        terms,
        lot,
        acceleration('ACC-1', 'S-V1', '20', '2025-03-01'),
        transfer('TR-T', 'S-V1', '10', ['S-V1-B'], 'S-V1-R', day),
        out('S-V1-B', 'SH-B', '10', day),
        { ...out('S-V1-R', 'SH-A', '90', day), vestings: [tranche('90', '2027-01-01')] }
      );
      expectRefused(
        result,
        'snapshot',
        'vesting snapshot for security S-V1 of 10.0 leaves out the 20.0 accelerated since the last snapshot of 0.0'
      );
    });

    it('bounds accelerations by the unvested quantity', () => {
      const result = replayBook(
        terms,
        lot,
        acceleration('ACC-1', 'S-V1', '60', '2025-06-01'),
        acceleration('ACC-2', 'S-V1', '41', '2025-06-02')
      );
      expectRefused(result, 'vesting', 'acceleration of 41.0 on security S-V1 exceeds its unvested quantity 40.0');
      expect(result.states.get('S-V1')?.accelerated_since_snapshot).toBe('60');
    });
  });

  it('accelerates explicit tranches and refuses a fully vested lot', () => {
    const later = '2025-01-01';
    const result = replayBook(
      issuance('S-T', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [tranche('50', D2024), tranche('50', '2026-01-01')],
      }),
      acceleration('ACC-1', 'S-T', '20', later),
      acceleration('ACC-2', 'S-T', '31', later),
      acceleration('ACC-3', 'S-A1', '1', later)
    );
    expect(rulesOf(result)).toEqual(['vesting', 'vesting']);
    expect(result.violations[0]?.message).toBe('security S-A1 is fully vested and cannot be accelerated');
    expect(result.violations[1]?.message).toBe(
      'acceleration of 31.0 on security S-T must be positive and at most its unvested quantity 30.0'
    );
    expect(result.states.get('S-T')?.vesting).toEqual({
      kind: 'tranches',
      tranches: [
        { date: D2024, amount: '50' },
        { date: later, amount: '20' },
        { date: '2026-01-01', amount: '30' },
      ],
    });
  });
});

describe('replayOcf: splits (TestSplits.daml)', () => {
  const split2for1 = split('SPLIT-1', 'CLS-A', '2', '1', SPLIT_DAY);

  it('applies a split lazily, at each state’s next event dated on or after it', () => {
    const result = replayBook(
      split2for1,
      acceptance('ACC-0', 'S-A1', '2025-01-09'),
      acceptance('ACC-1', 'S-A1', SPLIT_DAY)
    );
    expectClean(result);
    expect(result.states.get('S-A1')).toEqual(expect.objectContaining({ quantity: '1200', split_epoch: 1, seq: 2 }));
    expect(result.states.get('S-A2')).toEqual(expect.objectContaining({ quantity: '400', split_epoch: 0 }));
    expect(result.splits.get('CLS-A')).toEqual([
      { split_id: 'SPLIT-1', date: SPLIT_DAY, ratio: { numerator: '2', denominator: '1' } },
    ]);
    const before = replayBook(split2for1, acceptance('ACC-0', 'S-A1', '2025-01-09'));
    expect(before.states.get('S-A1')).toEqual(expect.objectContaining({ quantity: '600', split_epoch: 0 }));
  });

  it('reads an issuance dated on the split’s day in post-split units, whatever the manifest order', () => {
    const result = replayBook(
      issuance('S-NEW', 'SH-A', 'CLS-A', '10', SPLIT_DAY),
      split2for1,
      acceptance('ACC-N', 'S-NEW', '2025-01-15')
    );
    expectClean(result);
    expect(result.states.get('S-NEW')).toEqual(expect.objectContaining({ quantity: '10', split_epoch: 1 }));
    const written = result.steps.flatMap((step) => step.recordIds);
    expect(written.indexOf('SPLIT-1')).toBeLessThan(written.indexOf('ISS-S-NEW'));
  });

  it('reads an event dated on the split’s day in post-split units', () => {
    expectClean(
      replayBook(
        split2for1,
        transfer('TR-1', 'S-A1', '1200', ['S-B1'], null, SPLIT_DAY),
        out('S-B1', 'SH-B', '1200', SPLIT_DAY)
      )
    );
    expectRefused(
      replayBook(
        split2for1,
        transfer('TR-1', 'S-A1', '600', ['S-B1'], null, SPLIT_DAY),
        out('S-B1', 'SH-B', '600', SPLIT_DAY)
      ),
      'balance',
      'needs a balance issuance'
    );
  });

  it('floors quantities and tranches cumulatively', () => {
    const result = replayBook(
      issuance('S-T', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [tranche('40', '2024-06-01'), tranche('60', '2025-06-01')],
      }),
      split('SPLIT-1', 'CLS-A', '2', '3', SPLIT_DAY),
      acceptance('ACC-T', 'S-T', SPLIT_DAY)
    );
    expectClean(result);
    expect(result.states.get('S-T')).toEqual(
      expect.objectContaining({
        quantity: '66.6666666666',
        vesting: {
          kind: 'tranches',
          tranches: [
            { date: '2024-06-01', amount: '26.6666666666' },
            { date: '2025-06-01', amount: '40' },
          ],
        },
      })
    );
  });

  it('fails closed on a split that floors a state to zero', () => {
    expectRefused(
      replayBook(
        issuance('S-TINY', 'SH-A', 'CLS-A', '0.0000000001', D2024),
        split('SPLIT-1', 'CLS-A', '1', '10', SPLIT_DAY),
        acceptance('ACC-X', 'S-TINY', SPLIT_DAY)
      ),
      'split',
      'floors security S-TINY to zero'
    );
  });

  it('refuses a split that is not positive, and one whose arithmetic overflows a Daml Decimal', () => {
    expectRefused(
      replayBook(split('SPLIT-0', 'CLS-A', '0', '1', SPLIT_DAY)),
      'split',
      'split SPLIT-0 needs a positive ratio'
    );
    const overflow = replayBook(
      issuance('S-HUGE', 'SH-A', 'CLS-A', '1000000000000000000000000000', D2024),
      split('SPLIT-1', 'CLS-A', '100', '1', SPLIT_DAY),
      acceptance('ACC-H', 'S-HUGE', SPLIT_DAY)
    );
    expect(overflow.violations[0]).toEqual(expect.objectContaining({ rule: 'malformed_record', recordIds: ['ACC-H'] }));
  });

  it('records splits dated after the class’s latest, at most 64', () => {
    expectRefused(
      replayBook(split2for1, split('SPLIT-2', 'CLS-A', '2', '1', SPLIT_DAY)),
      'split',
      "must be dated after the class's latest recorded split"
    );
    // In date order an earlier-dated split is recorded first.
    expectClean(replayBook(split2for1, split('SPLIT-0', 'CLS-A', '3', '1', '2025-01-09')));
    const many = Array.from({ length: 65 }, (_, i) =>
      split(
        `SPLIT-${i + 1}`,
        'CLS-A',
        '1',
        '1',
        `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
      )
    );
    const result = replayBook(...many);
    expectRefused(result, 'split', 'stock class CLS-A already has 64 splits');
    expect(result.violations[0]?.recordIds).toEqual(['SPLIT-65']);
  });

  it('applies the split a reissuance names before the reissuance', () => {
    const reissue = reissuance('REISS-1', 'S-A2', ['S-A2-R'], SPLIT_DAY, 'SPLIT-1');
    expectRefused(
      replayBook(split2for1, reissue, out('S-A2-R', 'SH-A', '400', SPLIT_DAY)),
      'conservation',
      'must conserve the quantity 800.0'
    );
    const result = replayBook(split2for1, reissue, out('S-A2-R', 'SH-A', '800', SPLIT_DAY));
    expectClean(result);
    expect(result.states.get('S-A2-R')).toEqual(expect.objectContaining({ quantity: '800', split_epoch: 1 }));
  });

  it('checks the split a reissuance names', () => {
    const date = '2025-07-01';
    const book = (splitId: string): ReplayResult =>
      replayBook(
        stockClass('CLS-B'),
        split('SPLIT-B', 'CLS-B', '2', '1', '2025-06-01'),
        split('SPLIT-A-LATE', 'CLS-A', '2', '1', '2025-08-01'),
        reissuance('REISS-S', 'S-A1', ['S-A1-R'], date, splitId),
        out('S-A1-R', 'SH-A', '600', date)
      );
    expectRefused(
      book('SPLIT-B'),
      'split_reference',
      'Stock reissuance REISS-S split SPLIT-B is of stock class CLS-B, not CLS-A'
    );
    expectRefused(
      book('SPLIT-A-LATE'),
      'split_reference',
      'Stock reissuance REISS-S split SPLIT-A-LATE is dated after the reissuance'
    );
    expectRefused(book('SH-B'), 'split_reference', 'Stock reissuance REISS-S split transaction not found: SH-B');
    expectRefused(
      replayBook(
        stockClass('CLS-B'),
        split('SPLIT-A', 'CLS-A', '2', '1', '2025-06-01'),
        reissuance('REISS-X', 'S-A1', ['S-A1-B'], date, 'SPLIT-A'),
        issuance('S-A1-B', 'SH-A', 'CLS-B', '80', date)
      ),
      'class',
      "reissuance REISS-X names a split, so its resulting securities stay in the source's class"
    );
  });
});

describe('replayOcf: vesting records (TestVestingStart.daml, TestVestingAcceleration.daml)', () => {
  const terms = vestingTerms('VT-S');
  const lot = issuance('S-V', 'SH-A', 'CLS-A', '100', D2024, { vesting_terms_id: 'VT-S' });

  it('replays a backdated vesting start as an event that keeps the last event date', () => {
    const result = replayBook(
      terms,
      lot,
      acceptance('ACC-1', 'S-V', '2024-06-01'),
      vestingStart('VS-1', 'S-V', '2024-01-15')
    );
    expectClean(result);
    expect(result.states.get('S-V')).toEqual(expect.objectContaining({ seq: 2, last_event_date: '2024-06-01' }));
  });

  it('replays a vesting start dated before its issuance after it', () => {
    const result = replayBook(terms, lot, vestingStart('VS-0', 'S-V', '2023-12-01'));
    expectClean(result);
    expect(result.states.get('S-V')).toEqual(expect.objectContaining({ seq: 1, last_event_date: D2024 }));
    const written = result.steps.flatMap((step) => step.recordIds);
    expect(written.indexOf('ISS-S-V')).toBeLessThan(written.indexOf('VS-0'));
  });

  it('refuses a vesting record on a retired stock security', () => {
    expectRefused(
      replayBook(terms, lot, retraction('RET-1', 'S-V', '2024-02-01'), vestingStart('VS-1', 'S-V', '2024-03-01')),
      'reference',
      'Vesting record (no stock state in this write) security S-V is carried by a OcfObjectTypeTxStockIssuance'
    );
  });

  it('moves accelerated shares forward from the earliest later tranches, then from the uncovered', () => {
    const result = replayBook(
      issuance('S-T1', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [tranche('50', D2024), tranche('50', '2026-01-01')],
      }),
      issuance('S-T2', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [tranche('50', D2024), tranche('20', '2026-01-01')],
      }),
      issuance('S-T3', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [
          tranche('25', D2024),
          tranche('25', '2025-01-01'),
          tranche('25', '2026-01-01'),
          tranche('25', '2027-01-01'),
        ],
      }),
      acceleration('ACC-1', 'S-T1', '10', D2024),
      acceleration('ACC-2', 'S-T2', '40'),
      acceleration('ACC-3', 'S-T3', '30', '2024-06-01'),
      acceleration('ACC-4', 'S-T3', '46', '2024-06-01'),
      acceleration('ACC-5', 'S-T3', '45', '2024-06-02')
    );
    expect(rulesOf(result)).toEqual(['vesting']);
    expect(result.violations[0]?.message).toBe(
      'acceleration of 46.0 on security S-T3 must be positive and at most its unvested quantity 45.0'
    );
    const tranchesOf = (securityId: string): unknown => result.states.get(securityId)?.vesting;
    expect(tranchesOf('S-T1')).toEqual({
      kind: 'tranches',
      tranches: [
        { date: D2024, amount: '60' },
        { date: '2026-01-01', amount: '40' },
      ],
    });
    expect(tranchesOf('S-T2')).toEqual({
      kind: 'tranches',
      tranches: [
        { date: D2024, amount: '50' },
        { date: '2025-01-01', amount: '40' },
      ],
    });
    expect(tranchesOf('S-T3')).toEqual({
      kind: 'tranches',
      tranches: [
        { date: D2024, amount: '25' },
        { date: '2024-06-01', amount: '30' },
        { date: '2024-06-02', amount: '45' },
      ],
    });
  });

  it('accelerates a stock lot written in the same day after its issuance', () => {
    const result = replayBook(
      acceleration('ACC-2', 'S-NEW', '10', D2024),
      issuance('S-NEW', 'SH-A', 'CLS-A', '100', D2024, {
        vestings: [tranche('50', D2024), tranche('50', '2026-01-01')],
      })
    );
    expectClean(result);
  });
});

describe('replayOcf: consolidations (TestStockConsolidation.daml)', () => {
  const issued = '2022-01-01';
  const lots = (...entries: Array<[string, string]>): OcfJson[] =>
    entries.map(([securityId, quantity]) => ({
      ...issuance(securityId, 'SH-A', 'CLS-A', quantity, issued),
      id: `TX_STOCK_ISS_${securityId}`,
    }));
  const result = (id: string, securityId: string, date: string, quantity: string): OcfJson => ({
    ...issuance(securityId, 'SH-A', 'CLS-A', quantity, date),
    id,
  });

  it('consolidates two holdings into one certificate', () => {
    const date = '2025-04-15';
    const replay = replayBook(
      ...lots(['SSEC-001A', '25000'], ['SSEC-001B', '25000']),
      consolidation('TX_STOCK_CONSOLIDATION_1', ['SSEC-001A', 'SSEC-001B'], 'SSEC-001-CONSOLIDATED', date),
      result('STOCK-ISS-CONSOLIDATION-1', 'SSEC-001-CONSOLIDATED', date, '50000')
    );
    expectClean(replay);
    expect(replay.states.get('SSEC-001-CONSOLIDATED')).toEqual(
      expect.objectContaining({
        quantity: '50000',
        stakeholder_id: 'SH-A',
        origin_transaction_id: 'STOCK-ISS-CONSOLIDATION-1',
        last_event_date: date,
      })
    );
    expect([replay.retired.get('SSEC-001A')?.recordId, replay.retired.get('SSEC-001B')?.recordId]).toEqual([
      'TX_STOCK_CONSOLIDATION_1',
      'TX_STOCK_CONSOLIDATION_1',
    ]);
    expect(lastStep(replay)?.operation).toEqual(
      expect.objectContaining({
        kind: 'stockConsolidation',
        resultingIssuance: expect.objectContaining({ id: 'STOCK-ISS-CONSOLIDATION-1' }) as unknown,
      })
    );
  });

  it.each([
    [
      'a result that is not the sum',
      ['SSEC-A', 'SSEC-B'],
      'SSEC-ALL',
      '29',
      'conservation',
      'consolidation CONS-1 must yield the sum of its inputs',
    ],
    [
      'a repeated security',
      ['SSEC-A', 'SSEC-A'],
      'SSEC-ALL',
      '20',
      'resulting_securities',
      'a consolidation names each security once',
    ],
    ['two classes', ['SSEC-A', 'SSEC-C'], 'SSEC-ALL', '15', 'class', "a consolidation's securities share one class"],
    [
      'two stakeholders',
      ['SSEC-A', 'SSEC-D'],
      'SSEC-ALL',
      '15',
      'class',
      "a consolidation's securities share one stakeholder",
    ],
    [
      'a missing security',
      ['SSEC-A', 'SSEC-NONE'],
      'SSEC-ALL',
      '30',
      'missing_state',
      'no active state for security SSEC-NONE',
    ],
    ['no security', [], 'SSEC-ALL', '30', 'resulting_securities', 'a consolidation needs at least one security'],
    [
      'more than 50 securities',
      Array.from({ length: 51 }, (_, i) => `SSEC-${i}`),
      'SSEC-ALL',
      '30',
      'resulting_securities',
      'a consolidation takes at most 50 securities',
    ],
  ])('refuses %s', (_case, securityIds: string[], resultingId, quantity, rule, message) => {
    const date = '2025-08-01';
    const replay = replayBook(
      stockClass('CLS-B'),
      ...lots(['SSEC-A', '10'], ['SSEC-B', '20']),
      { ...issuance('SSEC-C', 'SH-A', 'CLS-B', '5', issued), id: 'ISS-SSEC-C' },
      { ...issuance('SSEC-D', 'SH-B', 'CLS-A', '5', issued), id: 'ISS-SSEC-D' },
      consolidation('CONS-1', securityIds, resultingId, date),
      result('ISS-ALL', resultingId, date, quantity)
    );
    expect(replay.violations[0]).toEqual(expect.objectContaining({ rule, message }));
    expect(replay.states.has('SSEC-A')).toBe(true);
  });

  it('refuses a result that is not its resulting security, or leaves the class or stakeholder', () => {
    const date = '2025-08-01';
    const book = (...records: OcfJson[]): ReplayResult =>
      replayBook(
        stockClass('CLS-B'),
        ...lots(['SSEC-A', '10'], ['SSEC-B', '20']),
        consolidation('CONS-1', ['SSEC-A', 'SSEC-B'], 'SSEC-ALL', date),
        ...records
      );
    expectRefused(
      book(result('ISS-ALL', 'SSEC-OTHER', date, '30')),
      'resulting_securities',
      'consolidation CONS-1 must write its resulting security SSEC-ALL'
    );
    expectRefused(
      book({ ...result('ISS-ALL', 'SSEC-ALL', date, '30'), stock_class_id: 'CLS-B' }),
      'class',
      "a consolidation's resulting security stays in its inputs' class"
    );
    expectRefused(
      book({ ...result('ISS-ALL', 'SSEC-ALL', date, '30'), stakeholder_id: 'SH-B' }),
      'class',
      "a consolidation's resulting security stays with its inputs' stakeholder"
    );
    expectRefused(
      replayBook(
        ...lots(['SSEC-A', '10']),
        consolidation('CONS-1', ['SSEC-A'], 'SSEC-ALL', '2021-12-31'),
        result('ISS-ALL', 'SSEC-ALL', '2021-12-31', '10')
      ),
      'date_order',
      'precedes the last event on security SSEC-A'
    );
  });

  it('retires every source, so no later event of the day uses it', () => {
    const date = '2025-08-01';
    const replay = replayBook(
      ...lots(['SSEC-1', '100']),
      consolidation('CONS-1', ['SSEC-1'], 'SSEC-RESULT', date),
      result('ISS-RESULT', 'SSEC-RESULT', date, '100'),
      cancellation('CXL-1', 'SSEC-1', '1', null, date)
    );
    expectRefused(replay, 'missing_state', 'no active state for security SSEC-1');
    expect(quantityOf(replay, 'SSEC-RESULT')).toBe('100');
  });
});

describe('replayOcf: a book read from the ledger', () => {
  it('replays the manifest of a key index to the states the index holds', () => {
    const index = baseBook({ last_event_date: '2024-02-01', seq: 1 })
      .record('stockAcceptance', stockAcceptance('ACC-1', 'S-A1'))
      .record('stockIssuance', bookIssuance({ id: 'ISS-A2', security_id: 'S-A2', quantity: '300', date: '2024-03-01' }))
      .record(
        'stockTransfer',
        stockTransfer({
          id: 'TR-2',
          date: '2024-04-01',
          security_id: 'S-A2',
          quantity: '300',
          resulting_security_ids: ['S-B2'],
        })
      )
      .record(
        'stockIssuance',
        bookIssuance({ id: 'ISS-B2', security_id: 'S-B2', stakeholder_id: 'SH-B', quantity: '300', date: '2024-04-01' })
      )
      .state(
        stockState({
          security_id: 'S-B2',
          issue_date: '2024-04-01',
          last_event_date: '2024-04-01',
          origin_transaction_id: 'ISS-B2',
          quantity: '300',
          stakeholder_id: 'SH-B',
        })
      )
      .index();
    const result = replayOcf(buildOcfManifest(index), { capTableId: CONTEXT.cap_table_id });
    expectClean(result);
    const ledgerStates = [...index.states()].map(({ state }) => {
      const { context: _context, ...expected } = state;
      return expected;
    });
    expect([...result.states.values()]).toEqual(expect.arrayContaining(ledgerStates));
    expect(result.states.size).toBe(ledgerStates.length);
    expect(result.retired.get('S-A2')?.recordId).toBe('TR-2');
  });
});

describe('replayOcf: definitions and records with no state', () => {
  it('needs a class for a stock issuance', () => {
    expectRefused(
      replayBook(issuance('S-X', 'SH-A', 'CLS-NONE', '1', D2024)),
      'missing_class',
      'no active epoch for stock class CLS-NONE'
    );
  });

  it('refuses a security ID used twice, across instruments', () => {
    expectRefused(
      replayBook({
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'WI-1',
        custom_id: 'W-1',
        date: D2024,
        security_id: 'S-A1',
        stakeholder_id: 'SH-A',
        purchase_price: { amount: '1', currency: 'USD' },
        exercise_triggers: [],
        security_law_exemptions: [],
      }),
      'claimed_id',
      'security ID already used: S-A1'
    );
  });

  it('refuses a stock state the ledger would not create', () => {
    expectRefused(
      replayBook(issuance('S-0', 'SH-A', 'CLS-A', '0', D2024)),
      'state_invariant',
      'must hold a positive quantity'
    );
    expectRefused(
      replayBook(issuance('S-V', 'SH-A', 'CLS-A', '10', D2024, { vestings: [tranche('11', D2024)] })),
      'state_invariant',
      'total 11.0, more than its quantity 10.0'
    );
  });

  it('writes the issuer with the cap table and every definition through Apply', () => {
    const result = replayBook();
    expect(result.steps.map((step) => step.kind)).toEqual(['issuer', 'apply', 'apply', 'apply', 'apply', 'apply']);
    expect(result.steps[0]).toEqual(expect.objectContaining({ operation: null, recordIds: ['ISSUER-1'], date: null }));
    expect(result.steps[1]?.operation).toEqual(
      expect.objectContaining({
        kind: 'record',
        type: 'stakeholder',
        data: expect.objectContaining({ id: 'SH-A' }) as unknown,
      })
    );
  });

  it('reports a record it cannot read and goes on', () => {
    const result = replayOcf(
      manifestOf([
        stakeholder('SH-A'),
        stockClass('CLS-A'),
        { object_type: 'TX_STOCK_ACCEPTANCE', id: 'ACC-NODATE', security_id: 'S-A1' },
        { object_type: 'TX_UNKNOWN', id: 'X-1', date: D2024 },
        { ...issuance('S-A1', 'SH-A', 'CLS-A', 'many', D2024) },
        issuance('S-A2', 'SH-A', 'CLS-A', '400', D2024),
      ])
    );
    expect(result.violations.map((violation) => [violation.rule, violation.recordIds])).toEqual([
      ['malformed_record', ['ACC-NODATE']],
      ['malformed_record', ['X-1']],
      ['malformed_record', ['ISS-S-A1']],
    ]);
    expect(result.violations[2]?.message).toBe(
      'TX_STOCK_ISSUANCE ISS-S-A1: quantity must be a decimal string that fits a Daml Decimal'
    );
    expect(quantityOf(result, 'S-A2')).toBe('400');
  });
});

void manifestOf;
