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
    ancestorSecurityIds: new Map([['S-ANC', 'S-MIG']]),
    capTableContractId: CAP_TABLE,
    offset: 7,
    positions: [],
    supersededStockIssuances: new Map([['ISS-MIG', 'S-MIG']]),
    registryRecords: new Map([
      ['stockIssuance', new Map([['T-ISS-B-0', 'iss-tb-cid']])],
      ['stockTransfer', new Map([['T-TR-0', 'tr-cid']])],
    ]),
    stockClassBySecurityId: new Map([
      ['S-MIG', 'CLASS-M'],
      ['S-ANC', 'CLASS-M'],
      ['T-B-0', 'CLASS-M'],
      ['S-FREE', 'CLASS-F'],
    ]),
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
  ['stockTransfer', { id: 'T-TR-0', security_id: 'S-ANC', resulting_security_ids: ['T-B-0'], quantity: '60' }],
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
      // New records naming an ancestor, a registry security, the withheld new security, and a free security.
      { entityType: 'stockTransfer', data: { id: 'TR-ANC', security_id: 'S-ANC', resulting_security_ids: ['X1'] } },
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
      'create stockTransfer TR-ANC': ['ancestor_security/proposed', 'managed_class_security/proposed'],
      'create stockTransfer TR-REG': ['managed_class_security/proposed'],
      'create stockCancellation CN-NEW-M': ['managed_class_security/proposed'],
      'create stockClassSplit SPLIT-M': ['managed_class_record/proposed'],
      'edit stakeholder SH-SELLER': ['referenced_stakeholder'],
      'edit stockIssuance ISS-MIG': [
        'managed_class_record/proposed',
        'migrated_security/proposed',
        'managed_class_record/stored',
        'migrated_security/stored',
      ],
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
      'create vestingEvent NEW-VE-M': ['managed_class_security/proposed'],
      'edit vestingStart T-VS-0': ['registry_record'],
      'delete vestingAcceleration T-VA-0': ['registry_record'],
    });
    expect(itemIds(diff.creates)).toEqual(['vestingEvent NEW-VE-F']);
    expect(itemIds(diff.edits)).toEqual([]);
    expect(itemIds(diff.deletes)).toEqual(['vestingEvent ROOT-VE']);
  });

  it('words each reason like the ledger guard', () => {
    const diff = computeReplicationDiff(
      [
        {
          entityType: 'stockTransfer',
          data: { id: 'TR-ANC', security_id: 'S-ANC', resulting_security_ids: ['S-MIG'] },
        },
      ],
      { ...cantonState(), entities: new Map() },
      NO_OPEN_TRADES
    );

    expect(diff.skipped?.[0]?.reasons.map((reason) => reason.message)).toEqual([
      'stock transfer TR-ANC (proposed) references security S-ANC in the provenance of migrated security S-MIG',
      'stock transfer TR-ANC (proposed) references security S-ANC of position-managed class CLASS-M',
      'stock transfer TR-ANC (proposed) references migrated security S-MIG',
      'stock transfer TR-ANC (proposed) references security S-MIG of position-managed class CLASS-M',
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
    // CLASS-M became position-managed (EnablePositions) but ISS-PRE is not migrated yet; ISS-ANC, in an unmanaged
    // class, is in the provenance of the migrated S-MIG through TR-ANC, which also produced the sibling S-SIB.
    const records: Array<[OcfEntityType, Record<string, unknown>]> = [
      ['stakeholder', { id: 'SH-PRE', name: 'Pre-migration holder' }],
      ['stakeholder', { id: 'SH-ANC', name: 'Original holder' }],
      ['stakeholder', { id: 'SH-SIB', name: 'Sibling holder' }],
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
        { id: 'ISS-ANC', security_id: 'S-ANC-U', stock_class_id: 'CLASS-U', stakeholder_id: 'SH-ANC', quantity: '9' },
      ],
      [
        'stockIssuance',
        { id: 'ISS-SIB', security_id: 'S-SIB', stock_class_id: 'CLASS-U', stakeholder_id: 'SH-SIB', quantity: '4' },
      ],
      [
        'stockTransfer',
        { id: 'TR-ANC', security_id: 'S-ANC-U', resulting_security_ids: ['S-SIB'], balance_security_id: 'S-MIG' },
      ],
    ];
    const state = (): CapTableState => ({
      ...cantonState(true, records),
      positionState: positionState({
        ancestorSecurityIds: new Map([['S-ANC-U', 'S-MIG']]),
        supersededStockIssuances: new Map(),
        stockClassBySecurityId: new Map([
          ['S-PRE', 'CLASS-M'],
          ['S-ANC-U', 'CLASS-U'],
          ['S-SIB', 'CLASS-U'],
        ]),
      }),
    });
    const renamedAncestorHolder = {
      entityType: 'stockIssuance' as const,
      data: {
        id: 'ISS-ANC',
        security_id: 'S-ANC-U',
        stock_class_id: 'CLASS-U',
        stakeholder_id: 'SH-NEW',
        quantity: '8',
      },
    };

    it('withholds the deletes of their stakeholders, stock classes, legends, plans, vesting terms and securities', () => {
      const diff = computeReplicationDiff(
        [renamedAncestorHolder, { entityType: 'stakeholder', data: { id: 'SH-NEW', name: 'New holder' } }],
        state(),
        { cantonOcfData: cantonOcfData(records), ...NO_OPEN_TRADES }
      );

      expect(reasonsOf(diff)).toEqual({
        'edit stockIssuance ISS-ANC': ['ancestor_security/proposed', 'ancestor_security/stored'],
        'delete stakeholder SH-PRE': ['retained_record_reference'],
        'delete stakeholder SH-ANC': ['retained_record_reference'],
        'delete stakeholder SH-SIB': ['retained_record_reference'],
        'delete stockClass CLASS-M': ['managed_stock_class_delete', 'retained_record_reference'],
        'delete stockClass CLASS-U': ['retained_record_reference'],
        'delete stockLegendTemplate LEG-PRE': ['retained_record_reference'],
        'delete stockPlan PLAN-PRE': ['retained_record_reference'],
        'delete vestingTerms VT-PRE': ['retained_record_reference'],
        'delete stockIssuance ISS-PRE': ['managed_class_record/stored'],
        'delete stockIssuance ISS-SIB': ['retained_record_reference'],
        'delete stockTransfer TR-ANC': ['ancestor_security/stored', 'migrated_security/stored'],
      });
      expect(diff.skipped?.find((item) => item.id === 'CLASS-M')?.reasons[1]?.message).toBe(
        'stockClass CLASS-M is referenced by stockIssuance ISS-PRE, stockPlan PLAN-PRE, which the position guard ' +
          'keeps on the root'
      );
      expect(diff.skipped?.find((item) => item.id === 'ISS-SIB')?.reasons[0]?.message).toBe(
        'stockIssuance ISS-SIB is referenced by stockTransfer TR-ANC, which the position guard keeps on the root'
      );
      expect(itemIds(diff.creates)).toEqual(['stakeholder SH-NEW']);
      expect(itemIds(diff.deletes)).toEqual(['stakeholder SH-GONE', 'stockClass CLASS-GONE']);
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
