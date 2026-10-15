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
  mockLedger,
  OFFSET,
  TEMPLATE_IDS,
} from '../positions/positionFixtures';

jest.mock('@fairmint/canton-node-sdk');

const ISSUER = CONTEXT.issuer;

function damlTransfer(id: string, securityId: string, resulting: string[], balance: string | null) {
  return {
    id,
    date: '2025-06-01T00:00:00Z',
    quantity: '60.0000000000',
    security_id: securityId,
    comments: [],
    resulting_security_ids: resulting,
    balance_security_id: balance,
    consideration_text: null,
  };
}

/**
 * A book with one migrated root issuance (S1 of SH-SELLER, 100 shares) in CLASS-MANAGED, an unmanaged root issuance
 * (U1), and one registry transfer T of 60 shares from S1 to SH-BUYER with a 40-share remainder.
 */
function positionBook(
  overrides: {
    extraIssuances?: Array<Record<string, unknown>>;
    extraTransfers?: Array<Record<string, unknown>>;
    rootIssuances?: Array<[string, string]>;
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
    ancestors: [],
  });
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
          damlStockPosition([damlLot('T-R-0', { issuance: { quantity: '40' } })])
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
        issuance('iss-tb-cid', damlIssuance('T-B-0', { id: 'T-ISS-B-0', stakeholder_id: 'SH-BUYER', quantity: '60' })),
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
    },
    createArgumentsByContractId: { 'issuer-cid': { issuer_data: { id: 'ISSUER-1' } } },
  });
}

describe('getCapTableState with position registries', () => {
  it('reads a CapTable without position fields exactly as before', async () => {
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

    expect(state).not.toHaveProperty('positionState');
    expect(Object.keys(state ?? {}).sort()).toEqual([
      'capTableContractId',
      'contractIds',
      'entities',
      'issuerContractId',
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
    expect(positionState?.stockClassBySecurityId).toEqual(
      new Map([
        ['S1', 'CLASS-MANAGED'],
        ['U1', 'CLASS-FREE'],
        ['T-B-0', 'CLASS-MANAGED'],
        ['T-R-0', 'CLASS-MANAGED'],
      ])
    );
    expect(positionState?.referencedStakeholderIds).toEqual(new Set(['SH-SELLER', 'SH-BUYER']));
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

  it('fails when a registry record reuses an OCF ID of the cap table', async () => {
    const client = positionBook({
      extraIssuances: [
        activeContract('iss-dup-cid', TEMPLATE_IDS.stockIssuance, {
          context: CONTEXT,
          issuance_data: damlIssuance('T-B-9', { id: 'ISS-U1' }),
        }),
      ],
    });

    await expect(getCapTableState(client as unknown as LedgerJsonApiClient, ISSUER)).rejects.toThrow(
      /reuses an OCF ID already on the cap table/
    );
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
