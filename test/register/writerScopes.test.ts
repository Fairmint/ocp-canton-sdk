import { RegisterIndex } from '../../src/register/registerIndex';
import { writeScopes } from '../../src/register/writerScopes';
import type { OcfEquityCompensationIssuance, OcfIssuer } from '../../src/types/native';
import type { ApplyOperation, BookWrite, RestateOperation, ScopedLock } from '../../src/types/register';
import {
  baseBook,
  stakeholder,
  stockClass,
  stockClassSplit,
  stockIssuance,
  stockPlan,
  stockState,
  stockTransfer,
  type TestBook,
  vestingTerms,
  warrantIssuance,
} from './bookFixtures';

const ISSUER_SHARED: ScopedLock = { scope: 'issuer', mode: 'shared' };
const ISSUER_EXCLUSIVE: ScopedLock = { scope: 'issuer', mode: 'exclusive' };

function exclusive(...scopes: string[]): ScopedLock[] {
  return scopes.map((scope) => ({ scope, mode: 'exclusive' }) as ScopedLock);
}

function equityCompensation(overrides: Partial<OcfEquityCompensationIssuance> = {}): OcfEquityCompensationIssuance {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'EC-1',
    date: '2024-02-01',
    security_id: 'EC-S1',
    custom_id: 'EC-1',
    stakeholder_id: 'SH-B',
    stock_plan_id: 'PLAN-1',
    stock_class_id: 'CLS-A',
    compensation_type: 'OPTION',
    quantity: '100',
    exercise_price: { amount: '1', currency: 'USD' },
    security_law_exemptions: [],
    expiration_date: null,
    termination_exercise_windows: [],
    ...overrides,
  };
}

const ISSUER: OcfIssuer = {
  object_type: 'ISSUER',
  id: 'ISSUER-1',
  legal_name: 'Issuer Inc.',
  formation_date: '2020-01-01',
  country_of_formation: 'US',
};

/** The base book with a second class, a plan, vesting terms behind a lot, a warrant and an option. */
function book(issuer: OcfIssuer | null = null): TestBook {
  const built = baseBook()
    .record('stockClass', stockClass('CLS-B'))
    .epoch('CLS-B')
    .record('stockPlan', stockPlan('PLAN-1', ['CLS-A']))
    .record('vestingTerms', vestingTerms('VT-1'))
    .record('stockIssuance', stockIssuance({ id: 'ISS-A3', security_id: 'S-A3', vesting_terms_id: 'VT-1' }))
    .state(stockState({ security_id: 'S-A3', origin_transaction_id: 'ISS-A3' }))
    .record('warrantIssuance', warrantIssuance('W-1', 'W-S1'))
    .record('equityCompensationIssuance', equityCompensation());
  return issuer === null ? built : built.record('issuer', issuer);
}

function apply(...operations: ApplyOperation[]): BookWrite {
  return { kind: 'apply', operations };
}

function restate(...operations: RestateOperation[]): BookWrite {
  return { kind: 'restate', operations };
}

