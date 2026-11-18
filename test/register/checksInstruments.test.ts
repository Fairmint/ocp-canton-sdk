import { writeViolations } from '../../src/register/checks/write';
import type { OcfWarrantAcceptance } from '../../src/types/native';
import type { ApplyOperation, BookWrite } from '../../src/types/register';
import { stockClassSplit, stockPlan, stockState } from './bookFixtures';
import {
  ceilingBook,
  CHECKS,
  issue,
  option,
  optionCancellation,
  optionExercise,
  repricing,
  rulesOf,
  warrant,
  warrantExercise,
} from './checkFixtures';
import { split } from './registerFixtures';

function apply(...operations: ApplyOperation[]): BookWrite {
  return { kind: 'apply', operations };
}

/** A warrant W-1 exercised on 2025-03-01 into S-W1 (100 shares, in a class without a ceiling). */
function exercisedWarrantBook() {
  return ceilingBook({ authorized: 'UNLIMITED' })
    .record('warrantIssuance', warrant('W-1'))
    .record('warrantExercise', warrantExercise('WEX-1', 'W-1', '2025-03-01', ['S-W1']))
    .record('stockIssuance', issue('S-W1', '100', '2025-03-01'))
    .state(
      stockState({
        security_id: 'S-W1',
        origin_transaction_id: 'ISS-S-W1',
        quantity: '100',
        last_event_date: '2025-03-01',
      })
    );
}

function exerciseOf(id: string, date: string, resulting: string): ApplyOperation[] {
  return [
    { kind: 'record', type: 'warrantExercise', data: warrantExercise(id, 'W-1', date, [resulting]) },
    { kind: 'record', type: 'stockIssuance', data: issue(resulting, '100', date) },
  ];
}

describe('checks: warrant and convertible lifecycle', () => {
  it('refuses a second exercise of a warrant, whatever its date', () => {
    const index = exercisedWarrantBook().index();

    for (const date of ['2025-04-01', '2025-02-01']) {
      expect(writeViolations(index, apply(...exerciseOf('WEX-2', date, 'S-W2')), CHECKS)).toEqual([
        {
          check: 'instruments',
          rule: 'after_retirement',
          message:
            'Warrant exercise WEX-2 on security W-1 comes after it was retired by TX_WARRANT_EXERCISE WEX-1 (2025-03-01)',
          subject: 'W-1',
          operation: 0,
          recordIds: ['WEX-2'],
        },
      ]);
    }
  });

  it('passes the first exercise, and refuses one after the expiration date', () => {
    const book = (expiration: string) =>
      ceilingBook({ authorized: 'UNLIMITED' }).record(
        'warrantIssuance',
        warrant('W-1', { warrant_expiration_date: expiration })
      );
    const write = apply(...exerciseOf('WEX-1', '2025-06-01', 'S-W1'));

    expect(writeViolations(book('2030-01-01').index(), write, CHECKS)).toEqual([]);
    expect(writeViolations(book('2025-05-31').index(), write, CHECKS)).toEqual([
      expect.objectContaining({
        rule: 'after_expiration',
        message: 'Warrant exercise WEX-1 is dated 2025-06-01, after the expiration date 2025-05-31 of security W-1',
      }),
    ]);
  });

  it('fits a warrant’s cancellation to its quantity', () => {
    const index = ceilingBook({ authorized: 'UNLIMITED' }).record('warrantIssuance', warrant('W-1')).index();
    const cancel = (quantity: string): BookWrite =>
      apply({
        kind: 'record',
        type: 'warrantCancellation',
        data: {
          object_type: 'TX_WARRANT_CANCELLATION',
          id: 'WC-1',
          date: '2025-01-01',
          security_id: 'W-1',
          quantity,
          reason_text: 'Expired',
        },
      });

    expect(writeViolations(index, cancel('1000'), CHECKS)).toEqual([]);
    expect(writeViolations(index, cancel('1500'), CHECKS)).toEqual([
      expect.objectContaining({
        rule: 'exceeds_remaining',
        message: 'Warrant cancellation WC-1 of 1500 exceeds the 1000 remaining of security W-1',
      }),
    ]);
  });

  it('takes an acceptance dated before the retirement, and records the book already broke do not refuse a write', () => {
    // The book already holds a second exercise; an acceptance backdated before the first is a new, valid record.
    const index = exercisedWarrantBook()
      .record('warrantExercise', warrantExercise('WEX-2', 'W-1', '2025-04-01', ['S-W1']))
      .index();
    const acceptance = (date: string): BookWrite =>
      apply({
        kind: 'record',
        type: 'warrantAcceptance',
        data: {
          object_type: 'TX_WARRANT_ACCEPTANCE',
          id: 'WACC-1',
          date,
          security_id: 'W-1',
        } satisfies OcfWarrantAcceptance,
      });

    expect(writeViolations(index, acceptance('2024-06-01'), CHECKS)).toEqual([]);
    expect(writeViolations(index, acceptance('2025-03-01'), CHECKS)).toEqual([]);
    expect(rulesOf(writeViolations(index, acceptance('2025-03-02'), CHECKS))).toEqual(['after_retirement']);
    expect(rulesOf(writeViolations(index, apply(...exerciseOf('WEX-3', '2025-05-01', 'S-W3')), CHECKS))).toEqual([
      'after_retirement',
    ]);
  });
});

