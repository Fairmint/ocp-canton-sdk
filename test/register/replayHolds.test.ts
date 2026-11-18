/**
 * The replay of an extended export, which holds the register's own writes: holds and their cancellations
 * (`CapTable_PlaceHolds`, `CapTable_CancelHolds`) and a settlement's draws (`CapTable_Settle`), all under derived IDs,
 * replayed as the ledger wrote them (`TestHolds.daml`, `TestSettlement.daml`, `TestSplits.daml`).
 */

import { replayOcf } from '../../src/register/replay/replay';
import type { ReplayResult } from '../../src/types/register';
import {
  CAP_TABLE_ID,
  derived,
  issuance,
  lastStep,
  replayBook,
  rulesOf,
  split,
  standardBook,
  transfer,
  type OcfJson,
} from './replayFixtures';

const TRADE_DAY = '2025-06-02';

function hold(securityId: string, seq: number, reference: string, quantity: string | null, date = TRADE_DAY): OcfJson {
  return {
    object_type: 'TX_STOCK_HOLD',
    id: derived(securityId, seq, 'hold'),
    date,
    hold_type: quantity === null ? 'STOP_TRANSFER' : 'REGISTER_SETTLEMENT',
    reason_text: `test hold ${reference}`,
    reference,
    security_id: securityId,
    ...(quantity === null ? {} : { quantity }),
  };
}

function holdCancellation(securityId: string, seq: number, holdId: string, reason: string, date = TRADE_DAY): OcfJson {
  return {
    object_type: 'TX_STOCK_HOLD_CANCELLATION',
    id: derived(securityId, seq, 'hold_cancellation'),
    date,
    hold_id: holdId,
    reason_text: reason,
    security_id: securityId,
  };
}

/** A settlement's draw of `quantity` from a lot at `seq`, with the buyer's issuance and the balance the ledger writes. */
function draw(securityId: string, seq: number, quantity: string, lotQuantity: string, date = TRADE_DAY): OcfJson[] {
  const remaining = String(Number(lotQuantity) - Number(quantity));
  const buyerSecurity = derived(securityId, seq, 'resulting_security');
  const balanceSecurity = remaining === '0' ? null : derived(securityId, seq, 'balance_security');
  return [
    transfer(derived(securityId, seq, 'event'), securityId, quantity, [buyerSecurity], balanceSecurity, date),
    { ...issuance(buyerSecurity, 'SH-B', 'CLS-A', quantity, date), id: derived(securityId, seq, 'resulting_issuance') },
    ...(balanceSecurity === null
      ? []
      : [
          {
            ...issuance(balanceSecurity, 'SH-A', 'CLS-A', remaining, date),
            id: derived(securityId, seq, 'balance_issuance'),
          },
        ]),
  ];
}

function expectClean(result: ReplayResult): void {
  expect(result.violations).toEqual([]);
}

