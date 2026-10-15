/**
 * CapTableBatch refuses, before submission, every write the ledger's root guard for position-managed holdings
 * (OpenCapTable-v34 0.0.4 validatePositionManagedWrites) would reject.
 */

import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import { PositionManagedWriteError } from '../../src/functions/OpenCapTable/positions/PositionManagedWriteError';
import type { CapTablePositionState } from '../../src/functions/OpenCapTable/positions/positionTypes';
import type { OcfStockIssuance, OcfStockTransfer } from '../../src/types';
import { capTablePayload, CONTEXT, damlIssuance, mockLedger, TEMPLATE_IDS } from '../positions/positionFixtures';

const CAP_TABLE = 'ct-1';

function issuance(id: string, securityId: string, stockClassId: string, quantity = '10'): OcfStockIssuance {
  return {
    object_type: 'TX_STOCK_ISSUANCE',
    id,
    date: '2025-01-01',
    security_id: securityId,
    custom_id: `CS-${securityId}`,
    stakeholder_id: 'SH-1',
    stock_class_id: stockClassId,
    quantity,
    share_price: { amount: '1', currency: 'USD' },
    security_law_exemptions: [],
    stock_legend_ids: [],
  };
}

function transfer(id: string, securityId: string, resulting: string[]): OcfStockTransfer {
  return {
    object_type: 'TX_STOCK_TRANSFER',
    id,
    date: '2025-02-01',
    security_id: securityId,
    quantity: '1',
    resulting_security_ids: resulting,
  };
}

const ROOT_TRANSFER = {
  id: 'ROOT-TR',
  date: '2024-06-01T00:00:00Z',
  quantity: '1.0000000000',
  security_id: 'S-MIG-PARENT',
  comments: [],
  resulting_security_ids: ['S-MIG'],
  balance_security_id: null,
  consideration_text: null,
};

/**
 * A 0.0.4 book: CLASS-M is position-managed, S-MIG migrated with S-ANC in its provenance, CLASS-F unmanaged.
 *
 * As on mainnet, the client's own party (a transfer agent's) is no stakeholder of the CapTable or its records: the
 * ledger shows them only to reads that name the issuer.
 */
function positionLedger(withPositions = true) {
  const client = mockLedger({
    contractsVisibleOnlyTo: CONTEXT.issuer,
    activeByTemplate: {},
    createArgumentsByContractId: {
      [CAP_TABLE]: capTablePayload({
        stockClasses: [
          ['CLASS-M', 'class-m-cid'],
          ['CLASS-F', 'class-f-cid'],
        ],
        stockIssuances: [
          ['ISS-ANC', 'iss-anc-cid'],
          ['ISS-FREE', 'iss-free-cid'],
        ],
        stockIssuancesBySecurityId: [
          ['S-ANC', 'iss-anc-cid'],
          ['S-FREE', 'iss-free-cid'],
        ],
        stockTransfers: [['ROOT-TR', 'root-tr-cid']],
        ...(withPositions
          ? {
              positionRegistries: [['CLASS-M', 'registry-cid']],
              migrated: [['S-MIG', 'SH-1']],
              ancestors: [['S-ANC', 'S-MIG']],
            }
          : {}),
      }),
      'iss-anc-cid': {
        context: CONTEXT,
        issuance_data: damlIssuance('S-ANC', { id: 'ISS-ANC', stock_class_id: 'CLASS-M' }),
      },
      'iss-free-cid': {
        context: CONTEXT,
        issuance_data: damlIssuance('S-FREE', { id: 'ISS-FREE', stock_class_id: 'CLASS-F' }),
      },
      'root-tr-cid': { context: CONTEXT, transfer_data: ROOT_TRANSFER },
    },
    templateIdsByContractId: {
      [CAP_TABLE]: TEMPLATE_IDS.capTable,
      'iss-anc-cid': TEMPLATE_IDS.stockIssuance,
      'iss-free-cid': TEMPLATE_IDS.stockIssuance,
      'root-tr-cid': TEMPLATE_IDS.stockTransfer,
    },
  });
  const submitAndWaitForTransaction = jest.fn().mockResolvedValue({
    transaction: {
      updateId: 'update-1',
      events: [
        {
          ExercisedEvent: {
            choice: 'UpdateCapTable',
            exerciseResult: { updatedCapTableCid: 'ct-2', createdCids: [], editedCids: [] },
          },
        },
      ],
    },
  });
  return Object.assign(client, { submitAndWaitForTransaction });
}

