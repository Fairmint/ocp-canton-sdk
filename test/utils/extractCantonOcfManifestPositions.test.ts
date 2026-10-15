/**
 * OCF export of a position-managed book: the manifest must include the create-only records the registries wrote, so
 * replaying its transactions yields the positions' balances.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError } from '../../src/errors';
import { getCapTableState } from '../../src/functions/OpenCapTable/capTable';
import { extractCantonOcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  activeContract,
  capTablePayload,
  CONTEXT,
  damlIssuance,
  damlLot,
  damlStockPosition,
  damlTransfer,
  damlVestingAcceleration,
  damlVestingCondition,
  mockLedger,
  TEMPLATE_IDS,
} from '../positions/positionFixtures';

jest.mock('@fairmint/canton-node-sdk');

const ISSUER = CONTEXT.issuer;
const T_DATE = '2025-06-01T00:00:00Z';
const V_DATE = '2025-07-01T00:00:00Z';

type VestingRecordType = 'vestingStart' | 'vestingEvent' | 'vestingAcceleration';
const VESTING_DATA_FIELD: Record<VestingRecordType, string> = {
  vestingStart: 'vesting_data',
  vestingEvent: 'vesting_data',
  vestingAcceleration: 'acceleration_data',
};

/**
 * Root: S1 (100 to the seller) migrated into a position. Registry transfer T: 60 of S1 to the buyer (T-B-0) with a
 * 40 remainder (T-R-0); then registry transfer V: 15 of T-B-0 to a third holder (V-B-0), remainder 45 (V-R-0).
 * `extras.issuances` adds stock issuance records (contract ID, issuance data) after these, and `extras.vesting` the
 * vesting records of the book (type, contract ID, data).
 */