describe('writeScopes: CapTable_Apply', () => {
  const index = book().index();

  it('locks the class of a primary issuance, and its plan for plan stock, with the issuer shared', () => {
    const issuance = stockIssuance({ id: 'ISS-B1', security_id: 'S-B9', stock_class_id: 'CLS-B' });
    expect(writeScopes(index, apply({ kind: 'record', type: 'stockIssuance', data: issuance }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-B'),
    ]);
    const planStock = { ...issuance, stock_plan_id: 'PLAN-1' };
    expect(writeScopes(index, apply({ kind: 'record', type: 'stockIssuance', data: planStock }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-B', 'plan:PLAN-1'),
    ]);
  });

  it("locks a stock event's source class and every output's class", () => {
    const transfer = stockTransfer({ resulting_security_ids: ['S-B1'] });
    const toBuyer = stockIssuance({ id: 'ISS-B1', security_id: 'S-B1', stakeholder_id: 'SH-B' });
    expect(writeScopes(index, apply({ kind: 'stockTransfer', transfer, resulting: [toBuyer] }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A'),
    ]);
    const conversion = {
      object_type: 'TX_STOCK_CONVERSION' as const,
      id: 'CONV-1',
      date: '2024-03-01',
      security_id: 'S-A1',
      quantity_converted: '600',
      resulting_security_ids: ['S-C1'],
    };
    const converted = stockIssuance({ id: 'ISS-C1', security_id: 'S-C1', stock_class_id: 'CLS-B' });
    expect(writeScopes(index, apply({ kind: 'stockConversion', conversion, resulting: [converted] }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A', 'class:CLS-B'),
    ]);
  });

  it('locks a security created earlier in the same batch by its class', () => {
    const issuance = stockIssuance({ id: 'ISS-B2', security_id: 'S-B2', stock_class_id: 'CLS-B' });
    const acceptance = {
      object_type: 'TX_STOCK_ACCEPTANCE' as const,
      id: 'ACC-1',
      date: '2024-02-01',
      security_id: 'S-B2',
    };
    expect(
      writeScopes(
        index,
        apply(
          { kind: 'record', type: 'stockIssuance', data: issuance },
          { kind: 'record', type: 'stockAcceptance', data: acceptance }
        )
      )
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-B')]);
  });

  it('locks the instrument of a warrant event, and the plan too for equity compensation', () => {
    const exercise = {
      object_type: 'TX_WARRANT_EXERCISE' as const,
      id: 'WEX-1',
      date: '2024-04-01',
      security_id: 'W-S1',
      trigger_id: 'T-1',
      resulting_security_ids: [],
    };
    expect(writeScopes(index, apply({ kind: 'record', type: 'warrantExercise', data: exercise }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('instrument:W-S1'),
    ]);
    const optionExercise = {
      object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' as const,
      id: 'ECX-1',
      date: '2024-04-01',
      security_id: 'EC-S1',
      quantity: '10',
      resulting_security_ids: [],
    };
    expect(
      writeScopes(index, apply({ kind: 'record', type: 'equityCompensationExercise', data: optionExercise }))
    ).toEqual([ISSUER_SHARED, ...exclusive('instrument:EC-S1', 'plan:PLAN-1')]);
    expect(
      writeScopes(
        index,
        apply({
          kind: 'record',
          type: 'equityCompensationIssuance',
          data: equityCompensation({ id: 'EC-2', security_id: 'EC-S2' }),
        })
      )
    ).toEqual([ISSUER_SHARED, ...exclusive('instrument:EC-S2', 'plan:PLAN-1')]);
  });

  it('locks a plan for plan-level records and a class for class-level ones', () => {
    const poolAdjustment = {
      object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT' as const,
      id: 'POOL-1',
      date: '2024-05-01',
      stock_plan_id: 'PLAN-1',
      shares_reserved: '2000000',
    };
    expect(
      writeScopes(
        index,
        apply(
          { kind: 'record', type: 'stockPlanPoolAdjustment', data: poolAdjustment },
          { kind: 'record', type: 'stockPlan', data: stockPlan('PLAN-2', ['CLS-B']) },
          { kind: 'record', type: 'stockClassSplit', data: stockClassSplit('SPLIT-1', 'CLS-A', '2024-06-01') }
        )
      )
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A', 'plan:PLAN-1', 'plan:PLAN-2')]);
  });

  it('locks the classes of cancellations, repurchases, reissuances and consolidations with their outputs', () => {
    const balance = stockIssuance({ id: 'ISS-A9', security_id: 'S-A9', quantity: '100' });
    const cancellation = {
      object_type: 'TX_STOCK_CANCELLATION' as const,
      id: 'CAN-1',
      date: '2024-03-01',
      security_id: 'S-A1',
      quantity: '500',
      balance_security_id: 'S-A9',
      reason_text: 'Forfeited',
    };
    const repurchase = {
      object_type: 'TX_STOCK_REPURCHASE' as const,
      id: 'REP-1',
      date: '2024-03-01',
      security_id: 'S-A3',
      quantity: '600',
      price: { amount: '1', currency: 'USD' },
    };
    const reissuance = {
      object_type: 'TX_STOCK_REISSUANCE' as const,
      id: 'REI-1',
      date: '2024-03-01',
      security_id: 'S-A1',
      resulting_security_ids: ['S-B5'],
    };
    const consolidation = {
      object_type: 'TX_STOCK_CONSOLIDATION' as const,
      id: 'CON-1',
      date: '2024-03-01',
      security_ids: ['S-A1', 'S-A3'],
      resulting_security_id: 'S-A7',
    };
    expect(
      writeScopes(
        index,
        apply(
          { kind: 'stockCancellation', cancellation, balance },
          { kind: 'stockRepurchase', repurchase, balance: null },
          {
            kind: 'stockReissuance',
            reissuance,
            resulting: [stockIssuance({ id: 'ISS-B5', security_id: 'S-B5', stock_class_id: 'CLS-B' })],
          },
          {
            kind: 'stockConsolidation',
            consolidation,
            resultingIssuance: stockIssuance({ id: 'ISS-A7', security_id: 'S-A7', quantity: '1200' }),
          }
        )
      )
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A', 'class:CLS-B')]);
  });

  it('locks an unknown security as an instrument, and the whole book when the index holds no payloads', () => {
    expect(
      writeScopes(index, apply({ kind: 'vestingSnapshot', securityId: 'S-NONE', asOf: '2024-06-01', vested: '1' }))
    ).toEqual([ISSUER_SHARED, ...exclusive('instrument:S-NONE')]);
    const keysOnly = new RegisterIndex({ context: index.context, offset: 1, retainPayloads: false });
    for (const record of index.records()) keysOnly.add({ kind: 'record', context: index.context, contract: record });
    const issuance = stockIssuance({ id: 'ISS-B1', security_id: 'S-B9', stock_class_id: 'CLS-B' });
    expect(writeScopes(keysOnly, apply({ kind: 'record', type: 'stockIssuance', data: issuance }))).toEqual([
      ISSUER_EXCLUSIVE,
      ...exclusive('class:CLS-B'),
    ]);
    expect(writeScopes(keysOnly, restate({ kind: 'edit', type: 'stakeholder', data: stakeholder('SH-B') }))).toEqual([
      ISSUER_EXCLUSIVE,
    ]);
  });

  it('locks nothing narrower for definitions, snapshots lock their lot and pre-splits nothing', () => {
    expect(
      writeScopes(
        index,
        apply(
          { kind: 'record', type: 'stakeholder', data: stakeholder('SH-C') },
          { kind: 'preSplitShard', prefix: '00000000' }
        )
      )
    ).toEqual([ISSUER_SHARED]);
    expect(
      writeScopes(index, apply({ kind: 'vestingSnapshot', securityId: 'S-A3', asOf: '2024-06-01', vested: '100' }))
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A')]);
  });

  it('locks the whole book for issuer-level records', () => {
    const adjustment = {
      object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT' as const,
      id: 'IAS-1',
      date: '2024-05-01',
      issuer_id: 'ISSUER-1',
      new_shares_authorized: '1000000',
    };
    expect(
      writeScopes(index, apply({ kind: 'record', type: 'issuerAuthorizedSharesAdjustment', data: adjustment }))
    ).toEqual([ISSUER_EXCLUSIVE]);
  });

  it("locks the whole book for a write that can raise outstanding shares while the issuer's are finite", () => {
    const bounded = book({ ...ISSUER, initial_shares_authorized: '1000000' }).index();
    const issuance = stockIssuance({ id: 'ISS-B1', security_id: 'S-B9', stock_class_id: 'CLS-B' });
    expect(writeScopes(bounded, apply({ kind: 'record', type: 'stockIssuance', data: issuance }))).toEqual([
      ISSUER_EXCLUSIVE,
      ...exclusive('class:CLS-B'),
    ]);
    const transfer = stockTransfer({ resulting_security_ids: ['S-B1'] });
    const toBuyer = stockIssuance({ id: 'ISS-B1', security_id: 'S-B1', stakeholder_id: 'SH-B' });
    expect(writeScopes(bounded, apply({ kind: 'stockTransfer', transfer, resulting: [toBuyer] }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A'),
    ]);
    const unlimited = book({ ...ISSUER, initial_shares_authorized: 'UNLIMITED' }).index();
    expect(writeScopes(unlimited, apply({ kind: 'record', type: 'stockIssuance', data: issuance }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-B'),
    ]);
  });
});

describe('writeScopes: CapTable_Restate and the hold choices', () => {
  const index = book().index();

  it('locks the scopes of every live record that points at an edited definition', () => {
    expect(writeScopes(index, restate({ kind: 'edit', type: 'vestingTerms', data: vestingTerms('VT-1') }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A'),
    ]);
    expect(
      writeScopes(index, restate({ kind: 'edit', type: 'stockPlan', data: stockPlan('PLAN-1', ['CLS-A', 'CLS-B']) }))
    ).toEqual([ISSUER_SHARED, ...exclusive('instrument:EC-S1', 'plan:PLAN-1')]);
  });

  it("locks a restated lot's class before and after the edit", () => {
    const moved = stockIssuance({ stock_class_id: 'CLS-B' });
    expect(writeScopes(index, restate({ kind: 'edit', type: 'stockIssuance', data: moved }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A', 'class:CLS-B'),
    ]);
    const state = {
      security_id: 'S-A1',
      issue_date: '2024-01-01',
      last_event_date: '2024-01-01',
      origin_transaction_id: 'ISS-A1',
      quantity: '600',
      stakeholder_id: 'SH-A',
      stock_class_id: 'CLS-B',
      vesting: { kind: 'none' as const },
      snapshot: null,
      accelerated_since_snapshot: null,
    };
    expect(writeScopes(index, restate({ kind: 'setState', state }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A', 'class:CLS-B'),
    ]);
    expect(writeScopes(index, restate({ kind: 'endState', securityId: 'S-A1' }))).toEqual([
      ISSUER_SHARED,
      ...exclusive('class:CLS-A'),
    ]);
  });

  it('locks the whole book for a delete, an issuer edit, and an edit the index cannot see into', () => {
    expect(writeScopes(index, restate({ kind: 'delete', objectId: 'SH-B' }))).toEqual([ISSUER_EXCLUSIVE]);
    expect(writeScopes(index, restate({ kind: 'edit', type: 'issuer', data: ISSUER }))).toEqual([ISSUER_EXCLUSIVE]);
    expect(writeScopes(index, restate({ kind: 'edit', type: 'stockClass', data: stockClass('SH-B') }))).toEqual([
      ISSUER_EXCLUSIVE,
    ]);
  });

  it('locks the lots of holds and settlements', () => {
    expect(
      writeScopes(index, {
        kind: 'placeHolds',
        holdType: 'STOP_TRANSFER',
        reference: 'STOP-1',
        date: '2024-06-01',
        reasonText: 'Court order',
        lots: [{ security_id: 'S-A1' }],
      })
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A')]);
    expect(
      writeScopes(index, {
        kind: 'cancelHolds',
        date: '2024-06-01',
        holds: [{ security_id: 'S-A3', hold_id: 'H-1', reason_text: 'Released' }],
      })
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A')]);
    expect(
      writeScopes(index, {
        kind: 'settle',
        settlementId: 'T-1',
        date: '2024-06-01',
        buyer: { kind: 'existingStakeholder', stakeholderId: 'SH-B' },
        lots: [{ kind: 'cancel', hold: { security_id: 'S-A1', hold_id: 'H-2', reason_text: 'undrawn' } }],
      })
    ).toEqual([ISSUER_SHARED, ...exclusive('class:CLS-A')]);
  });
});
