import { checkWrite, writeViolations } from '../../src/register/checks/write';
import type { ApplyOperation, BookWrite } from '../../src/types/register';
import { stockState, stockTransfer, vestingStart, vestingTerms } from './bookFixtures';
import { ceilingBook, CHECKS, issue, rulesOf, TODAY, warrant, warrantExercise } from './checkFixtures';

const TOMORROW = '2026-10-24';

function apply(...operations: ApplyOperation[]): BookWrite {
  return { kind: 'apply', operations };
}

describe('checks: the ledger date', () => {
  it('refuses a stock issuance dated after the ledger date, and takes one dated on it', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' }).index();
    const issuance = (date: string): BookWrite =>
      apply({ kind: 'record', type: 'stockIssuance', data: issue('S-N1', '1', date) });

    expect(writeViolations(index, issuance(TODAY), CHECKS)).toEqual([]);
    expect(writeViolations(index, issuance(TOMORROW), CHECKS)).toEqual([
      {
        check: 'dates',
        rule: 'future_dated',
        message:
          'TX_STOCK_ISSUANCE ISS-S-N1 is dated 2026-10-24, after the ledger date 2026-10-23: stock security S-N1 ' +
          'would take no hold, stop or draw until then',
        subject: 'S-N1',
        operation: 0,
        recordIds: ['ISS-S-N1'],
      },
    ]);
  });

  it('refuses a future-dated event once, not once per output issuance', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' }).index();
    const transfer: ApplyOperation = {
      kind: 'stockTransfer',
      transfer: stockTransfer({ date: TOMORROW, quantity: '90', resulting_security_ids: ['S-B1'] }),
      resulting: [issue('S-B1', '90', TOMORROW, { stakeholder_id: 'SH-B' })],
    };

    expect(writeViolations(index, apply(transfer), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'future_dated', subject: 'S-A1', operation: 0, recordIds: ['TR-1'] }),
    ]);
  });

  it('refuses vesting records and snapshots on a stock lot dated after the ledger date, not records of other instruments', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' })
      .record('vestingTerms', vestingTerms('VT-1'))
      .record('stockIssuance', issue('S-V1', '5', '2024-01-01', { vesting_terms_id: 'VT-1' }))
      .state(
        stockState({
          security_id: 'S-V1',
          origin_transaction_id: 'ISS-S-V1',
          quantity: '5',
          vesting: { kind: 'on_terms', vesting_terms_id: 'VT-1' },
        })
      )
      .record('warrantIssuance', warrant('W-1', { vesting_terms_id: 'VT-1' }))
      .index();
    const start = (securityId: string): BookWrite =>
      apply({
        kind: 'record',
        type: 'vestingStart',
        data: { ...vestingStart(`VS-${securityId}`, securityId), date: TOMORROW },
      });

    expect(rulesOf(writeViolations(index, start('S-V1'), CHECKS))).toEqual(['future_dated']);
    expect(writeViolations(index, start('W-1'), CHECKS)).toEqual([]);

    const snapshot = apply({ kind: 'vestingSnapshot', securityId: 'S-A1', asOf: TOMORROW, vested: '10' });
    expect(writeViolations(index, snapshot, { ...CHECKS, instruments: false, ceilings: false })).toEqual([
      expect.objectContaining({
        rule: 'future_dated',
        subject: 'S-A1',
        message: expect.stringContaining('The vesting snapshot of S-A1'),
      }),
    ]);
  });

  it('takes a future-dated warrant exercise, which blocks no lot', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' }).record('warrantIssuance', warrant('W-1')).index();
    const write = apply(
      { kind: 'record', type: 'warrantExercise', data: warrantExercise('WEX-1', 'W-1', TOMORROW, ['S-W1']) },
      { kind: 'record', type: 'stockIssuance', data: issue('S-W1', '10', TODAY) }
    );
    expect(writeViolations(index, write, CHECKS)).toEqual([]);
  });

  it('refuses a restated state or a hold cancellation dated after the ledger date', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' }).index();
    const restated = (date: string): BookWrite => ({
      kind: 'restate',
      operations: [
        {
          kind: 'setState',
          state: {
            security_id: 'S-A1',
            issue_date: '2024-01-01',
            last_event_date: date,
            origin_transaction_id: 'ISS-A1',
            quantity: '90',
            stakeholder_id: 'SH-A',
            stock_class_id: 'CLS-A',
            vesting: { kind: 'none' },
            snapshot: null,
            accelerated_since_snapshot: null,
          },
        },
      ],
    });
    expect(writeViolations(index, restated(TODAY), CHECKS)).toEqual([]);
    expect(writeViolations(index, restated(TOMORROW), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'future_dated', message: expect.stringContaining('The restated state of S-A1') }),
    ]);

    const cancel = (date: string): BookWrite => ({
      kind: 'cancelHolds',
      date,
      holds: [{ security_id: 'S-A1', hold_id: 'HOLD-1', reason_text: 'Trade abandoned' }],
    });
    expect(writeViolations(index, cancel(TODAY), CHECKS)).toEqual([]);
    expect(writeViolations(index, cancel(TOMORROW), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'future_dated', subject: 'S-A1', operation: 0, recordIds: ['HOLD-1'] }),
    ]);
    expect(() => checkWrite(index, cancel(TOMORROW), CHECKS)).toThrow(
      expect.objectContaining({ classification: 'future_dated', fieldPath: 'holds[0]' })
    );
  });

  it('runs only the checks selected, and refuses a malformed ledger date', () => {
    const index = ceilingBook().index();
    const issuance = apply({ kind: 'record', type: 'stockIssuance', data: issue('S-N1', '20', TOMORROW) });

    expect(rulesOf(writeViolations(index, issuance, CHECKS))).toEqual(['future_dated', 'class_ceiling']);
    expect(rulesOf(writeViolations(index, issuance, { ...CHECKS, dates: false }))).toEqual(['class_ceiling']);
    expect(
      writeViolations(index, issuance, {
        today: TODAY,
        dates: false,
        ceilings: false,
        references: false,
        instruments: false,
      })
    ).toEqual([]);
    expect(() => writeViolations(index, issuance, { today: '2026-10-23T00:00:00Z' })).toThrow('Expected a Daml Date');
  });
});
