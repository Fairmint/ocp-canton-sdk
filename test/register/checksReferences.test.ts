import { writeViolations } from '../../src/register/checks/write';
import { RegisterIndex } from '../../src/register/registerIndex';
import type { OcfStockClass, OcfStockClassConversionRatioAdjustment, OcfVestingEvent } from '../../src/types/native';
import type { BookWrite, RestateOperation } from '../../src/types/register';
import { CONTEXT, stakeholder, stockClass, stockPlan, stockState, TestBook, vestingTerms } from './bookFixtures';
import { ceilingBook, CHECKS, issue, option, rulesOf, usd, warrant } from './checkFixtures';

function restate(...operations: RestateOperation[]): BookWrite {
  return { kind: 'restate', operations };
}

function vestingEvent(id: string, securityId: string, conditionId: string): OcfVestingEvent {
  return {
    object_type: 'TX_VESTING_EVENT',
    id,
    date: '2025-01-01',
    security_id: securityId,
    vesting_condition_id: conditionId,
  };
}

/** CLS-P converts to CLS-A by a ratio. */
function preferred(conversionRights: OcfStockClass['conversion_rights']): OcfStockClass {
  return { ...stockClass('CLS-P'), class_type: 'PREFERRED', conversion_rights: conversionRights };
}

const RATIO_RIGHT: OcfStockClass['conversion_rights'] = [
  {
    type: 'STOCK_CLASS_CONVERSION_RIGHT',
    converts_to_stock_class_id: 'CLS-A',
    conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      ratio: { numerator: '1', denominator: '1' },
      conversion_price: usd('1'),
      rounding_type: 'NORMAL',
    },
  },
];

function ratioAdjustment(id: string): OcfStockClassConversionRatioAdjustment {
  return {
    object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
    id,
    date: '2025-06-15',
    stock_class_id: 'CLS-P',
    new_ratio_conversion_mechanism: {
      type: 'RATIO_CONVERSION',
      conversion_price: usd('1'),
      ratio: { numerator: '11', denominator: '10' },
      rounding_type: 'FLOOR',
    },
  };
}

describe('checks: orphaned references', () => {
  it('refuses removing a class from a plan with grants in it', () => {
    const index = ceilingBook()
      .record('stockClass', stockClass('CLS-B'))
      .epoch('CLS-B')
      .record('stockPlan', stockPlan('P-1', ['CLS-A', 'CLS-B']))
      .record('equityCompensationIssuance', option('EC-1', '10', { stock_plan_id: 'P-1', stock_class_id: 'CLS-B' }))
      .index();
    const edit = (classes: [string, ...string[]]): BookWrite =>
      restate({ kind: 'edit', type: 'stockPlan', data: { ...stockPlan('P-1', classes), plan_name: 'Renamed plan' } });

    expect(writeViolations(index, edit(['CLS-A', 'CLS-B']), CHECKS)).toEqual([]);
    expect(writeViolations(index, edit(['CLS-A']), CHECKS)).toEqual([
      {
        check: 'references',
        rule: 'orphaned_reference',
        message:
          'TX_EQUITY_COMPENSATION_ISSUANCE ECI-EC-1 would be left with a broken reference: Equity compensation stock ' +
          'plan P-1 does not include stock class CLS-B',
        subject: 'P-1',
        operation: 0,
        recordIds: ['P-1', 'ECI-EC-1'],
      },
    ]);
  });

  it('refuses dropping a vesting condition that a vesting record names', () => {
    const index = ceilingBook()
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
      .record('vestingEvent', vestingEvent('VE-1', 'S-V1', 'milestone'))
      .index();
    const terms = vestingTerms('VT-1');
    const [start] = terms.vesting_conditions;
    const dropped = restate({
      kind: 'edit',
      type: 'vestingTerms',
      data: { ...terms, vesting_conditions: [{ ...start, next_condition_ids: [] }] },
    });

    expect(
      writeViolations(
        index,
        restate({ kind: 'edit', type: 'vestingTerms', data: { ...terms, name: 'Renamed' } }),
        CHECKS
      )
    ).toEqual([]);
    expect(writeViolations(index, dropped, CHECKS)).toEqual([
      expect.objectContaining({
        rule: 'orphaned_reference',
        subject: 'VT-1',
        recordIds: ['VT-1', 'VE-1'],
        message: expect.stringContaining(
          'Vesting event VE-1 references missing vesting condition milestone for security S-V1'
        ),
      }),
    ]);
  });

  it('refuses dropping the ratio conversion right a ratio adjustment needs', () => {
    const index = ceilingBook()
      .record('stockClass', preferred(RATIO_RIGHT))
      .epoch('CLS-P')
      .record('stockClassConversionRatioAdjustment', ratioAdjustment('RADJ-1'))
      .index();

    expect(writeViolations(index, restate({ kind: 'edit', type: 'stockClass', data: preferred([]) }), CHECKS)).toEqual([
      expect.objectContaining({
        rule: 'orphaned_reference',
        subject: 'CLS-P',
        recordIds: ['CLS-P', 'RADJ-1'],
        message: expect.stringContaining('targets a stock class without a ratio conversion right: CLS-P'),
      }),
    ]);
  });

  it('refuses deleting a stakeholder who still holds anything, or a stock class with stock in it', () => {
    const index = ceilingBook().record('stockClass', stockClass('CLS-B')).epoch('CLS-B').index();

    expect(rulesOf(writeViolations(index, restate({ kind: 'delete', objectId: 'SH-A' }), CHECKS))).toEqual([
      'orphaned_reference',
      'stakeholder_holds',
    ]);
    expect(writeViolations(index, restate({ kind: 'delete', objectId: 'SH-A' }), CHECKS)[1]).toEqual({
      check: 'references',
      rule: 'stakeholder_holds',
      message:
        'Stakeholder SH-A still holds 1 outstanding stock securities (S-A1): end or move them before deleting it',
      subject: 'SH-A',
      operation: 0,
      recordIds: ['SH-A'],
    });
    expect(rulesOf(writeViolations(index, restate({ kind: 'delete', objectId: 'CLS-A' }), CHECKS))).toEqual([
      'orphaned_reference',
      'class_has_stock',
    ]);
    expect(writeViolations(index, restate({ kind: 'delete', objectId: 'SH-B' }), CHECKS)).toEqual([]);
    expect(writeViolations(index, restate({ kind: 'delete', objectId: 'CLS-B' }), CHECKS)).toEqual([]);
  });

  it('lets a restatement delete a definition together with the records that point at it', () => {
    const index = ceilingBook()
      .record('warrantIssuance', warrant('W-1', { stakeholder_id: 'SH-B' }))
      .index();

    expect(rulesOf(writeViolations(index, restate({ kind: 'delete', objectId: 'SH-B' }), CHECKS))).toEqual([
      'orphaned_reference',
    ]);
    expect(
      writeViolations(
        index,
        restate({ kind: 'delete', objectId: 'WI-W-1' }, { kind: 'delete', objectId: 'SH-B' }),
        CHECKS
      )
    ).toEqual([]);
  });

  it('leaves Apply writes to the ledger: they create, and orphan nothing', () => {
    const index = ceilingBook().index();
    const write: BookWrite = {
      kind: 'apply',
      operations: [{ kind: 'record', type: 'stakeholder', data: stakeholder('SH-C') }],
    };
    expect(writeViolations(index, write, CHECKS)).toEqual([]);
  });
});