function book(
  withPositions: boolean,
  extras: {
    issuances?: Array<[string, Record<string, unknown>]>;
    vesting?: Array<[VestingRecordType, string, Record<string, unknown>]>;
  } = {}
) {
  const issuances: Array<[string, Record<string, unknown>]> = [
    ['iss-s1-cid', damlIssuance('S1')],
    // Registry_Transfer dates the transferee and remainder issuances on the transfer date.
    [
      'iss-tb-cid',
      damlIssuance('T-B-0', { id: 'T-ISS-B-0', date: T_DATE, stakeholder_id: 'SH-BUYER', quantity: '60' }),
    ],
    ['iss-tr-cid', damlIssuance('T-R-0', { id: 'T-ISS-R-0', date: T_DATE, quantity: '40' })],
    [
      'iss-vb-cid',
      damlIssuance('V-B-0', { id: 'V-ISS-B-0', date: V_DATE, stakeholder_id: 'SH-THIRD', quantity: '15' }),
    ],
    [
      'iss-vr-cid',
      damlIssuance('V-R-0', { id: 'V-ISS-R-0', date: V_DATE, stakeholder_id: 'SH-BUYER', quantity: '45' }),
    ],
    ...(extras.issuances ?? []),
  ];
  const transfers: Array<[string, Record<string, unknown>]> = [
    ['tr-t-cid', damlTransfer('T-TR-0', 'S1', ['T-B-0'], 'T-R-0', { date: T_DATE, quantity: '60' })],
    ['tr-v-cid', damlTransfer('V-TR-0', 'T-B-0', ['V-B-0'], 'V-R-0', { date: V_DATE, quantity: '15' })],
  ];
  const root = {
    ...capTablePayload({
      stockIssuances: [['ISS-S1', 'iss-s1-cid']],
      stockIssuancesBySecurityId: [['S1', 'iss-s1-cid']],
      ...(withPositions
        ? { positionRegistries: [['CLASS-MANAGED', 'registry-cid']], migrated: [['S1', 'SH-SELLER']] }
        : {}),
    }),
    issuer: '',
  };
  const positions = [
    damlStockPosition([damlLot('T-R-0', { issuance: { id: 'T-ISS-R-0', quantity: '40' } })]),
    damlStockPosition(
      [damlLot('V-R-0', { issuance: { id: 'V-ISS-R-0', stakeholder_id: 'SH-BUYER', quantity: '45' } })],
      {
        stakeholder_id: 'SH-BUYER',
        holder: 'buyer::party',
      }
    ),
    damlStockPosition(
      [damlLot('V-B-0', { issuance: { id: 'V-ISS-B-0', stakeholder_id: 'SH-THIRD', quantity: '15' } })],
      {
        stakeholder_id: 'SH-THIRD',
        holder: 'third::party',
      }
    ),
  ];

  const createArgumentsByContractId: Record<string, Record<string, unknown>> = {};
  const templateIdsByContractId: Record<string, string> = {};
  for (const [cid, data] of issuances) {
    createArgumentsByContractId[cid] = { context: CONTEXT, issuance_data: data };
    templateIdsByContractId[cid] = TEMPLATE_IDS.stockIssuance;
  }
  for (const [cid, data] of transfers) {
    createArgumentsByContractId[cid] = { context: CONTEXT, transfer_data: data };
    templateIdsByContractId[cid] = TEMPLATE_IDS.stockTransfer;
  }
  const vestingRows = (entityType: VestingRecordType) =>
    (extras.vesting ?? []).flatMap(([type, cid, data]) => {
      if (type !== entityType) return [];
      const createArgument = { context: CONTEXT, [VESTING_DATA_FIELD[type]]: data };
      createArgumentsByContractId[cid] = createArgument;
      templateIdsByContractId[cid] = TEMPLATE_IDS[type];
      return [activeContract(cid, TEMPLATE_IDS[type], createArgument)];
    });

  return mockLedger({
    activeByTemplate: {
      [TEMPLATE_IDS.capTable]: [activeContract('ct-1', TEMPLATE_IDS.capTable, root)],
      [TEMPLATE_IDS.stockPosition]: positions.map((p, i) => activeContract(`pos-${i}`, TEMPLATE_IDS.stockPosition, p)),
      [TEMPLATE_IDS.stockIssuance]: issuances.map(([cid, data]) =>
        activeContract(cid, TEMPLATE_IDS.stockIssuance, { context: CONTEXT, issuance_data: data })
      ),
      [TEMPLATE_IDS.stockTransfer]: transfers.map(([cid, data]) =>
        activeContract(cid, TEMPLATE_IDS.stockTransfer, { context: CONTEXT, transfer_data: data })
      ),
      [TEMPLATE_IDS.vestingStart]: vestingRows('vestingStart'),
      [TEMPLATE_IDS.vestingEvent]: vestingRows('vestingEvent'),
      [TEMPLATE_IDS.vestingAcceleration]: vestingRows('vestingAcceleration'),
    },
    createArgumentsByContractId,
    templateIdsByContractId,
  });
}

/** Replay stock issuances and transfers in manifest order: a transfer consumes its source security. */
function replayBalances(transactions: Array<Record<string, unknown>>): Map<string, string> {
  const balances = new Map<string, { stakeholder: string; quantity: number }>();
  for (const tx of transactions) {
    if (tx.object_type === 'TX_STOCK_ISSUANCE') {
      balances.set(tx.security_id as string, {
        stakeholder: tx.stakeholder_id as string,
        quantity: Number(tx.quantity),
      });
    } else if (tx.object_type === 'TX_STOCK_TRANSFER') {
      const source = balances.get(tx.security_id as string);
      if (source === undefined) throw new Error(`transfer ${String(tx.id)} replays before its source issuance`);
      balances.delete(tx.security_id as string);
    }
  }
  const byStakeholder = new Map<string, string>();
  for (const [securityId, { stakeholder, quantity }] of [...balances].sort(([a], [b]) => a.localeCompare(b))) {
    byStakeholder.set(`${stakeholder}:${securityId}`, String(quantity));
  }
  return byStakeholder;
}