describe('checks: equity compensation lifecycle', () => {
  /** Option EC-1 for 100 shares of CLS-A, 30 of them exercised on 2024-06-01. */
  function optionBook() {
    return ceilingBook({ authorized: 'UNLIMITED' })
      .record('equityCompensationIssuance', option('EC-1', '100'))
      .record('equityCompensationExercise', optionExercise('EX-1', 'EC-1', '30', '2024-06-01'));
  }

  const exercise = (id: string, quantity: string, date = '2025-06-01'): BookWrite =>
    apply({ kind: 'record', type: 'equityCompensationExercise', data: optionExercise(id, 'EC-1', quantity, date) });

  it('fits exercises to the remaining quantity', () => {
    const index = optionBook().index();

    expect(writeViolations(index, exercise('EX-2', '70'), CHECKS)).toEqual([]);
    expect(writeViolations(index, exercise('EX-2', '71'), CHECKS)).toEqual([
      {
        check: 'instruments',
        rule: 'exceeds_remaining',
        message: 'Equity compensation exercise EX-2 of 71 exceeds the 70 remaining of security EC-1',
        subject: 'EC-1',
        operation: 0,
        recordIds: ['EX-2'],
      },
    ]);
    expect(rulesOf(writeViolations(index, exercise('EX-2', '10', '2030-01-02'), CHECKS))).toEqual(['after_expiration']);
  });

  it('refuses a repricing after a cancellation retired the grant, not one dated before it', () => {
    const index = optionBook()
      .record('equityCompensationCancellation', optionCancellation('CAN-1', 'EC-1', '70', '2025-01-01'))
      .index();
    const reprice = (date: string): BookWrite =>
      apply({ kind: 'record', type: 'equityCompensationRepricing', data: repricing('REP-1', 'EC-1', date) });

    expect(writeViolations(index, reprice('2024-12-01'), CHECKS)).toEqual([]);
    expect(writeViolations(index, reprice('2025-06-01'), CHECKS)).toEqual([
      expect.objectContaining({
        rule: 'after_retirement',
        message:
          'Equity compensation repricing REP-1 on security EC-1 comes after it was retired by ' +
          'TX_EQUITY_COMPENSATION_CANCELLATION CAN-1 (2025-01-01)',
      }),
    ]);
    expect(rulesOf(writeViolations(index, exercise('EX-2', '1', '2024-12-01'), CHECKS))).toEqual(['after_retirement']);
  });

  it('steps a grant’s remaining quantity through its class’s splits', () => {
    // EC-1 was granted 100 pre-split shares; after a 2-for-1 split on 2025-01-01, 140 remain in post-split units.
    const book = optionBook()
      .record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2025-01-01'))
      .epoch('CLS-A', { splits: [split('SPLIT-1', '2025-01-01', '2', '1')] }, 'epoch-CLS-A-split');
    const index = book.index();
    index.remove('epoch-CLS-A');

    expect(writeViolations(index, exercise('EX-2', '140'), CHECKS)).toEqual([]);
    expect(writeViolations(index, exercise('EX-2', '141'), CHECKS)).toEqual([
      expect.objectContaining({
        message: 'Equity compensation exercise EX-2 of 141 exceeds the 140 remaining of security EC-1',
      }),
    ]);
  });

  it('compares a new record dated before the history’s last split in the units it is compared in', () => {
    // After the split, 20 post-split shares were exercised on 2025-06-01: 120 remain. A backdated pre-split exercise of
    // 60 is 120 in those units.
    const book = optionBook()
      .record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2025-01-01'))
      .epoch('CLS-A', { splits: [split('SPLIT-1', '2025-01-01', '2', '1')] }, 'epoch-CLS-A-split')
      .record('equityCompensationExercise', optionExercise('EX-2', 'EC-1', '20', '2025-06-01'));
    const index = book.index();
    index.remove('epoch-CLS-A');

    expect(writeViolations(index, exercise('EX-3', '60', '2024-12-01'), CHECKS)).toEqual([]);
    expect(writeViolations(index, exercise('EX-3', '61', '2024-12-01'), CHECKS)).toEqual([
      expect.objectContaining({
        message:
          'Equity compensation exercise EX-3 of 61 (122 in the units of 2025-06-01) exceeds the 120 remaining of ' +
          'security EC-1',
      }),
    ]);
  });

  it('reads a grant that names no class in its plan’s only class', () => {
    const { stock_class_id: _stockClassId, ...planGrant } = option('EC-1', '100', { stock_plan_id: 'P-1' });
    const book = ceilingBook({ authorized: 'UNLIMITED' })
      .record('stockPlan', stockPlan('P-1', ['CLS-A']))
      .record('equityCompensationIssuance', planGrant)
      .record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2025-01-01'))
      .epoch('CLS-A', { splits: [split('SPLIT-1', '2025-01-01', '2', '1')] }, 'epoch-CLS-A-split');
    const index = book.index();
    index.remove('epoch-CLS-A');

    expect(writeViolations(index, exercise('EX-2', '200'), CHECKS)).toEqual([]);
    expect(rulesOf(writeViolations(index, exercise('EX-2', '201'), CHECKS))).toEqual(['exceeds_remaining']);
  });

  it('refuses to judge a write on a history it cannot read, naming the record', () => {
    // The write loads only the grant; the tracker reads every record on it.
    const index = ceilingBook({ authorized: 'UNLIMITED' })
      .record('equityCompensationIssuance', option('EC-1', '100'))
      .record('equityCompensationExercise', { ...optionExercise('EX-1', 'EC-1', '30', '2024-06-01'), quantity: 'many' })
      .index();
    const acceptance: BookWrite = apply({
      kind: 'record',
      type: 'equityCompensationAcceptance',
      data: { object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE', id: 'ACC-1', date: '2024-07-01', security_id: 'EC-1' },
    });

    expect(() => writeViolations(index, acceptance, CHECKS)).toThrow(
      expect.objectContaining({ classification: 'malformed_record', fieldPath: 'records.EX-1' })
    );
  });

  it('refuses a restatement that shrinks a grant below what was exercised', () => {
    const index = optionBook().index();
    const edit = (quantity: string): BookWrite => ({
      kind: 'restate',
      operations: [{ kind: 'edit', type: 'equityCompensationIssuance', data: option('EC-1', quantity) }],
    });

    expect(writeViolations(index, edit('30'), CHECKS)).toEqual([]);
    // The book's exercise is what breaks; the violation names the edit that breaks it first.
    expect(writeViolations(index, edit('29'), CHECKS)).toEqual([
      {
        check: 'instruments',
        rule: 'exceeds_remaining',
        message: 'Equity compensation exercise EX-1 of 30 exceeds the 29 remaining of security EC-1',
        subject: 'EC-1',
        operation: 0,
        recordIds: ['ECI-EC-1', 'EX-1'],
      },
    ]);
  });
});