describe('RegisterIndex: the records pointing at a definition', () => {
  function book(): RegisterIndex {
    return ceilingBook()
      .record('vestingTerms', vestingTerms('VT-1'))
      .record('stockIssuance', issue('S-V1', '5', '2024-01-01', { vesting_terms_id: 'VT-1', stakeholder_id: 'SH-B' }))
      .record('vestingEvent', vestingEvent('VE-1', 'S-V1', 'milestone'))
      .record('stockPlan', stockPlan('P-1', ['CLS-A']))
      .record('equityCompensationIssuance', option('EC-1', '10', { stock_plan_id: 'P-1' }))
      .index();
  }

  const ids = (index: RegisterIndex, objectId: string): string[] =>
    index
      .referrersOf(objectId)
      .map((record) => record.objectId)
      .sort();

  it('finds referrers by object ID, through an issuance’s security and through vesting terms', () => {
    const index = book();
    expect(ids(index, 'SH-A')).toEqual(['ECI-EC-1', 'ISS-A1']);
    expect(ids(index, 'CLS-A')).toEqual(['ECI-EC-1', 'ISS-A1', 'ISS-S-V1', 'P-1']);
    expect(ids(index, 'P-1')).toEqual(['ECI-EC-1']);
    expect(ids(index, 'ISS-S-V1')).toEqual(['VE-1']);
    expect(ids(index, 'VT-1')).toEqual(['ISS-S-V1', 'VE-1']);
    expect(ids(index, 'VE-1')).toEqual([]);
  });

  it('keeps the reverse references current as records come and go', () => {
    const index = book();
    expect(ids(index, 'SH-B')).toEqual(['ISS-S-V1']);
    index.remove('cid-ISS-S-V1');
    expect(ids(index, 'SH-B')).toEqual([]);
    expect(ids(index, 'VT-1')).toEqual([]);
    const other = new TestBook()
      .record('stockIssuance', issue('S-V2', '1', '2024-01-01', { stakeholder_id: 'SH-B' }))
      .index();
    const [added] = other.recordsOf('stockIssuance');
    if (added === undefined) throw new Error('no issuance');
    index.add({ kind: 'record', context: CONTEXT, contract: added });
    expect(ids(index, 'SH-B')).toEqual(['ISS-S-V2']);
  });

  it('refuses to answer without record data, or with records whose references it cannot read', () => {
    const lean = new RegisterIndex({ context: CONTEXT, offset: 1, retainPayloads: false });
    expect(() => lean.referrersOf('SH-A')).toThrow(
      expect.objectContaining({ classification: 'register_payload_required' })
    );

    const index = book();
    const [broken] = new TestBook()
      .record('stakeholder', { ...stakeholder('SH-Z'), name: 7 } as never)
      .index()
      .records();
    if (broken === undefined) throw new Error('no record');
    index.add({ kind: 'record', context: CONTEXT, contract: broken });
    expect(() => index.referrersOf('SH-A')).toThrow(
      expect.objectContaining({
        classification: 'register_references_unknown',
        message: expect.stringContaining('SH-Z'),
      })
    );
  });

  it('lists the records naming a security and the states of a class', () => {
    const index = book();
    expect(index.recordsNaming('S-V1').map((record) => record.objectId)).toEqual(['ISS-S-V1', 'VE-1']);
    expect(index.statesOfClass('CLS-A').map((state) => state.state.security_id)).toEqual(['S-A1']);
    expect(index.statesOfClass('CLS-B')).toEqual([]);
    index.remove('state-S-A1');
    expect(index.statesOfClass('CLS-A')).toEqual([]);
  });
});
