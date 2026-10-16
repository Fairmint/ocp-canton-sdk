/**
 * getCapTableState on a CapTable with position registries (OpenCapTable-v34 0.0.4): the root maps are no longer the
 * whole book, so the state also lists the create-only records the registries wrote and the position-managed state.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError } from '../../src/errors';
import { classifyIssuerCapTables, getCapTableState } from '../../src/functions/OpenCapTable/capTable';
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
  OFFSET,
  TEMPLATE_IDS,
} from '../positions/positionFixtures';

jest.mock('@fairmint/canton-node-sdk');

const ISSUER = CONTEXT.issuer;

/** Active vesting record contracts of the cap table's context, by template. */
interface VestingRecordRows {
  vestingStart?: Array<Record<string, unknown>>;
  vestingEvent?: Array<Record<string, unknown>>;
  vestingAcceleration?: Array<Record<string, unknown>>;
}

const vestingStart = (contractId: string, data: Record<string, unknown>, context: object = CONTEXT) =>
  activeContract(contractId, TEMPLATE_IDS.vestingStart, { context, vesting_data: data });
const vestingEvent = (contractId: string, data: Record<string, unknown>) =>
  activeContract(contractId, TEMPLATE_IDS.vestingEvent, { context: CONTEXT, vesting_data: data });
const vestingAcceleration = (contractId: string, data: Record<string, unknown>) =>
  activeContract(contractId, TEMPLATE_IDS.vestingAcceleration, { context: CONTEXT, acceleration_data: data });

/**
 * A book with one migrated root issuance (S1 of SH-SELLER, 100 shares) in CLASS-MANAGED, an unmanaged root issuance
 * (U1), and one registry transfer T of 60 shares from S1 to SH-BUYER with a 40-share remainder.
 */
function positionBook(
  overrides: {
    extraIssuances?: Array<Record<string, unknown>>;
    extraTransfers?: Array<Record<string, unknown>>;
    rootIssuances?: Array<[string, string]>;
    rootVestingStarts?: Array<[string, string]>;
    vestingRecords?: VestingRecordRows;
  } = {}
) {
  const rootPayload = capTablePayload({
    stakeholders: [
      ['SH-SELLER', 'sh-seller-cid'],
      ['SH-OTHER', 'sh-other-cid'],
    ],
    stockClasses: [
      ['CLASS-MANAGED', 'class-managed-cid'],
      ['CLASS-FREE', 'class-free-cid'],
    ],
    stockIssuances: overrides.rootIssuances ?? [
      ['ISS-S1', 'iss-s1-cid'],
      ['ISS-U1', 'iss-u1-cid'],
    ],
    stockIssuancesBySecurityId: [
      ['S1', 'iss-s1-cid'],
      ['U1', 'iss-u1-cid'],
    ],
    positionRegistries: [['CLASS-MANAGED', 'registry-cid']],
    migrated: [['S1', 'SH-SELLER']],
  });
  rootPayload.vesting_starts = overrides.rootVestingStarts ?? [];
  const issuance = (contractId: string, data: Record<string, unknown>) =>
    activeContract(contractId, TEMPLATE_IDS.stockIssuance, { context: CONTEXT, issuance_data: data });
  const transfer = (contractId: string, data: Record<string, unknown>) =>
    activeContract(contractId, TEMPLATE_IDS.stockTransfer, { context: CONTEXT, transfer_data: data });

  return mockLedger({
    activeByTemplate: {
      [TEMPLATE_IDS.capTable]: [activeContract('ct-1', TEMPLATE_IDS.capTable, rootPayload)],
      [TEMPLATE_IDS.stockPosition]: [
        activeContract(
          'pos-seller',
          TEMPLATE_IDS.stockPosition,
          damlStockPosition([
            damlLot('T-R-0', {
              issuance: { quantity: '40', stock_legend_ids: ['LEGEND-1'], vesting_terms_id: 'VT-1' },
            }),
          ])
        ),
        activeContract(
          'pos-buyer',
          TEMPLATE_IDS.stockPosition,
          damlStockPosition([damlLot('T-B-0', { issuance: { quantity: '60', stakeholder_id: 'SH-BUYER' } })], {
            stakeholder_id: 'SH-BUYER',
            holder: 'buyer::party',
          })
        ),
      ],
      [TEMPLATE_IDS.stockIssuance]: [
        issuance('iss-s1-cid', damlIssuance('S1')),
        issuance('iss-u1-cid', damlIssuance('U1', { stock_class_id: 'CLASS-FREE', stakeholder_id: 'SH-OTHER' })),
        issuance(
          'iss-tb-cid',
          damlIssuance('T-B-0', {
            id: 'T-ISS-B-0',
            stakeholder_id: 'SH-BUYER',
            quantity: '60',
            stock_legend_ids: ['LEGEND-2'],
            stock_plan_id: 'PLAN-1',
          })
        ),
        issuance('iss-tr-cid', damlIssuance('T-R-0', { id: 'T-ISS-R-0', quantity: '40' })),
        // A record of another cap table's context is not this book's.
        activeContract('iss-foreign-cid', TEMPLATE_IDS.stockIssuance, {
          context: { issuer: ISSUER, system_operator: 'other-sysop::party' },
          issuance_data: damlIssuance('F1', { id: 'F-ISS' }),
        }),
        ...(overrides.extraIssuances ?? []),
      ],
      [TEMPLATE_IDS.stockTransfer]: [
        transfer('tr-cid', damlTransfer('T-TR-0', 'S1', ['T-B-0'], 'T-R-0')),
        ...(overrides.extraTransfers ?? []),
      ],
      [TEMPLATE_IDS.vestingStart]: overrides.vestingRecords?.vestingStart ?? [],
      [TEMPLATE_IDS.vestingEvent]: overrides.vestingRecords?.vestingEvent ?? [],
      [TEMPLATE_IDS.vestingAcceleration]: overrides.vestingRecords?.vestingAcceleration ?? [],
    },
    createArgumentsByContractId: { 'issuer-cid': { issuer_data: { id: 'ISSUER-1' } } },
  });
}

