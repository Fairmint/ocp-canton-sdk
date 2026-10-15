/**
 * computeReplicationDiff on a Canton cap table with position registries: the diff never writes what the ledger's
 * root guard (validatePositionManagedWrites) rejects, never touches registry-written records or what they and the
 * positions reference, and reports every withheld operation with its reasons.
 */

import { OcpValidationError } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/entityTypes';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import type { CapTablePositionState } from '../../src/functions/OpenCapTable/positions';
import {
  computeReplicationDiff,
  type CantonOcfDataMap,
  type ReplicationDiff,
  type SourceReplicationItem,
} from '../../src/utils/replicationHelpers';

const CAP_TABLE = 'ct-1';

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

function cantonState(withPositionState = true): CapTableState {
  const entities = new Map<OcfEntityType, Set<string>>();
  for (const [entityType, data] of CANTON_RECORDS) {
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

function cantonOcfData(): CantonOcfDataMap {
  const data: CantonOcfDataMap = new Map();
  for (const [entityType, record] of CANTON_RECORDS) {
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
      // A stakeholder edit and delete that positions reference; an unreferenced delete passes (SH-OLD absent).
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

    const diff = computeReplicationDiff(source, cantonState(), { cantonOcfData: cantonOcfData() });

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
      'delete stockClass CLASS-M': ['managed_stock_class_delete'],
      'delete stockLegendTemplate LEG-1': ['referenced_object'],
      'delete stockIssuance T-ISS-B-0': ['registry_record'],
      'delete stockTransfer T-TR-0': ['registry_record'],
    });
    expect(itemIds(diff.creates)).toEqual(['stockIssuance ISS-NEW-F', 'stockTransfer TR-FREE']);
    expect(itemIds(diff.edits)).toEqual([]);
    expect(itemIds(diff.deletes)).toEqual(['stakeholder SH-OLD', 'stockTransfer ROOT-TR']);
    expect(diff.total).toBe(4);
  });

  it('words each reason like the ledger guard', () => {
    const diff = computeReplicationDiff(
      [
        {
          entityType: 'stockTransfer',
          data: { id: 'TR-ANC', security_id: 'S-ANC', resulting_security_ids: ['S-MIG'] },
        },
      ],
      { ...cantonState(), entities: new Map() }
    );

    expect(diff.skipped?.[0]?.reasons.map((reason) => reason.message)).toEqual([
      'stock transfer TR-ANC (proposed) references security S-ANC in the provenance of migrated security S-MIG',
      'stock transfer TR-ANC (proposed) references security S-ANC of position-managed class CLASS-M',
      'stock transfer TR-ANC (proposed) references migrated security S-MIG',
      'stock transfer TR-ANC (proposed) references security S-MIG of position-managed class CLASS-M',
    ]);
  });

  it('withholds deletes of guarded records whose stored version it cannot see', () => {
    const state = cantonState();

    const diff = computeReplicationDiff([], state);

    const reasons = reasonsOf(diff);
    expect(reasons['delete stockIssuance ISS-FREE']).toEqual(['stored_version_unknown/stored']);
    expect(reasons['delete stockTransfer ROOT-TR']).toEqual(['stored_version_unknown/stored']);
    expect(reasons['delete stakeholder SH-SELLER']).toEqual(['referenced_stakeholder']);
    expect(reasons['delete vestingTerms VT-1']).toEqual(['referenced_object']);
    expect(itemIds(diff.deletes)).toEqual(['stakeholder SH-OLD', 'stockClass CLASS-F', 'stockLegendTemplate LEG-2']);
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

    const diff = computeReplicationDiff(source, state, { securityIds: state.securityIds });

    expect(diff.conflicts.map((conflict) => conflict.id)).toEqual(['ISS-DUP-F']);
    expect(diff.skipped?.map((item) => item.id)).toContain('ISS-DUP-M');
  });

  it('cannot be turned off for a cap table with positions', () => {
    const diff = computeReplicationDiff([], cantonState(), {
      cantonOcfData: cantonOcfData(),
      positionState: undefined,
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
