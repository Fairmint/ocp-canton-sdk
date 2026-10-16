/**
 * computeReplicationDiff on a Canton cap table with position registries: the diff never writes what the ledger's
 * root guard (validatePositionManagedWrites) rejects, never touches registry-written records or what they and the
 * positions reference, and reports every withheld operation with its reasons.
 */

import { OcpValidationError } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import type { CapTablePositionState } from '../../src/functions/OpenCapTable/positions/positionTypes';
import {
  computeReplicationDiff,
  type CantonOcfDataMap,
  type ReplicationDiff,
  type SourceReplicationItem,
} from '../../src/utils/replicationHelpers';

const CAP_TABLE = 'ct-1';

/** Required for a cap table with positions: the stakeholders of its open trades, here none. */
const NO_OPEN_TRADES = { protectedStakeholderIds: [] };

function positionState(overrides: Partial<CapTablePositionState> = {}): CapTablePositionState {
  return {
    enabled: true,
    registries: new Map([['CLASS-M', 'registry-cid']]),
    migratedSecurityIds: new Map([['S-MIG', 'SH-SELLER']]),
    capTableContractId: CAP_TABLE,
    offset: 7,
    positions: [],
    supersededStockIssuances: new Map([['ISS-MIG', 'S-MIG']]),
    registryRecords: new Map([
      ['stockIssuance', new Map([['T-ISS-B-0', 'iss-tb-cid']])],
      ['stockTransfer', new Map([['T-TR-0', 'tr-cid']])],
    ]),
    // The classes of the root issuances; T-B-0 is the buyer lot of a trade, issued by the registry.
    stockClassBySecurityId: new Map([
      ['S-MIG', 'CLASS-M'],
      ['S-FREE', 'CLASS-F'],
    ]),
    registrySecurityIds: new Set(['T-B-0']),
    referencedStakeholderIds: new Set(['SH-SELLER', 'SH-BUYER']),
    referencedObjectIds: new Map([
      ['stockLegendTemplate', new Set(['LEG-1'])],
      ['stockPlan', new Set<string>()],
      ['vestingTerms', new Set(['VT-1'])],
    ]),
    unattributedRecords: [],
    conflictingRecords: [],
    ...overrides,
  };
}

/** Canton records, as getCapTableState and extractCantonOcfManifest return them. */
const CANTON_RECORDS: Array<[OcfEntityType, Record<string, unknown>]> = [
  ['issuer', { id: 'ISSUER-OLD', legal_name: 'Old' }],
  ['stakeholder', { id: 'SH-SELLER', name: 'Seller' }],
  ['stakeholder', { id: 'SH-BUYER', name: 'Buyer' }],
  ['stakeholder', { id: 'SH-OLD', name: 'Former holder' }],
  ['stockClass', { id: 'CLASS-M', name: 'Managed' }],
  ['stockClass', { id: 'CLASS-F', name: 'Free' }],
  ['stockLegendTemplate', { id: 'LEG-1', name: 'Legend 1' }],
  ['stockLegendTemplate', { id: 'LEG-2', name: 'Legend 2' }],
  ['vestingTerms', { id: 'VT-1', name: 'Four years' }],
  [
    'stockIssuance',
    { id: 'ISS-MIG', security_id: 'S-MIG', stock_class_id: 'CLASS-M', stakeholder_id: 'SH-SELLER', quantity: '100' },
  ],
  [
    'stockIssuance',
    { id: 'ISS-FREE', security_id: 'S-FREE', stock_class_id: 'CLASS-F', stakeholder_id: 'SH-OLD', quantity: '10' },
  ],
  [
    'stockIssuance',
    { id: 'T-ISS-B-0', security_id: 'T-B-0', stock_class_id: 'CLASS-M', stakeholder_id: 'SH-BUYER', quantity: '60' },
  ],
  ['stockTransfer', { id: 'T-TR-0', security_id: 'S-MIG', resulting_security_ids: ['T-B-0'], quantity: '60' }],
  ['stockTransfer', { id: 'ROOT-TR', security_id: 'S-FREE', resulting_security_ids: ['S-FREE-2'], quantity: '1' }],
];

function cantonState(withPositionState = true, records = CANTON_RECORDS): CapTableState {
  const entities = new Map<OcfEntityType, Set<string>>();
  for (const [entityType, data] of records) {
    const ids = entities.get(entityType) ?? new Set<string>();
    ids.add(data.id as string);
    entities.set(entityType, ids);
  }
  return {
    capTableContractId: CAP_TABLE,
    issuerContractId: 'issuer-cid',
    entities,
    contractIds: new Map(),
    securityIds: new Map([['stockIssuance', new Set(['S-MIG', 'S-FREE', 'T-B-0'])]]),
    positionState: withPositionState ? positionState() : null,
  };
}

