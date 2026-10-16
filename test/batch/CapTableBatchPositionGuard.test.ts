/**
 * CapTableBatch refuses, before submission, every write the ledger's root guard for position-managed holdings
 * (OpenCapTable-v34 0.0.4 validatePositionManagedWrites) would reject.
 */

import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable';
import { ENTITY_TEMPLATE_ID_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import { PositionManagedWriteError } from '../../src/functions/OpenCapTable/positions/PositionManagedWriteError';
import type { CapTablePositionState } from '../../src/functions/OpenCapTable/positions/positionTypes';
import type { OcfStockIssuance, OcfStockTransfer, OcfVestingTerms } from '../../src/types';
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
 * A 0.0.4 book: CLASS-M is position-managed and its S-MIG migrated, CLASS-F unmanaged.
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
          ['ISS-MIG', 'iss-mig-cid'],
          ['ISS-FREE', 'iss-free-cid'],
        ],
        stockIssuancesBySecurityId: [
          ['S-MIG', 'iss-mig-cid'],
          ['S-FREE', 'iss-free-cid'],
        ],
        stockTransfers: [['ROOT-TR', 'root-tr-cid']],
        ...(withPositions ? { positionRegistries: [['CLASS-M', 'registry-cid']], migrated: [['S-MIG', 'SH-1']] } : {}),
      }),
      'iss-mig-cid': {
        context: CONTEXT,
        issuance_data: damlIssuance('S-MIG', { id: 'ISS-MIG', stock_class_id: 'CLASS-M' }),
      },
      'iss-free-cid': {
        context: CONTEXT,
        issuance_data: damlIssuance('S-FREE', { id: 'ISS-FREE', stock_class_id: 'CLASS-F' }),
      },
      'root-tr-cid': { context: CONTEXT, transfer_data: ROOT_TRANSFER },
    },
    templateIdsByContractId: {
      [CAP_TABLE]: TEMPLATE_IDS.capTable,
      'iss-mig-cid': TEMPLATE_IDS.stockIssuance,
      'iss-free-cid': TEMPLATE_IDS.stockIssuance,
      'root-tr-cid': TEMPLATE_IDS.stockTransfer,
    },
  });
  return withSubmit(client);
}

