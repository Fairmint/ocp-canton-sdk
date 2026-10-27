import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { checkWrite, writeViolations } from '../../src/register/checks/write';
import type { OcfStockCancellation } from '../../src/types/native';
import type { ApplyOperation, BookWrite, RegisterCheckError } from '../../src/types/register';
import { stockClass, stockClassSplit, stockPlan, stockState } from './bookFixtures';
import {
  ceilingBook,
  CHECKS,
  classAdjustment,
  issue,
  issuerAdjustment,
  issuerRecord,
  option,
  optionCancellation,
  optionExercise,
  poolAdjustment,
  returnToPool,
  rulesOf,
  TODAY,
} from './checkFixtures';
import { split } from './registerFixtures';

function apply(...operations: ApplyOperation[]): BookWrite {
  return { kind: 'apply', operations };
}

function issuance(securityId: string, quantity: string, overrides: Parameters<typeof issue>[3] = {}): ApplyOperation {
  return { kind: 'record', type: 'stockIssuance', data: issue(securityId, quantity, TODAY, overrides) };
}

function cancellation(securityId: string, quantity: string, balance: string | null): OcfStockCancellation {
  return {
    object_type: 'TX_STOCK_CANCELLATION',
    id: `CAN-${securityId}`,
    date: TODAY,
    security_id: securityId,
    quantity,
    reason_text: 'Forfeited',
    ...(balance === null ? {} : { balance_security_id: balance }),
  };
}

describe('checks: class ceilings', () => {
  it('passes an issuance up to the authorized shares and refuses one over them', () => {
    const index = ceilingBook().index();

    expect(writeViolations(index, apply(issuance('S-N1', '10')), CHECKS)).toEqual([]);
    expect(writeViolations(index, apply(issuance('S-N1', '11')), CHECKS)).toEqual([
      {
        check: 'ceilings',
        rule: 'class_ceiling',
        message:
          'Stock class CLS-A would have 101 shares outstanding on 2026-10-23, over its 100 authorized shares (CLS-A)',
        subject: 'CLS-A',
        operation: 0,
        recordIds: ['ISS-S-N1'],
      },
    ]);
  });

  it('refuses with the first violation, its rule as classification and every violation attached', () => {
    const index = ceilingBook().index();
    const write = apply(issuance('S-N1', '6'), issuance('S-N2', '6', { stock_class_id: 'CLS-A' }));

    let caught: unknown;
    try {
      checkWrite(index, write, CHECKS);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OcpValidationError);
    const error = caught as RegisterCheckError;
    expect(error).toMatchObject({
      code: OcpErrorCodes.OUT_OF_RANGE,
      classification: 'class_ceiling',
      fieldPath: 'operations[0]',
    });
    expect(error.message).toContain('Stock class CLS-A would have 102 shares outstanding');
    expect(error.violations).toHaveLength(1);
    expect(Object.keys(error)).not.toContain('violations');
    expect(() => checkWrite(index, apply(issuance('S-N1', '10')), CHECKS)).not.toThrow();
  });

  it('reads the authorized shares of the latest adjustment dated on or before the write', () => {
    const raised = ceilingBook().record(
      'stockClassAuthorizedSharesAdjustment',
      classAdjustment('ADJ-1', 'CLS-A', '200', '2026-01-01')
    );
    expect(writeViolations(raised.index(), apply(issuance('S-N1', '110')), CHECKS)).toEqual([]);

    const later = ceilingBook().record(
      'stockClassAuthorizedSharesAdjustment',
      classAdjustment('ADJ-1', 'CLS-A', '200', '2026-12-01')
    );
    expect(rulesOf(writeViolations(later.index(), apply(issuance('S-N1', '11')), CHECKS))).toEqual(['class_ceiling']);

    // An adjustment in the same write counts; one that lowers the ceiling below the outstanding shares is refused.
    const index = ceilingBook().index();
    const adjustment = (shares: string): ApplyOperation => ({
      kind: 'record',
      type: 'stockClassAuthorizedSharesAdjustment',
      data: classAdjustment('ADJ-2', 'CLS-A', shares, TODAY),
    });
    expect(writeViolations(index, apply(adjustment('200'), issuance('S-N1', '110')), CHECKS)).toEqual([]);
    expect(writeViolations(index, apply(adjustment('80')), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'class_ceiling', operation: 0, recordIds: ['ADJ-2'] }),
    ]);
  });

  it('sets no ceiling for UNLIMITED or NOT APPLICABLE authorized shares', () => {
    for (const authorized of ['UNLIMITED', 'NOT APPLICABLE']) {
      const index = ceilingBook({ authorized }).index();
      expect(writeViolations(index, apply(issuance('S-N1', '1000000')), CHECKS)).toEqual([]);
    }
  });

  it('lets a book over its ceiling take what reduces the excess, and nothing that adds to it', () => {
    const index = ceilingBook({ quantity: '110' }).index();
    const cancel: ApplyOperation = {
      kind: 'stockCancellation',
      cancellation: cancellation('S-A1', '10', 'S-A2'),
      balance: issue('S-A2', '100', TODAY),
    };

    expect(writeViolations(index, apply(cancel), CHECKS)).toEqual([]);
    expect(writeViolations(index, apply(issuance('S-N1', '1')), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'class_ceiling', message: expect.stringContaining('111 shares outstanding') }),
    ]);
  });

  it('brings every state to the write’s units through the class’s splits', () => {
    // S-A1 holds 45 from before a 2-for-1 split: 90 in today's units.
    const book = ceilingBook({ quantity: '45' })
      .record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2025-01-01'))
      .epoch('CLS-A', { splits: [split('SPLIT-1', '2025-01-01', '2', '1')] }, 'epoch-CLS-A-split');
    const index = book.index();
    index.remove('epoch-CLS-A');

    expect(writeViolations(index, apply(issuance('S-N1', '10')), CHECKS)).toEqual([]);
    expect(writeViolations(index, apply(issuance('S-N1', '11')), CHECKS)).toEqual([
      expect.objectContaining({ message: expect.stringContaining('101 shares outstanding on 2026-10-23') }),
    ]);
  });

  it('refuses a restatement that lowers a class’s authorized shares below its outstanding shares', () => {
    const index = ceilingBook().index();
    const edit = (authorized: string): BookWrite => ({
      kind: 'restate',
      operations: [
        { kind: 'edit', type: 'stockClass', data: { ...stockClass('CLS-A'), initial_shares_authorized: authorized } },
      ],
    });

    expect(writeViolations(index, edit('90'), CHECKS)).toEqual([]);
    expect(writeViolations(index, edit('89'), CHECKS)).toEqual([
      expect.objectContaining({ rule: 'class_ceiling', subject: 'CLS-A', operation: 0, recordIds: ['CLS-A'] }),
    ]);
  });
});