/** A CapTableState of the CapTable; the `positionState` field is left out when undefined. */
function stateWith(positionState: unknown, contractIds: CapTableState['contractIds'] = new Map()): CapTableState {
  return {
    capTableContractId: CAP_TABLE,
    issuerContractId: 'issuer-cid',
    entities: new Map(),
    contractIds,
    securityIds: new Map(),
    ...(positionState === undefined ? {} : { positionState }),
  } as CapTableState;
}

/** A position state with CLASS-M managed. */
function managedState(overrides: Partial<CapTablePositionState> = {}): CapTablePositionState {
  return {
    enabled: true,
    registries: new Map([['CLASS-M', 'registry-cid']]),
    migratedSecurityIds: new Map(),
    ancestorSecurityIds: new Map(),
    capTableContractId: CAP_TABLE,
    offset: 9,
    positions: [],
    supersededStockIssuances: new Map(),
    registryRecords: new Map(),
    stockClassBySecurityId: new Map(),
    referencedStakeholderIds: new Set(),
    referencedObjectIds: new Map(),
    unattributedRecords: [],
    conflictingRecords: [],
    ...overrides,
  };
}

function batchFor(client: ReturnType<typeof positionLedger>, capTableState?: CapTableState): CapTableBatch {
  return new CapTableBatch(
    { capTableContractId: CAP_TABLE, actAs: [CONTEXT.issuer], ...(capTableState ? { capTableState } : {}) },
    client as never
  );
}

async function refusalsOf(batch: CapTableBatch): Promise<Record<string, string[]>> {
  const error = await batch.execute().then(
    () => {
      throw new Error('expected the batch to be refused');
    },
    (caught: unknown) => caught
  );
  if (!(error instanceof PositionManagedWriteError)) throw error;
  return Object.fromEntries(
    error.refusals.map((refusal) => [
      `${refusal.operation} ${refusal.entityType} ${refusal.id}`,
      refusal.violations.map((v) => (v.version ? `${v.reason}/${v.version}` : v.reason)),
    ])
  );
}