/** The client, submitting every batch as one successful UpdateCapTable. */
function withSubmit<T extends object>(client: T): T & { submitAndWaitForTransaction: jest.Mock } {
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
    capTableContractId: CAP_TABLE,
    offset: 9,
    positions: [],
    supersededStockIssuances: new Map(),
    registryRecords: new Map(),
    stockClassBySecurityId: new Map(),
    registrySecurityIds: new Set(),
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
      .create('stockTransfer', transfer('TR-MIG', 'S-MIG', ['S-X']))
      .create('stockTransfer', transfer('TR-FREE', 'S-FREE', ['S-Y']))
      .edit('stockIssuance', issuance('ISS-FREE', 'S-FREE', 'CLASS-M'))
      .delete('stockTransfer', 'ROOT-TR')
      .delete('stockClass', 'CLASS-M');

    expect(await refusalsOf(batch)).toEqual({
      'create stockIssuance ISS-NEW-M': ['managed_class_record/proposed'],
      // A migrated security's root issuance is in its managed class, so the class rule covers it.
      'create stockTransfer TR-MIG': ['managed_class_security/proposed'],
      'edit stockIssuance ISS-FREE': ['managed_class_record/proposed'],
      'delete stockTransfer ROOT-TR': ['managed_class_security/stored'],
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

    expect(await refusalsOf(batch)).toEqual({ 'delete stockTransfer ROOT-TR': ['managed_class_security/stored'] });
    // The CapTable, the stored transfer, and the root issuance of the security it names (S-MIG-PARENT has none).
    expect(client.getEventsByContractId.mock.calls.map((call) => call[0])).toEqual([
      { contractId: CAP_TABLE, readAs: [CONTEXT.issuer, 'auditor::party'] },
      { contractId: 'root-tr-cid', readAs: [CONTEXT.issuer, 'auditor::party'] },
      { contractId: 'iss-mig-cid', readAs: [CONTEXT.issuer, 'auditor::party'] },
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
        stockClassBySecurityId: new Map([['S-MIG', 'CLASS-M']]),
        registrySecurityIds: new Set(['T-B-0']),
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

    // TR-REG names the registry lot T-B-0, whose issuance the root does not list: the ledger guard does not see its
    // class (OCP's reference check rejects the transfer instead).
    expect(await refusalsOf(batch)).toEqual({
      'delete stockTransfer T-TR-0': ['registry_record'],
      'delete stockTransfer ROOT-TR': ['managed_class_security/stored'],
    });
    // The stored version of ROOT-TR is the only read: the CapTable and the security's class come from the state.
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
        registrySecurityIds: new Set(['T-B-0']),
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
      'edit vestingStart T-VS-0': ['registry_record'],
      'delete vestingAcceleration T-VA-0': ['registry_record'],
    });
    // The registry's contracts are not root records: no stored version is read for them.
    expect(client.getEventsByContractId).not.toHaveBeenCalled();
  });

  it('looks a security’s class up only among root issuances, with or without the state', async () => {
    // Registry_Transfer issued the buyer lot T-B-0 into CLASS-M; the root lists only S-MIG's issuance. OCP validates
    // no security of a return to pool, so the ledger accepts RTP-REG, and its root guard rejects RTP-MIG.
    const returnToPool = (id: string, securityId: string) => ({
      object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL' as const,
      id,
      date: '2025-02-01',
      security_id: securityId,
      stock_plan_id: 'PLAN',
      quantity: '5',
      reason_text: 'Returned',
    });
    const state = stateWith(
      managedState({
        migratedSecurityIds: new Map([['S-MIG', 'SH-1']]),
        registryRecords: new Map([['stockIssuance', new Map([['T-ISS-B-0', 'iss-tb-cid']])]]),
        stockClassBySecurityId: new Map([['S-MIG', 'CLASS-M']]),
        registrySecurityIds: new Set(['T-B-0']),
      })
    );
    const refusals = async (capTableState?: CapTableState) =>
      batchFor(positionLedger(), capTableState)
        .create('stockPlanReturnToPool', returnToPool('RTP-REG', 'T-B-0'))
        .create('stockPlanReturnToPool', returnToPool('RTP-MIG', 'S-MIG'))
        .findPositionManagedWrites();

    const expected = [
      {
        operation: 'create',
        entityType: 'stockPlanReturnToPool',
        id: 'RTP-MIG',
        violations: [
          {
            reason: 'managed_class_security',
            version: 'proposed',
            securityId: 'S-MIG',
            stockClassId: 'CLASS-M',
            message:
              'stock plan return to pool RTP-MIG (proposed) references security S-MIG of position-managed class CLASS-M',
          },
        ],
      },
    ];
    await expect(refusals(state)).resolves.toEqual(expected);
    await expect(refusals()).resolves.toEqual(expected);
  });

  describe('keeps vesting terms behind position lots as they are (validatePositionVestingTerms)', () => {
    /** OCF vesting terms with one start condition per ID. */
    const vestingTerms = (id: string, conditionIds: string[], description = 'Vesting'): OcfVestingTerms => {
      const [first, ...rest] = conditionIds.map((conditionId) => ({
        id: conditionId,
        quantity: '0',
        trigger: { type: 'VESTING_START_DATE' as const },
        next_condition_ids: [],
      }));
      if (first === undefined) throw new Error('vesting terms need a condition');
      return {
        object_type: 'VESTING_TERMS',
        id,
        name: id,
        description,
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [first, ...rest],
      };
    };
    /** Vesting terms as the ledger stores them, with a start condition per ID. */
    const storedTerms = (id: string, conditionIds: string[]) => ({
      context: CONTEXT,
      vesting_terms_data: {
        id,
        name: id,
        description: 'Vesting',
        allocation_type: 'OcfAllocationCumulativeRounding',
        comments: [],
        vesting_conditions: conditionIds.map((conditionId) => ({
          id: conditionId,
          description: null,
          portion: null,
          quantity: '0.0000000000',
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: [],
        })),
      },
    });
    const issuanceOn = (securityId: string, stockClassId: string, vestingTermsId: string) => ({
      context: CONTEXT,
      issuance_data: damlIssuance(securityId, { stock_class_id: stockClassId, vesting_terms_id: vestingTermsId }),
    });
    // CLASS-M is position-managed: S-MIG migrated on VT-MIG, ISS-S-PRE not yet (VT-PRE). ISS-S-U of the unmanaged
    // CLASS-F is on VT-U. VT-U2, VT-FREE and VT-LOT are on no root issuance.
    const termsIds = ['VT-MIG', 'VT-PRE', 'VT-U', 'VT-U2', 'VT-FREE', 'VT-LOT'];
    const vestingLedger = () =>
      withSubmit(
        mockLedger({
          contractsVisibleOnlyTo: CONTEXT.issuer,
          activeByTemplate: {},
          createArgumentsByContractId: {
            [CAP_TABLE]: capTablePayload({
              stockIssuances: [
                ['ISS-S-MIG', 'iss-mig-cid'],
                ['ISS-S-PRE', 'iss-pre-cid'],
                ['ISS-S-U', 'iss-u-cid'],
              ],
              stockIssuancesBySecurityId: [
                ['S-MIG', 'iss-mig-cid'],
                ['S-PRE', 'iss-pre-cid'],
                ['S-U', 'iss-u-cid'],
              ],
              vestingTerms: termsIds.map((id) => [id, `${id.toLowerCase()}-cid`]),
              positionRegistries: [['CLASS-M', 'registry-cid']],
              migrated: [['S-MIG', 'SH-SELLER']],
            }),
            'iss-mig-cid': issuanceOn('S-MIG', 'CLASS-M', 'VT-MIG'),
            'iss-pre-cid': issuanceOn('S-PRE', 'CLASS-M', 'VT-PRE'),
            'iss-u-cid': issuanceOn('S-U', 'CLASS-F', 'VT-U'),
            ...Object.fromEntries(termsIds.map((id) => [`${id.toLowerCase()}-cid`, storedTerms(id, ['start'])])),
          },
          templateIdsByContractId: {
            [CAP_TABLE]: TEMPLATE_IDS.capTable,
            'iss-mig-cid': TEMPLATE_IDS.stockIssuance,
            'iss-pre-cid': TEMPLATE_IDS.stockIssuance,
            'iss-u-cid': TEMPLATE_IDS.stockIssuance,
            ...Object.fromEntries(
              termsIds.map((id) => [`${id.toLowerCase()}-cid`, ENTITY_TEMPLATE_ID_MAP.vestingTerms])
            ),
          },
        })
      );
    const batchOn = (client: ReturnType<typeof vestingLedger>, capTableState?: CapTableState) =>
      new CapTableBatch(
        { capTableContractId: CAP_TABLE, actAs: [CONTEXT.issuer], ...(capTableState ? { capTableState } : {}) },
        client as never
      );

    it('refuses edits and deletes of terms a managed root issuance names, and edits that drop a condition', async () => {
      const client = vestingLedger();
      const refusals = await batchOn(client)
        .edit('vestingTerms', vestingTerms('VT-MIG', ['start'], 'Corrected'))
        .delete('vestingTerms', 'VT-PRE')
        .edit('vestingTerms', vestingTerms('VT-U', ['begin']))
        .edit('vestingTerms', vestingTerms('VT-U2', ['start', 'cliff'], 'Corrected'))
        .delete('vestingTerms', 'VT-FREE')
        .findPositionManagedWrites();

      expect(refusals).toEqual([
        {
          operation: 'edit',
          entityType: 'vestingTerms',
          id: 'VT-MIG',
          violations: [
            {
              reason: 'managed_vesting_terms',
              stockClassId: 'CLASS-M',
              securityId: 'S-MIG',
              message: 'vesting terms VT-MIG are named by security S-MIG of position-managed class CLASS-M',
            },
          ],
        },
        {
          operation: 'edit',
          entityType: 'vestingTerms',
          id: 'VT-U',
          violations: [
            {
              reason: 'removed_vesting_condition',
              version: 'proposed',
              message: 'vesting terms VT-U (proposed) removes vesting condition start',
            },
          ],
        },
        {
          operation: 'delete',
          entityType: 'vestingTerms',
          id: 'VT-PRE',
          violations: [
            {
              reason: 'managed_vesting_terms',
              stockClassId: 'CLASS-M',
              securityId: 'S-PRE',
              message: 'vesting terms VT-PRE are named by security S-PRE of position-managed class CLASS-M',
            },
          ],
        },
      ]);
      // As the ledger does: the CapTable, every root stock issuance, and the stored version of each edited terms.
      expect(client.getEventsByContractId.mock.calls.map((call) => call[0].contractId)).toEqual([
        CAP_TABLE,
        'iss-mig-cid',
        'iss-pre-cid',
        'iss-u-cid',
        'vt-mig-cid',
        'vt-u-cid',
        'vt-u2-cid',
      ]);
    });

    it('submits edits of unmanaged terms that keep every condition, and deletes of unused terms', async () => {
      const client = vestingLedger();
      const batch = batchOn(client)
        .edit('vestingTerms', vestingTerms('VT-U', ['start', 'cliff'], 'Corrected'))
        .delete('vestingTerms', 'VT-FREE');

      await expect(batch.findPositionManagedWrites()).resolves.toEqual([]);
      await expect(batch.execute()).resolves.toMatchObject({ updateId: 'update-1' });
      expect(client.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    });

    it('also refuses, given the state, edits and deletes of terms only a registry-written lot names', async () => {
      // The registry's lots T-B-0 and T-B-1 are on VT-FREE and VT-LOT; the root lists no issuance of them, so only the
      // state can tell. An edit that keeps every condition is refused too: OCP leaves such terms to root writers.
      const client = vestingLedger();
      const state = stateWith(
        managedState({
          migratedSecurityIds: new Map([['S-MIG', 'SH-SELLER']]),
          registryRecords: new Map([
            [
              'stockIssuance',
              new Map([
                ['T-ISS-B-0', 'iss-tb-cid'],
                ['T-ISS-B-1', 'iss-tb1-cid'],
              ]),
            ],
          ]),
          stockClassBySecurityId: new Map([
            ['S-MIG', 'CLASS-M'],
            ['S-PRE', 'CLASS-M'],
            ['S-U', 'CLASS-F'],
          ]),
          registrySecurityIds: new Set(['T-B-0', 'T-B-1']),
          referencedObjectIds: new Map([['vestingTerms', new Set(['VT-MIG', 'VT-FREE', 'VT-LOT'])]]),
        }),
        new Map([
          [
            'stockIssuance',
            new Map([
              ['ISS-S-MIG', 'iss-mig-cid'],
              ['ISS-S-PRE', 'iss-pre-cid'],
              ['ISS-S-U', 'iss-u-cid'],
              ['T-ISS-B-0', 'iss-tb-cid'],
              ['T-ISS-B-1', 'iss-tb1-cid'],
            ]),
          ],
          ['vestingTerms', new Map(termsIds.map((id) => [id, `${id.toLowerCase()}-cid`]))],
        ])
      );

      expect(
        await refusalsOf(
          batchOn(client, state)
            .delete('vestingTerms', 'VT-FREE')
            .edit('vestingTerms', vestingTerms('VT-LOT', ['start'], 'Corrected'))
            .edit('vestingTerms', vestingTerms('VT-U2', ['start'], 'Corrected'))
        )
      ).toEqual({
        'edit vestingTerms VT-LOT': ['referenced_object'],
        'delete vestingTerms VT-FREE': ['referenced_object'],
      });
      expect(client.submitAndWaitForTransaction).not.toHaveBeenCalled();
      // The root stock issuances only: the registry's are not in the root maps.
      expect(client.getEventsByContractId.mock.calls.map((call) => call[0].contractId)).toEqual([
        'iss-mig-cid',
        'iss-pre-cid',
        'iss-u-cid',
        'vt-lot-cid',
        'vt-u2-cid',
      ]);
    });
  });

  it('needs a client to check', async () => {
    const batch = new CapTableBatch({ capTableContractId: CAP_TABLE, actAs: [CONTEXT.issuer] });
    batch.delete('stockClass', 'CLASS-M');

    await expect(batch.findPositionManagedWrites()).rejects.toThrow('Cannot check the batch without a client');
  });
});