describe('checks: the issuer’s authorized shares', () => {
  /** CLS-A holds 90 of 100 and CLS-B 50 of 100: 140 outstanding against the issuer's 150. */
  function issuerBook(authorized = '150') {
    return ceilingBook()
      .record('issuer', issuerRecord(authorized))
      .record('stockClass', { ...stockClass('CLS-B'), initial_shares_authorized: '100' })
      .epoch('CLS-B')
      .record('stockIssuance', issue('S-B1', '50', '2024-01-01', { stock_class_id: 'CLS-B' }))
      .state(
        stockState({ security_id: 'S-B1', origin_transaction_id: 'ISS-S-B1', quantity: '50', stock_class_id: 'CLS-B' })
      );
  }

  it('sums every class against the issuer’s ceiling', () => {
    const index = issuerBook().index();
    const inB = (quantity: string): BookWrite => apply(issuance('S-N1', quantity, { stock_class_id: 'CLS-B' }));

    expect(writeViolations(index, inB('10'), CHECKS)).toEqual([]);
    expect(writeViolations(index, inB('11'), CHECKS)).toEqual([
      {
        check: 'ceilings',
        rule: 'issuer_ceiling',
        message:
          'The issuer would have 151 shares outstanding in all classes on 2026-10-23, over its 150 authorized shares (ISSUER-1)',
        subject: 'ISSUER-1',
        operation: 0,
        recordIds: ['ISS-S-N1'],
      },
    ]);
  });

  it('reads the latest issuer adjustment, and sets no ceiling for NOT APPLICABLE', () => {
    const raised = issuerBook().record(
      'issuerAuthorizedSharesAdjustment',
      issuerAdjustment('IADJ-1', '300', '2025-06-01')
    );
    const write = apply(issuance('S-N1', '20', { stock_class_id: 'CLS-B' }));
    expect(writeViolations(raised.index(), write, CHECKS)).toEqual([]);
    expect(writeViolations(issuerBook('NOT APPLICABLE').index(), write, CHECKS)).toEqual([]);

    const lowered: BookWrite = {
      kind: 'apply',
      operations: [
        { kind: 'record', type: 'issuerAuthorizedSharesAdjustment', data: issuerAdjustment('IADJ-2', '139', TODAY) },
      ],
    };
    expect(rulesOf(writeViolations(issuerBook().index(), lowered, CHECKS))).toEqual(['issuer_ceiling']);
  });
});