describe('replayOcf: the hold pair and settlements (extended export)', () => {
  it('replays a settlement hold and its draw, with the delivery on the buyer’s state', () => {
    const settlementHold = hold('S-A1', 0, 'T-1', '100');
    const result = replayBook(settlementHold, ...draw('S-A1', 1, '100', '600'));
    expectClean(result);
    const transferId = derived('S-A1', 1, 'event');
    const buyer = result.states.get(derived('S-A1', 1, 'resulting_security'));
    expect(buyer).toEqual(
      expect.objectContaining({
        quantity: '100',
        stakeholder_id: 'SH-B',
        seq: 0,
        delivery: { reference: 'T-1', seller_stakeholder_id: 'SH-A', transfer_id: transferId },
      })
    );
    expect(result.states.get(derived('S-A1', 1, 'balance_security'))?.quantity).toBe('500');
    expect(result.retired.get('S-A1')?.lastState).toEqual(
      expect.objectContaining({
        seq: 1,
        derived_ids: true,
        holds: [
          {
            hold_id: settlementHold['id'],
            hold_type: 'REGISTER_SETTLEMENT',
            reference: 'T-1',
            split_epoch: 0,
            quantity: '100',
          },
        ],
      })
    );
    const [holdStep, drawStep] = result.steps.slice(-2);
    expect([holdStep?.kind, holdStep?.operation, holdStep?.derivedForm]).toEqual(['hold', null, true]);
    expect([drawStep?.kind, drawStep?.operation, drawStep?.derivedForm, drawStep?.recordIds[0]]).toEqual([
      'draw',
      null,
      true,
      transferId,
    ]);
  });

  it('replays a stop that cancels the settlement hold, with its companion cancellation', () => {
    const settlementHold = hold('S-A1', 0, 'T-1', '100');
    const stop = hold('S-A1', 1, 'CASE-1', null, '2025-06-03');
    const companion = holdCancellation(
      'S-A1',
      1,
      String(settlementHold['id']),
      'Canceled by stop CASE-1: test hold CASE-1',
      '2025-06-03'
    );
    const result = replayBook(settlementHold, companion, stop);
    expectClean(result);
    const state = result.states.get('S-A1');
    expect(state?.seq).toBe(2);
    expect(state?.holds.map((open) => [open.hold_id, open.hold_type])).toEqual([[stop['id'], 'STOP_TRANSFER']]);
    expect(lastStep(result)).toEqual(
      expect.objectContaining({ kind: 'hold', recordIds: [stop['id'], companion['id']] })
    );
    // Without its companion the stop cannot be the ledger's.
    expect(rulesOf(replayBook(settlementHold, stop))).toEqual(['hold']);
  });

  it('refuses a terminal Apply event on a held lot, and a stopped lot’s settlement hold', () => {
    const result = replayBook(
      hold('S-A1', 0, 'CASE-1', null),
      transfer('TR-1', 'S-A1', '600', ['S-B1'], null, TRADE_DAY),
      issuance('S-B1', 'SH-B', 'CLS-A', '600', TRADE_DAY),
      hold('S-A1', 1, 'T-1', '100', '2025-06-03')
    );
    expect(result.violations.map((violation) => [violation.rule, violation.message])).toEqual([
      ['held', 'security S-A1 carries an open hold; the TA must cancel or lift it first'],
      ['hold', 'security S-A1 is stopped'],
    ]);
  });

  it('refuses a draw under a hold a later split voided, and cancels it to place a new one', () => {
    const settlementHold = hold('S-A1', 0, 'T-1', '100', '2025-01-05');
    const splitRecord = split('SPLIT-1', 'CLS-A', '2', '1', '2025-01-10');
    const voided = replayBook(settlementHold, splitRecord, ...draw('S-A1', 1, '100', '1200', '2025-01-12'));
    expect(voided.violations[0]).toEqual(
      expect.objectContaining({
        rule: 'hold',
        message: `a split of the class voided hold ${String(settlementHold['id'])}`,
      })
    );
    const replaced = replayBook(
      settlementHold,
      splitRecord,
      hold('S-A1', 2, 'T-2', '200', '2025-01-12'),
      holdCancellation('S-A1', 1, String(settlementHold['id']), 'voided by SPLIT-1', '2025-01-12')
    );
    expectClean(replaced);
    expect(replaced.states.get('S-A1')).toEqual(
      expect.objectContaining({
        quantity: '1200',
        split_epoch: 1,
        seq: 3,
        holds: [expect.objectContaining({ reference: 'T-2', split_epoch: 1, quantity: '200' })],
      })
    );
  });

  it('replays two trades on one lot in one day in the order the ledger derived their IDs', () => {
    const first = hold('S-A1', 0, 'T-1', '100');
    const records = [
      hold('S-A1', 2, 'T-2', '50'),
      ...draw('S-A1', 3, '50', '600'),
      holdCancellation('S-A1', 1, String(first['id']), 'trade T-1 released'),
      first,
    ];
    const result = replayBook(...records);
    expectClean(result);
    expect(result.retired.get('S-A1')?.recordId).toBe(derived('S-A1', 3, 'event'));
    expect(result.states.get(derived('S-A1', 3, 'balance_security'))?.quantity).toBe('550');
    expect(result.steps.slice(-4).map((step) => step.kind)).toEqual(['hold', 'holdCancellation', 'hold', 'draw']);
  });

  it('reads a transfer on a held lot as its draw without a cap table ID', () => {
    const result = replayOcf(standardBook(hold('S-A1', 0, 'T-1', '600'), ...draw('S-A1', 1, '600', '600')));
    expectClean(result);
    expect(lastStep(result)?.kind).toBe('draw');
    expect(lastStep(result)?.derivedForm).toBe(false);
  });

  it.each([
    ['more than the hold', '150', 'draw of 150.0 must be positive and at most hold'],
    ['nothing', '0', 'draw of 0.0 must be positive'],
  ])('refuses a draw of %s', (_case, quantity, message) => {
    const result = replayBook(hold('S-A1', 0, 'T-1', '100'), ...draw('S-A1', 1, quantity, '600'));
    expect(result.violations[0]).toEqual(
      expect.objectContaining({ rule: 'hold', message: expect.stringContaining(message) as unknown })
    );
  });

  it('refuses a draw the ledger would not have written', () => {
    const settlementHold = hold('S-A1', 0, 'T-1', '100');
    const [drawTransfer, buyer, balance] = draw('S-A1', 1, '100', '600');
    expect(
      replayBook(settlementHold, drawTransfer ?? {}, { ...buyer, stakeholder_id: 'SH-A' }, balance ?? {}).violations[0]
        ?.message
    ).toBe('the buyer and the seller are the same stakeholder');
    expect(
      replayBook(
        settlementHold,
        drawTransfer ?? {},
        { ...buyer, vestings: [{ date: TRADE_DAY, amount: '100' }] },
        balance ?? {}
      ).violations[0]?.message
    ).toBe(`the buyer issuance ${String(buyer?.['id'])} of a settlement carries no vesting`);
    const trancheLot = {
      ...issuance('S-T', 'SH-A', 'CLS-A', '100', '2024-01-01'),
      vestings: [
        { date: '2024-01-01', amount: '60' },
        { date: '2030-01-01', amount: '40' },
      ],
    };
    const [trancheDraw, trancheBuyer, trancheBalance] = draw('S-T', 1, '50', '100');
    expect(
      replayBook(trancheLot, hold('S-T', 0, 'T-2', '50'), trancheDraw ?? {}, trancheBuyer ?? {}, {
        ...trancheBalance,
        vestings: [{ date: '2030-01-01', amount: '50' }],
      }).violations[0]?.message
    ).toBe(`balance ${String(trancheBalance?.['id'])} must keep the tranches the draw leaves on security S-T`);
    expect(
      replayBook(trancheLot, hold('S-T', 0, 'T-2', '50'), trancheDraw ?? {}, trancheBuyer ?? {}, {
        ...trancheBalance,
        vestings: [
          { date: '2024-01-01', amount: '10' },
          { date: '2030-01-01', amount: '40' },
        ],
      }).violations
    ).toEqual([]);
  });

  it('refuses a hold the hold rules refuse', () => {
    expect(replayBook(hold('S-A1', 0, 'T-1', '700')).violations.map((violation) => violation.message)).toEqual([
      'settlement hold of 700.0 on security S-A1 must be positive and at most its vested 600.0',
    ]);
    expect(
      replayBook(hold('S-A1', 0, 'T-1', '100'), hold('S-A1', 1, 'T-1', '100', '2025-06-03')).violations[0]?.message
    ).toBe('reference T-1 is already open on security S-A1');
    expect(
      replayBook(hold('S-A1', 0, 'T-1', '100'), hold('S-A1', 1, 'T-2', '100', '2025-06-03')).violations[0]?.message
    ).toBe('security S-A1 already carries a settlement hold');
    expect(rulesOf(replayBook({ ...hold('S-A1', 0, 'T-1', '100'), hold_type: 'MAYBE' }))).toEqual(['malformed_record']);
    expect(replayBook(holdCancellation('S-A1', 0, 'H-NONE', 'none open')).violations[0]?.message).toBe(
      'hold H-NONE is not open on security S-A1'
    );
    expect(replayBook({ ...hold('S-A1', 0, 'T-1', '100'), id: 'HOLD-1' }).violations[0]?.message).toBe(
      `TX_STOCK_HOLD HOLD-1 is not the register's: its ID lacks this cap table's derived form`
    );
    expect(CAP_TABLE_ID).toBe('test-1');
  });
});