describe('extractCantonOcfManifest on a position-managed book', () => {
  it('includes the registry-written history so the export replays to the positions', async () => {
    const client = book(true) as unknown as LedgerJsonApiClient;
    const state = await getCapTableState(client, ISSUER);
    if (state === null) throw new Error('expected a CapTable');

    const manifest = await extractCantonOcfManifest(client, state);

    expect(manifest.transactions.map((tx) => tx.id)).toEqual([
      'ISS-S1',
      'T-TR-0',
      'T-ISS-B-0',
      'T-ISS-R-0',
      'V-TR-0',
      'V-ISS-B-0',
      'V-ISS-R-0',
    ]);
    const positionBalances = new Map(
      (state.positionState?.positions ?? []).flatMap((p) =>
        p.lots.map((lot) => [`${p.position.stakeholder_id}:${lot.securityId}`, lot.total] as const)
      )
    );
    expect(replayBalances(manifest.transactions)).toEqual(
      new Map([...positionBalances].sort(([a], [b]) => a.split(':')[1]!.localeCompare(b.split(':')[1]!)))
    );
    expect(manifest.positions).toEqual({
      managedStockClassIds: ['CLASS-MANAGED'],
      supersededStockIssuanceIds: ['ISS-S1'],
      registryTransactionIds: ['T-ISS-B-0', 'T-ISS-R-0', 'T-TR-0', 'V-ISS-B-0', 'V-ISS-R-0', 'V-TR-0'],
      unattributedRecords: [],
    });
  });

  it('includes the vesting records a registry wrote, each after the issuance of the lot it names', async () => {
    const client = book(true, {
      vesting: [
        // On the remainder lot T-R-0, dated the day Registry_Transfer issued it: the dependency order puts it after
        // T-ISS-R-0, which the date and weight order alone would not (a re-papered issuance weighs more).
        ['vestingStart', 'vs-tr-cid', damlVestingCondition('T-VS-0', 'T-R-0', { date: T_DATE })],
        ['vestingAcceleration', 'va-vr-cid', damlVestingAcceleration('V-VA-0', 'V-R-0', { date: V_DATE })],
        // On the migrated root security S1, before any transfer.
        ['vestingEvent', 've-s1-cid', damlVestingCondition('S1-VE-0', 'S1', { date: '2024-06-01T00:00:00Z' })],
      ],
    }) as unknown as LedgerJsonApiClient;
    const state = await getCapTableState(client, ISSUER);
    if (state === null) throw new Error('expected a CapTable');

    const manifest = await extractCantonOcfManifest(client, state);

    expect(manifest.transactions.map((tx) => tx.id)).toEqual([
      'ISS-S1',
      'S1-VE-0',
      'T-TR-0',
      'T-ISS-B-0',
      'T-ISS-R-0',
      'T-VS-0',
      'V-TR-0',
      'V-ISS-B-0',
      'V-ISS-R-0',
      'V-VA-0',
    ]);
    expect(manifest.transactions.find((tx) => tx.id === 'T-VS-0')).toMatchObject({
      object_type: 'TX_VESTING_START',
      security_id: 'T-R-0',
      vesting_condition_id: 'COND-1',
    });
    expect(manifest.transactions.find((tx) => tx.id === 'V-VA-0')).toMatchObject({
      object_type: 'TX_VESTING_ACCELERATION',
      security_id: 'V-R-0',
      quantity: '10',
    });
    expect(manifest.positions?.registryTransactionIds).toEqual([
      'S1-VE-0',
      'T-ISS-B-0',
      'T-ISS-R-0',
      'T-TR-0',
      'T-VS-0',
      'V-ISS-B-0',
      'V-ISS-R-0',
      'V-TR-0',
      'V-VA-0',
    ]);
    expect(manifest.positions?.unattributedRecords).toEqual([]);
  });

  it('lists the ledger records it leaves out and warns about them, whatever the verbosity', async () => {
    const client = book(true, {
      issuances: [['iss-orphan-cid', damlIssuance('O1', { id: 'ORPHAN-ISS', stock_class_id: 'CLASS-FREE' })]],
      // A vesting record on O1, a security no lot has.
      vesting: [['vestingEvent', 've-orphan-cid', damlVestingCondition('ORPHAN-VE', 'O1')]],
    }) as unknown as LedgerJsonApiClient;
    const state = await getCapTableState(client, ISSUER);
    if (state === null) throw new Error('expected a CapTable');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const manifest = await extractCantonOcfManifest(client, state);

      expect(manifest.transactions.map((tx) => tx.id)).not.toContain('ORPHAN-ISS');
      expect(manifest.transactions.map((tx) => tx.id)).not.toContain('ORPHAN-VE');
      expect(manifest.positions?.unattributedRecords).toEqual([
        { entityType: 'stockIssuance', id: 'ORPHAN-ISS', contractId: 'iss-orphan-cid' },
        { entityType: 'vestingEvent', id: 'ORPHAN-VE', contractId: 've-orphan-cid' },
      ]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain(
        'stockIssuance ORPHAN-ISS (iss-orphan-cid), vestingEvent ORPHAN-VE (ve-orphan-cid)'
      );
    } finally {
      warn.mockRestore();
    }

    // A caller's logger gets the warning instead of the console.
    const logger = jest.fn();
    await extractCantonOcfManifest(client, state, { logger });
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('they are not in the manifest'));
  });

  it('refuses to export a book whose registry-written records reuse an OCF ID or a security ID', async () => {
    const client = book(true, {
      // Registry_Issue takes caller-chosen IDs: one reuses T-ISS-B-0, another the migrated root security S1.
      issuances: [
        ['iss-dup-id-cid', damlIssuance('W-B-0', { id: 'T-ISS-B-0', stakeholder_id: 'SH-THIRD' })],
        ['iss-dup-sec-cid', damlIssuance('S1', { id: 'W-ISS-S1', stakeholder_id: 'SH-THIRD' })],
      ],
      // So does Registry_RecordVesting.
      vesting: [
        ['vestingStart', 'vs-1-cid', damlVestingCondition('T-VS-0', 'T-R-0')],
        ['vestingStart', 'vs-2-cid', damlVestingCondition('T-VS-0', 'V-R-0')],
      ],
    }) as unknown as LedgerJsonApiClient;
    const state = await getCapTableState(client, ISSUER);
    if (state === null) throw new Error('expected a CapTable');

    const exported = extractCantonOcfManifest(client, state);

    await expect(exported).rejects.toThrow(OcpContractError);
    await expect(exported).rejects.toThrow(
      'The OCF export cannot run on CapTable ct-1: position registries wrote records whose OCF IDs or security IDs ' +
        'are not unique (stockIssuance T-ISS-B-0 is carried by registry-written records iss-tb-cid, iss-dup-id-cid; ' +
        'vestingStart T-VS-0 is carried by registry-written records vs-1-cid, vs-2-cid; ' +
        'stockIssuance security_id S1 is carried by root record iss-s1-cid and registry-written record(s) ' +
        'iss-dup-sec-cid)'
    );
  });

  it('keeps the manifest of a book without positions unchanged (root maps only, no positions key)', async () => {
    const client = book(false) as unknown as LedgerJsonApiClient;
    const state = await getCapTableState(client, ISSUER);
    if (state === null) throw new Error('expected a CapTable');

    const manifest = await extractCantonOcfManifest(client, state);

    expect(manifest.transactions.map((tx) => tx.id)).toEqual(['ISS-S1']);
    expect(manifest).not.toHaveProperty('positions');
    expect(Object.keys(manifest).sort()).toEqual([
      'documents',
      'financings',
      'issuer',
      'stakeholders',
      'stockClasses',
      'stockLegendTemplates',
      'stockPlans',
      'transactions',
      'valuations',
      'vestingTerms',
    ]);
  });
});