describe('checks: plan pools', () => {
  /** Plan P-1 reserves 100 shares of CLS-A; grant EC-1 holds 60 of them. */
  function planBook() {
    return ceilingBook({ authorized: 'UNLIMITED' })
      .record('stockPlan', { ...stockPlan('P-1', ['CLS-A']), initial_shares_reserved: '100' })
      .record('equityCompensationIssuance', option('EC-1', '60', { stock_plan_id: 'P-1' }));
  }

  function grant(securityId: string, quantity: string, planId = 'P-1'): ApplyOperation {
    return {
      kind: 'record',
      type: 'equityCompensationIssuance',
      data: option(securityId, quantity, { stock_plan_id: planId, date: TODAY }),
    };
  }

  it('refuses grants over the pool', () => {
    const index = planBook().index();

    expect(writeViolations(index, apply(grant('EC-2', '40')), CHECKS)).toEqual([]);
    expect(writeViolations(index, apply(grant('EC-2', '41')), CHECKS)).toEqual([
      {
        check: 'ceilings',
        rule: 'plan_pool',
        message:
          'Stock plan P-1 would have 101 shares granted or issued from its pool on 2026-10-23, over its 100 shares reserved (P-1)',
        subject: 'P-1',
        operation: 0,
        recordIds: ['ECI-EC-2'],
      },
    ]);
  });

  it('counts exercised shares as plan stock, and frees what a cancellation retires', () => {
    const exercised = planBook()
      .record('equityCompensationExercise', optionExercise('EX-1', 'EC-1', '20', '2025-01-01', ['S-X1']))
      .record('stockIssuance', issue('S-X1', '20', '2025-01-01', { stock_plan_id: 'P-1' }))
      .state(
        stockState({
          security_id: 'S-X1',
          origin_transaction_id: 'ISS-S-X1',
          quantity: '20',
          last_event_date: '2025-01-01',
        })
      );
    const index = exercised.index();
    expect(writeViolations(index, apply(grant('EC-2', '40')), CHECKS)).toEqual([]);
    expect(rulesOf(writeViolations(index, apply(grant('EC-2', '41')), CHECKS))).toEqual(['plan_pool']);

    const canceled = planBook().record(
      'equityCompensationCancellation',
      optionCancellation('CAN-1', 'EC-1', '60', '2025-01-01')
    );
    expect(writeViolations(canceled.index(), apply(grant('EC-2', '100')), CHECKS)).toEqual([]);
  });

  it('reads the latest pool adjustment and the returns into the pool from other plans', () => {
    const adjusted = planBook().record('stockPlanPoolAdjustment', poolAdjustment('PADJ-1', 'P-1', '150', '2025-01-01'));
    expect(writeViolations(adjusted.index(), apply(grant('EC-2', '90')), CHECKS)).toEqual([]);

    // EC-9 of plan P-2, canceled, returns its 10 shares to P-1's pool.
    const returned = planBook()
      .record('stockPlan', { ...stockPlan('P-2', ['CLS-A']), initial_shares_reserved: '50' })
      .record('equityCompensationIssuance', option('EC-9', '10', { stock_plan_id: 'P-2' }))
      .record('equityCompensationCancellation', optionCancellation('CAN-9', 'EC-9', '10', '2025-02-01'))
      .record('stockPlanReturnToPool', returnToPool('RTP-1', 'EC-9', 'P-1', '10', '2025-02-01'))
      .index();
    expect(writeViolations(returned, apply(grant('EC-2', '50')), CHECKS)).toEqual([]);
    expect(rulesOf(writeViolations(returned, apply(grant('EC-2', '51')), CHECKS))).toEqual(['plan_pool']);
  });
});