describe('CapTableBatch position guard', () => {
  it('refuses every write the ledger guard rejects, naming each item and reason, before submitting', async () => {
    const client = positionLedger();
    const batch = batchFor(client)
      .create('stakeholder', {
        object_type: 'STAKEHOLDER',
        id: 'SH-NEW',
        name: { legal_name: 'New Buyer' },
        stakeholder_type: 'INDIVIDUAL',
      })
      .create('stockIssuance', issuance('ISS-NEW-M', 'S-NEW-M', 'CLASS-M'))
      .create('stockTransfer', transfer('TR-ANC', 'S-ANC', ['S-X']))
      .create('stockTransfer', transfer('TR-FREE', 'S-FREE', ['S-Y']))
      .edit('stockIssuance', issuance('ISS-FREE', 'S-FREE', 'CLASS-M'))
      .delete('stockTransfer', 'ROOT-TR')
      .delete('stockClass', 'CLASS-M');

    expect(await refusalsOf(batch)).toEqual({
      'create stockIssuance ISS-NEW-M': ['managed_class_record/proposed'],
      'create stockTransfer TR-ANC': ['ancestor_security/proposed', 'managed_class_security/proposed'],
      'edit stockIssuance ISS-FREE': ['managed_class_record/proposed'],
      'delete stockTransfer ROOT-TR': ['migrated_security/stored'],
      'delete stockClass CLASS-M': ['managed_stock_class_delete'],
    });
    expect(client.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('throws a typed validation error that carries the refusals', async () => {
    const batch = batchFor(positionLedger()).delete('stockClass', 'CLASS-M');

    const error = await batch.execute().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PositionManagedWriteError);
    expect(error).toBeInstanceOf(OcpValidationError);
    expect(error).toMatchObject({
      code: OcpErrorCodes.POSITION_MANAGED_WRITE,
      capTableContractId: CAP_TABLE,
      refusals: [{ operation: 'delete', entityType: 'stockClass', id: 'CLASS-M' }],
    });
    expect((error as Error).message).toContain('delete stockClass CLASS-M: stock class CLASS-M is position-managed');
  });

  it('submits a batch the ledger guard accepts', async () => {
    const client = positionLedger();
    const batch = batchFor(client)
      .create('stockIssuance', issuance('ISS-NEW-F', 'S-NEW-F', 'CLASS-F'))
      .edit('stockIssuance', issuance('ISS-FREE', 'S-FREE', 'CLASS-F', '11'));

    await expect(batch.findPositionManagedWrites()).resolves.toEqual([]);
    await expect(batch.execute()).resolves.toMatchObject({ updateId: 'update-1' });
    expect(client.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
  });

  it('reads only the CapTable, as the submitting parties, for a book without positions', async () => {
    // A transfer agent's client submitting as the issuer, with no readAs: its own party cannot see the CapTable.
    const client = positionLedger(false);
    const batch = batchFor(client)
      .create('stockIssuance', issuance('ISS-NEW-M', 'S-NEW-M', 'CLASS-M'))
      .delete('stockTransfer', 'ROOT-TR')
      .delete('stakeholder', 'SH-1');

    await expect(batch.execute()).resolves.toMatchObject({ updateId: 'update-1' });
    expect(client.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    expect(client.getEventsByContractId.mock.calls.map((call) => call[0])).toEqual([
      { contractId: CAP_TABLE, readAs: [CONTEXT.issuer] },
    ]);
  });

  it('reads stored versions as the submitting parties too, with readAs added once', async () => {
    const client = positionLedger();
    const batch = new CapTableBatch(
      { capTableContractId: CAP_TABLE, actAs: [CONTEXT.issuer], readAs: [CONTEXT.issuer, 'auditor::party'] },
      client as never
    ).delete('stockTransfer', 'ROOT-TR');

    expect(await refusalsOf(batch)).toEqual({ 'delete stockTransfer ROOT-TR': ['migrated_security/stored'] });
    expect(client.getEventsByContractId.mock.calls.map((call) => call[0])).toEqual([
      { contractId: CAP_TABLE, readAs: [CONTEXT.issuer, 'auditor::party'] },
      { contractId: 'root-tr-cid', readAs: [CONTEXT.issuer, 'auditor::party'] },
    ]);
  });

  it('wraps a failed check read with the batch context, before submitting', async () => {
    const client = positionLedger();
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    // The submitting party cannot see the CapTable either.
    const batch = new CapTableBatch(
      { capTableContractId: CAP_TABLE, actAs: ['other-issuer::party'], logger },
      client as never
    ).delete('stakeholder', 'SH-1');

    const error = await batch.execute().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OcpContractError);
    expect(error).toMatchObject({
      contractId: CAP_TABLE,
      choice: 'UpdateCapTable',
      classification: 'position_check_failed',
      batchItems: { creates: [], edits: [], deletes: [{ entityType: 'stakeholder', id: 'SH-1' }] },
    });
    expect((error as Error).message).toMatch(
      /^Batch position check failed before submission: .*CONTRACT_EVENTS_NOT_FOUND.*\[batch: 0 creates, 0 edits, 1 deletes; types: Stakeholder\]$/
    );
    expect((error as OcpContractError).cause?.message).toContain('CONTRACT_EVENTS_NOT_FOUND');
    expect(logger.error).toHaveBeenCalledWith(
      'Position check before submission failed',
      expect.objectContaining({ operation: 'capTable.update', contractId: CAP_TABLE })
    );
    expect(client.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('reads nothing when given the state of a CapTable without positions', async () => {
    const client = positionLedger(false);

    await batchFor(client, stateWith(null)).delete('stockClass', 'CLASS-M').execute();

    expect(client.getEventsByContractId).not.toHaveBeenCalled();
  });

  describe('reads the CapTable instead of trusting a state that does not say whether it has positions', () => {
    it.each([
      ['without positionState', undefined],
      ['with a positionState deserialized from JSON', JSON.parse(JSON.stringify(managedState())) as unknown],
      [
        'with the positionState of another CapTable',
        managedState({ capTableContractId: 'ct-0', registries: new Map() }),
      ],
    ])('%s', async (_label, positionState) => {
      const client = positionLedger();
      const batch = batchFor(client, stateWith(positionState)).delete('stockClass', 'CLASS-M');

      expect(await refusalsOf(batch)).toEqual({ 'delete stockClass CLASS-M': ['managed_stock_class_delete'] });
      expect(client.getEventsByContractId.mock.calls.map((call) => call[0].contractId)).toEqual([CAP_TABLE]);
      expect(client.submitAndWaitForTransaction).not.toHaveBeenCalled();
    });
  });

  it('uses the position state of getCapTableState, including registry-written records', async () => {
    const client = positionLedger();
    const state = stateWith(
      managedState({
        migratedSecurityIds: new Map([['S-MIG', 'SH-1']]),
        registryRecords: new Map([
          ['stockIssuance', new Map()],
          ['stockTransfer', new Map([['T-TR-0', 'tr-cid']])],
        ]),
        stockClassBySecurityId: new Map([['T-B-0', 'CLASS-M']]),
      }),
      new Map([
        [
          'stockTransfer',
          new Map([
            ['ROOT-TR', 'root-tr-cid'],
            ['T-TR-0', 'tr-cid'],
          ]),
        ],
      ])
    );
    const batch = batchFor(client, state)
      .delete('stockTransfer', 'T-TR-0')
      .create('stockTransfer', transfer('TR-REG', 'T-B-0', ['S-Z']))
      .delete('stockTransfer', 'ROOT-TR');

    expect(await refusalsOf(batch)).toEqual({
      'create stockTransfer TR-REG': ['managed_class_security/proposed'],
      'delete stockTransfer T-TR-0': ['registry_record'],
      'delete stockTransfer ROOT-TR': ['migrated_security/stored'],
    });
    // The stored version of ROOT-TR is the only read; the CapTable itself is not read again.
    expect(client.getEventsByContractId.mock.calls.map((call) => call[0].contractId)).toEqual(['root-tr-cid']);
  });

  it('refuses edits and deletes of registry-written vesting records without reading them as root records', async () => {
    const client = positionLedger();
    const registryVesting = new Map([
      ['vestingStart', new Map([['T-VS-0', 'vs-cid']])],
      ['vestingAcceleration', new Map([['T-VA-0', 'va-cid']])],
    ] as const);
    const state = stateWith(
      managedState({
        registryRecords: new Map([['stockIssuance', new Map()], ['stockTransfer', new Map()], ...registryVesting]),
        stockClassBySecurityId: new Map([['T-B-0', 'CLASS-M']]),
      }),
      new Map(registryVesting)
    );
    const batch = batchFor(client, state)
      .edit('vestingStart', {
        object_type: 'TX_VESTING_START',
        id: 'T-VS-0',
        date: '2025-06-01',
        security_id: 'T-B-0',
        vesting_condition_id: 'COND-2',
      })
      .delete('vestingAcceleration', 'T-VA-0');

    expect(await refusalsOf(batch)).toEqual({
      'edit vestingStart T-VS-0': ['registry_record', 'managed_class_security/proposed'],
      'delete vestingAcceleration T-VA-0': ['registry_record'],
    });
    // The registry's contracts are not root records: no stored version is read for them.
    expect(client.getEventsByContractId).not.toHaveBeenCalled();
  });

  it('needs a client to check', async () => {
    const batch = new CapTableBatch({ capTableContractId: CAP_TABLE, actAs: [CONTEXT.issuer] });
    batch.delete('stockClass', 'CLASS-M');

    await expect(batch.findPositionManagedWrites()).rejects.toThrow('Cannot check the batch without a client');
  });
});