function cantonOcfData(records = CANTON_RECORDS): CantonOcfDataMap {
  const data: CantonOcfDataMap = new Map();
  for (const [entityType, record] of records) {
    const byId = data.get(entityType) ?? new Map<string, Record<string, unknown>>();
    byId.set(record.id as string, record);
    data.set(entityType, byId);
  }
  return data;
}

function unchanged(entityType: OcfEntityType, id: string): SourceReplicationItem {
  const record = CANTON_RECORDS.find(([type, data]) => type === entityType && data.id === id);
  if (record === undefined) throw new Error(`no Canton record ${entityType} ${id}`);
  return { entityType, data: record[1] };
}

function reasonsOf(diff: ReplicationDiff): Record<string, string[]> {
  return Object.fromEntries(
    (diff.skipped ?? []).map((item) => [
      `${item.operation} ${item.entityType} ${item.id}`,
      item.reasons.map((reason) => (reason.version ? `${reason.reason}/${reason.version}` : reason.reason)),
    ])
  );
}

function itemIds(items: ReplicationDiff['creates']): string[] {
  return items.map((item) => `${item.entityType} ${item.id}`);
}

describe('computeReplicationDiff position guard', () => {
  it('withholds every write the ledger guard or the position references forbid, and reports why', () => {
    const source: SourceReplicationItem[] = [
      // Issuer replacement (old issuer absent from the source).
      { entityType: 'issuer', data: { id: 'ISSUER-NEW', legal_name: 'New' } },
      // A stakeholder edit and delete that positions reference. SH-OLD is absent too, but the withheld ISS-FREE edit
      // keeps naming it.
      { entityType: 'stakeholder', data: { id: 'SH-SELLER', name: 'Renamed seller' } },
      unchanged('stockClass', 'CLASS-F'),
      // CLASS-M absent: deleting a managed class.
      unchanged('stockLegendTemplate', 'LEG-2'),
      // LEG-1 absent: a lot references it. VT-1 kept.
      unchanged('vestingTerms', 'VT-1'),
      // A migrated issuance edited in place.
      {
        entityType: 'stockIssuance',
        data: {
          id: 'ISS-MIG',
          security_id: 'S-MIG',
          stock_class_id: 'CLASS-M',
          stakeholder_id: 'SH-SELLER',
          quantity: '99',
        },
      },
      // An edit that moves a root issuance into the managed class. (The OCF comparison ignores stock_class_id as a
      // deprecated field, so the edit also changes the quantity to be detected at all.)
      {
        entityType: 'stockIssuance',
        data: {
          id: 'ISS-FREE',
          security_id: 'S-FREE',
          stock_class_id: 'CLASS-M',
          stakeholder_id: 'SH-OLD',
          quantity: '11',
        },
      },
      // New issuances: into the managed class (withheld) and into a free class (kept).
      {
        entityType: 'stockIssuance',
        data: {
          id: 'ISS-NEW-M',
          security_id: 'S-NEW-M',
          stock_class_id: 'CLASS-M',
          stakeholder_id: 'SH-SELLER',
          quantity: '5',
        },
      },
      {
        entityType: 'stockIssuance',
        data: {
          id: 'ISS-NEW-F',
          security_id: 'S-NEW-F',
          stock_class_id: 'CLASS-F',
          stakeholder_id: 'SH-SELLER',
          quantity: '5',
        },
      },
      // New records naming a migrated security, a registry security, the withheld new security, and a free security.
      { entityType: 'stockTransfer', data: { id: 'TR-MIG', security_id: 'S-MIG', resulting_security_ids: ['X1'] } },
      { entityType: 'stockTransfer', data: { id: 'TR-REG', security_id: 'T-B-0', resulting_security_ids: ['X2'] } },
      { entityType: 'stockCancellation', data: { id: 'CN-NEW-M', security_id: 'S-NEW-M' } },
      { entityType: 'stockTransfer', data: { id: 'TR-FREE', security_id: 'S-NEW-F', resulting_security_ids: ['X3'] } },
      { entityType: 'stockClassSplit', data: { id: 'SPLIT-M', stock_class_id: 'CLASS-M' } },
      // Registry-written T-ISS-B-0 and T-TR-0 absent from the source; ROOT-TR absent too (a free root record).
    ];

    const diff = computeReplicationDiff(source, cantonState(), { cantonOcfData: cantonOcfData(), ...NO_OPEN_TRADES });

    expect(reasonsOf(diff)).toEqual({
      'create issuer ISSUER-NEW': ['cap_table_archive'],
      'create stockIssuance ISS-NEW-M': ['managed_class_record/proposed'],
      'create stockTransfer TR-MIG': ['managed_class_security/proposed'],
      'create stockTransfer TR-REG': ['registry_security/proposed'],
      'create stockCancellation CN-NEW-M': ['managed_class_security/proposed'],
      'create stockClassSplit SPLIT-M': ['managed_class_record/proposed'],
      'edit stakeholder SH-SELLER': ['referenced_stakeholder'],
      'edit stockIssuance ISS-MIG': ['managed_class_record/proposed', 'managed_class_record/stored'],
      'edit stockIssuance ISS-FREE': ['managed_class_record/proposed'],
      'delete issuer ISSUER-OLD': ['cap_table_archive'],
      'delete stakeholder SH-BUYER': ['referenced_stakeholder'],
      'delete stakeholder SH-OLD': ['retained_record_reference'],
      'delete stockClass CLASS-M': ['managed_stock_class_delete', 'retained_record_reference'],
      'delete stockLegendTemplate LEG-1': ['referenced_object'],
      'delete stockIssuance T-ISS-B-0': ['registry_record'],
      'delete stockTransfer T-TR-0': ['registry_record'],
    });
    expect(itemIds(diff.creates)).toEqual(['stockIssuance ISS-NEW-F', 'stockTransfer TR-FREE']);
    expect(itemIds(diff.edits)).toEqual([]);
    expect(diff.skipped?.find((item) => item.id === 'SH-OLD')?.reasons[0]?.message).toBe(
      'stakeholder SH-OLD is referenced by stockIssuance ISS-FREE, which the position guard keeps on the root'
    );
    expect(itemIds(diff.deletes)).toEqual(['stockTransfer ROOT-TR']);
    expect(diff.total).toBe(3);
  });

  it('never edits or deletes the vesting records a registry wrote, and writes no root vesting record for a lot', () => {
    const vestingRecords: Array<[OcfEntityType, Record<string, unknown>]> = [
      // Registry_RecordVesting records, on a registry lot and on a migrated lot.
      ['vestingStart', { id: 'T-VS-0', date: '2025-06-01', security_id: 'T-B-0', vesting_condition_id: 'COND-1' }],
      [
        'vestingAcceleration',
        { id: 'T-VA-0', date: '2025-07-01', security_id: 'S-MIG', quantity: '10', reason_text: 'Change of control' },
      ],
      // A root record on an unmanaged security.
      ['vestingEvent', { id: 'ROOT-VE', date: '2024-06-01', security_id: 'S-FREE', vesting_condition_id: 'COND-1' }],
    ];
    const records = [...CANTON_RECORDS, ...vestingRecords];
    const state: CapTableState = {
      ...cantonState(true, records),
      positionState: positionState({
        registryRecords: new Map([
          ['stockIssuance', new Map([['T-ISS-B-0', 'iss-tb-cid']])],
          ['stockTransfer', new Map([['T-TR-0', 'tr-cid']])],
          ['vestingStart', new Map([['T-VS-0', 'vs-cid']])],
          ['vestingEvent', new Map()],
          ['vestingAcceleration', new Map([['T-VA-0', 'va-cid']])],
        ]),
      }),
    };
    const source: SourceReplicationItem[] = [
      ...CANTON_RECORDS.map(([entityType, data]) => ({ entityType, data })),
      // Edited at the source: T-VS-0. Absent: T-VA-0 and ROOT-VE.
      {
        entityType: 'vestingStart',
        data: { id: 'T-VS-0', date: '2025-06-01', security_id: 'T-B-0', vesting_condition_id: 'COND-2' },
      },
      // New root vesting records on a registry lot and on an unmanaged security.
      {
        entityType: 'vestingEvent',
        data: { id: 'NEW-VE-M', date: '2025-08-01', security_id: 'T-B-0', vesting_condition_id: 'COND-1' },
      },
      {
        entityType: 'vestingEvent',
        data: { id: 'NEW-VE-F', date: '2025-08-01', security_id: 'S-FREE', vesting_condition_id: 'COND-1' },
      },
    ];

    const diff = computeReplicationDiff(source, state, { cantonOcfData: cantonOcfData(records), ...NO_OPEN_TRADES });

    expect(reasonsOf(diff)).toEqual({
      // The source has the registry's issuance of T-B-0 too; that does not make the event the ledger guard's.
      'create vestingEvent NEW-VE-M': ['registry_security/proposed'],
      'edit vestingStart T-VS-0': ['registry_record'],
      'delete vestingAcceleration T-VA-0': ['registry_record'],
    });
    expect(itemIds(diff.creates)).toEqual(['vestingEvent NEW-VE-F']);
    expect(itemIds(diff.edits)).toEqual([]);
    expect(itemIds(diff.deletes)).toEqual(['vestingEvent ROOT-VE']);
  });

  it('words the ledger guard’s reasons as the ledger does, and a registry lot’s apart from them', () => {
    // The ledger guard looks a security's class up among the root's issuances only, so it never sees T-B-0's. OCP's
    // reference check rejects the transfer naming it, and accepts the return to pool; replication withholds both.
    const diff = computeReplicationDiff(
      [
        {
          entityType: 'stockTransfer',
          data: { id: 'TR-MIG', security_id: 'S-MIG', resulting_security_ids: ['S-FREE', 'T-B-0'] },
        },
        {
          entityType: 'stockPlanReturnToPool',
          data: { id: 'RTP-REG', security_id: 'T-B-0', stock_plan_id: 'PLAN', quantity: '5', reason_text: 'Returned' },
        },
      ],
      { ...cantonState(), entities: new Map() },
      NO_OPEN_TRADES
    );

    expect(reasonsOf(diff)).toEqual({
      'create stockTransfer TR-MIG': ['managed_class_security/proposed', 'registry_security/proposed'],
      'create stockPlanReturnToPool RTP-REG': ['registry_security/proposed'],
    });
    expect(diff.skipped?.[0]?.reasons.map((reason) => reason.message)).toEqual([
      'stock transfer TR-MIG (proposed) references security S-MIG of position-managed class CLASS-M',
      'stock transfer TR-MIG (proposed) references security T-B-0, which a position registry issued outside the ' +
        'CapTable root',
    ]);
  });

  it('takes a security’s class only from the source issuances the diff keeps, not from ignored duplicates', () => {
    const issuance = (id: string, securityId: string, stockClassId: string): SourceReplicationItem => ({
      entityType: 'stockIssuance',
      data: { id, security_id: securityId, stock_class_id: stockClassId, stakeholder_id: 'SH-OLD' },
    });
    const source: SourceReplicationItem[] = [
      issuance('ISS-A', 'S-A', 'CLASS-F'),
      // A duplicate of ISS-A, which the diff ignores: it must not say S-B is in the free class.
      issuance('ISS-A', 'S-B', 'CLASS-F'),
      issuance('ISS-B', 'S-B', 'CLASS-M'),
      { entityType: 'stockTransfer', data: { id: 'TR-B', security_id: 'S-B', resulting_security_ids: ['X'] } },
    ];

    const diff = computeReplicationDiff(source, { ...cantonState(), entities: new Map() }, NO_OPEN_TRADES);

    expect(reasonsOf(diff)).toEqual({
      'create stockIssuance ISS-B': ['managed_class_record/proposed'],
      'create stockTransfer TR-B': ['managed_class_security/proposed'],
    });
    expect(itemIds(diff.creates)).toEqual(['stockIssuance ISS-A']);
  });

  it('withholds deletes of guarded records whose stored version it cannot see, and of all they may name', () => {
    const state = cantonState();

    const diff = computeReplicationDiff([], state, NO_OPEN_TRADES);

    const reasons = reasonsOf(diff);
    expect(reasons['delete stockTransfer ROOT-TR']).toEqual(['stored_version_unknown/stored']);
    expect(reasons['delete stakeholder SH-SELLER']).toEqual(['referenced_stakeholder', 'retained_record_reference']);
    expect(reasons['delete vestingTerms VT-1']).toEqual(['referenced_object', 'retained_record_reference']);
    expect(reasons['delete stakeholder SH-OLD']).toEqual(['retained_record_reference']);
    const message = diff.skipped?.find((item) => item.id === 'SH-OLD')?.reasons[0]?.message;
    expect(message).toMatch(/^stakeholder SH-OLD may be referenced by stockClass CLASS-M, stockIssuance ISS-MIG, /);
    expect(message).toMatch(
      /which the position guard keeps on the root and whose Canton version is not in cantonOcfData$/
    );
    expect(itemIds(diff.deletes)).toEqual([]);
  });

  describe('keeps what the root records it withholds still name', () => {
    // CLASS-M became position-managed (EnablePositions) but ISS-PRE is not migrated yet. CV-PREF converted 5 of the 9
    // shares of S-PREF, in the unmanaged CLASS-U, into S-MIG in CLASS-M (since migrated) and left the balance
    // S-PREF-BAL in CLASS-U. CV-PREF names S-MIG, so the root guard freezes it.
    const records: Array<[OcfEntityType, Record<string, unknown>]> = [
      ['stakeholder', { id: 'SH-PRE', name: 'Pre-migration holder' }],
      ['stakeholder', { id: 'SH-PREF', name: 'Converting holder' }],
      ['stakeholder', { id: 'SH-GONE', name: 'Unreferenced' }],
      ['stockClass', { id: 'CLASS-M', name: 'Managed' }],
      ['stockClass', { id: 'CLASS-U', name: 'Unmanaged' }],
      ['stockClass', { id: 'CLASS-GONE', name: 'Unreferenced' }],
      ['stockLegendTemplate', { id: 'LEG-PRE', name: 'Legend' }],
      ['stockPlan', { id: 'PLAN-PRE', plan_name: 'Plan', stock_class_ids: ['CLASS-M'] }],
      ['vestingTerms', { id: 'VT-PRE', name: 'Vesting' }],
      [
        'stockIssuance',
        {
          id: 'ISS-PRE',
          date: '2024-01-01',
          security_id: 'S-PRE',
          stock_class_id: 'CLASS-M',
          stakeholder_id: 'SH-PRE',
          stock_legend_ids: ['LEG-PRE'],
          stock_plan_id: 'PLAN-PRE',
          vesting_terms_id: 'VT-PRE',
          quantity: '10',
        },
      ],
      [
        'stockIssuance',
        {
          id: 'ISS-PREF',
          date: '2024-01-01',
          security_id: 'S-PREF',
          stock_class_id: 'CLASS-U',
          stakeholder_id: 'SH-PREF',
          quantity: '9',
        },
      ],
      [
        'stockIssuance',
        {
          id: 'ISS-MIG',
          date: '2024-06-01',
          security_id: 'S-MIG',
          stock_class_id: 'CLASS-M',
          stakeholder_id: 'SH-PREF',
          quantity: '5',
        },
      ],
      [
        'stockIssuance',
        {
          id: 'ISS-BAL',
          date: '2024-06-01',
          security_id: 'S-PREF-BAL',
          stock_class_id: 'CLASS-U',
          stakeholder_id: 'SH-PREF',
          quantity: '4',
        },
      ],
      [
        'stockConversion',
        {
          id: 'CV-PREF',
          date: '2024-06-01',
          security_id: 'S-PREF',
          quantity_converted: '5',
          resulting_security_ids: ['S-MIG'],
          balance_security_id: 'S-PREF-BAL',
        },
      ],
    ];
    const state = (): CapTableState => ({
      ...cantonState(true, records),
      positionState: positionState({
        migratedSecurityIds: new Map([['S-MIG', 'SH-PREF']]),
        stockClassBySecurityId: new Map([
          ['S-PRE', 'CLASS-M'],
          ['S-PREF', 'CLASS-U'],
          ['S-MIG', 'CLASS-M'],
          ['S-PREF-BAL', 'CLASS-U'],
        ]),
      }),
    });
    /** The Canton records as the source has them, with some fields changed (`undefined` drops one). */
    const sourceWith = (changes: Record<string, Record<string, unknown>>): SourceReplicationItem[] =>
      records.map(([entityType, data]) => ({
        entityType,
        data: Object.fromEntries(
          Object.entries({ ...data, ...changes[data.id as string] }).filter(([, value]) => value !== undefined)
        ),
      }));
    const options = () => ({ cantonOcfData: cantonOcfData(records), ...NO_OPEN_TRADES });

    it('withholds the deletes of their stakeholders, stock classes, legends, plans, vesting terms and securities', () => {
      // The source dropped every record but the converted issuance, which it gave to a new holder.
      const diff = computeReplicationDiff(
        [
          ...sourceWith({ 'ISS-PREF': { stakeholder_id: 'SH-NEW', quantity: '8' } }).filter(
            (item) => (item.data as { id: string }).id === 'ISS-PREF'
          ),
          { entityType: 'stakeholder', data: { id: 'SH-NEW', name: 'New holder' } },
        ],
        state(),
        options()
      );

      expect(reasonsOf(diff)).toEqual({
        'delete stakeholder SH-PRE': ['retained_record_reference'],
        'delete stakeholder SH-PREF': ['retained_record_reference'],
        'delete stockClass CLASS-M': ['managed_stock_class_delete', 'retained_record_reference'],
        'delete stockClass CLASS-U': ['retained_record_reference'],
        'delete stockLegendTemplate LEG-PRE': ['retained_record_reference'],
        'delete stockPlan PLAN-PRE': ['retained_record_reference'],
        'delete vestingTerms VT-PRE': ['retained_record_reference'],
        'delete stockIssuance ISS-PRE': ['managed_class_record/stored'],
        'delete stockIssuance ISS-MIG': ['managed_class_record/stored', 'retained_record_reference'],
        'delete stockIssuance ISS-BAL': ['retained_record_reference'],
        'delete stockConversion CV-PREF': ['managed_class_security/stored'],
        // CV-PREF stays, so the issuance it converted stays as stored with it.
        'edit stockIssuance ISS-PREF': ['retained_record_reference'],
      });
      expect(diff.skipped?.find((item) => item.id === 'CLASS-M')?.reasons[1]?.message).toBe(
        'stockClass CLASS-M is referenced by stockIssuance ISS-PRE, stockIssuance ISS-MIG, stockPlan PLAN-PRE, ' +
          'which the position guard keeps on the root'
      );
      expect(diff.skipped?.find((item) => item.id === 'ISS-BAL')?.reasons[0]?.message).toBe(
        'stockIssuance ISS-BAL is referenced by stockConversion CV-PREF, which the position guard keeps on the root'
      );
      expect(itemIds(diff.creates)).toEqual(['stakeholder SH-NEW']);
      expect(itemIds(diff.edits)).toEqual([]);
      expect(itemIds(diff.deletes)).toEqual(['stakeholder SH-GONE', 'stockClass CLASS-GONE']);
    });

    // A consistent correction of both records: the ledger guard refuses the conversion's edit, and OCP's balance,
    // reference or date check would reject the issuance's edit against the conversion left as stored.
    it.each([
      [
        'lowers its quantity below what the conversion consumed',
        { 'ISS-PREF': { quantity: '4' }, 'CV-PREF': { quantity_converted: '4', balance_security_id: undefined } },
      ],
      [
        'moves it to another security',
        { 'ISS-PREF': { security_id: 'S-PREF-2' }, 'CV-PREF': { security_id: 'S-PREF-2' } },
      ],
      ['dates it after the conversion', { 'ISS-PREF': { date: '2024-07-01' }, 'CV-PREF': { date: '2024-07-01' } }],
    ])(
      'withholds a correction of the converted issuance that %s, made with the frozen conversion',
      (_label, changes) => {
        const diff = computeReplicationDiff(sourceWith(changes), state(), options());

        expect(reasonsOf(diff)).toEqual({
          'edit stockConversion CV-PREF': ['managed_class_security/proposed', 'managed_class_security/stored'],
          'edit stockIssuance ISS-PREF': ['retained_record_reference'],
        });
        expect(diff.skipped?.find((item) => item.id === 'ISS-PREF')?.reasons[0]?.message).toBe(
          'stockIssuance ISS-PREF is referenced by stockConversion CV-PREF, which the position guard keeps on the root'
        );
        expect(diff.total).toBe(0);
      }
    );

    it('edits the converted issuance while the frozen conversion stays as the source has it', () => {
      // The root guard reads only the managed classes, and the source wrote the edit against CV-PREF as stored.
      const diff = computeReplicationDiff(
        [
          ...sourceWith({ 'ISS-PREF': { stakeholder_id: 'SH-NEW', quantity: '8' } }),
          { entityType: 'stakeholder', data: { id: 'SH-NEW', name: 'New holder' } },
        ],
        state(),
        options()
      );

      expect(diff.skipped).toEqual([]);
      expect(itemIds(diff.creates)).toEqual(['stakeholder SH-NEW']);
      expect(itemIds(diff.edits)).toEqual(['stockIssuance ISS-PREF']);
    });

    it('keeps the instruments a frozen exercise or conversion draws on, of any kind', () => {
      // WEX-1 exercised the warrant W-1 into S-WEX, and CC-1 converted the note C-1 into S-CC, both in CLASS-M. OCP
      // checks each against its warrant or convertible issuance, so that issuance stays as stored with it.
      const instruments: Array<[OcfEntityType, Record<string, unknown>]> = [
        ['stakeholder', { id: 'SH-W', name: 'Holder' }],
        ['stockClass', { id: 'CLASS-M', name: 'Managed' }],
        [
          'warrantIssuance',
          { id: 'W-ISS', date: '2024-01-01', security_id: 'W-1', stakeholder_id: 'SH-W', quantity: '10' },
        ],
        [
          'warrantExercise',
          {
            id: 'WEX-1',
            date: '2024-06-01',
            security_id: 'W-1',
            quantity: '4',
            trigger_id: 'T-1',
            resulting_security_ids: ['S-WEX'],
          },
        ],
        [
          'stockIssuance',
          {
            id: 'ISS-WEX',
            date: '2024-06-01',
            security_id: 'S-WEX',
            stock_class_id: 'CLASS-M',
            stakeholder_id: 'SH-W',
            quantity: '4',
          },
        ],
        ['convertibleIssuance', { id: 'CN-ISS', date: '2024-01-01', security_id: 'C-1', stakeholder_id: 'SH-W' }],
        [
          'convertibleConversion',
          { id: 'CC-1', date: '2024-06-01', security_id: 'C-1', trigger_id: 'T-1', resulting_security_ids: ['S-CC'] },
        ],
        [
          'stockIssuance',
          {
            id: 'ISS-CC',
            date: '2024-06-01',
            security_id: 'S-CC',
            stock_class_id: 'CLASS-M',
            stakeholder_id: 'SH-W',
            quantity: '3',
          },
        ],
      ];
      const corrections: Record<string, Record<string, unknown>> = {
        'W-ISS': { quantity: '3' },
        'WEX-1': { quantity: '2' },
      };
      // The source corrects the exercise and the warrant together, and drops the conversion and the note.
      const source = instruments
        .filter(([, data]) => data.id !== 'CC-1' && data.id !== 'CN-ISS')
        .map(([entityType, data]) => ({ entityType, data: { ...data, ...corrections[data.id as string] } }));

      const diff = computeReplicationDiff(
        source,
        {
          ...cantonState(true, instruments),
          positionState: positionState({
            stockClassBySecurityId: new Map([
              ['S-WEX', 'CLASS-M'],
              ['S-CC', 'CLASS-M'],
            ]),
          }),
        },
        { cantonOcfData: cantonOcfData(instruments), ...NO_OPEN_TRADES }
      );

      expect(reasonsOf(diff)).toEqual({
        'edit warrantExercise WEX-1': ['managed_class_security/proposed', 'managed_class_security/stored'],
        'edit warrantIssuance W-ISS': ['retained_record_reference'],
        'delete convertibleConversion CC-1': ['managed_class_security/stored'],
        'delete convertibleIssuance CN-ISS': ['retained_record_reference'],
      });
      expect(diff.skipped?.find((item) => item.id === 'CN-ISS')?.reasons[0]?.message).toBe(
        'convertibleIssuance CN-ISS is referenced by convertibleConversion CC-1, which the position guard keeps on ' +
          'the root'
      );
      expect(diff.total).toBe(0);
    });
  });

  it('reports security_id conflicts only for creates it keeps', () => {
    const state = cantonState();
    const source: SourceReplicationItem[] = [
      {
        entityType: 'stockIssuance',
        data: { id: 'ISS-DUP-M', security_id: 'T-B-0', stock_class_id: 'CLASS-M', stakeholder_id: 'SH-BUYER' },
      },
      {
        entityType: 'stockIssuance',
        data: { id: 'ISS-DUP-F', security_id: 'S-FREE', stock_class_id: 'CLASS-F', stakeholder_id: 'SH-OLD' },
      },
    ];

    const diff = computeReplicationDiff(source, state, { securityIds: state.securityIds, ...NO_OPEN_TRADES });

    expect(diff.conflicts.map((conflict) => conflict.id)).toEqual(['ISS-DUP-F']);
    expect(diff.skipped?.map((item) => item.id)).toContain('ISS-DUP-M');
  });

  describe('before settlement of a trade to a new buyer', () => {
    // ta-service has created the buyer's stakeholder on the root; no position or registry record names it yet, and
    // PostgreSQL does not have it.
    const preSettle = (): CapTableState => {
      const state = cantonState();
      state.entities.set('stakeholder', new Set(['SH-SELLER', 'SH-NEW-BUYER']));
      return {
        ...state,
        positionState: positionState({ referencedStakeholderIds: new Set(['SH-SELLER']) }),
      };
    };
    const source: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: { id: 'SH-SELLER', name: 'Seller' } }];

    it('keeps the stakeholders of open trades', () => {
      const diff = computeReplicationDiff(source, preSettle(), {
        cantonOcfData: cantonOcfData(),
        protectedStakeholderIds: new Set(['SH-SELLER', 'SH-NEW-BUYER']),
      });

      expect(reasonsOf(diff)['delete stakeholder SH-NEW-BUYER']).toEqual(['protected_stakeholder']);
      expect(diff.skipped?.find((item) => item.id === 'SH-NEW-BUYER')?.reasons[0]?.message).toBe(
        'stakeholder SH-NEW-BUYER is in options.protectedStakeholderIds (a party to an open trade)'
      );
      expect(diff.deletes.filter((item) => item.entityType === 'stakeholder')).toEqual([]);
    });

    it('also withholds an edit of a protected stakeholder', () => {
      const diff = computeReplicationDiff(
        [...source, { entityType: 'stakeholder', data: { id: 'SH-NEW-BUYER', name: 'Renamed' } }],
        preSettle(),
        {
          cantonOcfData: new Map([
            ...cantonOcfData(),
            [
              'stakeholder',
              new Map([
                ['SH-SELLER', { id: 'SH-SELLER', name: 'Seller' }],
                ['SH-NEW-BUYER', { id: 'SH-NEW-BUYER', name: 'Buyer' }],
              ]),
            ],
          ]),
          protectedStakeholderIds: ['SH-NEW-BUYER'],
        }
      );

      expect(reasonsOf(diff)['edit stakeholder SH-NEW-BUYER']).toEqual(['protected_stakeholder']);
      expect(diff.edits).toEqual([]);
    });

    it('refuses to run without the stakeholders of open trades', () => {
      expect(() => computeReplicationDiff(source, preSettle(), { cantonOcfData: cantonOcfData() })).toThrow(
        /pass the stakeholders of its open trades as options.protectedStakeholderIds/
      );
    });

    it('refuses a bare string for the stakeholders', () => {
      expect(() =>
        computeReplicationDiff(source, preSettle(), {
          cantonOcfData: cantonOcfData(),
          protectedStakeholderIds: 'SH-NEW-BUYER',
        })
      ).toThrow(/Expected a list of stakeholder IDs/);
    });
  });

  it('withholds edits and deletes of protected stakeholders on a cap table without positions', () => {
    const diff = computeReplicationDiff([], cantonState(false), { protectedStakeholderIds: ['SH-OLD'] });

    expect(reasonsOf(diff)).toEqual({ 'delete stakeholder SH-OLD': ['protected_stakeholder'] });
    expect(diff.deletes.some((item) => item.id === 'SH-OLD')).toBe(false);
    expect(diff.total).toBe(CANTON_RECORDS.length - 1);
  });

  it('refuses a cap table whose registry-written records reuse an OCF ID or a security ID, naming each record', () => {
    const state = {
      ...cantonState(),
      positionState: positionState({
        conflictingRecords: [
          {
            entityType: 'stockIssuance',
            field: 'id',
            value: 'ISS-FREE',
            rootContractId: 'iss-free-cid',
            registryContractIds: ['iss-dup-cid'],
          },
          {
            entityType: 'stockIssuance',
            field: 'security_id',
            value: 'S-MIG',
            rootContractId: 'iss-mig-cid',
            registryContractIds: ['iss-new-cid'],
          },
        ],
      }),
    };

    expect(() => computeReplicationDiff([], state, { cantonOcfData: cantonOcfData(), ...NO_OPEN_TRADES })).toThrow(
      'The replication diff cannot run on CapTable ct-1: position registries wrote records whose OCF IDs or ' +
        'security IDs are not unique (stockIssuance ISS-FREE is carried by root record iss-free-cid and ' +
        'registry-written record(s) iss-dup-cid; stockIssuance security_id S-MIG is carried by root record ' +
        'iss-mig-cid and registry-written record(s) iss-new-cid)'
    );
  });

  it('cannot be turned off for a cap table with positions', () => {
    const diff = computeReplicationDiff([], cantonState(), {
      cantonOcfData: cantonOcfData(),
      positionState: undefined,
      ...NO_OPEN_TRADES,
    });

    expect(diff.skipped?.length).toBeGreaterThan(0);
  });

  it('refuses a Canton state that does not say whether the cap table has positions', () => {
    // Built by hand, or stripped of the field: absence must not read as "no positions".
    const { positionState: _dropped, ...unmarked } = cantonState();

    expect(() => computeReplicationDiff([], unmarked as CapTableState, { cantonOcfData: cantonOcfData() })).toThrow(
      /cantonState does not say whether the CapTable has positions/
    );
  });

  it('uses an explicitly passed position state for a Canton state without one', () => {
    const { positionState: _dropped, ...unmarked } = cantonState();

    const diff = computeReplicationDiff([], unmarked as CapTableState, {
      cantonOcfData: cantonOcfData(),
      positionState: positionState(),
      ...NO_OPEN_TRADES,
    });

    expect(reasonsOf(diff)['delete stockTransfer T-TR-0']).toEqual(['registry_record']);
  });

  it('refuses a position state for a cap table the Canton state says has none', () => {
    expect(() =>
      computeReplicationDiff([], cantonState(false), {
        cantonOcfData: cantonOcfData(),
        positionState: positionState(),
      })
    ).toThrow(/says the CapTable has no positions/);
  });

  it('fails closed on a position state it cannot trust', () => {
    // From another snapshot than the Canton state's.
    expect(() => computeReplicationDiff([], cantonState(), { positionState: positionState({ offset: 8 }) })).toThrow(
      OcpValidationError
    );
    // Read from another CapTable.
    expect(() =>
      computeReplicationDiff([], {
        ...cantonState(false),
        positionState: positionState({ capTableContractId: 'ct-2' }),
      })
    ).toThrow(/Position state was read from CapTable ct-2, not ct-1/);
    // Deserialized from JSON: its maps and sets are gone.
    const roundTripped = JSON.parse(JSON.stringify(positionState())) as CapTablePositionState;
    expect(() => computeReplicationDiff([], { ...cantonState(false), positionState: roundTripped })).toThrow(
      /Position state is incomplete/
    );
  });

  it('leaves the diff of a cap table without positions unchanged', () => {
    const source: SourceReplicationItem[] = [
      { entityType: 'stockIssuance', data: { id: 'ISS-NEW-M', security_id: 'S-NEW-M', stock_class_id: 'CLASS-M' } },
    ];

    const diff = computeReplicationDiff(source, cantonState(false), { cantonOcfData: cantonOcfData() });

    expect(diff).not.toHaveProperty('skipped');
    expect(Object.keys(diff).sort()).toEqual(['conflicts', 'creates', 'deletes', 'edits', 'total']);
    expect(itemIds(diff.creates)).toEqual(['stockIssuance ISS-NEW-M']);
    expect(diff.deletes).toHaveLength(CANTON_RECORDS.length);
  });
});