describe('getCapTableState with position registries', () => {
  it('reads a CapTable without position fields as before, marked as having no positions', async () => {
    const client = mockLedger({
      activeByTemplate: {
        [TEMPLATE_IDS.capTable]: [
          activeContract(
            'ct-1',
            TEMPLATE_IDS.capTable,
            capTablePayload({
              stockIssuances: [['ISS-S1', 'iss-s1-cid']],
              stockIssuancesBySecurityId: [['S1', 'iss-s1-cid']],
            })
          ),
        ],
      },
      createArgumentsByContractId: { 'issuer-cid': { issuer_data: { id: 'ISSUER-1' } } },
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    // null, not absent: a writer can tell "no positions" from a state nobody checked.
    expect(state?.positionState).toBeNull();
    expect(Object.keys(state ?? {}).sort()).toEqual([
      'capTableContractId',
      'contractIds',
      'entities',
      'issuerContractId',
      'positionState',
      'securityIds',
    ]);
    expect(client.getLedgerEnd).not.toHaveBeenCalled();
    expect(client.getActiveContracts).toHaveBeenCalledTimes(1);
    expect(client.getActiveContracts).toHaveBeenCalledWith({ parties: [ISSUER], templateIds: [TEMPLATE_IDS.capTable] });
  });

  it('lists registry-written records with the root records and attaches the position state', async () => {
    const client = positionBook();

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(state?.capTableContractId).toBe('ct-1');
    expect(state?.entities.get('stockIssuance')).toEqual(new Set(['ISS-S1', 'ISS-U1', 'T-ISS-B-0', 'T-ISS-R-0']));
    expect(state?.entities.get('stockTransfer')).toEqual(new Set(['T-TR-0']));
    expect(state?.contractIds.get('stockTransfer')).toEqual(new Map([['T-TR-0', 'tr-cid']]));
    expect(state?.contractIds.get('stockIssuance')?.get('T-ISS-B-0')).toBe('iss-tb-cid');
    expect(state?.securityIds.get('stockIssuance')).toEqual(new Set(['S1', 'U1', 'T-B-0', 'T-R-0']));

    const positionState = state?.positionState;
    expect(positionState).toBeDefined();
    expect(positionState?.enabled).toBe(true);
    expect(positionState?.capTableContractId).toBe('ct-1');
    expect(positionState?.offset).toBe(OFFSET);
    expect([...(positionState?.supersededStockIssuances ?? [])]).toEqual([['ISS-S1', 'S1']]);
    expect(positionState?.registryRecords.get('stockIssuance')).toEqual(
      new Map([
        ['T-ISS-B-0', 'iss-tb-cid'],
        ['T-ISS-R-0', 'iss-tr-cid'],
      ])
    );
    expect(positionState?.registryRecords.get('stockTransfer')).toEqual(new Map([['T-TR-0', 'tr-cid']]));
    // The ledger guard reads the classes of root issuances only; the registry's lots are listed apart.
    expect(positionState?.stockClassBySecurityId).toEqual(
      new Map([
        ['S1', 'CLASS-MANAGED'],
        ['U1', 'CLASS-FREE'],
      ])
    );
    expect(positionState?.registrySecurityIds).toEqual(new Set(['T-B-0', 'T-R-0']));
    expect(positionState?.referencedStakeholderIds).toEqual(new Set(['SH-SELLER', 'SH-BUYER']));
    expect(positionState?.referencedObjectIds).toEqual(
      new Map([
        ['stockLegendTemplate', new Set(['LEGEND-1', 'LEGEND-2'])],
        ['stockPlan', new Set(['PLAN-1'])],
        ['vestingTerms', new Set(['VT-1'])],
      ])
    );
    expect(positionState?.positions.map((p) => [p.contractId, p.totals.total])).toEqual([
      ['pos-seller', '40'],
      ['pos-buyer', '60'],
    ]);
    expect(positionState?.unattributedRecords).toEqual([]);
  });

  it('reads the root, positions and records at one ledger offset', async () => {
    const client = positionBook();

    await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    const calls = client.getActiveContracts.mock.calls.map((call) => call[0]);
    expect(calls[0]).toEqual({ parties: [ISSUER], templateIds: [TEMPLATE_IDS.capTable] });
    expect(calls.slice(1)).toEqual([
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.capTable], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.stockPosition], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.stockIssuance], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.stockTransfer], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.vestingStart], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.vestingEvent], activeAtOffset: OFFSET },
      { parties: [ISSUER], templateIds: [TEMPLATE_IDS.vestingAcceleration], activeAtOffset: OFFSET },
    ]);
  });

  it('keeps the archive context on classification', async () => {
    const client = positionBook();

    const classification = await classifyIssuerCapTables(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(classification.status).toBe('current');
    expect(classification.current?.systemOperatorPartyId).toBe(CONTEXT.system_operator);
    expect(classification.current?.positionState?.enabled).toBe(true);
  });

  it('reports unlisted records that no registry accounts for, without listing them as the book', async () => {
    const client = positionBook({
      extraIssuances: [
        activeContract('iss-orphan-cid', TEMPLATE_IDS.stockIssuance, {
          context: CONTEXT,
          issuance_data: damlIssuance('O1', { id: 'ORPHAN-ISS', stock_class_id: 'CLASS-FREE' }),
        }),
      ],
      extraTransfers: [
        activeContract('tr-orphan-cid', TEMPLATE_IDS.stockTransfer, {
          context: CONTEXT,
          transfer_data: damlTransfer('ORPHAN-TR', 'U1', ['O1'], null),
        }),
      ],
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(state?.positionState?.unattributedRecords).toEqual([
      { entityType: 'stockIssuance', id: 'ORPHAN-ISS', contractId: 'iss-orphan-cid' },
      { entityType: 'stockTransfer', id: 'ORPHAN-TR', contractId: 'tr-orphan-cid' },
    ]);
    expect(state?.entities.get('stockIssuance')?.has('ORPHAN-ISS')).toBe(false);
    expect(state?.entities.get('stockTransfer')?.has('ORPHAN-TR')).toBe(false);
  });

  it('attributes an unlisted transfer into a registry lot to no registry when it draws an unmanaged security', async () => {
    // Registry_Transfer draws a lot of the registry's class: a migrated root security (T-TR-0 draws S1) or a lot a
    // registry issued (T2-TR-0 draws the remainder T-R-0). U1 is an unmanaged root security, so a transfer from it to
    // the registry lot T-B-0 is no registry's, though its result is.
    const client = positionBook({
      extraIssuances: [
        activeContract('iss-t2b-cid', TEMPLATE_IDS.stockIssuance, {
          context: CONTEXT,
          issuance_data: damlIssuance('T2-B-0', { id: 'T2-ISS-B-0', stakeholder_id: 'SH-BUYER', quantity: '10' }),
        }),
      ],
      extraTransfers: [
        activeContract('tr-t2-cid', TEMPLATE_IDS.stockTransfer, {
          context: CONTEXT,
          transfer_data: damlTransfer('T2-TR-0', 'T-R-0', ['T2-B-0'], null),
        }),
        activeContract('tr-u1-cid', TEMPLATE_IDS.stockTransfer, {
          context: CONTEXT,
          transfer_data: damlTransfer('U1-TR', 'U1', ['T-B-0'], null),
        }),
      ],
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(state?.positionState?.registryRecords.get('stockTransfer')).toEqual(
      new Map([
        ['T-TR-0', 'tr-cid'],
        ['T2-TR-0', 'tr-t2-cid'],
      ])
    );
    expect(state?.positionState?.unattributedRecords).toEqual([
      { entityType: 'stockTransfer', id: 'U1-TR', contractId: 'tr-u1-cid' },
    ]);
    expect(state?.entities.get('stockTransfer')).toEqual(new Set(['T-TR-0', 'T2-TR-0']));
  });

  it('lists the vesting records a registry wrote for lots, and reports those that name no lot', async () => {
    const client = positionBook({
      rootVestingStarts: [['ROOT-VS', 'vs-root-cid']],
      vestingRecords: {
        vestingStart: [
          // Registry_RecordVesting on the remainder lot T-R-0 (a registry-written issuance's security).
          vestingStart('vs-tr-cid', damlVestingCondition('T-VS-0', 'T-R-0')),
          // A root record: the root maps list it.
          vestingStart('vs-root-cid', damlVestingCondition('ROOT-VS', 'U1')),
          // A record of another cap table's context is not this book's.
          vestingStart('vs-foreign-cid', damlVestingCondition('F-VS', 'T-R-0'), {
            issuer: ISSUER,
            system_operator: 'other-sysop::party',
          }),
        ],
        vestingEvent: [
          // On the migrated root security S1, which a migrated lot keeps.
          vestingEvent('ve-s1-cid', damlVestingCondition('S1-VE-0', 'S1')),
          // Unlisted, on the unmanaged root security U1: no lot has it, so nothing accounts for it.
          vestingEvent('ve-orphan-cid', damlVestingCondition('ORPHAN-VE', 'U1')),
        ],
        vestingAcceleration: [vestingAcceleration('va-tb-cid', damlVestingAcceleration('T-VA-0', 'T-B-0'))],
      },
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    const registryRecords = state?.positionState?.registryRecords;
    expect(registryRecords?.get('vestingStart')).toEqual(new Map([['T-VS-0', 'vs-tr-cid']]));
    expect(registryRecords?.get('vestingEvent')).toEqual(new Map([['S1-VE-0', 've-s1-cid']]));
    expect(registryRecords?.get('vestingAcceleration')).toEqual(new Map([['T-VA-0', 'va-tb-cid']]));
    // The book lists them with the root records, so readers and the export see them.
    expect(state?.contractIds.get('vestingStart')).toEqual(
      new Map([
        ['ROOT-VS', 'vs-root-cid'],
        ['T-VS-0', 'vs-tr-cid'],
      ])
    );
    expect(state?.entities.get('vestingEvent')).toEqual(new Set(['S1-VE-0']));
    expect(state?.entities.get('vestingAcceleration')).toEqual(new Set(['T-VA-0']));
    expect(state?.positionState?.unattributedRecords).toEqual([
      { entityType: 'vestingEvent', id: 'ORPHAN-VE', contractId: 've-orphan-cid' },
    ]);
    expect(state?.positionState?.conflictingRecords).toEqual([]);
  });

  it('lists vesting records whose OCF ID a root or another registry record of their type already carries', async () => {
    const client = positionBook({
      rootVestingStarts: [['ROOT-VS', 'vs-root-cid']],
      vestingRecords: {
        vestingStart: [
          vestingStart('vs-root-cid', damlVestingCondition('ROOT-VS', 'U1')),
          vestingStart('vs-dup-root-cid', damlVestingCondition('ROOT-VS', 'T-R-0')),
        ],
        vestingEvent: [
          vestingEvent('ve-1-cid', damlVestingCondition('T-VE-0', 'T-R-0')),
          vestingEvent('ve-2-cid', damlVestingCondition('T-VE-0', 'T-B-0')),
        ],
      },
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(state?.positionState?.conflictingRecords).toEqual([
      {
        entityType: 'vestingStart',
        field: 'id',
        value: 'ROOT-VS',
        rootContractId: 'vs-root-cid',
        registryContractIds: ['vs-dup-root-cid'],
      },
      {
        entityType: 'vestingEvent',
        field: 'id',
        value: 'T-VE-0',
        rootContractId: null,
        registryContractIds: ['ve-1-cid', 've-2-cid'],
      },
    ]);
    // The root record keeps its ID, else the first registry record.
    expect(state?.contractIds.get('vestingStart')?.get('ROOT-VS')).toBe('vs-root-cid');
    expect(state?.contractIds.get('vestingEvent')?.get('T-VE-0')).toBe('ve-1-cid');
  });

  describe('when a registry record reuses an OCF ID (the ledger does not check registry-chosen IDs)', () => {
    const duplicates = () =>
      positionBook({
        extraIssuances: [
          // Same ID as the root issuance ISS-U1.
          activeContract('iss-dup-root-cid', TEMPLATE_IDS.stockIssuance, {
            context: CONTEXT,
            issuance_data: damlIssuance('T-B-8', { id: 'ISS-U1', stakeholder_id: 'SH-BUYER' }),
          }),
          // Same ID as the registry issuance T-ISS-B-0.
          activeContract('iss-dup-reg-cid', TEMPLATE_IDS.stockIssuance, {
            context: CONTEXT,
            issuance_data: damlIssuance('T-B-9', { id: 'T-ISS-B-0', stakeholder_id: 'SH-BUYER' }),
          }),
        ],
      });

    it('reads the state and lists each collision with every record that carries the ID', async () => {
      const state = await getCapTableState(duplicates() as unknown as LedgerJsonApiClient, ISSUER);

      expect(state?.positionState?.conflictingRecords).toEqual([
        {
          entityType: 'stockIssuance',
          field: 'id',
          value: 'ISS-U1',
          rootContractId: 'iss-u1-cid',
          registryContractIds: ['iss-dup-root-cid'],
        },
        {
          entityType: 'stockIssuance',
          field: 'id',
          value: 'T-ISS-B-0',
          rootContractId: null,
          registryContractIds: ['iss-tb-cid', 'iss-dup-reg-cid'],
        },
      ]);
      // The root record keeps its ID, else the first registry record.
      expect(state?.contractIds.get('stockIssuance')?.get('ISS-U1')).toBe('iss-u1-cid');
      expect(state?.contractIds.get('stockIssuance')?.get('T-ISS-B-0')).toBe('iss-tb-cid');
      expect(state?.positionState?.registryRecords.get('stockIssuance')?.has('ISS-U1')).toBe(false);
      // Their securities and stakeholders still count as the registry's.
      expect(state?.positionState?.registrySecurityIds.has('T-B-9')).toBe(true);
      expect(state?.securityIds.get('stockIssuance')?.has('T-B-8')).toBe(true);
    });

    it('still classifies the cap table with its archive context', async () => {
      const classification = await classifyIssuerCapTables(duplicates() as unknown as LedgerJsonApiClient, ISSUER);

      expect(classification.status).toBe('current');
      expect(classification.current?.systemOperatorPartyId).toBe(CONTEXT.system_operator);
      expect(classification.current?.positionState?.conflictingRecords).toHaveLength(2);
    });
  });

  it('lists registry issuances that reuse a security ID of a root or another registry issuance', async () => {
    // Registry_Issue checks a security ID only against the lots of the position it issues into.
    const issuance = (contractId: string, securityId: string, id: string) =>
      activeContract(contractId, TEMPLATE_IDS.stockIssuance, {
        context: CONTEXT,
        issuance_data: damlIssuance(securityId, { id, stakeholder_id: 'SH-BUYER' }),
      });
    const client = positionBook({
      extraIssuances: [
        // The migrated root security S1, and the unmanaged root security U1 issued into the managed class.
        issuance('iss-new-s1-cid', 'S1', 'NEW-ISS-S1'),
        issuance('iss-new-u1-cid', 'U1', 'NEW-ISS-U1'),
        // The registry security T-B-0, issued into another position.
        issuance('iss-new-tb-cid', 'T-B-0', 'NEW-ISS-TB'),
      ],
    });

    const state = await getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER);

    expect(state?.positionState?.conflictingRecords).toEqual([
      {
        entityType: 'stockIssuance',
        field: 'security_id',
        value: 'T-B-0',
        rootContractId: null,
        registryContractIds: ['iss-tb-cid', 'iss-new-tb-cid'],
      },
      {
        entityType: 'stockIssuance',
        field: 'security_id',
        value: 'S1',
        rootContractId: 'iss-s1-cid',
        registryContractIds: ['iss-new-s1-cid'],
      },
      {
        entityType: 'stockIssuance',
        field: 'security_id',
        value: 'U1',
        rootContractId: 'iss-u1-cid',
        registryContractIds: ['iss-new-u1-cid'],
      },
    ]);
    // A shared security keeps the root issuance's class, which the ledger guard reads.
    expect(state?.positionState?.stockClassBySecurityId.get('U1')).toBe('CLASS-FREE');
    // The records keep their own OCF IDs.
    expect(state?.positionState?.registryRecords.get('stockIssuance')?.get('NEW-ISS-S1')).toBe('iss-new-s1-cid');
  });

  it('fails when the root lists an issuance that is not active at the offset', async () => {
    const client = positionBook({
      rootIssuances: [
        ['ISS-S1', 'iss-s1-cid'],
        ['ISS-U1', 'iss-u1-cid'],
        ['ISS-GONE', 'iss-gone-cid'],
      ],
    });

    await expect(getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER)).rejects.toThrow(OcpContractError);
  });
});
